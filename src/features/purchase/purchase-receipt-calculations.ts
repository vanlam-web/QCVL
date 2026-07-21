import type {
  PurchasePhysicalPayload,
  PurchaseReceiptInput,
  PurchaseReceiptInputItem,
  PurchaseReceiptProduct,
  RollPhysicalPayload,
  SheetPhysicalPayload,
} from './purchase-receipt-types'

export function lineAmount(line: PurchaseReceiptInput['items'][number]) {
  return Math.max(Math.round(Number(line.quantity || 0) * Number(line.unit_cost || 0)) - Number(line.discount_amount || 0), 0)
}

export function purchaseReceiptTotals(form: Pick<PurchaseReceiptInput, 'discount_amount' | 'items' | 'paid_amount'>) {
  const subtotal = form.items.reduce((sum, line) => sum + lineAmount(line), 0)
  const payable = Math.max(subtotal - Number(form.discount_amount || 0), 0)
  const remaining = payable - Number(form.paid_amount || 0)
  return { subtotal, payable, remaining }
}

export function defaultPhysicalPayload(shape: PurchaseReceiptInputItem['inventory_shape']): PurchasePhysicalPayload | null {
  if (shape === 'roll') return { rolls: { width_m: 1, lengths_m: [1] } }
  if (shape === 'sheet') return { sheet_groups: [{ width_m: 1, length_m: 1, quantity: 1 }] }
  return null
}

export function purchaseUnitForProduct(product?: PurchaseReceiptProduct) {
  if (product?.inventory_shape === 'roll') return 'cuộn'
  if (product?.inventory_shape === 'sheet') return 'tấm'
  const defaultPurchaseUnit = product?.unit_conversions?.find((conversion) => conversion.is_default_purchase_unit)
  if (defaultPurchaseUnit) return defaultPurchaseUnit.unit_name
  return product?.unit_name ?? ''
}

export function rollPayload(payload: PurchasePhysicalPayload | null): RollPhysicalPayload {
  return payload !== null && 'rolls' in payload ? payload : { rolls: { width_m: 1, lengths_m: [1] } }
}

export function sheetPayload(payload: PurchasePhysicalPayload | null): SheetPhysicalPayload {
  return payload !== null && 'sheet_groups' in payload ? payload : { sheet_groups: [{ width_m: 1, length_m: 1, quantity: 1 }] }
}

export function rollTotalArea(payload: RollPhysicalPayload) {
  return payload.rolls.lengths_m.reduce((sum, length) => sum + Number(payload.rolls.width_m || 0) * Number(length || 0), 0)
}

export function sheetTotalArea(payload: SheetPhysicalPayload) {
  return payload.sheet_groups.reduce(
    (sum, group) => sum + Number(group.width_m || 0) * Number(group.length_m || 0) * Number(group.quantity || 0),
    0,
  )
}

export function physicalSummary(line: Pick<PurchaseReceiptInputItem, 'inventory_shape' | 'physical_payload'>) {
  if (line.inventory_shape === 'roll') {
    const payload = rollPayload(line.physical_payload)
    if (payload.rolls.lengths_m.length === 0) return `0 cuộn, khổ ${payload.rolls.width_m}m, tổng 0.000 m²`
    return `${payload.rolls.lengths_m.length} cuộn, khổ ${payload.rolls.width_m}m, tổng ${rollTotalArea(payload).toFixed(3)} m²`
  }
  if (line.inventory_shape === 'sheet') {
    const payload = sheetPayload(line.physical_payload)
    const sheetCount = payload.sheet_groups.reduce((sum, group) => sum + Number(group.quantity || 0), 0)
    return `${sheetCount} tấm, ${payload.sheet_groups.length} nhóm kích thước, tổng ${sheetTotalArea(payload).toFixed(3)} m²`
  }
  return null
}

export function purchaseReceiptListSummary(receipts: Array<{ payable_amount: number; remaining_amount: number }>) {
  return {
    payable: receipts.reduce((sum, receipt) => sum + receipt.payable_amount, 0),
    remaining: receipts.reduce((sum, receipt) => sum + receipt.remaining_amount, 0),
  }
}

export function supplierPaymentsTotal(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0)
}

export function receiptOutstandingAfterPost(receipt: { remaining_amount: number; supplier_payments: Array<{ amount: number }> }) {
  return receipt.remaining_amount - supplierPaymentsTotal(receipt.supplier_payments)
}

export function sheetGroupQuantity(groups: Array<{ quantity: number | string }>) {
  return groups.reduce((sum, group) => sum + Number(group.quantity || 0), 0)
}
