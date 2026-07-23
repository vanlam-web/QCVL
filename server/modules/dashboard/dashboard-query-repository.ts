import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'

type Period = 'today' | 'yesterday' | 'last_7_days' | 'month' | 'last_month'
type Range = { from: string; to: string }

export function createDashboardQueryRepository(pool: pg.Pool, deps: { ensureTables(pool: pg.Pool): Promise<void>; ensureSnapshots(pool: pg.Pool): Promise<void> }): Pick<ServerRepository, 'getDashboardData'> {
  return {
    async getDashboardData(input) {
      await Promise.all([deps.ensureTables(pool), deps.ensureSnapshots(pool)])
      const now = new Date(input.now)
      const periods = [rangeFor(now, 'today'), rangeFor(now, input.salesResultPeriod), previousRangeFor(now, input.salesResultPeriod), rangeFor(now, input.revenuePeriod), rangeFor(now, input.productRankPeriod), rangeFor(now, input.customerRankPeriod)]
      const values = [input.organizationId, ...periods.flatMap((period) => [period.from, period.to])]
      const invoiceFilter = (from: number) => `o.organization_id = $1 and o.order_type = 'invoice' and o.status <> 'cancelled' and o.created_at >= ($${from}::date::timestamp at time zone 'UTC') and o.created_at < (($${from + 1}::date + 1)::timestamp at time zone 'UTC')`
      const result = await pool.query(`
        with
        today as (select coalesce(sum(o.total_amount), 0)::float8 as revenue, count(*)::int as invoice_count, coalesce(sum(greatest(o.total_amount, 0)), 0)::float8 as net_revenue from orders o where ${invoiceFilter(2)}),
        sales_result as (select coalesce(sum(o.total_amount), 0)::float8 as revenue, count(*)::int as invoice_count, coalesce(sum(greatest(o.total_amount, 0)), 0)::float8 as net_revenue from orders o where ${invoiceFilter(4)}),
        previous_sales_result as (select coalesce(sum(greatest(o.total_amount, 0)), 0)::float8 as net_revenue from orders o where ${invoiceFilter(6)}),
        revenue_documents as (select o.total_amount, o.created_at from orders o where ${invoiceFilter(8)}),
        revenue_summary as (
          select coalesce((select sum(greatest(total_amount, 0)) from revenue_documents), 0)::float8 as net_revenue,
          coalesce((select jsonb_agg(jsonb_build_object('date', date, 'value', value) order by date) from (select (created_at at time zone 'UTC')::date::text as date, sum(greatest(total_amount, 0))::float8 as value from revenue_documents group by 1) daily), '[]'::jsonb) as daily,
          coalesce((select jsonb_agg(jsonb_build_object('weekday', weekday, 'value', value) order by weekday) from (select extract(dow from created_at at time zone 'UTC')::int as weekday, sum(greatest(total_amount, 0))::float8 as value from revenue_documents group by 1) weekday), '[]'::jsonb) as weekday
        ),
        top_products as (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label), '[]'::jsonb) as items from (
          select coalesce(nullif(concat_ws(' ', nullif(oi.product_snapshot->>'code', ''), nullif(oi.product_snapshot->>'name', ''), nullif(p.code, ''), nullif(p.name, '')), ''), oi.product_id, 'Sản phẩm') as label, sum(greatest(coalesce(oi.line_total, oi.quantity * oi.unit_price - oi.discount_amount, 0), 0))::float8 as value
          from orders o join order_items oi on oi.order_id = o.id
          left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
          where ${invoiceFilter(10)} group by 1 order by 2 desc, 1 limit 10
        ) ranked),
        top_customers as (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label), '[]'::jsonb) as items from (
          select coalesce(nullif(concat_ws(' ', nullif(o.customer_snapshot->>'code', ''), nullif(o.customer_snapshot->>'name', '')), ''), 'Khách lẻ') as label, sum(o.total_amount)::float8 as value from orders o where ${invoiceFilter(12)} group by 1 order by 2 desc, 1 limit 10
        ) ranked),
        invoice_activities as (select coalesce(jsonb_agg(jsonb_build_object('kind', case when o.paid_amount > 0 then 'payment' else 'invoice' end, 'actor', coalesce(nullif(o.seller_snapshot->>'name', ''), 'Nhân viên'), 'action', case when o.paid_amount > 0 then 'bán và thu hóa đơn' else 'bán hóa đơn' end, 'counterparty_preposition', 'cho', 'counterparty_label', coalesce(nullif(o.customer_snapshot->>'name', ''), 'khách lẻ'), 'counterparty_code', nullif(o.customer_snapshot->>'code', ''), 'value', o.total_amount::float8, 'document_code', o.code, 'created_at', o.created_at) order by o.created_at desc), '[]'::jsonb) as items from (select * from orders o where o.organization_id = $1 and o.order_type = 'invoice' and o.status <> 'cancelled' order by o.created_at desc limit 21) o)
        select row_to_json(today)::jsonb as today, row_to_json(sales_result)::jsonb as sales_result, previous_sales_result.net_revenue::text as previous_sales_result_net_revenue, row_to_json(revenue_summary)::jsonb as revenue, top_products.items as top_products, top_customers.items as top_customers, invoice_activities.items as invoice_activities from today cross join sales_result cross join previous_sales_result cross join revenue_summary cross join top_products cross join top_customers cross join invoice_activities
      `, values)
      const row = result.rows[0] ?? {}
      const invoiceActivities = Array.isArray(row.invoice_activities) ? row.invoice_activities : []
      const purchases = await pool.query<{ data: { code?: string; created_at?: string; payable_amount?: number; supplier?: { name?: string; code?: string }; created_by?: { name?: string } } }>(`select data from purchase_receipt_snapshots where organization_id = $1 and data->>'status' = 'posted' order by coalesce(nullif(data->>'received_at', '')::timestamptz, created_at) desc limit 21`, [input.organizationId])
      const purchaseActivities = purchases.rows.map(({ data }) => ({ kind: 'purchase', actor: data.created_by?.name || 'Nhân viên', action: 'mua hàng', counterparty_preposition: 'từ', counterparty_label: data.supplier?.name || 'NCC lẻ', counterparty_code: data.supplier?.code || null, value: Number(data.payable_amount ?? 0), document_code: data.code || '', created_at: data.created_at || '' })).filter((item) => item.created_at)
      const activities = [...invoiceActivities, ...purchaseActivities].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20)
      return { today: row.today ?? { revenue: 0, invoice_count: 0, net_revenue: 0 }, sales_result: row.sales_result ?? { revenue: 0, invoice_count: 0, net_revenue: 0 }, previous_sales_result_net_revenue: Number(row.previous_sales_result_net_revenue ?? 0), revenue: row.revenue ?? { net_revenue: 0, daily: [], weekday: [] }, top_products: row.top_products ?? [], top_customers: row.top_customers ?? [], activities, has_more_activities: invoiceActivities.length > 20 || purchaseActivities.length > 20 }
    },
  }
}

