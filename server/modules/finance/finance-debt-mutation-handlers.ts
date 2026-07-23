import { HttpError } from '../../http-response.js'
import { CustomerDebtAllocationError, CustomerDebtOverCollectionError } from './customer-debt-mutation-repository.js'
import type { CurrentUserData, ServerRepository } from '../../http-types.js'
type FinanceDebtHandlerDeps = {
  request: Request
  currentUser: CurrentUserData
  repository: ServerRepository
  readJson(request: Request): Promise<Record<string, unknown>>
  optionalIsoDateTime(value: unknown, field: string): string | undefined
  collectCustomerDebtFallback(request: Request): Promise<unknown>
  path: string
  getIdFromPath(path: string): string | undefined
  updateAdjustmentFallback(request: Request, adjustmentId: string): Promise<unknown | null>
}
export function createFinanceDebtMutationHandlers(deps:FinanceDebtHandlerDeps){const {request,currentUser,repository,readJson,optionalIsoDateTime,collectCustomerDebtFallback,path,getIdFromPath,updateAdjustmentFallback}=deps;return{
    collectCustomerDebt: async () => {
      if (repository.collectCustomerDebt) {
        const body = await readJson(request) as {
          customer_id?: string
          amount?: number
          created_at?: string
          allocations?: Array<{
            order_id?: string
            order_code?: string
            allocated_amount?: number
          }>
          payment_method?: {
            cash_amount?: number
            bank_amount?: number
            bank_account_id?: string | null
            bank_transaction_ref?: string
          }
          note?: string
        }
        try {
          return {
            found: true,
            data: await repository.collectCustomerDebt({
              organizationId: currentUser.organization.id,
              customerId: body.customer_id ?? '',
              amount: Math.max(Number(body.amount ?? 0), 0),
              createdAt: optionalIsoDateTime(body.created_at, 'created_at'),
              allocations: Array.isArray(body.allocations)
                ? body.allocations.map((allocation) => ({
                    order_id: String(allocation.order_id ?? ''),
                    order_code: String(allocation.order_code ?? ''),
                    allocated_amount: Math.max(Number(allocation.allocated_amount ?? 0), 0),
                  })).filter((allocation) => allocation.allocated_amount > 0 && (allocation.order_id || allocation.order_code))
                : undefined,
              cashAmount: Math.max(Number(body.payment_method?.cash_amount ?? 0), 0),
              bankAmount: Math.max(Number(body.payment_method?.bank_amount ?? 0), 0),
              bankAccountId: body.payment_method?.bank_account_id,
              bankTransactionRef: body.payment_method?.bank_transaction_ref,
              note: body.note,
            }),
            status: 201,
          }
        } catch (error) {
          if (error instanceof CustomerDebtOverCollectionError) {
            throw new HttpError(400, 'VALIDATION_ERROR', error.message, {
              amount: [`Dư nợ còn lại: ${error.availableDebt}.`],
            })
          }
          if (error instanceof CustomerDebtAllocationError) {
            throw new HttpError(400, 'VALIDATION_ERROR', error.message)
          }
          throw error
        }
      }
      return { found: true, data: await collectCustomerDebtFallback(request), status: 201 }
    },
    updateCustomerDebtAdjustment: async () => {
      const adjustmentId = getIdFromPath(path) ?? ''
      if (repository.updateCustomerDebtAdjustment) {
        const body = await readJson(request) as {
          adjusted_at?: string
          amount_delta?: number
          note?: string | null
        }
        const updated = await repository.updateCustomerDebtAdjustment({
          organizationId: currentUser.organization.id,
          adjustmentId,
          adjustedAt: typeof body.adjusted_at === 'string' ? body.adjusted_at : undefined,
          amountDelta: typeof body.amount_delta === 'number' ? body.amount_delta : undefined,
          note: body.note,
        })
        if (updated === null) return { found: true, data: { message: 'Customer debt adjustment not found' }, status: 404 }
        return { found: true, data: updated }
      }
      const updated = await updateAdjustmentFallback(request, adjustmentId)
      if (updated === null) return { found: true, data: { message: 'Customer debt adjustment not found' }, status: 404 }
      return { found: true, data: updated }
    },
  }}
