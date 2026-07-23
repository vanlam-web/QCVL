import pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { displayDateRangeMatches } from './date-filter.js'
import { KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN } from './modules/finance/customer-debt.js'
import { buildPartnerDebtLedger, type PartnerDebtDocumentInput } from './modules/finance/partner-debt-ledger.js'
import {
  invoicePaymentStatus,
  rebuildKiotVietCashbookAllocations,
  type AllocatableInvoice,
  type AllocatablePurchaseReceipt,
} from './modules/finance/kiotviet-cashbook-allocation.js'
import { createOrganizationSettingsRepository } from './modules/auth/organization-settings-repository.js'
import { createAuthSessionRepository } from './modules/auth/auth-session-repository.js'
import { createPeopleRepository } from './modules/auth/people-repository.js'
import { createUserRepository } from './modules/auth/user-repository.js'
import { createProductGroupRepository } from './modules/catalog/catalog-product-group-repository.js'
import { createCustomerImportRepository } from './modules/catalog/customer-import-repository.js'
import { createCustomerQueryRepository } from './modules/catalog/customer-query-repository.js'
import { createCustomerCrudRepository } from './modules/catalog/customer-crud-repository.js'
import { createSupplierImportRepository } from './modules/catalog/supplier-import-repository.js'
import { createSupplierCrudRepository } from './modules/catalog/supplier-crud-repository.js'
import { createProductCreateRepository } from './modules/catalog/product-create-repository.js'
import { createPriceListQueryRepository } from './modules/catalog/price-list-query-repository.js'
import { createResolvePricesRepository } from './modules/catalog/resolve-prices-repository.js'
import { createProductBomRepository } from './modules/catalog/product-bom-repository.js'
import { createProductQueryRepository } from './modules/catalog/product-query-repository.js'
import { createPurchaseReceiptQueryRepository } from './modules/purchase/purchase-receipt-repository.js'
import { createPurchaseReceiptSaveRepository } from './modules/purchase/purchase-receipt-save-repository.js'
import { createPurchaseReceiptTransactions } from './modules/purchase/purchase-receipt-transactions.js'
import { createPurchaseImportCleanupRepository } from './modules/purchase/purchase-import-cleanup-repository.js'
import { createPurchaseImportRepository } from './modules/purchase/purchase-import-repository.js'
import { createStockMovementRepository } from './modules/inventory/stock-movement-repository.js'
import { createStocktakeQueryRepository } from './modules/inventory/stocktake-query-repository.js'
import { createStocktakeDetailRepository } from './modules/inventory/stocktake-detail-repository.js'
import { createInventoryAdjustmentRepository } from './modules/inventory/inventory-adjustment-repository.js'
import { createStocktakeImportRepository } from './modules/inventory/stocktake-import-repository.js'
import { createProvisionalStockRepository } from './modules/inventory/provisional-stock-repository.js'
import { createCatalogProductImportRepository } from './modules/catalog/catalog-product-import-repository.js'
import { createPriceListImportRepository } from './modules/catalog/price-list-import-repository.js'
import { createDraftBomImportRepository } from './modules/catalog/draft-bom-import-repository.js'
import { createFinanceAccountRepository } from './modules/finance/finance-account-repository.js'
import { createCashbookQueryRepository } from './modules/finance/cashbook-query-repository.js'
import { createCashbookMutationRepository } from './modules/finance/cashbook-mutation-repository.js'
import { createCashbookImportRepository } from './modules/finance/cashbook-import-repository.js'
import { createCustomerDebtQueryRepository } from './modules/finance/customer-debt-query-repository.js'
import { createCustomerDebtImportRepository } from './modules/finance/customer-debt-import-repository.js'
import { createCustomerDebtMutationRepository } from './modules/finance/customer-debt-mutation-repository.js'
import { createCustomerFinancialTotalsRepository } from './modules/finance/customer-financial-totals-repository.js'
import { createSalesImportRepository } from './modules/sales/sales-import-repository.js'
import { createSalesSaveRepository } from './modules/sales/sales-save-repository.js'
import { createSalesQueryRepository } from './modules/sales/sales-query-repository.js'
import { createSalesMutationRepository } from './modules/sales/sales-mutation-repository.js'
import { createPosUsageRepository } from './modules/catalog/pos-usage-repository.js'
import { createRepositoryLifecycle } from './modules/system/repository-lifecycle.js'
import { createProductImportCleanupRepository } from './modules/catalog/product-import-cleanup-repository.js'
import type {
  CashbookEntryData,
  CurrentUserData,
  CustomerDebtSummaryData,
  CustomerListData,
  FinanceAccountData,
  ProductGroupListData,
  PurchaseReceiptData,
  SalesDocumentData,
  SalesDocumentPaymentReceiptData,
  ServerRepository,
  StockMovementData,
  SupplierListData,
} from './http.js'
import {
  normalizeBillPreferenceValue,
  resolveCustomerBillPreferenceIds,
} from './bill-settings.js'

const { Pool } = pg

const productReferenceGuards = [
  { table: 'order_items', column: 'product_id' },
  { table: 'price_list_items', column: 'product_id' },
  { table: 'stock_movements', column: 'product_id' },
  { table: 'purchase_receipt_items', column: 'product_id' },
  { table: 'product_boms', column: 'product_id' },
  { table: 'product_bom_items', column: 'component_product_id' },
] as const

const financeAccountsEnsureCache = new WeakMap<pg.Pool, Promise<void>>()
const salesFinanceEnsureCache = new WeakMap<pg.Pool, Promise<void>>()
const userDisplayNameEnsureCache = new WeakMap<pg.Pool, Map<string, Promise<ReadonlyMap<string, string>>>>()
const financeAccountsListCache = new WeakMap<pg.Pool, Map<string, Promise<FinanceAccountData[]>>>()
const searchSelectionStatsEnsureCache = new WeakMap<pg.Pool, Promise<void>>()

export function createPgRepository(databaseUrl: string): ServerRepository & { close(): Promise<void> } {
  const pool = new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 })

  const organizationSettingsRepository = createOrganizationSettingsRepository(pool, ensureOrganizationBillSettingsColumns)

  const authSessionRepository = createAuthSessionRepository(pool, { ensureUserColumns: ensureUserManagementColumns, findWorkstation })

  const peopleRepository = createPeopleRepository(pool)

  const userRepository = createUserRepository(pool, { ensureColumns: ensureUserManagementColumns, invalidate: (organizationId) => invalidateOrgCache(userDisplayNameEnsureCache, pool, organizationId) })

  const productGroupRepository = createProductGroupRepository(pool)

  const productCreateRepository = createProductCreateRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensureUnits: ensureProductUnitTables, defaultGroup: ensureDefaultProductGroup, upsertUnit: upsertInventoryUnit, upsertSettings: upsertProductInventorySettings, upsertConversions: upsertProductUnitConversions })

  const productQueryRepository = createProductQueryRepository(pool, { ensureStock: ensureStockMovementsTable, rank: quickPickRankedItems })

  const purchaseReceiptQueryRepository = createPurchaseReceiptQueryRepository(pool, { ensureSnapshots: ensureImportedSnapshotTables, matches: purchaseReceiptSnapshotMatches })

  const purchaseReceiptSaveRepository = createPurchaseReceiptSaveRepository(pool, { ensureSnapshots: ensureImportedSnapshotTables, safeCode: purchaseReceiptWithSafeCode, recomputeSupplier: recomputeSupplierPurchaseTotals })

  const purchaseReceiptTransactions = createPurchaseReceiptTransactions(pool, { ensureSnapshots: ensureImportedSnapshotTables, ensureStock: ensureStockMovementsTable, ensureCatalog: ensureProductCatalogSchema, ensureSalesFinance: ensureSalesFinanceTables, loadReceipt: loadPurchaseReceiptSnapshot, replaceMovements: replacePurchaseReceiptStockMovements, updateCosts: updateLatestPurchaseCostsFromReceipt, cashEntry: purchaseSupplierCashbookEntry, insertCashbook: insertCashbookEntry, recomputeBalances: recomputeStockMovementBalances, recomputeSupplier: recomputeSupplierPurchaseTotals, reverseMovements: reversePurchaseReceiptStockMovements, cancelSupplierPaymentCashbook: cancelPurchaseReceiptSupplierPaymentCashbook })

  const purchaseImportCleanupRepository = createPurchaseImportCleanupRepository(pool, { ensureSnapshots: ensureImportedSnapshotTables, ensureStock: ensureStockMovementsTable, deleteMovements: deleteStockMovementsForDocuments, recompute: recomputeStockMovementBalances })

  const purchaseImportRepository = createPurchaseImportRepository(pool, { ensureSnapshots: ensureImportedSnapshotTables, ensureStock: ensureStockMovementsTable, productsByCode: stockProductsByImportCode, supplierByCode: snapshotByCode, resolveProduct: resolveStockProduct, receiptFromRows: purchaseReceiptDataFromImportRows, deleteMovementsForDocument: deleteStockMovementsForDocument, insertMovement: insertStockMovement, recomputeBalances: recomputeStockMovementBalances, stableId: stableUuidFromText })

  const stockMovementRepository = createStockMovementRepository(pool, { ensureStock: ensureStockMovementsTable, derivePurchase: derivedPurchaseStockMovementsFromSnapshots })

  const stocktakeQueryRepository = createStocktakeQueryRepository(pool)

  const stocktakeDetailRepository = createStocktakeDetailRepository(pool, { ensureTables: ensureImportedStocktakeTables })

  const inventoryAdjustmentRepository = createInventoryAdjustmentRepository(pool, { ensureStocktakes: ensureImportedStocktakeTables, ensureMovements: ensureStockMovementsTable, insertMovement: insertStockMovement, recomputeBalances: recomputeStockMovementBalances, stableId: stableUuidFromText, latestQty: latestStockMovementQty, loadStocktake: (input) => {
    if (!stocktakeDetailRepository.getStocktake) throw new Error('Stocktake detail repository is not configured')
    return stocktakeDetailRepository.getStocktake(input)
  }, ensureUnits: ensureProductUnitTables, ensureOpenings: ensureInventoryMaterialOpeningsTable, openingProduct: materialOpeningProduct, openingFactor: materialOpeningStockQtyPerUnit })

  const stocktakeImportRepository = createStocktakeImportRepository(pool, { ensureTables: ensureImportedStocktakeTables, statusFromSource: importedStocktakeStatus, noteFromRows: importedStocktakeNote, creatorFromRows: importedStocktakeSourceCreatorName, userIdByCreator: findUserIdByImportedCreator, productIdByCode: findProductIdByCode })

  const provisionalStockRepository = createProvisionalStockRepository(pool, { ensureUnits: ensureProductUnitTables, ensureBalances: ensureInventoryProvisionalBalancesTable, upsertUnit: upsertInventoryUnit })

  const catalogProductImportRepository = createCatalogProductImportRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensureUnits: ensureProductUnitTables, upsertUnit: upsertInventoryUnit, upsertSettings: upsertProductInventorySettings, upsertConversions: upsertProductUnitConversions, groupCode: productGroupImportCode })

  const priceListImportRepository = createPriceListImportRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensurePriceLists: ensurePriceListTables, isDefaultName: isDefaultPriceListName, upsertByName: upsertPriceListByName })

  const draftBomImportRepository = createDraftBomImportRepository(pool, { ensureTables: ensureProductBomTables, productIdByCode: findProductIdByCode })

  const financeAccountRepository = createFinanceAccountRepository(pool, { ensureTable: ensureFinanceAccountsTable, mapRow: mapFinanceAccountRow, hash: hashText, invalidate: (organizationId: string) => invalidateOrgCache(financeAccountsListCache, pool, organizationId) })

  const cashbookQueryRepository = createCashbookQueryRepository(pool, { ensureTables: ensureSalesFinanceTables, userNames: userDisplayNameMap, accountsForExclusion: listFinanceAccountsForExclusion, mapRow: mapCashbookRow, hydrateUser: hydrateCashbookEntryUserSnapshot, hydrateAccount: hydrateCashbookEntryFinanceAccount, matches: cashbookEntryMatches, replacedDeleted: isReplacedDeletedFinanceAccount, normalize: normalizeSearchText, accentSql: accentInsensitiveSearchSql, positive: positiveInt, hydrateLink: hydrateCashbookEntryLink })

  const cashbookMutationRepository = createCashbookMutationRepository(pool, { ensureTables: ensureSalesFinanceTables, mapRow: mapCashbookRow, insertEntry: insertCashbookEntry, accountsForExclusion: listFinanceAccountsForExclusion, accountSnapshot: cashbookFinanceAccountSnapshot, userNames: userDisplayNameMap, hydrateAccount: hydrateCashbookEntryFinanceAccount, hydrateUser: hydrateCashbookEntryUserSnapshot, hydrateLink: hydrateCashbookEntryLink })

  const cashbookImportRepository = createCashbookImportRepository(pool, { ensureAccounts: ensureFinanceAccountsTable, ensureTables: ensureSalesFinanceTables, ensureSnapshots: ensureImportedSnapshotTables, preferPosted: preferPostedKiotVietCashbookRows, accountFromRow: financeAccountFromKiotVietCashbookRow, linkedInvoiceCode: linkedInvoiceCodeFromKiotVietCashbookCode, customerByCode: snapshotByCode, hash: hashText, rebuildAllocations: rebuildImportedKiotVietCashbookAllocations, invalidate: (organizationId: string) => invalidateOrgCache(financeAccountsListCache, pool, organizationId) })

  const customerDebtQueryRepository = createCustomerDebtQueryRepository(pool, { ensureTables: ensureSalesFinanceTables, ensureSnapshots: ensureImportedSnapshotTables, userNames: userDisplayNameMap, accountsForExclusion: listFinanceAccountsForExclusion, mapCashbook: mapCashbookRow, hydrateUser: hydrateCashbookEntryUserSnapshot, hydrateAccount: hydrateCashbookEntryFinanceAccount, nextSupplierPaymentCode: nextPurchaseSupplierPaymentCode, matches: customerDebtMatches })

  const customerDebtImportRepository = createCustomerDebtImportRepository(pool, { ensureSnapshots: ensureImportedSnapshotTables, ensureTables: ensureSalesFinanceTables, customerByCode: snapshotByCode, hash: hashText })

  const customerDebtMutationRepository = createCustomerDebtMutationRepository(pool, { ensureTables: ensureSalesFinanceTables, cashAccount, bankAccount, insertEntry: insertCashbookEntry })

  const customerFinancialTotalsRepository = createCustomerFinancialTotalsRepository(pool, { ensureTables: ensureSalesFinanceTables, ensureSnapshots: ensureImportedSnapshotTables })

  const salesImportRepository = createSalesImportRepository(pool, { ensureTables: ensureSalesFinanceTables, ensureMovements: ensureStockMovementsTable, ensureSnapshots: ensureImportedSnapshotTables, deleteMovementsForDocuments: deleteStockMovementsForDocuments, recomputeBalances: recomputeStockMovementBalances, ensureBom: ensureProductBomTables, productsByCode: stockProductsByImportCode, bomComponents: draftBomComponentsByProductId, customerByCode: (pool: pg.Pool, organizationId: string, code: string) => snapshotByCode<CustomerListData>(pool, 'customer_snapshots', organizationId, code), resolveProduct: resolveStockProduct, documentFromRows: salesDocumentDataFromImportRows, insertDocument: insertSalesDocument, deleteMovementsForDocument: deleteStockMovementsForDocument, insertMovement: insertStockMovement, stableId: stableUuidFromText })

  const salesQueryRepository = createSalesQueryRepository(pool, { ensureTables: ensureSalesFinanceTables, userNames: userDisplayNameMap, positive: positiveInt, filtersFromUrl: filterValues, normalize: normalizeSearchText, accentSql: accentInsensitiveSearchSql, mapRow: mapOrderRow, hydrateUser: hydrateSalesDocumentUserSnapshot, matches: salesDocumentMatches, loadPaymentReceipts: listSalesDocumentPaymentReceipts, billExtras: loadCustomerBillPrintExtras })

  const salesSaveRepository = createSalesSaveRepository(pool, { ensureTables: ensureSalesFinanceTables, ensureMovements: ensureStockMovementsTable, insertDocument: insertSalesDocument, insertEntry: insertCashbookEntry, saveMovements: saveSalesDocumentStockMovements, loadDocument: (input: Parameters<NonNullable<ServerRepository['getSalesDocument']>>[0]) => salesQueryRepository.getSalesDocument?.(input) })

  const salesMutationRepository = createSalesMutationRepository(pool, { ensureTables: ensureSalesFinanceTables, loadDocument: (input: Parameters<NonNullable<ServerRepository['getSalesDocument']>>[0]) => salesQueryRepository.getSalesDocument?.(input), receiptBaseCode: salesDocumentSameSaleReceiptBaseCode, missingGuard: isMissingGuardRelationError })

  const posUsageRepository = createPosUsageRepository(pool, { ensureUsage: ensurePosProductUsageTable, ensureSearch: ensureSearchSelectionStatsTable })

  const repositoryLifecycle = createRepositoryLifecycle(pool, { ensureTables: ensureSalesFinanceTables, insertDocument: insertSalesDocument, insertEntry: insertCashbookEntry })

  const productImportCleanupRepository = createProductImportCleanupRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensureUnits: ensureProductUnitTables, ensureBom: ensureProductBomTables, ensureBalances: ensureInventoryProvisionalBalancesTable, referenceGuards: productReferenceGuards, referencedIds: referencedProductIds, deleteOptionalRows: deleteOptionalImportRows })

  const priceListQueryRepository = createPriceListQueryRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensurePriceLists: ensurePriceListTables })

  const resolvePricesRepository = createResolvePricesRepository(pool, { ensureCatalog: ensureProductCatalogSchema, ensurePriceLists: ensurePriceListTables, ensureSnapshots: ensureImportedSnapshotTables, priceMap: priceListPriceMap })

  const productBomRepository = createProductBomRepository(pool, { ensureTables: ensureProductBomTables, load: loadProductBomDetail })

  const customerImportRepository = createCustomerImportRepository(pool, { ensureTables: ensureImportedSnapshotTables, hashText, priceListCode: priceListImportCode })

  const customerQueryRepository = createCustomerQueryRepository(pool, { ensureTables: ensureImportedSnapshotTables, matches: customerSnapshotMatches, hydrate: hydrateCustomerLinkedSupplier, rank: quickPickRankedItems })

  const customerCrudRepository = createCustomerCrudRepository(pool, { ensureTables: ensureImportedSnapshotTables, nextCode: nextManualCustomerCode, findGroup: findCustomerGroupSnapshot, hydrate: hydrateCustomerLinkedSupplier })

  const supplierImportRepository = createSupplierImportRepository(pool, { ensureTables: ensureImportedSnapshotTables, hashText })

  const supplierCrudRepository = createSupplierCrudRepository(pool, { ensureTables: ensureImportedSnapshotTables, recompute: recomputeSupplierPurchaseTotals, matches: supplierSnapshotMatches, rank: quickPickRankedItems, nextCode: nextManualSupplierCode })

  return {
    ...authSessionRepository,

    ...userRepository,

    ...peopleRepository,

    ...organizationSettingsRepository,

    ...posUsageRepository,

    ...productGroupRepository,

    ...productCreateRepository,

    ...productQueryRepository,

    ...stockMovementRepository,

    ...priceListQueryRepository,

    ...resolvePricesRepository,

    ...customerQueryRepository,

    ...customerImportRepository,

    ...customerCrudRepository,

    ...supplierCrudRepository,

    ...supplierImportRepository,

    ...financeAccountRepository,

    ...purchaseReceiptQueryRepository,

    ...purchaseReceiptSaveRepository,

    ...purchaseReceiptTransactions,

    ...purchaseImportCleanupRepository,

    ...purchaseImportRepository,

    ...catalogProductImportRepository,

    ...priceListImportRepository,

    ...provisionalStockRepository,

    ...draftBomImportRepository,

    ...productBomRepository,

    ...stocktakeImportRepository,

    ...stocktakeQueryRepository,

    ...stocktakeDetailRepository,

    ...inventoryAdjustmentRepository,

    ...productImportCleanupRepository,

    ...repositoryLifecycle,

    ...cashbookImportRepository,

    ...customerDebtImportRepository,

    ...salesImportRepository,

    ...salesSaveRepository,

    ...salesQueryRepository,

    ...salesMutationRepository,

    ...customerDebtQueryRepository,

    ...cashbookQueryRepository,

    ...cashbookMutationRepository,

    ...customerDebtMutationRepository,

    ...customerFinancialTotalsRepository,

  }
}

