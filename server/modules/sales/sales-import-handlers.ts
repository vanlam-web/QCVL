import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
import { applyKiotVietInvoiceImport, mapKiotVietInvoiceRows, previewKiotVietInvoiceImport, type InvoiceImportRepository } from './kiotviet-invoice-import.js'

type JsonBody = Record<string, unknown>
type ReadJson = (request: Request) => Promise<JsonBody>
type RowsFromBody = (body: JsonBody) => unknown[]

interface SalesImportHandlerContext {
  request: Request
  currentUser: CurrentUserData
  repository: ServerRepository
  readJson: ReadJson
  rowsFromBody: RowsFromBody
}

export function createSalesImportHandlers(context: SalesImportHandlerContext) {
  const { request, currentUser, repository, readJson, rowsFromBody } = context
  const organizationId = currentUser.organization.id
  const readMappedRows = async () => {
    const body = await readJson(request)
    return mapKiotVietInvoiceRows(rowsFromBody(body) as never[])
  }
  return {
    previewKiotVietInvoiceImport: async (): RouteResult => {
      const mapped = await readMappedRows()
      return { found: true, data: await previewKiotVietInvoiceImport({ organizationId, repository: repository as InvoiceImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
    importKiotVietInvoices: async (): RouteResult => {
      const mapped = await readMappedRows()
      return { found: true, data: await applyKiotVietInvoiceImport({ organizationId, repository: repository as InvoiceImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
    deleteImportedKiotVietInvoices: async (): RouteResult => {
      const result = await repository.deleteImportedKiotVietInvoices?.({ organizationId }) ?? { deleted: 0, blocked: 0 }
      return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
    },
  }
}
