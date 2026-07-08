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
    '/api/v1/sales-documents?status=completed&payment_status=paid&payment_method=bank_transfer&created_by=seller-1&price_list_id=pl-1&page=1&page_size=15',
  )
})
