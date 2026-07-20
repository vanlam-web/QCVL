// Canonical customer debt formula. Every read path (debt list, debt detail,
// customer list totals) must use this single query so all screens agree.
//
// Semantics per customer:
//
// - Without a KiotViet anchor (no imported `customer_debt_adjustments` row):
//     total_debt = sum(live invoice remaining debt) - sum(linked supplier receipts remaining)
//   Live remaining debt is `customer_debt_entries.remaining_debt` when an open
//   entry exists, otherwise `orders.debt_amount`.
//
// - With a KiotViet anchor (latest imported adjustment, `balance_after` is the
//   KiotViet balance snapshot at that time):
//     total_debt = balance_after
//                + sum(total_amount of non-cancelled invoices created after the anchor)
//                - sum(QCVL payments after the anchor: POS checkout + debt collection
//                      cashbook entries, matched relationally via source order or the
//                      customer id stamped in entry source)
//                + sum(KiotViet cashbook debt flows after the anchor: in = pay down,
//                      out = add debt; matched by the KV debt voucher code pattern)
//                - sum(linked supplier receipts remaining)
//
// Totals are NOT clamped to zero: a negative total means the customer has
// credit (paid more than owed) and must stay visible for reconciliation.

export const KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN = '^(CB|TTHD|TT[0-9]|TTM(HD)?[0-9]|TNHHD[0-9])'

export interface CustomerDebtTotalsRow {
  customer_id: string
  customer_code: string
  customer_name: string
  total_debt: string | number
  open_invoice_count: string | number
  oldest_order_code: string | null
  has_kiotviet_anchor: boolean
  last_activity_at: Date | string | null
}