function rangeFor(now: Date, period: Period): Range { const today = dateText(now); if (period === 'today') return { from: today, to: today }; if (period === 'yesterday') { const date = dateText(addDays(now, -1)); return { from: date, to: date } }; if (period === 'last_7_days') return { from: dateText(addDays(now, -6)), to: today }; if (period === 'last_month') return { from: dateText(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: dateText(new Date(now.getFullYear(), now.getMonth(), 0)) }; return { from: dateText(new Date(now.getFullYear(), now.getMonth(), 1)), to: today } }
function previousRangeFor(now: Date, period: Period): Range { if (period === 'today') return rangeFor(addDays(now, -1), 'today'); if (period === 'yesterday') return rangeFor(addDays(now, -2), 'today'); if (period === 'last_7_days') return { from: dateText(addDays(now, -13)), to: dateText(addDays(now, -7)) }; if (period === 'last_month') return rangeFor(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'last_month'); const start = new Date(now.getFullYear(), now.getMonth() - 1, 1), end = new Date(now.getFullYear(), now.getMonth(), 0); return { from: dateText(start), to: dateText(new Date(start.getFullYear(), start.getMonth(), Math.min(now.getDate(), end.getDate()))) } }
function addDays(value: Date, days: number) { const result = new Date(value); result.setDate(result.getDate() + days); return result }
function dateText(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }