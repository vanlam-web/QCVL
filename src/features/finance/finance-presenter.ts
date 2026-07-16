import { paymentSettlementStatusLabel, paymentSettlementStatusTone, type PaymentSettlementStatus } from '../../components/ui-shell/payment-status'
import { formatKvDateTime } from '../../lib/date-format'
import type {
  CashbookBusinessAccountedFilter,
  CashbookEntry,
  CashbookEntryDetail,
  CashbookStatus,
  CreateCashbookVoucherInput,
  FinanceAccount,
} from './types'

export function accountTypeText(type: FinanceAccount['account_type']) {
  return type === 'cash' ? 'Tiền mặt' : 'Ngân hàng'
}

export function financeAccountChoiceLabel(account: FinanceAccount) {
  if (account.account_type === 'cash') return 'Tiền mặt'
  return `${account.code} · ${account.name}`
}

export function bankAccountDisplayText(account: FinanceAccount) {
  const parts = bankAccountDisplayParts(account)
  return [parts.primary, parts.secondary, parts.tertiary].filter(Boolean).join(' - ')
}

export function bankAccountTriggerText(account: FinanceAccount) {
  return bankAccountDisplayParts(account).primary
}

export function bankAccountDisplayParts(account: FinanceAccount) {
  if (account.account_type === 'cash') return { primary: 'Tiền mặt', secondary: null, tertiary: null }

  const primary = cleanDeletedFinanceAccountText(account.account_number?.trim() || account.code)
  const rawSecondary = cleanDeletedFinanceAccountText(account.name)
  const rawTertiary = cleanDeletedFinanceAccountText(account.account_holder?.trim())

  const uniqueParts = uniqueNonEmpty([primary, rawSecondary, rawTertiary])
  return {
    primary: uniqueParts[0] ?? primary,
    secondary: uniqueParts[1] ?? null,
    tertiary: uniqueParts[2] ?? null,
  }
}

export function isDeletedFinanceAccount(account: FinanceAccount) {
  return !account.is_active || [account.code, account.name, account.account_number, account.account_holder].some((value) => value?.includes('{DEL}'))
}

function cleanDeletedFinanceAccountText(value: string | null | undefined) {
  return value?.replaceAll('{DEL}', '').trim() ?? ''
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('vi')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}


export function cashFirstAccountSort(left: FinanceAccount, right: FinanceAccount) {
  if (left.account_type !== right.account_type) return left.account_type === 'cash' ? -1 : 1
  return left.code.localeCompare(right.code, 'vi')
}

export function statusText(status: 'posted' | 'cancelled') {
  return status === 'posted' ? 'Đã ghi' : 'Đã hủy'
}

export function cashbookDetailStatusText(status: CashbookStatus) {
  return status === 'posted' ? 'Đã thanh toán' : 'Đã hủy'
}

export function cashbookDetailTitle(entry: CashbookEntryDetail) {
  return `${entry.direction === 'in' ? 'Phiếu thu' : 'Phiếu chi'} ${entry.code}`
}

export function cashbookDetailAmountLabel(entry: CashbookEntryDetail) {
  return entry.direction === 'in' ? 'Loại thu' : 'Loại chi'
}

export function cashbookDetailCounterpartyTypeLabel(entry: CashbookEntryDetail) {
  if (entry.counterparty.type === 'customer') return 'Khách hàng'
  if (entry.counterparty.type === 'supplier') return 'Nhà cung cấp'
  if (entry.counterparty.type === 'employee') return 'Nhân viên'
  if (entry.counterparty.type === 'other') return 'Khác'
  return 'Không có'
}

export function cashbookDetailCounterpartyLabel(entry: CashbookEntryDetail) {
  return entry.direction === 'in' ? 'Người nộp' : 'Người nhận'
}

export function cashbookCounterpartyLabel(entry: CashbookEntry) {
  return entry.direction === 'in' ? 'Người nộp' : 'Người nhận'
}

export function cashbookCounterpartyDisplayName(name: string) {
  return name.trim() === 'Khách lẻ' ? 'khách lẻ' : name
}

export function cashbookDetailAccountLabel(entry: CashbookEntryDetail) {
  if (entry.payment_method !== 'bank_transfer') return entry.direction === 'in' ? 'Đến quỹ' : 'Từ quỹ'
  return entry.direction === 'in' ? 'Đến tài khoản' : 'Từ tài khoản'
}

