import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type ImportRow=Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]['rows'][number]
type ImportAccount={id:string;code:string;name:string;account_type:string;is_default_cash:boolean;is_active:boolean;account_number?:string|null;account_holder?:string|null;opening_balance?:number;note?:string|null;notify_on_transaction?:boolean}
type Snapshot={id:string}
type CashbookImportDeps={ensureAccounts(pool:pg.Pool|pg.PoolClient):Promise<void>;ensureTables(pool:pg.Pool|pg.PoolClient):Promise<void>;ensureSnapshots(pool:pg.Pool|pg.PoolClient):Promise<void>;preferPosted(rows:ImportRow[]):ImportRow[];accountFromRow(row:ImportRow):ImportAccount;linkedInvoiceCode(sourceCode:string):string|null;customerByCode(pool:pg.Pool|pg.PoolClient,table:string,organizationId:string,code:string):Promise<Snapshot|null>;hash(value:string):string;rebuildAllocations(pool:pg.Pool|pg.PoolClient,organizationId:string):Promise<void>;invalidate(organizationId:string):void}
export function createCashbookImportRepository(rootPool:pg.Pool,deps:CashbookImportDeps):Pick<ServerRepository,'upsertImportedKiotVietCashbook'|'deleteImportedKiotVietCashbook'>{const {ensureAccounts,ensureTables,ensureSnapshots,preferPosted,accountFromRow,linkedInvoiceCode,customerByCode,hash,rebuildAllocations,invalidate}=deps;return{
    async upsertImportedKiotVietCashbook(input) {
      const pool = await rootPool.connect()
      try {
       await ensureAccounts(pool)
       await ensureTables(pool)
       await ensureSnapshots(pool)
      let accountsCreated = 0
      let accountsUpdated = 0
      let entriesCreated = 0
      let entriesUpdated = 0
      const rows = preferPosted(input.rows)

      await pool.query('begin')
      try {
        for (const row of rows) {
          const account = accountFromRow(row)
          const existingAccount = await pool.query(
            `
              select id
              from finance_accounts
              where organization_id = $1
                and id = $2
              limit 1
            `,
            [input.organizationId, account.id],
          )
          if (existingAccount.rows[0]) accountsUpdated += 1
          else accountsCreated += 1
          await pool.query(
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
                note = excluded.note,
                notify_on_transaction = excluded.notify_on_transaction,
                updated_at = now()
            `,
            [
              account.id,
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

          const linkedOrderCode = linkedInvoiceCode(row.source_code)
          const linkedCustomer = row.counterparty_code
            ? await customerByCode(pool, 'customer_snapshots', input.organizationId, row.counterparty_code)
            : null
          const entryId = `cashbook-kv-${hash(row.source_code)}`
          const note = [row.source_note, row.transfer_content].filter(Boolean).join(' - ')
          const existingEntry = await pool.query(
            `
              select id
              from cashbook_entries
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.source_code],
          )
          if (existingEntry.rows[0]) entriesUpdated += 1
          else entriesCreated += 1

          await pool.query(
            `
              insert into cashbook_entries (
                id, organization_id, code, status, direction, amount_delta, finance_account,
                counterparty, note, source_type, source, allocations, is_business_accounted, created_by, created_at
              )
              values (
                $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, 'kiotviet_cashbook', $10::jsonb, '[]'::jsonb, true, $11::jsonb, coalesce($12::timestamptz, now())
              )
              on conflict (organization_id, code)
              do update set
                status = excluded.status,
                direction = excluded.direction,
                amount_delta = excluded.amount_delta,
                finance_account = excluded.finance_account,
                counterparty = excluded.counterparty,
                note = excluded.note,
                source_type = 'kiotviet_cashbook',
                source = excluded.source,
                allocations = '[]'::jsonb,
                created_by = excluded.created_by,
                created_at = excluded.created_at
            `,
            [
              entryId,
              input.organizationId,
              row.source_code,
              row.status,
              row.direction,
              row.amount_delta,
              JSON.stringify({
                id: account.id,
                code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
                name: account.name,
                account_type: account.account_type,
                account_number: account.account_number,
                account_holder: account.account_holder,
              }),
              JSON.stringify({
                type: linkedCustomer ? 'customer' : 'other',
                name: row.counterparty_name ?? row.counterparty_code ?? '',
                phone: row.counterparty_phone,
              }),
              note,
              JSON.stringify({
                type: 'kiotviet_cashbook',
                id: row.source_code,
                code: row.source_code,
                order_code: linkedOrderCode,
                customer_id: linkedCustomer?.id ?? null,
                source_created_at: row.source_created_at,
                source_creator_name: row.source_creator_name,
                category_name: row.category_name,
                transfer_content: row.transfer_content,
                source_note: row.source_note,
                counterparty_code: row.counterparty_code,
                counterparty_address: row.counterparty_address,
              }),
              JSON.stringify(input.createdBy),
              row.entry_time,
            ],
          )
        }
        if (input.rows.some((row) => /^(?:TTHD\d|TT\d|PCPN\d)/i.test(row.source_code))) {
          await rebuildAllocations(pool, input.organizationId)
        }
        invalidate(input.organizationId)
        await pool.query('commit')
        return {
          accounts_created: accountsCreated,
          accounts_updated: accountsUpdated,
          entries_created: entriesCreated,
          entries_updated: entriesUpdated,
          skipped_rows: Math.max(input.rows.length - rows.length, 0),
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      } finally {
        pool.release()
      }
    },

    async deleteImportedKiotVietCashbook(input) {
      const pool = await rootPool.connect()
      try {
       await ensureTables(pool)
       await ensureSnapshots(pool)
      await pool.query('begin')
      try {
        const result = await pool.query(
          `
            delete from cashbook_entries
            where organization_id = $1
              and source_type = 'kiotviet_cashbook'
          `,
          [input.organizationId],
        )
        await rebuildAllocations(pool, input.organizationId)
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      } finally {
        pool.release()
      }
    },

  }}
