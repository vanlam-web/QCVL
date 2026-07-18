import { describe, expect, test } from 'vitest'
import { appRoutes, quotePrintPath } from './routes'

describe('app route constants', () => {
  test('keeps public route paths stable', () => {
    expect(appRoutes).toMatchObject({
      login: '/login',
      dashboard: '/dashboard',
      pos: '/pos',
      admin: '/admin',
      products: '/products',
      priceBook: '/price-book',
      customers: '/customers',
      suppliers: '/suppliers',
      purchaseReceipts: '/purchase/receipts',
      purchaseReceiptCreate: '/purchase/receipts/new',
      inventory: '/inventory',
      finance: '/finance',
      reports: '/reports',
      salesDocuments: '/sales-documents',
      quotePrint: '/sales-documents/:id/quote-print',
      forbidden: '/forbidden',
    })
  })

  test('builds quote print URLs without leaking the route pattern token', () => {
    expect(quotePrintPath('quote-123')).toBe('/sales-documents/quote-123/quote-print')
  })
})
