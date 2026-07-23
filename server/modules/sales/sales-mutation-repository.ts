import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type SalesMutationDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  loadDocument(input: Parameters<NonNullable<ServerRepository['getSalesDocument']>>[0]): ReturnType<NonNullable<ServerRepository['getSalesDocument']>> | undefined
  receiptBaseCode(code: string): string | null
  missingGuard(error: unknown): boolean
}

export function createSalesMutationRepository(connectionPool:pg.Pool,deps:SalesMutationDeps):Pick<ServerRepository,'cancelSalesDocument'|'updateSalesDocumentNote'>{const {ensureTables,loadDocument,receiptBaseCode,missingGuard}=deps;return{
    async cancelSalesDocument(input) {
      await ensureTables(connectionPool)
      const client = await connectionPool.connect()
      try {
        await client.query('begin')
        const result = await client.query(
          `
            update orders
            set status = 'cancelled',
                payment_status = case when order_type = 'invoice' then payment_status else payment_status end,
                updated_at = now()
            where organization_id = $1
              and (id = $2 or code = $2)
              and status <> 'cancelled'
            returning id
          `,
          [input.organizationId, input.id],
        )
        const orderId = result.rows[0]?.id
        if (!orderId) {
          await client.query('rollback')
          return loadDocument({ organizationId: input.organizationId, id: input.id }) ?? null
        }
        await client.query(
          `
            update customer_debt_entries
            set status = 'closed',
                remaining_debt = 0,
                updated_at = now()
            where organization_id = $1
              and order_id = $2
              and status = 'open'
          `,
          [input.organizationId, orderId],
        )
        await client.query('commit')
        return loadDocument({ organizationId: input.organizationId, id: String(orderId) }) ?? null
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

    async updateSalesDocumentNote(input) {
      await ensureTables(connectionPool)
      const assignments: string[] = ['updated_at = now()']
      const values: unknown[] = [input.organizationId, input.id]
      if (input.note !== undefined) {
        values.push(input.note ?? '')
        assignments.unshift(`note = $${values.length}`)
      }
      if (input.created_at !== undefined) {
        values.push(input.created_at)
        assignments.unshift(`created_at = $${values.length}::timestamptz`)
      }
      const result = await connectionPool.query(
        `
          update orders
          set ${assignments.join(', ')}
          where organization_id = $1
            and (id = $2 or code = $2)
          returning id, code
        `,
        values,
      )
      const orderId = result.rows[0]?.id
      const orderCode = result.rows[0]?.code
      if (!orderId) return null
      const sameSaleReceiptBaseCode = receiptBaseCode(orderCode)
      if (input.created_at !== undefined && sameSaleReceiptBaseCode) {
        await connectionPool.query(
          `
            update payment_receipts
            set created_at = $3::timestamptz
            where organization_id = $1
              and order_id = $2
              and (code = $4 or code like $4 || '-%')
          `,
          [input.organizationId, orderId, input.created_at, sameSaleReceiptBaseCode],
        )
        await connectionPool.query(
          `
            update payment_receipt_methods
            set created_at = $3::timestamptz
            where organization_id = $1
              and payment_receipt_id in (
                select id
                from payment_receipts
                where organization_id = $1
                  and order_id = $2
                  and (code = $4 or code like $4 || '-%')
              )
          `,
          [input.organizationId, orderId, input.created_at, sameSaleReceiptBaseCode],
        ).catch((error: unknown) => {
          if (missingGuard(error)) return
          throw error
        })
        await connectionPool.query(
          `
            update cashbook_entries
            set created_at = $2::timestamptz
            where organization_id = $1
              and source_type = 'payment_receipt_method'
              and (code = $3 or code like $3 || '-%')
          `,
          [input.organizationId, input.created_at, sameSaleReceiptBaseCode],
        )
      }
      return loadDocument({ organizationId: input.organizationId, id: String(orderId) }) ?? null
    },

  }}
