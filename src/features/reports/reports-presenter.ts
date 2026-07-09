import type { CustomerDebtSummary } from '../finance/types'
import type { InventoryProduct } from '../inventory/types'
import type { SalesDocumentListItem } from '../sales-documents/types'

export function reportOverviewSummary({
  sales,
  debts,
  inventory,
}: {
  sales: SalesDocumentListItem[] | null
  debts: CustomerDebtSummary[] | null
  inventory: InventoryProduct[] | null
}) {
  return {
    salesTotal: sales?.reduce((sum, item) => sum + item.total_amount, 0) ?? 0,
    salesPaid: sales?.reduce((sum, item) => sum + item.paid_amount, 0) ?? 0,
    salesDebt: sales?.reduce((sum, item) => sum + item.debt_amount, 0) ?? 0,
    debtTotal: debts?.reduce((sum, item) => sum + item.total_debt, 0) ?? 0,
    negativeStockCount: inventory?.filter((item) => item.is_negative).length ?? 0,
    inventoryQty: inventory?.reduce((sum, item) => sum + item.available_qty, 0) ?? 0,
  }
}

export function reportDateText(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

export function reportNumberText(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}
