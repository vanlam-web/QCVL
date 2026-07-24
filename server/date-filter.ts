export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function datePartsInBusinessTime(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`
}

function isOffsetInstant(value: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
}

export function businessDateKey(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : datePartsInBusinessTime(value)

  const trimmed = value.trim()
  const viMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (viMatch) return `${viMatch[3]}-${padDatePart(Number(viMatch[2]))}-${padDatePart(Number(viMatch[1]))}`

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch && !isOffsetInstant(trimmed)) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? '' : datePartsInBusinessTime(parsed)
}

export function displayDateKey(value: Date | string | null | undefined) {
  return businessDateKey(value)
}

export function displayDateRangeMatches(value: Date | string | null | undefined, from: string | null, to: string | null) {
  const date = businessDateKey(value)
  const fromDate = businessDateKey(from)
  const toDate = businessDateKey(to)
  if (!date) return false
  if (fromDate && date < fromDate) return false
  if (toDate && date > toDate) return false
  return true
}

export function businessDateSql(expression: string) {
  return `(${expression} at time zone '${BUSINESS_TIME_ZONE}')::date`
}

export function businessDayStartSql(datePlaceholder: string) {
  return `(${datePlaceholder}::date::timestamp at time zone '${BUSINESS_TIME_ZONE}')`
}

export function addBusinessDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return `${value.getUTCFullYear()}-${padDatePart(value.getUTCMonth() + 1)}-${padDatePart(value.getUTCDate())}`
}

export function businessMonthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}

export function parseBusinessTimeToUtc(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const localMs = Math.round((value - 25569) * 86400 * 1000)
    const utcMs = localMs - 7 * 3600 * 1000
    return new Date(utcMs).toISOString()
  }

  const trimmed = String(value).trim()
  if (!trimmed) return null

  if (isOffsetInstant(trimmed)) {
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const kvMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (kvMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = kvMatch
    const isoString = `${year}-${padDatePart(Number(month))}-${padDatePart(Number(day))}T${padDatePart(Number(hour))}:${padDatePart(Number(minute))}:${padDatePart(Number(second))}+07:00`
    const parsed = new Date(isoString)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const isoUnzonedMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (isoUnzonedMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = isoUnzonedMatch
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`
    const parsed = new Date(isoString)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const parsed = new Date(trimmed.includes('+') || trimmed.endsWith('Z') ? trimmed : `${trimmed}+07:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
