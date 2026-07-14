import { describe, expect, test } from 'vitest'
import { displayDateKey, displayDateRangeMatches } from './date-filter'

describe('display date filters', () => {
  test('uses the displayed ISO date without shifting timezone', () => {
    expect(displayDateKey('2026-07-12T17:30:00.000Z')).toBe('2026-07-12')
    expect(displayDateRangeMatches('2026-07-12T17:30:00.000Z', '2026-07-12', '2026-07-12')).toBe(true)
    expect(displayDateRangeMatches('2026-07-12T17:30:00.000Z', '2026-07-13', '2026-07-13')).toBe(false)
  })

  test('normalizes KiotViet dd/mm/yyyy dates before comparing', () => {
    expect(displayDateKey('13/07/2026 14:06')).toBe('2026-07-13')
    expect(displayDateRangeMatches('13/07/2026 14:06', '2026-07-13', '2026-07-13')).toBe(true)
    expect(displayDateRangeMatches('13/07/2026 14:06', '2026-07-14', '2026-07-14')).toBe(false)
  })
})
