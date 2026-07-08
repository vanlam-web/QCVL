import { describe, expect, it } from 'vitest'
import { createReportService } from './report-service'
import type { ReportApiRequester } from './report-service'

describe('report-service', () => {
  it('queries current APIs for report data', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: ReportApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { items: [], page: 1, page_size: 100, total: 0, summary: { opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 } } as T
    }
    const service = createReportService({ request })

    await service.listSalesDocuments({ from: '2026-07-05', to: '2026-07-05', page: 1, page_size: 100 })
    await service.listCashbook({ from: '2026-07-05', to: '2026-07-05', page: 1, page_size: 100 })
    await service.listCustomerDebts({ page: 1, page_size: 100 })
    await service.listInventoryProducts({ page: 1, page_size: 100 })

    expect(calls).toEqual([
      ['/api/v1/sales-documents?type=invoice&status=completed&from=2026-07-05&to=2026-07-05&page=1&page_size=100', undefined],
      ['/api/v1/finance/cashbook?from=2026-07-05&to=2026-07-05&page=1&page_size=100', undefined],
      ['/api/v1/finance/customer-debts?page=1&page_size=100', undefined],
      ['/api/v1/inventory/products?status=active&page=1&page_size=100', undefined],
    ])
  })
})
