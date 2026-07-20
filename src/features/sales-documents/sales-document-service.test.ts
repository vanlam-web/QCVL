import { createSalesDocumentService } from './sales-document-service'
import type { SalesDocumentApiRequester } from './sales-document-service'

it('serializes supported sales document filter params', async () => {
  const request = vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 }))
  const api = { request: request as unknown as SalesDocumentApiRequester['request'] }
  const service = createSalesDocumentService(api)

  await service.listSalesDocuments({
    status: 'completed',
    payment_status: 'paid',
    payment_method: 'bank_transfer',
    created_by: 'seller-1',
    price_list_id: 'pl-1',
    page: 1,
    page_size: 15,
  })

  expect(request).toHaveBeenCalledWith(
    '/api/v1/sales-documents?status=completed&payment_status=paid&payment_method=bank_transfer&created_by=seller-1&price_list_id=pl-1&page=1&page_size=15&sort_key=created_at&sort_direction=desc',
  )
})

it('updates sales document created time through the quick save endpoint', async () => {
  const request = vi.fn(async () => ({ id: 'order-1', created_at: '2026-07-18T04:15:00.000Z' }))
  const api = { request: request as unknown as SalesDocumentApiRequester['request'] }
  const service = createSalesDocumentService(api)

  await service.updateSalesDocumentNote('order-1', { note: 'Ghi chú mới', created_at: '2026-07-18T04:15:00.000Z' })

  expect(request).toHaveBeenCalledWith('/api/v1/sales-documents/order-1', {
    method: 'PATCH',
    body: JSON.stringify({ note: 'Ghi chú mới', created_at: '2026-07-18T04:15:00.000Z' }),
  })
})

it('calls KiotViet invoice import endpoints', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: SalesDocumentApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createSalesDocumentService({ request })
  const file = new File([new Uint8Array([1, 2, 3])], 'DanhSachChiTietHoaDon.xlsx')

  await service.previewKiotVietInvoiceImport({ file })
  await service.importKiotVietInvoices({ file })
  await service.deleteImportedKiotVietInvoices()

  expect(calls.map(([path, init]) => [path, init?.method])).toEqual([
    ['/api/v1/sales-documents/import/kiotviet/preview', 'POST'],
    ['/api/v1/sales-documents/import/kiotviet', 'POST'],
    ['/api/v1/sales-documents/import/kiotviet', 'DELETE'],
  ])
})

it('cancels a sales document with status cancelled', async () => {
  const request = vi.fn(async () => ({ id: 'order-1', status: 'cancelled' }))
  const api = { request: request as unknown as SalesDocumentApiRequester['request'] }
  const service = createSalesDocumentService(api)

  await service.cancelSalesDocument('order-1')

  expect(request).toHaveBeenCalledWith('/api/v1/sales-documents/order-1', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
  })
})

it('updates a sales document note', async () => {
  const request = vi.fn(async () => ({ id: 'order-1', note: 'Ghi chú mới' }))
  const api = { request: request as unknown as SalesDocumentApiRequester['request'] }
  const service = createSalesDocumentService(api)

  await service.updateSalesDocumentNote('order-1', { note: 'Ghi chú mới' })

  expect(request).toHaveBeenCalledWith('/api/v1/sales-documents/order-1', {
    method: 'PATCH',
    body: JSON.stringify({ note: 'Ghi chú mới' }),
  })
})
