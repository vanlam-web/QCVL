import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type CustomerDebtImportDeps = {
  ensureSnapshots(pool: pg.Pool): Promise<void>
  ensureTables(pool: pg.Pool): Promise<void>
  customerByCode(pool: pg.Pool, table: string, organizationId: string, code: string): Promise<{ id: string; code: string; name: string; phone: string | null } | null>
  hash(value: string): string
}
export function createCustomerDebtImportRepository(pool:pg.Pool,deps:CustomerDebtImportDeps):Pick<ServerRepository,'upsertImportedKiotVietCustomerDebtAdjustments'>{const {ensureSnapshots,ensureTables,customerByCode,hash}=deps;return{
    async upsertImportedKiotVietCustomerDebtAdjustments(input) {
      await ensureSnapshots(pool)
      await ensureTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0

      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const customer = await customerByCode(pool, 'customer_snapshots', input.organizationId, row.customer_code)
          if (!customer) {
            skipped += 1
            continue
          }
          const existing = await pool.query(
            `
              select id
              from customer_debt_adjustments
              where organization_id = $1
                and source_system = 'kiotviet'
                and source_code = $2
              limit 1
            `,
            [input.organizationId, row.source_code],
          )
          if (existing.rows[0]) updated += 1
          else created += 1

          await pool.query(
            `
              insert into customer_debt_adjustments (
                id, organization_id, customer_id, customer_snapshot, source_code, source_system,
                source_file, source_row, transaction_type, amount_delta, paid_amount,
                remaining_amount, balance_after, status, created_at, updated_at
              )
              values (
                $1, $2, $3, $4::jsonb, $5, 'kiotviet',
                $6, $7, $8, $9, 0,
                $10, $11, 'closed', coalesce($12::timestamptz, now()), now()
              )
              on conflict (organization_id, source_system, source_code)
              do update set
                customer_id = excluded.customer_id,
                customer_snapshot = excluded.customer_snapshot,
                source_file = excluded.source_file,
                source_row = excluded.source_row,
                transaction_type = excluded.transaction_type,
                amount_delta = excluded.amount_delta,
                paid_amount = 0,
                remaining_amount = excluded.remaining_amount,
                balance_after = excluded.balance_after,
                status = excluded.status,
                created_at = excluded.created_at,
                updated_at = now()
            `,
            [
              `customer-debt-adjustment-kv-${hash(row.source_code)}`,
              input.organizationId,
              customer.id,
              JSON.stringify({ id: customer.id, code: customer.code, name: customer.name, phone: customer.phone ?? null }),
              row.source_code,
              row.source_file,
              row.rowNumber,
              row.transaction_type,
              row.amount_delta,
              row.amount_delta,
              row.balance_after,
              row.transaction_time,
            ],
          )
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