type ProductImportDbRow = Parameters<NonNullable<ServerRepository['upsertProductsByCode']>>[0]['rows'][number]

function dbDateText(value: unknown) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
    return value.toISOString()
  }
  return String(value)
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

async function ensureProductCatalogSchema(pool: pg.Pool) {
  await pool.query(`
    create table if not exists product_groups (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      is_default boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_product_groups_org_active on product_groups (organization_id, is_active)')
  await pool.query(`
    create table if not exists products (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      status text not null default 'active',
      unit_name text not null default 'Can cap nhat',
      sell_method text not null default 'quantity',
      product_kind text not null default 'goods',
      product_group_id uuid references product_groups(id),
      inventory_shape text not null default 'normal',
      track_inventory boolean not null default true,
      latest_purchase_cost numeric(18,2),
      latest_purchase_cost_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table products add column if not exists product_group_id uuid references product_groups(id)')
  await pool.query("alter table products add column if not exists sell_method text not null default 'quantity'")
  await pool.query("alter table products add column if not exists product_kind text not null default 'goods'")
  await pool.query("alter table products add column if not exists inventory_shape text not null default 'normal'")
  await pool.query('alter table products add column if not exists track_inventory boolean not null default true')
  await pool.query('alter table products add column if not exists latest_purchase_cost numeric(18,2)')
  await pool.query('alter table products add column if not exists latest_purchase_cost_at timestamptz')
  await pool.query('create index if not exists idx_products_org_group on products (organization_id, product_group_id)')
  await pool.query('create index if not exists idx_products_org_inventory_shape on products (organization_id, inventory_shape)')
  await pool.query('create index if not exists idx_products_org_product_kind on products (organization_id, product_kind)')
  await pool.query('create index if not exists idx_products_org_status on products (organization_id, status)')
  await pool.query('create index if not exists idx_products_org_updated on products (organization_id, updated_at desc, created_at desc)')
}

async function ensureProductUnitTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_units (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      unit_kind text not null default 'quantity' check (unit_kind in ('quantity', 'length', 'area', 'weight', 'volume', 'package')),
      decimal_precision integer not null default 3 check (decimal_precision between 0 and 6),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_inventory_units_org_active on inventory_units (organization_id, is_active)')
  await pool.query('create index if not exists idx_inventory_units_org_kind on inventory_units (organization_id, unit_kind)')
  await pool.query(`
    create table if not exists product_inventory_settings (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      track_inventory boolean not null default true,
      inventory_shape text not null default 'normal' check (inventory_shape in ('normal', 'roll', 'sheet')),
      stock_unit_id uuid not null references inventory_units(id),
      default_allow_negative boolean not null default true,
      roll_default_margin_width_m numeric(12,3),
      roll_default_margin_length_m numeric(12,3),
      roll_allow_rotate boolean,
      sheet_width_m numeric(12,3),
      sheet_length_m numeric(12,3),
      sheet_default_cut_margin_m numeric(12,3),
      sheet_remnant_min_area_m2 numeric(12,3) not null default 0.300,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id)
    )
  `)
  await pool.query('create index if not exists idx_product_inventory_settings_org_shape on product_inventory_settings (organization_id, inventory_shape)')
  await pool.query('create index if not exists idx_product_inventory_settings_stock_unit on product_inventory_settings (organization_id, stock_unit_id)')
  await pool.query(`
    create table if not exists product_unit_conversions (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      sale_unit_id uuid not null references inventory_units(id),
      stock_unit_id uuid not null references inventory_units(id),
      source_code text,
      stock_qty_per_sale_unit numeric(18,6) not null check (stock_qty_per_sale_unit > 0),
      is_default_purchase_unit boolean not null default false,
      is_default_sale_unit boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id, sale_unit_id)
    )
  `)
  await pool.query('create index if not exists idx_product_unit_conversions_product on product_unit_conversions (organization_id, product_id, is_active)')
  await pool.query('alter table product_unit_conversions add column if not exists source_code text')
  await pool.query('create index if not exists idx_product_unit_conversions_source_code on product_unit_conversions (organization_id, source_code) where source_code is not null and is_active = true')
}

async function ensurePriceListTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists price_lists (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      is_default boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_price_lists_org_default on price_lists (organization_id, is_default, is_active)')
  await pool.query(`
    create table if not exists price_list_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      price_list_id uuid not null references price_lists(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      unit_price numeric(18,2) not null check (unit_price >= 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await pool.query('create unique index if not exists price_list_items_price_product_uidx on price_list_items (price_list_id, product_id)')
  await pool.query('create index if not exists idx_price_list_items_org_product on price_list_items (organization_id, product_id)')
}

async function upsertInventoryUnit(pool: pg.Pool, organizationId: string, unitName: string) {
  const name = unitName.trim() || 'Can cap nhat'
  const result = await pool.query(
    `
      insert into inventory_units (id, organization_id, code, name, unit_kind, decimal_precision, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, $5, 3, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        unit_kind = excluded.unit_kind,
        is_active = true,
        updated_at = now()
      returning id::text
    `,
    [randomUUID(), organizationId, inventoryUnitCode(name), name, inventoryUnitKind(name)],
  )
  return String(result.rows[0].id)
}

async function upsertProductInventorySettings(
  pool: pg.Pool,
  organizationId: string,
  productId: string,
  row: ProductImportDbRow,
  stockUnitId: string,
) {
  await pool.query(
    `
      insert into product_inventory_settings (
        id, organization_id, product_id, track_inventory, inventory_shape,
        stock_unit_id, default_allow_negative, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, true, now(), now())
      on conflict (organization_id, product_id)
      do update set
        track_inventory = excluded.track_inventory,
        inventory_shape = excluded.inventory_shape,
        stock_unit_id = excluded.stock_unit_id,
        updated_at = now()
    `,
    [randomUUID(), organizationId, productId, row.track_inventory, row.inventory_shape, stockUnitId],
  )
}

async function upsertProductUnitConversions(
  pool: pg.Pool,
  organizationId: string,
  productId: string,
  stockUnitId: string,
  conversions: ProductImportDbRow['unit_conversions'],
) {
  const activeSaleUnitIds: string[] = []
  for (const conversion of conversions) {
    if (conversion.stock_qty_per_unit <= 0) continue
    const saleUnitId = await upsertInventoryUnit(pool, organizationId, conversion.unit_name)
    activeSaleUnitIds.push(saleUnitId)
    await pool.query(
      `
        insert into product_unit_conversions (
          id, organization_id, product_id, sale_unit_id, stock_unit_id,
          source_code,
          stock_qty_per_sale_unit, is_default_purchase_unit, is_default_sale_unit,
          is_active, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), now())
        on conflict (organization_id, product_id, sale_unit_id)
        do update set
          source_code = excluded.source_code,
          stock_unit_id = excluded.stock_unit_id,
          stock_qty_per_sale_unit = excluded.stock_qty_per_sale_unit,
          is_default_purchase_unit = excluded.is_default_purchase_unit,
          is_default_sale_unit = excluded.is_default_sale_unit,
          is_active = true,
          updated_at = now()
      `,
      [
        randomUUID(),
        organizationId,
        productId,
        saleUnitId,
        stockUnitId,
        conversion.source_code,
        conversion.stock_qty_per_unit,
        conversion.is_default_purchase_unit,
        conversion.is_default_sale_unit,
      ],
    )
  }

  await pool.query(
    `
      update product_unit_conversions
      set is_active = false, updated_at = now()
      where organization_id = $1
        and product_id = $2
        and not (sale_unit_id = any($3::uuid[]))
    `,
    [organizationId, productId, activeSaleUnitIds],
  )
}

async function ensureInventoryProvisionalBalancesTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_provisional_balances (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      source_type text not null check (source_type in ('kiotviet_import')),
      source_label text,
      initial_qty numeric(18,6) not null check (initial_qty >= 0),
      remaining_qty numeric(18,6) not null check (remaining_qty >= 0),
      stock_unit_id uuid not null references inventory_units(id),
      status text not null check (status in ('open', 'fully_normalized', 'closed')),
      note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id, source_type)
    )
  `)
  await pool.query('alter table inventory_provisional_balances add column if not exists source_label text')
  await pool.query('alter table inventory_provisional_balances add column if not exists initial_qty numeric(18,6)')
  await pool.query('alter table inventory_provisional_balances add column if not exists remaining_qty numeric(18,6)')
  await pool.query('alter table inventory_provisional_balances add column if not exists stock_unit_id uuid')
  await pool.query('alter table inventory_provisional_balances add column if not exists status text')
  await pool.query('alter table inventory_provisional_balances add column if not exists note text')
  await pool.query('alter table inventory_provisional_balances add column if not exists created_at timestamptz not null default now()')
  await pool.query('alter table inventory_provisional_balances add column if not exists updated_at timestamptz not null default now()')
  await pool.query(`
    create unique index if not exists inventory_provisional_balances_org_product_source_uidx
    on inventory_provisional_balances (organization_id, product_id, source_type)
  `)
  await pool.query('create index if not exists idx_inventory_provisional_balances_product on inventory_provisional_balances (organization_id, product_id, status)')
}

async function ensureImportedStocktakeTables(pool: pg.Pool) {
  await ensureProductUnitTables(pool)
  await pool.query(`
    create table if not exists stocktakes (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      status text not null check (status in ('draft', 'balanced', 'cancelled')),
      source_type text not null check (source_type in ('manual', 'product_edit', 'kiotviet_import')),
      source_system text,
      source_code text,
      source_created_at timestamptz,
      source_balanced_at timestamptz,
      source_creator_name text,
      note text,
      balanced_at timestamptz,
      created_by uuid null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table stocktakes add column if not exists source_system text')
  await pool.query('alter table stocktakes add column if not exists source_code text')
  await pool.query('alter table stocktakes add column if not exists source_created_at timestamptz')
  await pool.query('alter table stocktakes add column if not exists source_balanced_at timestamptz')
  await pool.query('alter table stocktakes add column if not exists source_creator_name text')
  await pool.query('alter table stocktakes add column if not exists created_by uuid null')
  await pool.query('alter table stocktakes alter column created_by drop not null')
  await relaxCheckConstraint(pool, 'stocktakes', 'source_type', ['manual', 'product_edit', 'kiotviet_import'])
  await pool.query(`
    create unique index if not exists stocktakes_org_source_system_code_uidx
    on stocktakes (organization_id, source_system, source_code)
    where source_system is not null and source_code is not null
  `)
  await pool.query('create index if not exists idx_stocktakes_org_status_created on stocktakes (organization_id, status, created_at desc)')
  await pool.query('create index if not exists idx_stocktakes_org_source on stocktakes (organization_id, source_system, source_code)')

  await pool.query(`
    create table if not exists stocktake_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      stocktake_id uuid not null references stocktakes(id) on delete cascade,
      line_no integer not null,
      product_id uuid null references products(id),
      stock_unit_id uuid null references inventory_units(id),
      system_qty numeric(18,6),
      actual_qty numeric(18,6),
      difference_qty numeric(18,6),
      inventory_object_type text,
      inventory_roll_id uuid,
      inventory_sheet_id uuid,
      note text,
      source_row_number integer,
      source_product_code text,
      source_product_name text,
      source_unit_name text,
      line_difference_value numeric(18,2),
      line_actual_value numeric(18,2),
      created_at timestamptz not null default now(),
      unique (stocktake_id, line_no)
    )
  `)
  await pool.query('alter table stocktake_items alter column product_id drop not null')
  await pool.query('alter table stocktake_items alter column stock_unit_id drop not null')
  await pool.query('alter table stocktake_items alter column system_qty drop not null')
  await pool.query('alter table stocktake_items alter column actual_qty drop not null')
  await pool.query('alter table stocktake_items alter column difference_qty drop not null')
  await pool.query('alter table stocktake_items add column if not exists source_row_number integer')
  await pool.query('alter table stocktake_items add column if not exists source_product_code text')
  await pool.query('alter table stocktake_items add column if not exists source_product_name text')
  await pool.query('alter table stocktake_items add column if not exists source_unit_name text')
  await pool.query('alter table stocktake_items add column if not exists line_actual_value numeric(18,2)')
  await pool.query('alter table stocktake_items add column if not exists line_difference_value numeric(18,2)')
  await pool.query('alter table stocktake_items add column if not exists inventory_object_type text')
  await pool.query('alter table stocktake_items add column if not exists inventory_roll_id uuid')
  await pool.query('alter table stocktake_items add column if not exists inventory_sheet_id uuid')
  await pool.query('alter table stocktake_items add column if not exists updated_at timestamptz not null default now()')
  await pool.query(`
    create unique index if not exists stocktake_items_stocktake_source_row_uidx
    on stocktake_items (stocktake_id, source_row_number)
    where source_row_number is not null
  `)
  await pool.query('create index if not exists idx_stocktake_items_stocktake on stocktake_items (organization_id, stocktake_id, line_no)')
  await pool.query('create index if not exists idx_stocktake_items_product on stocktake_items (organization_id, product_id)')
}

async function ensureStockMovementsTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists stock_movements (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      movement_type text not null,
      quantity_delta numeric(18,6) not null,
      ending_qty numeric(18,6),
      document_type text,
      document_code text,
      transaction_price numeric(18,2),
      cost_price numeric(18,2),
      partner_name text,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query('alter table stock_movements add column if not exists ending_qty numeric(18,6)')
  await pool.query('alter table stock_movements add column if not exists document_type text')
  await pool.query('alter table stock_movements add column if not exists document_code text')
  await pool.query('alter table stock_movements add column if not exists transaction_price numeric(18,2)')
  await pool.query('alter table stock_movements add column if not exists cost_price numeric(18,2)')
  await pool.query('alter table stock_movements add column if not exists partner_name text')
  await pool.query('create index if not exists idx_stock_movements_product_created on stock_movements (organization_id, product_id, created_at desc)')
  await pool.query('create index if not exists idx_stock_movements_document on stock_movements (organization_id, document_type, document_code)')
}

async function derivedPurchaseStockMovementsFromSnapshots(pool: pg.Pool, organizationId: string, productId: string): Promise<StockMovementData[]> {
  await ensureImportedSnapshotTables(pool)
  const result = await pool.query(
    `
      with target_product as (
        select p.id::text, p.code
        from products p
        where p.organization_id = $1
          and p.id = $2::uuid
        limit 1
      ),
      receipt_items as (
        select
          prs.data as receipt,
          item.value as item,
          coalesce(nullif(regexp_replace(item.value #>> '{product,code}', '\\{DEL\\d*\\}$', '', 'i'), ''), item.value #>> '{product,code}') as source_product_code,
          row_number() over (partition by prs.code order by item.ordinality) as line_no
        from purchase_receipt_snapshots prs
        cross join lateral jsonb_array_elements(coalesce(prs.data->'items', '[]'::jsonb)) with ordinality as item(value, ordinality)
        where prs.organization_id = $1
          and prs.data->>'status' = 'posted'
      )
      select
        receipt->>'code' as document_code,
        receipt->>'received_at' as created_at,
        coalesce(receipt #>> '{supplier,name}', receipt #>> '{supplier,code}') as partner_name,
        item #>> '{product,code}' as raw_product_code,
        line_no,
        (item->>'quantity')::numeric * case
          when lower(receipt_items.source_product_code) = lower(target_product.code) then 1
          else coalesce(puc.stock_qty_per_unit, 1)
        end as quantity_delta,
        nullif(item->>'unit_cost', '')::numeric as unit_cost
      from receipt_items
      join target_product on true
      left join product_unit_conversions puc
        on puc.organization_id = $1
       and puc.product_id = $2::uuid
       and puc.is_active = true
       and lower(puc.source_code) = lower(receipt_items.source_product_code)
      where lower(receipt_items.source_product_code) = lower(target_product.code)
         or puc.id is not null
      order by nullif(receipt->>'received_at', '')::timestamptz asc, document_code asc, line_no asc
    `,
    [organizationId, productId],
  )
  let endingQty = 0
  const movements = result.rows.map((row) => {
    const quantityDelta = Number(row.quantity_delta || 0)
    endingQty += quantityDelta
    return {
      id: `derived-purchase-${row.document_code}-${row.line_no}`,
      product_id: productId,
      movement_type: 'purchase_receipt',
      quantity_delta: quantityDelta,
      created_at: dbDateText(row.created_at),
      document_code: row.document_code === null ? null : String(row.document_code),
      document_type: 'purchase_receipt' as const,
      transaction_price: row.unit_cost === null ? null : Number(row.unit_cost),
      cost_price: row.unit_cost === null ? null : Number(row.unit_cost),
      ending_qty: endingQty,
      partner_name: row.partner_name === null ? null : String(row.partner_name),
    } satisfies StockMovementData
  })
  return movements.reverse()
}

type StockImportProduct = {
  id: string
  code: string
  name: string
  unit_name: string
  track_inventory: boolean
  latest_purchase_cost: number | null
  factor: number
  purchase_unit_name?: string | null
}

async function stockProductsByImportCode(pool: pg.Pool, organizationId: string) {
  await ensureProductCatalogSchema(pool)
  await ensureProductUnitTables(pool)
  const result = await pool.query(
    `
      select
        p.id::text,
        p.code,
        p.name,
        p.unit_name,
        p.track_inventory,
        p.latest_purchase_cost,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'source_code', puc.source_code,
              'unit_name', sale_unit.name,
              'stock_qty_per_unit', puc.stock_qty_per_sale_unit
            )
          ) filter (where puc.id is not null and puc.is_active = true),
          '[]'::jsonb
        ) as unit_conversions
      from products p
      left join product_unit_conversions puc
        on puc.organization_id = p.organization_id
       and puc.product_id = p.id
       and puc.is_active = true
      left join inventory_units sale_unit
        on sale_unit.organization_id = p.organization_id
       and sale_unit.id = puc.sale_unit_id
       and sale_unit.is_active = true
      where p.organization_id = $1
      group by p.id
    `,
    [organizationId],
  )
  const products = new Map<string, StockImportProduct>()
  for (const row of result.rows) {
    const base: StockImportProduct = {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      unit_name: String(row.unit_name),
      track_inventory: Boolean(row.track_inventory),
      latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
      factor: 1,
    }
    products.set(baseKiotVietImportCode(base.code), base)
    for (const conversion of row.unit_conversions ?? []) {
      const sourceCode = baseKiotVietImportCode(String(conversion.source_code ?? ''))
      if (!sourceCode) continue
      const factor = Number(conversion.stock_qty_per_unit ?? 1)
      products.set(sourceCode, {
        ...base,
        factor: factor > 0 ? factor : 1,
        purchase_unit_name: String(conversion.unit_name ?? '').trim() || null,
      })
    }
  }
  return products
}

function purchaseReceiptItemStockFactor(products: Map<string, StockImportProduct>, product: StockImportProduct, item: PurchaseReceiptData['items'][number]) {
  const unitName = String(item.unit_name_snapshot ?? '').trim()
  if (!unitName || unitName === product.unit_name) return 1
  const conversion = [...products.values()].find((candidate) => (
    candidate.id === product.id
    && candidate.purchase_unit_name === unitName
    && candidate.factor > 0
  ))
  return conversion?.factor ?? 1
}

function resolveStockProduct(products: Map<string, StockImportProduct>, productCode: string) {
  if (isDeletedKiotVietImportCode(productCode)) return null
  return products.get(baseKiotVietImportCode(productCode)) ?? null
}

function cashbookFinanceAccountFromPurchaseAccount(account: FinanceAccountData): CashbookEntryData['finance_account'] {
  return {
    id: account.id,
    code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
    name: account.name,
    account_type: account.account_type,
    account_number: account.account_number,
    account_holder: account.account_holder,
  }
}

async function loadPurchaseReceiptSnapshot(pool: pg.Pool, organizationId: string, id: string) {
  const result = await pool.query(
    `
      select data
      from purchase_receipt_snapshots
      where organization_id = $1
        and (id = $2 or code = $2)
      limit 1
    `,
    [organizationId, id],
  )
  return result.rows[0]?.data as PurchaseReceiptData | null ?? null
}

async function purchaseReceiptWithSafeCode(
  pool: pg.Pool,
  organizationId: string,
  receipt: PurchaseReceiptData,
  sourceType: 'manual' | 'kiotviet_import',
) {
  if (sourceType !== 'manual' || !/^PN\d{6}(?:\.\d+)?$/i.test(receipt.code.trim())) return receipt

  const result = await pool.query(
    `
      select max((substring(upper(code) from '^PN([0-9]{6})(?:\\.[0-9]+)?$'))::integer) as max_number
      from purchase_receipt_snapshots
      where organization_id = $1
        and upper(code) ~ '^PN[0-9]{6}(\\.[0-9]+)?$'
    `,
    [organizationId],
  )
  const currentNumber = Number(result.rows[0]?.max_number ?? 0)
  const requestedNumber = Number(receipt.code.trim().toUpperCase().match(/^PN(\d{6})/)?.[1] ?? 0)
  const nextNumber = Math.max(currentNumber + 1, requestedNumber)
  const code = `PN${String(nextNumber).padStart(6, '0')}`
  return code === receipt.code ? receipt : { ...receipt, code }
}

async function purchaseSupplierCashbookEntry(
  pool: pg.Pool,
  input: {
    organizationId: string
    supplier: PurchaseReceiptData['supplier']
    receipt: PurchaseReceiptData
    amount: number
    paymentMethod: 'cash' | 'bank_transfer'
    financeAccountId?: string
    currentUser: CurrentUserData
    note: string
    suffix?: string
    createdAt?: string
  },
) {
  const account = await resolveFinanceAccountForPurchasePayment(pool, input.organizationId, input.paymentMethod, input.financeAccountId)
  const code = nextPurchaseSupplierPaymentCode(input.receipt.code, input.suffix ?? '')
  const createdAt = input.createdAt ?? new Date().toISOString()
  return {
    id: `cashbook-voucher-${randomUUID()}`,
    code,
    status: 'posted',
    direction: 'out',
    amount_delta: -Math.max(input.amount, 0),
    finance_account: cashbookFinanceAccountFromPurchaseAccount(account),
    is_business_accounted: true,
    source_type: 'purchase_supplier_payment',
    created_at: createdAt,
    note: input.note,
    counterparty: {
      type: 'supplier',
      name: input.supplier.name,
      phone: null,
    },
    created_by: { id: input.currentUser.user.id, name: input.currentUser.user.display_name },
    source: {
      type: 'purchase_supplier_payment',
      id: code,
      code,
      order_code: input.receipt.code,
      source_note: input.note,
    },
    allocations: [{
      order_id: input.receipt.id,
      order_code: input.receipt.code,
      order_created_at: input.receipt.received_at ?? input.receipt.created_at,
      order_total_amount: input.receipt.payable_amount,
      collected_before: Math.max(input.receipt.paid_amount, 0),
      allocated_amount: Math.max(input.amount, 0),
      remaining_after: Math.max(input.receipt.remaining_amount - input.amount, 0),
    }],
    payment_method: input.paymentMethod,
  } satisfies CashbookEntryData
}

async function resolveFinanceAccountForPurchasePayment(
  pool: pg.Pool,
  organizationId: string,
  paymentMethod: 'cash' | 'bank_transfer',
  financeAccountId?: string,
) {
  await ensureFinanceAccountsTable(pool)
  const accountId = financeAccountId?.trim()
  if (accountId) {
    const result = await pool.query(
      `
        select id, code, name, account_type, is_default_cash, is_active,
               account_number, account_holder, opening_balance, note, notify_on_transaction
        from finance_accounts
        where organization_id = $1 and id = $2
        limit 1
      `,
      [organizationId, accountId],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Finance account not found')
    return mapFinanceAccountRow(row)
  }
  const fallbackType = paymentMethod === 'bank_transfer' ? 'bank' : 'cash'
  const result = await pool.query(
    `
      select id, code, name, account_type, is_default_cash, is_active,
             account_number, account_holder, opening_balance, note, notify_on_transaction
      from finance_accounts
      where organization_id = $1 and account_type = $2 and is_active = true
      order by is_default_cash desc, name asc
      limit 1
    `,
    [organizationId, fallbackType],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Finance account not found')
  return mapFinanceAccountRow(row)
}

function nextPurchaseSupplierPaymentCode(receiptCode: string, suffix: string) {
  const code = receiptCode.trim().toUpperCase()
  const match = code.match(/^PN(\d{6}(?:\.\d+)?)$/)
  if (match) return `PCPN${match[1]}${suffix ? `-${suffix}` : ''}`
  return `PCPN${suffix ? `-${suffix}` : ''}`
}

function purchaseReceiptCodeFromSupplierPaymentCode(code: string) {
  const match = code.trim().toUpperCase().match(/^PCPN(\d{6}(?:\.\d+)?)/)
  return match ? `PN${match[1]}` : ''
}

async function recomputeSupplierPurchaseTotals(pool: pg.Pool, organizationId: string, supplierId?: string | null) {
  await ensureImportedSnapshotTables(pool)
  const supplierResult = await pool.query(
    `
      select id, data
      from supplier_snapshots
      where organization_id = $1
        and ($2::text is null or id = $2::text)
    `,
    [organizationId, supplierId ?? null],
  )
  const receiptResult = await pool.query(
    `
      select data
      from purchase_receipt_snapshots
      where organization_id = $1
        and ($2::text is null or data->'supplier'->>'id' = $2::text or data->>'supplier_id' = $2::text)
    `,
    [organizationId, supplierId ?? null],
  )
  const cashbookResult = await pool.query(
    `
      select id, code, status, amount_delta, created_at, source
      from cashbook_entries
      where organization_id = $1
        and status = 'posted'
        and (
          source_type = 'purchase_supplier_payment'
          or (
            source_type in ('cashbook_voucher', 'kiotviet_cashbook')
            and code ~* '^(PCPN|PC)[0-9]'
          )
        )
    `,
    [organizationId],
  )
  const suppliers = supplierResult.rows.map((row) => row.data as SupplierListData)
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const linkedSupplierByCustomerId = new Map<string, string>()
  for (const supplier of suppliers) {
    const linkedCustomerId = supplier.linked_customer_id?.trim()
    if (linkedCustomerId) linkedSupplierByCustomerId.set(linkedCustomerId, supplier.id)
  }
  const linkedCustomerIds = [...linkedSupplierByCustomerId.keys()]
  const [linkedInvoiceResult, linkedCashbookResult, linkedAdjustmentResult] = linkedCustomerIds.length > 0
    ? await Promise.all([
        pool.query(
          `
            select id, code, created_at, customer_id, total_amount
            from orders
            where organization_id = $1
              and customer_id = any($2::text[])
              and order_type = 'invoice'
              and status <> 'cancelled'
            order by created_at asc, code asc
          `,
          [organizationId, linkedCustomerIds],
        ),
        pool.query(
          `
            select
              cbe.id,
              cbe.code,
              cbe.status,
              cbe.amount_delta,
              cbe.created_at,
              coalesce(cbe.source->>'customer_id', o.customer_id, cs.id) as customer_id
            from cashbook_entries cbe
            left join orders o
              on o.organization_id = cbe.organization_id
             and o.code = cbe.source->>'order_code'
            left join customer_snapshots cs
              on cs.organization_id = cbe.organization_id
             and (
               lower(cs.code) = lower(cbe.source->>'counterparty_code')
               or cs.id = 'customer-kv-' || lower(regexp_replace(coalesce(cbe.source->>'counterparty_code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
             )
            where cbe.organization_id = $1
              and cbe.status = 'posted'
              and (
                (
                  cbe.source_type = 'payment_receipt_method'
                  and (
                    cbe.source->>'customer_id' = any($2::text[])
                    or (o.customer_id = any($2::text[]) and o.status <> 'cancelled')
                  )
                )
                or (
                  cbe.source_type = 'kiotviet_cashbook'
                  and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
                  and (
                    cbe.source->>'customer_id' = any($2::text[])
                    or cs.id = any($2::text[])
                    or (o.customer_id = any($2::text[]) and o.status <> 'cancelled')
                  )
                )
              )
            order by cbe.created_at asc, cbe.code asc
          `,
          [organizationId, linkedCustomerIds],
        ),
        pool.query(
          `
            select id, source_code, created_at, customer_id, amount_delta
            from customer_debt_adjustments
            where organization_id = $1
              and customer_id = any($2::text[])
              and source_system = 'kiotviet'
            order by created_at asc, source_row asc nulls last, updated_at asc
          `,
          [organizationId, linkedCustomerIds],
        ),
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }]
  const totals = new Map<string, {
    total_purchase_amount: number
    current_payable_amount: number
    debt_ledger_rows: NonNullable<SupplierListData['debt_ledger_rows']>
  }>()
  const receiptByCode = new Map<string, PurchaseReceiptData>()
  const documentsBySupplier = new Map<string, PartnerDebtDocumentInput[]>()
  const paymentTotalByReceiptCode = new Map<string, number>()
  for (const row of receiptResult.rows) {
    const receipt = row.data as PurchaseReceiptData
    if (receipt.status !== 'posted') continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    receiptByCode.set(receipt.code.trim().toUpperCase(), receipt)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: receipt.id,
      code: receipt.code,
      time: receipt.received_at || receipt.created_at,
      amount: Number(receipt.payable_amount || 0),
      status: 'posted',
      sourceType: 'purchase_receipt',
      sourceId: receipt.id,
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of cashbookResult.rows) {
    const code = String(row.code ?? '').trim().toUpperCase()
    const orderCode = String(row.source?.order_code ?? '').trim().toUpperCase()
    const matchedReceiptCode = orderCode || purchaseReceiptCodeFromSupplierPaymentCode(code)
    const receipt = matchedReceiptCode ? receiptByCode.get(matchedReceiptCode) : null
    if (!receipt) continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    const amount = Math.abs(Number(row.amount_delta || 0))
    paymentTotalByReceiptCode.set(receipt.code.trim().toUpperCase(), (paymentTotalByReceiptCode.get(receipt.code.trim().toUpperCase()) ?? 0) + amount)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: code || nextPurchaseSupplierPaymentCode(receipt.code, ''),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount,
      status: 'posted',
      sourceType: 'supplier_payment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const receipt of receiptByCode.values()) {
    const receiptCode = receipt.code.trim().toUpperCase()
    if ((paymentTotalByReceiptCode.get(receiptCode) ?? 0) > 0) continue
    const paidAmount = Math.max(Number(receipt.paid_amount || 0), Number(receipt.payable_amount || 0) - Number(receipt.remaining_amount || 0), 0)
    if (paidAmount <= 0) continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: `${receipt.id}:paid`,
      code: nextPurchaseSupplierPaymentCode(receipt.code, ''),
      time: receipt.received_at || receipt.created_at,
      amount: paidAmount,
      status: 'posted',
      sourceType: 'supplier_payment',
      sourceId: receipt.id,
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedInvoiceResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Number(row.total_amount || 0),
      status: 'posted',
      sourceType: 'linked_customer_invoice',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedCashbookResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Math.abs(Number(row.amount_delta || 0)),
      status: String(row.status || 'posted'),
      sourceType: 'linked_customer_payment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedAdjustmentResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const amountDelta = Number(row.amount_delta || 0)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.source_code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Math.abs(amountDelta),
      normalizedAmountDelta: amountDelta,
      status: 'posted',
      sourceType: 'linked_customer_adjustment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const [supplierKey, documents] of documentsBySupplier) {
    const ledger = buildPartnerDebtLedger({ view: 'supplier', linked: Boolean(supplierById.get(supplierKey)?.linked_customer_id), documents })
    totals.set(supplierKey, {
      total_purchase_amount: documents
        .filter((document) => /^PN\d/i.test(document.code))
        .reduce((sum, document) => sum + Math.abs(Number(document.amount || 0)), 0),
      current_payable_amount: ledger.totalDebt,
      debt_ledger_rows: ledger.rows.map((row) => ({
        id: row.id,
        code: row.code,
        created_at: row.time,
        amount_delta: row.amountDelta,
        balance_after: row.balanceAfter,
        source_type: row.sourceType,
        source_id: row.sourceId,
      })),
    })
  }
  await pool.query('begin')
  try {
    for (const row of supplierResult.rows) {
      const current = row.data as SupplierListData
      const total = totals.get(current.id) ?? { total_purchase_amount: 0, current_payable_amount: 0, debt_ledger_rows: [] }
      const next = {
        ...current,
        total_purchase_amount: total.total_purchase_amount,
        current_payable_amount: total.current_payable_amount,
        debt_ledger_rows: total.debt_ledger_rows,
      } satisfies SupplierListData
      await pool.query(
        `
          update supplier_snapshots
          set data = $3::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [organizationId, current.id, JSON.stringify(next)],
      )
    }
    await pool.query('commit')
  } catch (error) {
    await pool.query('rollback')
    throw error
  }
}

async function replacePurchaseReceiptStockMovements(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData) {
  await ensureStockMovementsTable(pool)
  await deleteStockMovementsForDocument(pool, organizationId, 'purchase_receipt', receipt.code)
  const products = await stockProductsByImportCode(pool, organizationId)
  let endingQty = 0
  const affectedProducts = new Set<string>()
  for (const [index, item] of receipt.items.entries()) {
    const product = [...products.values()].find((candidate) => candidate.id === item.product_id)
    if (!product?.track_inventory) continue
    const quantityDelta = Number(item.quantity || 0) * purchaseReceiptItemStockFactor(products, product, item)
    if (quantityDelta <= 0) continue
    endingQty += quantityDelta
    affectedProducts.add(product.id)
    await insertStockMovement(pool, organizationId, {
      id: stableUuidFromText(`stock-movement-manual-purchase-${receipt.code}-${index + 1}`),
      productId: product.id,
      movementType: 'purchase_receipt',
      quantityDelta,
      endingQty,
      documentType: 'purchase_receipt',
      documentCode: receipt.code,
      transactionPrice: item.unit_cost,
      costPrice: item.unit_cost,
      partnerName: receipt.supplier.name,
      createdAt: receipt.received_at,
    })
  }
  return affectedProducts
}

async function reversePurchaseReceiptStockMovements(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData) {
  await ensureStockMovementsTable(pool)
  const originals = await pool.query<{
    id: string
    product_id: string
    quantity_delta: number
    transaction_price: number | null
    cost_price: number | null
    partner_name: string | null
  }>(
    `
      select id::text, product_id::text, quantity_delta, transaction_price, cost_price, partner_name
      from stock_movements
      where organization_id = $1
        and document_type = 'purchase_receipt'
        and document_code = $2
      order by created_at, id
    `,
    [organizationId, receipt.code],
  )
  const affectedProducts = new Set<string>()
  const reversedAt = new Date().toISOString()
  for (const original of originals.rows) {
    const quantityDelta = -Number(original.quantity_delta)
    if (quantityDelta === 0) continue
    affectedProducts.add(String(original.product_id))
    await insertStockMovement(pool, organizationId, {
      id: stableUuidFromText(`stock-movement-purchase-cancellation-${receipt.id}-${original.id}`),
      productId: String(original.product_id),
      movementType: 'purchase_reversal',
      quantityDelta,
      endingQty: null,
      documentType: 'purchase_receipt_cancellation',
      documentCode: receipt.code,
      transactionPrice: original.transaction_price === null ? null : Number(original.transaction_price),
      costPrice: original.cost_price === null ? null : Number(original.cost_price),
      partnerName: original.partner_name,
      createdAt: reversedAt,
    })
  }
  return affectedProducts
}

async function cancelPurchaseReceiptSupplierPaymentCashbook(pool: pg.Pool, organizationId: string, receiptId: string) {
  await ensureSalesFinanceTables(pool)
  const linkedEntries = await pool.query<{ id: string; allocations: Array<{ order_id?: string }> }>(
    `
      select id::text, allocations
      from cashbook_entries
      where organization_id = $1
        and status = 'posted'
        and source_type = 'purchase_supplier_payment'
        and allocations @> jsonb_build_array(jsonb_build_object('order_id', $2::text))
      for update
    `,
    [organizationId, receiptId],
  )
  const sharedEntry = linkedEntries.rows.find((entry) => (
    !Array.isArray(entry.allocations)
    || entry.allocations.some((allocation) => String(allocation.order_id ?? '') !== receiptId)
  ))
  if (sharedEntry) throw new Error('PURCHASE_RECEIPT_SHARED_PAYMENT_REQUIRES_ALLOCATION_REVERSAL')
  if (linkedEntries.rows.length === 0) return
  await pool.query(
    `
      update cashbook_entries
      set status = 'cancelled'
      where organization_id = $1
        and id = any($2::text[])
    `,
    [organizationId, linkedEntries.rows.map((entry) => entry.id)],
  )
}

async function updateLatestPurchaseCostsFromReceipt(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData) {
  await ensureProductCatalogSchema(pool)
  for (const item of receipt.items) {
    await pool.query(
      `
        update products
        set latest_purchase_cost = $3,
            latest_purchase_cost_at = now(),
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, item.product_id, item.unit_cost],
    )
  }
}

type DraftBomComponent = {
  productId: string
  quantity: number
  factor: number
  trackInventory: boolean
  latestPurchaseCost: number | null
}

async function draftBomComponentsByProductId(pool: pg.Pool, organizationId: string) {
  await ensureProductBomTables(pool)
  const result = await pool.query(
    `
      select
        pb.product_id::text as parent_product_id,
        p.id::text as component_product_id,
        pbi.quantity,
        p.track_inventory,
        p.latest_purchase_cost
      from product_boms pb
      join product_bom_items pbi
        on pbi.organization_id = pb.organization_id
       and pbi.bom_id = pb.id
      join products p
        on p.organization_id = pbi.organization_id
       and p.id = pbi.component_product_id
      where pb.organization_id = $1
        and pb.status in ('draft', 'active')
      order by pb.product_id, pbi.sort_order, pbi.id
    `,
    [organizationId],
  )
  const byProductId = new Map<string, DraftBomComponent[]>()
  for (const row of result.rows) {
    const parentId = String(row.parent_product_id)
    const components = byProductId.get(parentId) ?? []
    components.push({
      productId: String(row.component_product_id),
      quantity: Number(row.quantity ?? 0),
      factor: 1,
      trackInventory: Boolean(row.track_inventory),
      latestPurchaseCost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
    })
    byProductId.set(parentId, components)
  }
  return byProductId
}

async function snapshotByCode<T>(pool: pg.Pool, tableName: 'customer_snapshots' | 'supplier_snapshots', organizationId: string, code: string) {
  const importCode = baseKiotVietImportCode(code)
  const result = await pool.query(
    `
      select data
      from ${tableName}
      where organization_id = $1
        and (
          lower(code) = lower($2)
          or id = any($3::text[])
        )
      limit 1
    `,
    [organizationId, importCode, snapshotImportIds(tableName, importCode)],
  )
  return result.rows[0]?.data as T | null ?? null
}

function snapshotImportIds(tableName: 'customer_snapshots' | 'supplier_snapshots', code: string) {
  const prefix = tableName === 'customer_snapshots' ? 'customer-kv' : 'supplier-kv'
  const normalizedCode = baseKiotVietImportCode(code)
  return [
    `${prefix}-${normalizedCode.toLowerCase()}`,
    `${prefix}-${hashText(normalizedCode)}`,
  ]
}

async function loadCustomerBillPrintExtras(
  pool: pg.Pool,
  organizationId: string,
  customerId: string | null | undefined,
  customerCode: string | null | undefined,
) {
  if ((customerCode ?? '').trim().toLowerCase() === 'khachle') {
    return {
      preferred_bill_template: null,
      preferred_bill_templates: [] as string[],
      address: null,
      total_debt_amount: null,
    }
  }
  await ensureImportedSnapshotTables(pool)
  const result = await pool.query(
    `
      select data
      from customer_snapshots
      where organization_id = $1
        and (
          ($2::text is not null and id = $2)
          or ($3::text is not null and lower(code) = lower($3))
        )
      limit 1
    `,
    [organizationId, customerId ?? null, customerCode ?? null],
  )
  const data = result.rows[0]?.data as CustomerListData | undefined
  const debtRaw = data?.total_debt_amount
  const preferredIds = resolveCustomerBillPreferenceIds({
    preferred_bill_templates: data?.preferred_bill_templates,
    preferred_bill_template: data?.preferred_bill_template,
  })
  return {
    preferred_bill_template: normalizeBillPreferenceValue(data?.preferred_bill_template ?? null) ?? preferredIds[0] ?? null,
    preferred_bill_templates: preferredIds,
    address: typeof data?.address === 'string' && data.address.trim() ? data.address.trim() : null,
    total_debt_amount: typeof debtRaw === 'number' && Number.isFinite(debtRaw) ? debtRaw : null,
  }
}

function purchaseReceiptDataFromImportRows(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'],
  supplier: SupplierListData | null,
): PurchaseReceiptData {
  const first = rows[0]
  return {
    id: `purchase-receipt-kv-${hashText(sourceCode)}`,
    code: sourceCode,
    status: first.status,
    received_at: first.received_at ?? first.source_created_at ?? first.updated_at ?? new Date().toISOString(),
    supplier: supplier ?? {
      id: `supplier-kv-${hashText(first.supplier_code)}`,
      code: first.supplier_code,
      name: first.supplier_name ?? first.supplier_code,
    },
    created_by: { id: 'kiotviet', name: first.source_creator_name ?? first.received_by_name ?? 'KiotViet' },
    subtotal_amount: first.subtotal_amount,
    discount_amount: first.receipt_discount_amount,
    payable_amount: first.payable_amount,
    paid_amount: first.paid_amount,
    supplier_document_no: first.supplier_document_no ?? '',
    notes: first.note ?? null,
    items: rows.map((row, index) => ({
      id: `purchase-receipt-item-kv-${hashText(`${sourceCode}-${row.rowNumber}`)}`,
      product_id: resolveImportedProductSnapshotId(row.product_code),
      product: {
        id: `product-kv-${hashText(row.product_code)}`,
        code: row.product_code,
        name: row.product_name ?? row.product_code,
      },
      line_no: index + 1,
      inventory_shape: 'normal',
      unit_name_snapshot: row.unit_name ?? '',
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      discount_amount: row.line_discount_amount,
      line_amount: row.line_amount,
      physical_payload: null,
    })),
  } as PurchaseReceiptData
}

function salesDocumentDataFromImportRows(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'],
  customer: CustomerListData | null,
): SalesDocumentData {
  const first = rows[0]
  const totalAmount = first.total_amount
  const paidAmount = first.paid_amount
  return {
    id: `sales-document-kv-${hashText(sourceCode)}`,
    code: sourceCode,
    order_type: 'invoice',
    status: first.status,
    created_at: first.created_at ?? first.updated_at ?? new Date().toISOString(),
    customer: customer ?? {
      id: `customer-kv-${hashText(first.customer_code)}`,
      code: first.customer_code,
      name: first.customer_name,
      phone: first.customer_phone,
    },
    seller: { id: 'kiotviet', name: first.source_user_name ?? 'KiotViet' },
    subtotal_amount: first.subtotal_amount,
    discount_amount: first.invoice_discount_amount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    debt_amount: Math.max(totalAmount - paidAmount, 0),
    payment_status: paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    note: first.note ?? '',
    items: rows.map((row) => ({
      product_id: resolveImportedProductSnapshotId(row.product_code),
      quantity: row.quantity,
      unit_price: row.unit_price,
      discount_amount: row.line_discount_amount,
      line_total: row.line_amount,
      note: row.product_note,
    })),
  }
}

function resolveImportedProductSnapshotId(productCode: string) {
  return `product-kv-${hashText(baseKiotVietImportCode(productCode))}`
}

async function insertStockMovement(
  pool: pg.Pool,
  organizationId: string,
  movement: {
    id: string
    productId: string
    movementType: string
    quantityDelta: number
    endingQty: number | null
    documentType: string
    documentCode: string
    transactionPrice: number | null
    costPrice: number | null
    partnerName: string | null
    createdAt: string
  },
) {
  await pool.query(
    `
      insert into stock_movements (
        id, organization_id, product_id, movement_type, quantity_delta, ending_qty,
        document_type, document_code, transaction_price, cost_price, partner_name, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (id) do update set
        quantity_delta = excluded.quantity_delta,
        ending_qty = excluded.ending_qty,
        transaction_price = excluded.transaction_price,
        cost_price = excluded.cost_price,
        partner_name = excluded.partner_name,
        created_at = excluded.created_at
    `,
    [
      movement.id,
      organizationId,
      movement.productId,
      movement.movementType,
      movement.quantityDelta,
      movement.endingQty,
      movement.documentType,
      movement.documentCode,
      movement.transactionPrice,
      movement.costPrice,
      movement.partnerName,
      movement.createdAt,
    ],
  )
}

function shouldDeductSaleParentStock(product: { track_inventory: boolean; product_kind?: string | null } | null | undefined) {
  // KV Combo–Đóng gói / dịch vụ: không trừ tồn mã cha; chỉ trừ thành phần (BOM) khi có.
  if (!product?.track_inventory) return false
  const kind = String(product.product_kind ?? '').trim().toLowerCase()
  if (kind === 'combo' || kind === 'service') return false
  return true
}

async function saleParentProductsById(pool: pg.Pool, organizationId: string, productIds: Iterable<string>) {
  const ids = [...new Set([...productIds].map((id) => String(id ?? '').trim()).filter(Boolean))]
  const byId = new Map<string, { id: string; track_inventory: boolean; product_kind: string }>()
  if (ids.length === 0) return byId
  await ensureProductCatalogSchema(pool)
  const result = await pool.query(
    `
      select id::text, track_inventory, product_kind
      from products
      where organization_id = $1
        and id::text = any($2::text[])
    `,
    [organizationId, ids],
  )
  for (const row of result.rows) {
    byId.set(String(row.id), {
      id: String(row.id),
      track_inventory: Boolean(row.track_inventory),
      product_kind: String(row.product_kind ?? 'goods'),
    })
  }
  return byId
}

async function saveSalesDocumentStockMovements(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  const affectedProducts = await deleteStockMovementsForDocument(pool, organizationId, 'sale_invoice', document.code)
  if (document.order_type === 'invoice' && document.status === 'completed') {
    await ensureProductBomTables(pool)
    const bomComponentsByProductId = await draftBomComponentsByProductId(pool, organizationId)
    const parentProductsById = await saleParentProductsById(
      pool,
      organizationId,
      document.items.map((item) => String((item as { product_id?: string }).product_id ?? '')),
    )
    let runningEndingQty = 0
    for (const [index, rawItem] of document.items.entries()) {
      const item = rawItem as {
        product_id: string
        quantity?: number
        stock_qty_per_sale_unit?: number
        unit_price?: number
      }
      const quantity = Number(item.quantity ?? 0)
      const stockQtyPerSaleUnit = Number(item.stock_qty_per_sale_unit ?? 1)
      const factor = Number.isFinite(stockQtyPerSaleUnit) && stockQtyPerSaleUnit > 0 ? stockQtyPerSaleUnit : 1
      const soldQuantity = quantity * factor
      const quantityDelta = -soldQuantity
      const parentProduct = parentProductsById.get(item.product_id)
      if (shouldDeductSaleParentStock(parentProduct) && quantityDelta !== 0) {
        runningEndingQty += quantityDelta
        affectedProducts.add(item.product_id)
        await insertStockMovement(pool, organizationId, {
          id: stableUuidFromText(`stock-movement-pos-sale-${document.code}-${index + 1}`),
          productId: item.product_id,
          movementType: 'sale_deduction',
          quantityDelta,
          endingQty: runningEndingQty,
          documentType: 'sale_invoice',
          documentCode: document.code,
          transactionPrice: Number(item.unit_price ?? 0),
          costPrice: null,
          partnerName: document.customer.name,
          createdAt: document.created_at,
        })
      }
      for (const component of bomComponentsByProductId.get(item.product_id) ?? []) {
        if (!component.trackInventory) continue
        const componentDelta = -soldQuantity * component.quantity * component.factor
        if (componentDelta === 0) continue
        affectedProducts.add(component.productId)
        await insertStockMovement(pool, organizationId, {
          id: stableUuidFromText(`stock-movement-pos-sale-bom-${document.code}-${index + 1}-${component.productId}`),
          productId: component.productId,
          movementType: 'sale_deduction',
          quantityDelta: componentDelta,
          endingQty: null,
          documentType: 'sale_invoice',
          documentCode: document.code,
          transactionPrice: null,
          costPrice: component.latestPurchaseCost,
          partnerName: document.customer.name,
          createdAt: document.created_at,
        })
      }
    }
  }
  await recomputeStockMovementBalances(pool, organizationId, affectedProducts)
}

async function deleteStockMovementsForDocument(pool: pg.Pool, organizationId: string, documentType: string, documentCode: string) {
  const result = await pool.query(
    `
      delete from stock_movements
      where organization_id = $1
        and document_type = $2
        and document_code = $3
      returning product_id::text
    `,
    [organizationId, documentType, documentCode],
  )
  return new Set(result.rows.map((row) => String(row.product_id)))
}

async function deleteStockMovementsForDocuments(pool: pg.Pool, organizationId: string, documentType: string) {
  const result = await pool.query(
    `
      delete from stock_movements
      where organization_id = $1
        and document_type = $2
      returning product_id::text
    `,
    [organizationId, documentType],
  )
  return new Set(result.rows.map((row) => String(row.product_id)))
}

async function recomputeStockMovementBalances(pool: pg.Pool, organizationId: string, productIds: Iterable<string>) {
  for (const productId of new Set(productIds)) {
    const movements = await pool.query(
      `
        select id::text, quantity_delta
        from stock_movements
        where organization_id = $1 and product_id = $2
        order by created_at, id
      `,
      [organizationId, productId],
    )
    let endingQty = 0
    for (const row of movements.rows) {
      endingQty += Number(row.quantity_delta)
      await pool.query(
        `
          update stock_movements
          set ending_qty = $3
          where organization_id = $1 and id = $2
        `,
        [organizationId, row.id, endingQty],
      )
    }
  }
}

async function latestStockMovementQty(pool: pg.Pool, organizationId: string, productId: string) {
  const result = await pool.query(
    `
      select coalesce(ending_qty, quantity_delta) as ending_qty
      from stock_movements
      where organization_id = $1
        and product_id = $2
      order by created_at desc, id desc
      limit 1
    `,
    [organizationId, productId],
  )
  return result.rows[0]?.ending_qty === undefined ? 0 : Number(result.rows[0].ending_qty)
}

async function ensureInventoryMaterialOpeningsTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_material_openings (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      inventory_shape text not null check (inventory_shape in ('normal', 'roll', 'sheet')),
      source_type text not null,
      opened_unit_id text,
      opened_qty numeric(18,6),
      opened_stock_qty numeric(18,6),
      old_remaining_qty numeric(18,6),
      stock_movement_id text,
      note text,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query('create index if not exists idx_inventory_material_openings_product on inventory_material_openings (organization_id, product_id, created_at desc)')
}

async function materialOpeningProduct(pool: pg.Pool, organizationId: string, productId: string) {
  const result = await pool.query(
    `
      select p.id::text, p.code, p.name, p.latest_purchase_cost, pis.inventory_shape, pis.stock_unit_id::text
      from products p
      left join product_inventory_settings pis on pis.organization_id = p.organization_id and pis.product_id = p.id
      where p.organization_id = $1
        and p.id = $2
      limit 1
    `,
    [organizationId, productId],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
    inventory_shape: String(row.inventory_shape ?? 'normal'),
    stock_unit_id: row.stock_unit_id === null ? null : String(row.stock_unit_id),
  }
}

async function materialOpeningStockQtyPerUnit(pool: pg.Pool, organizationId: string, productId: string, openedUnitId: string, stockUnitId: string | null) {
  if (stockUnitId && openedUnitId === stockUnitId) return 1
  const result = await pool.query(
    `
      select coalesce(stock_qty_per_sale_unit, 1) as stock_qty_per_unit
      from product_unit_conversions
      where organization_id = $1
        and product_id = $2
        and sale_unit_id = $3::uuid
        and is_active = true
      limit 1
    `,
    [organizationId, productId, openedUnitId],
  )
  return Number(result.rows[0]?.stock_qty_per_unit ?? 1) || 1
}

function stableUuidFromText(value: string) {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function baseKiotVietImportCode(value: string) {
  return value.trim().replace(/\{DEL\d*\}$/i, '')
}

function isDeletedKiotVietImportCode(value: string) {
  return /\{DEL\d*\}$/i.test(value.trim())
}

async function relaxCheckConstraint(pool: pg.Pool, tableName: string, columnName: string, allowedValues: string[]) {
  const result = await pool.query(
    `
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = current_schema()
        and t.relname = $1
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%' || $2 || '%'
    `,
    [tableName, columnName],
  )
  for (const row of result.rows) {
    await pool.query(`alter table ${pgIdentifier(tableName)} drop constraint ${pgIdentifier(String(row.conname))}`)
  }
  const constraintName = `${tableName}_${columnName}_check`
  const valueList = allowedValues.map(sqlStringLiteral).join(', ')
  await pool.query(`alter table ${pgIdentifier(tableName)} add constraint ${pgIdentifier(constraintName)} check (${pgIdentifier(columnName)} in (${valueList}))`)
}

function importedStocktakeStatus(status: 'draft' | 'balanced' | 'cancelled' | 'unknown') {
  return status === 'unknown' ? 'draft' : status
}

function importedStocktakeNote(rows: Array<{ note: string | null }>) {
  return rows.find((row) => row.note?.trim())?.note?.trim() ?? 'Lịch sử kiểm kho KiotViet'
}

function importedStocktakeSourceCreatorName(rows: Array<{ source_creator_name?: string | null }>) {
  return rows.find((row) => row.source_creator_name?.trim())?.source_creator_name?.trim() ?? null
}

async function findUserIdByImportedCreator(pool: pg.Pool, organizationId: string, sourceCreatorName: string | null) {
  const normalized = normalizeImportedCreator(sourceCreatorName)
  if (!normalized) return null
  const result = await pool.query(
    `
      select id::text
      from users
      where organization_id = $1
        and status = 'active'
        and lower(coalesce(username, '')) = $2
      limit 2
    `,
    [organizationId, normalized],
  )
  return result.rows.length === 1 ? String(result.rows[0].id) : null
}

function normalizeImportedCreator(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\{DEL\}$/i, '')
    .trim()
    .toLowerCase()
}

function pgIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function sqlStringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function ensureProductBomTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists product_boms (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      version integer not null check (version > 0),
      status text not null check (status in ('draft', 'active', 'archived')),
      notes text,
      created_at timestamptz not null default now(),
      unique (organization_id, product_id, version)
    )
  `)
  await pool.query('create index if not exists idx_product_boms_product_status on product_boms (organization_id, product_id, status)')
  await pool.query(`
    create table if not exists product_bom_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      bom_id uuid not null references product_boms(id) on delete cascade,
      component_product_id uuid not null references products(id),
      quantity numeric(18,6) not null check (quantity > 0),
      calculation_payload jsonb not null default '{}'::jsonb,
      sort_order integer not null default 1,
      notes text
    )
  `)
  await pool.query("alter table product_bom_items add column if not exists calculation_payload jsonb not null default '{}'::jsonb")
  await pool.query('alter table product_bom_items add column if not exists sort_order integer not null default 1')
  await pool.query('alter table product_bom_items add column if not exists notes text')
  await pool.query('create index if not exists idx_product_bom_items_bom on product_bom_items (organization_id, bom_id, sort_order)')
  await pool.query('create index if not exists idx_product_bom_items_component on product_bom_items (organization_id, component_product_id)')
}

async function loadProductBomDetail(pool: pg.Pool, organizationId: string, productId: string) {
  await ensureProductBomTables(pool)
  const bom = await pool.query(
    `
      select id::text, product_id::text, version, status, notes, created_at
      from product_boms
      where organization_id = $1
        and product_id::text = $2
        and status in ('active', 'draft')
      order by case when status = 'active' then 0 else 1 end, version desc, created_at desc
      limit 1
    `,
    [organizationId, productId],
  )
  const row = bom.rows[0]
  if (!row) return null
  const items = await pool.query(
    `
      select
        pbi.id::text,
        pbi.component_product_id::text,
        pbi.quantity,
        pbi.sort_order,
        pbi.notes,
        p.id::text as component_id,
        p.code as component_code,
        p.name as component_name,
        p.unit_name as component_unit_name,
        p.product_kind as component_product_kind,
        p.latest_purchase_cost as component_latest_purchase_cost
      from product_bom_items pbi
      join products p
        on p.organization_id = pbi.organization_id
       and p.id = pbi.component_product_id
      where pbi.organization_id = $1
        and pbi.bom_id = $2
      order by pbi.sort_order, pbi.id
    `,
    [organizationId, row.id],
  )
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    version: Number(row.version),
    status: String(row.status) as 'draft' | 'active' | 'archived',
    notes: row.notes === null ? null : String(row.notes),
    created_at: row.created_at?.toISOString?.() ?? String(row.created_at),
    items: items.rows.map((item) => ({
      id: String(item.id),
      component_product_id: String(item.component_product_id),
      component_product: {
        id: String(item.component_id),
        code: String(item.component_code),
        name: String(item.component_name),
        unit_name: String(item.component_unit_name),
        product_kind: String(item.component_product_kind),
        latest_purchase_cost: item.component_latest_purchase_cost === null ? null : Number(item.component_latest_purchase_cost),
      },
      quantity: Number(item.quantity),
      sort_order: Number(item.sort_order),
      notes: item.notes === null ? null : String(item.notes),
    })),
  }
}

async function findProductIdByCode(pool: pg.Pool, organizationId: string, productCode: string) {
  const result = await pool.query(
    `
      select p.id::text
      from products p
      where p.organization_id = $1
        and p.code = $2
      union
      select p.id::text
      from product_unit_conversions puc
      join products p
        on p.organization_id = puc.organization_id
        and p.id = puc.product_id
      where puc.organization_id = $1
        and puc.source_code = $2
        and puc.is_active = true
      limit 1
    `,
    [organizationId, productCode],
  )
  return result.rows[0]?.id ? String(result.rows[0].id) : null
}

function inventoryUnitCode(unitName: string) {
  const normalized = unitName
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return `KV-${normalized || 'UNIT'}-${stableHash(unitName)}`
}

function inventoryUnitKind(unitName: string) {
  const normalized = normalizeSearchText(unitName)
  if (normalized === 'm' || normalized.includes('met')) return 'length'
  if (normalized === 'm2' || normalized.includes('m2')) return 'area'
  if (normalized.includes('kg') || normalized.includes('gram')) return 'weight'
  if (normalized.includes('lit')) return 'volume'
  if (normalized.includes('ram') || normalized.includes('cuon') || normalized.includes('bao') || normalized.includes('kho')) return 'package'
  return 'quantity'
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

async function ensureSearchSelectionStatsTable(pool: pg.Pool) {
  return ensureSchemaOnce(searchSelectionStatsEnsureCache, pool, async () => {
    await pool.query(`
      create table if not exists search_selection_stats (
        organization_id uuid not null references organizations(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        entity_type text not null check (entity_type in ('customer', 'supplier', 'product')),
        entity_id text not null,
        select_count integer not null default 0 check (select_count >= 0),
        last_selected_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (organization_id, user_id, entity_type, entity_id)
      )
    `)
    await pool.query(`
      create index if not exists search_selection_stats_rank_idx
      on search_selection_stats (organization_id, user_id, entity_type, select_count desc, last_selected_at desc)
    `)
  })
}

async function quickPickRankedItems<T extends { id: string }>(input: {
  pool: pg.Pool
  organizationId: string
  userId?: string
  entityType: 'customer' | 'supplier' | 'product'
  url: URL
  items: T[]
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}): Promise<T[]> {
  if (input.url.searchParams.get('search_context') !== 'quick_pick' || !input.userId || input.items.length === 0) {
    return input.items
  }
  const ranks = await searchSelectionRanks(input.pool, {
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: input.entityType,
    entityIds: input.items.map((item) => item.id),
  })
  return rankQuickPickItems(input.items, {
    ranks,
    search: normalizeSearchText(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? ''),
    codeOf: input.codeOf,
    nameOf: input.nameOf,
  })
}

async function searchSelectionRanks(pool: pg.Pool, input: {
  organizationId: string
  userId: string
  entityType: 'customer' | 'supplier' | 'product'
  entityIds: string[]
}) {
  await ensureSearchSelectionStatsTable(pool)
  const result = await pool.query(
    `
      select entity_id, select_count, last_selected_at
      from search_selection_stats
      where organization_id = $1
        and user_id = $2
        and entity_type = $3
        and entity_id = any($4::text[])
    `,
    [input.organizationId, input.userId, input.entityType, input.entityIds],
  )
  return new Map(result.rows.map((row) => [String(row.entity_id), {
    selectCount: Number(row.select_count),
    lastSelectedAt: row.last_selected_at?.toISOString?.() ?? String(row.last_selected_at),
  }]))
}

function rankQuickPickItems<T extends { id: string }>(items: T[], input: {
  ranks: Map<string, { selectCount: number; lastSelectedAt: string }>
  search: string
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}) {
  return items
    .map((item, index) => ({ item, index, score: quickPickItemScore(item, input) }))
    .sort((left, right) => (
      right.score.selectCount - left.score.selectCount
      || right.score.lastSelectedAt - left.score.lastSelectedAt
      || right.score.exactCode - left.score.exactCode
      || right.score.codePrefix - left.score.codePrefix
      || right.score.exactName - left.score.exactName
      || right.score.namePrefix - left.score.namePrefix
      || left.index - right.index
    ))
    .map((entry) => entry.item)
}

function quickPickItemScore<T extends { id: string }>(item: T, input: {
  ranks: Map<string, { selectCount: number; lastSelectedAt: string }>
  search: string
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}) {
  const rank = input.ranks.get(item.id)
  const code = normalizeSearchText(input.codeOf(item))
  const name = normalizeSearchText(input.nameOf(item))
  return {
    selectCount: rank?.selectCount ?? 0,
    lastSelectedAt: rank ? Date.parse(rank.lastSelectedAt) || 0 : 0,
    exactCode: input.search && code === input.search ? 1 : 0,
    codePrefix: input.search && code.startsWith(input.search) ? 1 : 0,
    exactName: input.search && name === input.search ? 1 : 0,
    namePrefix: input.search && name.startsWith(input.search) ? 1 : 0,
  }
}

async function ensureFinanceAccountsTable(pool: pg.Pool) {
  return ensureSchemaOnce(financeAccountsEnsureCache, pool, async () => {
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
  })
}

function mapFinanceAccountRow(row: {
  id: string
  code: string
  name: string
  account_type: FinanceAccountData['account_type']
  is_default_cash: boolean
  is_active: boolean
  account_number: string | null
  account_holder: string | null
  opening_balance: string | number | null
  note: string | null
  notify_on_transaction: boolean | null
}): FinanceAccountData {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    account_type: row.account_type,
    is_default_cash: Boolean(row.is_default_cash),
    is_active: Boolean(row.is_active),
    account_number: row.account_number,
    account_holder: row.account_holder,
    opening_balance: row.opening_balance === null ? 0 : Number(row.opening_balance),
    note: row.note,
    notify_on_transaction: Boolean(row.notify_on_transaction),
  }
}

async function listFinanceAccountsForExclusion(pool: pg.Pool, organizationId: string) {
  return getCachedOrgPromise(financeAccountsListCache, pool, organizationId, async () => {
    await ensureFinanceAccountsTable(pool)
    const result = await pool.query(
      `
        select id, code, name, account_type, is_default_cash, is_active,
               account_number, account_holder, opening_balance, note, notify_on_transaction
        from finance_accounts
        where organization_id = $1
      `,
      [organizationId],
    )
    return result.rows.map(mapFinanceAccountRow)
  })
}

function getCachedOrgPromise<T>(
  cache: WeakMap<pg.Pool, Map<string, Promise<T>>>,
  pool: pg.Pool,
  organizationId: string,
  run: () => Promise<T>,
) {
  let byOrg = cache.get(pool)
  if (!byOrg) {
    byOrg = new Map<string, Promise<T>>()
    cache.set(pool, byOrg)
  }
  const existing = byOrg.get(organizationId)
  if (existing) return existing
  const pending = run().catch((error) => {
    byOrg?.delete(organizationId)
    throw error
  })
  byOrg.set(organizationId, pending)
  return pending
}

function invalidateOrgCache<T>(
  cache: WeakMap<pg.Pool, Map<string, Promise<T>>>,
  pool: pg.Pool,
  organizationId: string,
) {
  cache.get(pool)?.delete(organizationId)
}

function normalizeFinanceAccountIdentity(value: string | null | undefined) {
  return normalizeSearchText(value ?? '').replace(/\{del\}/g, '').replace(/\s+/g, '')
}

function financeAccountComparableKeys(account: Pick<FinanceAccountData, 'id' | 'code' | 'name'> & { account_number?: string | null }) {
  return [
    account.account_number,
    account.code,
    account.name,
    account.id,
  ].map(normalizeFinanceAccountIdentity).filter(Boolean)
}

function isDeletedFinanceAccount(account: Pick<FinanceAccountData, 'id' | 'code' | 'name'> & { account_number?: string | null }) {
  return [account.id, account.code, account.name, account.account_number].some((value) => normalizeSearchText(value ?? '').includes('{del}'))
}

function isReplacedDeletedFinanceAccount(
  account: Pick<FinanceAccountData, 'id' | 'code' | 'name' | 'account_type'> & { account_number?: string | null },
  accounts: FinanceAccountData[],
) {
  if (account.account_type !== 'bank' || !isDeletedFinanceAccount(account)) return false
  const keys = new Set(financeAccountComparableKeys(account))
  if (keys.size === 0) return false
  return accounts.some((candidate) => (
    candidate.account_type === 'bank'
    && candidate.is_active
    && !isDeletedFinanceAccount(candidate)
    && financeAccountComparableKeys(candidate).some((key) => keys.has(key))
  ))
}

async function ensureSalesFinanceTables(pool: pg.Pool) {
  return ensureSchemaOnce(salesFinanceEnsureCache, pool, async () => {
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
  await pool.query(`alter table orders add column if not exists base_code text`)
  await pool.query(`alter table orders add column if not exists revision_no integer not null default 0`)
  await pool.query(`alter table orders add column if not exists revised_from_order_id text references orders(id) on delete set null`)
  await pool.query(`alter table orders add column if not exists replaced_by_order_id text references orders(id) on delete set null`)
  await pool.query(`alter table orders add column if not exists cancel_reason_type text`)
  await pool.query(`alter table orders add column if not exists revision_reason_code text`)
  await pool.query(`alter table orders add column if not exists revision_reason_note text`)
  await pool.query(`update orders set base_code = regexp_replace(code, '\\.\\d+$', '') where base_code is null or btrim(base_code) = ''`)
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
  await pool.query('alter table order_items add column if not exists width_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists height_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists linear_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists note text')
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
  await pool.query('alter table payment_receipts add column if not exists created_at timestamptz not null default now()')
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
  await pool.query('alter table payment_receipt_methods add column if not exists payment_receipt_id text')
  await pool.query('alter table payment_receipt_methods add column if not exists order_id text')
  await pool.query('alter table payment_receipt_methods add column if not exists created_at timestamptz not null default now()')
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
    create table if not exists customer_debt_adjustments (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      customer_id text not null,
      customer_snapshot jsonb not null default '{}'::jsonb,
      source_code text not null,
      source_system text not null default 'kiotviet',
      source_file text,
      source_row integer,
      transaction_type text not null default 'adjustment',
      amount_delta numeric(14,2) not null,
      paid_amount numeric(14,2) not null default 0,
      remaining_amount numeric(14,2) not null,
      balance_after numeric(14,2) not null default 0,
      status text not null check (status in ('open', 'closed')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, source_system, source_code)
    )
  `)
  await pool.query('create index if not exists customer_debt_adjustments_customer_idx on customer_debt_adjustments (organization_id, customer_id, status, created_at desc)')
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
      created_by jsonb null,
      created_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table cashbook_entries add column if not exists created_by jsonb null')
  await pool.query('alter table cashbook_entries add column if not exists source jsonb not null default \'{}\'::jsonb')
  await pool.query('alter table cashbook_entries add column if not exists allocations jsonb not null default \'[]\'::jsonb')
  await pool.query('alter table cashbook_entries add column if not exists created_at timestamptz not null default now()')
  await pool.query('create index if not exists cashbook_entries_org_created_idx on cashbook_entries (organization_id, created_at desc)')
  await migrateLegacyPosFinanceCodes(pool)
  })
}

function ensureSchemaOnce(cache: WeakMap<pg.Pool, Promise<void>>, pool: pg.Pool, run: () => Promise<void>) {
  const existing = cache.get(pool)
  if (existing) return existing
  const pending = run().catch((error) => {
    cache.delete(pool)
    throw error
  })
  cache.set(pool, pending)
  return pending
}

async function migrateLegacyPosFinanceCodes(pool: pg.Pool) {
  const legacyOrders = await pool.query<{
    organization_id: string
    id: string
    old_code: string
    order_type: 'invoice' | 'quote'
    created_at: Date
    rn: number
    max_seq: number
  }>(`
    select
      o.organization_id::text as organization_id,
      o.id,
      o.code as old_code,
      o.order_type,
      o.created_at,
      row_number() over (partition by o.organization_id, o.order_type order by o.created_at, o.id) as rn,
      coalesce((
        select max((regexp_match(o2.code, '^(?:HD|BG)(\\d{6})(?:\\.\\d+)?$'))[1]::int)
        from orders o2
        where o2.organization_id = o.organization_id
          and o2.order_type = o.order_type
          and o2.code ~ '^(?:HD|BG)\\d{6}(?:\\.\\d+)?$'
      ), 0) as max_seq
    from orders o
    where o.code ~ '^(HD|BG)-POS-'
    order by o.organization_id, o.order_type, o.created_at, o.id
  `)

  if (legacyOrders.rowCount === 0) return
  const stockMovementsTable = await pool.query<{ exists: boolean }>("select to_regclass('public.stock_movements') is not null as exists")
  const hasStockMovementsTable = stockMovementsTable.rows[0]?.exists === true

  for (const order of legacyOrders.rows) {
    const prefix = order.order_type === 'invoice' ? 'HD' : 'BG'
    const sequence = Number(order.max_seq) + Number(order.rn)
    const newOrderCode = `${prefix}${String(sequence).padStart(6, '0')}`
    await pool.query(
      `
        update orders
        set code = $1
        where organization_id = $2
          and id = $3
      `,
      [newOrderCode, order.organization_id, order.id],
    )

    const paymentReceiptCode = `TTHD${String(sequence).padStart(6, '0')}`
    await pool.query(
      `
        update payment_receipts
        set code = $1
        where organization_id = $2
          and order_id = $3
      `,
      [paymentReceiptCode, order.organization_id, order.id],
    )

    const cashbookRows = await pool.query<{
      id: string
      code: string
      finance_account: { account_type?: string }
      note: string
      source: Record<string, unknown> | null
      allocations: Array<Record<string, unknown>> | null
    }>(
      `
        select id, code, finance_account, note, source, allocations
        from cashbook_entries
        where organization_id = $1
          and (
            source->>'order_code' = $2
            or note like '%' || $2 || '%'
          )
        order by created_at, id
      `,
      [order.organization_id, order.old_code],
    )

    for (const [index, cashbookRow] of cashbookRows.rows.entries()) {
      const suffix = index === 0 ? '' : `-${cashbookRow.finance_account?.account_type === 'bank' ? 'NH' : 'TM'}`
      const newCashbookCode = `${paymentReceiptCode}${suffix}`
      const source = cashbookRow.source && typeof cashbookRow.source === 'object' ? cashbookRow.source : {}
      const allocations = Array.isArray(cashbookRow.allocations)
        ? cashbookRow.allocations.map((allocation) => (
            allocation && typeof allocation === 'object' && allocation.order_code === order.old_code
              ? { ...allocation, order_code: newOrderCode }
              : allocation
          ))
        : []
      const updatedNote = cashbookRow.note.includes(order.old_code) ? cashbookRow.note.replaceAll(order.old_code, newOrderCode) : cashbookRow.note
      await pool.query(
        `
          update cashbook_entries
          set code = $1,
              source = $2::jsonb,
              allocations = $3::jsonb,
              note = $4
          where organization_id = $5
            and id = $6
        `,
        [
          newCashbookCode,
          JSON.stringify({
            ...source,
            code: newCashbookCode,
            order_code: newOrderCode,
          }),
          JSON.stringify(allocations),
          updatedNote,
          order.organization_id,
          cashbookRow.id,
        ],
      )
    }

    if (hasStockMovementsTable) {
      await pool.query(
        `
          update stock_movements
          set document_code = $1
          where organization_id = $2
            and document_code = $3
        `,
        [newOrderCode, order.organization_id, order.old_code],
      )
    }
  }
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
  base_code?: string | null
  revision_no?: string | number | null
  revised_from_order_id?: string | null
  replaced_by_order_id?: string | null
  cancel_reason_type?: string | null
  revision_reason_code?: string | null
  revision_reason_note?: string | null
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
  created_by?: CashbookEntryData['created_by']
  source?: CashbookEntryData['source']
  allocations?: CashbookEntryData['allocations']
}

async function insertSalesDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  const orderResult = await pool.query(
    `
      insert into orders (
        id, organization_id, code, order_type, status, customer_id,
        customer_snapshot, seller_snapshot, subtotal_amount, discount_amount,
        total_amount, paid_amount, debt_amount, payment_status, note, base_code, revision_no,
        revised_from_order_id, replaced_by_order_id, cancel_reason_type, revision_reason_code, revision_reason_note, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now())
      on conflict (organization_id, code)
      do update set
        order_type = excluded.order_type,
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
        base_code = excluded.base_code,
        revision_no = excluded.revision_no,
        revised_from_order_id = excluded.revised_from_order_id,
        replaced_by_order_id = excluded.replaced_by_order_id,
        cancel_reason_type = excluded.cancel_reason_type,
        revision_reason_code = excluded.revision_reason_code,
        revision_reason_note = excluded.revision_reason_note,
        created_at = excluded.created_at,
        updated_at = now()
      returning id::text
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
      document.base_code ?? null,
      document.revision_no ?? 0,
      document.revised_from_order_id ?? null,
      document.replaced_by_order_id ?? null,
      document.cancel_reason_type ?? null,
      document.revision_reason_code ?? null,
      document.revision_reason_note ?? null,
      document.created_at,
    ],
  )
  const orderId = String(orderResult.rows[0]?.id ?? document.id)

  await pool.query(
    `
      delete from order_items
      where organization_id = $1
        and order_id = $2
    `,
    [organizationId, orderId],
  )

  for (const [index, item] of document.items.entries()) {
    const detailItem = item as {
      product_id: string
      quantity?: number
      unit_price?: number
      discount_amount?: number
      line_total?: number
      width_m?: number | null
      height_m?: number | null
      linear_m?: number | null
      note?: string | null
    }
    const quantity = Number(detailItem.quantity ?? 1)
    const unitPrice = Number(detailItem.unit_price ?? 0)
    const discountAmount = Number(detailItem.discount_amount ?? 0)
    const lineTotal = Number.isFinite(detailItem.line_total ?? Number.NaN)
      ? Number(detailItem.line_total)
      : Math.max(quantity * unitPrice - discountAmount, 0)
    const widthM = typeof detailItem.width_m === 'number' && Number.isFinite(detailItem.width_m) ? detailItem.width_m : null
    const heightM = typeof detailItem.height_m === 'number' && Number.isFinite(detailItem.height_m) ? detailItem.height_m : null
    const linearM = typeof detailItem.linear_m === 'number' && Number.isFinite(detailItem.linear_m) ? detailItem.linear_m : null
    const note = typeof detailItem.note === 'string' && detailItem.note.trim() !== '' ? detailItem.note : null
    await pool.query(
      `
        insert into order_items (
          organization_id, order_id, product_id, product_snapshot, quantity, unit_price, discount_amount, line_total, sort_order,
          width_m, height_m, linear_m, note
        )
        values ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [organizationId, orderId, detailItem.product_id, quantity, unitPrice, discountAmount, lineTotal, index + 1, widthM, heightM, linearM, note],
    )
  }

  if (document.order_type === 'invoice' && document.status !== 'cancelled' && document.debt_amount > 0) {
    await pool.query(
      `
        insert into customer_debt_entries (
          organization_id, customer_id, order_id, original_amount, paid_amount,
          remaining_debt, status, created_at, updated_at
        )
        values ($1, $2, $3, $4, 0, $4, 'open', $5, now())
        on conflict (organization_id, order_id) do update set
          customer_id = excluded.customer_id,
          original_amount = excluded.original_amount,
          paid_amount = excluded.paid_amount,
          remaining_debt = excluded.remaining_debt,
          status = excluded.status,
          updated_at = now()
      `,
      [organizationId, document.customer.id, orderId, document.debt_amount, document.created_at],
    )
  } else if (document.order_type === 'invoice') {
    await pool.query(
      `
        update customer_debt_entries
        set remaining_debt = 0,
            status = 'closed',
            updated_at = now()
        where organization_id = $1
          and order_id = $2
          and status = 'open'
      `,
      [organizationId, orderId],
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
    base_code: row.base_code ?? undefined,
    revision_no: row.revision_no !== null && row.revision_no !== undefined ? Number(row.revision_no) : undefined,
    revised_from_order_id: row.revised_from_order_id ?? null,
    replaced_by_order_id: row.replaced_by_order_id ?? null,
    cancel_reason_type: row.cancel_reason_type ?? null,
    revision_reason_code: row.revision_reason_code ?? null,
    revision_reason_note: row.revision_reason_note ?? null,
  }
}

async function userDisplayNameMap(pool: pg.Pool, organizationId: string) {
  return getCachedOrgPromise(userDisplayNameEnsureCache, pool, organizationId, async () => {
    await ensureUserManagementColumns(pool)
    const result = await pool.query(
      `
        select id::text, display_name
        from users
        where organization_id = $1
      `,
      [organizationId],
    )
    return new Map(result.rows.map((row) => [String(row.id), String(row.display_name)]))
  })
}

function hydrateUserReference<T extends { id: string; name: string }>(reference: T, userDisplayNames: ReadonlyMap<string, string>): T {
  const displayName = userDisplayNames.get(reference.id)
  return displayName ? { ...reference, name: displayName } : reference
}

function hydrateSalesDocumentUserSnapshot(document: SalesDocumentData, userDisplayNames: ReadonlyMap<string, string>): SalesDocumentData {
  return {
    ...document,
    seller: hydrateUserReference(document.seller, userDisplayNames),
  }
}

function hydrateCashbookEntryUserSnapshot(entry: CashbookEntryData, userDisplayNames: ReadonlyMap<string, string>): CashbookEntryData {
  return {
    ...entry,
    created_by: entry.created_by ? hydrateUserReference(entry.created_by, userDisplayNames) : entry.created_by,
  }
}

async function listSalesDocumentPaymentReceipts(
  pool: pg.Pool,
  organizationId: string,
  document: SalesDocumentData,
  userDisplayNames: ReadonlyMap<string, string>,
): Promise<SalesDocumentPaymentReceiptData[]> {
  const result = await pool.query(
    `
      select
        id,
        code,
        status,
        direction,
        amount_delta,
        finance_account,
        is_business_accounted,
        source_type,
        created_at,
        note,
        counterparty,
        created_by,
        source,
        allocations
      from cashbook_entries
      where organization_id = $1
        and direction = 'in'
        and (
          source->>'order_code' = $2
          or allocations @> $3::jsonb
          or allocations @> $4::jsonb
        )
      order by created_at desc
    `,
    [
      organizationId,
      document.code,
      JSON.stringify([{ order_code: document.code }]),
      JSON.stringify([{ order_id: document.id }]),
    ],
  )

  return result.rows
    .map(mapCashbookRow)
    .map((entry) => hydrateCashbookEntryUserSnapshot(entry, userDisplayNames))
    .filter((entry) => cashbookEntryMatchesSalesDocument(entry, document))
    .map((entry) => cashbookEntrySalesDocumentPaymentReceipt(entry, document))
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
    created_by: row.created_by ?? null,
    source: row.source,
    allocations: row.allocations,
  }
}

function hydrateCashbookEntryFinanceAccount(
  entry: CashbookEntryData,
  accounts: readonly FinanceAccountData[],
): CashbookEntryData {
  const account = accounts.find((item) => item.id === entry.finance_account.id)
  if (!account) return entry
  return {
    ...entry,
    finance_account: cashbookFinanceAccountSnapshot(account),
  }
}

function cashbookFinanceAccountSnapshot(account: FinanceAccountData): CashbookEntryData['finance_account'] {
  return {
    id: account.id,
    code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
    name: account.name,
    account_type: account.account_type,
    account_number: account.account_number,
    account_holder: account.account_holder,
  }
}

function cashbookNoteOrderCode(note: string | null | undefined) {
  return note?.match(/\bHD(?:-[A-Z0-9]+)+\b|\bHD\d+(?:\.\d+)?\b/i)?.[0].toUpperCase() ?? null
}

function salesDocumentSameSaleReceiptBaseCode(orderCode: string | null | undefined) {
  const match = orderCode?.match(/^HD(\d{6}(?:\.\d+)?)$/i)
  return match ? `TTHD${match[1]}` : null
}

function cashbookEntryHasLinkedOrder(entry: CashbookEntryData) {
  return entry.source?.order_code || (entry.allocations?.length ?? 0) > 0
}

function cashbookEntryMatchesSalesDocument(entry: CashbookEntryData, document: SalesDocumentData) {
  if (entry.direction !== 'in') return false
  if (entry.source?.order_code === document.code) return true
  return (entry.allocations ?? []).some((allocation) => allocation.order_id === document.id || allocation.order_code === document.code)
}

function cashbookEntrySalesDocumentPaymentReceipt(
  entry: CashbookEntryData,
  document: SalesDocumentData,
): SalesDocumentPaymentReceiptData {
  const amount = Math.abs(Number(entry.amount_delta))
  const linkedAllocations = (entry.allocations ?? []).filter((allocation) => allocation.order_id === document.id || allocation.order_code === document.code)
  const allocations = linkedAllocations.length > 0
    ? linkedAllocations.map((allocation) => ({
        order_id: allocation.order_id,
        order_code: allocation.order_code,
        allocated_amount: Number(allocation.allocated_amount),
        remaining_after: Number(allocation.remaining_after),
      }))
    : [{
        order_id: document.id,
        order_code: document.code,
        allocated_amount: amount,
        remaining_after: Math.max(Number(document.debt_amount), 0),
      }]
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
  const sourceCreatorName = entry.source?.source_creator_name?.trim()

  return {
    id: entry.id,
    code: entry.code,
    status: entry.status === 'cancelled' ? 'cancelled' : 'posted',
    receipt_type: (entry.allocations?.length ?? 0) > 1 ? 'mixed_sale_and_debt' : 'sale_payment',
    total_received_amount: allocatedTotal > 0 ? allocatedTotal : amount,
    created_at: entry.created_at,
    created_by: entry.created_by ?? { id: sourceCreatorName ? `kiotviet-${entry.id}` : document.seller.id, name: sourceCreatorName || document.seller.name },
    methods: [{
      method_type: entry.finance_account.account_type === 'bank' || entry.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cash',
      amount,
      finance_account: {
        id: entry.finance_account.id,
        code: entry.finance_account.account_number ?? entry.finance_account.code,
        name: entry.finance_account.name,
      },
    }],
    allocations,
  }
}

async function hydrateCashbookEntryLink(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  if (entry.direction !== 'in') return entry
  if (cashbookEntryHasLinkedOrder(entry)) return hydrateCashbookEntryAllocationTimes(pool, organizationId, entry)
  const orderCode = cashbookNoteOrderCode(entry.note)
  if (orderCode === null) return entry

  const order = await pool.query(
    `
      select id, code, created_at, total_amount, paid_amount, debt_amount
      from orders
      where organization_id = $1
        and code = $2
      limit 1
    `,
    [organizationId, orderCode],
  )
  const row = order.rows[0]
  if (!row) return entry

  const allocatedAmount = Math.abs(Number(entry.amount_delta))
  const paidAmount = Number(row.paid_amount)
  return {
    ...entry,
    source: { type: 'payment_receipt', id: entry.id, code: entry.code, order_code: row.code },
    allocations: [{
      order_id: row.id,
      order_code: row.code,
      order_total_amount: Number(row.total_amount),
      collected_before: Math.max(paidAmount - allocatedAmount, 0),
      allocated_amount: allocatedAmount,
      remaining_after: Number(row.debt_amount),
      order_created_at: row.created_at.toISOString(),
    }],
  }
}

async function hydrateCashbookEntryAllocationTimes(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  const allocations = entry.allocations ?? []
  if (allocations.length === 0 || allocations.every((allocation) => allocation.order_created_at)) return entry

  const orderIds = allocations.map((allocation) => allocation.order_id).filter(Boolean)
  const orderCodes = allocations.map((allocation) => allocation.order_code).filter(Boolean)
  const result = await pool.query(
    `
      select id::text, code, created_at
      from orders
      where organization_id = $1
        and (id::text = any($2::text[]) or code = any($3::text[]))
    `,
    [organizationId, orderIds, orderCodes],
  )
  const createdAtById = new Map(result.rows.map((row) => [String(row.id), row.created_at.toISOString()]))
  const createdAtByCode = new Map(result.rows.map((row) => [String(row.code), row.created_at.toISOString()]))

  return {
    ...entry,
    allocations: allocations.map((allocation) => ({
      ...allocation,
      order_created_at: allocation.order_created_at ?? createdAtById.get(allocation.order_id) ?? createdAtByCode.get(allocation.order_code),
    })),
  }
}

async function insertCashbookEntry(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  await pool.query(
    `
      insert into cashbook_entries (
        id, organization_id, code, status, direction, amount_delta, finance_account,
        counterparty, note, source_type, source, allocations, is_business_accounted, created_by, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15)
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
      JSON.stringify(entry.created_by ?? null),
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

const vietnameseSearchFrom = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const vietnameseSearchTo = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'

function priceListPriceMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([priceListId, unitPrice]) => [priceListId, Number(unitPrice)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  )
}

function accentInsensitiveSearchSql(expression: string) {
  return `translate(lower(${expression}), '${vietnameseSearchFrom}', '${vietnameseSearchTo}')`
}

async function ensureUserManagementColumns(pool: pg.Pool) {
  await pool.query('alter table users add column if not exists username text')
  await pool.query('alter table users add column if not exists phone text')
  await pool.query('alter table users add column if not exists birthday date')
  await pool.query('alter table users add column if not exists region text')
  await pool.query('alter table users add column if not exists ward text')
  await pool.query('alter table users add column if not exists address text')
  await pool.query('alter table users add column if not exists note text')
  await pool.query(`
    create unique index if not exists users_org_username_uidx
    on users (organization_id, lower(username))
    where username is not null and btrim(username) <> ''
  `)
  await pool.query('create index if not exists users_org_created_idx on users (organization_id, created_at desc)')
}

async function ensureOrganizationBillSettingsColumns(pool: pg.Pool) {
  await pool.query('alter table organizations add column if not exists shop_name text')
  await pool.query('alter table organizations add column if not exists shop_address text')
  await pool.query('alter table organizations add column if not exists shop_phone text')
  await pool.query('alter table organizations add column if not exists print_place text')
  await pool.query('alter table organizations add column if not exists default_bill_template text')
  await pool.query('alter table organizations add column if not exists invoice_title text')
  await pool.query('alter table organizations add column if not exists quote_title text')
  await pool.query('alter table organizations add column if not exists footer_note text')
  await pool.query('alter table organizations add column if not exists show_product_code boolean')
  await pool.query('alter table organizations add column if not exists show_unit boolean')
  await pool.query('alter table organizations add column if not exists show_discount boolean')
  await pool.query('alter table organizations add column if not exists logo_data_url text')
  await pool.query('alter table organizations add column if not exists bill_templates jsonb')
  await pool.query(`
    update organizations
    set bill_templates = coalesce(bill_templates, '[]'::jsonb)
    where bill_templates is null
  `)
  await pool.query(`
    update organizations
    set shop_name = coalesce(nullif(btrim(shop_name), ''), name)
    where shop_name is null or btrim(shop_name) = ''
  `)
  await pool.query(`
    update organizations
    set shop_address = coalesce(shop_address, '')
    where shop_address is null
  `)
  await pool.query(`
    update organizations
    set shop_phone = coalesce(shop_phone, '')
    where shop_phone is null
  `)
  await pool.query(`
    update organizations
    set print_place = coalesce(print_place, '')
    where print_place is null
  `)
  await pool.query(`
    update organizations
    set default_bill_template = 'a4'
    where default_bill_template is null
       or btrim(default_bill_template) = ''
       or default_bill_template not in ('a4', 'k80')
  `)
  await pool.query(`
    update organizations
    set invoice_title = coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG')
    where invoice_title is null or btrim(invoice_title) = ''
  `)
  await pool.query(`
    update organizations
    set quote_title = coalesce(nullif(btrim(quote_title), ''), 'BẢNG BÁO GIÁ')
    where quote_title is null or btrim(quote_title) = ''
  `)
  await pool.query(`
    update organizations
    set footer_note = coalesce(footer_note, '')
    where footer_note is null
  `)
  await pool.query(`
    update organizations
    set show_product_code = coalesce(show_product_code, false),
        show_unit = coalesce(show_unit, true),
        show_discount = coalesce(show_discount, false)
    where show_product_code is null
       or show_unit is null
       or show_discount is null
  `)
}

async function ensureDefaultProductGroup(pool: pg.Pool, organizationId: string): Promise<ProductGroupListData> {
  const existing = await pool.query<ProductGroupListData>(
    `
      select id::text, code, name, is_default, is_active
      from product_groups
      where organization_id = $1
        and is_active = true
      order by is_default desc, name asc
      limit 1
    `,
    [organizationId],
  )
  if (existing.rows[0]) return existing.rows[0]

  const id = randomUUID()
  const name = 'Giá chung'
  const code = 'GENERAL'
  await pool.query(
    `
      insert into product_groups (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, true, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        is_default = true,
        is_active = true,
        updated_at = now()
      returning id::text, code, name, is_default, is_active
    `,
    [id, organizationId, code, name],
  )
  const created = await pool.query<ProductGroupListData>(
    `
      select id::text, code, name, is_default, is_active
      from product_groups
      where organization_id = $1
        and code = $2
      limit 1
    `,
    [organizationId, code],
  )
  return created.rows[0] ?? {
    id,
    code,
    name,
    is_default: true,
    is_active: true,
  }
}

function filterValues(url: URL, key: string) {
  return (url.searchParams.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function filterValueMatches(values: string[], actual: string) {
  if (values.length === 0) return true
  return values.includes(actual)
}

function dateRangeMatches(value: string, from: string | null, to: string | null) {
  return displayDateRangeMatches(value, from, to)
}

function salesDocumentMatches(url: URL, document: SalesDocumentData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const type = filterValues(url, 'type')
  const status = filterValues(url, 'status')
  const customerId = url.searchParams.get('customer_id')
  const paymentStatus = filterValues(url, 'payment_status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!filterValueMatches(type, document.order_type)) return false
  if (!filterValueMatches(status, document.status)) return false
  if (customerId && document.customer.id !== customerId) return false
  if (!filterValueMatches(paymentStatus, document.payment_status)) return false
  if (!dateRangeMatches(document.created_at, from, to)) return false
  if (search) {
    const haystack = normalizeSearchText(`${document.code} ${document.customer.code ?? ''} ${document.customer.name} ${document.note ?? ''}`)
    if (!haystack.includes(search)) return false
  }
  return true
}

function cashbookEntryMatches(url: URL, entry: CashbookEntryData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const searchScope = url.searchParams.get('search_scope') ?? 'all'
  const financeAccountId = url.searchParams.get('finance_account_id')
  const financeAccountType = url.searchParams.get('finance_account_type')
  const direction = url.searchParams.get('direction')
  const status = url.searchParams.get('status')
  const isBusinessAccounted = url.searchParams.get('is_business_accounted')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (financeAccountId && financeAccountId !== 'all' && entry.finance_account.id !== financeAccountId) return false
  if (financeAccountType && financeAccountType !== 'all' && entry.finance_account.account_type !== financeAccountType) return false
  if (direction && direction !== 'all' && entry.direction !== direction) return false
  if (status && status !== 'all' && entry.status !== status) return false
  if (isBusinessAccounted === 'true' && !entry.is_business_accounted) return false
  if (isBusinessAccounted === 'false' && entry.is_business_accounted) return false
  if (!dateRangeMatches(entry.created_at, from, to)) return false
  if (search) {
    const scopedHaystacks = {
      code: entry.code,
      note: entry.note ?? '',
      transfer_content: entry.source?.transfer_content ?? '',
      counterparty: `${entry.counterparty.name} ${entry.counterparty.phone ?? ''}`,
      all: `${entry.code} ${entry.note} ${entry.counterparty.name} ${entry.counterparty.phone ?? ''} ${entry.finance_account.code} ${entry.finance_account.name} ${entry.source?.transfer_content ?? ''}`,
    }
    const haystack = normalizeSearchText(scopedHaystacks[searchScope as keyof typeof scopedHaystacks] ?? scopedHaystacks.all)
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

type KiotVietCashbookImportRow = NonNullable<Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]>['rows'][number]

function preferPostedKiotVietCashbookRows(rows: KiotVietCashbookImportRow[]) {
  const byCode = new Map<string, KiotVietCashbookImportRow>()
  for (const row of rows) {
    const previous = byCode.get(row.source_code)
    if (!previous || (previous.status === 'cancelled' && row.status === 'posted')) {
      byCode.set(row.source_code, row)
    }
  }
  return [...byCode.values()]
}

function financeAccountFromKiotVietCashbookRow(row: KiotVietCashbookImportRow): FinanceAccountData {
  if (row.account_type === 'cash') {
    return {
      id: 'cash-main',
      code: 'TM',
      name: 'Tien mat',
      account_type: 'cash',
      is_default_cash: true,
      is_active: true,
      opening_balance: 0,
      note: null,
      notify_on_transaction: false,
    }
  }
  const accountNumber = row.account_number ?? `BANK-${hashText(row.account_name).slice(0, 12)}`
  const isDeletedAccount = accountNumber.includes('{DEL}') || row.account_name.includes('{DEL}')
  return {
    id: `bank-kv-${hashText(accountNumber)}`,
    code: accountNumber,
    name: row.account_name,
    account_type: 'bank',
    is_default_cash: false,
    is_active: !isDeletedAccount,
    account_number: accountNumber,
    account_holder: row.account_name,
    opening_balance: 0,
    note: 'Imported from KiotViet So Quy.',
    notify_on_transaction: true,
  }
}

function linkedInvoiceCodeFromKiotVietCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^TTHDO?(\d+(?:\.\d+)?)$/)
  return match ? `HD${match[1]}` : null
}

async function rebuildImportedKiotVietCashbookAllocations(pool: pg.Pool, organizationId: string) {
  const [invoiceResult, receiptResult, cashbookResult] = await Promise.all([
    pool.query<{
      id: string
      code: string
      created_at: Date
      status: string
      order_type: string
      total_amount: string | number
      paid_amount: string | number
      debt_amount: string | number
      customer_id: string | null
      customer_snapshot: { id?: string; code?: string; name?: string } | null
    }>(
      `
        select id, code, created_at, status, order_type, total_amount, paid_amount, debt_amount,
               customer_id, customer_snapshot
        from orders
        where organization_id = $1
          and id like 'sales-document-kv-%'
          and order_type = 'invoice'
      `,
      [organizationId],
    ),
    pool.query<{
      id: string
      code: string
      data: {
        status?: string
        received_at?: string
        payable_amount?: number
        paid_amount?: number
        remaining_amount?: number
        supplier?: { id?: string; code?: string; name?: string }
        supplier_id?: string
      }
    }>(
      `
        select id, code, data
        from purchase_receipt_snapshots
        where organization_id = $1
          and id like 'purchase-receipt-kv-%'
      `,
      [organizationId],
    ),
    pool.query<{
      id: string
      code: string
      created_at: Date
      direction: 'in' | 'out'
      amount_delta: string | number
      status: string
      source: Record<string, unknown> | null
      counterparty: { name?: string; phone?: string | null } | null
    }>(
      `
        select id, code, created_at, direction, amount_delta, status, source, counterparty
        from cashbook_entries
        where organization_id = $1
          and source_type = 'kiotviet_cashbook'
      `,
      [organizationId],
    ),
  ])

  const invoices: AllocatableInvoice[] = invoiceResult.rows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    created_at: row.created_at.toISOString(),
    status: String(row.status),
    order_type: String(row.order_type),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    debt_amount: Number(row.debt_amount),
    customer: {
      id: String(row.customer_id ?? row.customer_snapshot?.id ?? ''),
      code: String(row.customer_snapshot?.code ?? ''),
      name: row.customer_snapshot?.name,
    },
  }))

  const receipts: AllocatablePurchaseReceipt[] = receiptResult.rows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    received_at: String(row.data?.received_at ?? new Date().toISOString()),
    status: String(row.data?.status ?? 'posted'),
    payable_amount: Number(row.data?.payable_amount ?? 0),
    paid_amount: Number(row.data?.paid_amount ?? 0),
    remaining_amount: Number(row.data?.remaining_amount ?? 0),
    supplier: {
      id: String(row.data?.supplier?.id ?? row.data?.supplier_id ?? ''),
      code: String(row.data?.supplier?.code ?? ''),
      name: row.data?.supplier?.name,
    },
    supplier_id: row.data?.supplier_id,
  }))

  const rebuilt = rebuildKiotVietCashbookAllocations({
    invoices,
    receipts,
    cashbookRows: cashbookResult.rows.map((row) => ({
      id: String(row.id),
      source_code: String(row.code),
      entry_time: row.created_at.toISOString(),
      direction: row.direction,
      amount_delta: Number(row.amount_delta),
      status: String(row.status),
      counterparty_code: typeof row.source?.counterparty_code === 'string' ? row.source.counterparty_code : null,
      counterparty_name: row.counterparty?.name ?? null,
      category_name: typeof row.source?.category_name === 'string' ? row.source.category_name : null,
    })),
  })

  for (const invoice of rebuilt.invoices) {
    const paymentStatus = invoicePaymentStatus(invoice.paid_amount, invoice.debt_amount)
    await pool.query(
      `
        update orders
        set paid_amount = $3,
            debt_amount = $4,
            payment_status = $5,
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, invoice.id, invoice.paid_amount, invoice.debt_amount, paymentStatus],
    )
    if (invoice.debt_amount > 0) {
      await pool.query(
        `
          insert into customer_debt_entries (
            organization_id, customer_id, order_id, original_amount, paid_amount,
            remaining_debt, status, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, 'open', now(), now())
          on conflict (organization_id, order_id) do update set
            customer_id = excluded.customer_id,
            original_amount = excluded.original_amount,
            paid_amount = excluded.paid_amount,
            remaining_debt = excluded.remaining_debt,
            status = 'open',
            updated_at = now()
        `,
        [organizationId, invoice.customer.id, invoice.id, invoice.total_amount, invoice.paid_amount, invoice.debt_amount],
      )
    } else {
      await pool.query(
        `
          update customer_debt_entries
          set paid_amount = $3,
              remaining_debt = 0,
              status = 'closed',
              updated_at = now()
          where organization_id = $1
            and order_id = $2
        `,
        [organizationId, invoice.id, invoice.paid_amount],
      )
    }
  }

  for (const receipt of rebuilt.receipts) {
    await pool.query(
      `
        update purchase_receipt_snapshots
        set data = jsonb_set(
              jsonb_set(data, '{paid_amount}', to_jsonb($3::numeric), true),
              '{remaining_amount}', to_jsonb($4::numeric), true
            ),
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, receipt.id, receipt.paid_amount, receipt.remaining_amount],
    )
  }

  for (const entry of rebuilt.cashbookAllocations) {
    await pool.query(
      `
        update cashbook_entries
        set allocations = $3::jsonb,
            source = jsonb_set(coalesce(source, '{}'::jsonb), '{order_code}', to_jsonb($4::text), true)
        where organization_id = $1
          and id = $2
      `,
      [organizationId, entry.id, JSON.stringify(entry.allocations), entry.order_code],
    )
  }
}

async function ensureImportedSnapshotTables(pool: pg.Pool) {
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
  await pool.query('create index if not exists customer_snapshots_org_updated_idx on customer_snapshots (organization_id, updated_at desc)')
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
  await pool.query('create index if not exists supplier_snapshots_org_updated_idx on supplier_snapshots (organization_id, updated_at desc)')
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
  await pool.query('create index if not exists purchase_receipt_snapshots_org_updated_idx on purchase_receipt_snapshots (organization_id, updated_at desc)')
}

async function findCustomerGroupSnapshot(pool: pg.Pool, organizationId: string, groupId: string) {
  const result = await pool.query(
    `
      select data->'customer_group' as customer_group
      from customer_snapshots
      where organization_id = $1
        and data->>'customer_group_id' = $2
        and data->'customer_group' is not null
      limit 1
    `,
    [organizationId, groupId],
  )
  const group = result.rows[0]?.customer_group as CustomerListData['customer_group'] | undefined
  return group ?? { id: groupId, code: groupId, name: groupId }
}

function hashText(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 10)
}

