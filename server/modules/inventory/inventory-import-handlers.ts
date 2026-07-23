import { HttpError } from '../../http-response.js'
import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
import {
  mapKiotVietStocktakeRows,
  previewKiotVietStocktakeImport,
  type KiotVietRawStocktakeRow,
} from './kiotviet-stocktake-import.js'

type JsonBody = Record<string, unknown>
type ReadJson = (request: Request) => Promise<JsonBody>
type RowsFromBody = (body: JsonBody) => unknown[]

export interface InventoryImportHandlerContext {
  request: Request
  currentUser: CurrentUserData
  repository: ServerRepository
  readJson: ReadJson
  rowsFromBody: RowsFromBody
}

export function createInventoryImportHandlers(context: InventoryImportHandlerContext) {
  const { request, currentUser, repository, readJson, rowsFromBody } = context
  const organizationId = currentUser.organization.id

  const mappedRows = async () => {
    const body = await readJson(request)
    return { body, mapped: mapKiotVietStocktakeRows(rowsFromBody(body) as KiotVietRawStocktakeRow[]) }
  }

  return {
    previewKiotVietStocktakeImport: async (): RouteResult => {
      const { mapped } = await mappedRows()
      return {
        found: true,
        data: await previewKiotVietStocktakeImport({
          organizationId,
          repository,
          rows: mapped.valid,
          invalidRows: mapped.invalid,
        }),
      }
    },
    importKiotVietStocktakes: async (): RouteResult => {
      const { body, mapped } = await mappedRows()
      const allowPartial = Boolean(body.allow_partial)
      if (mapped.invalid.length > 0 && !allowPartial) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'KiotViet stocktake import has invalid rows.')
      }
      const cleanup = Boolean(body.cleanup_demo) && repository.deleteDemoStocktakesForImport
        ? await repository.deleteDemoStocktakesForImport({ organizationId })
        : { deleted: 0, blocked: 0 }
      const result = await repository.upsertImportedKiotVietStocktakes?.({
        organizationId,
        createdBy: null,
        rows: mapped.valid,
      }) ?? {
        stocktakes_created: 0,
        stocktakes_updated: 0,
        items_created: 0,
        items_updated: 0,
        missing_product_rows: 0,
      }
      return {
        found: true,
        data: {
          summary: {
            total_rows: mapped.valid.length + mapped.invalid.length,
            valid_rows: mapped.valid.length,
            invalid_rows: mapped.invalid.length,
            ...result,
            cleanup_deleted_rows: cleanup.deleted,
            cleanup_blocked_rows: cleanup.blocked,
            creates_stock_movements: false,
          },
          invalid_rows: mapped.invalid,
        },
      }
    },
    deleteImportedKiotVietStocktakes: async (): RouteResult => {
      const result = await repository.deleteImportedKiotVietStocktakes?.({ organizationId }) ?? { deleted: 0, blocked: 0 }
      return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
    },
  }
}
