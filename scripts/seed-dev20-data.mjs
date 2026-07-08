import { createHash } from 'node:crypto'
import pg from 'pg'

const { Client } = pg
const ORG = '00000000-0000-4000-8000-000000000001'
const PREFIX = 'DEV20'
const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function id(name) {
  const h = createHash('md5').update(`qcvl-dev20:${name}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

async function main() {
  const db = new Client({ connectionString })
  await db.connect()
  const q = (sql, params = []) => db.query(sql, params)

  await db.query('begin')
  try {
    const { rows: [ctx] } = await q(`
      select
        (select user_id from public.profiles where organization_id=$1 order by created_at, user_id limit 1) actor,
        (select id from public.price_lists where organization_id=$1 and is_default=true order by created_at limit 1) price_list,
        (select id from public.inventory_units where organization_id=$1 and code='M2' limit 1) unit_m2,
        (select id from public.finance_accounts where organization_id=$1 and account_type='cash' and is_default_cash=true limit 1) cash,
        (select id from public.production_machines where organization_id=$1 order by code limit 1) machine
    `, [ORG])

    for (const [key, value] of Object.entries(ctx)) {
      if (!value) throw new Error(`Missing seed context: ${key}`)
    }

    await q(`
      update public.customers
      set name='Khách lẻ', phone=null, customer_group_id=null
      where organization_id=$1 and code='KH000001'
    `, [ORG])

    for (let i = 1; i <= 20; i += 1) {
      const n = String(i).padStart(3, '0')
      const keys = ['kh', 'sp', 'vt', 'ncc', 'bom', 'bomi', 'pn', 'pni', 'hd', 'hdi', 'pt', 'ptm', 'pc', 'cbe1', 'cbe2', 'debt', 'roll', 'sheet', 'sm1', 'sm2', 'queue']
      const ids = Object.fromEntries(keys.map((key) => [key, id(`${key}-${i}`)]))
      const productCode = `${PREFIX}-SP-${n}`
      const componentCode = `${PREFIX}-VT-${n}`
      const customerCode = `${PREFIX}-KH-${n}`
      const supplierCode = `${PREFIX}-NCC-${n}`
      const price = 50000 + i * 5000
      const quantity = (i % 3) + 1
      const total = price * quantity
      const paid = Math.floor(total / 2)
      const debt = total - paid
      const phone = `090${String(8000000 + i).padStart(7, '0')}`

      await q(`insert into public.customers (id,organization_id,code,name,phone,customer_group_id) values ($1,$2,$3,$4,$5,null) on conflict (id) do update set code=excluded.code,name=excluded.name,phone=excluded.phone`, [ids.kh, ORG, customerCode, `Khách test ${n}`, phone])
      await q(`insert into public.products (id,organization_id,code,name,status,unit_name,sell_method,product_kind) values ($1,$2,$3,$4,'active','m2','area_m2','goods'),($5,$2,$6,$7,'active','m2','area_m2','auxiliary_material') on conflict (id) do update set code=excluded.code,name=excluded.name,status='active',unit_name='m2',sell_method='area_m2',product_kind=excluded.product_kind`, [ids.sp, ORG, productCode, `Sản phẩm test ${n}`, ids.vt, componentCode, `Vật tư test ${n}`])
      await q(`insert into public.price_list_items (organization_id,price_list_id,product_id,unit_price) values ($1,$2,$3,$4),($1,$2,$5,$6) on conflict (price_list_id,product_id) do update set unit_price=excluded.unit_price`, [ORG, ctx.price_list, ids.sp, price, ids.vt, Math.floor(price / 3)])
      await q(`insert into public.product_inventory_settings (organization_id,product_id,inventory_shape,stock_unit_id) values ($1,$2,'normal',$3),($1,$4,'normal',$3) on conflict (organization_id,product_id) do update set inventory_shape='normal',stock_unit_id=excluded.stock_unit_id`, [ORG, ids.sp, ctx.unit_m2, ids.vt])
      await q(`insert into public.suppliers (id,organization_id,code,name,phone,status) values ($1,$2,$3,$4,$5,'active') on conflict (id) do update set code=excluded.code,name=excluded.name,phone=excluded.phone,status='active'`, [ids.ncc, ORG, supplierCode, `Nhà cung cấp test ${n}`, `091${String(7000000 + i).padStart(7, '0')}`])
      await q(`insert into public.product_boms (id,organization_id,product_id,version,status,notes,created_by) values ($1,$2,$3,1,'active',$4,$5) on conflict (id) do update set status='active',notes=excluded.notes`, [ids.bom, ORG, ids.sp, `BOM test ${n}`, ctx.actor])
      await q(`insert into public.product_bom_items (id,organization_id,bom_id,component_product_id,quantity,sort_order,notes) values ($1,$2,$3,$4,1,1,$5) on conflict (id) do update set quantity=1,notes=excluded.notes`, [ids.bomi, ORG, ids.bom, ids.vt, `BOM item test ${n}`])
      await q(`insert into public.purchase_receipts (id,organization_id,code,supplier_id,status,subtotal_amount,discount_amount,payable_amount,paid_amount,remaining_amount,created_by) values ($1,$2,$3,$4,'draft',$5,0,$5,0,$5,$6) on conflict (id) do update set code=excluded.code,supplier_id=excluded.supplier_id,subtotal_amount=excluded.subtotal_amount,payable_amount=excluded.payable_amount,remaining_amount=excluded.remaining_amount`, [ids.pn, ORG, `${PREFIX}-PN-${n}`, ids.ncc, total, ctx.actor])
      await q(`insert into public.purchase_receipt_items (id,organization_id,purchase_receipt_id,product_id,line_no,unit_name_snapshot,quantity,unit_cost,line_amount) values ($1,$2,$3,$4,1,'m2',$5,$6,$7) on conflict (id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,line_amount=excluded.line_amount`, [ids.pni, ORG, ids.pn, ids.sp, quantity, price, total])

      const customerSnapshot = JSON.stringify({ id: ids.kh, code: customerCode, name: `Khách test ${n}`, phone })
      await q(`insert into public.orders (id,organization_id,code,base_code,order_type,status,customer_id,customer_snapshot,subtotal_amount,discount_amount,total_amount,paid_amount,debt_amount,payment_status,created_by) values ($1,$2,$3,$3,'invoice','completed',$4,$5::jsonb,$6,0,$6,$7,$8,$9,$10) on conflict (id) do update set code=excluded.code,base_code=excluded.base_code,customer_id=excluded.customer_id,customer_snapshot=excluded.customer_snapshot,subtotal_amount=excluded.subtotal_amount,total_amount=excluded.total_amount,paid_amount=excluded.paid_amount,debt_amount=excluded.debt_amount,payment_status=excluded.payment_status`, [ids.hd, ORG, `${PREFIX}-HD-${n}`, ids.kh, customerSnapshot, total, paid, debt, debt > 0 ? 'partial' : 'paid', ctx.actor])
      await q(`insert into public.order_items (id,organization_id,order_id,line_no,product_id,product_snapshot,sell_method,quantity,unit_price,line_subtotal_amount,discount_amount,price_source,line_total) values ($1,$2,$3,1,$4,$5::jsonb,'area_m2',$6,$7,$8,0,'manual',$8) on conflict (id) do update set quantity=excluded.quantity,unit_price=excluded.unit_price,line_total=excluded.line_total`, [ids.hdi, ORG, ids.hd, ids.sp, JSON.stringify({ id: ids.sp, code: productCode, name: `Sản phẩm test ${n}`, unit_name: 'm2' }), quantity, price, total])
      await q(`insert into public.payment_receipts (id,organization_id,code,base_code,receipt_type,order_id,customer_id,total_received_amount,sale_payment_amount,debt_collection_amount,change_returned_amount,created_by) values ($1,$2,$3,$3,'sale_payment',$4,$5,$6,$6,0,0,$7) on conflict (id) do update set code=excluded.code,total_received_amount=excluded.total_received_amount,sale_payment_amount=excluded.sale_payment_amount`, [ids.pt, ORG, `${PREFIX}-PT-${n}`, ids.hd, ids.kh, paid, ctx.actor])
      await q(`insert into public.payment_receipt_methods (id,organization_id,payment_receipt_id,line_no,finance_account_id,method_type,amount) values ($1,$2,$3,1,$4,'cash',$5) on conflict (id) do update set amount=excluded.amount`, [ids.ptm, ORG, ids.pt, ctx.cash, paid])
      await q(`insert into public.cashbook_entries (id,organization_id,finance_account_id,source_type,payment_receipt_method_id,direction,amount_delta,created_by) values ($1,$2,$3,'payment_receipt_method',$4,'in',$5,$6) on conflict (id) do update set amount_delta=excluded.amount_delta`, [ids.cbe1, ORG, ctx.cash, ids.ptm, paid, ctx.actor])
      await q(`insert into public.cashbook_vouchers (id,organization_id,code,base_code,voucher_direction,voucher_type,finance_account_id,amount,counterparty_type,partner_debt_mode,reason,created_by) values ($1,$2,$3,$3,'out','operating_expense',$4,$5,'other','no_partner_debt',$6,$7) on conflict (id) do update set code=excluded.code,amount=excluded.amount,reason=excluded.reason`, [ids.pc, ORG, `${PREFIX}-PC-${n}`, ctx.cash, Math.max(10000, Math.floor(total / 5)), `Chi phí test ${n}`, ctx.actor])
      await q(`insert into public.cashbook_entries (id,organization_id,finance_account_id,source_type,cashbook_voucher_id,direction,amount_delta,created_by) values ($1,$2,$3,'cashbook_voucher',$4,'out',$5,$6) on conflict (id) do update set amount_delta=excluded.amount_delta`, [ids.cbe2, ORG, ctx.cash, ids.pc, -Math.max(10000, Math.floor(total / 5)), ctx.actor])
      if (debt > 0) await q(`insert into public.customer_debt_entries (id,organization_id,order_id,customer_id,entry_type,amount_delta,balance_after_order,balance_after_customer,created_by) values ($1,$2,$3,$4,'invoice_debt',$5,$5,$5,$6) on conflict (id) do update set amount_delta=excluded.amount_delta,balance_after_order=excluded.balance_after_order,balance_after_customer=excluded.balance_after_customer`, [ids.debt, ORG, ids.hd, ids.kh, debt, ctx.actor])
      await q(`insert into public.inventory_rolls (id,organization_id,product_id,code,width_m,initial_length_m,remaining_length_m,initial_area_m2,remaining_area_m2,status,created_by) values ($1,$2,$3,$4,1.27,50,45,63.5,57.15,'in_use',$5) on conflict (id) do update set code=excluded.code,remaining_length_m=45,remaining_area_m2=57.15`, [ids.roll, ORG, ids.sp, `${PREFIX}-ROLL-${n}`, ctx.actor])
      await q(`insert into public.inventory_sheets (id,organization_id,product_id,code,sheet_kind,width_m,length_m,area_m2,status,created_by) values ($1,$2,$3,$4,'full',1.22,2.44,2.9768,'available',$5) on conflict (id) do update set code=excluded.code,status='available'`, [ids.sheet, ORG, ids.sp, `${PREFIX}-SHEET-${n}`, ctx.actor])
      await q(`insert into public.stock_movements (id,organization_id,product_id,movement_type,quantity_delta,stock_unit_id,purchase_receipt_id,purchase_receipt_item_id,created_by,reason) values ($1,$2,$3,'purchase_receipt',$4,$5,$6,$7,$8,$9) on conflict (id) do update set quantity_delta=excluded.quantity_delta,reason=excluded.reason`, [ids.sm1, ORG, ids.sp, quantity, ctx.unit_m2, ids.pn, ids.pni, ctx.actor, `Nhập test ${n}`])
      await q(`insert into public.stock_movements (id,organization_id,product_id,movement_type,quantity_delta,stock_unit_id,order_id,order_item_id,created_by,reason) values ($1,$2,$3,'sale_deduction',$4,$5,$6,$7,$8,$9) on conflict (id) do update set quantity_delta=excluded.quantity_delta,reason=excluded.reason`, [ids.sm2, ORG, ids.sp, -quantity, ctx.unit_m2, ids.hd, ids.hdi, ctx.actor, `Bán test ${n}`])
      await q(`insert into public.production_queue_items (id,organization_id,production_machine_id,source,raw_file_name,parse_status,parsed_payload,status) values ($1,$2,$3,'manual_simulator',$4,'ok',$5::jsonb,'queued') on conflict (id) do update set raw_file_name=excluded.raw_file_name,parsed_payload=excluded.parsed_payload,status='queued'`, [ids.queue, ORG, ctx.machine, `${customerCode}_${productCode}_100x50_x${quantity}.cdr`, JSON.stringify({ customer_code: customerCode, product_code: productCode, width_cm: 100, height_cm: 50, quantity })])
    }

    await db.query('commit')
  } catch (error) {
    await db.query('rollback')
    throw error
  } finally {
    await db.end()
  }
}

await main()
