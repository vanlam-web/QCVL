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

export type PrintPathOptions = {
  returnTo?: 'pos' | 'sales-documents'
  /** Named template id or paper size (`a4` | `k80`). */
  template?: string | null
}

function withPrintQuery(path: string, options?: PrintPathOptions) {
  const params = new URLSearchParams()
  if (options?.returnTo === 'pos') params.set('returnTo', 'pos')
  if (options?.returnTo === 'sales-documents') params.set('returnTo', 'sales-documents')
  const template = options?.template?.trim()
  if (template) params.set('template', template)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function quotePrintPath(documentId: string, options?: PrintPathOptions) {
  return withPrintQuery(`${appRoutes.salesDocuments}/${encodeURIComponent(documentId)}/quote-print`, options)
}

export function invoicePrintPath(documentId: string, options?: PrintPathOptions) {
  return withPrintQuery(`${appRoutes.salesDocuments}/${encodeURIComponent(documentId)}/invoice-print`, options)
}
