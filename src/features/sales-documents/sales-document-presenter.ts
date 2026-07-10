import { paymentSettlementStatusLabel, paymentSettlementStatusTone, type PaymentSettlementStatus } from '../../components/ui-shell/payment-status'
import { formatKvDate, formatKvDateTime } from '../../lib/date-format'
import { formatMeasure, formatMoney } from '../../lib/number-format'
import type { SalesDocumentDetail } from './types'
import type { PaymentMethodFilter, PaymentStatusValue, SalesDocumentStatusFilter, SalesDocumentTypeFilter } from './sales-document-filters'

export function salesDocumentStatusLabel(document: Pick<SalesDocumentDetail, 'status' | 'order_type' | 'payment_status'>) {
  if (document.status === 'cancelled') return 'Đã hủy'
  if (document.order_type === 'quote') return document.status === 'converted' ? 'Đã chuyển' : 'Đang hiệu lực'
  return paymentSettlementStatusLabel(salesDocumentPaymentSettlementStatus(document))
}

export function salesDocumentStatusTone(document: Pick<SalesDocumentDetail, 'status' | 'order_type' | 'payment_status'>) {
  if (document.status === 'cancelled') return 'danger'
  if (document.order_type === 'quote') return document.status === 'completed' ? 'success' : 'info'
  return paymentSettlementStatusTone(salesDocumentPaymentSettlementStatus(document))
}

export function salesDocumentPaymentSettlementStatus(document: Pick<SalesDocumentDetail, 'payment_status'>): PaymentSettlementStatus {
  if (document.payment_status === 'paid') return 'paid'
  if (document.payment_status === 'partial') return 'partial'
  return 'unpaid'
}

export function documentTypeFilterLabel(value: SalesDocumentTypeFilter) {
  return value === 'invoice' ? 'Hóa đơn' : 'Báo giá'
}

export function lifecycleFilterLabel(value: SalesDocumentStatusFilter) {
  if (value === 'active') return 'Đang hiệu lực'
  if (value === 'completed') return 'Hoàn tất'
  return 'Đã hủy'
}

export function paymentStatusFilterLabel(value: PaymentStatusValue) {
  if (value === 'unpaid') return 'Chưa thanh toán'
  if (value === 'partial') return 'Thanh toán một phần'
  return 'Đã thanh toán'
}

export function paymentMethodFilterLabel(value: PaymentMethodFilter) {
  if (value === 'cash') return 'Tiền mặt'
  if (value === 'bank_transfer') return 'Chuyển khoản'
  return 'Tất cả'
}

export function paymentReceiptMethodLabel(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  const labels = paymentReceiptMethods(receipt).map((method) => (method.method_type === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'))
  return Array.from(new Set(labels)).join(', ') || '-'
}

export function paymentReceiptMethodTotal(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  const methodTotal = paymentReceiptMethods(receipt).reduce((sum, method) => sum + method.amount, 0)
  return methodTotal || receipt.total_received_amount
}

export function paymentReceiptStatusLabel(status: SalesDocumentDetail['payment_receipts'][number]['status']) {
  return status === 'posted' ? 'Đã thanh toán' : 'Đã hủy'
}

export function paymentReceiptCreatorLabel(
  receipt: SalesDocumentDetail['payment_receipts'][number],
  seller: SalesDocumentDetail['seller'],
) {
  return receipt.created_by?.name || receipt.created_by?.id || seller.name || seller.id || 'Chưa có dữ liệu'
}

export function paymentReceiptMethods(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  return Array.isArray(receipt.methods) ? receipt.methods : []
}

export function salesDocumentListSummary(documents: Array<Pick<SalesDocumentDetail, 'total_amount' | 'debt_amount'>>) {
  return {
    totalAmount: documents.reduce((sum, document) => sum + document.total_amount, 0),
    debtAmount: documents.reduce((sum, document) => sum + document.debt_amount, 0),
  }
}

export function salesDocumentLineSellPrice(item: Pick<SalesDocumentDetail['items'][number], 'quantity' | 'line_total'>) {
  if (item.quantity <= 0) return item.line_total
  return Math.round(item.line_total / item.quantity)
}

export function salesDocumentDateTimeText(value: string | null | undefined, fallback?: string | null): string {
  return formatKvDateTime(value, fallback ? salesDocumentDateTimeText(fallback) : '-')
}

export function salesDocumentMoneyText(value: number) {
  return formatMoney(value)
}

export function salesDocumentMeasureText(value: number) {
  return formatMeasure(value)
}

export function salesDocumentQuoteDateText(value: string) {
  return formatKvDate(value, '-')
}

export function salesDocumentQuoteLineDimensionText(item: Pick<SalesDocumentDetail['items'][number], 'width_m' | 'height_m' | 'linear_m' | 'product'>) {
  if (item.width_m && item.height_m) return `${salesDocumentMeasureText(item.width_m)} x ${salesDocumentMeasureText(item.height_m)} m`
  if (item.linear_m) return `${salesDocumentMeasureText(item.linear_m)} m tá»›i`
  return item.product.sell_method === 'quantity' ? 'Theo sá»‘ lÆ°á»£ng' : item.product.unit_name
}
