import type { CustomerListFilters } from './catalog-service'

export type CustomerHistoryType = 'invoice' | 'quote'

export interface CustomerFilterState {
  search: string
  status: 'active' | 'inactive' | 'all'
  page: number
  page_size: number
  customerGroupId: string
  createdFrom: string
  createdTo: string
  createdBy: string
  totalSalesMin: string
  totalSalesMax: string
  totalDebtMin: string
  totalDebtMax: string
}

export function numberFilterValue(value: string) {
  const parsed = Number(value)
  return value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed
}

export function customerHistoryKey(customerId: string, historyType: CustomerHistoryType) {
  return `${customerId}:${historyType}`
}

export function buildCustomerListFilters(input: CustomerFilterState): CustomerListFilters {
  const totalSalesMinFilter = numberFilterValue(input.totalSalesMin)
  const totalSalesMaxFilter = numberFilterValue(input.totalSalesMax)
  const totalDebtMinFilter = numberFilterValue(input.totalDebtMin)
  const totalDebtMaxFilter = numberFilterValue(input.totalDebtMax)

  return {
    search: input.search || undefined,
    ...(input.status === 'all' ? {} : { status: input.status }),
    page: input.page,
    page_size: input.page_size,
    ...(input.customerGroupId === 'all' ? {} : { customer_group_id: input.customerGroupId }),
    ...(input.createdFrom === '' ? {} : { created_from: input.createdFrom }),
    ...(input.createdTo === '' ? {} : { created_to: input.createdTo }),
    ...(input.createdBy === 'all' ? {} : { created_by: input.createdBy }),
    ...(totalSalesMinFilter === undefined ? {} : { total_sales_min: totalSalesMinFilter }),
    ...(totalSalesMaxFilter === undefined ? {} : { total_sales_max: totalSalesMaxFilter }),
    ...(totalDebtMinFilter === undefined ? {} : { total_debt_min: totalDebtMinFilter }),
    ...(totalDebtMaxFilter === undefined ? {} : { total_debt_max: totalDebtMaxFilter }),
  }
}
