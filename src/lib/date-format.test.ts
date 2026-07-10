import { describe, expect, it } from 'vitest'
import { formatKvDate, formatKvDateTime } from './date-format'

describe('date format', () => {
  it('formats date time like KiotViet without shifting the source clock', () => {
    expect(formatKvDateTime('2026-06-05T07:52:12.640Z')).toBe('05/06/2026 07:52')
    expect(formatKvDateTime('2026-07-09T03:00:00Z')).toBe('09/07/2026 03:00')
  })

  it('formats date only like KiotViet without shifting the source day', () => {
    expect(formatKvDate('2026-06-30T17:08:00Z')).toBe('30/06/2026')
  })

  it('formats Date objects from the local clock for live POS timestamps', () => {
    expect(formatKvDateTime(new Date('2026-07-09T03:00:00Z'))).toBe('09/07/2026 10:00')
  })

  it('uses fallback for empty or invalid values', () => {
    expect(formatKvDateTime(null)).toBe('Chưa có')
    expect(formatKvDateTime('bad-date', '-')).toBe('-')
    expect(formatKvDate('bad-date', '-')).toBe('-')
  })
})