export function customerDebtTotalsSql(options: { singleCustomer?: boolean } = {}) {
  const customerFilter = options.singleCustomer ? 'where dc.customer_id = $2' : ''
  return `
    with live_invoice_debt as (
      select
        o.customer_id,
        min(o.customer_snapshot->>'code') as customer_code,
        min(o.customer_snapshot->>'name') as customer_name,
        sum(coalesce(cde.remaining_debt, o.debt_amount)) as remaining_debt,
        count(*)::int as open_invoice_count,
        (array_agg(o.code order by coalesce(cde.created_at, o.created_at) asc))[1] as oldest_order_code,
        max(coalesce(cde.updated_at, o.updated_at)) as last_activity_at
      from orders o
      left join customer_debt_entries cde
        on cde.organization_id = o.organization_id
       and cde.order_id = o.id
       and cde.status = 'open'
       and cde.remaining_debt > 0
      where o.organization_id = $1
        and o.order_type = 'invoice'
        and o.status <> 'cancelled'
        and o.customer_id is not null
        and coalesce(cde.remaining_debt, o.debt_amount) > 0
      group by o.customer_id
    ),
    kiotviet_anchor as (
      select distinct on (customer_id)
        customer_id,
        customer_snapshot->>'code' as customer_code,
        customer_snapshot->>'name' as customer_name,
        balance_after,
        source_code,
        created_at
      from customer_debt_adjustments
      where organization_id = $1
        and source_system = 'kiotviet'
      order by customer_id, created_at desc, source_row desc nulls last, updated_at desc
    ),
    invoices_after_anchor as (
      select
        a.customer_id,
        sum(o.total_amount) as gross_total,
        count(*) filter (where coalesce(cde.remaining_debt, o.debt_amount) > 0)::int as open_invoice_count,
        (array_agg(o.code order by o.created_at asc) filter (where coalesce(cde.remaining_debt, o.debt_amount) > 0))[1] as oldest_order_code,
        max(o.created_at) as last_activity_at
      from kiotviet_anchor a
      join orders o
        on o.organization_id = $1
       and o.customer_id = a.customer_id
       and o.order_type = 'invoice'
       and o.status <> 'cancelled'
       and o.created_at > a.created_at
      left join customer_debt_entries cde
        on cde.organization_id = o.organization_id
       and cde.order_id = o.id
       and cde.status = 'open'
       and cde.remaining_debt > 0
      group by a.customer_id
    ),
    qcvl_payments_after_anchor as (
      select
        a.customer_id,
        sum(case when cbe.direction = 'in' then abs(cbe.amount_delta) else -abs(cbe.amount_delta) end) as paid_total,
        max(cbe.created_at) as last_activity_at
      from kiotviet_anchor a
      join cashbook_entries cbe
        on cbe.organization_id = $1
       and cbe.status = 'posted'
       and cbe.source_type = 'payment_receipt_method'
       and cbe.created_at > a.created_at
      left join orders o
        on o.organization_id = cbe.organization_id
       and o.code = cbe.source->>'order_code'
      where (o.id is not null and o.customer_id = a.customer_id and o.status <> 'cancelled')
         or (o.id is null and cbe.source->>'customer_id' = a.customer_id)
      group by a.customer_id
    ),
    kiotviet_cashbook_after_anchor as (
      select
        a.customer_id,
        sum(case when cbe.direction = 'in' then -abs(cbe.amount_delta) else abs(cbe.amount_delta) end) as amount_delta,
        max(cbe.created_at) as last_activity_at
      from kiotviet_anchor a
      join cashbook_entries cbe
        on cbe.organization_id = $1
       and cbe.status = 'posted'
       and cbe.source_type = 'kiotviet_cashbook'
       and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
       and cbe.source->>'counterparty_code' = a.customer_code
       and cbe.created_at > a.created_at
      group by a.customer_id
    ),
    linked_supplier_offset as (
      select
        s.data->>'linked_customer_id' as customer_id,
        min(cs.data->>'code') as customer_code,
        min(cs.data->>'name') as customer_name,
        sum(coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0)) as remaining_amount,
        max(coalesce(nullif(pr.data->>'received_at', '')::timestamptz, pr.created_at)) as last_activity_at
      from purchase_receipt_snapshots pr
      join supplier_snapshots s
        on s.organization_id = pr.organization_id
       and lower(s.code) = lower(pr.data->'supplier'->>'code')
      left join customer_snapshots cs
        on cs.organization_id = pr.organization_id
       and cs.id = s.data->>'linked_customer_id'
      where pr.organization_id = $1
        and pr.data->>'status' = 'posted'
        and s.data->>'linked_customer_id' is not null
        and coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0) > 0
      group by s.data->>'linked_customer_id'
    ),
    debt_customers as (
      select customer_id from live_invoice_debt
      union
      select customer_id from kiotviet_anchor
      union
      select customer_id from linked_supplier_offset
    )
    select
      dc.customer_id,
      coalesce(a.customer_code, lid.customer_code, lso.customer_code, '') as customer_code,
      coalesce(a.customer_name, lid.customer_name, lso.customer_name, '') as customer_name,
      case when a.customer_id is not null
        then a.balance_after
           + coalesce(iaa.gross_total, 0)
           - coalesce(qpa.paid_total, 0)
           + coalesce(kca.amount_delta, 0)
        else coalesce(lid.remaining_debt, 0)
      end - coalesce(lso.remaining_amount, 0) as total_debt,
      case when a.customer_id is not null
        then coalesce(iaa.open_invoice_count, 0)
        else coalesce(lid.open_invoice_count, 0)
      end as open_invoice_count,
      case when a.customer_id is not null
        then coalesce(iaa.oldest_order_code, a.source_code)
        else coalesce(lid.oldest_order_code, '')
      end as oldest_order_code,
      (a.customer_id is not null) as has_kiotviet_anchor,
      greatest(
        coalesce(a.created_at, timestamptz 'epoch'),
        coalesce(lid.last_activity_at, timestamptz 'epoch'),
        coalesce(iaa.last_activity_at, timestamptz 'epoch'),
        coalesce(qpa.last_activity_at, timestamptz 'epoch'),
        coalesce(kca.last_activity_at, timestamptz 'epoch'),
        coalesce(lso.last_activity_at, timestamptz 'epoch')
      ) as last_activity_at
    from debt_customers dc
    left join kiotviet_anchor a on a.customer_id = dc.customer_id
    left join live_invoice_debt lid on lid.customer_id = dc.customer_id
    left join invoices_after_anchor iaa on iaa.customer_id = dc.customer_id
    left join qcvl_payments_after_anchor qpa on qpa.customer_id = dc.customer_id
    left join kiotviet_cashbook_after_anchor kca on kca.customer_id = dc.customer_id
    left join linked_supplier_offset lso on lso.customer_id = dc.customer_id
    ${customerFilter}
  `
}

export function mapCustomerDebtTotalsRow(row: CustomerDebtTotalsRow) {
  return {
    customer_id: String(row.customer_id),
    customer_code: String(row.customer_code ?? ''),
    customer_name: String(row.customer_name ?? ''),
    total_debt: Number(row.total_debt),
    open_invoice_count: Number(row.open_invoice_count),
    oldest_order_code: String(row.oldest_order_code ?? ''),
    has_kiotviet_anchor: row.has_kiotviet_anchor === true,
    last_activity_at: row.last_activity_at === null || row.last_activity_at === undefined
      ? null
      : typeof row.last_activity_at === 'string'
        ? row.last_activity_at
        : row.last_activity_at.toISOString(),
  }
}

