type DateInput = Date | string | null | undefined

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
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
