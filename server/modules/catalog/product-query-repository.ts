import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Product=Awaited<ReturnType<NonNullable<ServerRepository['listProducts']>>>[number]
type RankInput={pool:pg.Pool;organizationId:string;userId?:string;entityType:'product';url:URL;items:Product[];codeOf:(item:Product)=>string;nameOf:(item:Product)=>string}
export function createProductQueryRepository(pool:pg.Pool,deps:{ensureStock:(pool:pg.Pool)=>Promise<void>;rank:(input:RankInput)=>Promise<Product[]>}):Pick<ServerRepository,'listProducts'|'listProductsPage'>{
 const ensureStock=deps.ensureStock,rankProducts=deps.rank
 return {
    async listProducts(input) {
      await ensureStock(pool)
      const search = normalizeSearch(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const sellMethod = input.url.searchParams.get('sell_method')
      const inventoryShape = input.url.searchParams.get('inventory_shape')
      const productKind = input.url.searchParams.get('product_kind')
      const productGroupIds = input.url.searchParams.getAll('product_group_id')
      const createdFrom = input.url.searchParams.get('created_from')
      const createdTo = input.url.searchParams.get('created_to')
      const clauses = ['p.organization_id = $1']
      const values: unknown[] = [input.organizationId]
      if (status === 'deleted') {
        clauses.push(`p.code like '%{DEL}%'`)
      } else if (status && status !== 'all') {
        values.push(status)
        clauses.push(`p.status = $${values.length}`)
        clauses.push(`p.code not like '%{DEL}%'`)
      }
      if (sellMethod) {
        values.push(sellMethod)
        clauses.push(`p.sell_method = $${values.length}`)
      }
      if (inventoryShape) {
        values.push(inventoryShape)
        clauses.push(`p.inventory_shape = $${values.length}`)
      }
      if (productKind) {
        values.push(productKind)
        clauses.push(`p.product_kind = $${values.length}`)
      }
      if (productGroupIds.length > 0) {
        values.push(productGroupIds)
        clauses.push(`p.product_group_id = any($${values.length}::uuid[])`)
      }
      if (createdFrom) {
        values.push(createdFrom)
        clauses.push(`(p.created_at at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (createdTo) {
        values.push(createdTo)
        clauses.push(`(p.created_at at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        clauses.push(`(${accentSql('p.code')} like $${values.length} or ${accentSql('p.name')} like $${values.length})`)
      }

      const result = await pool.query(
        `
          select
            p.id::text,
            p.code,
            p.name,
            p.status,
            p.product_kind,
            p.unit_name,
            p.sell_method,
            p.latest_purchase_cost,
            p.latest_purchase_cost_at,
            pli.unit_price as default_sale_price,
            coalesce(price_data.price_list_prices, '{}'::jsonb) as price_list_prices,
            p.product_group_id::text,
            case
              when pg.id is null then null
              else jsonb_build_object('id', pg.id::text, 'code', pg.code, 'name', pg.name)
            end as product_group,
            p.inventory_shape,
            p.track_inventory,
            coalesce(unit_data.unit_conversions, '[]'::jsonb) as unit_conversions,
            provisional_data.kiotviet_provisional_stock,
            operating_stock_data.operating_stock,
            latest_stocktake_data.latest_kiotviet_stocktake,
            draft_bom_data.draft_bom,
            p.created_at,
            p.updated_at
          from products p
          left join product_groups pg on pg.id = p.product_group_id and pg.organization_id = p.organization_id
          left join price_lists pl on pl.organization_id = p.organization_id and pl.is_default = true and pl.is_active = true
          left join price_list_items pli on pli.organization_id = p.organization_id and pli.price_list_id = pl.id and pli.product_id = p.id
          left join lateral (
            select jsonb_object_agg(pli_all.price_list_id::text, pli_all.unit_price) as price_list_prices
            from price_list_items pli_all
            where pli_all.organization_id = p.organization_id
              and pli_all.product_id = p.id
          ) price_data on true
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'source_code', puc.source_code,
                'unit_name', sale_unit.name,
                'stock_qty_per_unit', puc.stock_qty_per_sale_unit,
                'is_default_purchase_unit', puc.is_default_purchase_unit,
                'is_default_sale_unit', puc.is_default_sale_unit
              )
              order by puc.is_default_sale_unit desc, puc.is_default_purchase_unit desc, sale_unit.name
            ) as unit_conversions
            from product_unit_conversions puc
            join inventory_units sale_unit on sale_unit.id = puc.sale_unit_id
            where puc.organization_id = p.organization_id
              and puc.product_id = p.id
              and puc.is_active = true
              and sale_unit.is_active = true
          ) unit_data on true
          left join lateral (
            select jsonb_build_object(
              'quantity', ipb.remaining_qty,
              'unit_name', stock_unit.name,
              'source_type', ipb.source_type,
              'source_label', ipb.source_label,
              'status', ipb.status,
              'updated_at', ipb.updated_at
            ) as kiotviet_provisional_stock
            from inventory_provisional_balances ipb
            join inventory_units stock_unit on stock_unit.id = ipb.stock_unit_id
            where ipb.organization_id = p.organization_id
              and ipb.product_id = p.id
              and ipb.source_type = 'kiotviet_import'
            order by ipb.updated_at desc
            limit 1
          ) provisional_data on true
          left join lateral (
            select jsonb_build_object(
              'quantity', coalesce(latest.ending_qty, movement_total.quantity),
              'unit_name', p.unit_name,
              'source_type', 'stock_movements',
              'source_label', 'Moc ton + chung tu',
              'updated_at', latest.created_at
            ) as operating_stock
            from (
              select sm.id, sm.ending_qty, sm.created_at
              from stock_movements sm
              where sm.organization_id = p.organization_id
                and sm.product_id = p.id
              order by sm.created_at desc, sm.id desc
              limit 1
            ) latest
            cross join lateral (
              select coalesce(sum(sm_total.quantity_delta), 0) as quantity
              from stock_movements sm_total
              where sm_total.organization_id = p.organization_id
                and sm_total.product_id = p.id
            ) movement_total
          ) operating_stock_data on true
          left join lateral (
            select jsonb_build_object(
              'code', st.code,
              'source_created_at', st.source_created_at,
              'source_balanced_at', st.source_balanced_at,
              'system_qty', sti.system_qty,
              'actual_qty', sti.actual_qty,
              'difference_qty', sti.difference_qty,
              'unit_name', coalesce(sti.source_unit_name, stock_unit.name)
            ) as latest_kiotviet_stocktake
            from stocktake_items sti
            join stocktakes st on st.id = sti.stocktake_id and st.organization_id = sti.organization_id
            left join inventory_units stock_unit on stock_unit.id = sti.stock_unit_id
            where sti.organization_id = p.organization_id
              and sti.product_id = p.id
              and st.source_type = 'kiotviet_import'
              and st.source_system = 'kiotviet'
            order by coalesce(st.source_balanced_at, st.source_created_at, st.created_at) desc, sti.line_no desc
            limit 1
          ) latest_stocktake_data on true
          left join lateral (
            select jsonb_build_object(
              'id', pb.id::text,
              'version', pb.version,
              'status', pb.status,
              'item_count', count(pbi.id),
              'notes', pb.notes
            ) as draft_bom
            from product_boms pb
            left join product_bom_items pbi on pbi.organization_id = pb.organization_id and pbi.bom_id = pb.id
            where pb.organization_id = p.organization_id
              and pb.product_id = p.id
              and pb.status in ('active', 'draft')
            group by pb.id, pb.version, pb.status, pb.notes, pb.created_at
            order by case when pb.status = 'active' then 0 else 1 end, pb.version desc, pb.created_at desc
            limit 1
          ) draft_bom_data on true
          where ${clauses.join(' and ')}
          order by p.created_at desc, p.code asc, p.name asc
        `,
        values,
      )
      const items = result.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        status: String(row.status),
        product_kind: String(row.product_kind),
        unit_name: String(row.unit_name),
        sell_method: String(row.sell_method),
        latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
        latest_purchase_cost_at: row.latest_purchase_cost_at?.toISOString?.() ?? row.latest_purchase_cost_at ?? null,
        default_sale_price: row.default_sale_price === null ? null : Number(row.default_sale_price),
        price_list_prices: priceMap(row.price_list_prices),
        product_group_id: row.product_group_id === null ? null : String(row.product_group_id),
        product_group: row.product_group ?? null,
        inventory_shape: String(row.inventory_shape),
        track_inventory: Boolean(row.track_inventory),
        unit_conversions: (row.unit_conversions ?? []).map((conversion: {
          source_code?: string | null
          unit_name: string
          stock_qty_per_unit: string | number
          is_default_purchase_unit: boolean
          is_default_sale_unit: boolean
        }) => ({
          source_code: conversion.source_code ?? null,
          unit_name: String(conversion.unit_name),
          stock_qty_per_unit: Number(conversion.stock_qty_per_unit),
          is_default_purchase_unit: Boolean(conversion.is_default_purchase_unit),
          is_default_sale_unit: Boolean(conversion.is_default_sale_unit),
        })),
        kiotviet_provisional_stock: row.kiotviet_provisional_stock
          ? {
              quantity: Number(row.kiotviet_provisional_stock.quantity),
              unit_name: String(row.kiotviet_provisional_stock.unit_name),
              source_type: 'kiotviet_import',
              source_label: row.kiotviet_provisional_stock.source_label === null ? null : String(row.kiotviet_provisional_stock.source_label),
              status: String(row.kiotviet_provisional_stock.status),
              updated_at: row.kiotviet_provisional_stock.updated_at?.toISOString?.() ?? row.kiotviet_provisional_stock.updated_at ?? null,
            }
          : null,
        operating_stock: row.operating_stock
          ? {
              quantity: Number(row.operating_stock.quantity),
              unit_name: String(row.operating_stock.unit_name),
              source_type: 'stock_movements',
              source_label: row.operating_stock.source_label === null ? null : String(row.operating_stock.source_label),
              updated_at: row.operating_stock.updated_at?.toISOString?.() ?? row.operating_stock.updated_at ?? null,
            }
          : null,
        latest_kiotviet_stocktake: row.latest_kiotviet_stocktake
          ? {
              code: String(row.latest_kiotviet_stocktake.code),
              source_created_at: dateText(row.latest_kiotviet_stocktake.source_created_at),
              source_balanced_at: dateText(row.latest_kiotviet_stocktake.source_balanced_at),
              system_qty: row.latest_kiotviet_stocktake.system_qty === null ? null : Number(row.latest_kiotviet_stocktake.system_qty),
              actual_qty: row.latest_kiotviet_stocktake.actual_qty === null ? null : Number(row.latest_kiotviet_stocktake.actual_qty),
              difference_qty: row.latest_kiotviet_stocktake.difference_qty === null ? null : Number(row.latest_kiotviet_stocktake.difference_qty),
              unit_name: row.latest_kiotviet_stocktake.unit_name === null ? null : String(row.latest_kiotviet_stocktake.unit_name),
            }
          : null,
        draft_bom: row.draft_bom
          ? {
              id: String(row.draft_bom.id),
              version: Number(row.draft_bom.version),
              status: String(row.draft_bom.status) as 'draft' | 'active' | 'archived',
              item_count: Number(row.draft_bom.item_count),
              notes: row.draft_bom.notes === null ? null : String(row.draft_bom.notes),
            }
          : null,
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
      })) satisfies Product[]
      return rankProducts({
        pool,
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'product',
        url: input.url,
        items,
        codeOf: (product) => product.code,
        nameOf: (product) => product.name,
      })
    },

    async listProductsPage(input) {
      const items = await this.listProducts?.(input) ?? []
      const { page, pageSize } = paginate(input.url, 15)
      const start = Math.max(0, page - 1) * pageSize
      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        total_all: items.reduce((total, product) => total + 1 + (product.unit_conversions?.length ?? 0), 0),
      }
    },

  }
}
function normalizeSearch(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim()}
function accentSql(expression:string){return `translate(lower(${expression}), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')`}
function priceMap(value:unknown):Record<string,number>{if(!value||typeof value!=='object'||Array.isArray(value))return{};return Object.fromEntries(Object.entries(value).filter(([,price])=>Number.isFinite(Number(price))).map(([id,price])=>[id,Number(price)]))}
function dateText(value:unknown){if(value===null||value===undefined)return null;if(value instanceof Date)return value.toISOString();return String(value)}
function paginate(url:URL,defaultPageSize:number){const page=Math.max(1,Number.parseInt(url.searchParams.get('page')??'1',10)||1),pageSize=Math.max(1,Number.parseInt(url.searchParams.get('page_size')??String(defaultPageSize),10)||defaultPageSize);return{page,pageSize}}
