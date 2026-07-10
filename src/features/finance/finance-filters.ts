import { quickDateRange, type QuickDateRangePreset } from '../../lib/date-ranges'
import { formatKvDateTime } from '../../lib/date-format'
import type { CashbookDirection, CashbookEntry, CashbookStatus } from './types'

export type CashbookTimeFilter = QuickDateRangePreset | 'custom'
export type CashbookFundMode = 'cash' | 'bank' | 'all'

export const cashbookQuickTimeGroups: Array<{ title: string; presets: Array<Exclude<CashbookTimeFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]

export const cashbookQuickTimeLabels: Record<CashbookTimeFilter, string> = {
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

export function normalizeFinanceSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function cashbookEntryMatchesSearch(entry: CashbookEntry, search: string) {
  const query = normalizeFinanceSearch(search)
  if (query.length === 0) return true
  const haystack = normalizeFinanceSearch([
    entry.code,
    entry.note ?? '',
    entry.counterparty?.name ?? '',
    entry.counterparty?.phone ?? '',
    entry.finance_account.code,
    entry.finance_account.name,
  ].join(' '))
  return haystack.includes(query)
}

export function cashbookEntryMatchesFundMode(entry: CashbookEntry, fundMode: CashbookFundMode, accountId: string) {
  if (fundMode === 'all') return true
  if (accountId !== '' && accountId !== 'all') return entry.finance_account.id === accountId
  return entry.finance_account.account_type === fundMode
}

export function nextDirectionSelection(current: CashbookDirection[], value: CashbookDirection) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

export function directionFilterFromSelection(selection: CashbookDirection[]): CashbookDirection | 'all' {
  return selection.length === 1 ? selection[0] : 'all'
}

export function nextStatusSelection(current: CashbookStatus[], value: CashbookStatus) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

export function statusFilterFromSelection(selection: CashbookStatus[]): CashbookStatus | 'all' {
  return selection.length === 1 ? selection[0] : 'all'
}

export function dateTimeInputText(date: Date) {
  return formatKvDateTime(date)
}

export function formatVoucherAmountInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''
  return Number(digits).toLocaleString('vi-VN')
}

export function parseVoucherAmountInput(value: string) {
  return Number(value.replace(/\D/g, '') || 0)
}

export function cashbookQuickTimeRange(preset: Exclude<CashbookTimeFilter, 'custom'>) {
  return quickDateRange(preset)
}

export function displayDate(value: string) {
  if (!value) return '--/--/----'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
