import { describe, expect, it, vi } from 'vitest'
import { applyKiotVietProductImport, mapKiotVietProductRows, previewKiotVietProductImport, type KiotVietImportProductRow } from './product-import'

const rows: KiotVietImportProductRow[] = [
  {
    rowNumber: 2,
    code: 'A10T',
    name: 'Alu 3li 0.1 Trắng',
    product_group_name: 'Alu>>Vật tư',
    product_kind: 'goods',
    inventory_shape: 'normal',
    sell_method: 'quantity',
    track_inventory: true,
    unit_name: 'Tấm',
    unit_name_needs_review: false,
    latest_purchase_cost: 200000,
    status: 'active',
    unit_conversions: [],
    sale_price: 0,
    provisional_stock: 4,
    bom_text: null,
    expected_out_of_stock_text: '15 ngày',
    source_created_at: null,
    ignored: { brand: null, min_stock: 0, max_stock: 999999999, direct_sale: 1, location: null },
  },
]

describe('product import server flow', () => {
  it('previews create/update counts without writing', async () => {
    const repository = {
      findProductsByCodes: vi.fn(async () => new Set(['A10T'])),
    }

    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(repository.findProductsByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['A10T'] })
    expect(result.summary).toMatchObject({
      total_rows: 1,
      valid_rows: 1,
      invalid_rows: 0,
      create_rows: 0,
      update_rows: 1,
      cleanup_demo_requested: false,
      unit_review_rows: 0,
      price_rows: 0,
      price_skipped_rows: 1,
      price_list_name: null,
    })
    expect(result.summary.deferred_columns).toEqual(['Dự kiến hết hàng'])
  })

  it('previews sale price rows for the default price list', async () => {
    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository: {
        findProductsByCodes: vi.fn(async () => new Set()),
        findDefaultPriceList: vi.fn(async () => ({ id: 'pl-default', name: 'Bang gia le' })),
      },
      rows: [
        { ...rows[0], code: 'A10T', sale_price: 650000 },
        { ...rows[0], code: 'NO-PRICE', sale_price: 0 },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(result.summary).toMatchObject({
      price_rows: 1,
      price_skipped_rows: 1,
      price_list_name: 'Bang gia le',
    })
  })

  it('previews provisional stock rows from KiotViet inventory column', async () => {
    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository: { findProductsByCodes: vi.fn(async () => new Set()) },
      rows: [
        { ...rows[0], code: 'A10T', provisional_stock: 4 },
        { ...rows[0], code: 'NO-STOCK', provisional_stock: 0 },
        { ...rows[0], code: 'EMPTY-STOCK', provisional_stock: null },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(result.summary).toMatchObject({
      provisional_stock_rows: 1,
      provisional_stock_skipped_rows: 2,
    })
  })

  it('previews KiotViet BOM rows with parsable component quantities', async () => {
    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository: { findProductsByCodes: vi.fn(async () => new Set()) },
      rows: [
        { ...rows[0], code: 'HH', bom_text: 'DCS:0.6|F5:0.3' },
        { ...rows[0], code: 'NO-BOM', bom_text: null },
        { ...rows[0], code: 'BAD-BOM', bom_text: 'SAI' },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(result.summary).toMatchObject({
      bom_rows: 1,
      bom_skipped_rows: 2,
    })
  })

  it('previews rows that need unit review without blocking import', async () => {
    const result = await previewKiotVietProductImport({
      organizationId: 'org-1',
      repository: { findProductsByCodes: vi.fn(async () => new Set()) },
      rows: [{ ...rows[0], code: 'NO-UNIT', unit_name: 'Cần cập nhật', unit_name_needs_review: true }],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(result.summary).toMatchObject({
      valid_rows: 1,
      invalid_rows: 0,
      unit_review_rows: 1,
    })
  })

  it('maps KiotViet unit conversion rows into the parent product only', () => {
    const result = mapKiotVietProductRows([
      { rowNumber: 2, 'Mã hàng': 'BT', 'Tên hàng': 'Bạt 300g Ojet Tím', 'ĐVT': 'm2', 'Mã ĐVT Cơ bản': '1', 'Quy đổi': '' },
      { rowNumber: 3, 'Mã hàng': 'B50', 'Tên hàng': 'Bạt 300g Ojet Tím', 'ĐVT': 'Khổ 50', 'Mã ĐVT Cơ bản': 'BT', 'Quy đổi': 40 },
    ])

    expect(result.invalid).toHaveLength(0)
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      code: 'BT',
      unit_conversions: [{ source_code: 'B50', unit_name: 'Khổ 50', stock_qty_per_unit: 40 }],
    })
  })

  it('applies import by upserting groups and products by code', async () => {
    const repository = {
      deleteDemoProductsForImport: vi.fn(async () => ({ deleted: 3, blocked: 0 })),
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows,
      invalidRows: [],
      cleanupDemo: true,
    })

    expect(repository.deleteDemoProductsForImport).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(repository.upsertProductGroupsByName).toHaveBeenCalledWith({ organizationId: 'org-1', names: ['Alu>>Vật tư'] })
    expect(repository.upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({
          code: 'A10T',
          product_group_id: 'group-1',
          latest_purchase_cost: 200000,
        }),
      ],
    })
    expect(result.summary).toMatchObject({
      created_rows: 1,
      updated_rows: 0,
      cleanup_deleted_rows: 3,
      cleanup_blocked_rows: 0,
    })
  })

  it('passes KiotViet source created time to product upsert', async () => {
    const repository = {
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Váº­t tÆ°', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
    }

    await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows: [{ ...rows[0], source_created_at: '31/07/2026 08:30' }],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(repository.upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({
          code: 'A10T',
          source_created_at: '2026-07-31T08:30:00.000Z',
        }),
      ],
    })
  })

  it('normalizes KiotViet Excel serial source created time to product upsert', async () => {
    const repository = {
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>VÃ¡ÂºÂ­t tÃ†Â°', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
    }

    await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows: [{ ...rows[0], source_created_at: '46204.42164644676' }],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(repository.upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({
          code: 'A10T',
          source_created_at: '2026-07-01T10:07:10.253Z',
        }),
      ],
    })
  })

  it('applies sale prices to the default price list after product upsert', async () => {
    const upsertDefaultPriceListItems = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
    const repository = {
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Váº­t tÆ°', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
      findDefaultPriceList: vi.fn(async () => ({ id: 'pl-default', name: 'Bang gia le' })),
      upsertDefaultPriceListItems,
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows: [
        { ...rows[0], code: 'A10T', sale_price: 650000 },
        { ...rows[0], code: 'NO-PRICE', sale_price: 0 },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(upsertDefaultPriceListItems).toHaveBeenCalledWith({
      organizationId: 'org-1',
      priceListId: 'pl-default',
      rows: [{ product_code: 'A10T', unit_price: 650000 }],
    })
    expect(result.summary).toMatchObject({
      price_created_rows: 1,
      price_updated_rows: 0,
      price_skipped_rows: 1,
      price_list_name: 'Bang gia le',
    })
  })

  it('applies provisional stock balances after product upsert', async () => {
    const upsertProvisionalStockBalances = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
    const repository = {
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
      upsertProvisionalStockBalances,
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows: [
        { ...rows[0], code: 'A10T', provisional_stock: 4, unit_name: 'Tấm' },
        { ...rows[0], code: 'NO-STOCK', provisional_stock: 0 },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(upsertProvisionalStockBalances).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [{ product_code: 'A10T', quantity: 4, unit_name: 'Tấm', source_label: 'KiotViet product import' }],
    })
    expect(result.summary).toMatchObject({
      provisional_stock_created_rows: 1,
      provisional_stock_updated_rows: 0,
      provisional_stock_skipped_rows: 1,
    })
  })

  it('applies KiotViet BOM rows as draft BOMs after product upsert', async () => {
    const upsertDraftProductBoms = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
    const repository = {
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'group-1']])),
      upsertProductsByCode: vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 })),
      upsertDraftProductBoms,
    }

    const result = await applyKiotVietProductImport({
      organizationId: 'org-1',
      repository,
      rows: [
        { ...rows[0], code: 'HH', bom_text: 'DCS:0.6|F5:0.3' },
        { ...rows[0], code: 'BAD-BOM', bom_text: 'SAI' },
      ],
      invalidRows: [],
      cleanupDemo: false,
    })

    expect(upsertDraftProductBoms).toHaveBeenCalledWith({
      organizationId: 'org-1',
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
    expect(result.summary).toMatchObject({
      bom_created_rows: 1,
      bom_updated_rows: 0,
      bom_skipped_rows: 1,
    })
  })
})
