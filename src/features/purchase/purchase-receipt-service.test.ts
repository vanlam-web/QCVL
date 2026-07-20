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
      '/api/v1/purchase/receipts?q=HD-NCC-001&status=posted&date_from=2026-07-01&date_to=2026-07-31&created_by=user-1&page=2&page_size=15&sort_key=received_at&sort_direction=desc',
      undefined,
    ],
  ])
})

it('builds purchase product search requests with search params', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: PurchaseReceiptApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createPurchaseReceiptService({ request })

  await service.listProducts({ search: 'SP0001', page: 1, page_size: 20 })

  expect(calls).toEqual([
    ['/api/v1/products?status=active&search=SP0001&page=1&page_size=20', undefined],
  ])
})

it('calls KiotViet purchase receipt import endpoints', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: PurchaseReceiptApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createPurchaseReceiptService({ request })
  const file = new File([new Uint8Array([1, 2, 3])], 'DanhSachChiTietNhapHang.xlsx')

  await service.previewKiotVietPurchaseReceiptImport({ file })
  await service.importKiotVietPurchaseReceipts({ file })
  await service.deleteImportedKiotVietPurchaseReceipts()

  expect(calls.map(([path, init]) => [path, init?.method])).toEqual([
    ['/api/v1/purchase/receipts/import/kiotviet/preview', 'POST'],
    ['/api/v1/purchase/receipts/import/kiotviet', 'POST'],
    ['/api/v1/purchase/receipts/import/kiotviet', 'DELETE'],
  ])
})
