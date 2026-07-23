import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
import { customerDebtTotalsSql, mapCustomerDebtTotalsRow, type CustomerDebtTotalsRow } from './customer-debt.js'
export function createCustomerFinancialTotalsRepository(pool:pg.Pool,deps:{ensureTables:(pool:pg.Pool)=>Promise<void>;ensureSnapshots:(pool:pg.Pool)=>Promise<void>}):Pick<ServerRepository,'getCustomerFinancialTotals'>{const {ensureTables,ensureSnapshots}=deps;return{
    async getCustomerFinancialTotals(organizationId) {
      await ensureTables(pool)
      await ensureSnapshots(pool)
      const sales = await pool.query(
        `
          select customer_id, sum(total_amount) as total_sales_amount, max(updated_at) as last_activity_at
          from orders
          where organization_id = $1
            and order_type = 'invoice'
            and status <> 'cancelled'
            and customer_id is not null
          group by customer_id
        `,
        [organizationId],
      )
      const debts = await pool.query<CustomerDebtTotalsRow>(customerDebtTotalsSql(), [organizationId])
      const totals = new Map<string, { total_sales_amount: number; total_debt_amount: number; last_activity_at?: string }>()
      for (const row of sales.rows) {
        totals.set(row.customer_id, {
          total_sales_amount: Number(row.total_sales_amount),
          total_debt_amount: 0,
          last_activity_at: row.last_activity_at?.toISOString(),
        })
      }
      for (const row of debts.rows) {
        const mapped = mapCustomerDebtTotalsRow(row)
        const existing = totals.get(mapped.customer_id) ?? { total_sales_amount: 0, total_debt_amount: 0 }
        totals.set(mapped.customer_id, {
          ...existing,
          total_debt_amount: mapped.total_debt,
          last_activity_at: mapped.last_activity_at ?? existing.last_activity_at,
        })
      }
      return totals
    },

  }}
