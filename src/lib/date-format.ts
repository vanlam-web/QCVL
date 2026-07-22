export type DateInput = Date | string | null | undefined

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function isValidCivilDate(year: number, month: number, day: number) {
  const local = new Date(year, month - 1, day)
  return local.getFullYear() === year && local.getMonth() === month - 1 && local.getDate() === day
}

export function displayDateKey(value: DateInput) {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString().slice(0, 10)
  }

  const trimmed = value.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const kvMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (kvMatch) return `${kvMatch[3]}-${padDatePart(Number(kvMatch[2]))}-${padDatePart(Number(kvMatch[1]))}`

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function parseDateTimeParts(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/)
  if (isoMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00', millis = '0'] = isoMatch
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(`${millis}`.padEnd(3, '0').slice(0, 3)),
    )
  }

  const kvMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (kvMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = kvMatch
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0,
    )
  }

  return null
}

export function parseDateTimeValue(value: DateInput) {
  if (!value) return null
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? null : time
  }

  const trimmed = value.trim()
  const parsed = parseDateTimeParts(trimmed)
  if (parsed !== null) return parsed
  const fallback = Date.parse(trimmed)
  return Number.isNaN(fallback) ? null : fallback
}

export function parseKvDateTimeInputToIso(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return null
  const kvMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  const localInputMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})$/)
  if (!kvMatch && !localInputMatch) return null
  const day = kvMatch?.[1] ?? localInputMatch?.[3] ?? ''
  const month = kvMatch?.[2] ?? localInputMatch?.[2] ?? ''
  const year = kvMatch?.[3] ?? localInputMatch?.[1] ?? ''
  const hour = kvMatch?.[4] ?? localInputMatch?.[4] ?? ''
  const minute = kvMatch?.[5] ?? localInputMatch?.[5] ?? ''
  const dayNumber = Number(day)
  const monthNumber = Number(month)
  const yearNumber = Number(year)
  const hourNumber = Number(hour)
  const minuteNumber = Number(minute)
  if (monthNumber < 1 || monthNumber > 12) return null
  if (dayNumber < 1 || dayNumber > 31) return null
  if (hourNumber < 0 || hourNumber > 23) return null
  if (minuteNumber < 0 || minuteNumber > 59) return null
  if (!isValidCivilDate(yearNumber, monthNumber, dayNumber)) return null
  return `${year}-${padDatePart(monthNumber)}-${padDatePart(dayNumber)}T${padDatePart(hourNumber)}:${minute}:00.000Z`
}

export function parseQcvDateTimeInputToLocalDate(value: string | null | undefined) {
  const storedIso = parseKvDateTimeInputToIso(value)
  if (!storedIso) return null
  const match = storedIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
}

function dateParts(value: DateInput) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return {
      day: padDatePart(value.getDate()),
      month: padDatePart(value.getMonth() + 1),
      year: String(value.getFullYear()),
      hour: padDatePart(value.getHours()),
      minute: padDatePart(value.getMinutes()),
    }
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (match) {
    const [, year, month, day, hour = '00', minute = '00'] = match
    return { day, month, year, hour, minute }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const iso = parsed.toISOString()
  const fallbackMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!fallbackMatch) return null
  const [, year, month, day, hour, minute] = fallbackMatch
  return { day, month, year, hour, minute }
}

export function formatKvDateTime(value: DateInput, fallback = '') {
  const parts = dateParts(value)
  if (!parts) return fallback
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

export function formatKvDate(value: DateInput, fallback = '') {
  const parts = dateParts(value)
  if (!parts) return fallback
  return `${parts.day}/${parts.month}/${parts.year}`
}

export function dateTimeLocalInputValue(value: Date) {
  return [
    value.getFullYear(),
    '-',
    padDatePart(value.getMonth() + 1),
    '-',
    padDatePart(value.getDate()),
    'T',
    padDatePart(value.getHours()),
    ':',
    padDatePart(value.getMinutes()),
  ].join('')
}

export function dateTimeIsoFromLocalClock(value: Date) {
  return [
    value.getFullYear(),
    '-',
    padDatePart(value.getMonth() + 1),
    '-',
    padDatePart(value.getDate()),
    'T',
    padDatePart(value.getHours()),
    ':',
    padDatePart(value.getMinutes()),
    ':00.000Z',
  ].join('')
}

export const formatQcvDateTime = formatKvDateTime
export const formatQcvDate = formatKvDate
export const parseQcvDateTimeInputToStoredIso = parseKvDateTimeInputToIso
export const dateTimeStoredIsoFromLocalClock = dateTimeIsoFromLocalClock
