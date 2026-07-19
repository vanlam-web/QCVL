import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSystemDate, currentSystemISOString, resetSystemClockForTests, syncSystemClock } from './system-clock'

describe('system-clock', () => {
  beforeEach(() => {
    resetSystemClockForTests()
  })

  it('uses server time offset instead of raw browser time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    try {
      await syncSystemClock({
        async request<T>() {
          return { now: '2026-07-19T02:30:00.000Z' } as T
        },
      })

      expect(currentSystemISOString()).toBe('2026-07-19T02:30:00.000Z')
      expect(currentSystemDate().toISOString()).toBe('2026-07-19T02:30:00.000Z')
    } finally {
      vi.useRealTimers()
      resetSystemClockForTests()
    }
  })
})
