import { describe, expect, it, vi } from 'vitest'
import {
  cashbookEntryMatchesFundMode,
  cashbookEntryMatchesSearch,
  cashbookQuickTimeRange,
  dateTimeInputText,
  directionFilterFromSelection,
  formatVoucherAmountInput,
  nextDirectionSelection,
  nextStatusSelection,
  parseVoucherAmountInput,
  statusFilterFromSelection,
} from './finance-filters'
import type { CashbookEntry } from './types'

const entry = {
  id: 'entry-1',
  code: 'PT0001',
  status: 'posted',
  direction: 'in',
  amount_delta: 100000,
  finance_account: { id: 'bank-1', code: 'VCB', name: 'Vietcombank', account_type: 'bank' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-09T03:00:00Z',
  note: 'Thu tien khach',
  counterparty: { type: 'customer', name: 'Nguyễn Văn A', phone: '0909000000' },
} satisfies CashbookEntry

describe('finance filters', () => {
  it('matches search without Vietnamese accents and fund mode', () => {
    expect(cashbookEntryMatchesSearch(entry, 'nguyen')).toBe(true)
    expect(cashbookEntryMatchesSearch(entry, 'vcb')).toBe(true)
    expect(cashbookEntryMatchesSearch(entry, 'khong-co')).toBe(false)
    expect(cashbookEntryMatchesFundMode(entry, 'bank', '')).toBe(true)
    expect(cashbookEntryMatchesFundMode(entry, 'cash', '')).toBe(false)
    expect(cashbookEntryMatchesFundMode(entry, 'cash', 'bank-1')).toBe(true)
  })

  it('maps selection arrays to API filter values', () => {
    expect(nextDirectionSelection(['in'], 'out')).toEqual(['in', 'out'])
    expect(nextDirectionSelection(['in'], 'in')).toEqual([])
    expect(directionFilterFromSelection(['out'])).toBe('out')
    expect(directionFilterFromSelection(['in', 'out'])).toBe('all')
    expect(nextStatusSelection(['posted'], 'posted')).toEqual([])
    expect(statusFilterFromSelection(['cancelled'])).toBe('cancelled')
  })

  it('formats voucher amount and quick dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T10:30:00+07:00'))

    expect(formatVoucherAmountInput('1a200000')).toBe('1 200 000')
    expect(parseVoucherAmountInput('1.200.000')).toBe(1200000)
    expect(cashbookQuickTimeRange('today')).toEqual({ from: '2026-07-09', to: '2026-07-09' })
    expect(dateTimeInputText(new Date('2026-07-09T10:30:00+07:00'))).toMatch(/09\/07\/2026/)

    vi.useRealTimers()
  })
})
