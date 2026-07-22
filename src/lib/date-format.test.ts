import { describe, expect, it } from 'vitest'
import {
  dateTimeStoredIsoFromLocalClock,
  dateTimeLocalInputValue,
  displayDateKey,
  formatQcvDate,
  formatQcvDateTime,
  parseDateTimeValue,
  parseQcvDateTimeInputToLocalDate,
  parseQcvDateTimeInputToStoredIso,
} from './date-format'

describe('date format', () => {
  it('formats date time like KiotViet without shifting the source clock', () => {
    expect(formatQcvDateTime('2026-06-05T07:52:12.640Z')).toBe('05/06/2026 07:52')
    expect(formatQcvDateTime('2026-07-09T03:00:00Z')).toBe('09/07/2026 03:00')
  })

  it('formats date only like KiotViet without shifting the source day', () => {
    expect(formatQcvDate('2026-06-30T17:08:00Z')).toBe('30/06/2026')
  })

  it('extracts displayed date keys without applying browser timezone', () => {
    expect(displayDateKey('2026-07-11T17:24:14.633Z')).toBe('2026-07-11')
    expect(displayDateKey('12/07/2026 00:24')).toBe('2026-07-12')
  })

  it('formats Date objects from the local clock for live POS timestamps', () => {
    expect(formatQcvDateTime(new Date('2026-07-09T03:00:00Z'))).toBe('09/07/2026 10:00')
  })

  it('uses fallback for empty or invalid values', () => {
    expect(formatQcvDateTime(null)).toBe('')
    expect(formatQcvDateTime('bad-date', '-')).toBe('-')
    expect(formatQcvDate('bad-date', '-')).toBe('-')
  })

  it('formats datetime-local values with the same local clock parts', () => {
    expect(dateTimeLocalInputValue(new Date(2026, 6, 9, 10, 30))).toBe('2026-07-09T10:30')
  })

  it('stores local clock datetime text without timezone shifting it', () => {
    expect(dateTimeStoredIsoFromLocalClock(new Date(2026, 6, 15, 9, 25))).toBe('2026-07-15T09:25:00.000Z')
  })

  it('parses ISO and KV datetime strings to the same timestamp basis', () => {
    expect(parseDateTimeValue('2026-07-14T14:18:00.000Z')).toBe(Date.parse('2026-07-14T14:18:00.000Z'))
    expect(parseDateTimeValue('14/07/2026 14:18')).toBe(Date.UTC(2026, 6, 14, 14, 18))
  })

  it('parses KV datetime input to the stored timestamp shape without timezone math', () => {
    expect(parseQcvDateTimeInputToStoredIso('18/07/2026 4:15')).toBe('2026-07-18T04:15:00.000Z')
    expect(parseQcvDateTimeInputToStoredIso('18/07/2026 04:15')).toBe('2026-07-18T04:15:00.000Z')
    expect(parseQcvDateTimeInputToStoredIso('2026-07-18T04:15')).toBe('2026-07-18T04:15:00.000Z')
    expect(parseQcvDateTimeInputToStoredIso('31/02/2026 04:15')).toBeNull()
    expect(parseQcvDateTimeInputToStoredIso('bad-date')).toBeNull()
  })

  it('parses QCVL datetime input to a local Date for date pickers', () => {
    const parsed = parseQcvDateTimeInputToLocalDate('18/07/2026 04:15')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(6)
    expect(parsed?.getDate()).toBe(18)
    expect(parsed?.getHours()).toBe(4)
    expect(parsed?.getMinutes()).toBe(15)
  })
})
