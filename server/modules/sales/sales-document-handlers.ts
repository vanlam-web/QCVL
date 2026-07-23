import type { CashbookEntryData, CurrentUserData, ProductListData, SalesDocumentData, ServerRepository } from '../../http.js'
type PagedResult<T> = { items: T[]; page: number; page_size: number; total: number }
type SalesDocumentHandlerDeps = {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
  path: string
  getIdFromPath(path: string): string | undefined
  sortSalesDocumentsForRequest(items: SalesDocumentData[], url: URL): SalesDocumentData[]
  paged<T>(items: T[], page: number, pageSize: number): PagedResult<T>
  salesDocumentListSummary(items: SalesDocumentData[]): unknown
  filterSalesDocuments(url: URL): SalesDocumentData[]
  salesDocuments: SalesDocumentData[]
  makeSalesDocumentDetail(document: SalesDocumentData, products?: ProductListData[]): unknown
  salesDocumentProductCatalog(repository: ServerRepository, organizationId: string, document: SalesDocumentData): Promise<ProductListData[]>
  readJson(request: Request): Promise<Record<string, unknown>>
  optionalIsoDateTime(value: unknown, field: string): string | undefined
  nullableString(value: unknown): string | null
  cashbookEntries: CashbookEntryData[]
  sameSalePaymentReceiptBaseCode(code: string): string | null
  isSameSalePaymentReceiptCode(entryCode: string, orderCode: string): boolean
  validation(message: string): Error
}
export function createSalesDocumentHandlers(deps:SalesDocumentHandlerDeps){const {request,url,currentUser,repository,path,getIdFromPath,sortSalesDocumentsForRequest,paged,salesDocumentListSummary,filterSalesDocuments,salesDocuments,makeSalesDocumentDetail,salesDocumentProductCatalog,readJson,optionalIsoDateTime,nullableString,cashbookEntries,sameSalePaymentReceiptBaseCode,isSameSalePaymentReceiptCode,validation}=deps;return{
    listSalesDocuments: async () => {
      const page = Number(url.searchParams.get('page') ?? '1')
      const pageSize = Number(url.searchParams.get('page_size') ?? '20')
      if (repository.listSalesDocumentsPage && !url.searchParams.get('sort_key')) {
        const result = await repository.listSalesDocumentsPage({ organizationId: currentUser.organization.id, url })
        return {
          found: true,
          data: {
            items: result.items,
            page,
            page_size: pageSize,
            total: result.total,
            summary: result.summary,
          },
        }
      }
      if (repository.listSalesDocuments) {
        const items = sortSalesDocumentsForRequest(await repository.listSalesDocuments({ organizationId: currentUser.organization.id, url }), url)
        return { found: true, data: { ...paged(items, page, pageSize), summary: salesDocumentListSummary(items) } }
      }
      const items = sortSalesDocumentsForRequest(filterSalesDocuments(url), url)
      return { found: true, data: { ...paged(items, page, pageSize), summary: salesDocumentListSummary(items) } }
    },
    getSalesDocument: async () => {
      const id = getIdFromPath(path) ?? ''
      if (repository.getSalesDocument) {
        const document = await repository.getSalesDocument({ organizationId: currentUser.organization.id, id })
        if (!document) return { found: true, data: { message: 'Sales document not found' }, status: 404 }
        return { found: true, data: makeSalesDocumentDetail(document, await salesDocumentProductCatalog(repository, currentUser.organization.id, document)) }
      }
      const document = salesDocuments.find((item: SalesDocumentData) => item.id === id || item.code === id)
      if (!document) return { found: true, data: { message: 'Sales document not found' }, status: 404 }
      return { found: true, data: makeSalesDocumentDetail(document) }
    },
    updateSalesDocument: async () => {
      const id = getIdFromPath(path) ?? ''
      const body = await readJson(request)
      const createdAt = optionalIsoDateTime(body.created_at, 'created_at')
      if ((body.note !== undefined || createdAt !== undefined) && body.status === undefined) {
        if (repository.updateSalesDocumentNote) {
          const document = await repository.updateSalesDocumentNote({
            organizationId: currentUser.organization.id,
            id,
            ...(body.note !== undefined ? { note: nullableString(body.note) } : {}),
            ...(createdAt !== undefined ? { created_at: createdAt } : {}),
          })
          if (!document) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
          return { found: true, data: makeSalesDocumentDetail(document, await salesDocumentProductCatalog(repository, currentUser.organization.id, document)) }
        }
        const index = salesDocuments.findIndex((document: SalesDocumentData) => document.id === id || document.code === id)
        if (index < 0) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
        const updatedDocument = {
          ...salesDocuments[index],
          ...(body.note !== undefined ? { note: nullableString(body.note) ?? '' } : {}),
          ...(createdAt !== undefined ? { created_at: createdAt } : {}),
        }
        salesDocuments[index] = updatedDocument
        if (createdAt !== undefined) {
          const sameSaleReceiptBase = sameSalePaymentReceiptBaseCode(updatedDocument.code)
          for (const entry of cashbookEntries) {
            const matchesOrder = entry.source?.order_code === updatedDocument.code
              || (entry.allocations ?? []).some((allocation: NonNullable<CashbookEntryData['allocations']>[number]) => allocation.order_id === updatedDocument.id || allocation.order_code === updatedDocument.code)
            const isSameSaleReceipt = sameSaleReceiptBase
              ? isSameSalePaymentReceiptCode(entry.code, updatedDocument.code)
              : false
            if (matchesOrder && isSameSaleReceipt) entry.created_at = createdAt
          }
        }
        return { found: true, data: makeSalesDocumentDetail(salesDocuments[index]) }
      }
      if (body.status !== 'cancelled' || body.note !== undefined || body.created_at !== undefined) {
        throw validation('Only sales document cancellation or note update is supported.')
      }
      const cancelReasonType = typeof body.cancel_reason_type === 'string' ? body.cancel_reason_type.trim() : ''
      const cancelReasonNote = nullableString(body.cancel_reason_note)
      if (!['wrong_price', 'wrong_size', 'wrong_customer', 'customer_changed_mind', 'other'].includes(cancelReasonType)) {
        throw validation('Vui lòng chọn lý do hủy hóa đơn.')
      }
      if (cancelReasonType === 'other' && !cancelReasonNote?.trim()) {
        throw validation('Vui lòng nhập ghi chú cho lý do Khác.')
      }
      if (repository.cancelSalesDocument) {
        try {
          const document = await repository.cancelSalesDocument({ organizationId: currentUser.organization.id, id, reason: { code: cancelReasonType, note: cancelReasonNote } })
          if (!document) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
          return { found: true, data: makeSalesDocumentDetail(document, await salesDocumentProductCatalog(repository, currentUser.organization.id, document)) }
        } catch (error) {
          if (error instanceof Error && error.message === 'SALES_DOCUMENT_SHARED_PAYMENT_REQUIRES_ALLOCATION_REVERSAL') {
            throw validation('Phiếu thu đang phân bổ cho nhiều hóa đơn. Cần đảo phân bổ riêng trước khi hủy.')
          }
          throw error
        }
      }
      const index = salesDocuments.findIndex((document: SalesDocumentData) => document.id === id || document.code === id)
      if (index < 0) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
      salesDocuments[index] = { ...salesDocuments[index], status: 'cancelled' }
      return { found: true, data: makeSalesDocumentDetail(salesDocuments[index]) }
    },
  }}
