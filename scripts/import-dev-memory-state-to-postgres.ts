import { mkdir, readFile, copyFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { createPgRepository } from '../server/db.js'
import type { ProductListData, PurchaseReceiptData, SalesDocumentData, CustomerListData, SupplierListData, CashbookEntryData, FinanceAccountData } from '../server/http.js'

const { Pool } = pg

type Entry<T> = [string, T]

interface DevMemoryState {
  version: 1
  products?: Array<Entry<ProductListData>>
  defaultSalePrices?: Array<[string, number]>
  provisionalStockBalances?: Array<[string, { quantity: number; unit_name: string; source_label: string | null }]>
  draftBoms?: Array<[string, unknown]>
  stocktakeItems?: Array<[string, Array<[number, unknown]>]>
  purchaseReceipts?: Array<Entry<PurchaseReceiptData>>
  salesDocuments?: Array<Entry<SalesDocumentData>>
  customers?: Array<Entry<CustomerListData>>
  suppliers?: Array<Entry<SupplierListData>>
  financeAccounts?: Array<Entry<FinanceAccountData>>
  cashbookEntries?: Array<Entry<CashbookEntryData>>
}

const root = process.cwd()
const stateFile = resolve(process.env.QCVL_STATE_FILE ?? join(root, 'logs', 'dev-memory-state.json'))
const confirmImport = process.env.QCVL_IMPORT_CONFIRM === 'true'
const organizationCode = process.env.QCVL_IMPORT_ORGANIZATION_CODE ?? 'VAN-LAM'

function readEnvFile(path: string) {
  if (!existsSync(path)) return {} as Record<string, string>
  const entries: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    entries[key] = value
  }
  return entries
}

function postgresUrlFromParts(env: Record<string, string>) {
  if (!env.POSTGRES_DB || !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) return undefined
  const host = process.env.QCVL_NAS_DB_HOST ?? env.POSTGRES_HOST ?? '100.84.228.125'
  const port = process.env.QCVL_NAS_DB_PORT ?? env.POSTGRES_PORT ?? '55433'
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`
}

function databaseUrl() {
  const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\100.84.228.125\\docker\\QCVL\\app'
  const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? join(dirname(nasRoot), '.env')
  const nasEnv = readEnvFile(nasEnvPath)
  return process.env.QCVL_NAS_DATABASE_URL ?? process.env.DATABASE_URL ?? nasEnv.DATABASE_URL ?? postgresUrlFromParts(nasEnv)
}

function mapValues<T>(entries: Array<Entry<T>> | undefined) {
  return (entries ?? []).map(([, value]) => value)
}

function flattenRows(entries: Array<[string, Array<[number, unknown]>]> | undefined) {
  return (entries ?? []).flatMap(([, rows]) => rows.map(([, row]) => row))
}

export function financeAccountsFromState(state: Pick<DevMemoryState, 'financeAccounts' | 'cashbookEntries'>) {
  const accounts = new Map<string, FinanceAccountData>()
  for (const account of mapValues(state.financeAccounts)) {
    accounts.set(account.id, account)
  }
  for (const entry of mapValues(state.cashbookEntries)) {
    const account = entry.finance_account
    if (!account.id || accounts.has(account.id)) continue
    accounts.set(account.id, {
      id: account.id,
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      is_default_cash: account.account_type === 'cash',
      is_active: !/\{DEL\}/i.test(`${account.id} ${account.code} ${account.name}`),
      account_number: account.account_type === 'bank' ? account.code : null,
      account_holder: account.account_type === 'bank' ? account.name : null,
      opening_balance: 0,
      note: null,
      notify_on_transaction: false,
    })
  }
  return [...accounts.values()]
}

export function cashbookEntriesFromState(state: Pick<DevMemoryState, 'cashbookEntries'>) {
  return mapValues(state.cashbookEntries)
}

export function summarizeDevMemoryState(state: DevMemoryState) {
  return {
    products: state.products?.length ?? 0,
    customers: state.customers?.length ?? 0,
    suppliers: state.suppliers?.length ?? 0,
    stocktakeRows: flattenRows(state.stocktakeItems).length,
    purchaseReceipts: state.purchaseReceipts?.length ?? 0,
    salesDocuments: state.salesDocuments?.length ?? 0,
    financeAccounts: financeAccountsFromState(state).length,
    cashbookEntries: cashbookEntriesFromState(state).length,
  }
}

async function backupState() {
  const backupDir = join(root, 'backups')
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = join(backupDir, `dev-memory-state-${stamp}.json`)
  await copyFile(stateFile, target)
  return target
}

async function resolveOrganizationId(pool: pg.Pool) {
  const result = await pool.query('select id::text from organizations where code = $1 limit 1', [organizationCode])
  const id = result.rows[0]?.id
  if (!id) throw new Error(`Organization code not found: ${organizationCode}`)
  return String(id)
}

async function ensureSnapshotTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists customer_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query(`
    create table if not exists supplier_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query(`
    create table if not exists purchase_receipt_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
}

async function ensureFinanceAccountTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists finance_accounts (
      id text not null,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      account_type text not null check (account_type in ('cash', 'bank')),
      is_default_cash boolean not null default false,
      is_active boolean not null default true,
      account_number text,
      account_holder text,
      opening_balance numeric(14,2) not null default 0,
      note text,
      notify_on_transaction boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (organization_id, id)
    )
  `)
  await pool.query('create index if not exists finance_accounts_org_type_idx on finance_accounts (organization_id, account_type, is_active, name)')
}

