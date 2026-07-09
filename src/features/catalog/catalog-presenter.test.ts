import { describe, expect, it } from 'vitest'
import {
  catalogDateTimeText,
  catalogInventoryShapeLabel,
  catalogQuantityText,
  catalogStockCardMoneyText,
  normalizeCatalogBomLines,
} from './catalog-presenter'

describe('catalog presenter', () => {
  it('formats catalog display values outside the page', () => {
    expect(catalogQuantityText(12.3456)).toBe('12,346')
    expect(catalogStockCardMoneyText(1200000)).toBe('1 200 000')
    expect(catalogDateTimeText('bad-date')).toBe('bad-date')
    expect(catalogInventoryShapeLabel('roll')).toBe('Cuộn')
  })

  it('normalizes BOM form lines outside the page', () => {
    expect(normalizeCatalogBomLines([
      { component_product_id: 'p-1', quantity: '2', notes: ' cat ' },
      { component_product_id: '', quantity: '1', notes: '' },
      { component_product_id: 'p-2', quantity: '0', notes: '' },
    ])).toEqual([{ component_product_id: 'p-1', quantity: 2, notes: 'cat' }])
  })
})
