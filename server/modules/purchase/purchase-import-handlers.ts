import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
import { applyKiotVietPurchaseReceiptImport, mapKiotVietPurchaseReceiptRows, previewKiotVietPurchaseReceiptImport, type PurchaseReceiptImportRepository } from './purchase-receipt-import.js'
import { applyKiotVietSupplierImport, mapKiotVietSupplierRows, previewKiotVietSupplierImport, type SupplierImportRepository } from './supplier-import.js'

type JsonBody = Record<string, unknown>
type ReadJson = (request: Request) => Promise<JsonBody>
type RowsFromBody = (body: JsonBody) => unknown[]
interface PurchaseImportHandlerContext { request: Request; currentUser: CurrentUserData; repository: ServerRepository; readJson: ReadJson; supplierRowsFromBody: RowsFromBody; receiptRowsFromBody: RowsFromBody }
export function createPurchaseImportHandlers(context: PurchaseImportHandlerContext) {
  const { request, currentUser, repository, readJson, supplierRowsFromBody, receiptRowsFromBody } = context
  const organizationId = currentUser.organization.id
  return {
    previewKiotVietSupplierImport: async (): RouteResult => { const body=await readJson(request); const mapped=mapKiotVietSupplierRows(supplierRowsFromBody(body) as never[]); return { found:true, data:await previewKiotVietSupplierImport({ organizationId, repository: repository as SupplierImportRepository, rows:mapped.valid, invalidRows:mapped.invalid }) } },
    importKiotVietSuppliers: async (): RouteResult => { const body=await readJson(request); const mapped=mapKiotVietSupplierRows(supplierRowsFromBody(body) as never[]); return { found:true, data:await applyKiotVietSupplierImport({ organizationId, repository: repository as SupplierImportRepository, rows:mapped.valid, invalidRows:mapped.invalid }) } },
    deleteImportedKiotVietSuppliers: async (): RouteResult => { const result=await (repository.deleteImportedKiotVietSuppliers ?? (async () => ({ deleted:0, blocked:0 })))({ organizationId }); return { found:true, data:{ deleted_rows:result.deleted, blocked_rows:result.blocked } } },
    previewKiotVietPurchaseReceiptImport: async (): RouteResult => { const body=await readJson(request); const mapped=mapKiotVietPurchaseReceiptRows(receiptRowsFromBody(body) as never[]); return { found:true, data:await previewKiotVietPurchaseReceiptImport({ organizationId, repository: repository as PurchaseReceiptImportRepository, rows:mapped.valid, invalidRows:mapped.invalid }) } },
    importKiotVietPurchaseReceipts: async (): RouteResult => { const body=await readJson(request); const mapped=mapKiotVietPurchaseReceiptRows(receiptRowsFromBody(body) as never[]); return { found:true, data:await applyKiotVietPurchaseReceiptImport({ organizationId, repository: repository as PurchaseReceiptImportRepository, rows:mapped.valid, invalidRows:mapped.invalid }) } },
    deleteImportedKiotVietPurchaseReceipts: async (): RouteResult => { const result=await repository.deleteImportedKiotVietPurchaseReceipts?.({ organizationId }) ?? { deleted:0, blocked:0 }; return { found:true, data:{ deleted_rows:result.deleted, blocked_rows:result.blocked } } },
  }
}
