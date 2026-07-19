import { managementRecordOpenHref } from '../../components/ui-shell/primitives'
import type { CashbookEntry } from '../finance/types'
import type { CustomerDebtDetail } from '../orders/order-service'
import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'
import type { Customer } from './types'

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

type CustomerDebtLedgerSortableRow = Omit<CustomerDebtLedgerRow, 'running_debt'> & {
  running_debt?: number
}

export function buildCustomerDebtLedgerRows(
  invoiceHistory: Array<{ id: string; code: string; created_at: string; total_amount: number; status?: SalesDocumentListItem['status'] }>,
  cashbookHistory: CashbookEntry[],
  adjustments: NonNullable<CustomerDebtDetail['adjustments']>,
  linkedSupplierReceipts: NonNullable<CustomerDebtDetail['linked_supplier_receipts']> = [],
): CustomerDebtLedgerRow[] {
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
    ...linkedSupplierReceipts.map((receipt) => ({
      id: `linked-supplier-receipt:${receipt.id}`,
      code: receipt.code,
      created_at: receipt.created_at,
      type: 'Nhập hàng',
      value_delta: -Math.abs(receipt.remaining_amount),
      href: managementRecordOpenHref('/purchase/receipts', receipt.code),
      related_code: receipt.code,
    })),
  ].sort((left, right) => {
    const leftRelated = customerDebtLedgerRelatedCode(left)
    const rightRelated = customerDebtLedgerRelatedCode(right)
    if (leftRelated === rightRelated) {
      const priority = customerDebtLedgerChronologyPriority(left) - customerDebtLedgerChronologyPriority(right)
      if (priority !== 0) return priority
    }
    const timeOrder = left.created_at.localeCompare(right.created_at)
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

export function customerDebtLedgerDefinesCurrentDebt(input: {
  cashbookHistory: CashbookEntry[]
  debt: CustomerDebtDetail
}) {
  return input.cashbookHistory.length > 0
    || (input.debt.adjustments?.length ?? 0) > 0
    || (input.debt.linked_supplier_receipts?.length ?? 0) > 0
}

export function customerDebtHasLiveLedger(debt: CustomerDebtDetail) {
  return debt.total_debt !== 0
    || debt.invoices.length > 0
    || (debt.adjustments?.length ?? 0) > 0
    || (debt.linked_supplier_receipts?.length ?? 0) > 0
}

export function customerDebtCounterpartyMatches(entry: CashbookEntry, customer: Customer) {
  const counterparty = normalizeCustomerDebtText(`${entry.counterparty?.name ?? ''} ${entry.counterparty?.phone ?? ''} ${entry.source?.counterparty_code ?? ''}`)
  const customerName = normalizeCustomerDebtText(customer.name)
  const customerCode = normalizeCustomerDebtText(customer.code)
  const customerPhone = normalizeCustomerDebtText(customer.phone ?? '')
  return (counterparty.length > 0 && customerName.length > 0 && (counterparty.includes(customerName) || customerName.includes(counterparty)))
    || (customerCode.length > 0 && counterparty.includes(customerCode))
    || (customerPhone.length > 0 && counterparty.includes(customerPhone))
}

function customerDebtAdjustmentHref(code: string) {
  if (/^PN/i.test(code)) return managementRecordOpenHref('/purchase/receipts', code)
  return null
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
    || /^TT\d/i.test(entry.code)
    || /^TTM(?:HD)?\d/i.test(entry.code)
    || /^TNHHD\d/i.test(entry.code)
}

function normalizeCustomerDebtText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}
