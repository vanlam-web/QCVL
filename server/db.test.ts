import { beforeEach, describe, expect, test, vi } from 'vitest'

const pgMock = vi.hoisted(() => {
  const query = vi.fn()
  const end = vi.fn()
  const Pool = vi.fn(function Pool() {
    return { query, end }
  })
  return { Pool, query, end }
})

vi.mock('pg', () => ({
  default: { Pool: pgMock.Pool },
}))

describe('createPgRepository product units', () => {
  beforeEach(() => {
    pgMock.Pool.mockClear()
    pgMock.query.mockReset()
    pgMock.end.mockReset()
  })

  test('persists imported product unit conversions into inventory tables', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('insert into products')) return { rows: [{ id: 'product-bt', inserted: true }], rowCount: 1 }
      if (sql.includes('insert into inventory_units')) return { rows: [{ id: `unit-${String(values?.[2]).toLowerCase()}` }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.upsertProductsByCode?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        code: 'BT',
        name: 'Bạt test',
        status: 'active',
        product_group_id: null,
        unit_name: 'm2',
        sell_method: 'area_m2',
        product_kind: 'roll',
        inventory_shape: 'roll',
        track_inventory: true,
        latest_purchase_cost: 20000,
        source_created_at: '2026-07-01T10:07:10.253Z',
        unit_conversions: [{
          source_code: 'B50',
          unit_name: 'Khổ 50',
          stock_qty_per_unit: 40,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        }],
        source: {} as never,
      }],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists inventory_units'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists product_unit_conversions'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('alter table product_unit_conversions add column if not exists source_code'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into inventory_units'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into product_inventory_settings'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into product_unit_conversions'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('source_code'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('update product_unit_conversions'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('created_at = coalesce(excluded.created_at, products.created_at)'))).toBe(true)
  })

  test('loads product unit conversions from PostgreSQL instead of a placeholder array', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockResolvedValue({
      rows: [{
        id: 'product-bt',
        code: 'BT',
        name: 'Bạt test',
        status: 'active',
        product_kind: 'roll',
        unit_name: 'm2',
        sell_method: 'area_m2',
        latest_purchase_cost: 20000,
        latest_purchase_cost_at: null,
        default_sale_price: null,
        product_group_id: null,
        product_group: null,
        inventory_shape: 'roll',
        track_inventory: true,
        unit_conversions: [{
          source_code: 'B50',
          unit_name: 'Khổ 50',
          stock_qty_per_unit: 40,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        }],
        created_at: new Date('2026-07-10T00:00:00.000Z'),
        updated_at: new Date('2026-07-10T00:00:00.000Z'),
      }],
    })

    const repository = createPgRepository('postgres://unit-test')
    const products = await repository.listProducts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/products?status=active&created_from=2026-07-01&created_to=2026-07-31'),
    })

    const listSql = String(pgMock.query.mock.calls.find(([sql]) =>
      String(sql).includes('from products p'),
    )?.[0])
    expect(listSql).toContain('product_unit_conversions')
    expect(listSql).toContain('source_code')
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).includes('create table if not exists products'))).toBe(false)
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).includes('alter table products add column if not exists product_group_id'))).toBe(false)
    expect(listSql).toContain(`(p.created_at at time zone 'UTC')::date >= $`)
    expect(listSql).toContain(`(p.created_at at time zone 'UTC')::date <= $`)
    expect(listSql).not.toContain(`'[]'::jsonb as unit_conversions`)
    expect(products?.[0].unit_conversions).toEqual([{
      source_code: 'B50',
      unit_name: 'Khổ 50',
      stock_qty_per_unit: 40,
      is_default_purchase_unit: true,
      is_default_sale_unit: false,
    }])
  })

  test('matches product lookup codes against KiotViet unit conversion source codes', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockResolvedValue({ rows: [{ code: 'B260' }], rowCount: 1 })

    const repository = createPgRepository('postgres://unit-test')
    const codes = await repository.findProductsByCodes?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      codes: ['B260'],
    })

    const lookupSql = String(pgMock.query.mock.calls[0]?.[0])
    expect(lookupSql).toContain('product_unit_conversions')
    expect(lookupSql).toContain('source_code')
    expect(codes).toEqual(new Set(['B260']))
  })

  test('deletes imported KiotViet products even when optional price tables are missing', async () => {
    const { createPgRepository } = await import('./db')
    let transactionAborted = false
    pgMock.query.mockImplementation(async (sql: string) => {
      const normalizedSql = sql.trim().toLowerCase()
      if (transactionAborted && normalizedSql !== 'rollback' && !normalizedSql.startsWith('rollback to savepoint')) {
        throw { code: '25P02', message: 'current transaction is aborted' }
      }
      if (normalizedSql.startsWith('rollback to savepoint')) {
        transactionAborted = false
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('from products') && sql.includes('where organization_id = $1')) {
        return { rows: [{ id: '11111111-1111-1111-1111-111111111111' }], rowCount: 1 }
      }
      if (sql.includes('delete from price_list_items')) {
        transactionAborted = true
        throw { code: '42P01' }
      }
      if (sql.includes('delete from products')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.deleteImportedKiotVietProducts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
    })

    expect(result).toEqual({ deleted: 1, blocked: 0 })
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).includes('delete from price_list_items'))).toBe(true)
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).trim().toLowerCase().startsWith('rollback to savepoint'))).toBe(true)
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).includes('delete from products'))).toBe(true)
  })

  test('deletes imported KiotViet stocktake items before stocktakes', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('delete from stocktake_items')) return { rows: [], rowCount: 3 }
      if (sql.includes('delete from stocktakes')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.deleteImportedKiotVietStocktakes?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
    })
    const deleteItemIndex = pgMock.query.mock.calls.findIndex(([sql]) => String(sql).includes('delete from stocktake_items'))
    const deleteStocktakeIndex = pgMock.query.mock.calls.findIndex(([sql]) => String(sql).includes('delete from stocktakes'))

    expect(result).toEqual({ deleted: 1, blocked: 0 })
    expect(deleteItemIndex).toBeGreaterThanOrEqual(0)
    expect(deleteStocktakeIndex).toBeGreaterThan(deleteItemIndex)
  })

  test('persists KiotViet provisional stock balances by product code', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from products') && sql.includes('code = $2')) return { rows: [{ id: 'product-a10t' }], rowCount: 1 }
      if (sql.includes('from product_inventory_settings')) return { rows: [{ stock_unit_id: 'unit-tam' }], rowCount: 1 }
      if (sql.includes('insert into inventory_provisional_balances')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertProvisionalStockBalances?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{ product_code: 'A10T', quantity: 4, unit_name: 'Tấm', source_label: 'KiotViet product import' }],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists inventory_provisional_balances'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into inventory_provisional_balances'))).toBe(true)
  })

  test('loads latest KiotViet stocktake evidence for product lists', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockResolvedValue({
      rows: [{
        id: 'product-hda5',
        code: 'HDA5',
        name: 'Hiflex 3m2',
        status: 'active',
        product_kind: 'goods',
        unit_name: 'Cuộn',
        sell_method: 'quantity',
        latest_purchase_cost: 48520,
        latest_purchase_cost_at: null,
        default_sale_price: null,
        product_group_id: null,
        product_group: null,
        inventory_shape: 'normal',
        track_inventory: true,
        unit_conversions: [],
        kiotviet_provisional_stock: null,
        draft_bom: null,
        latest_kiotviet_stocktake: {
          code: 'KK000333',
          source_created_at: '2026-07-10T09:30:00.000Z',
          source_balanced_at: '2026-07-10T09:45:00.000Z',
          system_qty: 60,
          actual_qty: 58,
          difference_qty: -2,
          unit_name: 'Cuộn',
        },
        created_at: new Date('2026-07-10T00:00:00.000Z'),
        updated_at: new Date('2026-07-10T00:00:00.000Z'),
      }],
    })

    const repository = createPgRepository('postgres://unit-test')
    const products = await repository.listProducts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/products?status=active'),
    })

    const listSql = String(pgMock.query.mock.calls.find(([sql]) =>
      String(sql).includes('from products p'),
    )?.[0])
    expect(pgMock.query.mock.calls.some(([sql]) =>
      String(sql).includes('create table if not exists stocktakes'),
    )).toBe(false)
    expect(listSql).toContain('stocktake_items')
    expect(listSql).toContain('kiotviet_import')
    expect(products?.[0].latest_kiotviet_stocktake).toEqual({
      code: 'KK000333',
      source_created_at: '2026-07-10T09:30:00.000Z',
      source_balanced_at: '2026-07-10T09:45:00.000Z',
      system_qty: 60,
      actual_qty: 58,
      difference_qty: -2,
      unit_name: 'Cuộn',
    })
  })

  test('persists KiotViet BOM rows as draft product BOMs', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('from products') && sql.includes('code = $2')) {
        const code = String(values?.[1])
        if (code === 'HH') return { rows: [{ id: 'product-hh' }], rowCount: 1 }
        if (code === 'DCS') return { rows: [{ id: 'product-dcs' }], rowCount: 1 }
        if (code === 'F5') return { rows: [{ id: 'product-f5' }], rowCount: 1 }
      }
      if (sql.includes('select coalesce(max(version)')) return { rows: [{ next_version: 2 }], rowCount: 1 }
      if (sql.includes('insert into product_boms')) return { rows: [{ id: 'bom-hh', inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertDraftProductBoms?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        product_code: 'HH',
        source_text: 'DCS:0.6|F5:0.3',
        components: [
          { component_code: 'DCS', quantity: 0.6 },
          { component_code: 'F5', quantity: 0.3 },
        ],
        note: 'Imported from KiotViet product BOM. Review before activating.',
      }],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists product_boms'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into product_boms'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into product_bom_items'))).toBe(true)
  })

  test('persists imported KiotViet stocktakes without creating stock movements', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('from products') && sql.includes('code = $2')) {
        const code = String(values?.[1])
        if (code === 'HDA5') return { rows: [{ id: 'product-hda5' }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('from users')) return { rows: [{ id: '22222222-2222-2222-2222-222222222222' }], rowCount: 1 }
      if (sql.includes('insert into stocktakes')) return { rows: [{ id: `stocktake-${values?.[3]}`, inserted: true }], rowCount: 1 }
      if (sql.includes('insert into stocktake_items')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietStocktakes?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      createdBy: { id: '22222222-2222-2222-2222-222222222222', name: 'Nguyễn Thị Mai Phương' },
      rows: [
        {
          rowNumber: 2,
          source_code: 'KK000333',
          source_created_at: '2026-07-10T09:30:00.000Z',
          source_creator_name: 'maiphuong',
          source_balanced_at: '2026-07-10T09:45:00.000Z',
          status: 'balanced',
          product_code: 'HDA5',
          product_name: 'Hiflex 3m2',
          unit_name: 'Cuốn',
          system_qty: 60,
          actual_qty: 58,
          difference_qty: -2,
          increased_qty: 0,
          decreased_qty: -2,
          total_actual_value: 580000,
          total_difference_value: -20000,
          line_difference_value: -20000,
          note: 'Đối soát KV',
          is_deleted_product_code: false,
          formula_valid: true,
        },
        {
          rowNumber: 3,
          source_code: 'KK000333',
          source_created_at: '2026-07-10T09:30:00.000Z',
          source_balanced_at: '2026-07-10T09:45:00.000Z',
          status: 'balanced',
          product_code: 'OLD{DEL}',
          product_name: 'Mã đã xóa',
          unit_name: 'Cuốn',
          system_qty: 3,
          actual_qty: 0,
          difference_qty: -3,
          increased_qty: 0,
          decreased_qty: -3,
          total_actual_value: 0,
          total_difference_value: -30000,
          line_difference_value: -30000,
          note: null,
          is_deleted_product_code: true,
          formula_valid: true,
        },
      ],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    const stocktakeInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stocktakes'))
    const itemInsertCalls = pgMock.query.mock.calls.filter(([sql]) => String(sql).includes('insert into stocktake_items'))

    expect(result).toEqual({
      stocktakes_created: 1,
      stocktakes_updated: 0,
      items_created: 2,
      items_updated: 0,
      missing_product_rows: 1,
    })
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists stocktakes'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists stocktake_items'))).toBe(true)
    expect(stocktakeInsertCall?.[1]).toEqual(expect.arrayContaining([
      '11111111-1111-1111-1111-111111111111',
      'kiotviet',
      'KK000333',
      'Đối soát KV',
      'maiphuong',
      '22222222-2222-2222-2222-222222222222',
    ]))
    expect(itemInsertCalls[0]?.[1]).toEqual(expect.arrayContaining(['product-hda5', 'HDA5']))
    expect(itemInsertCalls[1]?.[1]).toEqual(expect.arrayContaining([null, 'OLD{DEL}']))
    expect(sqlCalls.some((sql) => sql.includes('insert into stock_movements'))).toBe(false)
  })

  test('lists stocktakes with status, search, and source date filters in PostgreSQL', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from stocktakes st')) {
        return {
          rows: [{
            id: 'stocktake-june',
            code: 'KK-JUNE',
            status: 'balanced',
            source_type: 'kiotviet_import',
            source_creator_name: 'maiphuong',
            created_at: new Date('2026-06-15T09:30:00.000Z'),
            balanced_at: new Date('2026-06-15T09:45:00.000Z'),
            total_actual_qty: 58,
            total_actual_value: 580000,
            total_difference_value: -20000,
            increased_qty: 0,
            decreased_qty: 2,
            created_by_id: '22222222-2222-2222-2222-222222222222',
            created_by_name: 'Nguyễn Thị Mai Phương',
            product_code: 'HDA5',
            product_name: 'Hộp đèn alu 5mm',
            product_system_qty: 60,
            product_actual_qty: 58,
            product_difference_qty: -2,
            note: 'KiotViet import',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const stocktakes = await repository.listStocktakes?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/inventory/stocktakes?status=balanced&search=KK-JUNE&from=2026-06-01&to=2026-06-30&created_by=22222222-2222-2222-2222-222222222222'),
    })

    const listCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('from stocktakes st'))
    const listSql = String(listCall?.[0])
    expect(listSql).toContain('st.status = any')
    expect(listSql).toContain('translate(lower(st.code)')
    expect(listSql).toContain('translate(lower(coalesce(st.note')
    expect(listSql).toContain('exists (')
    expect(listSql).toContain('from stocktake_items search_sti')
    expect(listSql).toContain('left join products search_product')
    expect(listSql).toContain('source_product_code')
    expect(listSql).toContain('source_product_name')
    expect(listSql).toContain(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date >= $`)
    expect(listSql).toContain(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date <= $`)
    expect(listSql).toContain('left join users created_by_user')
    expect(listSql).toContain('list_sti.source_product_code')
    expect(listSql).toContain('list_sti.source_product_name')
    expect(listSql).toContain('list_sti.system_qty')
    expect(listSql).toContain('list_sti.actual_qty')
    expect(listSql).toContain('list_sti.difference_qty')
    expect(listSql).toContain('st.created_by = $')
    expect(listCall?.[1]).toEqual([
      '11111111-1111-1111-1111-111111111111',
      ['balanced'],
      '2026-06-01',
      '2026-06-30',
      '%kk-june%',
      '22222222-2222-2222-2222-222222222222',
    ])
    expect(stocktakes).toEqual([
      expect.objectContaining({
        code: 'KK-JUNE',
        source_type: 'kiotviet_import',
        source_creator_name: 'maiphuong',
        created_by: { id: '22222222-2222-2222-2222-222222222222', name: 'Nguyễn Thị Mai Phương' },
        product_code: 'HDA5',
        product_name: 'Hộp đèn alu 5mm',
        product_system_qty: 60,
        product_actual_qty: 58,
        product_difference_qty: -2,
        total_actual_qty: 58,
      }),
    ])
  })

  test('lists finance accounts from PostgreSQL storage', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from finance_accounts')) {
        return {
          rows: [{
            id: 'bank-0771000598653',
            code: '0771000598653',
            name: '0771000598653',
            account_type: 'bank',
            is_default_cash: false,
            is_active: true,
            account_number: '0771000598653',
            account_holder: 'Van Lam',
            opening_balance: 0,
            note: null,
            notify_on_transaction: true,
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const accounts = await repository.listFinanceAccounts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/accounts?is_active=true'),
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists finance_accounts'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('from finance_accounts'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('is_active = $'))).toBe(true)
    expect(accounts).toEqual([{
      id: 'bank-0771000598653',
      code: '0771000598653',
      name: '0771000598653',
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: '0771000598653',
      account_holder: 'Van Lam',
      opening_balance: 0,
      note: null,
      notify_on_transaction: true,
    }])
  })

  test('excludes replaced deleted bank accounts from broad PostgreSQL bank cashbook filters', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from finance_accounts')) {
        return {
          rows: [
            { id: 'bank-new', code: '0771000598653', name: '0771000598653', account_type: 'bank', is_default_cash: false, is_active: true, account_number: '0771000598653', account_holder: 'Van Lam', opening_balance: 0, note: null, notify_on_transaction: true },
            { id: 'bank-old', code: '0771000598653{DEL}', name: '0771000598653{DEL}', account_type: 'bank', is_default_cash: false, is_active: false, account_number: '0771000598653{DEL}', account_holder: 'Van Lam', opening_balance: 0, note: null, notify_on_transaction: true },
          ],
          rowCount: 2,
        }
      }
      if (sql.includes('from cashbook_entries')) {
        return {
          rows: [
            {
              id: 'cashbook-new',
              code: 'TNH001',
              status: 'posted',
              direction: 'in',
              amount_delta: 1000,
              finance_account: { id: 'bank-new', code: '0771000598653', name: '0771000598653', account_type: 'bank' },
              counterparty: { type: 'other', name: 'A', phone: null },
              note: '',
              source_type: 'kiotviet_cashbook',
              source: {},
              allocations: [],
              is_business_accounted: true,
              created_at: new Date('2026-07-13T00:00:00.000Z'),
            },
            {
              id: 'cashbook-old',
              code: 'TNH002',
              status: 'posted',
              direction: 'in',
              amount_delta: 2000,
              finance_account: { id: 'bank-old', code: '0771000598653{DEL}', name: '0771000598653{DEL}', account_type: 'bank' },
              counterparty: { type: 'other', name: 'B', phone: null },
              note: '',
              source_type: 'kiotviet_cashbook',
              source: {},
              allocations: [],
              is_business_accounted: true,
              created_at: new Date('2026-07-13T00:00:00.000Z'),
            },
          ],
          rowCount: 2,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const entries = await repository.listCashbookEntries?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/cashbook?finance_account_type=bank&exclude_replaced_deleted_accounts=true'),
    })

    expect(entries?.map((entry) => entry.code)).toEqual(['TNH001'])
  })
})