export function cashbookDetailCreatorText(entry: CashbookEntryDetail) {
  return entry.source.source_creator_name ?? entry.created_by?.name ?? '-'
}

export function cashbookDetailCategoryText(entry: CashbookEntryDetail) {
  return entry.source.category_name ?? sourceTypeText(entry.source_type)
}

export function cashbookDetailCounterpartyText(entry: CashbookEntryDetail) {
  return [
    entry.counterparty?.name,
    entry.counterparty?.phone,
    entry.source.counterparty_address,
  ].filter((value) => value != null && value.trim().length > 0).join(', ') || '-'
}

export function cashbookDetailAccountText(entry: CashbookEntryDetail) {
  if (entry.finance_account.account_type === 'cash') return 'Tiền mặt'
  return cashbookBankAccountText(entry.finance_account)
}

export function cashbookDetailPaymentMethodText(entry: CashbookEntryDetail) {
  if (entry.payment_method === 'bank_transfer') return cashbookDetailAccountText(entry)
  return paymentMethodText(entry.payment_method)
}

function cashbookBankAccountText(account: CashbookEntryDetail['finance_account']) {
  const accountNumber = cleanDeletedFinanceAccountText(account.account_number ?? account.code)
  const bankName = cleanDeletedFinanceAccountText(account.name)
  if (bankName && accountNumber) return `${bankName}: ${accountNumber}`
  return bankName || accountNumber || 'Ngân hàng'
}

export function cashbookLinkedDocumentMessage(entry: CashbookEntryDetail) {
  const code = cashbookLinkedDocumentCode(entry) ?? entry.source.code
  if (entry.direction === 'in') return `Phiếu thu tự động được gắn với hóa đơn ${code}.`
  return `Phiếu chi tự động được gắn với phiếu nhập hàng ${code}.`
}

export function cashbookLinkedDocumentCode(entry: CashbookEntryDetail) {
  if (entry.source.order_code !== null) return entry.source.order_code
  const noteDocumentMatch = entry.note?.match(/\b(?:HD|PN)\d+(?:\.\d+)?\b/i)
  if (noteDocumentMatch) return noteDocumentMatch[0].toUpperCase()
  return linkedKiotVietDocumentCodeFromCashbookCode(entry.code)
}

function linkedKiotVietDocumentCodeFromCashbookCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const invoicePaymentMatch = normalizedCode.match(/^TTHD(\d+(?:\.\d+)?)$/)
  if (invoicePaymentMatch) return `HD${invoicePaymentMatch[1]}`
  const purchasePaymentMatch = normalizedCode.match(/^PCPN(\d+(?:\.\d+)?)$/)
  if (purchasePaymentMatch) return `PN${purchasePaymentMatch[1]}`
  return null
}

export function cashbookEntryNeedsCounterpartyHydration(entry: CashbookEntry) {
  if (cashbookCounterpartyHasName(entry.counterparty)) return false
  if (entry.source_type === 'payment_receipt_method') return true
  return entry.source_type === 'kiotviet_cashbook'
    && entry.direction === 'in'
    && cashbookEntryLinkedDocumentCode(entry)?.startsWith('HD') === true
}

export function cashbookCounterpartyHasName(counterparty: CashbookEntry['counterparty']) {
  return counterparty?.name?.trim() ? true : false
}

function cashbookEntryLinkedDocumentCode(entry: CashbookEntry) {
  if (entry.source?.order_code != null) return entry.source.order_code
  const noteDocumentMatch = entry.note?.match(/\b(?:HD|PN)\d+(?:\.\d+)?\b/i)
  if (noteDocumentMatch) return noteDocumentMatch[0].toUpperCase()
  return linkedKiotVietDocumentCodeFromCashbookCode(entry.code)
}

function linkedDocumentPaymentStatus(remainingAfter: number): Exclude<PaymentSettlementStatus, 'unpaid'> {
  if (remainingAfter <= 0) return 'paid'
  return 'partial'
}

export function cashbookDetailPrimarySettlementStatus(entry: CashbookEntryDetail): PaymentSettlementStatus | null {
  if (entry.status !== 'posted' || entry.direction !== 'in') return null
  const linkedDocumentRows = cashbookLinkedDocumentRows(entry)
  if (linkedDocumentRows.length === 0) return null
  return linkedDocumentRows.some((row) => row.remainingAmount > 0) ? 'partial' : 'paid'
}

