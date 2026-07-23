import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type FinanceAccountDeps = {
  ensureTable(pool: pg.Pool): Promise<void>
  mapRow(row: Record<string, unknown>): Awaited<ReturnType<NonNullable<ServerRepository['listFinanceAccounts']>>>[number]
  hash(value: string): string
  invalidate(organizationId: string): void
}

export function createFinanceAccountRepository(pool:pg.Pool,deps:FinanceAccountDeps):Pick<ServerRepository,'listFinanceAccounts'|'createFinanceAccount'|'updateFinanceAccount'>{const {ensureTable,mapRow,hash,invalidate}=deps;return{
    async listFinanceAccounts(input) {
      await ensureTable(pool)
      const isActive = input.url.searchParams.get('is_active')
      const accountType = input.url.searchParams.get('account_type')
      const params: unknown[] = [input.organizationId]
      const filters = ['organization_id = $1']
      if (isActive === 'true' || isActive === 'false') {
        params.push(isActive === 'true')
        filters.push(`is_active = $${params.length}`)
      }
      if (accountType === 'cash' || accountType === 'bank') {
        params.push(accountType)
        filters.push(`account_type = $${params.length}`)
      }
      const result = await pool.query(
        `
          select id, code, name, account_type, is_default_cash, is_active,
                 account_number, account_holder, opening_balance, note, notify_on_transaction
          from finance_accounts
          where ${filters.join(' and ')}
          order by case when account_type = 'cash' then 0 else 1 end, name, code
        `,
        params,
      )
      return result.rows.map(mapRow)
    },

    async createFinanceAccount(input) {
      await ensureTable(pool)
      const account = input.account
      const id = account.id ?? `finance-account-${hash(`${account.account_type}-${account.account_number ?? account.code}`)}`
      const result = await pool.query(
        `
          insert into finance_accounts (
            id, organization_id, code, name, account_type, is_default_cash, is_active,
            account_number, account_holder, opening_balance, note, notify_on_transaction, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
          on conflict (organization_id, id)
          do update set
            code = excluded.code,
            name = excluded.name,
            account_type = excluded.account_type,
            is_default_cash = excluded.is_default_cash,
            is_active = excluded.is_active,
            account_number = excluded.account_number,
            account_holder = excluded.account_holder,
            opening_balance = excluded.opening_balance,
            note = excluded.note,
            notify_on_transaction = excluded.notify_on_transaction,
            updated_at = now()
          returning id, code, name, account_type, is_default_cash, is_active,
                    account_number, account_holder, opening_balance, note, notify_on_transaction
        `,
        [
          id,
          input.organizationId,
          account.code,
          account.name,
          account.account_type,
          account.is_default_cash,
          account.is_active,
          account.account_number ?? null,
          account.account_holder ?? null,
          account.opening_balance ?? 0,
          account.note ?? null,
          account.notify_on_transaction ?? false,
        ],
      )
      invalidate(input.organizationId)
      return mapRow(result.rows[0])
    },

    async updateFinanceAccount(input) {
      await ensureTable(pool)
      const assignments: string[] = []
      const values: unknown[] = []
      const patch = input.patch
      if (patch.code !== undefined) {
        values.push(patch.code)
        assignments.push(`code = $${values.length}`)
      }
      if (patch.name !== undefined) {
        values.push(patch.name)
        assignments.push(`name = $${values.length}`)
      }
      if (patch.account_type !== undefined) {
        values.push(patch.account_type)
        assignments.push(`account_type = $${values.length}`)
      }
      if (patch.is_default_cash !== undefined) {
        values.push(patch.is_default_cash)
        assignments.push(`is_default_cash = $${values.length}`)
      }
      if (patch.is_active !== undefined) {
        values.push(patch.is_active)
        assignments.push(`is_active = $${values.length}`)
      }
      if (patch.account_number !== undefined) {
        values.push(patch.account_number)
        assignments.push(`account_number = $${values.length}`)
      }
      if (patch.account_holder !== undefined) {
        values.push(patch.account_holder)
        assignments.push(`account_holder = $${values.length}`)
      }
      if (patch.opening_balance !== undefined) {
        values.push(patch.opening_balance)
        assignments.push(`opening_balance = $${values.length}`)
      }
      if (patch.note !== undefined) {
        values.push(patch.note)
        assignments.push(`note = $${values.length}`)
      }
      if (patch.notify_on_transaction !== undefined) {
        values.push(patch.notify_on_transaction)
        assignments.push(`notify_on_transaction = $${values.length}`)
      }
      if (assignments.length === 0) {
        const existing = await pool.query(
          `
            select id, code, name, account_type, is_default_cash, is_active,
                   account_number, account_holder, opening_balance, note, notify_on_transaction
            from finance_accounts
            where organization_id = $1 and id = $2
            limit 1
          `,
          [input.organizationId, input.id],
        )
        return existing.rows[0] ? mapRow(existing.rows[0]) : null
      }
      values.push(input.organizationId, input.id)
      const result = await pool.query(
        `
          update finance_accounts
          set ${assignments.join(', ')}, updated_at = now()
          where organization_id = $${values.length - 1} and id = $${values.length}
          returning id, code, name, account_type, is_default_cash, is_active,
                    account_number, account_holder, opening_balance, note, notify_on_transaction
        `,
        values,
      )
      if (result.rows[0]) invalidate(input.organizationId)
      return result.rows[0] ? mapRow(result.rows[0]) : null
    },

  }}
