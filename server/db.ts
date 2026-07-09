import pg from 'pg'
import { randomUUID } from 'node:crypto'
import type { CashbookEntryData, CurrentUserData, CustomerDebtSummaryData, SalesDocumentData, ServerRepository, WorkstationData } from './http.js'

const { Pool } = pg

export function createPgRepository(databaseUrl: string): ServerRepository & { close(): Promise<void> } {
  const pool = new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 })

  return {
    async findUserByEmail(email) {
      const result = await pool.query(
        `
          select id, email, password_hash, organization_id, display_name, status
          from users
          where email = $1
          limit 1
        `,
        [email],
      )
      return result.rows[0] ?? null
    },

    async createSession(input) {
      await pool.query(
        `
          insert into sessions (token, user_id, expires_at)
          values ($1, $2, $3)
        `,
        [input.token, input.userId, input.expiresAt],
      )
    },

    async deleteSession(token) {
      await pool.query('delete from sessions where token = $1', [token])
    },

    async getSessionUser(token, workstationId) {
      const result = await pool.query(
        `
          select
            u.id as user_id,
            u.email,
            u.display_name,
            u.status as user_status,
            o.id as organization_id,
            o.code as organization_code,
            o.name as organization_name,
            coalesce(
              jsonb_agg(up.permission_code order by up.permission_code)
                filter (where up.permission_code is not null),
              '[]'::jsonb
            ) as permissions
          from sessions s
          join users u on u.id = s.user_id
          join organizations o on o.id = u.organization_id
          left join user_permissions up on up.user_id = u.id
          left join permissions p on p.code = up.permission_code and p.status = 'active'
          where s.token = $1
            and s.expires_at > now()
            and u.status = 'active'
          group by u.id, o.id
          limit 1
        `,
        [token],
      )
      const row = result.rows[0]
      if (!row) return null

      const workstation = workstationId
        ? await findWorkstation(pool, row.organization_id, workstationId)
        : null

      return {
        user: { id: row.user_id, email: row.email, display_name: row.display_name },
        organization: {
          id: row.organization_id,
          code: row.organization_code,
          name: row.organization_name,
        },
        workstation,
        permissions: row.permissions,
      } satisfies CurrentUserData
    },

    async listWorkstations(organizationId) {
      const result = await pool.query(
        `
          select id, code, name, status
          from workstations
          where organization_id = $1
          order by code
        `,
        [organizationId],
      )
      return result.rows as WorkstationData[]
    },

    async getPosProductUsageCounts(organizationId) {
      await ensurePosProductUsageTable(pool)
      const result = await pool.query(
        `
          select product_id, usage_count
          from pos_product_usage
          where organization_id = $1
        `,
        [organizationId],
      )
      return new Map(result.rows.map((row) => [row.product_id, Number(row.usage_count)]))
    },

    async recordPosProductUsage(input) {
      const productCounts = new Map<string, number>()
      for (const productId of input.productIds) {
        productCounts.set(productId, (productCounts.get(productId) ?? 0) + 1)
      }
      if (productCounts.size === 0) return
      await ensurePosProductUsageTable(pool)
      await pool.query('begin')
      try {
        for (const [productId, count] of productCounts) {
          await pool.query(
            `
              insert into pos_product_usage (organization_id, product_id, usage_count)
              values ($1, $2, $3)
              on conflict (organization_id, product_id)
              do update set
                usage_count = pos_product_usage.usage_count + excluded.usage_count,
                updated_at = now()
            `,
            [input.organizationId, productId, count],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async ensureSalesFinanceSeed(input) {
      await ensureSalesFinanceTables(pool)
      const count = await pool.query('select count(*)::int as count from orders where organization_id = $1', [input.organizationId])
      if (Number(count.rows[0]?.count ?? 0) > 0) return

      await pool.query('begin')
      try {
        for (const document of input.documents) {
          await insertSalesDocument(pool, input.organizationId, document)
        }
        for (const entry of input.cashbookEntries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async saveSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      await pool.query('begin')
      try {
        await insertSalesDocument(pool, input.organizationId, input.document)

        if (input.cashbookEntries.length > 0) {
          const receiptId = input.cashbookEntries[0].id
          const receiptCode = input.cashbookEntries[0].code
          const totalReceived = input.cashbookEntries.reduce((sum, entry) => sum + Math.max(entry.amount_delta, 0), 0)
          await pool.query(
            `
              insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [receiptId, input.organizationId, receiptCode, input.document.customer.id, input.document.id, totalReceived, input.cashbookEntries[0].note, input.cashbookEntries[0].created_at],
          )

          for (const entry of input.cashbookEntries) {
            await pool.query(
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
          await insertCashbookEntry(pool, input.organizationId, entry)
        }

        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async listSalesDocuments(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(jsonb_build_object('product_id', oi.product_id) order by oi.sort_order)
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          where o.organization_id = $1
          group by o.id
          order by o.updated_at desc, o.created_at desc
        `,
        [input.organizationId],
      )
      return result.rows.map(mapOrderRow).filter((document) => salesDocumentMatches(input.url, document))
    },

    async getSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(jsonb_build_object('product_id', oi.product_id) order by oi.sort_order)
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          where o.organization_id = $1 and o.id = $2
          group by o.id
          limit 1
        `,
        [input.organizationId, input.id],
      )
      return result.rows[0] ? mapOrderRow(result.rows[0]) : null
    },

    async getCustomerDebt(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select o.id, o.code, o.created_at, o.total_amount, o.paid_amount, o.debt_amount, cde.remaining_debt
          from customer_debt_entries cde
          join orders o on o.id = cde.order_id
          where cde.organization_id = $1
            and cde.customer_id = $2
            and cde.status = 'open'
            and cde.remaining_debt > 0
          order by cde.updated_at desc, cde.created_at desc
        `,
        [input.organizationId, input.customerId],
      )
      const invoices = result.rows.map((row) => ({
        order_id: row.id,
        order_code: row.code,
        created_at: row.created_at.toISOString(),
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        debt_amount: Number(row.debt_amount),
        remaining_debt: Number(row.remaining_debt),
      }))
      return {
        customer_id: input.customerId,
        total_debt: invoices.reduce((sum, invoice) => sum + invoice.remaining_debt, 0),
        invoices,
      }
    },

    async listCustomerDebts(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select
            cde.customer_id,
            min(o.customer_snapshot->>'code') as customer_code,
            min(o.customer_snapshot->>'name') as customer_name,
            sum(cde.remaining_debt) as total_debt,
            count(*)::int as open_invoice_count,
            (array_agg(o.code order by cde.created_at asc))[1] as oldest_order_code
          from customer_debt_entries cde
          join orders o on o.id = cde.order_id
          where cde.organization_id = $1
            and cde.status = 'open'
            and cde.remaining_debt > 0
          group by cde.customer_id
          order by max(cde.created_at) desc
        `,
        [input.organizationId],
      )
      return result.rows.map((row) => ({
        customer_id: row.customer_id,
        customer_code: row.customer_code,
        customer_name: row.customer_name,
        total_debt: Number(row.total_debt),
        oldest_order_code: row.oldest_order_code,
        open_invoice_count: Number(row.open_invoice_count),
        invoices: [],
      })).filter((debt) => customerDebtMatches(input.url, debt))
    },

    async collectCustomerDebt(input) {
      await ensureSalesFinanceTables(pool)
      if (input.amount <= 0 || input.cashAmount + input.bankAmount !== input.amount) {
        return { payment_receipt_id: '', allocated_amount: 0 }
      }

      await pool.query('begin')
      try {
        const debtRows = await pool.query(
          `
            select
              cde.id as debt_id,
              cde.remaining_debt,
              o.id as order_id,
              o.code as order_code,
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
        )

        let remainingPayment = input.amount
        const allocations: Array<{
          order_id: string
          order_code: string
          order_total_amount: number
          collected_before: number
          allocated_amount: number
          remaining_after: number
        }> = []

        for (const row of debtRows.rows) {
          if (remainingPayment <= 0) break
          const allocated = Math.min(Number(row.remaining_debt), remainingPayment)
          const nextDebt = Math.max(Number(row.remaining_debt) - allocated, 0)
          const nextPaid = Number(row.paid_amount) + allocated
          const paymentStatus = nextDebt <= 0 ? 'paid' : nextPaid <= 0 ? 'unpaid' : 'partial'
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
          })
          remainingPayment -= allocated
        }

        const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
        if (allocatedAmount <= 0) {
          await pool.query('commit')
          return { payment_receipt_id: '', allocated_amount: 0 }
        }

        const receiptId = randomUUID()
        const receiptCode = `PT-CN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`
        const firstCustomer = debtRows.rows[0]?.customer_snapshot ?? { name: 'Khach hang', phone: null }
        const allocationCodes = allocations.map((allocation) => allocation.order_code).join(', ')
        const note = input.note?.trim() ? `${input.note.trim()} - ${allocationCodes}` : `Thu no ${allocationCodes}`
        await pool.query(
          `
            insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, now())
          `,
          [receiptId, input.organizationId, receiptCode, input.customerId, allocations[0]?.order_id ?? null, allocatedAmount, note],
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
              values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
            `,
            [
              input.organizationId,
              receiptId,
              allocations[0]?.order_id ?? null,
              method.method,
              method.account.id,
              method.amount,
              method.method === 'bank_transfer' ? input.bankTransactionRef ?? null : null,
              JSON.stringify(allocations),
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
            created_at: new Date().toISOString(),
            note: method.method === 'bank_transfer' && input.bankTransactionRef ? `${note} (${input.bankTransactionRef})` : note,
            counterparty: { type: 'customer', name: firstCustomer.name, phone: firstCustomer.phone },
            source: { type: 'payment_receipt', id: receiptId, code: receiptCode, order_code: allocations[0]?.order_code ?? null },
            allocations,
          } as CashbookEntryData)
        }

        for (const entry of entries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }

        await pool.query('commit')
        return { payment_receipt_id: receiptCode, allocated_amount: allocatedAmount }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async listCashbookEntries(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
          order by created_at desc
        `,
        [input.organizationId],
      )
      return result.rows.map(mapCashbookRow).filter((entry) => cashbookEntryMatches(input.url, entry))
    },

    async getCustomerFinancialTotals(organizationId) {
      await ensureSalesFinanceTables(pool)
      const sales = await pool.query(
        `
          select customer_id, sum(total_amount) as total_sales_amount
          from orders
          where organization_id = $1
            and order_type = 'invoice'
            and status <> 'cancelled'
            and customer_id is not null
          group by customer_id
        `,
        [organizationId],
      )
      const debts = await pool.query(
        `
          select customer_id, sum(remaining_debt) as total_debt_amount
          from customer_debt_entries
          where organization_id = $1
            and status = 'open'
            and remaining_debt > 0
          group by customer_id
        `,
        [organizationId],
      )
      const totals = new Map<string, { total_sales_amount: number; total_debt_amount: number }>()
      for (const row of sales.rows) {
        totals.set(row.customer_id, { total_sales_amount: Number(row.total_sales_amount), total_debt_amount: 0 })
      }
      for (const row of debts.rows) {
        const existing = totals.get(row.customer_id) ?? { total_sales_amount: 0, total_debt_amount: 0 }
        totals.set(row.customer_id, { ...existing, total_debt_amount: Number(row.total_debt_amount) })
      }
      return totals
    },

    async close() {
      await pool.end()
    },
  }
}

async function ensurePosProductUsageTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists pos_product_usage (
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id text not null,
      usage_count integer not null default 0 check (usage_count >= 0),
      updated_at timestamptz not null default now(),
      primary key (organization_id, product_id)
    )
  `)
  await pool.query('create index if not exists pos_product_usage_rank_idx on pos_product_usage (organization_id, usage_count desc, product_id)')
}

async function ensureSalesFinanceTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists orders (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      order_type text not null check (order_type in ('invoice', 'quote')),
      status text not null,
      customer_id text,
      customer_snapshot jsonb not null,
      seller_snapshot jsonb not null,
      subtotal_amount numeric(14,2) not null default 0,
      discount_amount numeric(14,2) not null default 0,
      total_amount numeric(14,2) not null default 0,
      paid_amount numeric(14,2) not null default 0,
      debt_amount numeric(14,2) not null default 0,
      payment_status text not null,
      note text not null default '',
      source_quote_id text references orders(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists orders_org_type_created_idx on orders (organization_id, order_type, created_at desc)')
  await pool.query('create index if not exists orders_org_updated_created_idx on orders (organization_id, updated_at desc, created_at desc)')
  await pool.query('create index if not exists orders_org_customer_idx on orders (organization_id, customer_id)')
  await pool.query(`
    create table if not exists order_items (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      order_id text not null references orders(id) on delete cascade,
      product_id text not null,
      product_snapshot jsonb not null default '{}'::jsonb,
      quantity numeric(14,3) not null default 0,
      unit_price numeric(14,2) not null default 0,
      discount_amount numeric(14,2) not null default 0,
      line_total numeric(14,2) not null default 0,
      sort_order integer not null default 0
    )
  `)
  await pool.query('create index if not exists order_items_order_idx on order_items (order_id, sort_order)')
  await pool.query(`
    create table if not exists payment_receipts (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      customer_id text,
      order_id text references orders(id) on delete set null,
      total_received_amount numeric(14,2) not null default 0,
      note text not null default '',
      created_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query(`
    create table if not exists payment_receipt_methods (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      payment_receipt_id text not null references payment_receipts(id) on delete cascade,
      order_id text references orders(id) on delete set null,
      method text not null check (method in ('cash', 'bank_transfer')),
      finance_account_id text not null,
      amount numeric(14,2) not null,
      bank_transaction_ref text,
      allocations jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query(`
    create table if not exists customer_debt_entries (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      customer_id text not null,
      order_id text not null references orders(id) on delete cascade,
      original_amount numeric(14,2) not null,
      paid_amount numeric(14,2) not null default 0,
      remaining_debt numeric(14,2) not null,
      status text not null check (status in ('open', 'closed')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, order_id)
    )
  `)
  await pool.query('create index if not exists customer_debt_entries_customer_idx on customer_debt_entries (organization_id, customer_id, status, created_at desc)')
  await pool.query('create index if not exists customer_debt_entries_customer_updated_idx on customer_debt_entries (organization_id, customer_id, status, updated_at desc, created_at desc)')
  await pool.query(`
    create table if not exists cashbook_entries (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      status text not null default 'posted',
      direction text not null check (direction in ('in', 'out')),
      amount_delta numeric(14,2) not null,
      finance_account jsonb not null,
      counterparty jsonb not null,
      note text not null default '',
      source_type text not null,
      source jsonb not null default '{}'::jsonb,
      allocations jsonb not null default '[]'::jsonb,
      is_business_accounted boolean not null default true,
      created_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists cashbook_entries_org_created_idx on cashbook_entries (organization_id, created_at desc)')
}

type PgOrderRow = {
  id: string
  code: string
  order_type: 'invoice' | 'quote'
  status: string
  created_at: Date
  customer_snapshot: SalesDocumentData['customer']
  seller_snapshot: SalesDocumentData['seller']
  subtotal_amount: string | number
  discount_amount: string | number
  total_amount: string | number
  paid_amount: string | number
  debt_amount: string | number
  payment_status: string
  note: string
  items: SalesDocumentData['items']
}

type PgCashbookRow = {
  id: string
  code: string
  status: CashbookEntryData['status']
  direction: CashbookEntryData['direction']
  amount_delta: string | number
  finance_account: CashbookEntryData['finance_account']
  is_business_accounted: boolean
  source_type: CashbookEntryData['source_type']
  created_at: Date
  note: string
  counterparty: CashbookEntryData['counterparty']
  source?: CashbookEntryData['source']
  allocations?: CashbookEntryData['allocations']
}

async function insertSalesDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  await pool.query(
    `
      insert into orders (
        id, organization_id, code, order_type, status, customer_id,
        customer_snapshot, seller_snapshot, subtotal_amount, discount_amount,
        total_amount, paid_amount, debt_amount, payment_status, note, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, now())
      on conflict (organization_id, code) do nothing
    `,
    [
      document.id,
      organizationId,
      document.code,
      document.order_type,
      document.status,
      document.customer.id,
      JSON.stringify(document.customer),
      JSON.stringify(document.seller),
      document.subtotal_amount,
      document.discount_amount,
      document.total_amount,
      document.paid_amount,
      document.debt_amount,
      document.payment_status,
      document.note,
      document.created_at,
    ],
  )

  for (const [index, item] of document.items.entries()) {
    await pool.query(
      `
        insert into order_items (organization_id, order_id, product_id, product_snapshot, sort_order)
        values ($1, $2, $3, '{}'::jsonb, $4)
        on conflict do nothing
      `,
      [organizationId, document.id, item.product_id, index + 1],
    )
  }

  if (document.order_type === 'invoice' && document.debt_amount > 0) {
    await pool.query(
      `
        insert into customer_debt_entries (
          organization_id, customer_id, order_id, original_amount, paid_amount,
          remaining_debt, status, created_at, updated_at
        )
        values ($1, $2, $3, $4, 0, $4, 'open', $5, now())
        on conflict (organization_id, order_id) do nothing
      `,
      [organizationId, document.customer.id, document.id, document.debt_amount, document.created_at],
    )
  }
}

function mapOrderRow(row: PgOrderRow): SalesDocumentData {
  return {
    id: row.id,
    code: row.code,
    order_type: row.order_type,
    status: row.status,
    created_at: row.created_at.toISOString(),
    customer: row.customer_snapshot,
    seller: row.seller_snapshot,
    subtotal_amount: Number(row.subtotal_amount),
    discount_amount: Number(row.discount_amount),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    debt_amount: Number(row.debt_amount),
    payment_status: row.payment_status,
    note: row.note,
    items: row.items,
  }
}

function mapCashbookRow(row: PgCashbookRow): CashbookEntryData {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    direction: row.direction,
    amount_delta: Number(row.amount_delta),
    finance_account: row.finance_account,
    is_business_accounted: row.is_business_accounted,
    source_type: row.source_type,
    created_at: row.created_at.toISOString(),
    note: row.note,
    counterparty: row.counterparty,
    source: row.source,
    allocations: row.allocations,
  }
}

async function insertCashbookEntry(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  await pool.query(
    `
      insert into cashbook_entries (
        id, organization_id, code, status, direction, amount_delta, finance_account,
        counterparty, note, source_type, source, allocations, is_business_accounted, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12::jsonb, $13, $14)
      on conflict (organization_id, code) do nothing
    `,
    [
      entry.id,
      organizationId,
      entry.code,
      entry.status,
      entry.direction,
      entry.amount_delta,
      JSON.stringify(entry.finance_account),
      JSON.stringify(entry.counterparty),
      entry.note,
      entry.source_type,
      JSON.stringify('source' in entry ? entry.source : {}),
      JSON.stringify('allocations' in entry ? entry.allocations : []),
      entry.is_business_accounted,
      entry.created_at,
    ],
  )
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function salesDocumentMatches(url: URL, document: SalesDocumentData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')
  const customerId = url.searchParams.get('customer_id')
  const paymentStatus = url.searchParams.get('payment_status')
  if (type && document.order_type !== type) return false
  if (status && document.status !== status) return false
  if (customerId && document.customer.id !== customerId) return false
  if (paymentStatus && document.payment_status !== paymentStatus) return false
  if (search) {
    const haystack = normalizeSearchText(`${document.code} ${document.customer.code ?? ''} ${document.customer.name} ${document.note ?? ''}`)
    if (!haystack.includes(search)) return false
  }
  return true
}

function cashbookEntryMatches(url: URL, entry: CashbookEntryData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const financeAccountId = url.searchParams.get('finance_account_id')
  const financeAccountType = url.searchParams.get('finance_account_type')
  const direction = url.searchParams.get('direction')
  const status = url.searchParams.get('status')
  if (financeAccountId && financeAccountId !== 'all' && entry.finance_account.id !== financeAccountId) return false
  if (financeAccountType && financeAccountType !== 'all' && entry.finance_account.account_type !== financeAccountType) return false
  if (direction && direction !== 'all' && entry.direction !== direction) return false
  if (status && status !== 'all' && entry.status !== status) return false
  if (search) {
    const haystack = normalizeSearchText(`${entry.code} ${entry.note} ${entry.counterparty.name} ${entry.counterparty.phone ?? ''} ${entry.finance_account.code} ${entry.finance_account.name}`)
    if (!haystack.includes(search)) return false
  }
  return true
}

function customerDebtMatches(url: URL, debt: CustomerDebtSummaryData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  if (!search) return true
  const haystack = normalizeSearchText(`${debt.customer_code} ${debt.customer_name} ${debt.oldest_order_code}`)
  return haystack.includes(search)
}

function cashAccount() {
  return { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' }
}

function bankAccount(accountId?: string | null) {
  return {
    id: accountId && accountId.trim() !== '' ? accountId : 'bank-main',
    code: 'VCB',
    name: 'Vietcombank',
    account_type: 'bank',
  }
}

async function findWorkstation(pool: pg.Pool, organizationId: string, workstationId: string) {
  const result = await pool.query(
    `
      select id, code, name
      from workstations
      where organization_id = $1 and id = $2 and status = 'active'
      limit 1
    `,
    [organizationId, workstationId],
  )
  return result.rows[0] ?? null
}
