import type { Product } from './types'

export interface CatalogBomFormLine {
  component_product_id: string
  quantity: string
  notes: string
}

export function catalogQuantityText(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

export function catalogStockCardMoneyText(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value).replaceAll('.', ' ')
}

export function catalogDateTimeText(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function catalogInventoryShapeLabel(shape: NonNullable<Product['inventory_shape']>) {
  if (shape === 'roll') return 'Cuộn'
  if (shape === 'sheet') return 'Tấm'
  return 'Hàng thường'
}

export function normalizeCatalogBomLines(lines: CatalogBomFormLine[]) {
  return lines
    .filter((line) => line.component_product_id !== '')
    .map((line) => ({
      component_product_id: line.component_product_id,
      quantity: Number(line.quantity),
      ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
    }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)
}
