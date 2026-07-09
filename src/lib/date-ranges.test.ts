import { describe, expect, it, vi } from 'vitest'
import { currentMonthRange, localDateString, quickDateRange } from './date-ranges'

describe('date-ranges', () => {
  it('formats local dates as yyyy-mm-dd', () => {
    expect(localDateString(new Date('2026-07-09T10:30:00+07:00'))).toBe('2026-07-09')
  })

  it('returns current month boundaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T10:30:00+07:00'))

    expect(currentMonthRange()).toEqual({ from: '2026-07-01', to: '2026-07-31' })

    vi.useRealTimers()
  })

  it('returns common quick date ranges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T10:30:00+07:00'))

    expect(quickDateRange('today')).toEqual({ from: '2026-07-09', to: '2026-07-09' })
    expect(quickDateRange('yesterday')).toEqual({ from: '2026-07-08', to: '2026-07-08' })
    expect(quickDateRange('week')).toEqual({ from: '2026-07-06', to: '2026-07-12' })
    expect(quickDateRange('last_7_days')).toEqual({ from: '2026-07-03', to: '2026-07-09' })
    expect(quickDateRange('month')).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(quickDateRange('all')).toEqual({ from: '', to: '' })

    vi.useRealTimers()
  })
})
