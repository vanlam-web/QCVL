function padDatePart(value: string) {
  return value.padStart(2, '0')
}

export function displayDateKey(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString().slice(0, 10)
  }

  const trimmed = value.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const viMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (viMatch) return `${viMatch[3]}-${padDatePart(viMatch[2])}-${padDatePart(viMatch[1])}`

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return trimmed.slice(0, 10)
}

export function displayDateRangeMatches(value: Date | string | null | undefined, from: string | null, to: string | null) {
  const date = displayDateKey(value)
  const fromDate = displayDateKey(from)
  const toDate = displayDateKey(to)
  if (!date) return false
  if (fromDate && date < fromDate) return false
  if (toDate && date > toDate) return false
  return true
}
