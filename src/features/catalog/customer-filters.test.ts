import { describe, expect, it } from 'vitest'
import { buildCustomerListFilters, customerHistoryKey, numberFilterValue } from './customer-filters'

describe('customer filters', () => {
  it('parses numeric filter values safely', () => {
    expect(numberFilterValue('')).toBeUndefined()
    expect(numberFilterValue('  ')).toBeUndefined()
    expect(numberFilterValue('abc')).toBeUndefined()
    expect(numberFilterValue('120000')).toBe(120000)
  })

  it('builds list filters without all/empty values', () => {
    expect(buildCustomerListFilters({
      search: 'KH001',
      page: 2,
      page_size: 30,
      customerGroupId: 'all',
      createdFrom: '',
      createdTo: '2026-07-31',
      createdBy: 'seller-1',
      totalSalesMin: '100000',
      totalSalesMax: '',
      totalDebtMin: 'bad',
      totalDebtMax: '500000',
    })).toEqual({
      search: 'KH001',
      page: 2,
      page_size: 30,
      created_to: '2026-07-31',
      created_by: 'seller-1',
      total_sales_min: 100000,
      total_debt_max: 500000,
    })
  })

  it('creates stable history keys', () => {
    expect(customerHistoryKey('customer-1', 'invoice')).toBe('customer-1:invoice')
  })
})
