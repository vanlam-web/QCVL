import { describe, expect, it } from 'vitest'
import { dateText, inventoryListSummary, moneyText, numberText, shapeText, statusText, stocktakeStatusText } from './inventory-presenter'

describe('inventory presenter', () => {
  it('maps labels and display formats', () => {
    expect(shapeText('roll')).toBe('Hàng cuộn')
    expect(shapeText('all')).toBe('Tất cả')
    expect(statusText('active')).toBe('Đang kinh doanh')
    expect(stocktakeStatusText('balanced')).toBe('Đã cân bằng')
    expect(numberText(12.3456)).toBe('12,346')
    expect(moneyText(1200000)).toBe('1 200 000')
    expect(moneyText(null)).toBe('Chưa có')
    expect(dateText(null)).toBe('Chưa có')
  })
  it('summarizes inventory list outside the page', () => {
    expect(inventoryListSummary([
      { available_qty: -2, is_negative: true },
      { available_qty: 5.5, is_negative: false },
    ])).toEqual({ negativeCount: 1, totalQty: 3.5 })
    expect(inventoryListSummary(null)).toEqual({ negativeCount: 0, totalQty: 0 })
  })
})
