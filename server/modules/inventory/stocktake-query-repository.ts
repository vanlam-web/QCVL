import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Stocktake=Awaited<ReturnType<NonNullable<ServerRepository['listStocktakes']>>>[number]
export function createStocktakeQueryRepository(pool:pg.Pool):Pick<ServerRepository,'listStocktakes'|'listStocktakesPage'>{return{
    async listStocktakes(input) {
      const search = normalizeSearch(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const createdBy = input.url.searchParams.get('created_by')
      const clauses = ['st.organization_id = $1']
      const values: unknown[] = [input.organizationId]

      if (status === '__none__') {
        clauses.push('false')
      } else if (status) {
        const statuses = status.split(',').map((item) => item.trim()).filter(Boolean)
        if (statuses.length > 0) {
          values.push(statuses)
          clauses.push(`st.status = any($${values.length}::text[])`)
        }
      }
      if (from) {
        values.push(from)
        clauses.push(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (to) {
        values.push(to)
        clauses.push(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        clauses.push(`(
          ${accentSql('st.code')} like $${values.length}
          or ${accentSql("coalesce(st.note, '')")} like $${values.length}
          or exists (
            select 1
            from stocktake_items search_sti
            left join products search_product
              on search_product.organization_id = search_sti.organization_id
              and search_product.id = search_sti.product_id
            where search_sti.organization_id = st.organization_id
              and search_sti.stocktake_id = st.id
              and (
                ${accentSql("coalesce(search_sti.source_product_code, search_product.code, '')")} like $${values.length}
                or ${accentSql("coalesce(search_sti.source_product_name, search_product.name, '')")} like $${values.length}
              )
          )
        )`)
      }
      if (createdBy && createdBy !== 'all') {
        values.push(createdBy)
        clauses.push(`st.created_by = $${values.length}::uuid`)
      }

      const result = await pool.query(
        `
          select
            st.id::text,
            st.code,
            st.status,
            st.source_type,
            st.source_creator_name,
            coalesce(st.source_created_at, st.created_at) as created_at,
            coalesce(st.source_balanced_at, st.balanced_at) as balanced_at,
            coalesce(sum(sti.actual_qty), 0) as total_actual_qty,
            case
              when count(sti.line_actual_value) = 0 then null
              else sum(sti.line_actual_value)
            end as total_actual_value,
            case
              when count(sti.line_difference_value) = 0 then null
              else sum(sti.line_difference_value)
            end as total_difference_value,
            coalesce(sum(greatest(sti.difference_qty, 0)), 0) as increased_qty,
            abs(coalesce(sum(least(sti.difference_qty, 0)), 0)) as decreased_qty,
            created_by_user.id::text as created_by_id,
            created_by_user.display_name as created_by_name,
            (
              select coalesce(nullif(list_sti.source_product_code, ''), list_product.code, '')
              from stocktake_items list_sti
              left join products list_product
                on list_product.organization_id = list_sti.organization_id
                and list_product.id = list_sti.product_id
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_code,
            (
              select coalesce(nullif(list_sti.source_product_name, ''), list_product.name, nullif(list_sti.source_product_code, ''), '')
              from stocktake_items list_sti
              left join products list_product
                on list_product.organization_id = list_sti.organization_id
                and list_product.id = list_sti.product_id
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_name,
            (
              select list_sti.system_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_system_qty,
            (
              select list_sti.actual_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_actual_qty,
            (
              select list_sti.difference_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_difference_qty,
            st.note
          from stocktakes st
          left join stocktake_items sti on sti.organization_id = st.organization_id and sti.stocktake_id = st.id
          left join users created_by_user on created_by_user.organization_id = st.organization_id and created_by_user.id = st.created_by
          where ${clauses.join(' and ')}
          group by st.id, st.code, st.status, st.source_type, st.source_creator_name, st.source_created_at, st.created_at, st.source_balanced_at, st.balanced_at, created_by_user.id, created_by_user.display_name, st.note
          order by coalesce(st.source_created_at, st.created_at) desc
        `,
        values,
      )

      return result.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        status: row.status === 'draft' || row.status === 'cancelled' ? row.status : 'balanced',
        source_type: row.source_type === 'kiotviet_import' || row.source_type === 'product_edit' ? row.source_type : 'manual',
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        balanced_at: row.balanced_at === null ? null : row.balanced_at?.toISOString?.() ?? row.balanced_at,
        source_creator_name: row.source_creator_name === null ? null : String(row.source_creator_name),
        created_by: row.created_by_id === null || row.created_by_id === undefined ? null : {
          id: String(row.created_by_id),
          name: String(row.created_by_name ?? row.created_by_id),
        },
        total_actual_qty: Number(row.total_actual_qty),
        total_actual_value: row.total_actual_value === null ? null : Number(row.total_actual_value),
        total_difference_value: row.total_difference_value === null ? null : Number(row.total_difference_value),
        increased_qty: Number(row.increased_qty),
        decreased_qty: Number(row.decreased_qty),
        product_code: row.product_code === null || row.product_code === undefined ? null : String(row.product_code),
        product_name: row.product_name === null || row.product_name === undefined ? null : String(row.product_name),
        product_system_qty: row.product_system_qty === null || row.product_system_qty === undefined ? null : Number(row.product_system_qty),
        product_actual_qty: row.product_actual_qty === null || row.product_actual_qty === undefined ? null : Number(row.product_actual_qty),
        product_difference_qty: row.product_difference_qty === null || row.product_difference_qty === undefined ? null : Number(row.product_difference_qty),
        note: row.note === null ? null : String(row.note),
      })) satisfies Stocktake[]
    },

    async listStocktakesPage(input) {
      const items = await this.listStocktakes?.(input) ?? []
      const { page, pageSize } = paginate(input.url, 15)
      const start = Math.max(0, page - 1) * pageSize
      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        creator_options: creatorOptions(items),
      }
    },

  }}
function normalizeSearch(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim()}
function accentSql(expression:string){return `translate(lower(${expression}), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')`}
function paginate(url:URL,size:number){return{page:Math.max(1,Number.parseInt(url.searchParams.get('page')??'1',10)||1),pageSize:Math.max(1,Number.parseInt(url.searchParams.get('page_size')??String(size),10)||size)}}
function creatorOptions(items:Stocktake[]){const seen=new Map<string,{id:string;name:string}>();for(const item of items)if(item.created_by)seen.set(item.created_by.id,item.created_by);return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'))}
