export type PriceFormulaInput = {
  name: string
  product_filter: { status: 'active'; name_contains?: string; code_contains?: string; sell_method?: string }
  cost_formula: { type: 'fixed'; amount: number } | { type: 'amount_plus_percent'; amount: number; percent_of_latest_purchase_cost: number }
  profit_formula: { type: 'fixed'; amount: number } | { type: 'tiers'; tiers: Array<{ operator: '<' | '<=' | '>' | '>=' | '='; value: number; amount: number; percent?: number }> }
  price_list_adjustments: Record<string, { type: 'amount'; amount: number } | { type: 'percent'; percent: number }>
}
export type PriceFormulaSelection = { product_id: string; price_list_id: string }
export type PriceFormulaPreviewPrice = { price_list_id: string; price_list_name: string; current_unit_price: number | null; computed_unit_price: number; delta: number | null }
export type PriceFormulaPreviewItem = { product_id: string; product_code: string; product_name: string; latest_purchase_cost: number; current_mode: 'manual' | 'formula' | null; current_unit_price: number | null; computed_prices: PriceFormulaPreviewPrice[] }
export type PriceFormulaPreview = { affected_count: number; items: PriceFormulaPreviewItem[] }
export type PriceFormulaApplyResult = { formula_rule_id: string; affected_count: number }
type FormulaProduct = { id: string; code: string; name: string; status: string; sell_method: string; latest_purchase_cost: number | null }
type FormulaPriceList = { id: string; name: string; is_active: boolean }
export class PriceFormulaValidationError extends Error {}

