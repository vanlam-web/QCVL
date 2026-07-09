import { describe, expect, it, vi } from 'vitest'
import { currentMonthRange, localDateString, purchaseReceiptTimeQuickOptions } from './purchase-receipt-filters'

describe('purchase receipt filters', () => {
  it('builds quick date options', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T10:30:00+07:00'))

    expect(localDateString(new Date())).toBe('2026-07-09')
    expect(currentMonthRange()).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(purchaseReceiptTimeQuickOptions()).toEqual([
      { id: 'all', label: 'Toàn thời gian', from: '', to: '' },
      { id: 'today', label: 'Hôm nay', from: '2026-07-09', to: '2026-07-09' },
      { id: 'this-month', label: 'Tháng này', from: '2026-07-01', to: '2026-07-31' },
    ])

    vi.useRealTimers()
  })
})
