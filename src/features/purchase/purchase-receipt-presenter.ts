import { formatMoney } from '../../lib/number-format'
import type { PurchaseReceiptStatus } from './purchase-receipt-types'

export function money(value: number) {
  return formatMoney(value)
}

export function statusText(status: PurchaseReceiptStatus) {
  if (status === 'draft') return 'Phiếu tạm'
  if (status === 'posted') return 'Đã nhập hàng'
  return 'Đã hủy'
}

export function supplierPaymentStatusText(status: 'posted' | 'cancelled') {
  return status === 'posted' ? 'Đã thanh toán' : 'Đã hủy'
}

export function supplierPaymentMethodText(method: 'cash' | 'bank_transfer') {
  return method === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'
}

export function isExactPurchaseReceiptCode(value: string) {
  return /^PN\d+/i.test(value.trim())
}
