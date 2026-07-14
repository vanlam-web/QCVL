import { createSupplierService, type SupplierApiRequester } from './supplier-service'

it('builds supplier list filters from existing supplier fields', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: SupplierApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createSupplierService({ request })

  await service.listSuppliers({
    search: 'nguyen',
    status: 'active',
    total_purchase_min: 100000,
    total_purchase_max: 900000,
    current_payable_min: 50000,
    current_payable_max: 300000,
    page: 2,
    page_size: 15,
  })

  expect(calls).toEqual([
    [
      '/api/v1/suppliers?q=nguyen&status=active&total_purchase_min=100000&total_purchase_max=900000&current_payable_min=50000&current_payable_max=300000&page=2&page_size=15',
      undefined,
    ],
  ])
})

it('sends supplier KiotViet xlsx base64 to server import endpoints', async () => {
  const calls: Array<[string, RequestInit | undefined]> = []
  const request: SupplierApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
    calls.push([path, init])
    return null as T
  }
  const service = createSupplierService({ request })
  const file = new File([new Uint8Array([1, 2, 3])], 'suppliers.xlsx')

  await service.previewKiotVietSupplierImport({ file })
  await service.importKiotVietSuppliers({ file })
  await service.deleteImportedKiotVietSuppliers()

  expect(calls).toEqual([
    [
      '/api/v1/suppliers/import/kiotviet/preview',
      {
        method: 'POST',
        body: JSON.stringify({
          file_name: 'suppliers.xlsx',
          file_base64: 'AQID',
        }),
      },
    ],
    [
      '/api/v1/suppliers/import/kiotviet',
      {
        method: 'POST',
        body: JSON.stringify({
          file_name: 'suppliers.xlsx',
          file_base64: 'AQID',
        }),
      },
    ],
    [
      '/api/v1/suppliers/import/kiotviet',
      {
        method: 'DELETE',
      },
    ],
  ])
})
