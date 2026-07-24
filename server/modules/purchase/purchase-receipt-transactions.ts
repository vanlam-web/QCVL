import { createHash } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
import type { PurchaseReceiptData, CashbookEntryData, CurrentUserData } from '../../http.js'
export class SupplierPaymentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupplierPaymentValidationError'
  }
}
export class SupplierPaymentOperationConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupplierPaymentOperationConflictError'
  }
}
function supplierPaymentPayloadHash(input: {
  supplierId: string
  paymentMethod: string
  financeAccountId?: string
  note?: string | null
  allocations: Array<{ purchase_receipt_id: string; amount: number }>
}) {
  const payload = {
    supplierId: input.supplierId,
    paymentMethod: input.paymentMethod,
    financeAccountId: input.financeAccountId ?? null,
    note: input.note ?? null,
    allocations: [...input.allocations]
      .map((allocation) => ({ purchase_receipt_id: allocation.purchase_receipt_id, amount: Number(allocation.amount) }))
      .sort((left, right) => left.purchase_receipt_id.localeCompare(right.purchase_receipt_id)),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
type PurchaseTransactionDeps = {
  ensureSnapshots(pool: pg.Pool): Promise<void>
  ensureStock(pool: pg.Pool): Promise<void>
  ensureCatalog(pool: pg.Pool): Promise<void>
  ensureSalesFinance(pool: pg.Pool): Promise<void>
  loadReceipt(pool: pg.Pool, organizationId: string, id: string): Promise<PurchaseReceiptData | null>
  replaceMovements(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData): Promise<Set<string>>
  updateCosts(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData): Promise<void>
  cashEntry(pool: pg.Pool, input: { organizationId: string; supplier: PurchaseReceiptData['supplier']; receipt: PurchaseReceiptData; amount: number; paymentMethod: string; financeAccountId?: string | null; currentUser: CurrentUserData; note: string; createdAt?: string; suffix?: string }): Promise<CashbookEntryData>
  insertCashbook(pool: pg.Pool, organizationId: string, entry: CashbookEntryData): Promise<void>
  recomputeBalances(pool: pg.Pool, organizationId: string, productIds: Set<string>): Promise<void>
  recomputeSupplier(pool: pg.Pool, organizationId: string, supplierId: string): Promise<void>
  reverseMovements(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData): Promise<Set<string>>
  cancelSupplierPaymentCashbook(pool: pg.Pool, organizationId: string, receiptId: string): Promise<void>
}
type SupplierPaymentRepair={receiptId:string;legacyCashbookCode:string;expectedAmount:number}
export function createPurchaseReceiptTransactions(connectionPool:pg.Pool,deps:PurchaseTransactionDeps):Pick<ServerRepository,'postPurchaseReceipt'|'cancelPurchaseReceipt'|'paySupplier'|'repairShiftedSupplierPayment'>{
  const {ensureSnapshots,ensureStock,ensureCatalog,ensureSalesFinance,loadReceipt,replaceMovements,updateCosts,cashEntry,insertCashbook,recomputeBalances,recomputeSupplier,reverseMovements,cancelSupplierPaymentCashbook}=deps
 return {
    async postPurchaseReceipt(input) {
      await ensureSnapshots(connectionPool)
      await ensureStock(connectionPool)
      await ensureCatalog(connectionPool)
      await ensureSalesFinance(connectionPool)
      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipt:${input.organizationId}:${input.id}`])
        const existing = await loadReceipt(pool, input.organizationId, input.id)
        if (!existing) throw new Error('Purchase receipt not found')
        if (existing.status !== 'draft') {
          await client.query('rollback')
          return {
            purchase_receipt_id: existing.id,
            status: 'posted' as const,
            posted_at: existing.received_at,
            cashbook_voucher_id: null,
          }
        }

        const postedAt = new Date().toISOString()
        const postedReceipt = {
          ...existing,
          status: 'posted' as const,
          updated_at: postedAt,
        } satisfies PurchaseReceiptData
        const affectedProducts = await replaceMovements(pool, input.organizationId, postedReceipt)
        await updateCosts(pool, input.organizationId, postedReceipt)

        let cashbookVoucherId: string | null = null
        if (postedReceipt.paid_amount > 0) {
          const entry = await cashEntry(pool, {
            organizationId: input.organizationId,
            supplier: postedReceipt.supplier,
            receipt: postedReceipt,
            amount: postedReceipt.paid_amount,
            paymentMethod: input.paymentMethod ?? 'cash',
            financeAccountId: input.financeAccountId,
            currentUser: input.currentUser,
            note: `Thanh toán ${postedReceipt.code}`,
            createdAt: postedReceipt.received_at ?? postedReceipt.created_at,
          })
          await insertCashbook(pool, input.organizationId, entry)
          cashbookVoucherId = entry.id
        }

        await client.query(
          `
            update purchase_receipt_snapshots
            set data = $3::jsonb, updated_at = now()
            where organization_id = $1 and id = $2
          `,
          [input.organizationId, existing.id, JSON.stringify(postedReceipt)],
        )
        await recomputeBalances(pool, input.organizationId, affectedProducts)
        await recomputeSupplier(pool, input.organizationId, postedReceipt.supplier_id)
        await client.query('commit')
        return {
          purchase_receipt_id: postedReceipt.id,
          status: 'posted' as const,
          posted_at: postedAt,
          cashbook_voucher_id: cashbookVoucherId,
        }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

    async cancelPurchaseReceipt(input) {
      await ensureSnapshots(connectionPool)
      await ensureStock(connectionPool)
      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipt:${input.organizationId}:${input.id}`])
        const existing = await loadReceipt(pool, input.organizationId, input.id)
        if (!existing) {
          await client.query('rollback')
          return null
        }
        if (existing.status === 'cancelled') {
          await client.query('rollback')
          return existing
        }

        const cancelledAt = new Date().toISOString()
        await cancelSupplierPaymentCashbook(pool, input.organizationId, existing.id)
        const cancelledPayments = (existing.supplier_payments as Array<Record<string, unknown>>)
          .map((payment) => ({ ...payment, status: 'cancelled' as const })) as PurchaseReceiptData['supplier_payments']
        const cancelledReceipt = {
          ...existing,
          status: 'cancelled' as const,
          paid_amount: 0,
          remaining_amount: 0,
          updated_at: cancelledAt,
          supplier_payments: cancelledPayments,
        } as PurchaseReceiptData
        const affectedProducts = existing.status === 'posted'
          ? await reverseMovements(pool, input.organizationId, existing)
          : new Set<string>()
        await client.query(
          `
            update purchase_receipt_snapshots
            set data = $3::jsonb, updated_at = now()
            where organization_id = $1 and id = $2
          `,
          [input.organizationId, existing.id, JSON.stringify(cancelledReceipt)],
        )
        await recomputeBalances(pool, input.organizationId, affectedProducts)
        await recomputeSupplier(pool, input.organizationId, existing.supplier_id)
        await client.query('commit')
        return cancelledReceipt
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

    async repairShiftedSupplierPayment(input: { organizationId:string; repair:SupplierPaymentRepair }) {
      await ensureSnapshots(connectionPool)
      await ensureSalesFinance(connectionPool)
      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipt:${input.organizationId}:${input.repair.receiptId}`])
        const receipt = await loadReceipt(pool, input.organizationId, input.repair.receiptId)
        if (!receipt || receipt.status !== 'posted') throw new SupplierPaymentValidationError('Phiếu nhập không hợp lệ để repair payment.')
        const entryResult = await client.query<{ id:string; amount_delta:string|number; allocations:Array<{order_id?:string;allocated_amount?:number}> }>(`
          select id::text, amount_delta, allocations from cashbook_entries
          where organization_id=$1 and code=$2 and status='posted' and source_type='purchase_supplier_payment' for update
        `,[input.organizationId,input.repair.legacyCashbookCode])
        const entry=entryResult.rows[0]
        if (!entry || Number(entry.amount_delta)!==-input.repair.expectedAmount
          || !Array.isArray(entry.allocations)
          || entry.allocations.length!==1
          || entry.allocations[0]?.order_id!==receipt.id
          || Number(entry.allocations[0]?.allocated_amount??0)!==input.repair.expectedAmount) {
          throw new SupplierPaymentValidationError('Payment legacy không khớp receipt hoặc số tiền đã xác minh.')
        }
        if (receipt.paid_amount < input.repair.expectedAmount) throw new SupplierPaymentValidationError('Số đã trả của phiếu nhập không đủ để đảo payment.')
        await client.query(`update cashbook_entries set status='cancelled' where organization_id=$1 and id=$2`,[input.organizationId,entry.id])
        const repaired={...receipt,paid_amount:receipt.paid_amount-input.repair.expectedAmount,remaining_amount:receipt.remaining_amount+input.repair.expectedAmount,updated_at:new Date().toISOString()} as PurchaseReceiptData
        await client.query(`update purchase_receipt_snapshots set data=$3::jsonb,updated_at=now() where organization_id=$1 and id=$2`,[input.organizationId,receipt.id,JSON.stringify(repaired)])
        await recomputeSupplier(pool,input.organizationId,receipt.supplier_id)
        await client.query('commit')
        return { receipt_id:receipt.id,receipt_code:receipt.code,cashbook_code:input.repair.legacyCashbookCode,status:'cancelled' as const }
      } catch(error) { await client.query('rollback'); throw error } finally { client.release() }
    },

    async paySupplier(input) {
      await ensureSnapshots(connectionPool)
      await ensureSalesFinance(connectionPool)
      const validAllocations = input.allocations.filter((allocation) => allocation.amount > 0)
      if (validAllocations.length === 0) throw new Error('No supplier payment allocations')
      const payloadHash = supplierPaymentPayloadHash({ ...input, allocations: validAllocations })

      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`supplier-payment:${input.organizationId}:${input.operationId}`])
        const existingOperation = await client.query<{ payload_hash: string; response: { supplier_payment_id: string; code: string; amount: number; cashbook_voucher_id: string } }>(
          'select payload_hash, response from supplier_payment_operations where organization_id = $1 and operation_id = $2',
          [input.organizationId, input.operationId],
        )
        if (existingOperation.rows[0]) {
          if (existingOperation.rows[0].payload_hash !== payloadHash) {
            throw new SupplierPaymentOperationConflictError('Mã thao tác thanh toán đã được dùng với nội dung khác.')
          }
          await client.query('rollback')
          return existingOperation.rows[0].response
        }
        const receipts: PurchaseReceiptData[] = []
        for (const allocation of validAllocations) {
          await client.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipt:${input.organizationId}:${allocation.purchase_receipt_id}`])
          const receipt = await loadReceipt(pool, input.organizationId, allocation.purchase_receipt_id)
          if (!receipt) throw new Error('Purchase receipt not found')
          if (receipt.supplier_id !== input.supplierId) {
            throw new SupplierPaymentValidationError(`Phiếu nhập ${receipt.code} không thuộc nhà cung cấp đã chọn.`)
          }
          if (allocation.amount > Math.max(receipt.remaining_amount, 0)) {
            throw new SupplierPaymentValidationError(`Số tiền phân bổ vượt số còn phải trả của ${receipt.code}.`)
          }
          receipts.push(receipt)
        }
        const firstReceipt = receipts[0]
        const totalAmount = validAllocations.reduce((sum, allocation) => sum + allocation.amount, 0)
        const entry = await cashEntry(pool, {
          organizationId: input.organizationId,
          supplier: firstReceipt.supplier,
          receipt: firstReceipt,
          amount: totalAmount,
          paymentMethod: input.paymentMethod,
          financeAccountId: input.financeAccountId,
          currentUser: input.currentUser,
          note: input.note ?? `Thanh toán NCC ${firstReceipt.supplier.name}`,
          suffix: `pay-${Date.now()}`,
        })

        await insertCashbook(pool, input.organizationId, entry)
        for (const [index, allocation] of validAllocations.entries()) {
          const receipt = receipts[index]
          const amount = allocation.amount
          const paidAmount = receipt.paid_amount + amount
          const remainingAmount = receipt.payable_amount - paidAmount
          const payment = {
            id: `${entry.id}-${index + 1}`,
            code: entry.code,
            paid_at: entry.created_at,
            created_by: input.currentUser.user.display_name,
            payment_method: input.paymentMethod,
            status: 'posted' as const,
            amount,
          }
          const updatedReceipt = {
            ...receipt,
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            updated_at: entry.created_at,
            supplier_payments: [...receipt.supplier_payments, payment] as unknown as PurchaseReceiptData['supplier_payments'],
          } as PurchaseReceiptData
          await client.query(
            `
              update purchase_receipt_snapshots
              set data = $3::jsonb, updated_at = now()
              where organization_id = $1 and id = $2
            `,
            [input.organizationId, receipt.id, JSON.stringify(updatedReceipt)],
          )
        }
        await recomputeSupplier(pool, input.organizationId, input.supplierId)
        const result = {
          supplier_payment_id: entry.id,
          code: entry.code,
          amount: totalAmount,
          cashbook_voucher_id: entry.id,
        }
        await client.query(
          `
            insert into supplier_payment_operations (
              organization_id, operation_id, supplier_id, payload_hash, response
            ) values ($1, $2, $3, $4, $5::jsonb)
          `,
          [input.organizationId, input.operationId, input.supplierId, payloadHash, JSON.stringify(result)],
        )
        await client.query('commit')
        return result
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

  }
}
