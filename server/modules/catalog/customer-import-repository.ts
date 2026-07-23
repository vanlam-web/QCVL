import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Customer = Awaited<ReturnType<NonNullable<ServerRepository['listCustomers']>>>[number]
export function createCustomerImportRepository(pool: pg.Pool, deps: { ensureTables: (pool: pg.Pool) => Promise<void>; hashText: (value: string) => string; priceListCode: (name: string) => string }): Pick<ServerRepository, 'findCustomersByCodes' | 'upsertCustomerGroupsByName' | 'upsertCustomersByCode' | 'deleteImportedKiotVietCustomers'> {
  return {
    async findCustomersByCodes(input) { await deps.ensureTables(pool); const result = await pool.query(`select requested.code from unnest($2::text[]) as requested(code) where exists (select 1 from customer_snapshots c where c.organization_id = $1 and lower(c.code) = lower(requested.code))`, [input.organizationId, input.codes]); return new Set(result.rows.map((row) => String(row.code))) },
    async upsertCustomerGroupsByName(input) { return new Map(input.names.map((name) => name.trim()).filter(Boolean).map((name) => [name, `customer-group-${deps.hashText(name)}`])) },
    async upsertCustomersByCode(input) {
      await deps.ensureTables(pool); let created = 0, updated = 0
      for (const row of input.rows) {
        const existing = await pool.query('select data from customer_snapshots where organization_id = $1 and code = $2 limit 1', [input.organizationId, row.code]); const current = existing.rows[0]?.data as Customer | undefined
        const data: Customer = { id: current?.id ?? `customer-kv-${deps.hashText(row.code)}`, code: row.code, name: row.name, phone: row.phone, tax_code: row.tax_code, address: row.address, customer_group_id: row.customer_group_id, customer_group: row.customer_group_id && row.customer_group_name ? { id: row.customer_group_id, code: deps.priceListCode(row.customer_group_name), name: row.customer_group_name } : null, created_by: null, created_at: row.source_created_at ?? current?.created_at ?? new Date().toISOString(), total_sales_amount: row.kiotviet_net_sales ?? row.kiotviet_total_sales ?? current?.total_sales_amount ?? 0, total_debt_amount: row.kiotviet_current_debt ?? current?.total_debt_amount ?? 0, customer_type: row.customer_type, company_name: row.company_name, area_name: row.area_name, ward_name: row.ward_name, note: row.note, source_creator_name: row.source_creator_name, last_transaction_at: row.last_transaction_at, kiotviet_current_debt: row.kiotviet_current_debt, kiotviet_net_sales: row.kiotviet_net_sales, status: row.status }
        const upsert = await pool.query(`insert into customer_snapshots (id, organization_id, code, data, source_type, created_at, updated_at) values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now()) on conflict (organization_id, code) do update set data = excluded.data, source_type = excluded.source_type, updated_at = now() returning (xmax = 0) as inserted`, [data.id, input.organizationId, data.code, JSON.stringify(data), data.created_at]); if (upsert.rows[0]?.inserted) created += 1; else updated += 1
      }
      return { created, updated, skipped: 0 }
    },
    async deleteImportedKiotVietCustomers(input) { await deps.ensureTables(pool); const result = await pool.query(`delete from customer_snapshots where organization_id = $1 and source_type = 'kiotviet_import' and lower(code) <> 'khachle'`, [input.organizationId]); return { deleted: result.rowCount ?? 0, blocked: 0 } },
  }
}
