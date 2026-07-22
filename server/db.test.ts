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

type InventoryAdjustmentRepository = {
  adjustNormalProductStock?: (input: {
    organizationId: string
    productId: string
    actualQty: number
    reason: string
    createdBy: { id: string; name: string }
  }) => Promise<unknown>
  createMaterialOpening?: (input: {
    organizationId: string
    input: {
      product_id: string
      inventory_shape: 'normal' | 'roll' | 'sheet'
      opened_unit_id?: string
      opened_qty?: number
      old_remaining_qty?: number
      note?: string
    }
  }) => Promise<unknown>
}

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

  test('upserts search selection stats per organization user and entity', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockResolvedValue({ rows: [], rowCount: 1 })

    const repository = createPgRepository('postgres://unit-test')
    await repository.recordSearchSelection?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      entityType: 'product',
      entityId: '33333333-3333-3333-3333-333333333333',
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists search_selection_stats'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('on conflict (organization_id, user_id, entity_type, entity_id) do update'))).toBe(true)
    expect(pgMock.query.mock.calls.at(-1)?.[1]).toEqual([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'product',
      '33333333-3333-3333-3333-333333333333',
    ])
  })

  test('does not deactivate existing product unit conversions when an import row has none', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('insert into products')) return { rows: [{ id: 'product-f5', inserted: false }], rowCount: 1 }
      if (sql.includes('insert into inventory_units')) return { rows: [{ id: `unit-${String(values?.[2]).toLowerCase()}` }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.upsertProductsByCode?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        code: 'F5',
        name: 'Fomex 5mm',
        status: 'active',
        product_group_id: null,
        unit_name: 'Tấm',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 126000,
        source_created_at: null,
        unit_conversions: [],
        source: {} as never,
      }],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('insert into product_unit_conversions'))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes('update product_unit_conversions'))).toBe(false)
  })

  test('creates manual customers in customer_snapshots with zero debt', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('select max(') && sql.includes('from customer_snapshots')) return { rows: [{ max_number: 21 }], rowCount: 1 }
      if (sql.includes('insert into customer_snapshots')) {
        expect(values?.[2]).toBe('KH000022')
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const created = await repository.createCustomer?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      name: 'Minh Võ (may)',
      phone: '0909123456',
      tax_code: '0311111111',
      address: '99 Lê Lợi',
      note: 'Khách tạo tay',
      customer_group_id: null,
      customer_type: 'company',
      company_name: 'Minh Võ Co',
      created_by: { id: 'user-1', name: 'Admin' },
    })

    expect(created).toEqual(expect.objectContaining({
      code: 'KH000022',
      name: 'Minh Võ (may)',
      company_name: 'Minh Võ Co',
      total_debt_amount: 0,
      created_by: { id: 'user-1', name: 'Admin' },
      customer_group_id: null,
      customer_group: null,
    }))
    expect(pgMock.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes("data->'customer_group'"))).toBe(false)
    expect(pgMock.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes('insert into customer_snapshots'))).toBe(true)
  })

  test('creates manual products into products table with inventory settings', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('from products') && sql.includes('lower(code)')) return { rows: [], rowCount: 0 }
      if (sql.includes('from product_groups') && sql.includes('order by is_default desc')) {
        return {
          rows: [{ id: 'pg-default', code: 'GENERAL', name: 'Giá chung', is_default: true, is_active: true }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into products')) {
        expect(values?.[2]).toBe('SP-NEW-01')
        expect(values?.[8]).toBe('goods')
        expect(values?.[10]).toBe(true)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('insert into inventory_units')) return { rows: [{ id: 'unit-cai' }], rowCount: 1 }
      if (sql.includes('from products') && sql.includes('created_at')) {
        return {
          rows: [{
            created_at: '2026-07-21T00:00:00.000Z',
            updated_at: '2026-07-21T00:00:00.000Z',
            latest_purchase_cost_at: '2026-07-21T00:00:00.000Z',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const created = await repository.createProduct?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      code: 'SP-NEW-01',
      name: 'Hàng tạo tay',
      status: 'active',
      unit_name: 'Cái',
      sell_method: 'quantity',
      product_kind: 'goods',
      inventory_shape: 'normal',
      track_inventory: true,
      latest_purchase_cost: 12000,
    })

    expect(created).toEqual(expect.objectContaining({
      code: 'SP-NEW-01',
      name: 'Hàng tạo tay',
      product_kind: 'goods',
      track_inventory: true,
      product_group: expect.objectContaining({ name: 'Giá chung' }),
      latest_purchase_cost: 12000,
    }))
    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('insert into products'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into product_inventory_settings'))).toBe(true)
  })

  test('rejects duplicate product codes when creating manual products', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from products') && sql.includes('lower(code)')) {
        return { rows: [{ id: 'existing-product' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await expect(repository.createProduct?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      code: 'A10T',
      name: 'Trùng mã',
      status: 'active',
      unit_name: 'Cái',
      sell_method: 'quantity',
      product_kind: 'goods',
      inventory_shape: 'normal',
      track_inventory: true,
    })).rejects.toThrow('PRODUCT_ALREADY_EXISTS')
  })

  test('creates manual suppliers in supplier_snapshots with zero payable', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('select max(') && sql.includes('from supplier_snapshots')) return { rows: [{ max_number: 38 }], rowCount: 1 }
      if (sql.includes('from supplier_snapshots') && sql.includes('lower(code)')) return { rows: [], rowCount: 0 }
      if (sql.includes('insert into supplier_snapshots')) {
        expect(values?.[2]).toBe('NCC000039')
        expect(String(sql)).toContain("'manual'")
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const created = await repository.createSupplier?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      name: 'NCC tạo tay',
      phone: '0909111222',
      email: 'ncc@example.com',
      address: '12 Nguyễn Trãi',
      tax_code: '0312222222',
      notes: 'NCC mới sau import',
    })

    expect(created).toEqual(expect.objectContaining({
      code: 'NCC000039',
      name: 'NCC tạo tay',
      current_payable_amount: 0,
      total_purchase_amount: 0,
      status: 'active',
      linked_customer_id: null,
    }))
    expect(pgMock.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes('insert into supplier_snapshots'))).toBe(true)
  })

  test('rejects duplicate supplier codes when creating manual suppliers', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from supplier_snapshots') && sql.includes('lower(code)')) {
        return { rows: [{ id: 'existing-supplier' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await expect(repository.createSupplier?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      code: 'THN',
      name: 'Trùng mã',
    })).rejects.toThrow('SUPPLIER_ALREADY_EXISTS')
  })

  test('moves same-sale cashbook timestamps when sales document time changes', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('update orders')) return { rows: [{ id: 'order-1', code: 'HD010985' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.updateSalesDocumentNote?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      id: 'HD010985',
      created_at: '2026-07-18T04:15:00.000Z',
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('update payment_receipts') && sql.includes("code = $4 or code like $4 || '-%'"))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('update payment_receipt_methods') && sql.includes('payment_receipt_id in'))).toBe(true)
    expect(sqlCalls.some((sql) => (
      sql.includes('update cashbook_entries')
      && sql.includes("source_type = 'payment_receipt_method'")
      && sql.includes("code = $3 or code like $3 || '-%'")
    ))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('alter table payment_receipts add column if not exists created_at'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('alter table payment_receipt_methods add column if not exists created_at'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('alter table cashbook_entries add column if not exists source'))).toBe(true)
  })

  test('uses the shared canonical totals query for debt detail and customer totals', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kv-kh000384',
            customer_code: 'KH000384',
            customer_name: 'Khach test',
            total_debt: '600000',
            open_invoice_count: 1,
            oldest_order_code: 'HD010729',
            has_kiotviet_anchor: false,
            last_activity_at: new Date('2026-06-10T15:26:26.083Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('o.id,') && sql.includes('coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt')) {
        return {
          rows: [{
            id: 'order-kv-hd010729',
            code: 'HD010729',
            created_at: new Date('2026-06-10T15:26:26.083Z'),
            total_amount: '600000',
            paid_amount: '0',
            debt_amount: '600000',
            remaining_debt: '600000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from customer_debt_adjustments') && sql.includes('source_system')) return { rows: [], rowCount: 0 }
      if (sql.includes('select customer_id, sum(total_amount) as total_sales_amount')) {
        return {
          rows: [{ customer_id: 'customer-kv-kh000384', total_sales_amount: '600000', last_activity_at: new Date('2026-06-10T15:26:26.083Z') }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000384',
    })
    const totals = await repository.getCustomerFinancialTotals?.('11111111-1111-1111-1111-111111111111')

    expect(debt?.total_debt).toBe(600000)
    expect(debt?.invoices).toEqual([expect.objectContaining({ order_code: 'HD010729', remaining_debt: 600000 })])
    expect(totals?.get('customer-kv-kh000384')?.total_debt_amount).toBe(600000)
    const canonicalSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with live_invoice_debt'))?.[0])
    expect(canonicalSql).toContain('left join customer_debt_entries cde')
    expect(canonicalSql).toContain('kiotviet_anchor')
    expect(canonicalSql).toContain("source_type = 'payment_receipt_method'")
    expect(canonicalSql).toContain('CB')
  })

  test('builds customer debt detail from vouchers instead of KiotViet balance_after anchor', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kv-kh000001',
            customer_code: 'KH000001',
            customer_name: 'Khach test',
            total_debt: '999999',
            open_invoice_count: 1,
            oldest_order_code: 'HD000001',
            has_kiotviet_anchor: true,
            last_activity_at: new Date('2026-07-04T01:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('o.id,') && sql.includes('coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt')) {
        return {
          rows: [{
            id: 'order-hd000001',
            code: 'HD000001',
            created_at: new Date('2026-07-01T01:00:00.000Z'),
            total_amount: '100000',
            paid_amount: '0',
            debt_amount: '100000',
            remaining_debt: '100000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id, source_code, created_at, transaction_type')) {
        return {
          rows: [
            {
              id: 'adjustment-ckkh000001',
              source_code: 'CKKH000001',
              created_at: new Date('2026-07-03T01:00:00.000Z'),
              transaction_type: 'payment_discount',
              amount_delta: '-10000',
              paid_amount: '0',
              remaining_amount: '0',
              balance_after: '989999',
              source_file: 'kv.xlsx',
            },
            {
              id: 'adjustment-cb000001',
              source_code: 'CB000001',
              created_at: new Date('2026-07-04T01:00:00.000Z'),
              transaction_type: 'debt_adjustment',
              amount_delta: '5000',
              paid_amount: '0',
              remaining_amount: '5000',
              balance_after: '999999',
              source_file: 'kv.xlsx',
            },
          ],
          rowCount: 2,
        }
      }
      if (sql.includes('select') && sql.includes('cbe.id') && sql.includes('from cashbook_entries cbe')) {
        return {
          rows: [{
            id: 'cashbook-tt000001',
            code: 'TT000001',
            status: 'posted',
            direction: 'in',
            amount_delta: '40000',
            finance_account: null,
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: new Date('2026-07-02T01:00:00.000Z'),
            note: 'Thu no',
            counterparty: { type: 'customer', name: 'Khach test', phone: null },
            created_by: null,
            source: { type: 'payment_receipt_method', customer_id: 'customer-kv-kh000001' },
            allocations: [],
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('supplier_id') && sql.includes('remaining_amount')) return { rows: [], rowCount: 0 }
      if (sql.includes('from users')) return { rows: [], rowCount: 0 }
      if (sql.includes('from finance_accounts')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000001',
    })

    expect(debt?.total_debt).toBe(100000 - 40000 - 10000 + 5000)
    expect(debt?.adjustments.map((row) => row.source_code)).toContain('CKKH000001')
    expect(debt?.ledger_rows.map((row) => row.code)).toEqual([
      'HD000001',
      'TT000001',
      'CKKH000001',
      'CB000001',
    ])
    const canonicalSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with live_invoice_debt'))?.[0])
    expect(canonicalSql).not.toContain('kiotviet_anchor as')
    expect(canonicalSql).not.toContain('balance_after')
    const cashbookSql = String(pgMock.query.mock.calls.find(([sql]) => (
      String(sql).includes('select')
      && String(sql).includes('cbe.id')
      && String(sql).includes('from cashbook_entries cbe')
    ))?.[0])
    expect(cashbookSql).not.toContain('kiotviet_anchor')
    expect(cashbookSql).not.toContain('cbe.created_at >')
    expect(cashbookSql).toMatch(/cbe\.source_type = 'kiotviet_cashbook'[\s\S]*o\.id is not null[\s\S]*o\.customer_id = \$2/)
  })

  test('keeps fully paid invoices in customer debt ledger documents', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-paid',
            customer_code: 'KHPAID',
            customer_name: 'Khach paid',
            total_debt: '0',
            open_invoice_count: 0,
            oldest_order_code: '',
            has_kiotviet_anchor: false,
            last_activity_at: new Date('2026-07-02T01:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('as ledger_total_amount')) {
        return {
          rows: [{
            id: 'order-paid',
            code: 'HD000099',
            created_at: new Date('2026-07-01T01:00:00.000Z'),
            ledger_total_amount: '100000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('o.id,') && sql.includes('coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt')) return { rows: [], rowCount: 0 }
      if (sql.includes('select id, source_code, created_at, transaction_type')) return { rows: [], rowCount: 0 }
      if (sql.includes('select') && sql.includes('cbe.id') && sql.includes('from cashbook_entries cbe')) {
        return {
          rows: [{
            id: 'cashbook-tt000099',
            code: 'TT000099',
            status: 'posted',
            direction: 'in',
            amount_delta: '100000',
            finance_account: null,
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: new Date('2026-07-02T01:00:00.000Z'),
            note: 'Thu het no',
            counterparty: { type: 'customer', name: 'Khach paid', phone: null },
            created_by: null,
            source: { type: 'payment_receipt_method', customer_id: 'customer-paid', order_code: 'HD000099' },
            allocations: [],
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('supplier_id') && sql.includes('remaining_amount')) return { rows: [], rowCount: 0 }
      if (sql.includes('from users')) return { rows: [], rowCount: 0 }
      if (sql.includes('from finance_accounts')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-paid',
    })

    expect(debt?.invoices).toEqual([])
    expect(debt?.total_debt).toBe(0)
    expect(debt?.ledger_rows.map((row) => row.code)).toEqual(['HD000099', 'TT000099'])
  })

  test('subtracts linked supplier receipts from linked customer debt view', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kv-kh000384',
            customer_code: 'KH000384',
            customer_name: 'Khach test',
            total_debt: sql.includes('linked_supplier_debt') ? '510000' : '600000',
            open_invoice_count: 1,
            oldest_order_code: 'HD010729',
            has_kiotviet_anchor: false,
            last_activity_at: new Date('2026-06-11T10:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('o.id,') && sql.includes('coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt')) {
        return {
          rows: [{
            id: 'order-kv-hd010729',
            code: 'HD010729',
            created_at: new Date('2026-06-10T15:26:26.083Z'),
            total_amount: '600000',
            paid_amount: '0',
            debt_amount: '600000',
            remaining_debt: '600000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('supplier_id') && sql.includes('remaining_amount')) {
        if (!sql.includes("pr.data->>'supplier_id' = s.id")) return { rows: [], rowCount: 0 }
        return {
          rows: [{
            id: 'receipt-1',
            code: 'PN000685',
            created_at: new Date('2026-06-11T10:00:00.000Z'),
            supplier_id: 'supplier-1',
            supplier_code: 'NCC001',
            supplier_name: 'NCC test',
            payable_amount: '90000',
            paid_amount: '0',
            remaining_amount: '90000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from customer_debt_adjustments') && sql.includes('source_system')) return { rows: [], rowCount: 0 }
      if (sql.includes('select customer_id, sum(total_amount) as total_sales_amount')) {
        return {
          rows: [{ customer_id: 'customer-kv-kh000384', total_sales_amount: '600000', last_activity_at: new Date('2026-06-10T15:26:26.083Z') }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000384',
    })
    const list = await repository.listCustomerDebts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/customer-debts'),
    })
    const totals = await repository.getCustomerFinancialTotals?.('11111111-1111-1111-1111-111111111111')

    expect(debt?.total_debt).toBe(510000)
    expect(debt?.ledger_rows.map((row) => row.code)).toEqual(['HD010729', 'PN000685'])
    expect(debt?.linked_supplier_receipts).toEqual([expect.objectContaining({ code: 'PN000685', remaining_amount: 90000 })])
    expect(list).toEqual([expect.objectContaining({ customer_id: 'customer-kv-kh000384', total_debt: 510000 })])
    expect(totals?.get('customer-kv-kh000384')?.total_debt_amount).toBe(510000)
    const canonicalSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with live_invoice_debt'))?.[0])
    expect(canonicalSql).toContain('linked_supplier_debt')
    expect(canonicalSql).toContain("pr.data->>'supplier_id' = s.id")
  })

  test('does not net linked supplier payable in the in-memory customer debt formula', async () => {
    const { computeCustomerDebtTotal } = await import('./modules/finance/customer-debt')
    const debt = computeCustomerDebtTotal({
      customerId: 'customer-kv-ut',
      customerCode: 'UT',
      customerName: 'Ut Teo',
      invoices: [{
        id: 'order-hd011163',
        code: 'HD011163',
        created_at: '2026-07-14T14:18:00.000Z',
        status: 'completed',
        order_type: 'invoice',
        total_amount: 1000000,
        debt_amount: 1000000,
        customer: { id: 'customer-kv-ut', code: 'UT', name: 'Ut Teo' },
      }],
      adjustments: [],
      cashbookEntries: [],
      linkedSupplierReceipts: [{ remaining_amount: 400000 }],
      resolveInvoiceCustomerId: (invoice) => invoice.customer.id,
    })

    expect(debt.total_debt).toBe(1000000)
  })

  test('keeps old KiotViet cashbook customer code after customer code changes in memory formula', async () => {
    const { computeCustomerDebtTotal } = await import('./modules/finance/customer-debt')
    const debt = computeCustomerDebtTotal({
      customerId: 'customer-kv-kh000129',
      customerCode: 'HLo',
      customerName: 'Hoàng Lợi',
      invoices: [],
      adjustments: [],
      cashbookEntries: [{
        code: 'TT001234',
        created_at: '2026-07-14T10:00:00.000Z',
        status: 'posted',
        source_type: 'kiotviet_cashbook',
        direction: 'in',
        amount_delta: 500000,
        source: { counterparty_code: 'KH000129' },
      }],
      linkedSupplierReceipts: [],
      resolveInvoiceCustomerId: (invoice) => invoice.customer.id,
    })

    expect(debt.total_debt).toBe(-500000)
    expect(debt.ledger_rows.map((row) => row.code)).toEqual(['TT001234'])
  })

  test('returns customer-debt cashbook rows with the debt detail payload', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('select') && sql.includes('cbe.id') && sql.includes('from cashbook_entries cbe')) {
        if (!sql.includes('cs.id = $2')) return { rows: [], rowCount: 0 }
        return {
          rows: [{
            id: 'cashbook-tt001838',
            code: 'TT001838',
            status: 'posted',
            direction: 'in',
            amount_delta: '5000000',
            finance_account: { id: 'cash', code: 'TM', name: 'Tiền mặt', account_type: 'cash' },
            is_business_accounted: true,
            source_type: 'kiotviet_cashbook',
            created_at: new Date('2026-07-15T10:00:00.000Z'),
            note: 'Khách trả nợ',
            counterparty: { type: 'customer', name: 'Hoàng Lợi', phone: null },
            created_by: null,
            source: { type: 'kiotviet_cashbook', counterparty_code: 'KH000129' },
            allocations: [],
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kv-kh000129',
            customer_code: 'HLo',
            customer_name: 'Hoàng Lợi',
            total_debt: '20714394',
            open_invoice_count: 1,
            oldest_order_code: 'HD011163',
            has_kiotviet_anchor: true,
            last_activity_at: new Date('2026-07-15T10:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('o.id,') && sql.includes('coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt')) {
        return {
          rows: [{
            id: 'order-hd011163',
            code: 'HD011163',
            created_at: new Date('2026-07-14T14:18:00.000Z'),
            total_amount: '209300',
            paid_amount: '0',
            debt_amount: '209300',
            remaining_debt: '209300',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id, source_code, created_at, transaction_type')) return { rows: [], rowCount: 0 }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('supplier_id') && sql.includes('remaining_amount')) return { rows: [], rowCount: 0 }
      if (sql.includes('from users')) return { rows: [], rowCount: 0 }
      if (sql.includes('from finance_accounts')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000129',
    })

    expect(debt?.cashbook_entries).toEqual([
      expect.objectContaining({
        id: 'cashbook-tt001838',
        code: 'TT001838',
        amount_delta: 5000000,
        source_type: 'kiotviet_cashbook',
      }),
    ])
    const cashbookSql = String(pgMock.query.mock.calls.find(([sql]) => (
      String(sql).includes('select')
      && String(sql).includes('cbe.id')
      && String(sql).includes('from cashbook_entries cbe')
    ))?.[0])
    expect(cashbookSql).toContain('cs.id = $2')
  })

  test('keeps list, detail and customer totals on the same canonical value including negative balances', async () => {
    const { createPgRepository } = await import('./db')
    const canonicalRow = {
      customer_id: 'customer-kv-kh000384',
      customer_code: 'KH000384',
      customer_name: 'Khach test',
      total_debt: '-50000',
      open_invoice_count: 0,
      oldest_order_code: 'CB000123',
      has_kiotviet_anchor: true,
      last_activity_at: new Date('2026-07-19T00:00:00.000Z'),
    }
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) return { rows: [canonicalRow], rowCount: 1 }
      if (sql.includes('select id, source_code, created_at, transaction_type')) {
        return {
          rows: [{
            id: 'adjustment-cb000123',
            source_code: 'CB000123',
            created_at: new Date('2026-07-19T00:00:00.000Z'),
            transaction_type: 'Điều chỉnh',
            amount_delta: '-50000',
            paid_amount: '0',
            remaining_amount: '0',
            balance_after: '999999',
            source_file: null,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select customer_id, sum(total_amount) as total_sales_amount')) {
        return {
          rows: [{ customer_id: 'customer-kv-kh000384', total_sales_amount: '719396', last_activity_at: new Date('2026-07-20T00:00:00.000Z') }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const list = await repository.listCustomerDebts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/customer-debts'),
    })
    const debt = await repository.getCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000384',
    })
    const totals = await repository.getCustomerFinancialTotals?.('11111111-1111-1111-1111-111111111111')

    expect(list).toEqual([expect.objectContaining({ customer_id: 'customer-kv-kh000384', total_debt: -50000 })])
    expect(debt?.total_debt).toBe(-50000)
    expect(totals?.get('customer-kv-kh000384')?.total_debt_amount).toBe(-50000)
  })

  test('upserts imported KiotViet cashbook entries into PostgreSQL with counterparty source metadata', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('select id') && sql.includes('from finance_accounts')) return { rows: [], rowCount: 0 }
      if (sql.includes('select id') && sql.includes('from cashbook_entries')) return { rows: [], rowCount: 0 }
      if (sql.includes('from customer_snapshots') && sql.includes('lower(code)')) {
        return {
          rows: [{
            data: { id: 'customer-kv-kh000384', code: 'KH000384', name: 'Khach test', phone: null },
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietCashbook?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 2,
        source_code: 'TT001842',
        entry_time: '2026-07-12T03:00:00.000Z',
        source_created_at: '2026-07-12T03:00:00.000Z',
        source_creator_name: 'KV',
        staff_name: null,
        category_name: 'Thu nợ',
        account_type: 'cash',
        account_name: 'Tien mat',
        account_number: null,
        counterparty_code: 'KH000384',
        counterparty_name: 'Khach test',
        counterparty_phone: null,
        counterparty_address: null,
        transfer_content: null,
        source_note: 'Thu no',
        direction: 'in',
        amount_delta: 200000,
        book_type_name: 'Tien mat',
        status: 'posted',
      }],
    })

    expect(result).toEqual({
      accounts_created: 1,
      accounts_updated: 0,
      entries_created: 1,
      entries_updated: 0,
      skipped_rows: 0,
    })
    const cashbookInsert = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into cashbook_entries'))
    expect(cashbookInsert).toBeTruthy()
    expect(String(cashbookInsert?.[0])).toContain("'kiotviet_cashbook'")
    const sourcePayload = JSON.parse(String(cashbookInsert?.[1]?.[9]))
    expect(sourcePayload).toMatchObject({
      type: 'kiotviet_cashbook',
      counterparty_code: 'KH000384',
      customer_id: 'customer-kv-kh000384',
    })
    expect(pgMock.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes('insert into finance_accounts'))).toBe(true)
  })

  test('upserts customer debt adjustments by KiotViet customer id when current customer code changed', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('from customer_snapshots')) {
        if (!sql.includes('id = any($3::text[])')) return { rows: [], rowCount: 0 }
        expect(values?.[1]).toBe('KH000129')
        expect(values?.[2]).toContain('customer-kv-kh000129')
        return {
          rows: [{
            data: {
              id: 'customer-kv-kh000129',
              code: 'HLo',
              name: 'Hoàng Lợi',
              phone: null,
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from customer_debt_adjustments')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietCustomerDebtAdjustments?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 10932,
        customer_code: 'KH000129',
        customer_name: 'Hoàng Lợi',
        source_code: 'CKKH000021',
        transaction_time: '2025-05-13T10:57:00.000Z',
        transaction_type: 'Chiết khấu thanh toán cho khách',
        amount_delta: -135878,
        balance_after: 0,
        source_file: 'BaoCaoCongNoTheoKhachHang_KV13072026-150538-065.xlsx',
      }],
    })

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })
    const insertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into customer_debt_adjustments'))
    expect(insertCall?.[1]).toContain('customer-kv-kh000129')
  })

  test('collects legacy KiotViet-anchored debt when no open debt entries exist', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kv-kh000384',
            customer_code: 'KH000384',
            customer_name: 'Khach test',
            total_debt: '500000',
            open_invoice_count: 0,
            oldest_order_code: 'CB000123',
            has_kiotviet_anchor: true,
            last_activity_at: new Date('2026-07-01T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('limit 1') && sql.includes('balance_after') && sql.includes('for update')) {
        return {
          rows: [{
            id: 'adjustment-anchor-1',
            source_code: 'CB000123',
            paid_amount: '0',
            balance_after: '500000',
            customer_snapshot: { name: 'Khach test', phone: null },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('regexp_match')) return { rows: [{ max_seq: 41 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.collectCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kv-kh000384',
      amount: 200000,
      createdAt: '2026-07-20T08:15:00.000Z',
      cashAmount: 200000,
      bankAmount: 0,
    })

    expect(result).toEqual({ payment_receipt_id: 'TT000042', allocated_amount: 200000 })
    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('update customer_debt_adjustments') && sql.includes('paid_amount = paid_amount + $1'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into payment_receipts'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('insert into cashbook_entries'))).toBe(true)
    const receiptInsert = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into payment_receipts'))
    expect(receiptInsert?.[1]?.[4]).toBeNull()
    expect(receiptInsert?.[1]?.[7]).toBe('2026-07-20T08:15:00.000Z')
  })

  test('links requested customer debt payment allocations to invoices even when debt entry rows are missing', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('from customer_debt_entries cde')) return { rows: [], rowCount: 0 }
      if (sql.includes('from orders o') && sql.includes('o.customer_snapshot') && sql.includes('for update')) {
        return {
          rows: [{
            debt_id: null,
            remaining_debt: '105000',
            order_id: 'order-hd011111',
            order_code: 'HD011111',
            total_amount: '105000',
            paid_amount: '0',
            debt_amount: '105000',
            customer_snapshot: { name: 'Chú Bình TTYTTP', phone: null },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from customer_debt_adjustments') && sql.includes('status = \'open\'')) {
        return {
          rows: [{
            id: 'adjustment-ckkh000228',
            source_code: 'CKKH000228',
            amount_delta: '122400',
            paid_amount: '0',
            remaining_amount: '122400',
            balance_after: '879900',
            customer_snapshot: { name: 'Chú Bình TTYTTP', phone: null },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('limit 1') && sql.includes('balance_after') && sql.includes('for update')) {
        return {
          rows: [{
            id: 'adjustment-ckkh000228',
            source_code: 'CKKH000228',
            paid_amount: '0',
            balance_after: '879900',
            customer_snapshot: { name: 'Chú Bình TTYTTP', phone: null },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('with live_invoice_debt')) {
        return {
          rows: [{
            customer_id: 'customer-kh000015',
            customer_code: 'KH000015',
            customer_name: 'Chú Bình TTYTTP',
            total_debt: '879900',
            open_invoice_count: 1,
            oldest_order_code: 'HD011111',
            has_kiotviet_anchor: true,
            last_activity_at: new Date('2026-07-20T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('regexp_match')) return { rows: [{ max_seq: 1849 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.collectCustomerDebt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      customerId: 'customer-kh000015',
      amount: 10500,
      createdAt: '2026-07-20T09:10:00.000Z',
      cashAmount: 10500,
      bankAmount: 0,
      allocations: [{ order_id: 'order-hd011111', order_code: 'HD011111', allocated_amount: 10500 }],
    })

    expect(result).toEqual({ payment_receipt_id: 'TT001850', allocated_amount: 10500 })
    const receiptInsert = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into payment_receipts'))
    expect(receiptInsert?.[1]?.[4]).toBe('order-hd011111')
    expect(receiptInsert?.[1]?.[6]).toBe('Thu no HD011111')
    const cashbookInsert = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into cashbook_entries'))
    expect(cashbookInsert?.[1]?.[8]).toBe('Thu no HD011111')
    expect(cashbookInsert?.[1]?.[14]).toBe('2026-07-20T09:10:00.000Z')
    expect(JSON.parse(String(cashbookInsert?.[1]?.[10]))).toMatchObject({ order_code: 'HD011111' })
    expect(pgMock.query.mock.calls.some(([sql, params]) => String(sql).includes('update orders') && params?.[3] === 'order-hd011111')).toBe(true)
    expect(pgMock.query.mock.calls.some(([sql]) => String(sql).includes('update customer_debt_adjustments'))).toBe(false)
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
    expect(listSql).toContain('order by p.created_at desc, p.code asc, p.name asc')
    expect(listSql).not.toContain(`'[]'::jsonb as unit_conversions`)
    expect(products?.[0].unit_conversions).toEqual([{
      source_code: 'B50',
      unit_name: 'Khổ 50',
      stock_qty_per_unit: 40,
      is_default_purchase_unit: true,
      is_default_sale_unit: false,
    }])
  })

  test('derives stock card rows from purchase receipt snapshots when movement table is empty', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from stock_movements sm')) return { rows: [], rowCount: 0 }
      if (sql.includes('from purchase_receipt_snapshots prs')) {
        return {
          rows: [
            {
              document_code: 'PN000673',
              created_at: '2026-07-02T03:00:00.000Z',
              partner_name: 'NCC test',
              raw_product_code: 'BT',
              line_no: 1,
              quantity_delta: '2',
              unit_cost: '100000',
            },
          ],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const movements = await repository.listStockMovements?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=22222222-2222-4222-8222-222222222222'),
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('from stock_movements sm'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('from purchase_receipt_snapshots prs'))).toBe(true)
    expect(movements).toEqual([expect.objectContaining({
      document_code: 'PN000673',
      movement_type: 'purchase_receipt',
      quantity_delta: 2,
      ending_qty: 2,
      partner_name: 'NCC test',
    })])
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

  test('loads PostgreSQL operating stock for product lists', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockResolvedValue({
      rows: [{
        id: 'product-bt',
        code: 'BT',
        name: 'Bat 300g Ojet Tim',
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
        unit_conversions: [],
        kiotviet_provisional_stock: null,
        latest_kiotviet_stocktake: null,
        operating_stock: {
          quantity: '156.500000',
          unit_name: 'm2',
          source_type: 'stock_movements',
          source_label: 'Moc ton + chung tu',
          updated_at: new Date('2026-07-14T08:00:00.000Z'),
        },
        draft_bom: null,
        created_at: new Date('2026-07-01T00:00:00.000Z'),
        updated_at: new Date('2026-07-14T08:00:00.000Z'),
      }],
      rowCount: 1,
    })

    const repository = createPgRepository('postgres://unit-test')
    const products = await repository.listProducts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/products'),
    })

    const listSql = String(pgMock.query.mock.calls.find(([sql]) =>
      String(sql).includes('from products p'),
    )?.[0])
    expect(listSql).toContain('operating_stock_data.operating_stock')
    expect(listSql).toContain('from stock_movements sm')
    expect(products?.[0]?.operating_stock).toEqual({
      quantity: 156.5,
      unit_name: 'm2',
      source_type: 'stock_movements',
      source_label: 'Moc ton + chung tu',
      updated_at: '2026-07-14T08:00:00.000Z',
    })
  })

  test('lists PostgreSQL stock movements for product stock cards', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from stock_movements sm')) {
        return {
          rows: [{
            id: 'movement-1',
            product_id: 'product-bt',
            movement_type: 'sale_deduction',
            quantity_delta: '-2.500000',
            created_at: new Date('2026-07-14T08:30:00.000Z'),
            document_code: 'HD011149',
            document_type: 'sale_invoice',
            transaction_price: '300000',
            cost_price: '120000',
            ending_qty: '154.000000',
            partner_name: 'Khach le',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const movements = await repository.listStockMovements?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    const listSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('from stock_movements sm'))?.[0])
    expect(listSql).toContain('sm.product_id = $')
    expect(listSql).toContain('order by sm.created_at desc')
    expect(movements).toEqual([{
      id: 'movement-1',
      product_id: 'product-bt',
      movement_type: 'sale_deduction',
      quantity_delta: -2.5,
      created_at: '2026-07-14T08:30:00.000Z',
      document_code: 'HD011149',
      document_type: 'sale_invoice',
      transaction_price: 300000,
      cost_price: 120000,
      ending_qty: 154,
      partner_name: 'Khach le',
    }])
  })

  test('writes PostgreSQL stock movements from imported KiotViet purchase receipts', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from supplier_snapshots')) return { rows: [{ data: { id: 'supplier-1', code: 'NCC001', name: 'NCC test' } }], rowCount: 1 }
      if (sql.includes('from products p') && sql.includes('product_unit_conversions puc')) {
        return {
          rows: [{
            id: 'product-bt',
            code: 'BT',
            name: 'Bat 300g',
            status: 'active',
            product_kind: 'roll',
            unit_name: 'm2',
            sell_method: 'area_m2',
            latest_purchase_cost: 1000,
            latest_purchase_cost_at: null,
            default_sale_price: null,
            product_group_id: null,
            product_group: null,
            inventory_shape: 'roll',
            track_inventory: true,
            unit_conversions: [{ source_code: 'B260', unit_name: 'Kho 260', stock_qty_per_unit: 208 }],
            kiotviet_provisional_stock: null,
            operating_stock: null,
            latest_kiotviet_stocktake: null,
            draft_bom: null,
            created_at: new Date('2026-07-01T00:00:00.000Z'),
            updated_at: new Date('2026-07-01T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into purchase_receipt_snapshots')) return { rows: [{ inserted: true }], rowCount: 1 }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 2,
        source_code: 'PN001',
        received_at: '2026-07-12T09:00:00.000Z',
        source_created_at: null,
        updated_at: null,
        supplier_code: 'NCC001',
        supplier_name: 'NCC test',
        supplier_phone: null,
        supplier_address: null,
        received_by_name: null,
        source_creator_name: 'Admin',
        subtotal_amount: 2000,
        receipt_discount_amount: 0,
        payable_amount: 2000,
        paid_amount: 2000,
        note: null,
        supplier_document_no: null,
        total_quantity: 2,
        total_item_count: 1,
        status: 'posted',
        product_code: 'B260',
        product_name: 'Bat 300g',
        brand_name: null,
        unit_name: 'Kho 260',
        product_note: null,
        list_unit_cost: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_cost: 1000,
        line_amount: 2000,
        quantity: 2,
      }],
    })

    const stockInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stock_movements'))
    const productLookupSql = String(pgMock.query.mock.calls.find(([sql]) => (
      String(sql).includes('from products p') && String(sql).includes('product_unit_conversions puc')
    ))?.[0])
    expect(result).toMatchObject({ receipts_created: 1, items_created: 1, skipped_rows: 0 })
    expect(productLookupSql).toContain('join inventory_units sale_unit')
    expect(stockInsertCall?.[1]).toEqual(expect.arrayContaining([
      'product-bt',
      'purchase_receipt',
      416,
      416,
      'purchase_receipt',
      'PN001',
      1000,
      1000,
      'NCC test',
      '2026-07-12T09:00:00.000Z',
    ]))
  })

  test('renumbers a new manual purchase receipt under the database lock when its stale PN code already exists', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.trim().toLowerCase()
      if (normalizedSql === 'begin' || normalizedSql === 'commit' || normalizedSql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('id = $2')) return { rows: [], rowCount: 0 }
      if (sql.includes('select max(') && sql.includes('from purchase_receipt_snapshots')) return { rows: [{ max_number: 689 }], rowCount: 1 }
      if (sql.includes('insert into purchase_receipt_snapshots')) {
        expect(values?.[2]).toBe('PN000690')
        const saved = JSON.parse(String(values?.[3])) as { code: string }
        expect(saved.code).toBe('PN000690')
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const saved = await repository.savePurchaseReceipt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      sourceType: 'manual',
      receipt: {
        id: 'purchase-receipt-new',
        code: 'PN000689',
        supplier_id: 'supplier-thn',
        supplier: { id: 'supplier-thn', code: 'THN', name: 'Thịnh Hồng Nguyên' },
        received_at: '2026-07-21T06:00:00.000Z',
        status: 'draft',
        supplier_document_no: null,
        subtotal_amount: 11926,
        discount_amount: 0,
        payable_amount: 11926,
        paid_amount: 0,
        remaining_amount: 11926,
        notes: null,
        created_by: { id: 'user-1', name: 'Admin' },
        created_at: '2026-07-21T06:00:00.000Z',
        updated_at: '2026-07-21T06:00:00.000Z',
        items: [],
        supplier_payments: [],
      },
    })

    expect(saved?.code).toBe('PN000690')
    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('select max(') && sql.includes('purchase_receipt_snapshots'))).toBe(true)
  })

  test('posts paid purchase receipts with clean PCPN code and receipt time in cashbook', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.trim().toLowerCase()
      if (normalizedSql === 'begin' || normalizedSql === 'commit' || normalizedSql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('limit 1')) {
        return {
          rows: [{
            data: {
              id: 'purchase-receipt-689',
              code: 'PN000689',
              supplier_id: 'supplier-thn',
              supplier: { id: 'supplier-thn', code: 'THN', name: 'Thịnh Hồng Nguyên' },
              received_at: '2026-07-22T10:27:00.000Z',
              status: 'draft',
              supplier_document_no: null,
              subtotal_amount: 8068184,
              discount_amount: 0,
              payable_amount: 8068184,
              paid_amount: 8068184,
              remaining_amount: 0,
              notes: null,
              created_by: { id: 'user-1', name: 'Văn Lâm' },
              created_at: '2026-07-22T10:27:00.000Z',
              updated_at: '2026-07-22T10:27:00.000Z',
              items: [],
              supplier_payments: [],
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from finance_accounts')) {
        return {
          rows: [{
            id: 'bank-1',
            code: 'MBBank',
            name: 'MBBank',
            account_type: 'bank',
            is_default_cash: false,
            is_active: true,
            account_number: '0947900909',
            account_holder: null,
            opening_balance: 0,
            note: null,
            notify_on_transaction: false,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into cashbook_entries')) {
        expect(values?.[2]).toBe('PCPN000689')
        expect(values?.[14]).toBe('2026-07-22T10:27:00.000Z')
        expect(JSON.parse(String(values?.[10]))).toMatchObject({
          id: 'PCPN000689',
          code: 'PCPN000689',
          order_code: 'PN000689',
        })
        expect(JSON.parse(String(values?.[11]))[0]).toMatchObject({
          order_code: 'PN000689',
          order_created_at: '2026-07-22T10:27:00.000Z',
        })
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.postPurchaseReceipt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      id: 'purchase-receipt-689',
      paymentMethod: 'bank_transfer',
      financeAccountId: 'bank-1',
      currentUser: {
        organization: { id: '11111111-1111-1111-1111-111111111111', code: 'VAN-LAM', name: 'Văn Lâm' },
        user: { id: 'user-1', email: 'admin@qc.local', username: 'admin', display_name: 'Văn Lâm', status: 'active' },
        permissions: [],
      },
    })

    expect(result?.cashbook_voucher_id).toEqual(expect.stringMatching(/^cashbook-voucher-/))
    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes('insert into cashbook_entries'))).toBe(true)
  })

  test('recomputes supplier payable from PN and PCPN vouchers instead of receipt remaining only', async () => {
    const { createPgRepository } = await import('./db')
    let updatedSupplier: { current_payable_amount: number; total_purchase_amount: number } | null = null
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.trim().toLowerCase()
      if (normalizedSql === 'begin' || normalizedSql === 'commit' || normalizedSql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('id = $2')) return { rows: [], rowCount: 0 }
      if (sql.includes('insert into purchase_receipt_snapshots')) return { rows: [], rowCount: 1 }
      if (sql.includes('select id, data') && sql.includes('from supplier_snapshots')) {
        return {
          rows: [{
            id: 'supplier-1',
            data: {
              id: 'supplier-1',
              code: 'NCC001',
              name: 'NCC test',
              phone: null,
              email: null,
              address: null,
              tax_code: null,
              linked_customer_id: null,
              linked_customer: null,
              notes: null,
              status: 'active',
              current_payable_amount: 0,
              total_purchase_amount: 0,
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select data') && sql.includes('from purchase_receipt_snapshots')) {
        return {
          rows: [{
            data: {
              id: 'receipt-pn000566',
              code: 'PN000566',
              supplier_id: 'supplier-1',
              supplier: { id: 'supplier-1', code: 'NCC001', name: 'NCC test' },
              received_at: '2026-07-01T00:00:00.000Z',
              status: 'posted',
              payable_amount: 3206581,
              paid_amount: 0,
              remaining_amount: 3206581,
              supplier_payments: [],
              items: [],
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from cashbook_entries') && sql.includes('purchase_supplier_payment')) {
        return {
          rows: [{
            id: 'cashbook-pcpn000566',
            code: 'PCPN000566',
            created_at: new Date('2026-07-02T00:00:00.000Z'),
            amount_delta: '-1000000',
            status: 'posted',
            source: { order_code: 'PN000566' },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('update supplier_snapshots')) {
        updatedSupplier = JSON.parse(String(values?.[2]))
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.savePurchaseReceipt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      sourceType: 'kiotviet_import',
      receipt: {
        id: 'receipt-pn000566',
        code: 'PN000566',
        supplier_id: 'supplier-1',
        supplier: { id: 'supplier-1', code: 'NCC001', name: 'NCC test' },
        received_at: '2026-07-01T00:00:00.000Z',
        status: 'posted',
        supplier_document_no: null,
        subtotal_amount: 3206581,
        discount_amount: 0,
        payable_amount: 3206581,
        paid_amount: 0,
        remaining_amount: 3206581,
        notes: null,
        created_by: { id: 'user-1', name: 'Admin' },
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
        items: [],
        supplier_payments: [],
      },
    })

    expect(updatedSupplier?.total_purchase_amount).toBe(3206581)
    expect(updatedSupplier?.current_payable_amount).toBe(2206581)
    expect(updatedSupplier?.debt_ledger_rows?.map((row) => row.code)).toEqual(['PN000566', 'PCPN000566'])
  })

  test('recomputes linked supplier payable from the inverted customer relationship ledger', async () => {
    const { createPgRepository } = await import('./db')
    let updatedSupplier: { current_payable_amount: number; total_purchase_amount: number; debt_ledger_rows?: Array<{ code: string; amount_delta: number }> } | null = null
    pgMock.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.trim().toLowerCase()
      if (normalizedSql === 'begin' || normalizedSql === 'commit' || normalizedSql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 }
      if (sql.includes('from purchase_receipt_snapshots') && sql.includes('id = $2')) return { rows: [], rowCount: 0 }
      if (sql.includes('insert into purchase_receipt_snapshots')) return { rows: [], rowCount: 1 }
      if (sql.includes('select id, data') && sql.includes('from supplier_snapshots')) {
        return {
          rows: [{
            id: 'supplier-linked',
            data: {
              id: 'supplier-linked',
              code: 'NCC000035',
              name: 'Út Tèo',
              phone: null,
              email: null,
              address: null,
              tax_code: null,
              linked_customer_id: 'customer-ut',
              linked_customer: { id: 'customer-ut', code: 'UT', name: 'Út Tèo' },
              notes: null,
              status: 'active',
              current_payable_amount: 0,
              total_purchase_amount: 0,
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select data') && sql.includes('from purchase_receipt_snapshots')) {
        return {
          rows: [{
            data: {
              id: 'receipt-pn000566',
              code: 'PN000566',
              supplier_id: 'supplier-linked',
              supplier: { id: 'supplier-linked', code: 'NCC000035', name: 'Út Tèo' },
              received_at: '2026-07-03T00:00:00.000Z',
              status: 'posted',
              payable_amount: 4200000,
              paid_amount: 0,
              remaining_amount: 4200000,
              supplier_payments: [],
              items: [],
            },
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from cashbook_entries') && sql.includes('purchase_supplier_payment')) return { rows: [], rowCount: 0 }
      if (sql.includes('from orders') && sql.includes('customer_id = any')) {
        return {
          rows: [{
            id: 'order-hd011293',
            code: 'HD011293',
            created_at: new Date('2026-07-01T00:00:00.000Z'),
            customer_id: 'customer-ut',
            total_amount: '10000000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from cashbook_entries') && sql.includes('kiotviet_cashbook')) {
        return {
          rows: [{
            id: 'cashbook-tthd011293',
            code: 'TTHD011293',
            created_at: new Date('2026-07-02T00:00:00.000Z'),
            customer_id: 'customer-ut',
            amount_delta: '3000000',
            status: 'posted',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from customer_debt_adjustments') && sql.includes('customer_id = any')) return { rows: [], rowCount: 0 }
      if (sql.includes('update supplier_snapshots')) {
        updatedSupplier = JSON.parse(String(values?.[2]))
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.savePurchaseReceipt?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      sourceType: 'kiotviet_import',
      receipt: {
        id: 'receipt-pn000566',
        code: 'PN000566',
        supplier_id: 'supplier-linked',
        supplier: { id: 'supplier-linked', code: 'NCC000035', name: 'Út Tèo' },
        received_at: '2026-07-03T00:00:00.000Z',
        status: 'posted',
        supplier_document_no: null,
        subtotal_amount: 4200000,
        discount_amount: 0,
        payable_amount: 4200000,
        paid_amount: 0,
        remaining_amount: 4200000,
        notes: null,
        created_by: { id: 'user-1', name: 'Admin' },
        created_at: '2026-07-03T00:00:00.000Z',
        updated_at: '2026-07-03T00:00:00.000Z',
        items: [],
        supplier_payments: [],
      },
    })

    expect(updatedSupplier?.total_purchase_amount).toBe(4200000)
    expect(updatedSupplier?.current_payable_amount).toBe(-2800000)
    expect(updatedSupplier?.debt_ledger_rows?.map((row) => [row.code, row.amount_delta])).toEqual([
      ['HD011293', -10000000],
      ['TTHD011293', 3000000],
      ['PN000566', 4200000],
    ])
  })

  test('writes PostgreSQL stock movements from imported KiotViet invoices', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from customer_snapshots')) return { rows: [{ data: { id: 'customer-1', code: 'KH001', name: 'Khach test', phone: null } }], rowCount: 1 }
      if (sql.includes('from products p') && sql.includes('product_unit_conversions puc')) {
        return {
          rows: [{
            id: 'product-bt',
            code: 'BT',
            name: 'Bat 300g',
            status: 'active',
            product_kind: 'roll',
            unit_name: 'm2',
            sell_method: 'area_m2',
            latest_purchase_cost: 1200,
            latest_purchase_cost_at: null,
            default_sale_price: null,
            product_group_id: null,
            product_group: null,
            inventory_shape: 'roll',
            track_inventory: true,
            unit_conversions: [{ source_code: 'B260', unit_name: 'Kho 260', stock_qty_per_unit: 208 }],
            kiotviet_provisional_stock: null,
            operating_stock: null,
            latest_kiotviet_stocktake: null,
            draft_bom: null,
            created_at: new Date('2026-07-01T00:00:00.000Z'),
            updated_at: new Date('2026-07-01T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into orders')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into order_items')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietInvoices?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 2,
        source_code: 'HD001',
        created_at: '2026-07-13T09:00:00.000Z',
        updated_at: null,
        customer_code: 'KH001',
        customer_name: 'Khach test',
        customer_phone: null,
        customer_address: null,
        price_list_name: null,
        source_user_name: 'Admin',
        channel_name: null,
        note: null,
        subtotal_amount: 100000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        cash_amount: 100000,
        bank_amount: 0,
        status: 'completed',
        product_code: 'B260',
        product_name: 'Bat 300g',
        unit_name: 'Kho 260',
        stock_qty_per_sale_unit: null,
        product_note: null,
        quantity: 1,
        list_unit_price: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 100000,
        line_amount: 100000,
      }],
    })

    const stockInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stock_movements'))
    expect(result).toMatchObject({ invoices_created: 1, items_created: 1, skipped_rows: 0 })
    expect(stockInsertCall?.[1]).toEqual(expect.arrayContaining([
      'product-bt',
      'sale_deduction',
      -208,
      -208,
      'sale_invoice',
      'HD001',
      100000,
      1200,
      'Khach test',
      '2026-07-13T09:00:00.000Z',
    ]))
  })

  test('replaces existing imported invoice items when KiotViet invoice is reimported', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from customer_snapshots')) return { rows: [{ data: { id: 'customer-1', code: 'KH001', name: 'Khach test', phone: null } }], rowCount: 1 }
      if (sql.includes('from products p') && sql.includes('product_unit_conversions puc')) {
        return {
          rows: [{
            id: 'product-ib',
            code: 'IB',
            name: 'In bat',
            status: 'active',
            product_kind: 'service',
            unit_name: 'm2',
            sell_method: 'area_m2',
            latest_purchase_cost: 0,
            latest_purchase_cost_at: null,
            default_sale_price: null,
            product_group_id: null,
            product_group: null,
            inventory_shape: 'normal',
            track_inventory: false,
            unit_conversions: [],
            kiotviet_provisional_stock: null,
            operating_stock: null,
            latest_kiotviet_stocktake: null,
            draft_bom: null,
            created_at: new Date('2026-07-01T00:00:00.000Z'),
            updated_at: new Date('2026-07-01T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id from orders where')) return { rows: [{ id: 'existing-order' }], rowCount: 1 }
      if (sql.includes('insert into orders')) return { rows: [{ id: 'existing-order' }], rowCount: 1 }
      if (sql.includes('delete from order_items')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into order_items')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.upsertImportedKiotVietInvoices?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 646,
        source_code: 'HD010729',
        created_at: '2026-06-10T15:26:26.083Z',
        updated_at: null,
        customer_code: 'KH001',
        customer_name: 'Khach test',
        customer_phone: null,
        customer_address: null,
        price_list_name: '40',
        source_user_name: 'Admin',
        channel_name: null,
        note: null,
        subtotal_amount: 600000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 600000,
        paid_amount: 420604,
        cash_amount: 0,
        bank_amount: 420604,
        status: 'completed',
        product_code: 'IB',
        product_name: 'In bat',
        unit_name: 'm2',
        stock_qty_per_sale_unit: null,
        product_note: '3m x 2.5m x 2',
        quantity: 15,
        list_unit_price: 40000,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 40000,
        line_amount: 600000,
      }],
    })

    const calls = pgMock.query.mock.calls
    const deleteItemIndex = calls.findIndex(([sql]) => String(sql).includes('delete from order_items'))
    const insertItemIndex = calls.findIndex(([sql]) => String(sql).includes('insert into order_items'))
    const orderSql = String(calls.find(([sql]) => String(sql).includes('insert into orders'))?.[0])
    const itemInsertCall = calls[insertItemIndex]

    expect(result).toMatchObject({ invoices_updated: 1, items_updated: 1 })
    expect(orderSql).toContain('do update set')
    expect(deleteItemIndex).toBeGreaterThan(-1)
    expect(insertItemIndex).toBeGreaterThan(deleteItemIndex)
    expect(itemInsertCall?.[1]).toEqual([
      '11111111-1111-1111-1111-111111111111',
      'existing-order',
      expect.any(String),
      15,
      40000,
      0,
      600000,
      1,
      null,
      null,
      null,
      '3m x 2.5m x 2',
    ])
  })

  test('updates stale customer debt entries when KiotViet invoice debt changes', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from customer_snapshots')) return { rows: [{ data: { id: 'customer-1', code: 'KH001', name: 'Khach test', phone: null } }], rowCount: 1 }
      if (sql.includes('from products p') && sql.includes('product_unit_conversions puc')) {
        return {
          rows: [{
            id: 'product-ib',
            code: 'IB',
            name: 'In bat',
            status: 'active',
            product_kind: 'service',
            unit_name: 'm2',
            sell_method: 'area_m2',
            latest_purchase_cost: 0,
            latest_purchase_cost_at: null,
            default_sale_price: null,
            product_group_id: null,
            product_group: null,
            inventory_shape: 'normal',
            track_inventory: false,
            unit_conversions: [],
            kiotviet_provisional_stock: null,
            operating_stock: null,
            latest_kiotviet_stocktake: null,
            draft_bom: null,
            created_at: new Date('2026-07-01T00:00:00.000Z'),
            updated_at: new Date('2026-07-01T00:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id from orders where')) return { rows: [{ id: 'existing-order' }], rowCount: 1 }
      if (sql.includes('insert into orders')) return { rows: [{ id: 'existing-order' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      rows: [{
        rowNumber: 646,
        source_code: 'HD010729',
        created_at: '2026-06-10T15:26:26.083Z',
        updated_at: null,
        customer_code: 'KH001',
        customer_name: 'Khach test',
        customer_phone: null,
        customer_address: null,
        price_list_name: '40',
        source_user_name: 'Admin',
        channel_name: null,
        note: null,
        subtotal_amount: 600000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 600000,
        paid_amount: 420604,
        cash_amount: 0,
        bank_amount: 420604,
        status: 'completed',
        product_code: 'IB',
        product_name: 'In bat',
        unit_name: 'm2',
        stock_qty_per_sale_unit: null,
        product_note: '3m x 2.5m x 2',
        quantity: 15,
        list_unit_price: 40000,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 40000,
        line_amount: 600000,
      }],
    })

    const debtCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into customer_debt_entries'))
    const debtSql = String(debtCall?.[0])
    expect(debtSql).toContain('on conflict (organization_id, order_id) do update set')
    expect(debtSql).toContain('remaining_debt = excluded.remaining_debt')
    expect(debtCall?.[1]).toEqual([
      '11111111-1111-1111-1111-111111111111',
      'customer-1',
      'existing-order',
      179396,
      '2026-06-10T15:26:26.083Z',
    ])
  })

  test('writes PostgreSQL stock movements from POS invoices saved through saveSalesDocument', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('insert into orders')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into order_items')) return { rows: [], rowCount: 1 }
      if (sql.includes('delete from stock_movements')) return { rows: [], rowCount: 0 }
      if (sql.includes('from products') && sql.includes('track_inventory') && sql.includes('product_kind') && sql.includes('any(')) {
        return {
          rows: [{ id: 'product-pos-stock', track_inventory: true, product_kind: 'goods' }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.saveSalesDocument?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      document: {
        id: 'order-pos-1',
        code: 'HD-POS-001',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-14T09:00:00.000Z',
        customer: { id: 'customer-retail', code: 'khachle', name: 'Khach le', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 100000,
        discount_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{
          product_id: 'product-pos-stock',
          quantity: 2,
          unit_price: 50000,
          stock_qty_per_sale_unit: 0.5,
          discount_amount: 0,
        }],
      },
      cashbookEntries: [],
    })

    const stockInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stock_movements'))
    expect(stockInsertCall?.[1]).toEqual(expect.arrayContaining([
      'product-pos-stock',
      'sale_deduction',
      -1,
      -1,
      'sale_invoice',
      'HD-POS-001',
      50000,
      null,
      'Khach le',
      '2026-07-14T09:00:00.000Z',
    ]))
  })

  test('POS combo invoices deduct BOM components only, never the combo parent SKU', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('insert into orders')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into order_items')) return { rows: [], rowCount: 1 }
      if (sql.includes('delete from stock_movements')) return { rows: [], rowCount: 0 }
      if (sql.includes('from products') && sql.includes('track_inventory') && sql.includes('product_kind') && sql.includes('any(')) {
        return {
          rows: [{ id: 'product-ib', track_inventory: false, product_kind: 'combo' }],
          rowCount: 1,
        }
      }
      if (sql.includes('from product_boms') && sql.includes("status in ('draft', 'active')")) {
        return {
          rows: [{
            parent_product_id: 'product-ib',
            component_product_id: 'product-bt',
            quantity: 1.2,
            track_inventory: true,
            latest_purchase_cost: 9844.39,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.saveSalesDocument?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      document: {
        id: 'order-pos-combo',
        code: 'HD-POS-COMBO',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-21T09:00:00.000Z',
        customer: { id: 'customer-retail', code: 'khachle', name: 'Khach le', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 650000,
        discount_amount: 0,
        total_amount: 650000,
        paid_amount: 650000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{
          product_id: 'product-ib',
          quantity: 10,
          unit_price: 65000,
          stock_qty_per_sale_unit: 1,
          discount_amount: 0,
        }],
      },
      cashbookEntries: [],
    })

    const stockInsertCalls = pgMock.query.mock.calls.filter(([sql]) => String(sql).includes('insert into stock_movements'))
    expect(stockInsertCalls).toHaveLength(1)
    expect(stockInsertCalls[0]?.[1]).toEqual(expect.arrayContaining([
      'product-bt',
      'sale_deduction',
      -12,
      null,
      'sale_invoice',
      'HD-POS-COMBO',
      null,
      9844.39,
      'Khach le',
      '2026-07-21T09:00:00.000Z',
    ]))
    expect(stockInsertCalls.some(([, values]) => Array.isArray(values) && values.includes('product-ib'))).toBe(false)
  })

  test('writes PostgreSQL stocktake movements from manual stock adjustments', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from products p') && sql.includes('where p.organization_id = $1') && sql.includes('and p.id = $2')) {
        return {
          rows: [{
            id: 'product-adjust',
            code: 'ADJ',
            name: 'Adjust product',
            unit_name: 'Cai',
            latest_purchase_cost: 10000,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from product_inventory_settings')) return { rows: [{ stock_unit_id: 'unit-cai' }], rowCount: 1 }
      if (sql.includes('from stock_movements') && sql.includes('order by created_at desc')) return { rows: [{ ending_qty: '8.000000' }], rowCount: 1 }
      if (sql.includes('insert into stocktakes')) return { rows: [{ id: 'stocktake-adjust', code: 'KK-ADJ', inserted: true }], rowCount: 1 }
      if (sql.includes('insert into stocktake_items')) return { rows: [{ inserted: true }], rowCount: 1 }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      if (sql.includes('from stocktakes st')) {
        return {
          rows: [{
            id: 'stocktake-adjust',
            code: 'KK-ADJ',
            status: 'balanced',
            source_type: 'manual',
            source_creator_name: null,
            created_at: new Date('2026-07-14T09:30:00.000Z'),
            balanced_at: new Date('2026-07-14T09:30:00.000Z'),
            total_actual_qty: '10.000000',
            total_actual_value: '100000',
            total_difference_value: '20000',
            increased_qty: '2.000000',
            decreased_qty: '0.000000',
            created_by_id: 'user-admin',
            created_by_name: 'Admin',
            note: 'Dem lai kho',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from stocktake_items sti')) {
        return {
          rows: [{
            id: 'stocktake-item-adjust',
            line_no: 1,
            product_id: 'product-adjust',
            product_code: 'ADJ',
            product_name: 'Adjust product',
            unit_name: 'Cai',
            system_qty: '8.000000',
            actual_qty: '10.000000',
            difference_qty: '2.000000',
            line_actual_value: '100000',
            line_difference_value: '20000',
            note: 'Dem lai kho',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test') as InventoryAdjustmentRepository
    const result = await repository.adjustNormalProductStock?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      productId: 'product-adjust',
      actualQty: 10,
      reason: 'Dem lai kho',
      createdBy: { id: 'user-admin', name: 'Admin' },
    })

    const stockInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stock_movements'))
    expect(result?.id).toBe('stocktake-adjust')
    expect(stockInsertCall?.[1]).toEqual(expect.arrayContaining([
      'product-adjust',
      'stocktake_balance',
      2,
      10,
      'stocktake',
      'KK-ADJ',
      null,
      10000,
      null,
    ]))
  })

  test('writes PostgreSQL stock movements from normal material openings', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from products p') && sql.includes('product_inventory_settings')) {
        return {
          rows: [{
            id: 'product-normal',
            code: 'NL',
            name: 'Normal material',
            inventory_shape: 'normal',
            stock_unit_id: 'unit-cai',
            stock_unit_code: 'Cai',
            stock_unit_name: 'Cai',
            latest_purchase_cost: 1000,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from product_unit_conversions')) {
        return { rows: [{ stock_qty_per_unit: '100.000000' }], rowCount: 1 }
      }
      if (sql.includes('insert into inventory_material_openings')) return { rows: [{ id: 'opening-1', created_at: new Date('2026-07-14T10:00:00.000Z') }], rowCount: 1 }
      if (sql.includes('insert into stock_movements')) return { rows: [{ inserted: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test') as InventoryAdjustmentRepository
    const result = await repository.createMaterialOpening?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      input: {
        product_id: 'product-normal',
        inventory_shape: 'normal',
        opened_unit_id: 'unit-box',
        opened_qty: 1,
        old_remaining_qty: 20,
        note: 'Khui thung cu',
      },
    })

    const stockInsertCall = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('insert into stock_movements'))
    expect(result).toMatchObject({
      id: 'opening-1',
      product_id: 'product-normal',
      inventory_shape: 'normal',
      source_type: 'manual_normal',
      opened_unit_id: 'unit-box',
      opened_qty: 1,
      opened_stock_qty: 100,
    })
    expect(stockInsertCall?.[1]).toEqual(expect.arrayContaining([
      'product-normal',
      'material_opening',
      80,
      80,
      'material_opening',
      'opening-1',
      null,
      1000,
      null,
    ]))
  })

  test('loads and upserts PostgreSQL product BOM as active version', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from products') && sql.includes('id::text = $2') && !sql.includes('product_bom')) {
        return { rows: [{ id: 'product-hh' }], rowCount: 1 }
      }
      if (sql.includes('select coalesce(max(version)')) return { rows: [{ next_version: 1 }], rowCount: 1 }
      if (sql.includes('insert into product_boms')) return { rows: [], rowCount: 1 }
      if (sql.includes('insert into product_bom_items')) return { rows: [], rowCount: 1 }
      if (sql.includes('from product_boms') && sql.includes("status in ('active', 'draft')")) {
        return {
          rows: [{
            id: 'bom-hh',
            product_id: 'product-hh',
            version: 1,
            status: 'active',
            notes: null,
            created_at: new Date('2026-07-21T09:00:00.000Z'),
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('from product_bom_items pbi')) {
        return {
          rows: [{
            id: 'bom-item-1',
            component_product_id: 'product-dcs',
            quantity: 0.6,
            sort_order: 1,
            notes: null,
            component_id: 'product-dcs',
            component_code: 'DCS',
            component_name: 'Decal',
            component_unit_name: 'm2',
            component_product_kind: 'goods',
            component_latest_purchase_cost: 1000,
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const saved = await repository.upsertProductBom?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      productId: 'product-hh',
      notes: null,
      items: [{ component_product_id: 'product-dcs', quantity: 0.6 }],
    })
    const loaded = await repository.getProductBom?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      productId: 'product-hh',
    })

    expect(saved).toMatchObject({
      id: 'bom-hh',
      product_id: 'product-hh',
      status: 'active',
      items: [expect.objectContaining({ component_product_id: 'product-dcs', quantity: 0.6 })],
    })
    expect(loaded?.status).toBe('active')
    const insertBomSql = pgMock.query.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes('insert into product_boms')) ?? ''
    expect(insertBomSql).toContain("'active'")
  })

  test('persists KiotViet BOM rows as active product BOMs', async () => {
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
        note: 'Imported from KiotViet product BOM. Trusted for stock deduction.',
      }],
    })

    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))
    const insertBomSql = sqlCalls.find((sql) => sql.includes('insert into product_boms')) ?? ''
    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(sqlCalls.some((sql) => sql.includes('create table if not exists product_boms'))).toBe(true)
    expect(insertBomSql).toContain("'active'")
    expect(sqlCalls.some((sql) => sql.includes("status in ('draft', 'active')") && sql.includes('Imported from KiotViet'))).toBe(true)
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

  test('hydrates PostgreSQL cashbook rows with the current finance account record', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from cashbook_entries')) {
        return {
          rows: [
            {
              id: 'cashbook-bank-current-account',
              code: 'TTHD011149',
              status: 'posted',
              direction: 'in',
              amount_delta: 220000,
              finance_account: { id: 'bank-kv-0947900909', code: '0947900909', name: 'van viet phuong lam', account_type: 'bank' },
              counterparty: { type: 'other', name: '', phone: null },
              note: '',
              source_type: 'kiotviet_cashbook',
              source: {},
              allocations: [],
              is_business_accounted: true,
              created_at: new Date('2026-07-13T00:00:00.000Z'),
            },
          ],
          rowCount: 1,
        }
      }
      if (sql.includes('from finance_accounts')) {
        return {
          rows: [
            {
              id: 'bank-kv-0947900909',
              code: 'MBBank',
              name: 'MBBank',
              account_type: 'bank',
              is_default_cash: false,
              is_active: true,
              account_number: '0947900909',
              account_holder: 'VAN VIET PHUONG LAM',
              opening_balance: 0,
              note: null,
              notify_on_transaction: true,
            },
          ],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const entries = await repository.listCashbookEntries?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/cashbook?search=TTHD011149&page=1&page_size=10'),
    })

    expect(entries?.[0]?.finance_account).toEqual(expect.objectContaining({
      code: '0947900909',
      name: 'MBBank',
      account_number: '0947900909',
      account_holder: 'VAN VIET PHUONG LAM',
    }))
  })

  test('updates PostgreSQL cashbook entries without writing derived payment_method column', async () => {
    const { createPgRepository } = await import('./db')
    const cashbookRow = {
      id: 'cashbook-tt001848',
      code: 'TT001848',
      status: 'posted',
      direction: 'in',
      amount_delta: 96000,
      finance_account: { id: 'bank-vcb', code: '0000000000', name: 'VCB', account_type: 'bank', account_number: '0000000000' },
      counterparty: { type: 'customer', name: 'Dao Tuan', phone: null },
      note: 'Thu no HD011155',
      source_type: 'kiotviet_cashbook',
      source: {},
      allocations: [],
      is_business_accounted: true,
      created_by: { id: 'user-1', name: 'Admin' },
      created_at: new Date('2026-07-20T00:17:00.000Z'),
    }
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from cashbook_entries')) return { rows: [cashbookRow], rowCount: 1 }
      if (sql.includes('from finance_accounts')) return {
        rows: [{
          id: 'bank-vcb',
          code: 'VCB',
          name: 'VCB',
          account_type: 'bank',
          is_default_cash: false,
          is_active: true,
          account_number: '0000000000',
          account_holder: 'Admin',
          opening_balance: 0,
          note: null,
          notify_on_transaction: true,
        }],
        rowCount: 1,
      }
      if (sql.includes('update cashbook_entries')) return { rows: [cashbookRow], rowCount: 1 }
      if (sql.includes('from users')) return { rows: [{ id: 'user-1', display_name: 'Admin' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    await repository.updateCashbookEntry?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      id: 'TT001848',
      created_at: '2026-07-20T00:17:00.000Z',
      finance_account_id: 'bank-vcb',
    })

    const updateSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('update cashbook_entries'))?.[0])
    expect(updateSql).toContain('finance_account = $5')
    expect(updateSql).not.toContain('payment_method')
  })

  test('paginates PostgreSQL cashbook rows in SQL and keeps summary in the database', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from finance_accounts')) {
        return {
          rows: [
            {
              id: 'cash-main',
              code: 'TM01',
              name: 'Tien mat',
              account_type: 'cash',
              is_default_cash: true,
              is_active: true,
              account_number: null,
              account_holder: null,
              opening_balance: 0,
              note: null,
              notify_on_transaction: true,
            },
          ],
          rowCount: 1,
        }
      }
      if (sql.includes('from users')) {
        return { rows: [{ id: 'user-1', display_name: 'Admin' }], rowCount: 1 }
      }
      if (sql.includes('with base_entries')) {
        return {
          rows: [{
            id: 'cashbook-page-1',
            code: 'TTHD011149',
            status: 'posted',
            direction: 'in',
            amount_delta: '220000',
            finance_account: { id: 'cash-main', code: 'TM01', name: 'Tien mat', account_type: 'cash' },
            counterparty: { type: 'customer', name: 'Khach', phone: null },
            note: 'Thu tien',
            source_type: 'payment_receipt_method',
            source: { type: 'payment_receipt', id: 'source-1', code: 'TT000001', order_code: 'HD011149', transfer_content: 'Khach tra tien' },
            allocations: [],
            is_business_accounted: true,
            created_by: { id: 'user-1', name: 'admin' },
            created_at: new Date('2026-07-18T04:51:00.000Z'),
            total: 1,
            total_in: '220000',
            total_out: '0',
            opening_balance: '100000',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.listCashbookEntriesPage?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/finance/cashbook?search=Khach&search_scope=transfer_content&page=2&page_size=20&from=2026-07-01&to=2026-07-31&is_business_accounted=true'),
    })

    const pageSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with base_entries'))?.[0])
    expect(pageSql).toContain('limit $')
    expect(pageSql).toContain('offset $')
    expect(pageSql).toContain('coalesce(sum(greatest(amount_delta, 0)), 0) as total_in')
    expect(pageSql).toContain('coalesce(sum(amount_delta), 0) as opening_balance')
    expect(result).toEqual({
      items: [{
        id: 'cashbook-page-1',
        code: 'TTHD011149',
        status: 'posted',
        direction: 'in',
        amount_delta: 220000,
        finance_account: { id: 'cash-main', code: 'TM01', name: 'Tien mat', account_type: 'cash', account_number: null, account_holder: null },
        counterparty: { type: 'customer', name: 'Khach', phone: null },
        note: 'Thu tien',
        source_type: 'payment_receipt_method',
        source: { type: 'payment_receipt', id: 'source-1', code: 'TT000001', order_code: 'HD011149', transfer_content: 'Khach tra tien' },
        allocations: [],
        is_business_accounted: true,
        created_by: { id: 'user-1', name: 'Admin' },
        created_at: '2026-07-18T04:51:00.000Z',
      }],
      total: 1,
      summary: {
        opening_balance: 100000,
        total_in: 220000,
        total_out: 0,
        ending_balance: 320000,
      },
    })
  })

  test('cancels QCVL customer debt payment receipts and rolls allocations back', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [], rowCount: 0 }
      if (sql.includes('select *') && sql.includes('from cashbook_entries') && sql.includes('limit 1') && sql.includes('for update')) {
        return {
          rows: [{
            id: 'cashbook-tt001849',
            code: 'TT001849',
            status: 'posted',
            direction: 'in',
            amount_delta: '9000000',
            finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: new Date('2026-07-20T13:15:00.000Z'),
            note: 'Thu no',
            counterparty: { type: 'customer', name: 'Ut Teo', phone: null },
            created_by: null,
            source: { type: 'payment_receipt', id: 'receipt-tt001849', code: 'TT001849', customer_id: 'customer-kv-ut' },
            allocations: [
              { order_id: 'order-hd011163', order_code: 'HD011163', order_total_amount: 209300, collected_before: 0, allocated_amount: 209300, remaining_after: 0 },
              { order_id: 'adjustment-pn000566', order_code: 'PN000566', order_total_amount: 17642587, collected_before: 0, allocated_amount: 15914394, remaining_after: 1728193 },
            ],
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select *') && sql.includes('source_type = \'payment_receipt_method\'') && sql.includes('for update')) {
        return {
          rows: [{
            id: 'cashbook-tt001849',
            code: 'TT001849',
            status: 'posted',
            direction: 'in',
            amount_delta: '9000000',
            finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: new Date('2026-07-20T13:15:00.000Z'),
            note: 'Thu no',
            counterparty: { type: 'customer', name: 'Ut Teo', phone: null },
            created_by: null,
            source: { type: 'payment_receipt', id: 'receipt-tt001849', code: 'TT001849', customer_id: 'customer-kv-ut' },
            allocations: [
              { order_id: 'order-hd011163', order_code: 'HD011163', order_total_amount: 209300, collected_before: 0, allocated_amount: 209300, remaining_after: 0 },
              { order_id: 'adjustment-pn000566', order_code: 'PN000566', order_total_amount: 17642587, collected_before: 0, allocated_amount: 15914394, remaining_after: 1728193 },
            ],
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select *') && sql.includes('where organization_id = $1') && sql.includes('and id = $2')) {
        return {
          rows: [{
            id: 'cashbook-tt001849',
            code: 'TT001849',
            status: 'cancelled',
            direction: 'in',
            amount_delta: '9000000',
            finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: new Date('2026-07-20T13:15:00.000Z'),
            note: 'Thu no',
            counterparty: { type: 'customer', name: 'Ut Teo', phone: null },
            created_by: null,
            source: { type: 'payment_receipt', id: 'receipt-tt001849', code: 'TT001849', customer_id: 'customer-kv-ut' },
            allocations: [],
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.cancelCashbookVoucher?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      id: 'receipt-tt001849',
    })
    const sqlCalls = pgMock.query.mock.calls.map(([sql]) => String(sql))

    expect(result).toEqual(expect.objectContaining({ code: 'TT001849', status: 'cancelled' }))
    expect(sqlCalls.some((sql) => sql.includes('update customer_debt_entries cde'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('update orders'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('update customer_debt_adjustments'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes("set status = 'cancelled'"))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('delete from payment_receipts'))).toBe(true)
  })
})

describe('createPgRepository sales document paging', () => {
  beforeEach(() => {
    pgMock.Pool.mockClear()
    pgMock.query.mockReset()
    pgMock.end.mockReset()
  })

  test('pushes sales document filters and paging into SQL', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('with filtered_orders')) {
        return {
          rows: [{
            id: 'order-1',
            code: 'HD000001',
            order_type: 'invoice',
            status: 'completed',
            created_at: new Date('2026-07-10T08:00:00.000Z'),
            customer_snapshot: { id: 'customer-1', code: 'KH000001', name: 'Thanh Test', phone: null },
            seller_snapshot: { id: 'user-1', name: 'Admin' },
            subtotal_amount: '700000',
            discount_amount: '0',
            total_amount: '700000',
            paid_amount: '500000',
            debt_amount: '200000',
            payment_status: 'partial',
            note: '',
            items: [{
              product_id: 'product-1',
              product_snapshot: { code: 'IPP', name: 'In PP', unit_name: 'm2', sell_method: 'area_m2' },
              quantity: 3.72,
              unit_price: 63000,
              discount_amount: 0,
              line_total: 234360,
              width_m: 1.2,
              height_m: 3.1,
              linear_m: null,
              note: 've sinh + dan bang',
            }],
            base_code: null,
            revision_no: '0',
            revised_from_order_id: null,
            replaced_by_order_id: null,
            cancel_reason_type: null,
            revision_reason_code: null,
            revision_reason_note: null,
            total: 3,
            summary_total_amount: '900000',
            summary_debt_amount: '200000',
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id::text, display_name')) {
        return { rows: [{ id: 'user-1', display_name: 'Phạm Nhật Linh 2' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const result = await repository.listSalesDocumentsPage?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      url: new URL('http://api.local/api/v1/sales-documents?type=invoice&status=completed&payment_status=partial&from=2026-07-01&to=2026-07-18&page=2&page_size=25&search=Thanh'),
    })

    const pageSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with filtered_orders'))?.[0])
    const pageValues = pgMock.query.mock.calls.find(([sql]) => String(sql).includes('with filtered_orders'))?.[1]
    expect(pageSql).toContain('from orders o')
    expect(pageSql).toContain('o.order_type = any($')
    expect(pageSql).toContain("(o.created_at at time zone 'UTC')::date >= $")
    expect(pageSql).toContain('join paged_orders po on po.id = oi.order_id')
    expect(pageSql).toContain('left join products p')
    expect(pageSql).toContain("'product_snapshot'")
    expect(pageSql).toContain('limit $')
    expect(pageSql).toContain('offset $')
    expect(pageValues?.at(-2)).toBe(25)
    expect(pageValues?.at(-1)).toBe(25)
    expect(result?.total).toBe(3)
    expect(result?.summary.total_amount).toBe(900000)
    expect(result?.items[0].seller.name).toBe('Phạm Nhật Linh 2')
  })

  test('gets sales document detail by id or code', async () => {
    const { createPgRepository } = await import('./db')
    pgMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from orders o') && sql.includes('limit 1')) {
        return {
          rows: [{
            id: 'order-1',
            code: 'HD010985',
            order_type: 'invoice',
            status: 'completed',
            created_at: new Date('2026-06-30T17:08:00.000Z'),
            customer_snapshot: { id: 'customer-1', code: 'KH000001', name: 'Thanh Test', phone: null },
            seller_snapshot: { id: 'user-1', name: 'Admin' },
            subtotal_amount: '700000',
            discount_amount: '0',
            total_amount: '700000',
            paid_amount: '500000',
            debt_amount: '200000',
            payment_status: 'partial',
            note: '',
            items: [{
              product_id: 'product-1',
              product_snapshot: { code: 'IPP', name: 'In PP', unit_name: 'm2', sell_method: 'area_m2' },
              quantity: 3.72,
              unit_price: 63000,
              discount_amount: 0,
              line_total: 234360,
              width_m: 1.2,
              height_m: 3.1,
              linear_m: null,
              note: 've sinh + dan bang',
            }],
            base_code: null,
            revision_no: '0',
            revised_from_order_id: null,
            replaced_by_order_id: null,
            cancel_reason_type: null,
            revision_reason_code: null,
            revision_reason_note: null,
          }],
          rowCount: 1,
        }
      }
      if (sql.includes('select id::text, display_name')) {
        return { rows: [{ id: 'user-1', display_name: 'Phạm Nhật Linh 2' }], rowCount: 1 }
      }
      if (sql.includes('from payment_receipts')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    })

    const repository = createPgRepository('postgres://unit-test')
    const byCode = await repository.getSalesDocument?.({
      organizationId: '11111111-1111-1111-1111-111111111111',
      id: 'HD010985',
    })

    const detailSql = String(pgMock.query.mock.calls.find(([sql]) => String(sql).includes('from orders o') && String(sql).includes('limit 1'))?.[0])
    expect(detailSql).toContain('(o.id = $2 or o.code = $2)')
    expect(byCode?.code).toBe('HD010985')
    expect(byCode?.payment_receipts).toEqual([])
    expect(byCode?.items[0]).toEqual(expect.objectContaining({
      note: 've sinh + dan bang',
      width_m: 1.2,
      height_m: 3.1,
      linear_m: null,
    }))
  })
})
