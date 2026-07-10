export type QuickDateRangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'week'
  | 'last_week'
  | 'last_7_days'
  | 'month'
  | 'last_month'
  | 'last_30_days'
  | 'quarter'
  | 'last_quarter'
  | 'year'
  | 'last_year'

export function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function currentMonthRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: localDateString(firstDay), to: localDateString(lastDay) }
}

export function toDisplayDateInput(value: string) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export function normalizeDateInput(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const kvMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const year = isoMatch?.[1] ?? kvMatch?.[3]
  const month = isoMatch?.[2] ?? kvMatch?.[2]
  const day = isoMatch?.[3] ?? kvMatch?.[1]
  if (!year || !month || !day) return null
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function quickDateRange(preset: QuickDateRangePreset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const currentQuarter = Math.floor(today.getMonth() / 3)

  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'today') return { from: localDateString(today), to: localDateString(today) }
  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1)
    return { from: localDateString(yesterday), to: localDateString(yesterday) }
  }
  if (preset === 'week') {
    const firstDay = addDays(today, mondayOffset)
    return { from: localDateString(firstDay), to: localDateString(addDays(firstDay, 6)) }
  }
  if (preset === 'last_week') {
    const firstDay = addDays(today, mondayOffset - 7)
    return { from: localDateString(firstDay), to: localDateString(addDays(firstDay, 6)) }
  }
  if (preset === 'last_7_days') return { from: localDateString(addDays(today, -6)), to: localDateString(today) }
  if (preset === 'month') return currentMonthRange()
  if (preset === 'last_month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'last_30_days') return { from: localDateString(addDays(today, -29)), to: localDateString(today) }
  if (preset === 'quarter') {
    const firstDay = new Date(today.getFullYear(), currentQuarter * 3, 1)
    const lastDay = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'last_quarter') {
    const firstDay = new Date(today.getFullYear(), currentQuarter * 3 - 3, 1)
    const lastDay = new Date(today.getFullYear(), currentQuarter * 3, 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'year') {
    return { from: localDateString(new Date(today.getFullYear(), 0, 1)), to: localDateString(new Date(today.getFullYear(), 11, 31)) }
  }
  return { from: localDateString(new Date(today.getFullYear() - 1, 0, 1)), to: localDateString(new Date(today.getFullYear() - 1, 11, 31)) }
}
