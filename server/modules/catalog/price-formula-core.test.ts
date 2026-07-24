import { describe, expect, it } from 'vitest'
import { PriceFormulaValidationError, buildPriceFormulaPreview, parsePriceFormulaInput, parsePriceFormulaSelection, selectedFormulaPrices } from './price-formula-core.js'

const formula = parsePriceFormulaInput({
  name: 'Lẻ',
  product_filter: { status: 'active', code_contains: 'MICA' },
  cost_formula: { type: 'amount_plus_percent', amount: 5000, percent_of_latest_purchase_cost: 8 },
  profit_formula: { type: 'tiers', tiers: [{ operator: '>', value: 100000, amount: 25000 }] },
  price_list_adjustments: { retail: { type: 'amount', amount: 20000 }, vip: { type: 'percent', percent: -10 } },
})

describe('price formula core', () => {
  it('computes filtered price-list previews from source cost and never client price', () => {
    const preview = buildPriceFormulaPreview(formula, [
      { id: 'p-1', code: 'MICA-3', name: 'Mica', status: 'active', sell_method: 'quantity', latest_purchase_cost: 100000 },
      { id: 'p-2', code: 'DECAL', name: 'Decal', status: 'active', sell_method: 'quantity', latest_purchase_cost: 100000 },
    ], [
      { id: 'retail', name: 'Bán lẻ', is_active: true },
      { id: 'vip', name: 'VIP', is_active: true },
    ], new Map([['p-1', new Map([['retail', 120000]])]]))
    expect(preview).toEqual(expect.objectContaining({ affected_count: 1 }))
    expect(preview.items[0].computed_prices).toEqual([
      expect.objectContaining({ price_list_id: 'retail', current_unit_price: 120000, computed_unit_price: 133000, delta: 13000 }),
      expect.objectContaining({ price_list_id: 'vip', current_unit_price: null, computed_unit_price: 101700, delta: null }),
    ])
  })

  it('rejects invalid formula and duplicate or out-of-preview selections', () => {
    expect(() => parsePriceFormulaInput({ ...formula, name: '' })).toThrow(PriceFormulaValidationError)
    expect(() => parsePriceFormulaSelection([{ product_id: 'p', price_list_id: 'retail' }, { product_id: 'p', price_list_id: 'retail' }])).toThrow(PriceFormulaValidationError)
    const preview = buildPriceFormulaPreview(formula, [], [{ id: 'retail', name: 'Bán lẻ', is_active: true }, { id: 'vip', name: 'VIP', is_active: true }], new Map())
    expect(() => selectedFormulaPrices(preview, [{ product_id: 'missing', price_list_id: 'retail' }])).toThrow(PriceFormulaValidationError)
  })
})
