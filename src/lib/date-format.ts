type DateInput = Date | string | null | undefined

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
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
