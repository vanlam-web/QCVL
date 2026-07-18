import type { InventoryProduct, InventoryProductStatusFilter, InventoryShape, Stocktake } from './types'
import { formatKvDateTime } from '../../lib/date-format'

export function shapeText(shape: InventoryShape | 'all') {
  if (shape === 'normal') return 'Hàng thường'
  if (shape === 'roll') return 'Hàng cuộn'
  if (shape === 'sheet') return 'Hàng tấm'
  return 'Tất cả'
}

export function statusText(status: InventoryProductStatusFilter) {
  if (status === 'active') return 'Đang kinh doanh'
  if (status === 'inactive') return 'Ngừng bán'
  if (status === 'deleted') return 'Đã xoá KV'
  return 'Tất cả'
}

export function stocktakeStatusText(status: Stocktake['status']) {
  if (status === 'balanced') return 'Đã cân bằng'
  if (status === 'draft') return 'Nháp'
  return 'Đã hủy'
}

export function numberText(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

export function moneyText(value: number | null) {
  if (value === null) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value).replaceAll('.', ' ')
}

export function stocktakeQuantityText(value: number | null) {
  if (value === null) return ''
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
}

export function stocktakeMoneyText(value: number | null) {
  if (value === null) return ''
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
}

export function dateText(value: string | null) {
  return formatKvDateTime(value)
}

export function stocktakeDateTimeText(value: string | null) {
  return formatKvDateTime(value)
}

export function inventoryListSummary(products: Pick<InventoryProduct, 'available_qty' | 'is_negative'>[] | null) {
  return {
    negativeCount: products?.filter((product) => product.is_negative).length ?? 0,
    totalQty: products?.reduce((sum, product) => sum + product.available_qty, 0) ?? 0,
  }
}
