import type { CashbookEntryData, SalesDocumentData } from '../../http.js'
import type { CurrentUserData, ServerRepository } from '../../http-types.js'
type SalesDocument=NonNullable<Awaited<ReturnType<NonNullable<ServerRepository['getSalesDocument']>>>>
type PosCartValidationLine = { client_line_id?: string; product_id?: string; sell_method?: string; quantity?: number; width_m?: number | null; height_m?: number | null; linear_m?: number | null; unit_price?: number; price_source?: string }
export type CheckoutBody = { customer_id?: string; created_at?: string; note?: string; items?: Array<{ product_id?: string; quantity?: number; unit_price?: number; sale_unit_name?: string; stock_qty_per_sale_unit?: number; discount_amount?: number }>; payment?: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; old_debt_allocations?: Array<{ order_id?: string; order_code?: string; allocated_amount?: number }>; change_returned_amount?: number; bank_account_id?: string | null } }
type SalesCoreDeps = {
  request: Request
  currentUser: CurrentUserData
  repository: ServerRepository
  readJson(request: Request): Promise<Record<string, unknown>>
  validatePosCart(repository: ServerRepository, organizationId: string, body: { items?: PosCartValidationLine[] }): Promise<unknown>
  makeOrderFromCheckout(body: CheckoutBody, type: 'invoice' | 'quote', customer: SalesDocumentData['customer'], code: string, seller: { id: string; name: string }): SalesDocumentData
  resolveSalesCustomer(repository: ServerRepository, organizationId: string, customerId?: string): Promise<SalesDocumentData['customer']>
  nextSalesDocumentCode(repository: ServerRepository, organizationId: string, type: 'invoice' | 'quote'): Promise<string>
  checkoutProductIds(body: CheckoutBody): string[]
  previewCashbookEntriesFromCheckout(order: SalesDocumentData, payment: CheckoutBody['payment'], seller: { id: string; name: string }): CashbookEntryData[]
  addCashbookEntriesFromCheckout(order: SalesDocumentData, payment: CheckoutBody['payment'], seller: { id: string; name: string }): CashbookEntryData[]
  splitCheckoutPaymentForCurrentOrderAndOldDebt(payment: CheckoutBody['payment']): { oldDebtPaymentAmount: number; oldDebtCashAmount: number; oldDebtBankAmount: number }
  checkoutOldDebtAllocations(payment: CheckoutBody['payment']): Array<{ order_id: string; order_code: string; allocated_amount: number }> | undefined
  salesDocuments: SalesDocumentData[]
  addCustomerSalesFromCheckout(order: SalesDocumentData): void
  addCustomerDebtFromCheckout(order: SalesDocumentData): void
  makeQuoteReopenPayload(id: string): unknown
  getIdFromPath(path: string): string | undefined
  path: string
  requiredRevisionReasonCode(body: Record<string, unknown>): { code: string; note: string | null }
  forbidden(message: string): Error
  validation(message: string): Error
  invoiceBaseCode(code: string): string
  nextInvoiceRevision(repository: ServerRepository, organizationId: string, baseCode: string): Promise<{ code: string; baseCode: string; revisionNo: number }>
}
export function createSalesCoreHandlers(deps:SalesCoreDeps){const {request,currentUser,repository,readJson,validatePosCart,makeOrderFromCheckout,resolveSalesCustomer,nextSalesDocumentCode,checkoutProductIds,previewCashbookEntriesFromCheckout,addCashbookEntriesFromCheckout,splitCheckoutPaymentForCurrentOrderAndOldDebt,checkoutOldDebtAllocations,salesDocuments,addCustomerSalesFromCheckout,addCustomerDebtFromCheckout,makeQuoteReopenPayload,getIdFromPath,path,requiredRevisionReasonCode,forbidden,validation,invoiceBaseCode,nextInvoiceRevision}=deps;return{
    validateCart: async () => {
      const body = await readJson(request) as { items?: PosCartValidationLine[] }
      return { found: true, data: await validatePosCart(repository, currentUser.organization.id, body) }
    },
    checkout: async () => {
      const body = await readJson(request) as CheckoutBody
      const customer = await resolveSalesCustomer(repository, currentUser.organization.id, body.customer_id)
      const code = await nextSalesDocumentCode(repository, currentUser.organization.id, 'invoice')
      const seller = { id: currentUser.user.id, name: currentUser.user.display_name }
      const order = makeOrderFromCheckout(body, 'invoice', customer, code, seller)
      await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
      const paymentEntries = repository.saveSalesDocument ? previewCashbookEntriesFromCheckout(order, body.payment, seller) : addCashbookEntriesFromCheckout(order, body.payment, seller)
      if (repository.saveSalesDocument) {
        await repository.saveSalesDocument({ organizationId: currentUser.organization.id, document: order, cashbookEntries: paymentEntries })
      } else {
        salesDocuments.unshift(order)
        addCustomerSalesFromCheckout(order)
        addCustomerDebtFromCheckout(order)
      }
      const oldDebtPayment = splitCheckoutPaymentForCurrentOrderAndOldDebt(body.payment)
      if (body.customer_id && oldDebtPayment.oldDebtPaymentAmount > 0) {
        await repository.collectCustomerDebt?.({
          organizationId: currentUser.organization.id,
          customerId: body.customer_id,
          amount: oldDebtPayment.oldDebtPaymentAmount,
          createdAt: order.created_at,
          allocations: checkoutOldDebtAllocations(body.payment),
          cashAmount: oldDebtPayment.oldDebtCashAmount,
          bankAmount: oldDebtPayment.oldDebtBankAmount,
          bankAccountId: body.payment?.bank_account_id ?? null,
          note: `Thu no POS ${order.code}`,
        })
      }
      return { found: true, data: { order: { id: order.id, code: order.code, order_type: 'invoice', status: 'completed', created_at: order.created_at, total_amount: order.total_amount, paid_amount: order.paid_amount, debt_amount: order.debt_amount, payment_status: order.payment_status }, payment_receipt: paymentEntries.length > 0 ? { id: paymentEntries[0].id, code: paymentEntries[0].code, total_received_amount: paymentEntries.reduce((sum: number, entry: { amount_delta: number }) => sum + entry.amount_delta, 0) } : null, inventory_warnings: [] }, status: 201 }
    },
    createQuote: async () => {
      const body = await readJson(request) as CheckoutBody
      const customer = await resolveSalesCustomer(repository, currentUser.organization.id, body.customer_id)
      const code = await nextSalesDocumentCode(repository, currentUser.organization.id, 'quote')
      const quote = makeOrderFromCheckout(body, 'quote', customer, code, { id: currentUser.user.id, name: currentUser.user.display_name })
      await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
      if (repository.saveSalesDocument) {
        await repository.saveSalesDocument({ organizationId: currentUser.organization.id, document: quote, cashbookEntries: [] })
      } else {
        salesDocuments.unshift(quote)
      }
      return { found: true, data: { id: quote.id, code: quote.code, order_type: 'quote', status: 'active', created_at: quote.created_at, total_amount: quote.total_amount }, status: 201 }
    },
    reopenQuotePayload: async () => ({ found: true, data: makeQuoteReopenPayload(getIdFromPath(path) ?? 'quote-1') }),
    reviseInvoice: async () => {
      const originalId = getIdFromPath(path) ?? ''
      const body = await readJson(request) as CheckoutBody & Record<string, unknown>
      const reason = requiredRevisionReasonCode(body)
      if (!currentUser.permissions.includes('perm.edit_order_locked')) {
        throw forbidden('Missing permission perm.edit_order_locked.')
      }
      const original = repository.getSalesDocument
        ? await repository.getSalesDocument({ organizationId: currentUser.organization.id, id: originalId })
        : salesDocuments.find((document: SalesDocument) => document.id === originalId || document.code === originalId) ?? null
      if (!original) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
      if (original.order_type !== 'invoice' || original.status !== 'completed') {
        throw validation('Only completed invoices can be revised.')
      }

      const customer = await resolveSalesCustomer(repository, currentUser.organization.id, body.customer_id)
      const baseCode = original.base_code ?? invoiceBaseCode(original.code)
      const nextRevision = await nextInvoiceRevision(repository, currentUser.organization.id, baseCode)
      const seller = { id: currentUser.user.id, name: currentUser.user.display_name }
      const revisedOrder = {
        ...makeOrderFromCheckout(body, 'invoice', customer, nextRevision.code, seller),
        base_code: nextRevision.baseCode,
        revision_no: nextRevision.revisionNo,
        revised_from_order_id: original.id,
        replaced_by_order_id: null,
        cancel_reason_type: null,
        revision_reason_code: reason.code,
        revision_reason_note: reason.note,
      } satisfies SalesDocumentData
      await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
      const paymentEntries = repository.saveSalesDocument ? previewCashbookEntriesFromCheckout(revisedOrder, body.payment, seller) : addCashbookEntriesFromCheckout(revisedOrder, body.payment, seller)
      const saved = repository.reviseSalesDocument
        ? await repository.reviseSalesDocument({
            organizationId: currentUser.organization.id,
            originalOrderId: original.id,
            originalOrderCode: original.code,
            document: revisedOrder,
            cashbookEntries: paymentEntries,
            reason,
          })
        : null
      if (!saved) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
      return {
        found: true,
        data: {
          order: {
            id: saved.id,
            code: saved.code,
            order_type: 'invoice',
            status: 'completed',
            created_at: saved.created_at,
            total_amount: saved.total_amount,
            paid_amount: saved.paid_amount,
            debt_amount: saved.debt_amount,
            payment_status: saved.payment_status,
            base_code: saved.base_code,
            revision_no: saved.revision_no,
            revised_from_order_id: saved.revised_from_order_id,
          },
          payment_receipt: paymentEntries.length > 0 ? { id: paymentEntries[0].id, code: paymentEntries[0].code, total_received_amount: paymentEntries.reduce((sum: number, entry: { amount_delta: number }) => sum + entry.amount_delta, 0) } : null,
          inventory_warnings: [],
        },
        status: 201,
      }
    },
  }}
