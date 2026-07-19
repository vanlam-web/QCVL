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
}

export function buildCustomerDebtLedgerRows(
  invoiceHistory: Array<{ id: string; code: string; created_at: string; total_amount: number; status?: SalesDocumentListItem['status'] }>,
  cashbookHistory: CashbookEntry[],
  adjustments: NonNullable<CustomerDebtDetail['adjustments']>,
  linkedSupplierReceipts: NonNullable<CustomerDebtDetail['linked_supplier_receipts']> = [],
): CustomerDebtLedgerRow[] {
  const rows = [
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
    })),
    ...linkedSupplierReceipts.map((receipt) => ({
      id: `linked-supplier-receipt:${receipt.id}`,
      code: receipt.code,
      created_at: receipt.created_at,
      type: 'Nhập hàng',
      value_delta: -Math.abs(receipt.remaining_amount),
      href: managementRecordOpenHref('/purchase/receipts', receipt.code),
    })),
  ].sort((left, right) => left.created_at.localeCompare(right.created_at) || left.code.localeCompare(right.code))

  let runningDebt = 0
  const rowsWithRunningDebt = rows.map((row) => {
    if ('running_debt' in row && typeof row.running_debt === 'number') {
      runningDebt = row.running_debt
      return { ...row }
    }
    runningDebt += row.value_delta
    return { ...row, running_debt: runningDebt }
  })

  return rowsWithRunningDebt.reverse()
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
  return entry.source_type === 'payment_receipt_method'
    || kiotVietCashbookEntryAffectsCustomerDebt(entry)
    || entry.source?.type === 'payment_receipt'
}

function kiotVietCashbookEntryAffectsCustomerDebt(entry: CashbookEntry) {
  if (entry.source_type !== 'kiotviet_cashbook') return false
  return /^TTHD/i.test(entry.code) || /^TT\d/i.test(entry.code)
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
