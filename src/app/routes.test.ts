import { describe, expect, test } from 'vitest'
import { appRoutes, invoicePrintPath, quotePrintPath } from './routes'

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
      purchaseReceipts: '/receipts',
      purchaseReceiptCreate: '/receipts/new',
      inventory: '/inventory',
      finance: '/finance',
      reports: '/reports',
      salesDocuments: '/sales-documents',
      quotePrint: '/sales-documents/:id/quote-print',
      invoicePrint: '/sales-documents/:id/invoice-print',
      forbidden: '/forbidden',
    })
  })

  test('builds quote print URLs without leaking the route pattern token', () => {
    expect(quotePrintPath('quote-123')).toBe('/sales-documents/quote-123/quote-print')
    expect(quotePrintPath('quote-123', { returnTo: 'pos', template: 'tpl-quote-k80' })).toBe(
      '/sales-documents/quote-123/quote-print?returnTo=pos&template=tpl-quote-k80',
    )
  })

  test('builds invoice print URLs and optional POS return / template', () => {
    expect(invoicePrintPath('invoice-1')).toBe('/sales-documents/invoice-1/invoice-print')
    expect(invoicePrintPath('invoice-1', { returnTo: 'pos' })).toBe('/sales-documents/invoice-1/invoice-print?returnTo=pos')
    expect(invoicePrintPath('invoice-1', { returnTo: 'pos', template: 'k80' })).toBe(
      '/sales-documents/invoice-1/invoice-print?returnTo=pos&template=k80',
    )
  })
})