export function cashbookDetailPrimaryStatusText(entry: CashbookEntryDetail) {
  const paymentStatus = cashbookDetailPrimarySettlementStatus(entry)
  if (paymentStatus !== null) return paymentSettlementStatusLabel(paymentStatus)
  if (entry.status !== 'posted' || entry.direction !== 'in') return cashbookDetailStatusText(entry.status)
  return cashbookDetailStatusText(entry.status)
}

export function cashbookDetailPrimaryStatusTone(entry: CashbookEntryDetail) {
  const paymentStatus = cashbookDetailPrimarySettlementStatus(entry)
  if (paymentStatus !== null) return paymentSettlementStatusTone(paymentStatus)
  return entry.status === 'posted' ? 'success' : 'neutral'
}

export function cashbookLinkedDocumentRows(entry: CashbookEntryDetail) {
  if (entry.allocations.length > 0) {
    return entry.allocations.map((allocation) => ({
      id: allocation.order_id,
      code: allocation.order_code,
      totalAmount: allocation.order_total_amount,
      settledBefore: allocation.collected_before,
      allocatedAmount: allocation.allocated_amount,
      remainingAmount: allocation.remaining_after,
      status: entry.direction === 'in'
        ? paymentSettlementStatusLabel(linkedDocumentPaymentStatus(allocation.remaining_after))
        : allocation.remaining_after === 0 ? 'Đã thanh toán' : 'Còn nợ',
    }))
  }

  const inferredCode = cashbookLinkedDocumentCode(entry)
  if (inferredCode === null) return []

  return [{
    id: inferredCode,
    code: inferredCode,
    totalAmount: Math.abs(entry.amount_delta),
    settledBefore: 0,
    allocatedAmount: Math.abs(entry.amount_delta),
    remainingAmount: 0,
    status: entry.direction === 'in' && entry.status === 'posted' ? 'Thu đủ' : cashbookDetailStatusText(entry.status),
  }]
}

export function cashbookDetailNoteText(entry: CashbookEntryDetail) {
  if (entry.note?.match(/^Checkout\s+HD\d+(?:\.\d+)?$/i)) return 'Chưa có ghi chú'
  if (entry.source.source_note) return entry.source.source_note
  if (entry.source.transfer_content) return entry.source.transfer_content
  return entry.note ?? 'Chưa có ghi chú'
}

export function businessAccountedText(value: CashbookBusinessAccountedFilter) {
  if (value === 'true') return 'Có hạch toán'
  if (value === 'false') return 'Không hạch toán'
  return 'Tất cả'
}

export function paymentMethodText(value: CashbookEntryDetail['payment_method']) {
  if (value === 'cash') return 'Tiền mặt'
  if (value === 'bank_transfer') return 'Ngân hàng'
  return 'Thủ công'
}

export function sourceTypeText(value: CashbookEntry['source_type']) {
  if (value === 'payment_receipt_method') return 'Phiếu thu'
  if (value === 'kiotviet_cashbook') return 'Sổ quỹ KV'
  return 'Phiếu quỹ'
}

export function financeDateText(value: string) {
  return formatKvDateTime(value)
}
export function voucherTypeOptions(direction: CashbookEntry['direction']): Array<{ value: CreateCashbookVoucherInput['voucher_type']; label: string }> {
  if (direction === 'in') {
    return [
      { value: 'other_income', label: 'Thu nhập khác' },
      { value: 'capital_contribution', label: 'Góp vốn' },
      { value: 'transfer', label: 'Chuyển/Rút' },
    ]
  }
  return [
    { value: 'material_purchase', label: 'Vật tư' },
    { value: 'supplier_payment', label: 'Tiền trả NCC' },
    { value: 'staff_salary', label: 'Lương NV' },
    { value: 'shipping_expense', label: 'Vận chuyển' },
    { value: 'customer_refund', label: 'Hoàn tiền khách' },
    { value: 'operating_expense', label: 'Chi phí vận hành' },
    { value: 'tax_or_vat', label: 'Thuế/VAT' },
    { value: 'commission', label: 'Hoa hồng' },
    { value: 'transfer', label: 'Chuyển/Rút' },
    { value: 'other_expense', label: 'Chi khác' },
  ]
}
