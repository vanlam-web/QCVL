import type pg from 'pg'
import type { SalesDocumentData } from '../../http.js'
type OrderRow=Record<string,unknown>
import type { ServerRepository } from '../../http-types.js'
type SaveInput = Parameters<NonNullable<ServerRepository['saveSalesDocument']>>[0]
type SalesSaveDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  ensureMovements(pool: pg.Pool): Promise<void>
  insertDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData): Promise<void>
  insertEntry(pool: pg.Pool, organizationId: string, entry: SaveInput['cashbookEntries'][number]): Promise<void>
  saveMovements(pool: pg.Pool, organizationId: string, document: SalesDocumentData): Promise<void>
  loadDocument(input: Parameters<NonNullable<ServerRepository['getSalesDocument']>>[0]): ReturnType<NonNullable<ServerRepository['getSalesDocument']>> | undefined
}
export function createSalesSaveRepository(pool:pg.Pool,deps:SalesSaveDeps):Pick<ServerRepository,'saveSalesDocument'|'reviseSalesDocument'>{const {ensureTables,ensureMovements,insertDocument,insertEntry,saveMovements,loadDocument}=deps;return{
    async saveSalesDocument(input) {
      await ensureTables(pool)
      await ensureMovements(pool)
      const client = await pool.connect()
      const transactionPool = Object.create(pool) as pg.Pool
      transactionPool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await insertDocument(transactionPool, input.organizationId, input.document)

        if (input.cashbookEntries.length > 0) {
          const receiptId = input.cashbookEntries[0].id
          const receiptCode = input.cashbookEntries[0].code
          const totalReceived = input.cashbookEntries.reduce((sum, entry) => sum + Math.max(entry.amount_delta, 0), 0)
          await client.query(
            `
              insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [receiptId, input.organizationId, receiptCode, input.document.customer.id, input.document.id, totalReceived, input.cashbookEntries[0].note, input.cashbookEntries[0].created_at],
          )

          for (const entry of input.cashbookEntries) {
            await client.query(
              `
                insert into payment_receipt_methods (
                  organization_id, payment_receipt_id, order_id, method,
                  finance_account_id, amount, allocations, created_at
                )
                values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7)
              `,
              [
                input.organizationId,
                receiptId,
                input.document.id,
                entry.finance_account.account_type === 'bank' ? 'bank_transfer' : 'cash',
                entry.finance_account.id,
                Math.abs(entry.amount_delta),
                entry.created_at,
              ],
            )
          }
        }

        for (const entry of input.cashbookEntries) {
          await insertEntry(transactionPool, input.organizationId, entry)
        }

        await saveMovements(transactionPool, input.organizationId, input.document)

        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

    async reviseSalesDocument(input) {
      await ensureTables(pool)
      await ensureMovements(pool)
      const client = await pool.connect()
      const transactionPool = Object.create(pool) as pg.Pool
      transactionPool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        const originalResult = await client.query<OrderRow>(
          `
            select *
            from orders
            where organization_id = $1
              and (id = $2 or code = $3)
            limit 1
            for update
          `,
          [input.organizationId, input.originalOrderId, input.originalOrderCode],
        )
        const originalRow = originalResult.rows[0] as { id: string; code: string; base_code?: string | null }
        if (!originalRow) {
          await client.query('rollback')
          return null
        }

        const revisionResult = await client.query<{ max_revision: number }>(
          `
            select coalesce(max(revision_no), 0)::int as max_revision
            from orders
            where organization_id = $1
              and regexp_replace(code, '\\.\\d+$', '') = $2
          `,
          [input.organizationId, input.document.base_code ?? input.originalOrderCode.replace(/\.\d+$/, ''),],
        )
        const baseCode = input.document.base_code ?? originalRow.base_code ?? originalRow.code.replace(/\.\d+$/, '')
        const nextRevisionNo = Math.max(Number(revisionResult.rows[0]?.max_revision ?? 0), Number(input.document.revision_no ?? 0)) || 0
        const revisionNo = nextRevisionNo > 0 ? nextRevisionNo : 1
        const revisedDocument: SalesDocumentData = {
          ...input.document,
          base_code: baseCode,
          revision_no: revisionNo,
          revised_from_order_id: originalRow.id,
        }

        await insertDocument(transactionPool, input.organizationId, revisedDocument)

        await client.query(
          `
            update orders
            set status = 'cancelled',
                replaced_by_order_id = $3,
                cancel_reason_type = 'revised',
                updated_at = now()
            where organization_id = $1
              and id = $2
          `,
          [input.organizationId, originalRow.id, revisedDocument.id],
        )
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
          [input.organizationId, originalRow.id],
        )

        if (input.cashbookEntries.length > 0) {
          const receiptId = input.cashbookEntries[0].id
          const receiptCode = input.cashbookEntries[0].code
          const totalReceived = input.cashbookEntries.reduce((sum, entry) => sum + Math.max(entry.amount_delta, 0), 0)
          await client.query(
            `
              insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [receiptId, input.organizationId, receiptCode, revisedDocument.customer.id, revisedDocument.id, totalReceived, input.cashbookEntries[0].note, input.cashbookEntries[0].created_at],
          )
          for (const entry of input.cashbookEntries) {
            await client.query(
              `
                insert into payment_receipt_methods (
                  organization_id, payment_receipt_id, order_id, method,
                  finance_account_id, amount, allocations, created_at
                )
                values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7)
              `,
              [
                input.organizationId,
                receiptId,
                revisedDocument.id,
                entry.finance_account.account_type === 'bank' ? 'bank_transfer' : 'cash',
                entry.finance_account.id,
                Math.abs(entry.amount_delta),
                entry.created_at,
              ],
            )
          }
        }

        for (const entry of input.cashbookEntries) {
          await insertEntry(transactionPool, input.organizationId, entry)
        }

        await saveMovements(transactionPool, input.organizationId, revisedDocument)
        await client.query('commit')
        return loadDocument({ organizationId: input.organizationId, id: revisedDocument.id }) ?? revisedDocument
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },

  }}
