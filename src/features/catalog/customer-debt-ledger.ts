import { managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { appRoutes } from '../../app/routes'
import { parseDateTimeValue } from '../../lib/date-format'
import type { CashbookEntry } from '../finance/types'
import type { CustomerDebtDetail } from '../orders/order-service'
import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'

export type CustomerDebtAdjustment = NonNullable<CustomerDebtDetail['adjustments']>[number]

export interface CustomerDebtLedgerRow {
  id: string
  code: string
  created_at: string
  type: string
  value_delta: number
  running_debt: number
  href: string | null
  adjustment?: CustomerDebtAdjustment
  related_code?: string
}

export function customerDebtLedgerRowsFromBackend(debt: Pick<CustomerDebtDetail, 'ledger_rows' | 'adjustments'>): CustomerDebtLedgerRow[] {
  const adjustmentsByCode = new Map((debt.adjustments ?? []).map((adjustment) => [adjustment.source_code, adjustment]))
  return [...(debt.ledger_rows ?? [])]
    .reverse()
    .map((row) => ({
      id: row.id,
      code: row.code,
      created_at: row.created_at,
      type: backendCustomerDebtLedgerRowType(row),
      value_delta: row.amount_delta,
      running_debt: row.balance_after,
      href: backendCustomerDebtLedgerRowHref(row),
      adjustment: adjustmentsByCode.get(row.code),
      related_code: row.code,
    }))
}

type CustomerDebtLedgerSortableRow = Omit<CustomerDebtLedgerRow, 'running_debt'> & {
  running_debt?: number
}

export function buildCustomerDebtLedgerRows(
  invoiceHistory: Array<{ id: string; code: string; created_at: string; total_amount: number; status?: SalesDocumentListItem['status'] }>,
  cashbookHistory: CashbookEntry[],
  adjustments: NonNullable<CustomerDebtDetail['adjustments']>,
  linkedSupplierReceipts: NonNullable<CustomerDebtDetail['linked_supplier_receipts']> = [],
  options: { currentTotal?: number } = {},
): CustomerDebtLedgerRow[] {
  void linkedSupplierReceipts
  void options
  const rows: CustomerDebtLedgerSortableRow[] = [
    ...invoiceHistory
      .filter((invoice) => salesDocumentAffectsCustomerDebt(invoice))
      .map((invoice) => ({
        id: `invoice:${invoice.id}`,
        code: invoice.code,
        created_at: invoice.created_at,
        type: 'Bán hàng',
        value_delta: invoice.total_amount,
        href: managementRecordOpenHref('/sales-documents', invoice.code, { type: 'invoice' }),
      })),
    ...cashbookHistory
      .filter((entry) => cashbookEntryAffectsCustomerDebt(entry))
      .map((entry) => ({
        id: `cashbook:${entry.id}`,
        code: entry.code,
        created_at: entry.created_at,
        type: entry.direction === 'in' ? 'Thanh toán' : 'Điều chỉnh',
        value_delta: entry.direction === 'in' ? -Math.abs(entry.amount_delta) : Math.abs(entry.amount_delta),
        href: managementRecordOpenHref('/finance', entry.code),
        related_code: customerDebtCashbookRelatedCode(entry),
      })),
    ...adjustments.map((adjustment) => ({
      id: `adjustment:${adjustment.id}`,
      code: adjustment.source_code,
      created_at: adjustment.created_at,
      type: adjustment.transaction_type || 'Điều chỉnh',
      value_delta: adjustment.amount_delta,
      running_debt: adjustment.balance_after,
      href: customerDebtAdjustmentHref(adjustment.source_code),
      adjustment,
      related_code: adjustment.source_code,
    })),
  ].sort((left, right) => {
    const leftRelated = customerDebtLedgerRelatedCode(left)
    const rightRelated = customerDebtLedgerRelatedCode(right)
    if (leftRelated === rightRelated) {
      const priority = customerDebtLedgerChronologyPriority(left) - customerDebtLedgerChronologyPriority(right)
      if (priority !== 0) return priority
    }
    const timeOrder = (parseDateTimeValue(left.created_at) ?? 0) - (parseDateTimeValue(right.created_at) ?? 0)
    if (timeOrder !== 0) return timeOrder
    return left.code.localeCompare(right.code)
  })

  let runningDebt = 0
  const rowsWithRunningDebt: CustomerDebtLedgerRow[] = rows.map((row) => {
    if ('running_debt' in row && typeof row.running_debt === 'number') {
      runningDebt = row.running_debt
      return { ...row, running_debt: row.running_debt }
    }
    runningDebt += row.value_delta
    return { ...row, running_debt: runningDebt }
  })

  return rowsWithRunningDebt.reverse()
}

function customerDebtLedgerRelatedCode(row: CustomerDebtLedgerSortableRow) {
  return row.related_code ?? row.code
}

function customerDebtLedgerChronologyPriority(row: CustomerDebtLedgerSortableRow) {
  if (row.type === 'Bán hàng') return 0
  if (row.type === 'Thanh toán') return 1
  if (row.type === 'Điều chỉnh') return 2
  return 3
}

function customerDebtCashbookRelatedCode(entry: CashbookEntry) {
  if (entry.source?.order_code) return entry.source.order_code
  const noteDocumentMatch = entry.note?.match(/\b(?:HD|PN)\d+(?:\.\d+)?\b/i)
  if (noteDocumentMatch) return noteDocumentMatch[0].toUpperCase()
  const normalizedCode = entry.code.trim().toUpperCase()
  const invoicePaymentMatch = normalizedCode.match(/^(?:TTHD|TTMHD|TNHHD)(\d+(?:\.\d+)?)$/)
  if (invoicePaymentMatch) return `HD${invoicePaymentMatch[1]}`
  const purchasePaymentMatch = normalizedCode.match(/^PCPN(\d+(?:\.\d+)?)$/)
  if (purchasePaymentMatch) return `PN${purchasePaymentMatch[1]}`
  return entry.code
}

export function customerDebtHasLiveLedger(debt: CustomerDebtDetail) {
  return debt.total_debt !== 0
    || debt.invoices.length > 0
    || (debt.adjustments?.length ?? 0) > 0
    || (debt.cashbook_entries?.length ?? 0) > 0
}

function customerDebtAdjustmentHref(code: string) {
  if (/^PN/i.test(code)) return managementRecordOpenHref(appRoutes.purchaseReceipts, code)
  return null
}

function backendCustomerDebtLedgerRowType(row: NonNullable<CustomerDebtDetail['ledger_rows']>[number]) {
  if (row.source_type === 'invoice' || /^HDO?\d/i.test(row.code)) return 'Bán hàng'
  if (/^CKKH\d/i.test(row.code)) return 'Chiết khấu'
  if (row.source_type === 'adjustment' || /^CB\d/i.test(row.code)) return 'Điều chỉnh'
  return 'Thanh toán'
}

function backendCustomerDebtLedgerRowHref(row: NonNullable<CustomerDebtDetail['ledger_rows']>[number]) {
  if (row.source_type === 'invoice' || /^HDO?\d/i.test(row.code)) {
    return managementRecordOpenHref('/sales-documents', row.code, { type: 'invoice' })
  }
  if (row.source_type === 'payment') return managementRecordOpenHref('/finance', row.code)
  return customerDebtAdjustmentHref(row.code)
}

// The backend total (`debt.total_debt`) is the single source of truth for the
// current debt amount. The ledger rows built above are for display only and
// must not redefine the headline number.
export function customerDebtCurrentAmountFromLedger(input: {
  debt: CustomerDebtDetail
  invoiceHistory: Array<{ id: string; code: string; created_at: string; total_amount: number; status?: SalesDocumentListItem['status'] }>
  cashbookHistory: CashbookEntry[]
}, fallbackDebt: number) {
  return customerDebtHasLiveLedger(input.debt) ? input.debt.total_debt : fallbackDebt
}

function salesDocumentAffectsCustomerDebt(document: { status?: SalesDocumentListItem['status'] }) {
  return document.status !== 'cancelled'
}

function cashbookEntryAffectsCustomerDebt(entry: CashbookEntry) {
  if (entry.source_type === 'kiotviet_cashbook') return kiotVietCashbookEntryAffectsCustomerDebt(entry)
  return entry.source_type === 'payment_receipt_method'
    || entry.source?.type === 'payment_receipt'
}

function kiotVietCashbookEntryAffectsCustomerDebt(entry: CashbookEntry) {
  if (entry.source_type !== 'kiotviet_cashbook') return false
  return /^TTHD/i.test(entry.code)
    || /^CB/i.test(entry.code)
    || /^TT\d/i.test(entry.code)
    || /^TTM(?:HD)?\d/i.test(entry.code)
    || /^TNHHD\d/i.test(entry.code)
}

