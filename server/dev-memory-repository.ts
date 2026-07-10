import { hashPassword, type AuthUserRow, type CurrentUserData, type ProductListData, type ServerRepository, type StocktakeListData } from './http.js'

const organization = { id: 'org-dev-memory', code: 'DEV', name: 'QCVL Dev' }
const defaultPriceList = { id: 'pl-dev-default', name: 'Bang gia le' }
const adminUser = {
  id: 'user-dev-admin',
  email: 'admin@qc-oms.local',
  organization_id: organization.id,
  display_name: 'Admin',
  status: 'active',
} satisfies Omit<AuthUserRow, 'password_hash'>

export async function createDevMemoryRepository(): Promise<ServerRepository & { close(): Promise<void> }> {
  const sessions = new Map<string, string>()
  const products = new Map<string, ProductListData>()
  const defaultSalePrices = new Map<string, number>()
  const provisionalStockBalances = new Map<string, { quantity: number; unit_name: string; source_label: string | null }>()
  const draftBoms = new Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>()
  const stocktakes = new Map<string, StocktakeListData>()
  const stocktakeItems = new Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>>()
  const groupIds = new Map<string, string>()
  const groupNamesById = new Map<string, string>()
  const user: AuthUserRow = {
    ...adminUser,
    password_hash: await hashPassword(process.env.QCVL_DEV_PASSWORD ?? 'ChangeMe123!'),
  }

  return {
    async findUserByEmail(email) {
      const normalized = email.trim().toLowerCase()
      return normalized === user.email || normalized === 'adminnas' || normalized === 'admin' ? user : null
    },
    async createSession(input) {
      sessions.set(input.token, input.userId)
    },
    async deleteSession(token) {
      sessions.delete(token)
    },
    async getSessionUser(token) {
      return sessions.has(token) || token.trim().length > 0 ? currentUser() : null
    },
    async listWorkstations() {
      return [{ id: 'ws-dev', code: 'DEV', name: 'May dev', status: 'active' }]
    },
    async listProducts(input) {
      const search = normalize(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const sellMethod = input.url.searchParams.get('sell_method')
      const inventoryShape = input.url.searchParams.get('inventory_shape')
      const productKind = input.url.searchParams.get('product_kind')
      const productGroupId = input.url.searchParams.get('product_group_id')
      const createdFrom = input.url.searchParams.get('created_from')
      const createdTo = input.url.searchParams.get('created_to')

      return [...products.values()].filter((product) => {
        if (status && status !== 'all' && product.status !== status) return false
        if (sellMethod && product.sell_method !== sellMethod) return false
        if (inventoryShape && product.inventory_shape !== inventoryShape) return false
        if (productKind && product.product_kind !== productKind) return false
        if (productGroupId && product.product_group_id !== productGroupId) return false
        if (!dateRangeMatches(product.created_at, createdFrom, createdTo)) return false
        if (search && !normalize(`${product.code} ${product.name}`).includes(search)) return false
        return true
      }).map((product) => withImportReviewMetadata(product, provisionalStockBalances, draftBoms))
    },
    async findProductsByCodes(input) {
      return new Set(input.codes.filter((code) => products.has(code)))
    },
    async deleteDemoProductsForImport() {
      const before = products.size
      for (const code of [...products.keys()]) {
        if (code.startsWith('DEV20-SP-') || code === 'MICA-3MM' || code === 'DECAL-PP' || code === 'CUT-CNC') {
          products.delete(code)
          defaultSalePrices.delete(code)
          provisionalStockBalances.delete(code)
          draftBoms.delete(code)
        }
      }
      return { deleted: before - products.size, blocked: 0 }
    },
    async deleteImportedKiotVietProducts() {
      const deleted = products.size
      products.clear()
      defaultSalePrices.clear()
      provisionalStockBalances.clear()
      draftBoms.clear()
      return { deleted, blocked: 0 }
    },
    async findDefaultPriceList() {
      return defaultPriceList
    },
    async upsertProductGroupsByName(input) {
      for (const name of input.names) {
        if (!groupIds.has(name)) {
          const id = `pg-${slug(name)}`
          groupIds.set(name, id)
          groupNamesById.set(id, name)
        }
      }
      return groupIds
    },
    async upsertProductsByCode(input) {
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const existing = products.get(row.code)
        if (existing) updated += 1
        else created += 1
        products.set(row.code, toProduct(row, existing, groupNamesById))
      }
      return { created, updated, skipped: 0 }
    },
    async upsertDefaultPriceListItems(input) {
      let created = 0
      let updated = 0
      let skipped = 0
      for (const row of input.rows) {
        if (!products.has(row.product_code)) {
          skipped += 1
          continue
        }
        if (defaultSalePrices.has(row.product_code)) updated += 1
        else created += 1
        defaultSalePrices.set(row.product_code, row.unit_price)
        const existing = products.get(row.product_code)
        if (existing) products.set(row.product_code, { ...existing, default_sale_price: row.unit_price, updated_at: new Date().toISOString() })
      }
      return { created, updated, skipped }
    },
    async upsertProvisionalStockBalances(input) {
      let created = 0
      let updated = 0
      let skipped = 0
      for (const row of input.rows) {
        if (!products.has(row.product_code)) {
          skipped += 1
          continue
        }
        if (provisionalStockBalances.has(row.product_code)) updated += 1
        else created += 1
        provisionalStockBalances.set(row.product_code, {
          quantity: row.quantity,
          unit_name: row.unit_name,
          source_label: row.source_label,
        })
      }
      return { created, updated, skipped }
    },
    async upsertDraftProductBoms(input) {
      let created = 0
      let updated = 0
      let skipped = 0
      for (const row of input.rows) {
        if (!products.has(row.product_code) || row.components.some((component) => !products.has(component.component_code))) {
          skipped += 1
          continue
        }
        if (draftBoms.has(row.product_code)) updated += 1
        else created += 1
        draftBoms.set(row.product_code, row)
      }
      return { created, updated, skipped }
    },
    async deleteDemoStocktakesForImport() {
      let deleted = 0
      const demoCodes = new Set(['KK-JULY', 'KK-JUNE', 'KK-DEMO'])
      for (const code of [...stocktakes.keys()]) {
        if (!isDemoStocktakeCode(code, demoCodes)) continue
        stocktakes.delete(code)
        stocktakeItems.delete(code)
        deleted += 1
      }
      return { deleted, blocked: 0 }
    },
    async deleteImportedKiotVietStocktakes() {
      const deleted = stocktakes.size
      stocktakes.clear()
      stocktakeItems.clear()
      return { deleted, blocked: 0 }
    },
    async upsertImportedKiotVietStocktakes(input) {
      let stocktakesCreated = 0
      let stocktakesUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let missingProductRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      for (const [sourceCode, rows] of rowsBySourceCode) {
        const existing = stocktakes.get(sourceCode)
        if (existing) stocktakesUpdated += 1
        else stocktakesCreated += 1

        const itemMap = stocktakeItems.get(sourceCode) ?? new Map<number, typeof rows[number]>()
        for (const row of rows) {
          if (!products.has(row.product_code)) missingProductRows += 1
          if (itemMap.has(row.rowNumber)) itemsUpdated += 1
          else itemsCreated += 1
          itemMap.set(row.rowNumber, row)
        }
        stocktakeItems.set(sourceCode, itemMap)
        stocktakes.set(sourceCode, toImportedStocktake(sourceCode, rows, itemMap))
      }

      return {
        stocktakes_created: stocktakesCreated,
        stocktakes_updated: stocktakesUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        missing_product_rows: missingProductRows,
      }
    },
    async listStocktakes(input) {
      const search = normalize(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const statuses = status === null
        ? null
        : status === '__none__'
          ? new Set<string>()
          : new Set(status.split(',').map((item) => item.trim()).filter(Boolean))
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      return [...stocktakes.values()]
        .filter((stocktake) => {
          if (statuses !== null && !statuses.has(stocktake.status)) return false
          if (!dateRangeMatches(stocktake.created_at, from, to)) return false
          if (search && !normalize(`${stocktake.code} ${stocktake.note ?? ''}`).includes(search)) return false
          return true
        })
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    },
    async close() {},
  }
}

function withImportReviewMetadata(
  product: ProductListData,
  provisionalStockBalances: Map<string, { quantity: number; unit_name: string; source_label: string | null }>,
  draftBoms: Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>,
): ProductListData {
  const provisionalStock = provisionalStockBalances.get(product.code)
  const draftBom = draftBoms.get(product.code)
  return {
    ...product,
    kiotviet_provisional_stock: provisionalStock
      ? {
          quantity: provisionalStock.quantity,
          unit_name: provisionalStock.unit_name,
          source_type: 'kiotviet_import',
          source_label: provisionalStock.source_label,
        }
      : null,
    draft_bom: draftBom
      ? {
          id: `draft-bom-${slug(product.code)}`,
          version: 1,
          status: 'draft',
          item_count: draftBom.components.length,
          notes: draftBom.note,
        }
      : null,
  }
}

function toProduct(
  row: Parameters<NonNullable<ServerRepository['upsertProductsByCode']>>[0]['rows'][number],
  existing: ProductListData | undefined,
  groupNamesById: Map<string, string>,
): ProductListData {
  const now = new Date().toISOString()
  const sourceCreatedAt = row.source_created_at ?? null
  const groupName = row.product_group_id ? groupNamesById.get(row.product_group_id) : null
  return {
    id: existing?.id ?? `product-${slug(row.code)}`,
    code: row.code,
    name: row.name,
    status: row.status,
    product_kind: row.product_kind,
    unit_name: row.unit_name,
    sell_method: row.sell_method,
    latest_purchase_cost: row.latest_purchase_cost,
    latest_purchase_cost_at: row.latest_purchase_cost === null ? null : now,
    default_sale_price: existing?.default_sale_price ?? null,
    product_group_id: row.product_group_id,
    product_group: row.product_group_id && groupName ? { id: row.product_group_id, code: slug(groupName).toUpperCase(), name: groupName } : null,
    inventory_shape: row.inventory_shape,
    track_inventory: row.track_inventory,
    unit_conversions: row.unit_conversions,
    created_at: sourceCreatedAt ?? existing?.created_at ?? now,
    updated_at: now,
  }
}

function toImportedStocktake(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'],
  itemMap: Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>,
): StocktakeListData {
  const firstRow = rows[0]
  const allRows = [...itemMap.values()]
  const increasedQty = allRows.reduce((sum, row) => sum + Math.max(row.difference_qty ?? 0, 0), 0)
  const decreasedQty = allRows.reduce((sum, row) => sum + Math.abs(Math.min(row.difference_qty ?? 0, 0)), 0)
  const totalActualQty = allRows.reduce((sum, row) => sum + (row.actual_qty ?? 0), 0)
  const totalActualValue = allRows.some((row) => row.total_actual_value !== null)
    ? allRows.reduce((sum, row) => sum + (row.total_actual_value ?? 0), 0)
    : null
  const totalDifferenceValue = allRows.some((row) => row.total_difference_value !== null)
    ? allRows.reduce((sum, row) => sum + (row.total_difference_value ?? 0), 0)
    : null

  return {
    id: `stocktake-${slug(sourceCode)}`,
    code: sourceCode,
    status: stocktakeStatus(firstRow?.status),
    source_type: 'kiotviet_import',
    created_at: firstRow?.source_created_at ?? new Date().toISOString(),
    balanced_at: firstRow?.source_balanced_at ?? null,
    total_actual_qty: totalActualQty,
    total_actual_value: totalActualValue,
    total_difference_value: totalDifferenceValue,
    increased_qty: increasedQty,
    decreased_qty: decreasedQty,
    note: allRows.find((row) => row.note?.trim())?.note?.trim() ?? 'Lịch sử kiểm kho KiotViet',
  }
}

function stocktakeStatus(value: string | undefined): StocktakeListData['status'] {
  if (value === 'draft' || value === 'cancelled') return value
  return 'balanced'
}

function isDemoStocktakeCode(code: string, explicitCodes: Set<string>) {
  return explicitCodes.has(code)
    || code.startsWith('DEMO-')
    || code.startsWith('TEST-')
    || code.startsWith('KK-CLEANUP-')
}

function currentUser(): CurrentUserData {
  return {
    user: { id: adminUser.id, email: adminUser.email, display_name: adminUser.display_name },
    organization,
    workstation: { id: 'ws-dev', code: 'DEV', name: 'May dev' },
    permissions: [
      'perm.access_admin_panel',
      'perm.apply_discount',
      'perm.create_order',
      'perm.edit_order_locked',
      'perm.edit_price_book',
      'perm.manage_finance',
      'perm.manage_inventory',
      'perm.manage_users',
      'perm.refund_order',
      'perm.view_shift_report',
    ],
  }
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'default'
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function dateRangeMatches(value: string, from: string | null, to: string | null) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  if (from && timestamp < Date.parse(`${from}T00:00:00.000`)) return false
  if (to && timestamp > Date.parse(`${to}T23:59:59.999`)) return false
  return true
}
