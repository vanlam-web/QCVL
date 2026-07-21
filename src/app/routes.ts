export const appRoutes = {
  login: '/login',
  dashboard: '/dashboard',
  account: '/account',
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
} as const

export function quotePrintPath(documentId: string) {
  return `${appRoutes.salesDocuments}/${encodeURIComponent(documentId)}/quote-print`
}

export function invoicePrintPath(documentId: string, options?: { returnTo?: 'pos' | 'sales-documents' }) {
  const path = `${appRoutes.salesDocuments}/${encodeURIComponent(documentId)}/invoice-print`
  if (options?.returnTo === 'pos') return `${path}?returnTo=pos`
  return path
}