async function nextManualCustomerCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^kh[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from customer_snapshots
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `KH${String(nextNumber).padStart(6, '0')}`
}

async function nextManualSupplierCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^ncc[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from supplier_snapshots
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `NCC${String(nextNumber).padStart(6, '0')}`
}

function customerSnapshotMatches(url: URL, customer: CustomerListData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const groupId = url.searchParams.get('customer_group_id')
  const debtMin = optionalFilterNumber(url.searchParams.get('debt_min'))
  const debtMax = optionalFilterNumber(url.searchParams.get('debt_max'))
  if (status && status !== 'all' && (customer.status ?? 'active') !== status) return false
  if (groupId && groupId !== 'all' && customer.customer_group_id !== groupId) return false
  if (debtMin !== undefined && customer.total_debt_amount < debtMin) return false
  if (debtMax !== undefined && customer.total_debt_amount > debtMax) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${customer.code} ${customer.name} ${customer.phone ?? ''} ${customer.tax_code ?? ''} ${customer.address ?? ''} ${customer.note ?? ''}`)
  return haystack.includes(search)
}

function hydrateCustomerLinkedSupplier(customer: CustomerListData, suppliers: SupplierListData[]) {
  const linkedSupplier = suppliers.find((supplier) => supplier.linked_customer_id === customer.id)
    ?? suppliers.find((supplier) => supplierMatchesCustomer(supplier, customer))
    ?? null
  return linkedSupplier
    ? { ...customer, linked_supplier: { id: linkedSupplier.id, code: linkedSupplier.code, name: linkedSupplier.name, linked_at: linkedSupplier.created_at ?? null } }
    : { ...customer, linked_supplier: null }
}

function supplierSnapshotMatches(url: URL, supplier: SupplierListData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const totalPurchaseMin = optionalFilterNumber(url.searchParams.get('total_purchase_min'))
  const totalPurchaseMax = optionalFilterNumber(url.searchParams.get('total_purchase_max'))
  const currentPayableMin = optionalFilterNumber(url.searchParams.get('current_payable_min'))
  const currentPayableMax = optionalFilterNumber(url.searchParams.get('current_payable_max'))
  if (status && status !== 'all' && supplier.status !== status) return false
  if (totalPurchaseMin !== undefined && supplier.total_purchase_amount < totalPurchaseMin) return false
  if (totalPurchaseMax !== undefined && supplier.total_purchase_amount > totalPurchaseMax) return false
  if (currentPayableMin !== undefined && supplier.current_payable_amount < currentPayableMin) return false
  if (currentPayableMax !== undefined && supplier.current_payable_amount > currentPayableMax) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${supplier.code} ${supplier.name} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.tax_code ?? ''} ${supplier.notes ?? ''}`)
  return haystack.includes(search)
}

