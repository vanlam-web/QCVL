import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { CashbookEntryData, ServerRepository } from '../../http.js'
import { customerDebtTotalsSql, mapCustomerDebtTotalsRow, type CustomerDebtTotalsRow } from './customer-debt.js'

export class CustomerDebtOverCollectionError extends Error {
  constructor(readonly requestedAmount: number, readonly availableDebt: number) {
    super('Số tiền thu nợ vượt quá dư nợ còn lại.')
    this.name = 'CustomerDebtOverCollectionError'
  }
}
export class CustomerDebtAllocationError extends Error {
  constructor(readonly message: string) {
    super(message)
    this.name = 'CustomerDebtAllocationError'
  }
}
type FinanceAccountSnapshot = { id: string; code: string; name: string; account_type: string; account_number?: string | null; account_holder?: string | null }
type CustomerDebtMutationDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  cashAccount(): FinanceAccountSnapshot
  bankAccount(id?: string | null): FinanceAccountSnapshot
  insertEntry(pool: pg.Pool, organizationId: string, entry: CashbookEntryData): Promise<void>
}
export function createCustomerDebtMutationRepository(connectionPool:pg.Pool,deps:CustomerDebtMutationDeps):Pick<ServerRepository,'collectCustomerDebt'|'updateCustomerDebtAdjustment'>{const {ensureTables,cashAccount,bankAccount,insertEntry}=deps;return{
    async collectCustomerDebt(input) {
      await ensureTables(connectionPool)
      if (input.amount <= 0 || input.cashAmount + input.bankAmount !== input.amount) {
        return { payment_receipt_id: '', allocated_amount: 0 }
      }

      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        const [debtRows, openOrderRows, adjustmentRows, anchorRows, totalsBefore] = await Promise.all([
          pool.query(
            `
              select
                cde.id as debt_id,
                cde.remaining_debt,
                o.id as order_id,
                o.code as order_code,
                o.created_at as order_created_at,
                o.total_amount,
                o.paid_amount,
                o.debt_amount,
                o.customer_snapshot
              from customer_debt_entries cde
              join orders o on o.id = cde.order_id
              where cde.organization_id = $1
                and cde.customer_id = $2
                and cde.status = 'open'
                and cde.remaining_debt > 0
              order by cde.created_at asc
              for update of cde, o
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select
                null::text as debt_id,
                o.debt_amount as remaining_debt,
                o.id as order_id,
                o.code as order_code,
                o.created_at as order_created_at,
                o.total_amount,
                o.paid_amount,
                o.debt_amount,
                o.customer_snapshot
              from orders o
              where o.organization_id = $1
                and o.customer_id = $2
                and o.order_type = 'invoice'
                and o.status <> 'cancelled'
                and o.debt_amount > 0
                and o.payment_status <> 'paid'
              order by o.created_at asc, o.code asc
              for update of o
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select
                id,
                source_code,
                amount_delta,
                paid_amount,
                remaining_amount,
                balance_after,
                customer_snapshot
              from customer_debt_adjustments
              where organization_id = $1
                and customer_id = $2
                and status = 'open'
                and remaining_amount > 0
              order by created_at asc
              for update
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select id, source_code, paid_amount, balance_after, customer_snapshot
              from customer_debt_adjustments
              where organization_id = $1
                and customer_id = $2
                and source_system = 'kiotviet'
              order by created_at desc, source_row desc nulls last, updated_at desc
              limit 1
              for update
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query<CustomerDebtTotalsRow>(
            customerDebtTotalsSql({ singleCustomer: true }),
            [input.organizationId, input.customerId],
          ),
        ])

        const canonicalDebtBefore = totalsBefore.rows[0] ? mapCustomerDebtTotalsRow(totalsBefore.rows[0]).total_debt : 0
        if (input.amount > canonicalDebtBefore) {
          throw new CustomerDebtOverCollectionError(input.amount, canonicalDebtBefore)
        }

        const requestedAllocations = (input.allocations ?? [])
          .map((allocation) => ({
            order_id: allocation.order_id,
            order_code: allocation.order_code,
            allocated_amount: Number(allocation.allocated_amount),
          }))
        const hasExplicitAllocations = requestedAllocations.length > 0
        if (requestedAllocations.some((allocation) => !Number.isFinite(allocation.allocated_amount) || allocation.allocated_amount <= 0)) {
          throw new CustomerDebtAllocationError('Phân bổ thu nợ phải lớn hơn 0.')
        }
        const explicitAllocationTotal = requestedAllocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
        if (hasExplicitAllocations && explicitAllocationTotal > input.amount) {
          throw new CustomerDebtAllocationError('Tổng phân bổ vượt số tiền thu nợ.')
        }
        const debtRowsByOrderId = new Set(debtRows.rows.map((row) => row.order_id))
        const openDebtRows = [
          ...debtRows.rows,
          ...openOrderRows.rows.filter((row) => !debtRowsByOrderId.has(row.order_id)),
        ]
        for (const allocation of requestedAllocations) {
          const row = openDebtRows.find((candidate) => candidate.order_id === allocation.order_id || candidate.order_code === allocation.order_code)
          if (!row) throw new CustomerDebtAllocationError('Phân bổ tham chiếu hóa đơn không còn nợ.')
          if (allocation.allocated_amount > Number(row.remaining_debt)) {
            throw new CustomerDebtAllocationError(`Phân bổ vượt dư nợ hóa đơn ${row.order_code}.`)
          }
        }
        const debtAllocationRows = requestedAllocations.length > 0
          ? requestedAllocations
              .map((allocation) => ({
                allocation,
                row: openDebtRows.find((row) => row.order_id === allocation.order_id || row.order_code === allocation.order_code),
              }))
              .filter((item): item is { allocation: typeof requestedAllocations[number]; row: typeof debtRows.rows[number] } => Boolean(item.row))
          : openDebtRows.map((row) => ({ allocation: null, row }))

        let remainingPayment = input.amount
        const allocations: Array<{
          order_id: string
          order_code: string
          order_total_amount: number
          collected_before: number
          allocated_amount: number
          remaining_after: number
          order_created_at?: string
        }> = []

        for (const { allocation, row } of debtAllocationRows) {
          if (remainingPayment <= 0) break
          const allocated = Math.min(Number(row.remaining_debt), remainingPayment, allocation?.allocated_amount ?? remainingPayment)
          const nextDebt = Math.max(Number(row.remaining_debt) - allocated, 0)
          const nextPaid = Number(row.paid_amount) + allocated
          const paymentStatus = nextDebt <= 0 ? 'paid' : nextPaid <= 0 ? 'unpaid' : 'partial'
          if (row.debt_id) {
            await pool.query(
              `
                update customer_debt_entries
                set paid_amount = paid_amount + $1,
                    remaining_debt = $2,
                    status = case when $2::numeric <= 0 then 'closed' else 'open' end,
                    updated_at = now()
                where id = $3
              `,
              [allocated, nextDebt, row.debt_id],
            )
          }
          await pool.query(
            `
              update orders
              set paid_amount = $1,
                  debt_amount = $2,
                  payment_status = $3,
                  updated_at = now()
              where id = $4
            `,
            [nextPaid, nextDebt, paymentStatus, row.order_id],
          )
          allocations.push({
            order_id: row.order_id,
            order_code: row.order_code,
            order_total_amount: Number(row.total_amount),
            collected_before: Number(row.paid_amount),
            allocated_amount: allocated,
            remaining_after: nextDebt,
            order_created_at: row.order_created_at?.toISOString(),
          })
          remainingPayment -= allocated
        }
        for (const row of adjustmentRows.rows) {
          if (remainingPayment <= 0) break
          const allocated = Math.min(Number(row.remaining_amount), remainingPayment)
          const nextRemaining = Math.max(Number(row.remaining_amount) - allocated, 0)
          await pool.query(
            `
              update customer_debt_adjustments
              set paid_amount = paid_amount + $1,
                  remaining_amount = $2,
                  status = case when $2::numeric <= 0 then 'closed' else 'open' end,
                  updated_at = now()
              where id = $3
            `,
            [allocated, nextRemaining, row.id],
          )
          allocations.push({
            order_id: row.id,
            order_code: row.source_code,
            order_total_amount: Number(row.amount_delta),
            collected_before: Number(row.paid_amount),
            allocated_amount: allocated,
            remaining_after: nextRemaining,
          })
          remainingPayment -= allocated
        }

        // Legacy KiotViet debt (anchored in `balance_after`) has no open debt entry
        // rows to allocate against. Recording the payment receipt is what reduces the
        // canonical total, so allocate the leftover against the anchor for audit.
        const anchorRow = anchorRows.rows[0]
        if (remainingPayment > 0 && anchorRow) {
          const allocatedSoFar = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
          const legacyRemaining = Math.max(canonicalDebtBefore - allocatedSoFar, 0)
          const allocated = Math.min(remainingPayment, legacyRemaining)
          if (allocated > 0) {
            await pool.query(
              `
                update customer_debt_adjustments
                set paid_amount = paid_amount + $1,
                    updated_at = now()
                where id = $2
              `,
              [allocated, anchorRow.id],
            )
            allocations.push({
              order_id: String(anchorRow.id),
              order_code: String(anchorRow.source_code),
              order_total_amount: Number(anchorRow.balance_after),
              collected_before: Number(anchorRow.paid_amount),
              allocated_amount: allocated,
              remaining_after: legacyRemaining - allocated,
            })
            remainingPayment -= allocated
          }
        }

        const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
        if (allocatedAmount <= 0) {
          await pool.query('commit')
          return { payment_receipt_id: '', allocated_amount: 0 }
        }

        const receiptId = randomUUID()
        const receiptCodeRow = await pool.query<{ max_seq: string | number | null }>(
          `
            select coalesce(max((regexp_match(code, '^TT(\\d{6})$'))[1]::int), 0) as max_seq
            from (
              select code
              from payment_receipts
              where organization_id = $1
              union all
              select code
              from cashbook_entries
              where organization_id = $1
            ) existing_codes
            where code ~ '^TT\\d{6}$'
          `,
          [input.organizationId],
        )
        const receiptCodeSeq = Number(receiptCodeRow.rows[0]?.max_seq ?? 0) + 1
        const receiptCode = `TT${String(receiptCodeSeq).padStart(6, '0')}`
        const createdAt = input.createdAt ?? new Date().toISOString()
        const firstCustomer = debtRows.rows[0]?.customer_snapshot ?? adjustmentRows.rows[0]?.customer_snapshot ?? { name: 'Khach hang', phone: null }
        const allocationCodes = allocations.map((allocation) => allocation.order_code).join(', ')
        const note = input.note?.trim() ? `${input.note.trim()} - ${allocationCodes}` : `Thu no ${allocationCodes}`
        const receiptOrderId = allocations.find((allocation) => allocation.order_code.startsWith('HD'))?.order_id ?? null
        const receiptOrderCode = allocations.find((allocation) => allocation.order_code.startsWith('HD'))?.order_code ?? allocations[0]?.order_code ?? null
        await pool.query(
          `
            insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
          `,
          [receiptId, input.organizationId, receiptCode, input.customerId, receiptOrderId, allocatedAmount, note, createdAt],
        )

        const entries: CashbookEntryData[] = []
        const methods = [
          { amount: input.cashAmount, account: cashAccount(), method: 'cash' },
          { amount: input.bankAmount, account: bankAccount(input.bankAccountId), method: 'bank_transfer' },
        ]

        for (const method of methods) {
          if (method.amount <= 0) continue
          await pool.query(
            `
              insert into payment_receipt_methods (
                organization_id, payment_receipt_id, order_id, method,
                finance_account_id, amount, bank_transaction_ref, allocations, created_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz)
            `,
            [
              input.organizationId,
              receiptId,
              receiptOrderId,
              method.method,
              method.account.id,
              method.amount,
              method.method === 'bank_transfer' ? input.bankTransactionRef ?? null : null,
              JSON.stringify(allocations),
              createdAt,
            ],
          )
          entries.push({
            id: randomUUID(),
            code: entries.length === 0 ? receiptCode : `${receiptCode}-${method.method === 'cash' ? 'TM' : 'NH'}`,
            status: 'posted',
            direction: 'in',
            amount_delta: method.amount,
            finance_account: method.account,
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: createdAt,
            note: method.method === 'bank_transfer' && input.bankTransactionRef ? `${note} (${input.bankTransactionRef})` : note,
            counterparty: { type: 'customer', name: firstCustomer.name, phone: firstCustomer.phone },
            source: { type: 'payment_receipt', id: receiptId, code: receiptCode, order_code: receiptOrderCode, customer_id: input.customerId },
            allocations,
          } as CashbookEntryData)
        }

        for (const entry of entries) {
          await insertEntry(pool, input.organizationId, entry)
        }

        await client.query('commit')
        return { payment_receipt_id: receiptCode, allocated_amount: allocatedAmount }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

    async updateCustomerDebtAdjustment(input) {
      await ensureTables(connectionPool)
      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        const result = await pool.query(
          `
            update customer_debt_adjustments
            set
              created_at = coalesce($3::timestamptz, created_at),
              amount_delta = coalesce($4::numeric, amount_delta),
              remaining_amount = greatest(coalesce($4::numeric, amount_delta) - paid_amount, 0),
              source_file = case when $5::boolean then $6::text else source_file end,
              updated_at = now()
            where organization_id = $1
              and id = $2
            returning
              id,
              source_code,
              created_at,
              transaction_type,
              amount_delta,
              paid_amount,
              remaining_amount,
              balance_after,
              source_file
          `,
          [
            input.organizationId,
            input.adjustmentId,
            input.adjustedAt ?? null,
            input.amountDelta ?? null,
            input.note !== undefined,
            input.note ?? null,
          ],
        )
        await client.query('commit')
        const row = result.rows[0]
        if (!row) return null
        return {
          id: String(row.id),
          source_code: String(row.source_code),
          created_at: row.created_at.toISOString(),
          transaction_type: String(row.transaction_type),
          amount_delta: Number(row.amount_delta),
          paid_amount: Number(row.paid_amount),
          remaining_amount: Number(row.remaining_amount),
          balance_after: Number(row.balance_after),
          source_file: row.source_file === null ? null : String(row.source_file),
        }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

  }}