export interface MemoryCustomerDebtInvoice {
  id: string
  code: string
  created_at: string
  status: string
  order_type: string
  total_amount: number
  debt_amount: number
  customer: { id: string; code: string; name: string }
}

export interface MemoryCustomerDebtAdjustment {
  customer_id: string
  source_code: string
  created_at: string
  balance_after: number
  amount_delta: number
  paid_amount: number
  remaining_amount: number
  transaction_type: string
  source_file: string | null
  id: string
}

export interface MemoryCustomerDebtCashbook {
  created_at: string
  status: string
  source_type: string
  direction: 'in' | 'out'
  amount_delta: number
  code: string
  source?: {
    order_code?: string | null
    customer_id?: string | null
    counterparty_code?: string | null
  } | null
}

export interface MemoryLinkedSupplierReceipt {
  remaining_amount: number
}

/** In-memory port of customerDebtTotalsSql for a single customer. */
export function computeCustomerDebtTotal(input: {
  customerId: string
  customerCode: string
  customerName: string
  invoices: MemoryCustomerDebtInvoice[]
  adjustments: MemoryCustomerDebtAdjustment[]
  cashbookEntries: MemoryCustomerDebtCashbook[]
  linkedSupplierReceipts: MemoryLinkedSupplierReceipt[]
  resolveInvoiceCustomerId: (invoice: MemoryCustomerDebtInvoice) => string | null
}) {
  const customerInvoices = input.invoices.filter((invoice) => (
    invoice.order_type === 'invoice'
    && invoice.status !== 'cancelled'
    && input.resolveInvoiceCustomerId(invoice) === input.customerId
  ))
  const openInvoices = customerInvoices
    .filter((invoice) => invoice.debt_amount > 0)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
  const liveRemaining = openInvoices.reduce((sum, invoice) => sum + invoice.debt_amount, 0)
  const linkedSupplierTotal = input.linkedSupplierReceipts.reduce((sum, receipt) => sum + receipt.remaining_amount, 0)

  const anchor = [...input.adjustments]
    .filter((adjustment) => adjustment.customer_id === input.customerId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0]

  if (!anchor) {
    return {
      customer_id: input.customerId,
      customer_code: input.customerCode,
      customer_name: input.customerName,
      total_debt: liveRemaining - linkedSupplierTotal,
      open_invoice_count: openInvoices.length,
      oldest_order_code: openInvoices[0]?.code ?? '',
      has_kiotviet_anchor: false,
      adjustments: input.adjustments.filter((adjustment) => adjustment.customer_id === input.customerId),
    }
  }

  const anchorTime = Date.parse(anchor.created_at)
  const invoicesAfter = customerInvoices.filter((invoice) => Date.parse(invoice.created_at) > anchorTime)
  const openAfter = invoicesAfter.filter((invoice) => invoice.debt_amount > 0)
  const grossAfter = invoicesAfter.reduce((sum, invoice) => sum + invoice.total_amount, 0)

  let qcvlPaid = 0
  let kvCashbookDelta = 0
  for (const entry of input.cashbookEntries) {
    if (entry.status !== 'posted' || Date.parse(entry.created_at) <= anchorTime) continue
    if (entry.source_type === 'payment_receipt_method') {
      const matchesCustomer = entry.source?.customer_id === input.customerId
        || (entry.source?.order_code
          && customerInvoices.some((invoice) => invoice.code === entry.source?.order_code))
      if (!matchesCustomer) continue
      qcvlPaid += entry.direction === 'in' ? Math.abs(entry.amount_delta) : -Math.abs(entry.amount_delta)
      continue
    }
    if (entry.source_type === 'kiotviet_cashbook') {
      const codeOk = new RegExp(KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN, 'i').test(entry.code)
      const counterpartyOk = (entry.source?.counterparty_code ?? '') === input.customerCode
      if (!codeOk || !counterpartyOk) continue
      kvCashbookDelta += entry.direction === 'in' ? -Math.abs(entry.amount_delta) : Math.abs(entry.amount_delta)
    }
  }

  return {
    customer_id: input.customerId,
    customer_code: input.customerCode,
    customer_name: input.customerName,
    total_debt: anchor.balance_after + grossAfter - qcvlPaid + kvCashbookDelta - linkedSupplierTotal,
    open_invoice_count: openAfter.length,
    oldest_order_code: openAfter[0]?.code ?? anchor.source_code,
    has_kiotviet_anchor: true,
    adjustments: input.adjustments
      .filter((adjustment) => adjustment.customer_id === input.customerId)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
  }
}

