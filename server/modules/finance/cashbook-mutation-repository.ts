import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'

type CashbookRow=Record<string,unknown>
type Entry=NonNullable<Awaited<ReturnType<NonNullable<ServerRepository['getCashbookEntry']>>>>
type FinanceAccount=Awaited<ReturnType<NonNullable<ServerRepository['listFinanceAccounts']>>>[number]
type CashbookMutationDeps={ensureTables(pool:pg.Pool):Promise<void>;mapRow(row:Record<string,unknown>):Entry;insertEntry(pool:pg.Pool,organizationId:string,entry:Entry):Promise<void>;accountsForExclusion(pool:pg.Pool,organizationId:string):Promise<FinanceAccount[]>;accountSnapshot(account:FinanceAccount):Entry['finance_account'];userNames(pool:pg.Pool,organizationId:string):Promise<ReadonlyMap<string,string>>;hydrateAccount(entry:Entry,accounts:FinanceAccount[]):Entry;hydrateUser(entry:Entry,names:ReadonlyMap<string,string>):Entry;hydrateLink(pool:pg.Pool,organizationId:string,entry:Entry):Promise<Entry>}
export function createCashbookMutationRepository(pool:pg.Pool,deps:CashbookMutationDeps):Pick<ServerRepository,'updateCashbookEntry'|'createCashbookVoucher'|'cancelCashbookVoucher'>{const {ensureTables,mapRow,insertEntry,accountsForExclusion,accountSnapshot,userNames,hydrateAccount,hydrateUser,hydrateLink}=deps;return{
    async updateCashbookEntry(input) {
      await ensureTables(pool)
      const current = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
            and (id = $2 or code = $2)
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!current.rows[0]) return null
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const currentEntry = mapRow(current.rows[0])
      const account = input.finance_account_id ? accounts.find((item: FinanceAccount) => item.id === input.finance_account_id) : null
      if (input.finance_account_id && !account) return null
      const nextAccount = account ? accountSnapshot(account) : currentEntry.finance_account
      const nextCreatedAt = input.created_at ?? currentEntry.created_at
      const nextNote = input.note !== undefined ? input.note : currentEntry.note
      const result = await pool.query(
        `
          update cashbook_entries
          set created_at = $3,
              note = $4,
              finance_account = $5
          where organization_id = $1
            and id = $2
          returning *
        `,
        [
          input.organizationId,
          currentEntry.id,
          nextCreatedAt,
          nextNote,
          JSON.stringify(nextAccount),
        ],
      )
      const userDisplayNames = await userNames(pool, input.organizationId)
      const entry = hydrateAccount(hydrateUser(mapRow(result.rows[0]), userDisplayNames), accounts)
      return hydrateLink(pool, input.organizationId, entry)
    },

    async createCashbookVoucher(input) {
      await ensureTables(pool)
      await insertEntry(pool, input.organizationId, input.entry)
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userNames(pool, input.organizationId)
      return hydrateAccount(hydrateUser(input.entry, userDisplayNames), accounts)
    },

    async cancelCashbookVoucher(input) {
      await ensureTables(pool)
      await pool.query('begin')
      try {
        const current = await pool.query<CashbookRow>(
          `
            select *
            from cashbook_entries
            where organization_id = $1
              and status = 'posted'
              and source_type in ('cashbook_voucher', 'payment_receipt_method')
              and (
                id = $2
                or code = $2
                or source->>'id' = $2
                or source->>'code' = $2
              )
            order by created_at desc, code desc
            limit 1
            for update
          `,
          [input.organizationId, input.id],
        )
        const targetRow = current.rows[0]
        if (!targetRow) {
          await pool.query('rollback')
          return null
        }
        const target = mapRow(targetRow) as Entry

        if (target.source_type === 'payment_receipt_method') {
          const receiptId = target.source?.id ?? input.id
          const receiptCode = target.source?.code ?? target.code
          const siblingRows = await pool.query<CashbookRow>(
            `
              select *
              from cashbook_entries
              where organization_id = $1
                and status = 'posted'
                and source_type = 'payment_receipt_method'
                and (
                  source->>'id' = $2
                  or source->>'code' = $3
                  or code = $3
                  or code like $3 || '-%'
                )
              for update
            `,
            [input.organizationId, receiptId, receiptCode],
          )
          const sourceEntry = siblingRows.rows.map((row) => mapRow(row) as Entry).find((entry: Entry) => (entry.allocations?.length ?? 0) > 0) ?? target
          for (const allocation of sourceEntry.allocations ?? []) {
            const allocated = Math.max(Number(allocation.allocated_amount), 0)
            if (allocated <= 0) continue
            if (/^HD/i.test(allocation.order_code)) {
              await pool.query(
                `
                  update customer_debt_entries cde
                  set paid_amount = greatest(cde.paid_amount - $1::numeric, 0),
                      remaining_debt = cde.remaining_debt + $1::numeric,
                      status = 'open',
                      updated_at = now()
                  from orders o
                  where cde.organization_id = $2
                    and cde.order_id = o.id
                    and o.organization_id = $2
                    and (cde.order_id = $3 or o.code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
              await pool.query(
                `
                  update orders
                  set paid_amount = greatest(paid_amount - $1::numeric, 0),
                      debt_amount = least(total_amount, debt_amount + $1::numeric),
                      payment_status = case
                        when least(total_amount, debt_amount + $1::numeric) <= 0 then 'paid'
                        when greatest(paid_amount - $1::numeric, 0) <= 0 then 'unpaid'
                        else 'partial'
                      end,
                      updated_at = now()
                  where organization_id = $2
                    and (id = $3 or code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
            } else {
              await pool.query(
                `
                  update customer_debt_adjustments
                  set paid_amount = greatest(paid_amount - $1::numeric, 0),
                      remaining_amount = remaining_amount + $1::numeric,
                      status = 'open',
                      updated_at = now()
                  where organization_id = $2
                    and (id = $3 or source_code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
            }
          }
          await pool.query(
            `
              update cashbook_entries
              set status = 'cancelled'
              where organization_id = $1
                and status = 'posted'
                and source_type = 'payment_receipt_method'
                and (
                  source->>'id' = $2
                  or source->>'code' = $3
                  or code = $3
                  or code like $3 || '-%'
                )
            `,
            [input.organizationId, receiptId, receiptCode],
          )
          await pool.query(
            `delete from payment_receipts where organization_id = $1 and (id = $2 or code = $3)`,
            [input.organizationId, receiptId, receiptCode],
          )
        } else {
          await pool.query(
            `
              update cashbook_entries
              set status = 'cancelled'
              where organization_id = $1
                and status = 'posted'
                and source_type = 'cashbook_voucher'
                and (
                  id = $2
                  or code = $2
                  or source->>'id' = $2
                  or source->>'code' = $2
                )
            `,
            [input.organizationId, input.id],
          )
        }

        const result = await pool.query<CashbookRow>(
          `
            select *
            from cashbook_entries
            where organization_id = $1
              and id = $2
            limit 1
          `,
          [input.organizationId, target.id],
        )
        await pool.query('commit')
        const row = result.rows[0]
        return row ? mapRow(row) : { ...target, status: 'cancelled' }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
