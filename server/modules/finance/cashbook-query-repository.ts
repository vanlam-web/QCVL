import type pg from 'pg'
import type { CashbookEntryData, ServerRepository } from '../../http.js'
type FinanceAccount=Awaited<ReturnType<NonNullable<ServerRepository['listFinanceAccounts']>>>[number]
type Entry=CashbookEntryData
type CashbookQueryDeps={ensureTables(pool:pg.Pool):Promise<void>;userNames(pool:pg.Pool,organizationId:string):Promise<ReadonlyMap<string,string>>;accountsForExclusion(pool:pg.Pool,organizationId:string):Promise<FinanceAccount[]>;mapRow(row:Record<string,unknown>):Entry;hydrateUser(entry:Entry,names:ReadonlyMap<string,string>):Entry;hydrateAccount(entry:Entry,accounts:FinanceAccount[]):Entry;matches(url:URL,entry:Entry):boolean;replacedDeleted(account:Entry['finance_account']|FinanceAccount,accounts:FinanceAccount[]):boolean;normalize(value:string):string;accentSql(expression:string):string;positive(value:string|null,fallback:number):number;hydrateLink(pool:pg.Pool,organizationId:string,entry:Entry):Promise<Entry>}
export function createCashbookQueryRepository(pool:pg.Pool,deps:CashbookQueryDeps):Pick<ServerRepository,'listCashbookEntries'|'listCashbookEntriesPage'|'getCashbookEntry'>{const {ensureTables,userNames,accountsForExclusion,mapRow,hydrateUser,hydrateAccount,matches,replacedDeleted,normalize,accentSql,positive,hydrateLink}=deps;return{
    async listCashbookEntries(input) {
      await ensureTables(pool)
      const userDisplayNames = await userNames(pool, input.organizationId)
      const result = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
          order by created_at desc
        `,
        [input.organizationId],
      )
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const entries = result.rows
        .map(mapRow)
        .map((entry) => hydrateUser(entry, userDisplayNames))
        .map((entry) => hydrateAccount(entry, accounts))
      if (input.url.searchParams.get('exclude_replaced_deleted_accounts') !== 'true') {
        return entries.filter((entry) => matches(input.url, entry))
      }
      return entries.filter((entry) => !replacedDeleted(entry.finance_account, accounts)).filter((entry) => matches(input.url, entry))
    },

    async listCashbookEntriesPage(input) {
      await ensureTables(pool)
      const page = positive(input.url.searchParams.get('page'), 1)
      const pageSize = positive(input.url.searchParams.get('page_size'), 20)
      const offset = (page - 1) * pageSize
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userNames(pool, input.organizationId)
      const values: unknown[] = [input.organizationId]
      const filters = ['ce.organization_id = $1']
      const dateFilters: string[] = []

      const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
      }
      const financeAccountId = input.url.searchParams.get('finance_account_id')
      const financeAccountType = input.url.searchParams.get('finance_account_type')
      const direction = input.url.searchParams.get('direction')
      const status = input.url.searchParams.get('status')
      const isBusinessAccounted = input.url.searchParams.get('is_business_accounted')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const search = normalize(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const searchScope = input.url.searchParams.get('search_scope') ?? 'all'
      let fromPlaceholder: string | null = null

      if (financeAccountId && financeAccountId !== 'all') {
        filters.push(`coalesce(fa.id, ce.finance_account->>'id') = ${addValue(financeAccountId)}`)
      }
      if (financeAccountType && financeAccountType !== 'all') {
        filters.push(`coalesce(fa.account_type, ce.finance_account->>'account_type') = ${addValue(financeAccountType)}`)
      }
      if (direction && direction !== 'all') {
        filters.push(`ce.direction = ${addValue(direction)}`)
      }
      if (status && status !== 'all') {
        filters.push(`ce.status = ${addValue(status)}`)
      }
      if (isBusinessAccounted === 'true' || isBusinessAccounted === 'false') {
        filters.push(`ce.is_business_accounted = ${addValue(isBusinessAccounted === 'true')}`)
      }
      if (input.url.searchParams.get('exclude_replaced_deleted_accounts') === 'true') {
        const excludedFinanceAccountIds = accounts
          .filter((account: FinanceAccount) => replacedDeleted(account, accounts))
          .map((account: FinanceAccount) => account.id)
        if (excludedFinanceAccountIds.length > 0) {
          filters.push(`coalesce(ce.finance_account->>'id', '') <> all(${addValue(excludedFinanceAccountIds)}::text[])`)
        }
      }
      if (from) {
        fromPlaceholder = addValue(from)
        dateFilters.push(`(created_at at time zone 'UTC')::date >= ${fromPlaceholder}::date`)
      }
      if (to) {
        dateFilters.push(`(created_at at time zone 'UTC')::date <= ${addValue(to)}::date`)
      }
      if (search) {
        const searchPlaceholder = addValue(`%${search}%`)
        const scopedSearchExpressions: Record<string, string[]> = {
          code: ['ce.code'],
          note: ["coalesce(ce.note, '')"],
          transfer_content: ["coalesce(ce.source->>'transfer_content', '')"],
          counterparty: ["coalesce(ce.counterparty->>'name', '')", "coalesce(ce.counterparty->>'phone', '')", "coalesce(ce.source->>'counterparty_code', '')"],
          finance_account: ["coalesce(fa.account_number, fa.code, ce.finance_account->>'code', '')", "coalesce(fa.name, ce.finance_account->>'name', '')"],
          all: [
            'ce.code',
            "coalesce(ce.note, '')",
            "coalesce(ce.counterparty->>'name', '')",
            "coalesce(ce.counterparty->>'phone', '')",
            "coalesce(ce.source->>'counterparty_code', '')",
            "coalesce(fa.account_number, fa.code, ce.finance_account->>'code', '')",
            "coalesce(fa.name, ce.finance_account->>'name', '')",
            "coalesce(ce.source->>'transfer_content', '')",
          ],
        }
        const expressions = scopedSearchExpressions[searchScope] ?? scopedSearchExpressions.all
        filters.push(`(${expressions.map((expression) => `${accentSql(expression)} like ${searchPlaceholder}`).join(' or ')})`)
      }

      const currentDateWhere = dateFilters.length > 0 ? dateFilters.join(' and ') : 'true'
      const openingWhere = fromPlaceholder ? `(created_at at time zone 'UTC')::date < ${fromPlaceholder}::date` : 'false'
      values.push(pageSize, offset)
      const limitPlaceholder = `$${values.length - 1}`
      const offsetPlaceholder = `$${values.length}`
      const result = await pool.query(
        `
          with base_entries as (
            select ce.*
            from cashbook_entries ce
            left join finance_accounts fa
              on fa.organization_id = ce.organization_id
             and fa.id = ce.finance_account->>'id'
            where ${filters.join(' and ')}
          ),
          filtered_summary as (
            select
              count(*)::int as total,
              coalesce(sum(greatest(amount_delta, 0)), 0) as total_in,
              coalesce(sum(greatest(-amount_delta, 0)), 0) as total_out
            from base_entries
            where ${currentDateWhere}
          ),
          opening_summary as (
            select coalesce(sum(amount_delta), 0) as opening_balance
            from base_entries
            where ${openingWhere}
          ),
          paged_entries as (
            select *
            from base_entries
            where ${currentDateWhere}
            order by created_at desc
            limit ${limitPlaceholder}
            offset ${offsetPlaceholder}
          )
          select
            pe.*,
            fs.total,
            fs.total_in,
            fs.total_out,
            os.opening_balance
          from filtered_summary fs
          cross join opening_summary os
          left join paged_entries pe on true
          order by pe.created_at desc nulls last
        `,
        values,
      )
      const firstRow = result.rows[0]
      const total = Number(firstRow?.total ?? 0)
      const openingBalance = Number(firstRow?.opening_balance ?? 0)
      const totalIn = Number(firstRow?.total_in ?? 0)
      const totalOut = Number(firstRow?.total_out ?? 0)
      return {
        items: result.rows
          .filter((row) => row.id)
          .map(mapRow)
          .map((entry) => hydrateUser(entry, userDisplayNames))
          .map((entry) => hydrateAccount(entry, accounts)),
        total,
        summary: {
          opening_balance: openingBalance,
          total_in: totalIn,
          total_out: totalOut,
          ending_balance: openingBalance + totalIn - totalOut,
        },
      }
    },

    async getCashbookEntry(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
            and id = $2
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!result.rows[0]) return null
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userNames(pool, input.organizationId)
      const entry = hydrateAccount(hydrateUser(mapRow(result.rows[0]), userDisplayNames), accounts)
      return hydrateLink(pool, input.organizationId, entry)
    },

  }}
