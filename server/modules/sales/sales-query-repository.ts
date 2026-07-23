import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
import type { SalesDocumentData, SalesDocumentPaymentReceiptData } from '../../http.js'
type SalesQueryDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  userNames(pool: pg.Pool, organizationId: string): Promise<ReadonlyMap<string, string>>
  positive(value: string | null, fallback: number): number
  filtersFromUrl(url: URL, key: string): string[]
  normalize(value: string): string
  accentSql(value: string): string
  mapRow(row: Record<string, unknown>): SalesDocumentData
  hydrateUser(document: SalesDocumentData, names: ReadonlyMap<string, string>): SalesDocumentData
  matches(url: URL, document: SalesDocumentData): boolean
  loadPaymentReceipts(pool: pg.Pool, organizationId: string, document: SalesDocumentData, names: ReadonlyMap<string, string>): Promise<SalesDocumentPaymentReceiptData[]>
  billExtras(pool: pg.Pool, organizationId: string, customerId: string, customerCode: string): Promise<{
    preferred_bill_template: string | null
    preferred_bill_templates: string[]
    address: string | null
    total_debt_amount: number | null
  }>
}
export function createSalesQueryRepository(pool:pg.Pool,deps:SalesQueryDeps):Pick<ServerRepository,'listSalesDocumentsPage'|'listSalesDocuments'|'getSalesDocument'>{const {ensureTables,userNames,positive,filtersFromUrl,normalize,accentSql,mapRow,hydrateUser,matches,loadPaymentReceipts,billExtras}=deps;return{
    async listSalesDocumentsPage(input) {
      await ensureTables(pool)
      const userDisplayNames = await userNames(pool, input.organizationId)
      const page = positive(input.url.searchParams.get('page'), 1)
      const pageSize = positive(input.url.searchParams.get('page_size'), 20)
      const offset = (page - 1) * pageSize
      const values: unknown[] = [input.organizationId]
      const filters = ['o.organization_id = $1']
      const type = filtersFromUrl(input.url, 'type')
      const status = filtersFromUrl(input.url, 'status')
      const customerId = input.url.searchParams.get('customer_id')
      const paymentStatus = filtersFromUrl(input.url, 'payment_status')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const search = normalize(input.url.searchParams.get('search') ?? '')

      if (type.length > 0) {
        values.push(type)
        filters.push(`o.order_type = any($${values.length}::text[])`)
      }
      if (status.length > 0) {
        values.push(status)
        filters.push(`o.status = any($${values.length}::text[])`)
      }
      if (customerId) {
        values.push(customerId)
        filters.push(`o.customer_id = $${values.length}`)
      }
      if (paymentStatus.length > 0) {
        values.push(paymentStatus)
        filters.push(`o.payment_status = any($${values.length}::text[])`)
      }
      if (from) {
        values.push(from)
        filters.push(`(o.created_at at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (to) {
        values.push(to)
        filters.push(`(o.created_at at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        filters.push(`(
          ${accentSql('o.code')} like $${values.length}
          or ${accentSql("coalesce(o.customer_snapshot->>'code', '')")} like $${values.length}
          or ${accentSql("coalesce(o.customer_snapshot->>'name', '')")} like $${values.length}
          or ${accentSql("coalesce(o.note, '')")} like $${values.length}
        )`)
      }

      const summaryValues = [...values]
      values.push(pageSize, offset)
      const limitPlaceholder = `$${values.length - 1}`
      const offsetPlaceholder = `$${values.length}`
      const result = await pool.query(
        `
          with filtered_orders as (
            select o.*
            from orders o
            where ${filters.join(' and ')}
          ),
          filtered_summary as (
            select
              count(*)::int as total,
              coalesce(sum(total_amount), 0) as summary_total_amount,
              coalesce(sum(debt_amount), 0) as summary_debt_amount
            from filtered_orders
          ),
          paged_orders as (
            select *
            from filtered_orders
            order by updated_at desc, created_at desc
            limit ${limitPlaceholder}
            offset ${offsetPlaceholder}
          ),
          paged_items as (
            select
              oi.order_id,
              coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'product_id', oi.product_id,
                    'product_snapshot',
                      case
                        when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                        when p.id is not null then jsonb_build_object(
                          'code', p.code,
                          'name', p.name,
                          'unit_name', p.unit_name,
                          'sell_method', p.sell_method
                        )
                        else '{}'::jsonb
                      end,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'discount_amount', oi.discount_amount,
                    'line_total', oi.line_total,
                    'width_m', oi.width_m,
                    'height_m', oi.height_m,
                    'linear_m', oi.linear_m,
                    'note', oi.note
                  ) order by oi.sort_order
                ) filter (where oi.id is not null),
                '[]'::jsonb
              ) as items
            from order_items oi
            join paged_orders po on po.id = oi.order_id
            left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
            group by oi.order_id
          )
          select
            po.*,
            coalesce(pi.items, '[]'::jsonb) as items,
            fs.total,
            fs.summary_total_amount,
            fs.summary_debt_amount
          from paged_orders po
          cross join filtered_summary fs
          left join paged_items pi on pi.order_id = po.id
          order by po.updated_at desc, po.created_at desc
        `,
        values,
      )
      const firstRow = result.rows[0]
      let total = Number(firstRow?.total ?? 0)
      let summaryTotalAmount = Number(firstRow?.summary_total_amount ?? 0)
      let summaryDebtAmount = Number(firstRow?.summary_debt_amount ?? 0)
      if (!firstRow) {
        const summaryResult = await pool.query(
          `
            select
              count(*)::int as total,
              coalesce(sum(o.total_amount), 0) as summary_total_amount,
              coalesce(sum(o.debt_amount), 0) as summary_debt_amount
            from orders o
            where ${filters.join(' and ')}
          `,
          summaryValues,
        )
        total = Number(summaryResult.rows[0]?.total ?? 0)
        summaryTotalAmount = Number(summaryResult.rows[0]?.summary_total_amount ?? 0)
        summaryDebtAmount = Number(summaryResult.rows[0]?.summary_debt_amount ?? 0)
      }
      return {
        items: result.rows
          .map(mapRow)
          .map((document) => hydrateUser(document, userDisplayNames)),
        total,
        summary: {
          total_amount: summaryTotalAmount,
          debt_amount: summaryDebtAmount,
        },
      }
    },

    async listSalesDocuments(input) {
      await ensureTables(pool)
      const userDisplayNames = await userNames(pool, input.organizationId)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'product_id', oi.product_id,
                  'product_snapshot',
                    case
                      when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                      when p.id is not null then jsonb_build_object(
                        'code', p.code,
                        'name', p.name,
                        'unit_name', p.unit_name,
                        'sell_method', p.sell_method
                      )
                      else '{}'::jsonb
                    end,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount_amount', oi.discount_amount,
                  'line_total', oi.line_total,
                  'width_m', oi.width_m,
                  'height_m', oi.height_m,
                  'linear_m', oi.linear_m,
                  'note', oi.note
                ) order by oi.sort_order
              )
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
          where o.organization_id = $1
          group by o.id
          order by o.updated_at desc, o.created_at desc
        `,
        [input.organizationId],
      )
      return result.rows
        .map(mapRow)
        .map((document) => hydrateUser(document, userDisplayNames))
        .filter((document) => matches(input.url, document))
    },

    async getSalesDocument(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'product_id', oi.product_id,
                  'product_snapshot',
                    case
                      when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                      when p.id is not null then jsonb_build_object(
                        'code', p.code,
                        'name', p.name,
                        'unit_name', p.unit_name,
                        'sell_method', p.sell_method
                      )
                      else '{}'::jsonb
                    end,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount_amount', oi.discount_amount,
                  'line_total', oi.line_total,
                  'width_m', oi.width_m,
                  'height_m', oi.height_m,
                  'linear_m', oi.linear_m,
                  'note', oi.note
                ) order by oi.sort_order
              )
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
          where o.organization_id = $1 and (o.id = $2 or o.code = $2)
          group by o.id
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!result.rows[0]) return null
      const userDisplayNames = await userNames(pool, input.organizationId)
      const document = hydrateUser(mapRow(result.rows[0]), userDisplayNames)
      const paymentReceipts = await loadPaymentReceipts(pool, input.organizationId, document, userDisplayNames)
      const billCustomer = await billExtras(
        pool,
        input.organizationId,
        document.customer.id,
        document.customer.code,
      )
      return {
        ...document,
        customer: {
          ...document.customer,
          preferred_bill_template: billCustomer.preferred_bill_template,
          preferred_bill_templates: billCustomer.preferred_bill_templates,
          address: billCustomer.address,
          total_debt_amount: billCustomer.total_debt_amount,
        },
        payment_receipts: paymentReceipts,
      }
    },

  }}
