import { describe, expect, it } from 'vitest'
import {
  dateText,
  inventoryListSummary,
  moneyText,
  numberText,
  shapeText,
  statusText,
  stocktakeDateTimeText,
  stocktakeMoneyText,
  stocktakeQuantityText,
  stocktakeStatusText,
} from './inventory-presenter'

describe('inventory presenter', () => {
  it('maps labels and display formats', () => {
    expect(shapeText('roll')).toBe('Hàng cuộn')
    expect(shapeText('all')).toBe('Tất cả')
    expect(statusText('active')).toBe('Đang kinh doanh')
    expect(stocktakeStatusText('balanced')).toBe('Đã cân bằng')
    expect(numberText(12.3456)).toBe('12,346')
    expect(moneyText(1200000)).toBe('1 200 000')
    expect(moneyText(null)).toBe('')
    expect(dateText(null)).toBe('')
  })
  it('summarizes inventory list outside the page', () => {
    expect(inventoryListSummary([
      { available_qty: -2, is_negative: true },
      { available_qty: 5.5, is_negative: false },
    ])).toEqual({ negativeCount: 1, totalQty: 3.5 })
    expect(inventoryListSummary(null)).toEqual({ negativeCount: 0, totalQty: 0 })
  })

  it('formats KiotViet stocktake values without timezone shift or rounding decimals', () => {
    expect(stocktakeDateTimeText('2026-06-05T07:52:12.640Z')).toBe('05/06/2026 07:52')
    expect(stocktakeDateTimeText(null)).toBe('')
    expect(stocktakeQuantityText(1.5)).toBe('1.5')
    expect(stocktakeQuantityText(-15.678)).toBe('-15.678')
    expect(stocktakeMoneyText(313550)).toBe('313,550')
    expect(stocktakeMoneyText(-7160.851)).toBe('-7,160.851')
  })
})