async function upsertSnapshot(pool: pg.Pool, table: string, organizationId: string, id: string, code: string, data: unknown, createdAt: string | null | undefined) {
  await pool.query(
    `
      insert into ${table} (id, organization_id, code, data, source_type, created_at, updated_at)
      values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now())
      on conflict (organization_id, code)
      do update set data = excluded.data, source_type = excluded.source_type, updated_at = now()
    `,
    [id, organizationId, code, JSON.stringify(data), createdAt ?? null],
  )
}

async function ensureSalesTables(repo: ReturnType<typeof createPgRepository>, organizationId: string) {
  await repo.listSalesDocuments?.({ organizationId, url: new URL('http://api.local/api/v1/sales-documents') })
}

async function upsertSalesDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  await pool.query(
    `
      insert into orders (
        id, organization_id, code, order_type, status, customer_id,
        customer_snapshot, seller_snapshot, subtotal_amount, discount_amount,
        total_amount, paid_amount, debt_amount, payment_status, note, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, now())
      on conflict (organization_id, code)
      do update set
        status = excluded.status,
        customer_id = excluded.customer_id,
        customer_snapshot = excluded.customer_snapshot,
        seller_snapshot = excluded.seller_snapshot,
        subtotal_amount = excluded.subtotal_amount,
        discount_amount = excluded.discount_amount,
        total_amount = excluded.total_amount,
        paid_amount = excluded.paid_amount,
        debt_amount = excluded.debt_amount,
        payment_status = excluded.payment_status,
        note = excluded.note,
        created_at = excluded.created_at,
        updated_at = now()
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
      document.note ?? '',
      document.created_at,
    ],
  )
  await pool.query('delete from order_items where organization_id = $1 and order_id = $2', [organizationId, document.id])
  for (const [index, item] of document.items.entries()) {
    await pool.query(
      `
        insert into order_items (organization_id, order_id, product_id, product_snapshot, quantity, unit_price, discount_amount, line_total, sort_order)
        values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
      `,
      [
        organizationId,
        document.id,
        item.product_id,
        JSON.stringify(item),
        'quantity' in item && typeof item.quantity === 'number' ? item.quantity : 0,
        'unit_price' in item && typeof item.unit_price === 'number' ? item.unit_price : 0,
        'discount_amount' in item && typeof item.discount_amount === 'number' ? item.discount_amount : 0,
        'line_total' in item && typeof item.line_total === 'number' ? item.line_total : 0,
        index + 1,
      ],
    )
  }
}

function valuePlaceholders(start: number, width: number, rows: number) {
  return Array.from({ length: rows }, (_, rowIndex) => {
    const offset = start + rowIndex * width
    return `(${Array.from({ length: width }, (_, columnIndex) => `$${offset + columnIndex}`).join(', ')})`
  }).join(', ')
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

async function upsertSalesDocuments(pool: pg.Pool, organizationId: string, documents: SalesDocumentData[]) {
  if (documents.length === 0) return
  await pool.query('begin')
  try {
    for (const batch of chunks(documents, 500)) {
      const values = batch.flatMap((document) => [
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
        document.note ?? '',
        document.created_at,
      ])
      await pool.query(
        `
          insert into orders (
            id, organization_id, code, order_type, status, customer_id,
            customer_snapshot, seller_snapshot, subtotal_amount, discount_amount,
            total_amount, paid_amount, debt_amount, payment_status, note, created_at
          )
          values ${valuePlaceholders(1, 16, batch.length)}
          on conflict (organization_id, code)
          do update set
            status = excluded.status,
            customer_id = excluded.customer_id,
            customer_snapshot = excluded.customer_snapshot,
            seller_snapshot = excluded.seller_snapshot,
            subtotal_amount = excluded.subtotal_amount,
            discount_amount = excluded.discount_amount,
            total_amount = excluded.total_amount,
            paid_amount = excluded.paid_amount,
            debt_amount = excluded.debt_amount,
            payment_status = excluded.payment_status,
            note = excluded.note,
            created_at = excluded.created_at,
            updated_at = now()
        `,
        values,
      )
    }

    for (const batch of chunks(documents, 1000)) {
      await pool.query('delete from order_items where organization_id = $1 and order_id = any($2::text[])', [
        organizationId,
        batch.map((document) => document.id),
      ])
    }

    const items = documents.flatMap((document) => document.items.map((item, index) => ({ document, item, index })))
    for (const batch of chunks(items, 1000)) {
      const values = batch.flatMap(({ document, item, index }) => [
        organizationId,
        document.id,
        item.product_id,
        JSON.stringify(item),
        'quantity' in item && typeof item.quantity === 'number' ? item.quantity : 0,
        'unit_price' in item && typeof item.unit_price === 'number' ? item.unit_price : 0,
        'discount_amount' in item && typeof item.discount_amount === 'number' ? item.discount_amount : 0,
        'line_total' in item && typeof item.line_total === 'number' ? item.line_total : 0,
        index + 1,
      ])
      await pool.query(
        `
          insert into order_items (
            organization_id, order_id, product_id, product_snapshot,
            quantity, unit_price, discount_amount, line_total, sort_order
          )
          values ${valuePlaceholders(1, 9, batch.length)}
        `,
        values,
      )
    }
    await pool.query('commit')
  } catch (error) {
    await pool.query('rollback')
    throw error
  }
}

async function upsertFinanceAccounts(pool: pg.Pool, organizationId: string, accounts: FinanceAccountData[]) {
  if (accounts.length === 0) return
  await ensureFinanceAccountTables(pool)
  for (const batch of chunks(accounts, 500)) {
    const values = batch.flatMap((account) => [
      account.id,
      organizationId,
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
    ])
    await pool.query(
      `
        insert into finance_accounts (
          id, organization_id, code, name, account_type, is_default_cash, is_active,
          account_number, account_holder, opening_balance, note, notify_on_transaction
        )
        values ${valuePlaceholders(1, 12, batch.length)}
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
      `,
      values,
    )
  }
}

async function upsertCashbookEntries(pool: pg.Pool, organizationId: string, entries: CashbookEntryData[]) {
  if (entries.length === 0) return
  await pool.query('begin')
  try {
    await pool.query(
      `
        delete from cashbook_entries
        where organization_id = $1
          and not (code = any($2::text[]))
      `,
      [organizationId, entries.map((entry) => entry.code)],
    )
    for (const batch of chunks(entries, 500)) {
      const values = batch.flatMap((entry) => [
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
        JSON.stringify(entry.source ?? {}),
        JSON.stringify(entry.allocations ?? []),
        entry.is_business_accounted,
        entry.created_at,
      ])
      await pool.query(
        `
          insert into cashbook_entries (
            id, organization_id, code, status, direction, amount_delta, finance_account,
            counterparty, note, source_type, source, allocations, is_business_accounted, created_at
          )
          values ${valuePlaceholders(1, 14, batch.length)}
          on conflict (organization_id, code)
          do update set
            id = excluded.id,
            status = excluded.status,
            direction = excluded.direction,
            amount_delta = excluded.amount_delta,
            finance_account = excluded.finance_account,
            counterparty = excluded.counterparty,
            note = excluded.note,
            source_type = excluded.source_type,
            source = excluded.source,
            allocations = excluded.allocations,
            is_business_accounted = excluded.is_business_accounted,
            created_at = excluded.created_at
        `,
        values,
      )
    }
    await pool.query('commit')
  } catch (error) {
    await pool.query('rollback')
    throw error
  }
}

async function main() {
  const raw = await readFile(stateFile, 'utf8')
  const state = JSON.parse(raw) as DevMemoryState
  if (state.version !== 1) throw new Error(`Unsupported dev-memory state version: ${String(state.version)}`)

  const counts = summarizeDevMemoryState(state)
  console.log(JSON.stringify({ mode: confirmImport ? 'write' : 'dry-run', stateFile, counts }, null, 2))

  const url = databaseUrl()
  if (!url) throw new Error('DATABASE_URL is required. Set QCVL_NAS_DATABASE_URL, DATABASE_URL, or NAS .env POSTGRES_* values.')
  const pool = new Pool({ connectionString: url })
  const repo = createPgRepository(url)
  try {
    const organizationId = await resolveOrganizationId(pool)
    if (!confirmImport) {
      console.log('Dry-run only. Set QCVL_IMPORT_CONFIRM=true to write PostgreSQL.')
      return
    }

    const backupPath = await backupState()
    console.log(`Backed up state: ${backupPath}`)

    await ensureSnapshotTables(pool)
    await ensureFinanceAccountTables(pool)
    const products = mapValues(state.products)
    const groupNames = [...new Set(products.map((product) => product.product_group?.name).filter((name): name is string => Boolean(name)))]
    const groupIds = await repo.upsertProductGroupsByName?.({ organizationId, names: groupNames }) ?? new Map<string, string>()
    await repo.upsertProductsByCode?.({
      organizationId,
      rows: products.map((product) => ({
        code: product.code,
        name: product.name,
        status: product.status,
        product_group_id: product.product_group?.name ? groupIds.get(product.product_group.name) ?? product.product_group_id : product.product_group_id,
        unit_name: product.unit_name,
        sell_method: product.sell_method,
        product_kind: product.product_kind,
        inventory_shape: product.inventory_shape,
        track_inventory: product.track_inventory,
        latest_purchase_cost: product.latest_purchase_cost,
        source_created_at: product.created_at,
        unit_conversions: Array.isArray(product.unit_conversions) ? product.unit_conversions as never[] : [],
      })),
    })

    const priceList = await repo.findDefaultPriceList?.({ organizationId })
    if (priceList) {
      await repo.upsertDefaultPriceListItems?.({
        organizationId,
        priceListId: priceList.id,
        rows: (state.defaultSalePrices ?? []).map(([productCode, unitPrice]) => ({ product_code: productCode, unit_price: unitPrice })),
      })
    }
    await repo.upsertProvisionalStockBalances?.({
      organizationId,
      rows: (state.provisionalStockBalances ?? []).map(([productCode, value]) => ({
        product_code: productCode,
        quantity: value.quantity,
        unit_name: value.unit_name,
        source_label: value.source_label ?? 'Dev-memory import',
      })),
    })
    await repo.upsertDraftProductBoms?.({ organizationId, rows: mapValues(state.draftBoms as Array<Entry<never>> | undefined) })
    await repo.upsertImportedKiotVietStocktakes?.({ organizationId, createdBy: null, rows: flattenRows(state.stocktakeItems) as never[] })

    for (const customer of mapValues(state.customers)) {
      await upsertSnapshot(pool, 'customer_snapshots', organizationId, customer.id, customer.code, customer, customer.created_at)
    }
    for (const supplier of mapValues(state.suppliers)) {
      await upsertSnapshot(pool, 'supplier_snapshots', organizationId, supplier.id, supplier.code, supplier, supplier.created_at)
    }
    for (const receipt of mapValues(state.purchaseReceipts)) {
      await upsertSnapshot(pool, 'purchase_receipt_snapshots', organizationId, receipt.id, receipt.code, receipt, receipt.received_at)
    }

    await ensureSalesTables(repo, organizationId)
    await upsertSalesDocuments(pool, organizationId, mapValues(state.salesDocuments))
    await upsertFinanceAccounts(pool, organizationId, financeAccountsFromState(state))
    await upsertCashbookEntries(pool, organizationId, cashbookEntriesFromState(state))

    console.log(JSON.stringify({ imported: counts }, null, 2))
  } finally {
    await repo.close()
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
