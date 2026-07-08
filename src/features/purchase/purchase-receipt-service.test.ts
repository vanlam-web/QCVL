import { createPurchaseReceiptService, type PurchaseReceiptApiRequester } from './purchase-receipt-service'

it('builds purchase receipt list filters from existing purchase fields', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: PurchaseReceiptApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createPurchaseReceiptService({ request })

  await service.listReceipts({
    search: 'HD-NCC-001',
    status: 'posted',
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    created_by: 'user-1',
    page: 2,
    page_size: 15,
  })

  expect(calls).toEqual([
    [
      '/api/v1/purchase/receipts?q=HD-NCC-001&status=posted&date_from=2026-07-01&date_to=2026-07-31&created_by=user-1&page=2&page_size=15',
      undefined,
    ],
  ])
})
