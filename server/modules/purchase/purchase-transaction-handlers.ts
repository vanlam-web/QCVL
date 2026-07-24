import { SupplierPaymentOperationConflictError, SupplierPaymentValidationError } from './purchase-receipt-transactions.js'
import type { CashbookEntryData, CurrentUserData, ProductListData, PurchaseReceiptData, ServerRepository, SupplierListData } from '../../http.js'
import type { RouteResult } from '../../route-types.js'
type PurchaseReceiptInputBody={code?:unknown;supplier_id?:unknown;received_at?:unknown;supplier_document_no?:unknown;notes?:unknown;discount_amount?:unknown;paid_amount?:unknown;items?:unknown}
type Allocation={purchase_receipt_id?:unknown;amount?:number}
type ReceiptRow=PurchaseReceiptData
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type PurchaseHandlerDeps={request:Request;currentUser:CurrentUserData;repository:ServerRepository;path:string;url:URL;readJson(request:Request):Promise<Record<string,unknown>>;getSupplierIdFromPath(path:string):string;getIdFromPath(path:string):string|undefined;purchaseReceipts:PurchaseReceiptData[];suppliers:SupplierListData[];products:ProductListData[];cashbookEntries:CashbookEntryData[];purchaseReceiptQueryHandlers:Record<string,()=>RouteResult>;purchaseImportHandlers:Record<string,()=>RouteResult>;filterPurchaseReceipts(url:URL):PurchaseReceiptData[];sortPurchaseReceiptsForRequest(items:PurchaseReceiptData[],url:URL):PurchaseReceiptData[];purchaseReceiptListSummary(items:PurchaseReceiptData[]):unknown;paged<T>(items:T[],page:number,pageSize:number):Paged<T>;makeManualPurchaseReceipt(input:{body:PurchaseReceiptInputBody;currentUser:CurrentUserData;existing?:PurchaseReceiptData|null;existingReceipts:readonly PurchaseReceiptData[];suppliers:readonly SupplierListData[];products:readonly ProductListData[]}):PurchaseReceiptData;syncSupplierTotalsFromPurchaseReceipts():void;validation(status:number,code:'VALIDATION_ERROR'|'RESOURCE_NOT_FOUND'|'RESOURCE_CONFLICT',message:string):Error;randomUUID():string;runtimeIso():string}
const shiftedPaymentRepairs={
  PCPN000690:{receiptId:'PN000690',legacyCashbookCode:'PCPN000690',expectedAmount:2040000},
  PCPN000692:{receiptId:'PN000692',legacyCashbookCode:'PCPN000692',expectedAmount:60000},
} as const
export function createPurchaseTransactionHandlers(deps:PurchaseHandlerDeps){const {request,currentUser,repository,path,url,readJson,getSupplierIdFromPath,getIdFromPath,purchaseReceipts,suppliers,products,cashbookEntries,purchaseReceiptQueryHandlers,purchaseImportHandlers,filterPurchaseReceipts,sortPurchaseReceiptsForRequest,purchaseReceiptListSummary,paged,makeManualPurchaseReceipt,syncSupplierTotalsFromPurchaseReceipts,validation,randomUUID,runtimeIso}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    repairShiftedPayment: async () => {
      const body=await readJson(request)
      const code=typeof body.legacy_cashbook_code==='string'?body.legacy_cashbook_code:''
      const repair=shiftedPaymentRepairs[code as keyof typeof shiftedPaymentRepairs]
      if (!repair || !repository.repairShiftedSupplierPayment) throw validation(400,'VALIDATION_ERROR','Repair payment không thuộc tập đối soát đã xác minh.')
      return {found:true,data:await repository.repairShiftedSupplierPayment({organizationId:currentUser.organization.id,repair})}
    },
    paySupplier: async () => {
      const body = await readJson(request)
      const operationId = typeof body.operation_id === 'string' ? body.operation_id.trim() : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
        throw validation(400, 'VALIDATION_ERROR', 'Mã thao tác thanh toán không hợp lệ.')
      }
      const allocations = Array.isArray(body.allocations) ? body.allocations : []
      const paymentMethod = body.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cash'
      const financeAccountId = typeof body.finance_account_id === 'string' ? body.finance_account_id : undefined
      const supplierId = getSupplierIdFromPath(path)
      const normalizedAllocations = allocations
        .map((allocation: Allocation) => (
          allocation != null && typeof allocation === 'object' && 'purchase_receipt_id' in allocation
            ? {
                purchase_receipt_id: String((allocation as { purchase_receipt_id: unknown }).purchase_receipt_id),
                amount: Number((allocation as { amount?: unknown }).amount ?? 0),
              }
            : null
        ))
        .filter((allocation): allocation is { purchase_receipt_id: string; amount: number } => Boolean(allocation && allocation.purchase_receipt_id && Number(allocation.amount ?? 0) > 0))
      if (repository.paySupplier) {
        let result
        try {
          result = await repository.paySupplier({
            organizationId: currentUser.organization.id,
            supplierId,
            operationId,
            paymentMethod,
            financeAccountId,
            note: typeof body.note === 'string' ? body.note : null,
            allocations: normalizedAllocations,
            currentUser,
          })
        } catch (error) {
          if (error instanceof SupplierPaymentValidationError) {
            throw validation(400, 'VALIDATION_ERROR', error.message)
          }
          if (error instanceof SupplierPaymentOperationConflictError) {
            throw validation(409, 'RESOURCE_CONFLICT', error.message)
          }
          throw error
        }
        return { found: true, data: result, status: 201 }
      }
      const firstAllocation = allocations.find((allocation: Allocation): allocation is { purchase_receipt_id: string; amount?: number } => (
        allocation != null
        && typeof allocation === 'object'
        && 'purchase_receipt_id' in allocation
        && typeof allocation.purchase_receipt_id === 'string'
      ))
      const receipt = firstAllocation
        ? purchaseReceipts.find((item: PurchaseReceiptData) => item.id === firstAllocation.purchase_receipt_id)
        : null
      const receiptCodeMatch = receipt?.code.match(/^PN(\d{6}(?:\.\d+)?)$/)
      const code = receiptCodeMatch
        ? `PCPN${receiptCodeMatch[1]}`
        : `PC${String(cashbookEntries.length + 1).padStart(6, '0')}`
      const amount = allocations.reduce((sum: number, allocation: Allocation) => (
        allocation != null && typeof allocation === 'object' && 'amount' in allocation
        ? sum + Number(allocation.amount ?? 0)
          : sum
      ), 0)
      return { found: true, data: { supplier_payment_id: randomUUID(), code, amount, cashbook_voucher_id: randomUUID() }, status: 201 }
    },
    listReceipts: async () => {
      const repositoryReceipts = await repository.listPurchaseReceipts?.({
        organizationId: currentUser.organization.id,
        url,
      })
      const items = sortPurchaseReceiptsForRequest(repositoryReceipts ?? filterPurchaseReceipts(url), url)
      return { found: true, data: { ...paged(items, page, pageSize), summary: purchaseReceiptListSummary(items) } }
    },
    previewKiotVietPurchaseReceiptImport: purchaseImportHandlers.previewKiotVietPurchaseReceiptImport,
    importKiotVietPurchaseReceipts: purchaseImportHandlers.importKiotVietPurchaseReceipts,
    deleteImportedKiotVietPurchaseReceipts: purchaseImportHandlers.deleteImportedKiotVietPurchaseReceipts,
    getReceipt: purchaseReceiptQueryHandlers.getReceipt,
    createReceipt: async () => {
      const body = await readJson(request) as PurchaseReceiptInputBody
      const [existingReceipts, supplierRows, productRows] = await Promise.all([
        repository.listPurchaseReceipts?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/purchase/receipts?status=all&page=1&page_size=10000') }),
        repository.listSuppliers?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/suppliers?status=active&page=1&page_size=10000') }),
        repository.listProducts?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/products?status=all&page=1&page_size=10000') }),
      ])
      const receipt = makeManualPurchaseReceipt({
        body,
        currentUser,
        existingReceipts: existingReceipts ?? purchaseReceipts,
        suppliers: supplierRows ?? suppliers,
        products: productRows ?? products,
      })
      if (repository.savePurchaseReceipt) {
        return { found: true, data: await repository.savePurchaseReceipt({ organizationId: currentUser.organization.id, receipt, sourceType: 'manual' }), status: 201 }
      }
      purchaseReceipts.push(receipt)
      syncSupplierTotalsFromPurchaseReceipts()
      return { found: true, data: receipt, status: 201 }
    },
    updateReceipt: async () => {
      const id = getIdFromPath(path) ?? ''
      const body = await readJson(request) as PurchaseReceiptInputBody
      const existing = await repository.getPurchaseReceipt?.({ organizationId: currentUser.organization.id, id })
        ?? purchaseReceipts.find((receipt: ReceiptRow) => receipt.id === id || receipt.code === id)
        ?? null
      if (!existing) throw validation(404, 'RESOURCE_NOT_FOUND', 'Purchase receipt not found.')
      if (existing.status !== 'draft') throw validation(400, 'VALIDATION_ERROR', 'Only draft purchase receipts can be edited.')
      const [existingReceipts, supplierRows, productRows] = await Promise.all([
        repository.listPurchaseReceipts?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/purchase/receipts?status=all&page=1&page_size=10000') }),
        repository.listSuppliers?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/suppliers?status=active&page=1&page_size=10000') }),
        repository.listProducts?.({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/products?status=all&page=1&page_size=10000') }),
      ])
      const receipt = makeManualPurchaseReceipt({
        body,
        currentUser,
        existing,
        existingReceipts: existingReceipts ?? purchaseReceipts,
        suppliers: supplierRows ?? suppliers,
        products: productRows ?? products,
      })
      if (repository.savePurchaseReceipt) {
        return { found: true, data: await repository.savePurchaseReceipt({ organizationId: currentUser.organization.id, receipt, sourceType: 'manual' }) }
      }
      const index = purchaseReceipts.findIndex((item: PurchaseReceiptData) => item.id === existing.id || item.code === existing.code)
      if (index >= 0) purchaseReceipts[index] = receipt
      syncSupplierTotalsFromPurchaseReceipts()
      return { found: true, data: receipt }
    },
    postReceipt: async () => {
      const body = await readJson(request)
      const id = getIdFromPath(path) ?? ''
      const paymentMethod = body.payment_method === 'bank_transfer' ? 'bank_transfer' : body.payment_method === 'cash' ? 'cash' : undefined
      const financeAccountId = typeof body.finance_account_id === 'string' ? body.finance_account_id : undefined
      if (repository.postPurchaseReceipt) {
        return {
          found: true,
          data: await repository.postPurchaseReceipt({
            organizationId: currentUser.organization.id,
            id,
            paymentMethod,
            financeAccountId,
            currentUser,
          }),
        }
      }
      const receipt = purchaseReceipts.find((item: PurchaseReceiptData) => item.id === id || item.code === id)
      if (receipt) {
        receipt.status = 'posted'
        receipt.updated_at = runtimeIso()
        syncSupplierTotalsFromPurchaseReceipts()
      }
      return { found: true, data: { purchase_receipt_id: id, status: 'posted', posted_at: runtimeIso(), cashbook_voucher_id: randomUUID() } }
    },
    cancelReceipt: async () => {
      const id = getIdFromPath(path) ?? ''
      if (repository.cancelPurchaseReceipt) {
        let receipt: PurchaseReceiptData | null
        try {
          receipt = await repository.cancelPurchaseReceipt({
            organizationId: currentUser.organization.id,
            id,
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'PURCHASE_RECEIPT_SHARED_PAYMENT_REQUIRES_ALLOCATION_REVERSAL') {
            throw validation(400, 'VALIDATION_ERROR', 'Phiếu trả NCC đang phân bổ cho nhiều phiếu nhập, cần đảo từng phân bổ trước khi hủy.')
          }
          throw error
        }
        return receipt
          ? { found: true, data: receipt }
          : { found: true, data: { message: 'Purchase receipt not found' }, status: 404 }
      }
      const receipt = purchaseReceipts.find((item: PurchaseReceiptData) => item.id === id || item.code === id)
      if (!receipt) return { found: true, data: { message: 'Purchase receipt not found' }, status: 404 }
      if (receipt.paid_amount > 0 || (receipt.supplier_payments as Array<{ status: string }>).some((payment) => payment.status === 'posted')) {
        throw validation(400, 'VALIDATION_ERROR', 'Cannot cancel a purchase receipt with supplier payments.')
      }
      receipt.status = 'cancelled'
      receipt.paid_amount = 0
      receipt.remaining_amount = 0
      receipt.updated_at = runtimeIso()
      syncSupplierTotalsFromPurchaseReceipts()
      return { found: true, data: receipt }
    },
  }}
