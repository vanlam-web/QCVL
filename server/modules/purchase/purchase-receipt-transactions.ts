import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
import type { PurchaseReceiptData, CashbookEntryData, CurrentUserData } from '../../http.js'
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
  deleteMovements(pool: pg.Pool, organizationId: string, sourceType: string, sourceCode: string): Promise<Set<string>>
}
export function createPurchaseReceiptTransactions(pool:pg.Pool,deps:PurchaseTransactionDeps):Pick<ServerRepository,'postPurchaseReceipt'|'cancelPurchaseReceipt'|'paySupplier'>{
 const {ensureSnapshots,ensureStock,ensureCatalog,ensureSalesFinance,loadReceipt,replaceMovements,updateCosts,cashEntry,insertCashbook,recomputeBalances,recomputeSupplier,deleteMovements}=deps
 return {
    async postPurchaseReceipt(input) {
      await ensureSnapshots(pool)
      await ensureStock(pool)
      await ensureCatalog(pool)
      await ensureSalesFinance(pool)
      const existing = await loadReceipt(pool, input.organizationId, input.id)
      if (!existing) throw new Error('Purchase receipt not found')
      if (existing.status !== 'draft') {
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

      await pool.query(
        `
          update purchase_receipt_snapshots
          set data = $3::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [input.organizationId, existing.id, JSON.stringify(postedReceipt)],
      )
      await recomputeBalances(pool, input.organizationId, affectedProducts)
      await recomputeSupplier(pool, input.organizationId, postedReceipt.supplier_id)
      return {
        purchase_receipt_id: postedReceipt.id,
        status: 'posted' as const,
        posted_at: postedAt,
        cashbook_voucher_id: cashbookVoucherId,
      }
    },

    async cancelPurchaseReceipt(input) {
      await ensureSnapshots(pool)
      await ensureStock(pool)
      const existing = await loadReceipt(pool, input.organizationId, input.id)
      if (!existing) return null
      if (existing.status === 'cancelled') return existing
      if (existing.paid_amount > 0 || (existing.supplier_payments as Array<{ status: string }>).some((payment) => payment.status === 'posted')) {
        throw new Error('PURCHASE_RECEIPT_HAS_PAYMENTS')
      }

      const cancelledAt = new Date().toISOString()
      const cancelledReceipt = {
        ...existing,
        status: 'cancelled' as const,
        paid_amount: 0,
        remaining_amount: 0,
        updated_at: cancelledAt,
      } satisfies PurchaseReceiptData

      await pool.query('begin')
      try {
        const affectedProducts = await deleteMovements(pool, input.organizationId, 'purchase_receipt', existing.code)
        await pool.query(
          `
            update purchase_receipt_snapshots
            set data = $3::jsonb, updated_at = now()
            where organization_id = $1 and id = $2
          `,
          [input.organizationId, existing.id, JSON.stringify(cancelledReceipt)],
        )
        await recomputeBalances(pool, input.organizationId, affectedProducts)
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      await recomputeSupplier(pool, input.organizationId, existing.supplier_id)
      return cancelledReceipt
    },

    async paySupplier(input) {
      await ensureSnapshots(pool)
      await ensureSalesFinance(pool)
      const validAllocations = input.allocations.filter((allocation) => allocation.amount > 0)
      if (validAllocations.length === 0) throw new Error('No supplier payment allocations')

      const receipts: PurchaseReceiptData[] = []
      for (const allocation of validAllocations) {
        const receipt = await loadReceipt(pool, input.organizationId, allocation.purchase_receipt_id)
        if (!receipt) throw new Error('Purchase receipt not found')
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

      await pool.query('begin')
      try {
        await insertCashbook(pool, input.organizationId, entry)
        for (const [index, allocation] of validAllocations.entries()) {
          const receipt = receipts[index]
          const amount = Math.min(allocation.amount, Math.max(receipt.remaining_amount, 0))
          const paidAmount = Math.min(receipt.payable_amount, receipt.paid_amount + amount)
          const remainingAmount = Math.max(receipt.payable_amount - paidAmount, 0)
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
          await pool.query(
            `
              update purchase_receipt_snapshots
              set data = $3::jsonb, updated_at = now()
              where organization_id = $1 and id = $2
            `,
            [input.organizationId, receipt.id, JSON.stringify(updatedReceipt)],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      await recomputeSupplier(pool, input.organizationId, input.supplierId)

      return {
        supplier_payment_id: entry.id,
        code: entry.code,
        amount: totalAmount,
        cashbook_voucher_id: entry.id,
      }
    },

  }
}
