import type { Product } from './types'
import { formatKvDate, formatKvDateTime } from '../../lib/date-format'

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
  return formatKvDateTime(value)
}

export function catalogDateText(value: string | null | undefined) {
  return formatKvDate(value)
}

export function catalogUnitNameDisplay(value: string | null | undefined) {
  const unitName = value?.trim() ?? ''
  const normalized = unitName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  if (normalized === '' || normalized === 'can cap nhat') return null
  return unitName
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
