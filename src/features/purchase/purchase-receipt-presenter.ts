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

export function isExactPurchaseReceiptCode(value: string) {
  return /^PN\d+/i.test(value.trim())
}
