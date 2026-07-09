import type { SalesDocumentService } from './sales-document-service'
import { currentMonthRange, localDateString, quickDateRange, type QuickDateRangePreset } from '../../lib/date-ranges'

export { currentMonthRange, localDateString }

export const salesDocumentsPageSize = 15

export type TimeFilter =
  | QuickDateRangePreset
  | 'custom'

export type SalesDocumentTypeFilter = 'invoice' | 'quote'
export type SalesDocumentStatusFilter = 'active' | 'completed' | 'cancelled'
export type PaymentStatusValue = 'unpaid' | 'partial' | 'paid'
export type PaymentMethodFilter = 'all' | 'cash' | 'bank_transfer'

export const allSalesDocumentTypeFilters: SalesDocumentTypeFilter[] = ['invoice', 'quote']
export const allSalesDocumentStatusFilters: SalesDocumentStatusFilter[] = ['active', 'completed', 'cancelled']
export const defaultSalesDocumentStatusFilters: SalesDocumentStatusFilter[] = ['active', 'completed']
export const allPaymentStatusFilters: PaymentStatusValue[] = ['unpaid', 'partial', 'paid']

export const quickTimeGroups: Array<{ title: string; presets: Array<Exclude<TimeFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]

export const quickTimeLabels: Record<TimeFilter, string> = {
  all: 'Toàn thời gian',
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  week: 'Tuần này',
  last_week: 'Tuần trước',
  last_7_days: '7 ngày qua',
  month: 'Tháng này',
  last_month: 'Tháng trước',
  last_30_days: '30 ngày qua',
  quarter: 'Quý này',
  last_quarter: 'Quý trước',
  year: 'Năm nay',
  last_year: 'Năm trước',
  custom: 'Tùy chỉnh',
}

export interface SalesDocumentFilterState {
  search?: string
  type: SalesDocumentTypeFilter[]
  status: SalesDocumentStatusFilter[]
  paymentStatus: PaymentStatusValue[]
  paymentMethod: PaymentMethodFilter
  seller: string
  priceList: string
  time: TimeFilter
  from: string
  to: string
  page: number
  page_size: number
}

export type SalesDocumentListRequest = Parameters<SalesDocumentService['listSalesDocuments']>[0]

export function quickTimeRange(preset: Exclude<TimeFilter, 'custom'>) {
  return quickDateRange(preset)
}

export function displayDate(value: string) {
  if (!value) return '--/--/----'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function filterQuery<T extends string>(selected: readonly T[], allValues: readonly T[]) {
  if (selected.length === 0) return '__none__'
  if (selected.length === allValues.length && allValues.every((value) => selected.includes(value))) return undefined
  return selected.join(',')
}

export function toggleFilterValue<T extends string>(current: readonly T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

export function sameFilterValues<T extends string>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && right.every((value) => left.includes(value))
}

export function buildSalesDocumentListRequest(input: SalesDocumentFilterState): SalesDocumentListRequest {
  const type = filterQuery(input.type, allSalesDocumentTypeFilters)
  const status = filterQuery(input.status, allSalesDocumentStatusFilters)
  const paymentStatus = filterQuery(input.paymentStatus, allPaymentStatusFilters)

  return {
    ...(input.search ? { search: input.search } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { payment_status: paymentStatus } : {}),
    ...(input.paymentMethod === 'all' ? {} : { payment_method: input.paymentMethod }),
    ...(input.seller === 'all' ? {} : { created_by: input.seller }),
    ...(input.priceList === 'all' ? {} : { price_list_id: input.priceList }),
    ...(input.time !== 'all' && input.from ? { from: input.from } : {}),
    ...(input.time !== 'all' && input.to ? { to: input.to } : {}),
    page: input.page,
    page_size: input.page_size,
  }
}
