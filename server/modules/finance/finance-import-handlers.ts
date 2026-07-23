import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
import { mapKiotVietCashbookRows, applyKiotVietCashbookImport, previewKiotVietCashbookImport, type CashbookImportRepository } from './kiotviet-cashbook-import.js'
import { mapKiotVietCustomerDebtAdjustmentRows, applyKiotVietCustomerDebtAdjustmentImport, previewKiotVietCustomerDebtAdjustmentImport, type CustomerDebtAdjustmentImportRepository } from './kiotviet-customer-debt-adjustment-import.js'

type JsonBody = Record<string, unknown>
type ReadJson = (request: Request) => Promise<JsonBody>
type RowsFromBody = (body: JsonBody) => unknown[]

interface FinanceImportHandlerContext {
  request: Request
  currentUser: CurrentUserData
  repository: ServerRepository
  readJson: ReadJson
  cashbookRowsFromBody: RowsFromBody
  customerDebtAdjustmentRowsFromBody: RowsFromBody
}

export function createFinanceImportHandlers(context: FinanceImportHandlerContext) {
  const { request, currentUser, repository, readJson, cashbookRowsFromBody, customerDebtAdjustmentRowsFromBody } = context
  const organizationId = currentUser.organization.id
  const readCashbook = async () => {
    const body = await readJson(request)
    return { body, mapped: mapKiotVietCashbookRows(cashbookRowsFromBody(body) as never[]) }
  }
  const readCustomerDebtAdjustment = async () => {
    const body = await readJson(request)
    const mapped = mapKiotVietCustomerDebtAdjustmentRows(customerDebtAdjustmentRowsFromBody(body) as never[], {
      sourceFile: typeof body.source_file === 'string' ? body.source_file : typeof body.file_name === 'string' ? body.file_name : null,
    })
    return { body, mapped }
  }
  return {
    previewKiotVietCashbookImport: async (): RouteResult => {
      const { mapped } = await readCashbook()
      return { found: true, data: await previewKiotVietCashbookImport({ organizationId, repository: repository as CashbookImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
    importKiotVietCashbook: async (): RouteResult => {
      const { mapped } = await readCashbook()
      return { found: true, data: await applyKiotVietCashbookImport({ organizationId, repository: repository as CashbookImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
    deleteImportedKiotVietCashbook: async (): RouteResult => {
      const result = await repository.deleteImportedKiotVietCashbook?.({ organizationId }) ?? { deleted: 0, blocked: 0 }
      return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
    },
    previewKiotVietCustomerDebtAdjustmentImport: async (): RouteResult => {
      const { mapped } = await readCustomerDebtAdjustment()
      return { found: true, data: await previewKiotVietCustomerDebtAdjustmentImport({ organizationId, repository: repository as CustomerDebtAdjustmentImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
    importKiotVietCustomerDebtAdjustments: async (): RouteResult => {
      const { mapped } = await readCustomerDebtAdjustment()
      return { found: true, data: await applyKiotVietCustomerDebtAdjustmentImport({ organizationId, repository: repository as CustomerDebtAdjustmentImportRepository, rows: mapped.valid, invalidRows: mapped.invalid }) }
    },
  }
}