export function parsePriceFormulaInput(value: unknown): PriceFormulaInput {
  if (!isRecord(value)) throw new PriceFormulaValidationError('formula is required.')
  const filter = record(value.product_filter, 'product_filter'), cost = record(value.cost_formula, 'cost_formula'), profit = record(value.profit_formula, 'profit_formula'), adjustments = record(value.price_list_adjustments, 'price_list_adjustments')
  if (filter.status !== 'active') throw new PriceFormulaValidationError('product_filter.status must be active.')
  return {
    name: text(value.name, 'name'),
    product_filter: { status: 'active', ...(optionalText(filter.name_contains) ? { name_contains: optionalText(filter.name_contains) } : {}), ...(optionalText(filter.code_contains) ? { code_contains: optionalText(filter.code_contains) } : {}), ...(optionalText(filter.sell_method) ? { sell_method: optionalText(filter.sell_method) } : {}) },
    cost_formula: cost.type === 'fixed' ? { type: 'fixed', amount: nonNegative(cost.amount, 'cost_formula.amount') } : cost.type === 'amount_plus_percent' ? { type: 'amount_plus_percent', amount: nonNegative(cost.amount, 'cost_formula.amount'), percent_of_latest_purchase_cost: nonNegative(cost.percent_of_latest_purchase_cost, 'cost_formula.percent_of_latest_purchase_cost') } : invalid('cost_formula.type is invalid.'),
    profit_formula: profit.type === 'fixed' ? { type: 'fixed', amount: nonNegative(profit.amount, 'profit_formula.amount') } : profit.type === 'tiers' ? { type: 'tiers', tiers: parseTiers(profit.tiers) } : invalid('profit_formula.type is invalid.'),
    price_list_adjustments: Object.fromEntries(Object.entries(adjustments).map(([priceListId, adjustment]) => {
      const item = record(adjustment, `price_list_adjustments.${priceListId}`)
      if (item.type === 'amount') return [text(priceListId, 'price_list_id'), { type: 'amount' as const, amount: signed(item.amount, `price_list_adjustments.${priceListId}.amount`) }]
      if (item.type === 'percent') return [text(priceListId, 'price_list_id'), { type: 'percent' as const, percent: signed(item.percent, `price_list_adjustments.${priceListId}.percent`) }]
      return invalid(`price_list_adjustments.${priceListId}.type is invalid.`)
    })),
  }
}
export function parsePriceFormulaSelection(value: unknown): PriceFormulaSelection[] {
  if (!Array.isArray(value) || value.length === 0) throw new PriceFormulaValidationError('selected_items must not be empty.')
  const seen = new Set<string>()
  return value.map((item) => { const row = record(item, 'selected_item'), selected = { product_id: text(row.product_id, 'selected_item.product_id'), price_list_id: text(row.price_list_id, 'selected_item.price_list_id') }, key = `${selected.product_id}:${selected.price_list_id}`; if (seen.has(key)) throw new PriceFormulaValidationError('selected_items must not contain duplicates.'); seen.add(key); return selected })
}
export function buildPriceFormulaPreview(input: PriceFormulaInput, products: readonly FormulaProduct[], priceLists: readonly FormulaPriceList[], pricesByProduct: ReadonlyMap<string, ReadonlyMap<string, number>>): PriceFormulaPreview {
  const activeLists = priceLists.filter((list) => list.is_active), listsById = new Map(activeLists.map((list) => [list.id, list]))
  for (const id of Object.keys(input.price_list_adjustments)) if (!listsById.has(id)) throw new PriceFormulaValidationError(`price_list_adjustments references inactive or missing price list ${id}.`)
  const items = products.filter((product) => matchesProduct(input, product)).map((product) => {
    const base = formulaBase(input, product.latest_purchase_cost ?? 0), priceMap = pricesByProduct.get(product.id) ?? new Map<string, number>()
    const computed_prices = activeLists.map((priceList) => { const computed = priceForList(base, input.price_list_adjustments[priceList.id]), current = priceMap.get(priceList.id) ?? null; return { price_list_id: priceList.id, price_list_name: priceList.name, current_unit_price: current, computed_unit_price: computed, delta: current === null ? null : computed - current } })
    return { product_id: product.id, product_code: product.code, product_name: product.name, latest_purchase_cost: product.latest_purchase_cost ?? 0, current_mode: null, current_unit_price: computed_prices[0]?.current_unit_price ?? null, computed_prices }
  })
  return { affected_count: items.length, items }
}
export function selectedFormulaPrices(preview: PriceFormulaPreview, selected: readonly PriceFormulaSelection[]) {
  const previewByProduct = new Map(preview.items.map((item) => [item.product_id, item]))
  return selected.map((choice) => { const item = previewByProduct.get(choice.product_id), price = item?.computed_prices.find((candidate) => candidate.price_list_id === choice.price_list_id); if (!item || !price) throw new PriceFormulaValidationError('selected_items contains a product or price list outside the current preview.'); return { product_id: choice.product_id, price_list_id: choice.price_list_id, unit_price: price.computed_unit_price } })
}
function matchesProduct(input: PriceFormulaInput, product: FormulaProduct) { return product.status === 'active' && (!input.product_filter.sell_method || product.sell_method === input.product_filter.sell_method) && (!input.product_filter.code_contains || includesVietnamese(product.code, input.product_filter.code_contains)) && (!input.product_filter.name_contains || includesVietnamese(product.name, input.product_filter.name_contains)) }
function formulaBase(input: PriceFormulaInput, latestPurchaseCost: number) { const cost = input.cost_formula.type === 'fixed' ? input.cost_formula.amount : input.cost_formula.amount + latestPurchaseCost * input.cost_formula.percent_of_latest_purchase_cost / 100; const profit = input.profit_formula.type === 'fixed' ? input.profit_formula.amount : input.profit_formula.tiers.reduce((total, tier) => tierMatches(tier.operator, latestPurchaseCost, tier.value) ? total + tier.amount + latestPurchaseCost * (tier.percent ?? 0) / 100 : total, 0); return latestPurchaseCost + cost + profit }
function priceForList(base: number, adjustment: PriceFormulaInput['price_list_adjustments'][string] | undefined) { const price = adjustment === undefined ? base : adjustment.type === 'amount' ? base + adjustment.amount : base * (1 + adjustment.percent / 100); if (!Number.isFinite(price) || price < 0) throw new PriceFormulaValidationError('computed price is invalid.'); return Math.round(price * 100) / 100 }
function tierMatches(operator: '<' | '<=' | '>' | '>=' | '=', left: number, right: number) { if (operator === '<') return left < right; if (operator === '<=') return left <= right; if (operator === '>') return left > right; if (operator === '>=') return left >= right; return left === right }
function parseTiers(value: unknown) { if (!Array.isArray(value) || value.length === 0) throw new PriceFormulaValidationError('profit_formula.tiers must not be empty.'); return value.map((row, index) => { const tier = record(row, `profit_formula.tiers.${index}`), operator = tier.operator; if (operator !== '<' && operator !== '<=' && operator !== '>' && operator !== '>=' && operator !== '=') throw new PriceFormulaValidationError(`profit_formula.tiers.${index}.operator is invalid.`); return { operator: operator as '<' | '<=' | '>' | '>=' | '=', value: nonNegative(tier.value, `profit_formula.tiers.${index}.value`), amount: signed(tier.amount, `profit_formula.tiers.${index}.amount`), ...(tier.percent === undefined ? {} : { percent: signed(tier.percent, `profit_formula.tiers.${index}.percent`) }) } }) }
function record(value: unknown, field: string) { if (!isRecord(value)) throw new PriceFormulaValidationError(`${field} is required.`); return value }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function text(value: unknown, field: string) { const result = optionalText(value); if (!result) throw new PriceFormulaValidationError(`${field} is required.`); return result }
function optionalText(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function nonNegative(value: unknown, field: string) { const result = Number(value); if (!Number.isFinite(result) || result < 0) throw new PriceFormulaValidationError(`${field} must be a non-negative number.`); return result }
function signed(value: unknown, field: string) { const result = Number(value); if (!Number.isFinite(result)) throw new PriceFormulaValidationError(`${field} must be a finite number.`); return result }
function invalid(message: string): never { throw new PriceFormulaValidationError(message) }
function includesVietnamese(value: string, query: string) { return normalize(value).includes(normalize(query)) }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().trim() }
