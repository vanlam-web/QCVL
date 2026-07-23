import { buildPartnerDebtLedger, type PartnerDebtDocumentInput } from './partner-debt-ledger.js'

// Canonical customer debt formula. Every read path must use voucher effects,
// never KiotViet `balance_after` as a runtime anchor.
//
// Pure customer:
// - `HD/HDO`: increase debt.
// - `TT/TTHD/TTHDO/TTM/TTMHD/TNH/TNHHD`: decrease debt.
// - `CKKH`: decrease debt.
// - `CB`: increase/decrease by normalized `amount_delta`.
//
// Totals are NOT clamped to zero: a negative total means customer credit.

export const KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN = '^(CB|TTHD|TTHDO|TT[0-9]|TTMHD|TTM[0-9]|TNHHD|TNH[0-9])'

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
  const liveInvoiceCustomerFilter = options.singleCustomer ? 'and o.customer_id = $2' : ''
  const adjustmentCustomerFilter = options.singleCustomer ? 'and customer_id = $2' : ''
  const linkedSupplierCustomerFilter = options.singleCustomer ? "and s.data->>'linked_customer_id' = $2" : ''
  return `
    with live_invoice_debt as (
      select
        o.customer_id,
        min(o.customer_snapshot->>'code') as customer_code,
        min(o.customer_snapshot->>'name') as customer_name,
        sum(o.total_amount) as invoice_total,
        count(*) filter (where coalesce(cde.remaining_debt, o.debt_amount) > 0)::int as open_invoice_count,
        (array_agg(o.code order by coalesce(cde.created_at, o.created_at) asc) filter (where coalesce(cde.remaining_debt, o.debt_amount) > 0))[1] as oldest_order_code,
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
        ${liveInvoiceCustomerFilter}
      group by o.customer_id
    ),
    customer_adjustment_debt as (
      select
        customer_id,
        min(customer_snapshot->>'code') as customer_code,
        min(customer_snapshot->>'name') as customer_name,
        sum(
          case
            when source_code ~* '^CKKH[0-9]' then -abs(amount_delta)
            when source_code ~* '^CB[0-9]' then amount_delta
            else 0
          end
        ) as adjustment_total,
        max(created_at) as last_activity_at
      from customer_debt_adjustments
      where organization_id = $1
        ${adjustmentCustomerFilter}
      group by customer_id
    ),
    unresolved_customer_payments as materialized (
      select
        cbe.id,
        cbe.organization_id,
        cbe.direction,
        cbe.amount_delta,
        cbe.created_at,
        cbe.source,
        cbe.counterparty
      from cashbook_entries cbe
      where cbe.organization_id = $1
        and cbe.status = 'posted'
        and (
          cbe.source_type = 'payment_receipt_method'
          or (
            cbe.source_type = 'kiotviet_cashbook'
            and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
          )
        )
        and nullif(cbe.source->>'customer_id', '') is null
    ),
    unresolved_customer_payment_orders as materialized (
      select payment.*, o.customer_id
      from unresolved_customer_payments payment
      left join orders o
        on o.organization_id = payment.organization_id
       and o.code = payment.source->>'order_code'
       and o.status <> 'cancelled'
    ),
    customer_payment_sources as (
      select
        cbe.id,
        cbe.organization_id,
        cbe.direction,
        cbe.amount_delta,
        cbe.created_at,
        nullif(cbe.source->>'customer_id', '') as customer_id,
        cbe.source,
        cbe.counterparty
      from cashbook_entries cbe
      where cbe.organization_id = $1
        and cbe.status = 'posted'
        and (
          cbe.source_type = 'payment_receipt_method'
          or (
            cbe.source_type = 'kiotviet_cashbook'
            and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
          )
        )
        and nullif(cbe.source->>'customer_id', '') is not null

      union all

      select id, organization_id, direction, amount_delta, created_at, customer_id, source, counterparty
      from unresolved_customer_payment_orders
      where customer_id is not null

      union all

      select
        payment.id,
        payment.organization_id,
        payment.direction,
        payment.amount_delta,
        payment.created_at,
        cs.id as customer_id,
        payment.source,
        payment.counterparty
      from unresolved_customer_payment_orders payment
      join customer_snapshots cs
        on cs.organization_id = payment.organization_id
       and (
         lower(cs.code) = lower(payment.source->>'counterparty_code')
         or cs.id = 'customer-kv-' || lower(regexp_replace(coalesce(payment.source->>'counterparty_code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
       )
      where payment.customer_id is null
    ),
    customer_payment_debt as (
      select
        cps.customer_id,
        min(coalesce(cs.code, cps.source->>'counterparty_code', '')) as customer_code,
        min(coalesce(cs.data->>'name', cps.counterparty->>'name', '')) as customer_name,
        sum(case when cps.direction = 'in' then -abs(cps.amount_delta) else abs(cps.amount_delta) end) as amount_delta,
        max(cps.created_at) as last_activity_at
      from customer_payment_sources cps
      left join customer_snapshots cs
        on cs.organization_id = cps.organization_id
       and cs.id = cps.customer_id
      where cps.customer_id is not null
        ${options.singleCustomer ? 'and cps.customer_id = $2' : ''}
      group by cps.customer_id
    ),
    linked_supplier_debt as (
      select
        s.data->>'linked_customer_id' as customer_id,
        min(coalesce(cs.code, '')) as customer_code,
        min(coalesce(cs.data->>'name', '')) as customer_name,
        sum(-abs(coalesce(nullif(pr.data->>'payable_amount', '')::numeric, 0)) + abs(coalesce(nullif(pr.data->>'paid_amount', '')::numeric, 0))) as amount_delta,
        max(coalesce(nullif(pr.data->>'received_at', '')::timestamptz, pr.created_at)) as last_activity_at
      from supplier_snapshots s
      join purchase_receipt_snapshots pr
        on pr.organization_id = s.organization_id
       and (
         pr.data->>'supplier_id' = s.id
         or pr.data->'supplier'->>'id' = s.id
         or lower(pr.data->'supplier'->>'code') = lower(s.code)
         or s.id = 'supplier-kv-' || lower(regexp_replace(coalesce(pr.data->'supplier'->>'code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
       )
      left join customer_snapshots cs
        on cs.organization_id = s.organization_id
       and cs.id = s.data->>'linked_customer_id'
      where s.organization_id = $1
        and coalesce(s.data->>'linked_customer_id', '') <> ''
        and pr.data->>'status' = 'posted'
        ${linkedSupplierCustomerFilter}
      group by s.data->>'linked_customer_id'
    ),
    debt_customers as (
      select customer_id from live_invoice_debt
      union
      select customer_id from customer_adjustment_debt
      union
      select customer_id from customer_payment_debt
      union
      select customer_id from linked_supplier_debt
    )
    select
      dc.customer_id,
      coalesce(lid.customer_code, cad.customer_code, cpd.customer_code, lsd.customer_code, '') as customer_code,
      coalesce(lid.customer_name, cad.customer_name, cpd.customer_name, lsd.customer_name, '') as customer_name,
      coalesce(lid.invoice_total, 0)
        + coalesce(cad.adjustment_total, 0)
        + coalesce(cpd.amount_delta, 0)
        + coalesce(lsd.amount_delta, 0) as total_debt,
      coalesce(lid.open_invoice_count, 0) as open_invoice_count,
      coalesce(lid.oldest_order_code, '') as oldest_order_code,
      false as has_kiotviet_anchor,
      greatest(
        coalesce(lid.last_activity_at, timestamptz 'epoch'),
        coalesce(cad.last_activity_at, timestamptz 'epoch'),
        coalesce(cpd.last_activity_at, timestamptz 'epoch'),
        coalesce(lsd.last_activity_at, timestamptz 'epoch')
      ) as last_activity_at
    from debt_customers dc
    left join live_invoice_debt lid on lid.customer_id = dc.customer_id
    left join customer_adjustment_debt cad on cad.customer_id = dc.customer_id
    left join customer_payment_debt cpd on cpd.customer_id = dc.customer_id
    left join linked_supplier_debt lsd on lsd.customer_id = dc.customer_id
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

export interface CustomerOpenDebtInvoiceInput {
  order_id: string
  order_code: string
  created_at: string
  total_amount: number
  paid_amount: number
  remaining_debt: number
}

export interface CustomerOpenDebtSliceData {
  items: Array<CustomerOpenDebtInvoiceInput & { allocated_amount: number }>
  has_more: boolean
}

export function sliceCustomerOpenDebtsOldestFirst(
  invoices: CustomerOpenDebtInvoiceInput[],
  input: { amount?: number; limit?: number } = {},
): CustomerOpenDebtSliceData {
  const limit = Math.max(1, Math.min(Math.floor(Number(input.limit ?? 50)), 100))
  const amount = Number(input.amount)
  let remainingAmount = Number.isFinite(amount) && amount > 0 ? amount : Number.POSITIVE_INFINITY
  const openInvoices = invoices
    .filter((invoice) => Number(invoice.remaining_debt) > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at)
      const rightTime = Date.parse(right.created_at)
      if (leftTime !== rightTime) return leftTime - rightTime
      return left.order_code.localeCompare(right.order_code)
    })
  const items: CustomerOpenDebtSliceData['items'] = []
  for (const invoice of openInvoices) {
    if (items.length >= limit || remainingAmount <= 0) break
    const allocatedAmount = Math.min(Number(invoice.remaining_debt), remainingAmount)
    if (allocatedAmount <= 0) continue
    items.push({
      ...invoice,
      allocated_amount: allocatedAmount,
    })
    remainingAmount -= allocatedAmount
  }
  return {
    items,
    has_more: openInvoices.length > items.length,
  }
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
  const documents: PartnerDebtDocumentInput[] = customerInvoices.map((invoice) => ({
    id: invoice.id,
    code: invoice.code,
    time: invoice.created_at,
    amount: invoice.total_amount,
    status: 'posted',
    sourceType: 'invoice',
    sourceId: invoice.id,
  }))
  for (const entry of input.cashbookEntries) {
    if (entry.status !== 'posted') continue
    if (entry.source_type === 'payment_receipt_method') {
      const matchesCustomer = entry.source?.customer_id === input.customerId
        || (entry.source?.order_code
          && customerInvoices.some((invoice) => invoice.code === entry.source?.order_code))
      if (!matchesCustomer) continue
      documents.push({
        id: entry.code,
        code: entry.code,
        time: entry.created_at,
        amount: Math.abs(entry.amount_delta),
        status: 'posted',
        sourceType: 'payment',
        sourceId: entry.code,
      })
      continue
    }
    if (entry.source_type === 'kiotviet_cashbook') {
      const codeOk = new RegExp(KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN, 'i').test(entry.code)
      const counterpartyCode = entry.source?.counterparty_code ?? ''
      const counterpartyOk = counterpartyCode === input.customerCode
        || snapshotImportId('customer', counterpartyCode) === input.customerId
      if (!codeOk || !counterpartyOk) continue
      documents.push({
        id: entry.code,
        code: entry.code,
        time: entry.created_at,
        amount: Math.abs(entry.amount_delta),
        normalizedAmountDelta: entry.direction === 'in' ? -Math.abs(entry.amount_delta) : Math.abs(entry.amount_delta),
        status: 'posted',
        sourceType: 'payment',
        sourceId: entry.code,
      })
    }
  }
  for (const adjustment of input.adjustments.filter((row) => row.customer_id === input.customerId)) {
    documents.push({
      id: adjustment.id,
      code: adjustment.source_code,
      time: adjustment.created_at,
      amount: Math.abs(adjustment.amount_delta),
      normalizedAmountDelta: adjustment.amount_delta,
      status: 'posted',
      sourceType: 'adjustment',
      sourceId: adjustment.id,
    })
  }
  const ledger = buildPartnerDebtLedger({ view: 'customer', linked: false, documents })

  return {
    customer_id: input.customerId,
    customer_code: input.customerCode,
    customer_name: input.customerName,
    total_debt: ledger.totalDebt,
    ledger_rows: ledger.rows.map((row) => ({
      id: row.id,
      code: row.code,
      created_at: row.time,
      amount_delta: row.amountDelta,
      balance_after: row.balanceAfter,
      source_type: row.sourceType,
      source_id: row.sourceId,
    })),
    open_invoice_count: openInvoices.length,
    oldest_order_code: openInvoices[0]?.code ?? '',
    has_kiotviet_anchor: false,
    adjustments: input.adjustments
      .filter((adjustment) => adjustment.customer_id === input.customerId)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
  }
}

function snapshotImportId(prefix: 'customer' | 'supplier', code: string) {
  return `${prefix}-kv-${baseKiotVietImportCode(code).toLowerCase()}`
}

function baseKiotVietImportCode(value: string) {
  return value.trim().replace(/\{DEL\d*\}$/i, '')
}

