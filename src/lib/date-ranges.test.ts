import { describe, expect, it, vi } from 'vitest'
import {
  currentMonthRange,
  dateRangeFromItems,
  displayDateRangeForData,
  localDateString,
  normalizeDateInput,
  quickDateRange,
  toDisplayDateInput,
} from './date-ranges'

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

  it('formats and normalizes KV-style date inputs', () => {
    expect(toDisplayDateInput('2026-07-31')).toBe('31/07/2026')
    expect(toDisplayDateInput('')).toBe('')
    expect(normalizeDateInput('31/07/2026')).toBe('2026-07-31')
    expect(normalizeDateInput('2026-07-31')).toBe('2026-07-31')
    expect(normalizeDateInput('31/13/2026')).toBeNull()
  })

  it('finds the min and max date keys from list items', () => {
    const range = dateRangeFromItems([
      { created_at: '2026-07-14T09:30:00Z' },
      { created_at: '2026-07-01T02:00:00Z' },
      { created_at: '' },
      { created_at: 'not-date' },
      { created_at: '2026-07-09T12:00:00Z' },
    ], (item) => item.created_at)

    expect(range).toEqual({ from: '2026-07-01', to: '2026-07-14' })
  })

  it('clips visible current-period ranges to today and uses data dates for all time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:30:00+07:00'))

    expect(displayDateRangeForData(
      { from: '2026-07-01', to: '2026-07-31' },
      { from: '2026-07-01', to: '2026-07-12' },
    )).toEqual({ from: '2026-07-01', to: '2026-07-14' })

    expect(displayDateRangeForData(
      { from: '', to: '' },
      { from: '2026-06-01', to: '2026-07-14' },
    )).toEqual({ from: '2026-06-01', to: '2026-07-14' })

    vi.useRealTimers()
  })
})