function supplierMatchesCustomer(supplier: Pick<SupplierListData, 'code' | 'name'>, customer: Pick<CustomerListData, 'code' | 'name'>) {
  return normalizeSearchText(supplier.code) === normalizeSearchText(customer.code)
    || normalizeSearchText(supplier.name) === normalizeSearchText(customer.name)
}

function purchaseReceiptSnapshotMatches(url: URL, receipt: PurchaseReceiptData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const createdBy = url.searchParams.get('created_by')
  const supplierId = url.searchParams.get('supplier_id')
  const supplierCode = normalizeSearchText(url.searchParams.get('supplier_code') ?? '')
  if (status && status !== 'all' && receipt.status !== status) return false
  if (
    (supplierId || supplierCode) &&
    receipt.supplier_id !== supplierId &&
    receipt.supplier.id !== supplierId &&
    normalizeSearchText(receipt.supplier.code) !== supplierCode
  ) return false
  if (!dateRangeMatches(receipt.received_at, dateFrom, dateTo)) return false
  if (createdBy && createdBy !== 'all' && receipt.created_by.id !== createdBy) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${receipt.code} ${receipt.supplier.code} ${receipt.supplier.name} ${receipt.supplier_document_no ?? ''} ${receipt.notes ?? ''}`)
  return haystack.includes(search)
}

function optionalFilterNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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

function productGroupImportCode(name: string) {
  const normalized = name.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  return `KV-${normalized || 'NHOM'}-${stableHash(name)}`
}

function priceListImportCode(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/Ä/g, 'D')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  return `KV-BG-${normalized || 'BANG-GIA'}-${stableHash(name)}`
}

function isDefaultPriceListName(name: string) {
  const normalized = normalizeSearchText(name)
  return normalized === normalizeSearchText('Bảng giá chung') || normalized === normalizeSearchText('Bang gia le')
}

async function upsertPriceListByName(pool: pg.Pool, organizationId: string, name: string) {
  const code = priceListImportCode(name)
  const result = await pool.query(
    `
      insert into price_lists (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, false, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        is_active = true,
        updated_at = now()
      returning id::text
    `,
    [randomUUID(), organizationId, code, name],
  )
  return String(result.rows[0].id)
}

function stableHash(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash.toString(36).toUpperCase().padStart(6, '0')
}

async function referencedProductIds(
  pool: pg.Pool,
  table: (typeof productReferenceGuards)[number]['table'],
  column: (typeof productReferenceGuards)[number]['column'],
  organizationId: string,
  productIds: string[],
  options: { inTransaction?: boolean } = {},
) {
  const sql = `
        select distinct ${column} as product_id
        from ${table}
        where organization_id = $1
          and ${column} = any($2::uuid[])
      `
  try {
    const result = options.inTransaction
      ? await queryWithOptionalRelationSavepoint(pool, `guard_${table}_${column}`, sql, [organizationId, productIds])
      : await pool.query(sql, [organizationId, productIds])
    return result.rows.map((row) => String(row.product_id))
  } catch (error) {
    if (isMissingGuardRelationError(error)) return []
    throw error
  }
}

async function deleteOptionalImportRows(pool: pg.Pool, sql: string, values: unknown[]) {
  try {
    await queryWithOptionalRelationSavepoint(pool, 'delete_optional_import_rows', sql, values)
  } catch (error) {
    if (isMissingGuardRelationError(error)) return
    throw error
  }
}

async function queryWithOptionalRelationSavepoint(pool: pg.Pool, name: string, sql: string, values: unknown[]) {
  const savepoint = `qcvl_optional_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`
  await pool.query(`savepoint ${savepoint}`)
  try {
    const result = await pool.query(sql, values)
    await pool.query(`release savepoint ${savepoint}`)
    return result
  } catch (error) {
    if (isMissingGuardRelationError(error)) {
      await pool.query(`rollback to savepoint ${savepoint}`)
      await pool.query(`release savepoint ${savepoint}`)
    }
    throw error
  }
}

function isMissingGuardRelationError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return code === '42P01' || code === '42703'
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
