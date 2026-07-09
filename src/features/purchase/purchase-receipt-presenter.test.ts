import { describe, expect, it } from 'vitest'
import { isExactPurchaseReceiptCode, money, statusText } from './purchase-receipt-presenter'

describe('purchase receipt presenter', () => {
  it('formats labels and code checks', () => {
    expect(money(1200000)).toBe('1 200 000')
    expect(statusText('draft')).toBe('Phiếu tạm')
    expect(statusText('posted')).toBe('Đã nhập hàng')
    expect(statusText('cancelled')).toBe('Đã hủy')
    expect(isExactPurchaseReceiptCode('PN0001')).toBe(true)
    expect(isExactPurchaseReceiptCode('abc')).toBe(false)
  })
})
