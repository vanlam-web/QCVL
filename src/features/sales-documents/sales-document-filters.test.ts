import { describe, expect, it, vi } from 'vitest'
import {
  allPaymentStatusFilters,
  allSalesDocumentStatusFilters,
  allSalesDocumentTypeFilters,
  buildSalesDocumentListRequest,
  currentMonthRange,
  defaultSalesDocumentStatusFilters,
  filterQuery,
  quickTimeRange,
  toggleFilterValue,
} from './sales-document-filters'

describe('sales document filters', () => {
  it('serializes multi-select filters only when selection is narrowed', () => {
    expect(filterQuery(allSalesDocumentTypeFilters, allSalesDocumentTypeFilters)).toBeUndefined()
    expect(filterQuery([], allSalesDocumentStatusFilters)).toBe('__none__')
    expect(filterQuery(['active'], allSalesDocumentStatusFilters)).toBe('active')
    expect(filterQuery(['unpaid', 'partial'], allPaymentStatusFilters)).toBe('unpaid,partial')
  })

  it('toggles selected filter values without mutating input', () => {
    const current = ['active', 'completed'] as const

    expect(toggleFilterValue(current, 'cancelled')).toEqual(['active', 'completed', 'cancelled'])
    expect(toggleFilterValue(current, 'active')).toEqual(['completed'])
    expect(current).toEqual(['active', 'completed'])
  })

  it('calculates local month range and quick presets', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T10:30:00+07:00'))

    expect(currentMonthRange()).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(quickTimeRange('today')).toEqual({ from: '2026-07-09', to: '2026-07-09' })
    expect(quickTimeRange('last_7_days')).toEqual({ from: '2026-07-03', to: '2026-07-09' })
    expect(quickTimeRange('all')).toEqual({ from: '', to: '' })

    vi.useRealTimers()
  })

  it('builds API request params from UI filter state', () => {
    const request = buildSalesDocumentListRequest({
      search: 'HD0001',
      type: ['invoice'],
      status: defaultSalesDocumentStatusFilters,
      paymentStatus: ['partial'],
      paymentMethod: 'bank_transfer',
      seller: 'seller-1',
      priceList: 'pl-1',
      time: 'custom',
      from: '2026-07-01',
      to: '2026-07-31',
      page: 2,
      page_size: 30,
    })

    expect(request).toEqual({
      search: 'HD0001',
      type: 'invoice',
      status: 'active,completed',
      payment_status: 'partial',
      payment_method: 'bank_transfer',
      created_by: 'seller-1',
      price_list_id: 'pl-1',
      from: '2026-07-01',
      to: '2026-07-31',
      page: 2,
      page_size: 30,
    })
  })
})
