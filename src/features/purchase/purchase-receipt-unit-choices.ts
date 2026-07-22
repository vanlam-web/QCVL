import { normalizeManagementSearchText } from '../../components/ui-shell/management-search'
import type { PurchaseReceiptProduct } from './purchase-receipt-types'

export interface PurchaseReceiptUnitChoice {
  unitName: string
  product?: PurchaseReceiptProduct
}

function unitSortValue(unitName: string) {
  const match = unitName.match(/(\d+(?:[.,]\d+)?)/)
  return match ? Number(match[1].replace(',', '.')) : null
}

function compareReceiptUnitChoices(left: PurchaseReceiptUnitChoice, right: PurchaseReceiptUnitChoice) {
  const leftNumber = unitSortValue(left.unitName)
  const rightNumber = unitSortValue(right.unitName)
  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }
  return left.unitName.localeCompare(right.unitName, 'vi')
}

export function purchaseReceiptLineUnitChoices(product: PurchaseReceiptProduct | undefined, products: PurchaseReceiptProduct[]) {
  if (!product) return []
  if (product.inventory_shape === 'roll') return [{ unitName: 'cuộn' }]
  if (product.inventory_shape === 'sheet') return [{ unitName: 'tấm' }]

  const choices = new Map<string, PurchaseReceiptUnitChoice>()
  function addChoice(unitName: string | null | undefined, linkedProduct?: PurchaseReceiptProduct) {
    const normalizedUnitName = unitName?.trim()
    if (!normalizedUnitName) return
    const current = choices.get(normalizedUnitName)
    if (current?.product && !linkedProduct) return
    choices.set(normalizedUnitName, { unitName: normalizedUnitName, product: linkedProduct ?? current?.product })
  }

  for (const conversion of product.unit_conversions ?? []) {
    addChoice(conversion.unit_name)
  }
  addChoice(product.unit_name, product)

  const productFamilyName = normalizeManagementSearchText(product.name)
  for (const candidate of products) {
    if (
      candidate.status !== 'active'
      || candidate.sell_method === 'combo'
      || candidate.inventory_shape !== product.inventory_shape
      || normalizeManagementSearchText(candidate.name) !== productFamilyName
    ) {
      continue
    }
    addChoice(candidate.unit_name, candidate)
    for (const conversion of candidate.unit_conversions ?? []) addChoice(conversion.unit_name)
  }

  return [...choices.values()].sort(compareReceiptUnitChoices)
}
