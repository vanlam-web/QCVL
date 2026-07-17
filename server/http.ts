import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { displayDateKey, displayDateRangeMatches } from './date-filter.js'
import { HttpError, emptyResponse, failure, success } from './http-response.js'
import { handleAuthRoute, requireCurrentUser } from './modules/auth/auth-routes.js'
import { handleCatalogRoute } from './modules/catalog/catalog-routes.js'
import {
  applyKiotVietCustomerImport,
  mapKiotVietCustomerRows,
  parseKiotVietCustomerWorkbookBuffer,
  previewKiotVietCustomerImport,
  type CustomerImportUpsertRow,
} from './modules/catalog/customer-import.js'
import {
  applyKiotVietProductImport,
  mapKiotVietProductRows,
  parseKiotVietProductWorkbookBuffer,
  previewKiotVietProductImport,
  type ProductImportUpsertRow,
} from './modules/catalog/product-import.js'
import { handleFinanceRoute } from './modules/finance/finance-routes.js'
import {
  applyKiotVietCashbookImport,
  mapKiotVietCashbookRows,
  parseKiotVietCashbookWorkbookBuffer,
  previewKiotVietCashbookImport,
  type CashbookImportRepository,
  type KiotVietCashbookImportRow,
} from './modules/finance/kiotviet-cashbook-import.js'
import { handleInventoryRoute } from './modules/inventory/inventory-routes.js'
import {
  mapKiotVietStocktakeRows,
  previewKiotVietStocktakeImport,
  type KiotVietStocktakeImportRow,
} from './modules/inventory/kiotviet-stocktake-import.js'
import { handleProductionRoute } from './modules/production/production-routes.js'
import {
  applyKiotVietPurchaseReceiptImport,
  mapKiotVietPurchaseReceiptRows,
  parseKiotVietPurchaseReceiptWorkbookBuffer,
  previewKiotVietPurchaseReceiptImport,
  type KiotVietPurchaseReceiptImportRow,
  type PurchaseReceiptImportRepository,
} from './modules/purchase/purchase-receipt-import.js'
import {
  applyKiotVietSupplierImport,
  mapKiotVietSupplierRows,
  parseKiotVietSupplierWorkbookBuffer,
  previewKiotVietSupplierImport,
  type SupplierImportUpsertRow,
} from './modules/purchase/supplier-import.js'
import { handlePurchaseRoute } from './modules/purchase/purchase-routes.js'
import { handleSalesRoute } from './modules/sales/sales-routes.js'
import {
  applyKiotVietInvoiceImport,
  mapKiotVietInvoiceRows,
  parseKiotVietInvoiceWorkbookBuffer,
  previewKiotVietInvoiceImport,
  type InvoiceImportRepository,
  type KiotVietInvoiceImportRow,
} from './modules/sales/kiotviet-invoice-import.js'

export type UserStatus = 'active' | 'inactive'

export interface AuthUserRow {
  id: string
  email: string
  password_hash: string
  organization_id: string
  display_name: string
  status: UserStatus
}

export interface CurrentUserData {
  user: { id: string; email: string; display_name: string }
  profile?: {
    username: string | null
    phone: string | null
    email: string | null
    birthday: string | null
    region: string | null
    ward: string | null
    address: string | null
    note: string | null
  }
  organization: { id: string; code: string; name: string }
  workstation: { id: string; code: string; name: string } | null
  devices?: Array<{
    id: string
    device_name: string
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
    browser_name: string | null
    os_name: string | null
    ip_address: string | null
    last_seen_at: string
    created_at: string
    is_current_device: boolean
    status: 'active' | 'signed_out'
  }>
  permissions: `perm.${string}`[]
}

export interface UserListItemData {
  id: string
  email: string
  username: string | null
  phone: string | null
  birthday: string | null
  region: string | null
  ward: string | null
  address: string | null
  note: string | null
  display_name: string
  status: UserStatus
  permissions: `perm.${string}`[]
}

export interface WorkstationData {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive'
}

export type SalesDocumentData = ReturnType<typeof makeSalesDocument>
export type PurchaseReceiptData = ReturnType<typeof makePurchaseReceipt>
export interface ProductListData {
  id: string
  code: string
  name: string
  status: string
  product_kind: string
  unit_name: string
  sell_method: string
  latest_purchase_cost: number | null
  latest_purchase_cost_at: string | null
  default_sale_price: number | null
  price_list_prices?: Record<string, number>
  product_group_id: string | null
  product_group: { id: string; code: string; name: string } | null
  inventory_shape: string
  track_inventory: boolean
  unit_conversions: unknown[]
  kiotviet_provisional_stock?: {
    quantity: number
    unit_name: string
    source_type: 'kiotviet_import'
    source_label: string | null
    status?: string
    updated_at?: string | null
  } | null
  operating_stock?: {
    quantity: number
    unit_name: string
    source_type: 'stock_movements'
    source_label: string | null
    updated_at?: string | null
  } | null
  latest_kiotviet_stocktake?: {
    code: string
    source_created_at: string | null
    source_balanced_at: string | null
    system_qty: number | null
    actual_qty: number | null
    difference_qty: number | null
    unit_name: string | null
  } | null
  draft_bom?: {
    id: string
    version: number
    status: 'draft'
    item_count: number
    notes: string | null
  } | null
  created_at: string
  updated_at: string
}

export interface ProductGroupListData {
  id: string
  code: string
  name: string
  is_default: boolean
  is_active: boolean
}

export interface CustomerListData {
  id: string
  code: string
  name: string
  phone: string | null
  tax_code: string | null
  address: string | null
  customer_group_id: string | null
  customer_group: { id: string; code: string; name: string } | null
  created_by?: { id: string; name: string } | null
  created_at: string
  total_sales_amount: number
  total_debt_amount: number
  customer_type?: string | null
  company_name?: string | null
  area_name?: string | null
  ward_name?: string | null
  note?: string | null
  source_creator_name?: string | null
  last_transaction_at?: string | null
  kiotviet_net_sales?: number | null
  status?: string | null
  linked_supplier?: { id: string; code: string; name: string; linked_at?: string | null } | null
}
export interface SupplierListData {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  tax_code: string | null
  linked_customer_id: string | null
  linked_customer: { id: string; code: string; name: string } | null
  notes: string | null
  status: string
  current_payable_amount: number
  total_purchase_amount: number
  created_at?: string
  source_creator_name?: string | null
  source_created_at?: string | null
  company_name?: string | null
}
export interface FinanceAccountData {
  id: string
  code: string
  name: string
  account_type: 'cash' | 'bank'
  is_default_cash: boolean
  is_active: boolean
  account_number?: string | null
  account_holder?: string | null
  opening_balance?: number
  note?: string | null
  notify_on_transaction?: boolean
}
export type CashbookEntryData = Omit<ReturnType<typeof makeCashbookEntry>, 'finance_account'> & {
  finance_account: {
    id: string
    code: string
    name: string
    account_type: 'cash' | 'bank'
    account_number?: string | null
    account_holder?: string | null
  }
  created_by?: { id: string; name: string } | null
  source?: {
    type: string
    id: string
    code: string
    order_code: string | null
    category_name?: string | null
    source_creator_name?: string | null
    source_created_at?: string | null
    source_note?: string | null
    transfer_content?: string | null
    counterparty_code?: string | null
    counterparty_address?: string | null
  }
  allocations?: Array<{
    order_id: string
    order_code: string
    order_total_amount: number
    collected_before: number
    allocated_amount: number
    remaining_after: number
  }>
  payment_method?: string
}
export type CustomerDebtSummaryData = CustomerDebtItem
export type CustomerDebtDetailData = ReturnType<typeof makeCustomerDebtDetail>
export interface StocktakeListData {
  id: string
  code: string
  status: string
  source_type: string
  created_at: string
  balanced_at: string | null
  source_creator_name?: string | null
  created_by: { id: string; name: string } | null
  total_actual_qty: number
  total_actual_value: number | null
  total_difference_value: number | null
  increased_qty: number
  decreased_qty: number
  product_code?: string | null
  product_name?: string | null
  product_system_qty?: number | null
  product_actual_qty?: number | null
  product_difference_qty?: number | null
  note: string | null
}

export interface StocktakeDetailItemData {
  id: string
  line_no: number
  product_id: string | null
  product_code: string
  product_name: string
  unit_name: string | null
  system_qty: number | null
  actual_qty: number | null
  difference_qty: number | null
  line_actual_value: number | null
  line_difference_value: number | null
  note: string | null
}

export interface StocktakeDetailData extends StocktakeListData {
  items: StocktakeDetailItemData[]
}

export interface StockMovementData {
  id: string
  product_id: string
  movement_type: string
  quantity_delta: number
  created_at: string
  document_code: string | null
  document_type: 'sale_invoice' | 'purchase_receipt' | 'stocktake' | 'manual' | 'material_opening' | null
  transaction_price: number | null
  cost_price: number | null
  ending_qty: number | null
  partner_name: string | null
}

export interface ServerRepository {
  findUserByEmail(email: string): Promise<AuthUserRow | null>
  findUserByLogin?(login: string): Promise<AuthUserRow | null>
  listUsers?(input: { organizationId: string; url: URL }): Promise<UserListItemData[]>
  createUser?(input: {
    organizationId: string
    email: string
    username: string | null
    phone: string | null
    birthday: string | null
    region: string | null
    ward: string | null
    address: string | null
    note: string | null
    passwordHash: string
    displayName: string
    permissions: `perm.${string}`[]
  }): Promise<UserListItemData>
  updateUser?(input: {
    organizationId: string
    id: string
    email?: string | null
    username?: string | null
    phone?: string | null
    birthday?: string | null
    region?: string | null
    ward?: string | null
    address?: string | null
    note?: string | null
    passwordHash?: string
    displayName?: string
    status?: UserStatus
  }): Promise<UserListItemData | null>
  replaceUserPermissions?(input: {
    organizationId: string
    id: string
    permissions: `perm.${string}`[]
  }): Promise<UserListItemData | null>
  createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>
  deleteSession(token: string): Promise<void>
  getSessionUser(token: string, workstationId?: string | null): Promise<CurrentUserData | null>
  listWorkstations(organizationId: string): Promise<WorkstationData[]>
  getPosProductUsageCounts?(organizationId: string): Promise<Map<string, number>>
  recordPosProductUsage?(input: { organizationId: string; productIds: string[] }): Promise<void>
  listProducts?(input: { organizationId: string; url: URL }): Promise<ProductListData[]>
  listProductGroups?(input: { organizationId: string }): Promise<ProductGroupListData[]>
  updateProductGroup?(input: { organizationId: string; id: string; name: string }): Promise<ProductGroupListData | null>
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findDefaultPriceList?(input: { organizationId: string }): Promise<{ id: string; name: string } | null>
  listPriceLists?(input: { organizationId: string }): Promise<Array<{ id: string; code: string; name: string; is_default: boolean; is_active: boolean }>>
  resolvePrices?(input: {
    organizationId: string
    productIds: string[]
    customerId: string | null
  }): Promise<Array<{
    product_id: string
    unit_price: number
    price_source: 'default_price_list' | 'customer_group_price_list' | 'fallback_default_price_list'
    price_list_id: string
  }>>
  listCustomers?(input: { organizationId: string; url: URL }): Promise<CustomerListData[]>
  findCustomerByCode?(input: { organizationId: string; code: string }): Promise<CustomerListData | null>
  findCustomersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  listSuppliers?(input: { organizationId: string; url: URL }): Promise<SupplierListData[]>
  updateSupplier?(input: {
    organizationId: string
    id: string
    patch: {
      code?: string
      name?: string
      phone?: string | null
      email?: string | null
      address?: string | null
      tax_code?: string | null
      linked_customer_id?: string | null
      notes?: string | null
      status?: string
    }
  }): Promise<SupplierListData | null>
  listFinanceAccounts?(input: { organizationId: string; url: URL }): Promise<FinanceAccountData[]>
  createFinanceAccount?(input: { organizationId: string; account: Omit<FinanceAccountData, 'id'> & { id?: string } }): Promise<FinanceAccountData>
  updateFinanceAccount?(input: { organizationId: string; id: string; patch: Partial<FinanceAccountData> }): Promise<FinanceAccountData | null>
  findSuppliersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteDemoStocktakesForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteImportedKiotVietProducts?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteImportedKiotVietCustomers?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteImportedKiotVietSuppliers?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteImportedKiotVietStocktakes?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  deleteImportedKiotVietPurchaseReceipts?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  listPurchaseReceipts?(input: { organizationId: string; url: URL }): Promise<PurchaseReceiptData[]>
  getPurchaseReceipt?(input: { organizationId: string; id: string }): Promise<PurchaseReceiptData | null>
  findPurchaseReceiptsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  listStockMovements?(input: { organizationId: string; url: URL }): Promise<StockMovementData[]>
  upsertImportedKiotVietPurchaseReceipts?(input: {
    organizationId: string
    rows: KiotVietPurchaseReceiptImportRow[]
  }): Promise<{
    receipts_created: number
    receipts_updated: number
    items_created: number
    items_updated: number
    skipped_rows: number
  }>
  upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
  upsertCustomerGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertCustomersByCode?(input: { organizationId: string; rows: CustomerImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
  upsertSuppliersByCode?(input: { organizationId: string; rows: SupplierImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
  upsertDefaultPriceListItems?(input: {
    organizationId: string
    priceListId: string
    rows: Array<{ product_code: string; unit_price: number }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertPriceListItemsByName?(input: {
    organizationId: string
    defaultPriceListId: string | null
    rows: Array<{ product_code: string; price_list_name: string; unit_price: number }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertProvisionalStockBalances?(input: {
    organizationId: string
    rows: Array<{ product_code: string; quantity: number; unit_name: string; source_label: string }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertDraftProductBoms?(input: {
    organizationId: string
    rows: Array<{
      product_code: string
      source_text: string
      components: Array<{ component_code: string; quantity: number }>
      note: string
    }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertImportedKiotVietStocktakes?(input: {
    organizationId: string
    createdBy: { id: string; name: string } | null
    rows: KiotVietStocktakeImportRow[]
  }): Promise<{
    stocktakes_created: number
    stocktakes_updated: number
    items_created: number
    items_updated: number
    missing_product_rows: number
  }>
  listStocktakes?(input: { organizationId: string; url: URL }): Promise<StocktakeListData[]>
  getStocktake?(input: { organizationId: string; id: string }): Promise<StocktakeDetailData | null>
  updateStocktakeNote?(input: { organizationId: string; id: string; note: string | null }): Promise<StocktakeDetailData | null>
  cancelStocktake?(input: { organizationId: string; id: string }): Promise<StocktakeDetailData | null>
  adjustNormalProductStock?(input: {
    organizationId: string
    productId: string
    actualQty: number
    reason: string
    createdBy: { id: string; name: string }
  }): Promise<StocktakeDetailData | null>
  createMaterialOpening?(input: {
    organizationId: string
    input: {
      product_id: string
      inventory_shape: 'normal' | 'roll' | 'sheet'
      opened_unit_id?: string
      opened_qty?: number
      old_remaining_qty?: number
      old_inventory_roll_id?: string
      old_remaining_length_m?: number
      old_inventory_sheet_id?: string
      old_remaining_width_m?: number
      discard_old_sheet?: boolean
      note?: string
    }
  }): Promise<{
    id: string
    product_id: string
    inventory_shape: 'normal' | 'roll' | 'sheet'
    source_type: 'manual_normal' | 'standard_object' | 'kiotviet_provisional'
    opened_unit_id: string | null
    opened_qty: number | null
    opened_stock_qty: number | null
    stock_movement_id: string | null
    warnings: string[]
    created_at: string
  }>
  saveSalesDocument?(input: {
    organizationId: string
    document: SalesDocumentData
    cashbookEntries: CashbookEntryData[]
  }): Promise<void>
  listSalesDocuments?(input: { organizationId: string; url: URL }): Promise<SalesDocumentData[]>
  getSalesDocument?(input: { organizationId: string; id: string }): Promise<SalesDocumentData | null>
  cancelSalesDocument?(input: { organizationId: string; id: string }): Promise<SalesDocumentData | null>
  updateSalesDocumentNote?(input: { organizationId: string; id: string; note: string | null }): Promise<SalesDocumentData | null>
  findSalesDocumentsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  deleteImportedKiotVietInvoices?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  upsertImportedKiotVietInvoices?(input: {
    organizationId: string
    rows: KiotVietInvoiceImportRow[]
  }): Promise<{
    invoices_created: number
    invoices_updated: number
    items_created: number
    items_updated: number
    skipped_rows: number
  }>
  deleteImportedKiotVietCashbook?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  upsertImportedKiotVietCashbook?(input: {
    organizationId: string
    rows: KiotVietCashbookImportRow[]
  }): Promise<{
    accounts_created: number
    accounts_updated: number
    entries_created: number
    entries_updated: number
    skipped_rows: number
  }>
  listCustomerDebts?(input: { organizationId: string; url: URL }): Promise<CustomerDebtSummaryData[]>
  getCustomerDebt?(input: { organizationId: string; customerId: string }): Promise<CustomerDebtDetailData>
  collectCustomerDebt?(input: {
    organizationId: string
    customerId: string
    amount: number
    cashAmount: number
    bankAmount: number
    bankAccountId?: string | null
    bankTransactionRef?: string
    note?: string
  }): Promise<{ payment_receipt_id: string; allocated_amount: number }>
  listCashbookEntries?(input: { organizationId: string; url: URL }): Promise<CashbookEntryData[]>
  getCashbookEntry?(input: { organizationId: string; id: string }): Promise<CashbookEntryData | null>
  getCustomerFinancialTotals?(organizationId: string): Promise<Map<string, { total_sales_amount: number; total_debt_amount: number; last_activity_at?: string }>>
  ensureSalesFinanceSeed?(input: {
    organizationId: string
    documents: SalesDocumentData[]
    cashbookEntries: CashbookEntryData[]
  }): Promise<void>
}

export interface HttpHandlerOptions {
  repository: ServerRepository
  persistence?: 'postgres' | 'memory'
  version?: string
}

export type HttpHandler = (request: Request) => Promise<Response>

type PermissionCode = `perm.${string}`

const allPermissions = [
  { code: 'perm.access_admin_panel', module: 'admin', description: 'Access admin panel' },
  { code: 'perm.apply_discount', module: 'pos', description: 'Apply order discounts' },
  { code: 'perm.create_order', module: 'pos', description: 'Create POS orders' },
  { code: 'perm.edit_order_locked', module: 'sales', description: 'Edit locked orders' },
  { code: 'perm.edit_price_book', module: 'catalog', description: 'Edit price books' },
  { code: 'perm.manage_finance', module: 'finance', description: 'Manage finance' },
  { code: 'perm.manage_inventory', module: 'inventory', description: 'Manage inventory' },
  { code: 'perm.manage_users', module: 'admin', description: 'Manage users and permissions' },
  { code: 'perm.refund_order', module: 'sales', description: 'Refund orders' },
  { code: 'perm.view_shift_report', module: 'pos', description: 'View shift reports' },
] satisfies Array<{ code: PermissionCode; module: string; description: string }>

const nowIso = '2026-07-08T08:30:00.000Z'

function runtimeIso() {
  return new Date().toISOString()
}

const productGroups = [
  { id: 'pg-mica', code: 'MICA', name: 'Mica', is_default: true, is_active: true },
  { id: 'pg-service', code: 'DV', name: 'Dich vu', is_default: false, is_active: true },
]

const products = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1
  const code = number === 1 ? 'MICA-3MM' : number === 2 ? 'DECAL-PP' : number === 3 ? 'CUT-CNC' : `DEV20-SP-${pad(number)}`
  const name =
    number === 1
      ? 'Mica trong 3mm'
      : number === 2
        ? 'Decal PP'
        : number === 3
          ? 'Cat CNC'
          : `San pham demo ${pad(number)}`
  const isCombo = number % 7 === 0
  const isAuxiliary = number % 6 === 0
  const isService = number === 3 || number % 5 === 0
  const isRoll = number === 2 || number % 4 === 0
  const inventoryShape = isService || isCombo || isAuxiliary ? 'normal' : isRoll ? 'roll' : number % 3 === 0 ? 'sheet' : 'normal'
  const productKind = isCombo ? 'combo' : isAuxiliary ? 'auxiliary_material' : isService ? 'service' : isRoll ? 'roll' : 'goods'
  return {
    id: `product-${pad(number)}`,
    code,
    name,
    status: 'active',
    product_kind: productKind,
    unit_name: isService ? 'lan' : isRoll ? 'm2' : 'tam',
    sell_method: isService ? 'quantity' : isRoll ? 'area_m2' : 'sheet',
    latest_purchase_cost: isService ? null : 150000 + number * 10000,
    latest_purchase_cost_at: isService ? null : nowIso,
    default_sale_price: isService ? null : 300000 + number * 25000,
    product_group_id: isService ? 'pg-service' : 'pg-mica',
    product_group: isService ? { id: 'pg-service', code: 'DV', name: 'Dich vu' } : { id: 'pg-mica', code: 'MICA', name: 'Mica' },
    inventory_shape: inventoryShape,
    track_inventory: !isService,
    unit_conversions: [],
    created_at: nowIso,
    updated_at: nowIso,
  }
})

const priceLists = [
  { id: 'pl-default', code: 'BG-LE', name: 'Bang gia le', is_default: true, is_active: true },
  { id: 'pl-vip', code: 'BG-SI', name: 'Bang gia si', is_default: false, is_active: true },
]

const customerGroups = [
  { id: 'cg-retail', code: 'LE', name: 'Khach le', price_list_id: 'pl-default', is_active: true },
  { id: 'cg-vip', code: 'SI', name: 'Khach si', price_list_id: 'pl-vip', is_active: true },
]

const customers: CustomerListData[] = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1
  const isRetail = number === 1
  const vip = number % 4 === 0
  return {
    id: isRetail ? 'customer-retail' : `customer-${pad(number)}`,
    code: isRetail ? 'khachle' : `DEV20-KH-${pad(number)}`,
    name: isRetail ? 'Khách lẻ' : `Khach demo ${pad(number)}`,
    phone: isRetail ? null : `090${String(8000000 + number).padStart(7, '0')}`,
    tax_code: isRetail ? null : `03123456${String(number).padStart(2, '0')}`,
    address: isRetail ? null : `Dia chi demo ${number}, TP.HCM`,
    customer_group_id: vip ? 'cg-vip' : 'cg-retail',
    customer_group: vip ? { id: 'cg-vip', code: 'SI', name: 'Khach si' } : { id: 'cg-retail', code: 'LE', name: 'Khach le' },
    created_by: { id: 'admin', name: 'Admin' },
    created_at: nowIso,
    total_sales_amount: isRetail ? 0 : 600000 + number * 175000,
    total_debt_amount: isRetail ? 0 : number % 3 === 0 ? 0 : 100000 + number * 25000,
  }
})

function defaultRetailCustomer() {
  return customers.find((customer) => customer.code.trim().toLowerCase() === 'khachle') ?? customers[0]
}

async function resolveSalesCustomer(repository: ServerRepository, organizationId: string, customerId: string | undefined) {
  const localCustomer = customerId ? customers.find((item) => item.id === customerId) : undefined
  if (localCustomer) return localCustomer

  if (repository.listCustomers) {
    const allCustomers = await repository.listCustomers({
      organizationId,
      url: new URL('http://api.local/api/v1/customers'),
    })
    const selectedCustomer = customerId ? allCustomers.find((item) => item.id === customerId) : undefined
    if (selectedCustomer) return selectedCustomer
    const defaultCustomer = allCustomers.find((item) => item.code.trim().toLowerCase() === 'khachle')
    if (defaultCustomer) return defaultCustomer
  }

  if (!customerId && repository.findCustomerByCode) {
    const defaultCustomer = await repository.findCustomerByCode({ organizationId, code: 'khachle' })
    if (defaultCustomer) return defaultCustomer
  }

  return defaultRetailCustomer()
}

const financeAccounts: FinanceAccountData[] = [
  {
    id: 'cash-main',
    code: 'TM',
    name: 'Tien mat',
    account_type: 'cash',
    is_default_cash: true,
    is_active: true,
    opening_balance: 5000000,
    note: null,
    notify_on_transaction: false,
  },
  {
    id: 'bank-main',
    code: 'VCB',
    name: 'Vietcombank',
    account_type: 'bank',
    is_default_cash: false,
    is_active: true,
    account_number: '0000000000',
    account_holder: 'VAN LAM',
    opening_balance: 15000000,
    note: null,
    notify_on_transaction: true,
  },
]

const suppliers: SupplierListData[] = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1
  return {
    id: `supplier-${pad(number)}`,
    code: `DEV20-NCC-${pad(number)}`,
    name: `Nha cung cap demo ${pad(number)}`,
    phone: `091${String(7000000 + number).padStart(7, '0')}`,
    email: number % 2 === 0 ? `ncc${pad(number)}@demo.local` : null,
    address: `Dia chi NCC demo ${number}, TP.HCM`,
    tax_code: number % 3 === 0 ? null : `03000000${String(number).padStart(2, '0')}`,
    linked_customer_id: null,
    linked_customer: null,
    notes: null,
    status: 'active',
    current_payable_amount: number % 4 === 0 ? 0 : 500000 + number * 50000,
    total_purchase_amount: 2000000 + number * 400000,
    created_at: nowIso,
    source_creator_name: null,
    source_created_at: null,
    company_name: null,
  }
})

const purchaseReceipts = Array.from({ length: 20 }, (_, index) => makePurchaseReceipt(index + 1))
syncSupplierTotalsFromPurchaseReceipts()
const purchaseReceipt = purchaseReceipts[0]

const salesDocuments = Array.from({ length: 20 }, (_, index) => makeSalesDocument(index + 1))

const inventoryProducts = products.map((product, index) => ({
  product_id: product.id,
  code: product.code,
  name: product.name,
  status: product.status,
  inventory_shape: product.inventory_shape,
  stock_unit: product.unit_name,
  available_qty: product.track_inventory ? 10 + index * 3.5 : 0,
  is_negative: false,
}))

const stockMovements: StockMovementData[] = products.flatMap((product) => (
  Array.from({ length: 20 }, (_, index) => {
    const number = index + 1
    const movementType = number % 5 === 0 ? 'stocktake_adjustment' : number % 2 === 0 ? 'sale' : 'purchase'
    const document = movementType === 'purchase'
      ? purchaseReceipts[(number - 1) % purchaseReceipts.length]
      : movementType === 'sale'
        ? salesDocuments.find((item) => item.order_type === 'invoice') ?? salesDocuments[0]
        : makeStocktake()
    return {
      id: `sm-${product.id}-${pad(number)}`,
      product_id: product.id,
      movement_type: movementType,
      quantity_delta: movementType === 'purchase' ? 4 + number : movementType === 'sale' ? -((number % 4) + 1) : number % 2 === 0 ? 2 : -1,
      created_at: nowIso,
      document_code: document.code,
      document_type: movementType === 'purchase' ? 'purchase_receipt' : movementType === 'sale' ? 'sale_invoice' : 'stocktake',
      transaction_price: movementType === 'sale' ? 600000 : null,
      cost_price: product.latest_purchase_cost,
      ending_qty: 10 + number,
      partner_name: movementType === 'purchase'
        ? purchaseReceipts[(number - 1) % purchaseReceipts.length].supplier.name
        : movementType === 'sale'
          ? 'Khách lẻ'
          : 'Kiểm kho',
    }
  })
))

const cashbookEntries = Array.from({ length: 20 }, (_, index) => makeCashbookEntry(index + 1))
const customerDebtItems = buildCustomerDebtItems()
const salesFinanceSeededOrganizations = new Set<string>()

const productionQueueItems = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1
  const product = products[index % products.length]
  const customer = customers[(index % (customers.length - 1)) + 1] ?? customers[0]
  return {
    id: `pq-${pad(number)}`,
    production_machine: {
      id: number % 3 === 0 ? 'machine-cnc' : number % 2 === 0 ? 'machine-decal' : 'machine-bat',
      code: number % 3 === 0 ? 'CNC-01' : number % 2 === 0 ? 'DECAL-01' : 'BAT-01',
      name: number % 3 === 0 ? 'May CNC 01' : number % 2 === 0 ? 'May in decal 01' : 'May in bat 01',
    },
    raw_file_name: `${customer.code}_${product.code}_120x60_x${(number % 3) + 1}.cdr`,
    received_at: nowIso,
    status: 'queued',
    parse_status: 'ok',
    parse_error: null,
    parsed: { customer_code: customer.code, width_m: 1.2, height_m: 0.6 },
  }
})

function pad(value: number) {
  return String(value).padStart(3, '0')
}

function makePurchaseReceipt(number: number) {
  const supplier = suppliers[(number - 1) % suppliers.length]
  const product = products[(number - 1) % products.length]
  const quantity = (number % 4) + 1
  const unitCost = product.latest_purchase_cost ?? 120000
  const lineAmount = quantity * unitCost
  const paidAmount = number % 3 === 0 ? lineAmount : Math.floor(lineAmount / 2)
  return {
    id: `pr-${pad(number)}`,
    code: `DEV20-PN-${pad(number)}`,
    supplier_id: supplier.id,
    supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
    received_at: nowIso,
    status: number % 5 === 0 ? 'draft' : 'posted',
    supplier_document_no: `HD-NCC-${pad(number)}`,
    subtotal_amount: lineAmount,
    discount_amount: 0,
    payable_amount: lineAmount,
    paid_amount: paidAmount,
    remaining_amount: Math.max(lineAmount - paidAmount, 0),
    notes: null,
    created_by: { id: 'user-dev-admin', name: 'Admin' },
    created_at: nowIso,
    updated_at: nowIso,
    items: [
      {
        id: `pr-item-${pad(number)}`,
        product_id: product.id,
        product: { id: product.id, code: product.code, name: product.name },
        line_no: 1,
        inventory_shape: product.inventory_shape,
        unit_name_snapshot: product.unit_name,
        quantity,
        unit_cost: unitCost,
        discount_amount: 0,
        line_amount: lineAmount,
        physical_payload: null,
      },
    ],
    supplier_payments: [],
  }
}

function syncSupplierTotalsFromPurchaseReceipts() {
  suppliers.forEach((supplier) => {
    supplier.total_purchase_amount = 0
    supplier.current_payable_amount = 0
  })

  for (const receipt of purchaseReceipts) {
    if (receipt.status === 'cancelled') continue
    const supplier = suppliers.find((item) => item.id === receipt.supplier_id)
    if (!supplier) continue
    supplier.total_purchase_amount += receipt.payable_amount
    supplier.current_payable_amount += receipt.remaining_amount
  }
}

function makeSalesDocument(number: number) {
  const customer = customers[(number - 1) % Math.min(customers.length, 5)] ?? customers[0]
  const product = products[(number - 1) % products.length] ?? products[0]
  const isQuote = number % 2 === 0
  const subtotal = 500000 + number * 75000
  const discount = number % 4 === 0 ? 50000 : 0
  const total = subtotal - discount
  const paid = isQuote ? 0 : number % 3 === 0 ? total : Math.floor(total / 2)
  const debtAmount = Math.max(total - paid, 0)
  return {
    id: `order-${pad(number)}`,
    code: `DEV20-${isQuote ? 'BG' : 'HD'}-${pad(number)}`,
    order_type: isQuote ? 'quote' : 'invoice',
    status: isQuote ? (number % 4 === 0 ? 'converted' : 'active') : 'completed',
    created_at: nowIso,
    customer: { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone },
    seller: { id: 'admin', name: 'Admin' },
    subtotal_amount: subtotal,
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    debt_amount: isQuote ? 0 : debtAmount,
    payment_status: isQuote ? 'not_applicable' : debtAmount > 0 ? 'partial' : 'paid',
    note: `Don demo ${pad(number)}`,
    items: [{ product_id: product.id }],
  }
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function productGroupCode(name: string) {
  return normalizeSearchText(name)
    .replace(/\s*>>\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase() || 'GROUP'
}

function normalizeCreatorIdentity(value: string | null | undefined) {
  return normalizeSearchText(String(value ?? '').replace(/\{DEL\}$/i, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveCreatorByUsername(sourceCreatorName: string | null | undefined, users: UserListItemData[]) {
  if (!sourceCreatorName?.trim()) return null
  const normalized = normalizeCreatorIdentity(sourceCreatorName)
  const matches = users.filter((user) => normalizeCreatorIdentity(user.username) === normalized)
  if (matches.length !== 1) return null
  return { id: matches[0].id, name: matches[0].display_name }
}

function resolveCustomerCreator(sourceCreatorName: string | null | undefined, users: UserListItemData[]) {
  if (!sourceCreatorName?.trim()) return null
  const usernameMatch = resolveCreatorByUsername(sourceCreatorName, users)
  if (usernameMatch) return usernameMatch
  const normalized = normalizeCreatorIdentity(sourceCreatorName)
  const exactDisplayMatches = users.filter((user) => normalizeCreatorIdentity(user.display_name) === normalized)
  if (exactDisplayMatches.length === 1) return { id: exactDisplayMatches[0].id, name: exactDisplayMatches[0].display_name }
  const sourceTokens = new Set(normalized.split(' ').filter(Boolean))
  const tokenMatches = users.filter((user) => {
    const displayTokens = normalizeCreatorIdentity(user.display_name).split(' ').filter(Boolean)
    return displayTokens.length > 0 && displayTokens.every((token) => sourceTokens.has(token))
  })
  if (tokenMatches.length !== 1) return null
  return { id: tokenMatches[0].id, name: tokenMatches[0].display_name }
}

function resolveCustomerCreatedBy(
  customer: { created_by?: { id: string; name: string } | null; source_creator_name?: string | null },
  users: UserListItemData[],
) {
  if (customer.created_by) {
    const user = users.find((item) => item.id === customer.created_by?.id)
    return user ? { id: user.id, name: user.display_name } : customer.created_by
  }
  return resolveCustomerCreator(customer.source_creator_name, users)
}

function optionalNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface Timestamped {
  last_activity_at?: unknown
  updated_at?: unknown
  posted_at?: unknown
  balanced_at?: unknown
  received_at?: unknown
  created_at?: unknown
}

function latestTimestamp(item: Timestamped) {
  const value = item.last_activity_at ?? item.updated_at ?? item.posted_at ?? item.balanced_at ?? item.received_at ?? item.created_at
  return typeof value === 'string' ? Date.parse(value) || 0 : 0
}

function newestFirst<T>(items: readonly T[]) {
  return [...items].sort((left, right) => latestTimestamp(right as Timestamped) - latestTimestamp(left as Timestamped))
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

function filterSalesDocuments(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const type = filterValues(url, 'type')
  const status = filterValues(url, 'status')
  const customerId = url.searchParams.get('customer_id')
  const paymentStatus = filterValues(url, 'payment_status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const filtered = salesDocuments.filter((document) => {
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
  })
  return newestFirst(filtered)
}

async function listProductsForRequest(url: URL, repository: ServerRepository, organizationId: string) {
  const filtered: ProductListData[] = await repository.listProducts?.({ organizationId, url }) ?? filterProducts(url) as ProductListData[]
  if (url.searchParams.get('sort') !== 'pos_usage') return newestProductsFirst(filtered)

  const persistedUsage = await repository.getPosProductUsageCounts?.(organizationId)
  return sortProductsByUsage(filtered, persistedUsage ?? productUsageCounts())
}

async function countAllProductsForRequest(url: URL, repository: ServerRepository, organizationId: string) {
  const filteredProducts: ProductListData[] = await repository.listProducts?.({ organizationId, url }) ?? filterProducts(url) as ProductListData[]
  return filteredProducts.reduce((total, product) => total + 1 + (product.unit_conversions?.length ?? 0), 0)
}

function filterProducts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const status = url.searchParams.get('status')
  const sellMethod = url.searchParams.get('sell_method')
  const inventoryShape = url.searchParams.get('inventory_shape')
  const productKind = url.searchParams.get('product_kind')
  const productGroupIds = url.searchParams.getAll('product_group_id')
  const createdFrom = url.searchParams.get('created_from')
  const createdTo = url.searchParams.get('created_to')

  return products.filter((product) => {
    if (status === 'deleted') {
      if (!/\{DEL\}/i.test(product.code)) return false
    } else if (status && status !== 'all') {
      if (product.status !== status || /\{DEL\}/i.test(product.code)) return false
    }
    if (sellMethod && product.sell_method !== sellMethod) return false
    if (inventoryShape && product.inventory_shape !== inventoryShape) return false
    if (productKind && product.product_kind !== productKind) return false
    if (productGroupIds.length > 0 && !productGroupIds.includes(product.product_group_id ?? '')) return false
    if (!dateRangeMatches(product.created_at ?? '', createdFrom, createdTo)) return false
    if (search) {
      const haystack = normalizeSearchText(`${product.code} ${product.name}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

function newestProductsFirst<T extends { created_at?: string | null; code?: string }>(items: readonly T[]) {
  return [...items].sort((left, right) => {
    const compared = Date.parse(right.created_at ?? '') - Date.parse(left.created_at ?? '')
    return compared === 0 ? String(left.code ?? '').localeCompare(String(right.code ?? ''), 'vi', { numeric: true, sensitivity: 'base' }) : compared
  })
}

function sortProductsByUsage<T extends { id: string }>(filtered: T[], usageByProductId: Map<string, number>) {
  return [...filtered].sort((left, right) => {
    const usageDelta = (usageByProductId.get(right.id) ?? 0) - (usageByProductId.get(left.id) ?? 0)
    if (usageDelta !== 0) return usageDelta
    return products.findIndex((product) => product.id === left.id) - products.findIndex((product) => product.id === right.id)
  })
}

function productUsageCounts() {
  const usageByProductId = new Map<string, number>()
  for (const document of salesDocuments) {
    if (document.order_type !== 'invoice' && document.order_type !== 'quote') continue
    for (const item of document.items ?? []) {
      if (!item.product_id) continue
      usageByProductId.set(item.product_id, (usageByProductId.get(item.product_id) ?? 0) + 1)
    }
  }
  return usageByProductId
}

function checkoutProductIds(body: Parameters<typeof makeOrderFromCheckout>[0]) {
  return (body.items ?? [])
    .map((item) => item.product_id)
    .filter((productId): productId is string => typeof productId === 'string' && productId.trim() !== '')
}

function salesDocumentCodePrefix(orderType: 'invoice' | 'quote') {
  return orderType === 'quote' ? 'BG' : 'HD'
}

async function nextSalesDocumentCode(
  repository: ServerRepository,
  organizationId: string,
  orderType: 'invoice' | 'quote',
) {
  const prefix = salesDocumentCodePrefix(orderType)
  const documents = repository.listSalesDocuments
    ? await repository.listSalesDocuments({
        organizationId,
        url: new URL(`http://api.local/api/v1/sales-documents?type=${orderType}&page=1&page_size=100000`),
      })
    : salesDocuments.filter((document) => document.order_type === orderType)
  const nextNumber = documents.reduce((max, document) => {
    const match = new RegExp(`^${prefix}(\\d{6})(?:\\.\\d+)?$`).exec(document.code)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 0) + 1
  return `${prefix}${String(nextNumber).padStart(6, '0')}`
}

function checkoutPaymentStatus(orderType: 'invoice' | 'quote', paidAmount: number, debtAmount: number) {
  if (orderType === 'quote') return 'not_applicable'
  if (debtAmount <= 0) return 'paid'
  if (paidAmount <= 0) return 'unpaid'
  return 'partial'
}

function invoicePaymentStatus(paidAmount: number, debtAmount: number) {
  if (debtAmount <= 0) return 'paid'
  if (paidAmount <= 0) return 'unpaid'
  return 'partial'
}

type DebtInvoiceDocument = {
  id: string
  code: string
  order_type: string
  status: string
  created_at: string
  customer: { id: string; code: string; name: string }
  total_amount: number
  paid_amount: number
  debt_amount: number
}

type CustomerDebtItem = {
  customer_id: string
  customer_code: string
  customer_name: string
  total_debt: number
  oldest_order_code: string
  open_invoice_count: number
  invoices: Array<{
    order_id: string
    order_code: string
    created_at: string
    total_amount: number
    paid_amount: number
    debt_amount: number
    remaining_debt: number
  }>
}

function buildCustomerDebtItems() {
  customers.forEach((customer) => {
    customer.total_debt_amount = 0
    customer.total_sales_amount = 0
  })

  const debts: CustomerDebtItem[] = []

  for (const document of salesDocuments) {
    if (document.order_type !== 'invoice' || document.status === 'cancelled') continue
    const customer = customers.find((item) => item.id === document.customer.id)
    if (customer) customer.total_sales_amount += document.total_amount
    if (document.debt_amount <= 0) continue
    addCustomerDebtDocument(debts, document)
  }

  return debts
}

function addCustomerDebtDocument(debts: CustomerDebtItem[], document: DebtInvoiceDocument) {
  const customer = customers.find((item) => item.id === document.customer.id)
  if (customer) customer.total_debt_amount += document.debt_amount

  const invoice = {
    order_id: document.id,
    order_code: document.code,
    created_at: document.created_at,
    total_amount: document.total_amount,
    paid_amount: document.paid_amount,
    debt_amount: document.debt_amount,
    remaining_debt: document.debt_amount,
  }
  const debt = debts.find((item) => item.customer_id === document.customer.id)
  if (debt) {
    debt.total_debt += document.debt_amount
    debt.open_invoice_count += 1
    debt.invoices.unshift(invoice)
    if (document.created_at < debt.invoices[debt.invoices.length - 1].created_at) debt.oldest_order_code = document.code
    return
  }

  debts.unshift({
    customer_id: document.customer.id,
    customer_code: document.customer.code,
    customer_name: document.customer.name,
    total_debt: document.debt_amount,
    oldest_order_code: document.code,
    open_invoice_count: 1,
    invoices: [invoice],
  })
}

function filterCustomers(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const customerGroupId = url.searchParams.get('customer_group_id')
  const status = url.searchParams.get('status')
  const createdFrom = url.searchParams.get('created_from')
  const createdTo = url.searchParams.get('created_to')

  return customers.filter((customer) => {
    if (customerGroupId && customerGroupId !== 'all' && customer.customer_group_id !== customerGroupId) return false
    if (status && status !== 'all' && customer.status !== status) return false
    if (!dateRangeMatches(customer.created_at, createdFrom, createdTo)) return false
    if (search) {
      const haystack = normalizeSearchText(`${customer.code} ${customer.name} ${customer.phone ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

function customerImportRepository(repository: ServerRepository) {
  return {
    ...repository,
    findCustomersByCodes: repository.findCustomersByCodes ?? (async (input: { codes: string[] }) =>
      new Set(customers.filter((customer) => input.codes.includes(customer.code)).map((customer) => customer.code))),
    upsertCustomerGroupsByName: repository.upsertCustomerGroupsByName ?? (async (input: { names: string[] }) => {
      const result = new Map<string, string>()
      for (const name of input.names) {
        const existing = customerGroups.find((group) => group.name === name || group.code === name)
        if (existing) {
          result.set(name, existing.id)
          continue
        }
        const id = `cg-kv-${hashText(name)}`
        customerGroups.push({
          id,
          code: name,
          name,
          price_list_id: 'pl-default',
          is_active: true,
        })
        result.set(name, id)
      }
      return result
    }),
    upsertCustomersByCode: repository.upsertCustomersByCode ?? (async (input: { organizationId: string; rows: CustomerImportUpsertRow[] }) => {
      let created = 0
      let updated = 0
      const users = await repository.listUsers?.({
        organizationId: input.organizationId,
        url: new URL('http://api.local/api/v1/users'),
      }) ?? []
      for (const row of input.rows) {
        const group = row.customer_group_id
          ? customerGroups.find((item) => item.id === row.customer_group_id) ?? null
          : null
        const patch = {
          code: row.code,
          name: row.name,
          phone: row.phone,
          tax_code: row.tax_code,
          address: row.address,
          customer_group_id: row.customer_group_id,
          customer_group: group ? { id: group.id, code: group.code, name: group.name } : null,
          created_by: resolveCustomerCreator(row.source_creator_name, users),
          created_at: row.source_created_at ?? runtimeIso(),
          total_sales_amount: row.kiotviet_net_sales ?? row.kiotviet_total_sales ?? 0,
          total_debt_amount: row.kiotviet_current_debt ?? 0,
          customer_type: row.customer_type,
          company_name: row.company_name,
          area_name: row.area_name,
          ward_name: row.ward_name,
          note: row.note,
          source_creator_name: row.source_creator_name,
          last_transaction_at: row.last_transaction_at,
          kiotviet_net_sales: row.kiotviet_net_sales,
          status: row.status,
        }
        const index = customers.findIndex((customer) => customer.code === row.code)
        if (index >= 0) {
          customers[index] = { ...customers[index], ...patch }
          updated += 1
        } else {
          customers.push({
            ...customers[0],
            ...patch,
            id: `customer-kv-${hashText(row.code)}`,
          })
          created += 1
        }
      }
      return { created, updated, skipped: 0 }
    }),
    deleteImportedKiotVietCustomers: repository.deleteImportedKiotVietCustomers ?? (async () => {
      let deleted = 0
      for (let index = customers.length - 1; index >= 0; index -= 1) {
        const customer = customers[index]
        if (customer.code.trim().toLowerCase() === 'khachle') continue
        const isImportedKiotVietRow = customer.id.startsWith('customer-kv-')
        const isDemoCustomerRow = customer.code.startsWith('DEV20-KH-')
        if (!isImportedKiotVietRow && !isDemoCustomerRow) continue
        customers.splice(index, 1)
        deleted += 1
      }
      return { deleted, blocked: 0 }
    }),
  }
}

function supplierImportRepository(repository: ServerRepository) {
  return {
    findSuppliersByCodes: repository.findSuppliersByCodes ?? (async (input: { organizationId: string; codes: string[] }) =>
      new Set(input.codes.filter((code) => suppliers.some((supplier) => supplier.code === code)))),
    upsertSuppliersByCode: repository.upsertSuppliersByCode ?? (async (input: { organizationId: string; rows: SupplierImportUpsertRow[] }) => {
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const index = suppliers.findIndex((supplier) => supplier.code === row.code)
        const existing = index >= 0 ? suppliers[index] : null
        const linkedCustomer = findMatchingCustomerForSupplier(row, customers)
        const patch = {
          code: row.code,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          tax_code: row.tax_code,
          linked_customer_id: existing?.linked_customer_id ?? linkedCustomer?.id ?? null,
          linked_customer: existing?.linked_customer ?? (linkedCustomer ? { id: linkedCustomer.id, code: linkedCustomer.code, name: linkedCustomer.name } : null),
          notes: row.note,
          status: row.status,
          current_payable_amount: row.kiotviet_current_payable ?? 0,
          total_purchase_amount: row.kiotviet_total_purchase ?? 0,
          created_at: row.source_created_at ?? runtimeIso(),
          source_creator_name: row.source_creator_name,
          source_created_at: row.source_created_at,
          company_name: row.company_name,
        }
        if (index >= 0) {
          suppliers[index] = { ...suppliers[index], ...patch }
          updated += 1
        } else {
          suppliers.push({
            ...suppliers[0],
            ...patch,
            id: `supplier-kv-${hashText(row.code)}`,
          })
          created += 1
        }
      }
      return { created, updated, skipped: 0 }
    }),
    deleteImportedKiotVietSuppliers: repository.deleteImportedKiotVietSuppliers ?? (async () => {
      let deleted = 0
      for (let index = suppliers.length - 1; index >= 0; index -= 1) {
        const supplier = suppliers[index]
        const isImportedKiotVietRow = supplier.id.startsWith('supplier-kv-')
        const isDemoSupplierRow = supplier.code.startsWith('DEV20-NCC-')
        if (!isImportedKiotVietRow && !isDemoSupplierRow) continue
        suppliers.splice(index, 1)
        deleted += 1
      }
      return { deleted, blocked: 0 }
    }),
  }
}

function hashText(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 10)
}

function filterInventoryProducts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const inventoryShape = url.searchParams.get('inventory_shape')

  return newestFirst(inventoryProducts.filter((product) => {
    if (status && status !== 'all' && product.status !== status) return false
    if (inventoryShape && inventoryShape !== 'all' && product.inventory_shape !== inventoryShape) return false
    if (search) {
      const haystack = normalizeSearchText(`${product.code} ${product.name} ${product.stock_unit}`)
      if (!haystack.includes(search)) return false
    }
    return true
  }))
}

function filterSuppliers(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const totalPurchaseMin = optionalNumber(url.searchParams.get('total_purchase_min'))
  const totalPurchaseMax = optionalNumber(url.searchParams.get('total_purchase_max'))
  const currentPayableMin = optionalNumber(url.searchParams.get('current_payable_min'))
  const currentPayableMax = optionalNumber(url.searchParams.get('current_payable_max'))

  const supplierActivity = new Map<string, string>()
  for (const receipt of purchaseReceipts) {
    const activity = receipt.updated_at ?? receipt.created_at ?? receipt.received_at
    const current = supplierActivity.get(receipt.supplier_id)
    if (!current || activity > current) supplierActivity.set(receipt.supplier_id, activity)
  }

  return newestFirst(suppliers.filter((supplier) => {
    if (status && status !== 'all' && supplier.status !== status) return false
    if (totalPurchaseMin !== undefined && supplier.total_purchase_amount < totalPurchaseMin) return false
    if (totalPurchaseMax !== undefined && supplier.total_purchase_amount > totalPurchaseMax) return false
    if (currentPayableMin !== undefined && supplier.current_payable_amount < currentPayableMin) return false
    if (currentPayableMax !== undefined && supplier.current_payable_amount > currentPayableMax) return false
    if (search) {
      const haystack = normalizeSearchText(`${supplier.code} ${supplier.name} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.tax_code ?? ''} ${supplier.notes ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  }).map((supplier) => ({ ...supplier, last_activity_at: supplierActivity.get(supplier.id) })))
}

function filterPurchaseReceipts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const createdBy = url.searchParams.get('created_by')
  const supplierId = url.searchParams.get('supplier_id')
  const supplierCode = normalizeSearchText(url.searchParams.get('supplier_code') ?? '')

  return newestFirst(purchaseReceipts.filter((receipt) => {
    if (status && status !== 'all' && receipt.status !== status) return false
    if (
      (supplierId || supplierCode) &&
      receipt.supplier_id !== supplierId &&
      receipt.supplier.id !== supplierId &&
      normalizeSearchText(receipt.supplier.code) !== supplierCode
    ) return false
    if (!dateRangeMatches(receipt.received_at, dateFrom, dateTo)) return false
    if (createdBy && createdBy !== 'all' && receipt.created_by.id !== createdBy) return false
    if (search) {
      const haystack = normalizeSearchText(`${receipt.code} ${receipt.supplier.code} ${receipt.supplier.name} ${receipt.supplier_document_no ?? ''} ${receipt.notes ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  }))
}

function filterCustomerDebts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')

  return newestFirst(customerDebtItems.filter((debt) => {
    if (!search) return true
    const haystack = normalizeSearchText(`${debt.customer_code} ${debt.customer_name} ${debt.oldest_order_code}`)
    return haystack.includes(search)
  }))
}

function hydrateLinkedSuppliers(customersToHydrate: readonly CustomerListData[], supplierRows: readonly SupplierListData[]) {
  return customersToHydrate.map((customer) => {
    const linkedSupplier = supplierRows.find((supplier) => supplier.linked_customer_id === customer.id)
      ?? supplierRows.find((supplier) => supplierMatchesCustomer(supplier, customer))
      ?? null
    return linkedSupplier
      ? { ...customer, linked_supplier: { id: linkedSupplier.id, code: linkedSupplier.code, name: linkedSupplier.name, linked_at: linkedSupplier.created_at ?? null } }
      : { ...customer, linked_supplier: null }
  })
}

function supplierMatchesCustomer(supplier: Pick<SupplierListData, 'code' | 'name'>, customer: Pick<CustomerListData, 'code' | 'name'>) {
  return normalizeSearchText(supplier.code) === normalizeSearchText(customer.code)
    || normalizeSearchText(supplier.name) === normalizeSearchText(customer.name)
}

function findMatchingCustomerForSupplier(supplier: Pick<SupplierListData, 'code' | 'name'>, customerRows: readonly CustomerListData[]) {
  return customerRows.find((customer) => supplierMatchesCustomer(supplier, customer)) ?? null
}

function customerActivityFromSalesDocuments() {
  const activity = new Map<string, string>()
  for (const document of salesDocuments) {
    const current = activity.get(document.customer.id)
    if (!current || document.created_at > current) activity.set(document.customer.id, document.created_at)
  }
  return activity
}

async function ensureSalesFinanceSeed(repository: ServerRepository, organizationId: string) {
  if (!repository.ensureSalesFinanceSeed) return
  if (salesFinanceSeededOrganizations.has(organizationId)) return
  await repository.ensureSalesFinanceSeed({ organizationId, documents: salesDocuments, cashbookEntries })
  salesFinanceSeededOrganizations.add(organizationId)
}

function filterCashbookEntries(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const searchScope = url.searchParams.get('search_scope') ?? 'all'
  const financeAccountId = url.searchParams.get('finance_account_id')
  const financeAccountType = url.searchParams.get('finance_account_type')
  const direction = url.searchParams.get('direction')
  const status = url.searchParams.get('status')
  const isBusinessAccounted = url.searchParams.get('is_business_accounted')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  return newestFirst(cashbookEntries.filter((entry) => {
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
        note: entry.note,
        counterparty: `${entry.counterparty.name} ${entry.counterparty.phone ?? ''}`,
        all: `${entry.code} ${entry.note} ${entry.counterparty.name} ${entry.counterparty.phone ?? ''} ${entry.finance_account.code} ${entry.finance_account.name}`,
      }
      const haystack = normalizeSearchText(scopedHaystacks[searchScope as keyof typeof scopedHaystacks] ?? scopedHaystacks.all)
      if (!haystack.includes(search)) return false
    }
    return true
  }))
}

function makeOrderFromCheckout(body: {
  customer_id?: string
  note?: string
  items?: Array<{
    product_id?: string
    quantity?: number
    unit_price?: number
    sale_unit_name?: string
    stock_qty_per_sale_unit?: number
    discount_amount?: number
  }>
  payment?: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; change_returned_amount?: number; bank_account_id?: string | null }
}, orderType: 'invoice' | 'quote', customer: Pick<CustomerListData, 'id' | 'code' | 'name' | 'phone'>, code: string, seller: { id: string; name: string }) {
  const createdAt = runtimeIso()
  const subtotal = (body.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0)
  const discount = (body.items ?? []).reduce((sum, item) => sum + Number(item.discount_amount ?? 0), 0)
  const total = Math.max(subtotal - discount, 0)
  const cashAmount = Number(body.payment?.cash_amount ?? 0)
  const bankAmount = Number(body.payment?.bank_amount ?? 0)
  const oldDebtPayment = Number(body.payment?.old_debt_payment_amount ?? 0)
  const changeReturned = Number(body.payment?.change_returned_amount ?? 0)
  const paid = orderType === 'quote' ? 0 : Math.min(total, Math.max(cashAmount + bankAmount - oldDebtPayment - changeReturned, 0))
  const debtAmount = orderType === 'quote' ? 0 : Math.max(total - paid, 0)

  return {
    id: randomUUID(),
    code,
    order_type: orderType,
    status: orderType === 'quote' ? 'active' : 'completed',
    created_at: createdAt,
    customer: { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone },
    seller,
    subtotal_amount: subtotal,
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    debt_amount: debtAmount,
    payment_status: checkoutPaymentStatus(orderType, paid, debtAmount),
    note: body.note ?? '',
    items: (body.items ?? [])
      .filter((item) => typeof item.product_id === 'string' && item.product_id.trim() !== '')
      .map((item) => ({
        product_id: item.product_id as string,
        quantity: Number(item.quantity ?? 1),
        unit_price: Number(item.unit_price ?? 0),
        sale_unit_name: typeof item.sale_unit_name === 'string' && item.sale_unit_name.trim() !== '' ? item.sale_unit_name : undefined,
        stock_qty_per_sale_unit: Number.isFinite(Number(item.stock_qty_per_sale_unit)) && Number(item.stock_qty_per_sale_unit) > 0
          ? Number(item.stock_qty_per_sale_unit)
          : undefined,
        discount_amount: Number(item.discount_amount ?? 0),
      })),
  }
}

type PosCartValidationLine = {
  client_line_id?: string
  product_id?: string
  sell_method?: string
  quantity?: number
  width_m?: number | null
  height_m?: number | null
  linear_m?: number | null
  unit_price?: number
  price_source?: string
}

type PosCartValidationError = {
  client_line_id?: string
  product_id?: string
  field: string
  code: string
  message: string
}

const allowedCartSellMethods = new Set(['quantity', 'area_m2', 'linear_m', 'sheet', 'combo'])

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function validatePosCart(repository: ServerRepository, organizationId: string, body: { items?: PosCartValidationLine[] }) {
  const items = Array.isArray(body.items) ? body.items : []
  const catalog = await repository.listProducts?.({
    organizationId,
    url: new URL('http://api.local/api/v1/products?status=all&page=1&page_size=10000'),
  }) ?? products
  const productsById = new Map(catalog.map((product) => [product.id, product]))
  const errors: PosCartValidationError[] = []
  const normalizedItems = items.map((item) => {
    const productId = typeof item.product_id === 'string' ? item.product_id.trim() : ''
    const product = productId ? productsById.get(productId) : undefined
    const clientLineId = typeof item.client_line_id === 'string' ? item.client_line_id : undefined
    const errorBase = { client_line_id: clientLineId, product_id: productId || undefined }
    const quantity = finiteNumber(item.quantity)
    const unitPrice = finiteNumber(item.unit_price)
    const sellMethod = typeof item.sell_method === 'string' && item.sell_method.trim() !== ''
      ? item.sell_method.trim()
      : product?.sell_method
    const width = finiteNumber(item.width_m)
    const height = finiteNumber(item.height_m)
    const linear = finiteNumber(item.linear_m)

    if (!product || product.status !== 'active') {
      errors.push({ ...errorBase, field: 'product_id', code: 'PRODUCT_MISSING', message: 'Product does not exist or is inactive.' })
    }
    if (quantity === null || quantity <= 0) {
      errors.push({ ...errorBase, field: 'quantity', code: 'INVALID_QUANTITY', message: 'quantity must be greater than 0.' })
    }
    if (unitPrice === null || unitPrice < 0) {
      errors.push({ ...errorBase, field: 'unit_price', code: 'INVALID_UNIT_PRICE', message: 'unit_price must be greater than or equal to 0.' })
    }
    if (!sellMethod || !allowedCartSellMethods.has(sellMethod)) {
      errors.push({ ...errorBase, field: 'sell_method', code: 'INVALID_SELL_METHOD', message: 'sell_method is not supported.' })
    }
    if (sellMethod === 'area_m2') {
      if (width === null || width <= 0) {
        errors.push({ ...errorBase, field: 'width_m', code: 'MEASUREMENT_REQUIRED', message: 'width_m must be greater than 0 for area_m2.' })
      }
      if (height === null || height <= 0) {
        errors.push({ ...errorBase, field: 'height_m', code: 'MEASUREMENT_REQUIRED', message: 'height_m must be greater than 0 for area_m2.' })
      }
    }
    if (sellMethod === 'linear_m' && (linear === null || linear <= 0)) {
      errors.push({ ...errorBase, field: 'linear_m', code: 'MEASUREMENT_REQUIRED', message: 'linear_m must be greater than 0 for linear_m.' })
    }

    const safeQuantity = quantity ?? 0
    const safeUnitPrice = unitPrice ?? 0
    const lineTotal =
      sellMethod === 'area_m2'
        ? safeQuantity * (width ?? 0) * (height ?? 0) * safeUnitPrice
        : sellMethod === 'linear_m'
          ? safeQuantity * (linear ?? 0) * safeUnitPrice
          : safeQuantity * safeUnitPrice

    return {
      client_line_id: clientLineId,
      product_id: productId,
      quantity: safeQuantity,
      width_m: width ?? undefined,
      height_m: height ?? undefined,
      linear_m: linear ?? undefined,
      unit_price: safeUnitPrice,
      line_total: lineTotal,
      price_source: typeof item.price_source === 'string' && item.price_source.trim() !== '' ? item.price_source : 'manual',
    }
  })
  const subtotal = errors.length > 0 ? 0 : normalizedItems.reduce((sum, item) => sum + item.line_total, 0)

  return errors.length > 0
    ? { valid: false, errors, items: normalizedItems, subtotal_amount: subtotal, total_amount: subtotal }
    : { valid: true, items: normalizedItems, subtotal_amount: subtotal, total_amount: subtotal }
}

function addCustomerDebtFromCheckout(order: ReturnType<typeof makeOrderFromCheckout>) {
  if (order.order_type !== 'invoice' || order.debt_amount <= 0) return

  addCustomerDebtDocument(customerDebtItems, order)
}

function addCustomerSalesFromCheckout(order: ReturnType<typeof makeOrderFromCheckout>) {
  if (order.order_type !== 'invoice' || order.status === 'cancelled') return
  const customer = customers.find((item) => item.id === order.customer.id)
  if (customer) customer.total_sales_amount += order.total_amount
}

function addCashbookEntriesFromCheckout(order: ReturnType<typeof makeOrderFromCheckout>, payment: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; change_returned_amount?: number; bank_account_id?: string | null } = {}, createdBy = order.seller) {
  const entries = previewCashbookEntriesFromCheckout(order, payment, createdBy)
  cashbookEntries.unshift(...entries)
  return entries
}

function checkoutPaymentReceiptCode(orderCode: string, index: number, accountType: 'cash' | 'bank') {
  const invoiceMatch = /^HD(\d{6}(?:\.\d+)?)$/.exec(orderCode)
  const baseCode = invoiceMatch ? `TTHD${invoiceMatch[1]}` : `TT${String(cashbookEntries.length + 1).padStart(6, '0')}`
  if (index === 0) return baseCode
  return `${baseCode}-${accountType === 'bank' ? 'NH' : 'TM'}`
}

function previewCashbookEntriesFromCheckout(order: ReturnType<typeof makeOrderFromCheckout>, payment: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; change_returned_amount?: number; bank_account_id?: string | null } = {}, createdBy = order.seller) {
  const entries: CashbookEntryData[] = []
  const createdAt = runtimeIso()
  const cashAmount = Math.max(Number(payment.cash_amount ?? 0) - Number(payment.change_returned_amount ?? 0), 0)
  const bankAmount = Math.max(Number(payment.bank_amount ?? 0), 0)
  let collectedBefore = 0
  const methods = [
    { amount: cashAmount, account: financeAccounts[0] },
    { amount: bankAmount, account: financeAccounts.find((account) => account.id === payment.bank_account_id) ?? financeAccounts[1] },
  ]

  for (const method of methods) {
    if (method.amount <= 0) continue
    const entryId = randomUUID()
    const entryCode = checkoutPaymentReceiptCode(order.code, entries.length, method.account.account_type)
    const remainingAfter = Math.max(order.total_amount - collectedBefore - method.amount, 0)
    entries.push({
      id: entryId,
      code: entryCode,
      status: 'posted',
      direction: 'in',
      amount_delta: method.amount,
      finance_account: { id: method.account.id, code: method.account.code, name: method.account.name, account_type: method.account.account_type },
      is_business_accounted: true,
      source_type: 'payment_receipt_method',
      created_by: createdBy,
      created_at: createdAt,
      note: `Thu tien ${order.code}`,
      counterparty: { type: 'customer', name: order.customer.name, phone: order.customer.phone },
      source: { type: 'payment_receipt', id: entryId, code: entryCode, order_code: order.code },
      allocations: [{
        order_id: order.id,
        order_code: order.code,
        order_total_amount: order.total_amount,
        collected_before: collectedBefore,
        allocated_amount: method.amount,
        remaining_after: remainingAfter,
      }],
      payment_method: method.account.account_type === 'bank' ? 'bank_transfer' : 'cash',
    })
    collectedBefore += method.amount
  }

  return entries
}

async function collectCustomerDebt(request: Request) {
  const body = await readJson(request) as {
    customer_id?: string
    amount?: number
    payment_method?: {
      cash_amount?: number
      bank_amount?: number
      bank_account_id?: string | null
      bank_transaction_ref?: string
    }
    note?: string
  }
  const customerId = body.customer_id ?? ''
  const requestedAmount = Math.max(Number(body.amount ?? 0), 0)
  const cashAmount = Math.max(Number(body.payment_method?.cash_amount ?? 0), 0)
  const bankAmount = Math.max(Number(body.payment_method?.bank_amount ?? 0), 0)
  const receivedAmount = cashAmount + bankAmount
  const debt = customerDebtItems.find((item) => item.customer_id === customerId)
  if (!debt || requestedAmount <= 0 || receivedAmount !== requestedAmount) {
    return { payment_receipt_id: '', allocated_amount: 0 }
  }

  const allocations: Array<{
    order_id: string
    order_code: string
    order_total_amount: number
    collected_before: number
    allocated_amount: number
    remaining_after: number
  }> = []
  let remainingPayment = Math.min(requestedAmount, debt.total_debt)
  const invoices = [...debt.invoices].reverse()

  for (const invoice of invoices) {
    if (remainingPayment <= 0) break
    if (invoice.remaining_debt <= 0) continue
    const allocated = Math.min(invoice.remaining_debt, remainingPayment)
    const document = salesDocuments.find((item) => item.id === invoice.order_id)
    const collectedBefore = document ? document.paid_amount : invoice.paid_amount

    invoice.paid_amount += allocated
    invoice.remaining_debt -= allocated
    invoice.debt_amount = invoice.remaining_debt
    if (document) {
      document.paid_amount += allocated
      document.debt_amount = Math.max(document.debt_amount - allocated, 0)
      document.payment_status = invoicePaymentStatus(document.paid_amount, document.debt_amount)
    }

    allocations.push({
      order_id: invoice.order_id,
      order_code: invoice.order_code,
      order_total_amount: invoice.total_amount,
      collected_before: collectedBefore,
      allocated_amount: allocated,
      remaining_after: invoice.remaining_debt,
    })
    remainingPayment -= allocated
  }

  const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
  debt.total_debt = Math.max(debt.total_debt - allocatedAmount, 0)
  debt.invoices = debt.invoices.filter((invoice) => invoice.remaining_debt > 0)
  debt.open_invoice_count = debt.invoices.length
  debt.oldest_order_code = debt.invoices.at(-1)?.order_code ?? ''
  const customer = customers.find((item) => item.id === customerId)
  if (customer) customer.total_debt_amount = debt.total_debt
  if (debt.total_debt <= 0) {
    const index = customerDebtItems.findIndex((item) => item.customer_id === customerId)
    if (index >= 0) customerDebtItems.splice(index, 1)
  }

  const receiptCode = `TT${String(cashbookEntries.length + 1).padStart(6, '0')}`
  const createdAt = runtimeIso()
  const customerName = customer?.name ?? debt.customer_name
  const customerPhone = customer && 'phone' in customer ? customer.phone : null
  const allocationCodes = allocations.map((allocation) => allocation.order_code).join(', ')
  const inputNote = body.note?.trim()
  const entryNote = inputNote ? `${inputNote} - ${allocationCodes}` : `Thu no ${allocationCodes}`
  const baseEntry = {
    status: 'posted',
    direction: 'in',
    is_business_accounted: true,
    source_type: 'payment_receipt_method',
    created_by: null,
    created_at: createdAt,
    note: entryNote,
    counterparty: { type: 'customer', name: customerName, phone: customerPhone },
    payment_method: bankAmount > 0 && cashAmount <= 0 ? 'bank_transfer' : cashAmount > 0 && bankAmount <= 0 ? 'cash' : 'manual',
    source: { type: 'payment_receipt', id: receiptCode, code: receiptCode, order_code: allocations[0]?.order_code ?? null },
    allocations,
  }
  const entries: typeof cashbookEntries = []
  if (cashAmount > 0) {
    entries.push({
      ...baseEntry,
      id: `cashbook-debt-${randomUUID()}`,
      code: entries.length === 0 ? receiptCode : `${receiptCode}-TM`,
      amount_delta: cashAmount,
      finance_account: { id: financeAccounts[0].id, code: financeAccounts[0].code, name: financeAccounts[0].name, account_type: financeAccounts[0].account_type },
    })
  }
  if (bankAmount > 0) {
    const account = financeAccounts.find((item) => item.id === body.payment_method?.bank_account_id) ?? financeAccounts[1]
    entries.push({
      ...baseEntry,
      id: `cashbook-debt-${randomUUID()}`,
      code: entries.length === 0 ? receiptCode : `${receiptCode}-NH`,
      amount_delta: bankAmount,
      finance_account: { id: account.id, code: account.code, name: account.name, account_type: account.account_type },
      note: body.payment_method?.bank_transaction_ref ? `${baseEntry.note} (${body.payment_method.bank_transaction_ref})` : baseEntry.note,
    })
  }
  cashbookEntries.unshift(...entries)

  return { payment_receipt_id: receiptCode, allocated_amount: allocatedAmount }
}

function makeSalesDocumentDetail(
  document: ReturnType<typeof makeSalesDocument>,
  productCatalog: ProductListData[] = products,
) {
  const rawItems = Array.isArray(document.items) ? document.items : []
  const detailItems = rawItems.length > 0
    ? rawItems.map((item, index) => {
        const detailItem = item as {
          product_id: string
          quantity?: number
          unit_price?: number
          discount_amount?: number
          sale_unit_name?: string
          width_m?: number | null
          height_m?: number | null
          linear_m?: number | null
        }
        const product = productCatalog.find((candidate) => candidate.id === detailItem.product_id)
          ?? products.find((candidate) => candidate.id === detailItem.product_id)
          ?? products[0]
        const quantity = Number(detailItem.quantity ?? 1)
        const unitPrice = Number(detailItem.unit_price ?? document.subtotal_amount)
        const discountAmount = Number(detailItem.discount_amount ?? 0)
        const lineSubtotal = quantity * unitPrice
        return {
          id: `${document.id}-item-${index + 1}`,
          line_no: index + 1,
          product: { id: product.id, code: product.code, name: product.name, unit_name: detailItem.sale_unit_name ?? product.unit_name, sell_method: product.sell_method },
          quantity,
          width_m: detailItem.width_m ?? null,
          height_m: detailItem.height_m ?? null,
          linear_m: detailItem.linear_m ?? null,
          unit_price: unitPrice,
          line_subtotal_amount: lineSubtotal,
          discount_amount: discountAmount,
          line_total: Math.max(lineSubtotal - discountAmount, 0),
          price_source: 'price_source' in item && typeof item.price_source === 'string' ? item.price_source : 'default_price_list',
          note: 'note' in item && typeof item.note === 'string' ? item.note : null,
        }
      })
    : [{
        id: `${document.id}-item-1`,
        line_no: 1,
        product: { id: productCatalog[0]?.id ?? products[0].id, code: productCatalog[0]?.code ?? products[0].code, name: productCatalog[0]?.name ?? products[0].name, unit_name: productCatalog[0]?.unit_name ?? products[0].unit_name, sell_method: productCatalog[0]?.sell_method ?? products[0].sell_method },
        quantity: 1,
        width_m: null,
        height_m: null,
        linear_m: null,
        unit_price: document.subtotal_amount,
        line_subtotal_amount: document.subtotal_amount,
        discount_amount: document.discount_amount,
        line_total: document.total_amount,
        price_source: 'default_price_list',
        note: null,
      }]
  return {
    ...document,
    price_list: { id: 'pl-default', code: 'BG-LE', name: 'Bang gia le' },
    change_returned_amount: 0,
    items: detailItems,
    payment_receipts: [],
    debt_entries: document.debt_amount > 0
      ? [
          {
            id: `${document.id}-debt-1`,
            entry_type: 'invoice_debt',
            amount_delta: document.debt_amount,
            balance_after_order: document.debt_amount,
            balance_after_customer: document.debt_amount,
            created_at: nowIso,
          },
        ]
      : [],
    stock_movements: detailItems.map((item) => ({
      id: `${document.id}-sm-${item.line_no}`,
      product_id: item.product.id,
      movement_type: 'sale',
      quantity_delta: -item.quantity,
      created_at: nowIso,
      unit_name: item.product.unit_name,
      note: null,
    })),
    history: [{ at: nowIso, action: 'created', actor_name: 'Admin', note: null }],
  }
}

function makeCashbookEntry(number: number) {
  const isIn = number % 2 === 1
  const amount = 150000 + number * 25000
  const account = financeAccounts[number % 3 === 0 ? 1 : 0]
  const customer = customers[(number % (customers.length - 1)) + 1] ?? customers[0]
  const supplier = suppliers[(number - 1) % suppliers.length]
  return {
    id: `cashbook-${pad(number)}`,
    code: `${isIn ? 'DEV20-PT' : 'DEV20-PC'}-${pad(number)}`,
    status: 'posted',
    direction: isIn ? 'in' : 'out',
    amount_delta: isIn ? amount : -amount,
    finance_account: { id: account.id, code: account.code, name: account.name, account_type: account.account_type },
    is_business_accounted: true,
    source_type: isIn ? 'payment_receipt_method' : 'cashbook_voucher',
    created_at: nowIso,
    note: isIn ? `Thu tien demo ${pad(number)}` : `Chi tien demo ${pad(number)}`,
    counterparty: isIn
      ? { type: 'customer', name: customer.name, phone: customer.phone }
      : { type: 'supplier', name: supplier.name, phone: supplier.phone },
  }
}

function makeCustomerDebtDetail(customerId: string) {
  const debt = customerDebtItems.find((item) => item.customer_id === customerId)
  if (!debt) return { customer_id: customerId, total_debt: 0, invoices: [] }
  return {
    customer_id: customerId,
    total_debt: debt.total_debt,
    invoices: debt.invoices,
  }
}

function cashbookPaymentMethod(entry: CashbookEntryData) {
  if (entry.payment_method === 'cash' || entry.payment_method === 'bank_transfer' || entry.payment_method === 'manual') return entry.payment_method
  if (entry.source_type === 'cashbook_voucher') return 'manual'
  return entry.finance_account.account_type === 'bank' ? 'bank_transfer' : 'cash'
}

function inferredLinkedDocumentCodeFromCashbookEntry(entry: CashbookEntryData) {
  const noteDocumentMatch = entry.note?.match(/\b(?:HD|PN)\d+(?:\.\d+)?\b/i)
  if (noteDocumentMatch) return noteDocumentMatch[0].toUpperCase()

  const normalizedCode = entry.code.trim().toUpperCase()
  const invoicePaymentMatch = normalizedCode.match(/^TTHD(\d+(?:\.\d+)?)$/)
  if (invoicePaymentMatch) return `HD${invoicePaymentMatch[1]}`
  const purchasePaymentMatch = normalizedCode.match(/^PCPN(\d+(?:\.\d+)?)$/)
  if (purchasePaymentMatch) return `PN${purchasePaymentMatch[1]}`
  return null
}

function cashbookCounterpartyNeedsDocumentHydration(entry: CashbookEntryData) {
  return entry.direction === 'in'
    && (!entry.counterparty?.name || entry.counterparty.name.trim().length === 0)
}

async function enrichCashbookEntryDetail(
  entry: CashbookEntryData,
  resolveLinkedDocument?: (code: string) => Promise<SalesDocumentData | null>,
) {
  const allocations = entry.allocations ?? []
  const entrySource = entry.source && typeof entry.source.type === 'string' && typeof entry.source.code === 'string'
    ? entry.source
    : null
  const source = entrySource ?? {
    type: entry.source_type === 'cashbook_voucher' ? 'manual_voucher' : 'payment_receipt',
    id: entry.id,
    code: entry.code,
    order_code: null,
  }
  const linkedDocumentCode = source.order_code ?? allocations[0]?.order_code ?? inferredLinkedDocumentCodeFromCashbookEntry(entry)
  const linkedDocument = linkedDocumentCode && resolveLinkedDocument
    ? await resolveLinkedDocument(linkedDocumentCode)
    : null
  const counterparty = linkedDocument && cashbookCounterpartyNeedsDocumentHydration(entry)
    ? { type: 'customer' as const, name: linkedDocument.customer.name, phone: linkedDocument.customer.phone }
    : entry.counterparty
  return {
    ...entry,
    counterparty,
    payment_method: cashbookPaymentMethod(entry),
    source: { ...source, order_code: linkedDocumentCode },
    allocations,
  }
}

export function createHttpHandler(options: HttpHandlerOptions): HttpHandler {
  return async (request) => {
    const traceId = request.headers.get('x-request-id') ?? randomUUID()

    try {
      if (request.method === 'OPTIONS') return emptyResponse(traceId)

      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/api/v1/health') {
        return success(
          { status: 'ok', service: 'qcvl-api', version: options.version ?? 'dev', persistence: options.persistence ?? 'unknown' },
          traceId,
        )
      }

      const authRoute = await handleAuthRoute({ request, repository: options.repository, traceId })
      if (authRoute.found) return authRoute.response

      const currentUser = await requireCurrentUser(options.repository, request, traceId)
      await ensureSalesFinanceSeed(options.repository, currentUser.organization.id)
      const devResponse = await getDevApiResponse(request, url, currentUser, options.repository)
      if (devResponse.found) return success(devResponse.data, traceId, devResponse.status)

      return failure(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.', traceId)
    } catch (error) {
      if (error instanceof HttpError) {
        return failure(error.status, error.code, error.message, traceId, error.fields)
      }
      console.error(JSON.stringify({
        traceId,
        method: request.method,
        url: request.url,
        error: serializeError(error),
      }))
      return failure(500, 'INTERNAL_ERROR', 'An internal error occurred.', traceId)
    }
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const extra = error as Error & Record<string, unknown>
    return {
      name: error.name,
      message: error.message,
      code: extra.code,
      table: extra.table,
      column: extra.column,
      constraint: extra.constraint,
      detail: extra.detail,
      stack: error.stack,
    }
  }
  return error
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt:v1:16384:8:1:${salt}:${key.toString('hex')}`
}

async function getDevApiResponse(
  request: Request,
  url: URL,
  currentUser: CurrentUserData,
  repository: ServerRepository,
): Promise<{ found: true; data: unknown; status?: number } | { found: false }> {
  const path = url.pathname
  const method = request.method
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('page_size') ?? '15')

  if (method === 'GET' && path === '/api/v1/me') return { found: true, data: enrichCurrentUser(currentUser) }
  if (method === 'PATCH' && path === '/api/v1/me/profile') return { found: true, data: enrichCurrentUser(currentUser, await readJson(request)) }
  if (method === 'POST' && /^\/api\/v1\/me\/devices\/[^/]+\/sign-out$/.test(path)) return { found: true, data: [] }

  if (method === 'GET' && path === '/api/v1/workstations') {
    return { found: true, data: await repository.listWorkstations(currentUser.organization.id) }
  }
  if ((method === 'POST' && path === '/api/v1/workstations') || (method === 'PATCH' && /^\/api\/v1\/workstations\/[^/]+$/.test(path))) {
    const body = await readJson(request)
    return { found: true, data: { id: getIdFromPath(path) ?? randomUUID(), code: body.code ?? 'POS-NEW', name: body.name ?? 'May moi', status: body.status ?? 'active' } }
  }

  if (method === 'GET' && path === '/api/v1/permissions') return { found: true, data: allPermissions }
  if (method === 'GET' && path === '/api/v1/users') {
    const items = await repository.listUsers?.({ organizationId: currentUser.organization.id, url })
      ?? [toUserListItem(currentUser)]
    return { found: true, data: { items, total: items.length } }
  }
  if (method === 'GET' && /^\/api\/v1\/users\/[^/]+$/.test(path)) {
    const id = getIdFromPath(path)
    const items = await repository.listUsers?.({ organizationId: currentUser.organization.id, url })
      ?? [toUserListItem(currentUser)]
    return { found: true, data: items.find((item) => item.id === id) ?? toUserListItem(currentUser) }
  }
  if (method === 'POST' && path === '/api/v1/users') {
    const body = await readJson(request)
    const username = requiredString(body.username, 'username')
    const contactEmail = nullableString(body.email)
    const userInput = {
      organizationId: currentUser.organization.id,
      email: (contactEmail ?? makeInternalUserEmail(username)).toLowerCase(),
      username,
      phone: requiredString(body.phone, 'phone'),
      birthday: nullableString(body.birthday),
      region: nullableString(body.region),
      ward: nullableString(body.ward),
      address: nullableString(body.address),
      note: nullableString(body.note),
      passwordHash: await hashPassword(requiredString(body.password, 'password')),
      displayName: requiredString(body.display_name, 'display_name'),
      permissions: normalizePermissions(body.permissions),
    }
    let created: UserListItemData
    try {
      created = repository.createUser
        ? await repository.createUser(userInput)
        : await makeUserResponseFromBody(body)
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
        throw new HttpError(409, 'RESOURCE_CONFLICT', 'User email or username already exists.')
      }
      throw error
    }
    return { found: true, data: created, status: 201 }
  }
  if (method === 'PATCH' && /^\/api\/v1\/users\/[^/]+$/.test(path)) {
    const body = await readJson(request)
    const id = getIdFromPath(path) ?? ''
    const username = typeof body.username === 'string' ? body.username.trim() : undefined
    const contactEmail = body.email === undefined ? undefined : nullableString(body.email)
    let updated: UserListItemData | null | undefined
    try {
      updated = await repository.updateUser?.({
        organizationId: currentUser.organization.id,
        id,
        email: contactEmail === undefined ? undefined : (contactEmail ?? makeInternalUserEmail(username ?? id)).toLowerCase(),
        username,
        phone: body.phone === undefined ? undefined : requiredString(body.phone, 'phone'),
        birthday: body.birthday === undefined ? undefined : nullableString(body.birthday),
        region: body.region === undefined ? undefined : nullableString(body.region),
        ward: body.ward === undefined ? undefined : nullableString(body.ward),
        address: body.address === undefined ? undefined : nullableString(body.address),
        note: body.note === undefined ? undefined : nullableString(body.note),
        passwordHash: typeof body.password === 'string' && body.password.length > 0 ? await hashPassword(body.password) : undefined,
        displayName: typeof body.display_name === 'string' ? body.display_name : undefined,
        status: body.status === 'active' || body.status === 'inactive' ? body.status : undefined,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
        throw new HttpError(409, 'RESOURCE_CONFLICT', 'User email or username already exists.')
      }
      throw error
    }
    return { found: true, data: updated ?? { ...toUserListItem(currentUser), ...body } }
  }
  if (method === 'PUT' && /^\/api\/v1\/users\/[^/]+\/permissions$/.test(path)) {
    const body = await readJson(request)
    const id = getIdFromPath(path) ?? ''
    const updated = await repository.replaceUserPermissions?.({
      organizationId: currentUser.organization.id,
      id,
      permissions: normalizePermissions(body.permissions),
    })
    return { found: true, data: updated ?? { ...toUserListItem(currentUser), permissions: normalizePermissions(body.permissions) } }
  }

  const catalogRoute = await handleCatalogRoute(
    { request, url, currentUser, repository },
    {
      productGroups: async () => ({
        found: true,
        data: { items: await repository.listProductGroups?.({ organizationId: currentUser.organization.id }) ?? productGroups },
      }),
      createProductGroup: async () => {
        const body = await readJson(request)
        const name = requiredString(body.name, 'name').replace(/\s*>>\s*/g, ' >> ')
        const groupIds = await repository.upsertProductGroupsByName?.({ organizationId: currentUser.organization.id, names: [name] })
        const items = await repository.listProductGroups?.({ organizationId: currentUser.organization.id })
        const created = items?.find((group) => group.name === name)
          ?? productGroups.find((group) => group.name === name)
          ?? {
            id: groupIds?.get(name) ?? randomUUID(),
            code: productGroupCode(name),
            name,
            is_default: false,
            is_active: true,
        }
        return { found: true, data: created, status: 201 }
      },
      updateProductGroup: async () => {
        const body = await readJson(request)
        const id = getIdFromPath(path) ?? ''
        const name = requiredString(body.name, 'name').replace(/\s*>>\s*/g, ' >> ')
        const updated = await repository.updateProductGroup?.({ organizationId: currentUser.organization.id, id, name })
        if (updated) return { found: true, data: updated }
        const fallback = productGroups.find((group) => group.id === id)
        if (!fallback) return { found: true, data: { message: 'Product group not found' }, status: 404 }
        const renamed = { ...fallback, code: productGroupCode(name), name }
        return { found: true, data: renamed }
      },
      listProducts: async () => {
        const items = await listProductsForRequest(url, repository, currentUser.organization.id)
        return {
          found: true,
          data: {
            ...paged(items, page, pageSize),
            total_all: await countAllProductsForRequest(url, repository, currentUser.organization.id),
          },
        }
      },
      previewKiotVietProductImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietProductRows(importRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietProductImport({
            organizationId: currentUser.organization.id,
            repository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
            cleanupDemo: Boolean(body.cleanup_demo),
          }),
        }
      },
      importKiotVietProducts: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietProductRows(importRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietProductImport({
            organizationId: currentUser.organization.id,
            repository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
            cleanupDemo: Boolean(body.cleanup_demo),
          }),
        }
      },
      deleteImportedKiotVietProducts: async () => {
        const result = await repository.deleteImportedKiotVietProducts?.({ organizationId: currentUser.organization.id }) ?? { deleted: 0, blocked: 0 }
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      getProductBom: async () => ({ found: true, data: null }),
      createProduct: async () => ({ found: true, data: { ...products[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }),
      updateProduct: async () => ({ found: true, data: { ...products[0], ...(await readJson(request)), id: getIdFromPath(path) } }),
      upsertProductBom: async () => ({ found: true, data: { id: randomUUID(), product_id: path.split('/')[4], version: 1, status: 'active', notes: null, created_at: nowIso, items: [] } }),
      customerGroups: async () => ({ found: true, data: { items: customerGroups } }),
      listCustomers: async () => {
        const financialTotals = await repository.getCustomerFinancialTotals?.(currentUser.organization.id)
        const userList = await repository.listUsers?.({
          organizationId: currentUser.organization.id,
          url: new URL('http://api.local/api/v1/users'),
        }) ?? []
        const repositoryCustomers = await repository.listCustomers?.({
          organizationId: currentUser.organization.id,
          url,
        })
        const repositorySuppliers = await repository.listSuppliers?.({
          organizationId: currentUser.organization.id,
          url: new URL('http://api.local/api/v1/suppliers?page=1&page_size=10000'),
        })
        const localActivity = repository.getCustomerFinancialTotals || repositoryCustomers ? undefined : customerActivityFromSalesDocuments()
        const filteredCustomers = (repositoryCustomers ?? filterCustomers(url)).map((customer) => {
          const totals = financialTotals?.get(customer.id)
          const lastActivityAt = totals?.last_activity_at ?? localActivity?.get(customer.id) ?? customer.created_at
          return { ...customer, ...totals, created_by: resolveCustomerCreatedBy(customer, userList), last_activity_at: lastActivityAt }
        })
        const sortedCustomers = newestFirst(hydrateLinkedSuppliers(filteredCustomers, repositorySuppliers ?? suppliers))
        return { found: true, data: { ...paged(sortedCustomers, page, pageSize), summary: customerListSummary(sortedCustomers) } }
      },
      createCustomer: async () => {
        const body = await readJson(request) as { code?: string; name?: string; phone?: string; customer_group_id?: string | null }
        const created = { ...customers[0], ...body, id: randomUUID(), code: body.code || `KH${String(customers.length + 1).padStart(6, '0')}`, customer_group_id: body.customer_group_id ?? 'cg-retail' }
        customers.push(created)
        return { found: true, data: created, status: 201 }
      },
      previewKiotVietCustomerImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietCustomerRows(customerImportRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietCustomerImport({
            organizationId: currentUser.organization.id,
            repository: customerImportRepository(repository),
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietCustomers: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietCustomerRows(customerImportRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietCustomerImport({
            organizationId: currentUser.organization.id,
            repository: customerImportRepository(repository),
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      deleteImportedKiotVietCustomers: async () => {
        const result = await customerImportRepository(repository).deleteImportedKiotVietCustomers({ organizationId: currentUser.organization.id })
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      customerRecentPrices: async () => ({ found: true, data: { items: [{ unitPrice: 600000, soldAt: nowIso, orderCode: 'HD0001' }] } }),
      resolvePricing: async () => {
        const body = await readJson(request)
        const productIds = Array.isArray(body.product_ids) ? body.product_ids : products.map((product) => product.id)
        const repositoryPrices = await repository.resolvePrices?.({
          organizationId: currentUser.organization.id,
          productIds: productIds.map(String),
          customerId: typeof body.customer_id === 'string' && body.customer_id.trim() ? body.customer_id.trim() : null,
        })
        if (repositoryPrices) {
          return {
            found: true,
            data: { items: repositoryPrices },
          }
        }
        return {
          found: true,
          data: { items: productIds.map((productId) => ({ product_id: productId, unit_price: 600000, price_source: 'default_price_list', price_list_id: 'pl-default' })) },
        }
      },
      priceLists: async () => ({
        found: true,
        data: { items: await repository.listPriceLists?.({ organizationId: currentUser.organization.id }) ?? priceLists },
      }),
      previewPriceFormula: async () => ({ found: true, data: { affected_count: 1, items: [{ product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, latest_purchase_cost: 250000, current_mode: 'manual', current_unit_price: 600000, computed_prices: [{ price_list_id: 'pl-default', price_list_name: 'Bang gia le', current_unit_price: 600000, computed_unit_price: 620000, delta: 20000 }] }] } }),
      applyPriceFormula: async () => ({ found: true, data: { formula_rule_id: randomUUID(), affected_count: 1 } }),
    },
  )
  if (catalogRoute.found) return catalogRoute

  const inventoryRoute = await handleInventoryRoute(
    { request, url, currentUser, repository },
    {
      listProducts: async () => {
        const items = filterInventoryProducts(url)
        return { found: true, data: { ...paged(items, page, pageSize), summary: inventoryProductListSummary(items) } }
      },
      getProduct: async () => ({ found: true, data: inventoryProducts.find((product) => product.product_id === getIdFromPath(path)) ?? inventoryProducts[0] }),
      adjustStock: async () => {
        const body = await readJson(request)
        const actualQty = Number(body.actual_qty)
        const reason = requiredString(body.reason, 'reason')
        if (!Number.isFinite(actualQty) || actualQty < 0) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'actual_qty must be a non-negative number.', { actual_qty: ['actual_qty must be a non-negative number.'] })
        }
        const item = await repository.adjustNormalProductStock?.({
          organizationId: currentUser.organization.id,
          productId: getIdFromPath(path) ?? '',
          actualQty,
          reason,
          createdBy: { id: currentUser.user.id, name: currentUser.user.display_name },
        }) ?? makeStocktake(currentUser.user)
        return item
          ? { found: true, data: item }
          : { found: true, data: { message: 'Product not found' }, status: 404 }
      },
      stockMovements: async () => {
        const repositoryMovements = await repository.listStockMovements?.({ organizationId: currentUser.organization.id, url })
        const productId = url.searchParams.get('product_id')
        const items = repositoryMovements ?? (productId ? stockMovements.filter((movement) => movement.product_id === productId) : stockMovements)
        return { found: true, data: paged(newestFirst(items), page, pageSize) }
      },
      stocktakes: async () => {
        const items = await repository.listStocktakes?.({ organizationId: currentUser.organization.id, url })
          ?? [makeStocktake(currentUser.user)]
        const creatorUrl = new URL(url)
        creatorUrl.searchParams.delete('created_by')
        const creatorItems = await repository.listStocktakes?.({ organizationId: currentUser.organization.id, url: creatorUrl })
          ?? items
        return { found: true, data: { ...paged(items, page, pageSize), creator_options: stocktakeCreatorOptions(creatorItems) } }
      },
      getStocktake: async () => {
        const item = await repository.getStocktake?.({ organizationId: currentUser.organization.id, id: getIdFromPath(path) ?? '' })
        return item
          ? { found: true, data: item }
          : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
      },
      updateStocktake: async () => {
        const body = await readJson(request)
        if (body.status === 'cancelled') {
          const item = await repository.cancelStocktake?.({
            organizationId: currentUser.organization.id,
            id: getIdFromPath(path) ?? '',
          })
          return item
            ? { found: true, data: item }
            : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
        }
        const item = await repository.updateStocktakeNote?.({
          organizationId: currentUser.organization.id,
          id: getIdFromPath(path) ?? '',
          note: nullableString(body.note),
        })
        return item
          ? { found: true, data: item }
          : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
      },
      rolls: async () => ({ found: true, data: paged([{ id: 'roll-1', product_id: 'product-decal', code: 'ROLL0001', width_m: 1.27, initial_length_m: 50, remaining_length_m: 42, initial_area_m2: 63.5, remaining_area_m2: 53.34, status: 'in_use', note: null, created_at: nowIso }], page, pageSize) }),
      sheets: async () => ({ found: true, data: paged([{ id: 'sheet-1', product_id: 'product-mica-3mm', code: 'SHEET0001', sheet_kind: 'full', width_m: 1.22, length_m: 2.44, area_m2: 2.9768, status: 'available', note: null, created_at: nowIso }], page, pageSize) }),
      shortagePreview: async () => ({ found: true, data: { product_id: products[0].id, quantity: 1, source: 'product', shortages: [], warnings: [] } }),
      previewKiotVietStocktakeImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietStocktakeRows(importRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietStocktakeImport({
            organizationId: currentUser.organization.id,
            repository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietStocktakes: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietStocktakeRows(importRowsFromBody(body))
        const allowPartial = Boolean(body.allow_partial)
        if (mapped.invalid.length > 0 && !allowPartial) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'KiotViet stocktake import has invalid rows.')
        }
        const cleanup = Boolean(body.cleanup_demo) && repository.deleteDemoStocktakesForImport
          ? await repository.deleteDemoStocktakesForImport({ organizationId: currentUser.organization.id })
          : { deleted: 0, blocked: 0 }
        const result = await repository.upsertImportedKiotVietStocktakes?.({
          organizationId: currentUser.organization.id,
          createdBy: null,
          rows: mapped.valid,
        }) ?? {
          stocktakes_created: 0,
          stocktakes_updated: 0,
          items_created: 0,
          items_updated: 0,
          missing_product_rows: 0,
        }
        return {
          found: true,
          data: {
            summary: {
              total_rows: mapped.valid.length + mapped.invalid.length,
              valid_rows: mapped.valid.length,
              invalid_rows: mapped.invalid.length,
              ...result,
              cleanup_deleted_rows: cleanup.deleted,
              cleanup_blocked_rows: cleanup.blocked,
              creates_stock_movements: false,
            },
            invalid_rows: mapped.invalid,
          },
        }
      },
      deleteImportedKiotVietStocktakes: async () => {
        const result = await repository.deleteImportedKiotVietStocktakes?.({ organizationId: currentUser.organization.id }) ?? { deleted: 0, blocked: 0 }
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      materialOpeningOptions: async () => ({ found: true, data: { product: { id: products[0].id, code: products[0].code, name: products[0].name, inventory_shape: 'sheet', stock_unit: { id: 'unit-sheet', code: 'TAM', name: 'tam' } }, conversions: [], warnings: [] } }),
      createMaterialOpening: async () => {
        const body = await readJson(request)
        const created = await repository.createMaterialOpening?.({
          organizationId: currentUser.organization.id,
          input: {
            product_id: requiredString(body.product_id, 'product_id'),
            inventory_shape: body.inventory_shape === 'roll' || body.inventory_shape === 'sheet' ? body.inventory_shape : 'normal',
            opened_unit_id: nullableString(body.opened_unit_id) ?? undefined,
            opened_qty: body.opened_qty === undefined ? undefined : Number(body.opened_qty),
            old_remaining_qty: body.old_remaining_qty === undefined ? undefined : Number(body.old_remaining_qty),
            old_inventory_roll_id: nullableString(body.old_inventory_roll_id) ?? undefined,
            old_remaining_length_m: body.old_remaining_length_m === undefined ? undefined : Number(body.old_remaining_length_m),
            old_inventory_sheet_id: nullableString(body.old_inventory_sheet_id) ?? undefined,
            old_remaining_width_m: body.old_remaining_width_m === undefined ? undefined : Number(body.old_remaining_width_m),
            discard_old_sheet: Boolean(body.discard_old_sheet),
            note: nullableString(body.note) ?? undefined,
          },
        }) ?? { id: randomUUID(), product_id: products[0].id, inventory_shape: 'normal', source_type: 'manual_normal', opened_unit_id: null, opened_qty: null, opened_stock_qty: null, stock_movement_id: null, warnings: [], created_at: nowIso }
        return { found: true, data: created, status: 201 }
      },
    },
  )
  if (inventoryRoute.found) return inventoryRoute

  const purchaseRoute = await handlePurchaseRoute(
    { request, url, currentUser, repository },
    {
      listSuppliers: async () => {
        const repositorySuppliers = await repository.listSuppliers?.({
          organizationId: currentUser.organization.id,
          url,
        })
        const items = repositorySuppliers ?? filterSuppliers(url)
        return { found: true, data: { ...paged(items, page, pageSize), summary: supplierListSummary(items) } }
      },
      previewKiotVietSupplierImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietSupplierRows(supplierImportRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietSupplierImport({
            organizationId: currentUser.organization.id,
            repository: supplierImportRepository(repository),
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietSuppliers: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietSupplierRows(supplierImportRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietSupplierImport({
            organizationId: currentUser.organization.id,
            repository: supplierImportRepository(repository),
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      deleteImportedKiotVietSuppliers: async () => {
        const result = await supplierImportRepository(repository).deleteImportedKiotVietSuppliers({ organizationId: currentUser.organization.id })
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      getSupplier: async () => {
        const repositorySuppliers = await repository.listSuppliers?.({
          organizationId: currentUser.organization.id,
          url: new URL('http://api.local/api/v1/suppliers?page=1&page_size=10000'),
        })
        return { found: true, data: repositorySuppliers?.find((supplier) => supplier.id === getIdFromPath(path)) ?? suppliers.find((supplier) => supplier.id === getIdFromPath(path)) ?? suppliers[0] }
      },
      createSupplier: async () => ({ found: true, data: { ...suppliers[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }),
      updateSupplier: async () => {
        const id = getIdFromPath(path) ?? ''
        const body = await readJson(request)
        const patch = supplierPatchFromBody(body)
        if (repository.updateSupplier) {
          const supplier = await repository.updateSupplier({ organizationId: currentUser.organization.id, id, patch })
          return supplier
            ? { found: true, data: supplier }
            : { found: true, data: { message: 'Supplier not found' }, status: 404 }
        }
        const index = suppliers.findIndex((supplier) => supplier.id === id)
        const current = index >= 0 ? suppliers[index] : suppliers[0]
        const nextLinkedCustomerId = patch.linked_customer_id !== undefined ? patch.linked_customer_id : current.linked_customer_id
        const linkedCustomer = nextLinkedCustomerId
          ? customers.find((customer) => customer.id === nextLinkedCustomerId) ?? null
          : null
        const updated = {
          ...current,
          ...patch,
          id,
          linked_customer_id: nextLinkedCustomerId ?? null,
          linked_customer: patch.linked_customer_id === undefined
            ? current.linked_customer
            : linkedCustomer
              ? { id: linkedCustomer.id, code: linkedCustomer.code, name: linkedCustomer.name }
              : null,
        }
        if (index >= 0) suppliers[index] = updated
        return { found: true, data: updated }
      },
      supplierPayableReceipts: async () => {
        const supplierId = getSupplierIdFromPath(path)
        const receiptUrl = new URL('http://api.local/api/v1/purchase/receipts')
        receiptUrl.searchParams.set('supplier_id', supplierId)
        receiptUrl.searchParams.set('status', 'posted')
        const repositoryReceipts = await repository.listPurchaseReceipts?.({
          organizationId: currentUser.organization.id,
          url: receiptUrl,
        })
        const items = (repositoryReceipts ?? filterPurchaseReceipts(receiptUrl))
          .filter((receipt) => receipt.remaining_amount > 0)
          .map((receipt) => ({
            id: receipt.id,
            code: receipt.code,
            supplier_document_no: receipt.supplier_document_no,
            received_at: receipt.received_at,
            payable_amount: receipt.payable_amount,
            paid_amount: receipt.paid_amount,
            remaining_amount: receipt.remaining_amount,
            paid_after_post_amount: Math.max(receipt.paid_amount, 0),
            outstanding_amount: receipt.remaining_amount,
          }))
        return { found: true, data: { items } }
      },
      paySupplier: async () => {
        const body = await readJson(request)
        const allocations = Array.isArray(body.allocations) ? body.allocations : []
        const firstAllocation = allocations.find((allocation): allocation is { purchase_receipt_id: string; amount?: number } => (
          allocation != null
          && typeof allocation === 'object'
          && 'purchase_receipt_id' in allocation
          && typeof allocation.purchase_receipt_id === 'string'
        ))
        const receipt = firstAllocation
          ? purchaseReceipts.find((item) => item.id === firstAllocation.purchase_receipt_id)
          : null
        const receiptCodeMatch = receipt?.code.match(/^PN(\d{6}(?:\.\d+)?)$/)
        const code = receiptCodeMatch
          ? `PCPN${receiptCodeMatch[1]}`
          : `PC${String(cashbookEntries.length + 1).padStart(6, '0')}`
        const amount = allocations.reduce((sum, allocation) => (
          allocation != null && typeof allocation === 'object' && 'amount' in allocation
            ? sum + Number(allocation.amount ?? 0)
            : sum
        ), 0)
        return { found: true, data: { supplier_payment_id: randomUUID(), code, amount, cashbook_voucher_id: randomUUID() }, status: 201 }
      },
      listReceipts: async () => {
        const repositoryReceipts = await repository.listPurchaseReceipts?.({
          organizationId: currentUser.organization.id,
          url,
        })
        const items = repositoryReceipts ?? filterPurchaseReceipts(url)
        return { found: true, data: { ...paged(items, page, pageSize), summary: purchaseReceiptListSummary(items) } }
      },
      previewKiotVietPurchaseReceiptImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietPurchaseReceiptRows(purchaseReceiptImportRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietPurchaseReceiptImport({
            organizationId: currentUser.organization.id,
            repository: repository as PurchaseReceiptImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietPurchaseReceipts: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietPurchaseReceiptRows(purchaseReceiptImportRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietPurchaseReceiptImport({
            organizationId: currentUser.organization.id,
            repository: repository as PurchaseReceiptImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      deleteImportedKiotVietPurchaseReceipts: async () => {
        const result = await repository.deleteImportedKiotVietPurchaseReceipts?.({ organizationId: currentUser.organization.id }) ?? { deleted: 0, blocked: 0 }
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      getReceipt: async () => {
        const repositoryReceipt = await repository.getPurchaseReceipt?.({
          organizationId: currentUser.organization.id,
          id: getIdFromPath(path) ?? '',
        })
        return { found: true, data: repositoryReceipt ?? purchaseReceipts.find((receipt) => receipt.id === getIdFromPath(path)) ?? purchaseReceipt }
      },
      createReceipt: async () => ({ found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: randomUUID() }, status: 201 }),
      updateReceipt: async () => ({ found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: getIdFromPath(path) } }),
      postReceipt: async () => ({ found: true, data: { purchase_receipt_id: path.split('/')[4], status: 'posted', posted_at: nowIso, cashbook_voucher_id: randomUUID() } }),
    },
  )
  if (purchaseRoute.found) return purchaseRoute

  const salesRoute = await handleSalesRoute(
    { request, url, currentUser, repository },
    {
      validateCart: async () => {
        const body = await readJson(request) as { items?: PosCartValidationLine[] }
        return { found: true, data: await validatePosCart(repository, currentUser.organization.id, body) }
      },
      checkout: async () => {
        const body = await readJson(request) as Parameters<typeof makeOrderFromCheckout>[0]
        const customer = await resolveSalesCustomer(repository, currentUser.organization.id, body.customer_id)
        const code = await nextSalesDocumentCode(repository, currentUser.organization.id, 'invoice')
        const seller = { id: currentUser.user.id, name: currentUser.user.display_name }
        const order = makeOrderFromCheckout(body, 'invoice', customer, code, seller)
        await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
        const paymentEntries = repository.saveSalesDocument ? previewCashbookEntriesFromCheckout(order, body.payment, seller) : addCashbookEntriesFromCheckout(order, body.payment, seller)
        if (repository.saveSalesDocument) {
          await repository.saveSalesDocument({ organizationId: currentUser.organization.id, document: order, cashbookEntries: paymentEntries })
        } else {
          salesDocuments.unshift(order)
          addCustomerSalesFromCheckout(order)
          addCustomerDebtFromCheckout(order)
        }
        return { found: true, data: { order: { id: order.id, code: order.code, order_type: 'invoice', status: 'completed', total_amount: order.total_amount, paid_amount: order.paid_amount, debt_amount: order.debt_amount, payment_status: order.payment_status }, payment_receipt: paymentEntries.length > 0 ? { id: paymentEntries[0].id, code: paymentEntries[0].code, total_received_amount: paymentEntries.reduce((sum, entry) => sum + entry.amount_delta, 0) } : null, inventory_warnings: [] }, status: 201 }
      },
      createQuote: async () => {
        const body = await readJson(request) as Parameters<typeof makeOrderFromCheckout>[0]
        const customer = await resolveSalesCustomer(repository, currentUser.organization.id, body.customer_id)
        const code = await nextSalesDocumentCode(repository, currentUser.organization.id, 'quote')
        const quote = makeOrderFromCheckout(body, 'quote', customer, code, { id: currentUser.user.id, name: currentUser.user.display_name })
        await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
        if (repository.saveSalesDocument) {
          await repository.saveSalesDocument({ organizationId: currentUser.organization.id, document: quote, cashbookEntries: [] })
        } else {
          salesDocuments.unshift(quote)
        }
        return { found: true, data: { id: quote.id, code: quote.code, order_type: 'quote', status: 'active', total_amount: quote.total_amount }, status: 201 }
      },
      reopenQuotePayload: async () => ({ found: true, data: makeQuoteReopenPayload(getIdFromPath(path) ?? 'quote-1') }),
      listSalesDocuments: async () => {
        if (repository.listSalesDocuments) {
          const items = await repository.listSalesDocuments({ organizationId: currentUser.organization.id, url })
          return { found: true, data: { ...paged(items, page, pageSize), summary: salesDocumentListSummary(items) } }
        }
        const items = filterSalesDocuments(url)
        return { found: true, data: { ...paged(items, page, pageSize), summary: salesDocumentListSummary(items) } }
      },
      getSalesDocument: async () => {
        const id = getIdFromPath(path) ?? ''
        if (repository.getSalesDocument) {
          const document = await repository.getSalesDocument({ organizationId: currentUser.organization.id, id })
          if (!document) return { found: true, data: { message: 'Sales document not found' }, status: 404 }
          const productCatalog = repository.listProducts
            ? await repository.listProducts({
                organizationId: currentUser.organization.id,
                url: new URL('http://api.local/api/v1/products?status=all&page=1&page_size=10000'),
              })
            : products
          return { found: true, data: makeSalesDocumentDetail(document, productCatalog) }
        }
        const document = salesDocuments.find((item) => item.id === id || item.code === id)
        if (!document) return { found: true, data: { message: 'Sales document not found' }, status: 404 }
        return { found: true, data: makeSalesDocumentDetail(document) }
      },
      updateSalesDocument: async () => {
        const id = getIdFromPath(path) ?? ''
        const body = await readJson(request)
        const productCatalog = async () => repository.listProducts
          ? repository.listProducts({
              organizationId: currentUser.organization.id,
              url: new URL('http://api.local/api/v1/products?status=all&page=1&page_size=10000'),
            })
          : products
        if (body.note !== undefined && body.status === undefined) {
          if (repository.updateSalesDocumentNote) {
            const document = await repository.updateSalesDocumentNote({
              organizationId: currentUser.organization.id,
              id,
              note: nullableString(body.note),
            })
            if (!document) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
            return { found: true, data: makeSalesDocumentDetail(document, await productCatalog()) }
          }
          const index = salesDocuments.findIndex((document) => document.id === id || document.code === id)
          if (index < 0) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
          salesDocuments[index] = { ...salesDocuments[index], note: nullableString(body.note) ?? '' }
          return { found: true, data: makeSalesDocumentDetail(salesDocuments[index]) }
        }
        if (body.status !== 'cancelled' || body.note !== undefined) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'Only sales document cancellation or note update is supported.')
        }
        if (repository.cancelSalesDocument) {
          const document = await repository.cancelSalesDocument({ organizationId: currentUser.organization.id, id })
          if (!document) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
          return { found: true, data: makeSalesDocumentDetail(document, await productCatalog()) }
        }
        const index = salesDocuments.findIndex((document) => document.id === id || document.code === id)
        if (index < 0) return { found: true, data: { code: 'NOT_FOUND', message: 'Sales document not found.' }, status: 404 }
        salesDocuments[index] = { ...salesDocuments[index], status: 'cancelled' }
        return { found: true, data: makeSalesDocumentDetail(salesDocuments[index]) }
      },
      previewKiotVietInvoiceImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietInvoiceRows(invoiceImportRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietInvoiceImport({
            organizationId: currentUser.organization.id,
            repository: repository as InvoiceImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietInvoices: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietInvoiceRows(invoiceImportRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietInvoiceImport({
            organizationId: currentUser.organization.id,
            repository: repository as InvoiceImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      deleteImportedKiotVietInvoices: async () => {
        const result = await repository.deleteImportedKiotVietInvoices?.({ organizationId: currentUser.organization.id }) ?? { deleted: 0, blocked: 0 }
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
    },
  )
  if (salesRoute.found) return salesRoute

  const financeRoute = await handleFinanceRoute(
    { request, url, currentUser, repository },
    {
      listAccounts: async () => ({
        found: true,
        data: { items: repository.listFinanceAccounts ? await repository.listFinanceAccounts({ organizationId: currentUser.organization.id, url }) : financeAccounts },
      }),
      createAccount: async () => {
        const body = await readJson(request) as Partial<FinanceAccountData>
        const account = financeAccountFromBody(body)
        if (repository.createFinanceAccount) {
          return {
            found: true,
            data: await repository.createFinanceAccount({ organizationId: currentUser.organization.id, account }),
            status: 201,
          }
        }
        const created = { ...account, id: randomUUID() }
        financeAccounts.push(created)
        return { found: true, data: created, status: 201 }
      },
      updateAccount: async () => {
        const id = getIdFromPath(path) ?? ''
        const body = await readJson(request) as Partial<FinanceAccountData>
        if (repository.updateFinanceAccount) {
          const updated = await repository.updateFinanceAccount({ organizationId: currentUser.organization.id, id, patch: body })
          if (updated === null) return { found: true, data: { message: 'Finance account not found' }, status: 404 }
          return { found: true, data: updated }
        }
        const index = financeAccounts.findIndex((account) => account.id === id)
        if (index === -1) return { found: true, data: { message: 'Finance account not found' }, status: 404 }
        financeAccounts[index] = { ...financeAccounts[index], ...body, id }
        return { found: true, data: financeAccounts[index] }
      },
      listCustomerDebts: async () => {
        if (repository.listCustomerDebts) {
          return { found: true, data: paged(await repository.listCustomerDebts({ organizationId: currentUser.organization.id, url }), page, pageSize) }
        }
        return { found: true, data: paged(filterCustomerDebts(url), page, pageSize) }
      },
      getCustomerDebt: async () => {
        const customerId = getFinanceCustomerId(path)
        if (repository.getCustomerDebt) {
          return { found: true, data: await repository.getCustomerDebt({ organizationId: currentUser.organization.id, customerId }) }
        }
        return { found: true, data: makeCustomerDebtDetail(customerId) }
      },
      collectCustomerDebt: async () => {
        if (repository.collectCustomerDebt) {
          const body = await readJson(request) as {
            customer_id?: string
            amount?: number
            payment_method?: {
              cash_amount?: number
              bank_amount?: number
              bank_account_id?: string | null
              bank_transaction_ref?: string
            }
            note?: string
          }
          return {
            found: true,
            data: await repository.collectCustomerDebt({
              organizationId: currentUser.organization.id,
              customerId: body.customer_id ?? '',
              amount: Math.max(Number(body.amount ?? 0), 0),
              cashAmount: Math.max(Number(body.payment_method?.cash_amount ?? 0), 0),
              bankAmount: Math.max(Number(body.payment_method?.bank_amount ?? 0), 0),
              bankAccountId: body.payment_method?.bank_account_id,
              bankTransactionRef: body.payment_method?.bank_transaction_ref,
              note: body.note,
            }),
            status: 201,
          }
        }
        return { found: true, data: await collectCustomerDebt(request), status: 201 }
      },
      cashbookBalances: async () => ({ found: true, data: { items: financeAccounts.map((account) => ({ finance_account_id: account.id, code: account.code, name: account.name, account_type: account.account_type, balance: account.id === 'cash-main' ? 5700000 : 14000000 })) } }),
      cashbookVouchers: async () => ({ found: true, data: { items: cashbookEntries.filter((entry) => entry.source_type === 'cashbook_voucher').map((entry) => ({ id: entry.id, code: entry.code, source_type: 'manual_voucher', status: 'posted', amount: Math.abs(entry.amount_delta) })), total: cashbookEntries.filter((entry) => entry.source_type === 'cashbook_voucher').length } }),
      previewKiotVietCashbookImport: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietCashbookRows(cashbookImportRowsFromBody(body))
        return {
          found: true,
          data: await previewKiotVietCashbookImport({
            organizationId: currentUser.organization.id,
            repository: repository as CashbookImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      importKiotVietCashbook: async () => {
        const body = await readJson(request)
        const mapped = mapKiotVietCashbookRows(cashbookImportRowsFromBody(body))
        return {
          found: true,
          data: await applyKiotVietCashbookImport({
            organizationId: currentUser.organization.id,
            repository: repository as CashbookImportRepository,
            rows: mapped.valid,
            invalidRows: mapped.invalid,
          }),
        }
      },
      deleteImportedKiotVietCashbook: async () => {
        const result = await repository.deleteImportedKiotVietCashbook?.({ organizationId: currentUser.organization.id }) ?? { deleted: 0, blocked: 0 }
        return { found: true, data: { deleted_rows: result.deleted, blocked_rows: result.blocked } }
      },
      listCashbook: async () => {
        const entriesUrl = cashbookEntriesUrl(url)
        const entries = repository.listCashbookEntries
          ? await repository.listCashbookEntries({ organizationId: currentUser.organization.id, url: entriesUrl })
          : filterCashbookEntries(entriesUrl)
        const summarySourceUrl = cashbookSummarySourceUrl(url)
        const summarySourceEntries = summarySourceUrl
          ? repository.listCashbookEntries
            ? await repository.listCashbookEntries({ organizationId: currentUser.organization.id, url: summarySourceUrl })
            : filterCashbookEntries(summarySourceUrl)
          : entries
        return { found: true, data: { ...paged(entries, page, pageSize), summary: cashbookListSummary(entries, { from: url.searchParams.get('from'), sourceEntries: summarySourceEntries }) } }
      },
      getCashbookEntry: async () => {
        const id = getIdFromPath(path) ?? ''
        if (repository.getCashbookEntry) {
          const entry = await repository.getCashbookEntry({ organizationId: currentUser.organization.id, id })
          if (entry === null) return { found: true, data: { message: 'Cashbook entry not found' }, status: 404 }
          return {
            found: true,
            data: await enrichCashbookEntryDetail(entry, async (code) => {
              const directDocument = await repository.getSalesDocument?.({ organizationId: currentUser.organization.id, id: code })
              if (directDocument) return directDocument
              const searchUrl = new URL('http://api.local/api/v1/sales-documents')
              searchUrl.searchParams.set('search', code)
              searchUrl.searchParams.set('type', 'invoice')
              const documents = await repository.listSalesDocuments?.({ organizationId: currentUser.organization.id, url: searchUrl })
              return documents?.find((document) => document.code === code) ?? null
            }),
          }
        }
        const entry = cashbookEntries.find((item) => item.id === id) ?? cashbookEntries[0]
        return {
          found: true,
          data: await enrichCashbookEntryDetail(entry, async (code) => (
            salesDocuments.find((document) => document.code === code) ?? null
          )),
        }
      },
      createCashbookVoucher: async () => ({ found: true, data: { id: randomUUID(), code: 'PC0002', source_type: 'manual_voucher', status: 'posted', amount: Number((await readJson(request)).amount ?? 0) }, status: 201 }),
      cancelCashbookVoucher: async () => ({ found: true, data: { id: path.split('/')[4], code: 'PC0001', source_type: 'manual_voucher', status: 'cancelled', amount: 1000000 } }),
      reviseCashbookVoucher: async () => ({ found: true, data: { id: path.split('/')[4], code: 'PC0001', source_type: 'manual_voucher', status: 'posted', amount: 1000000 } }),
    },
  )
  if (financeRoute.found) return financeRoute

  const productionRoute = await handleProductionRoute(
    { request, url, currentUser, repository },
    {
      listQueue: async () => ({ found: true, data: paged(newestFirst(productionQueueItems), page, pageSize) }),
      history: async () => ({ found: true, data: paged([], page, pageSize) }),
      addToDraft: async () => ({ found: true, data: { queue_item_id: path.split('/')[4], customer: defaultRetailCustomer(), draft_line: { product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, unit_name: products[0].unit_name, sell_method: products[0].sell_method, width_m: 1.2, height_m: 0.8, linear_m: null, quantity: 1, source: 'production_queue' } } }),
      setVisibility: async () => ({ found: true, data: {} }),
    },
  )
  if (productionRoute.found) return productionRoute

  return { found: false }
}

async function makeUserResponseFromBody(body: Record<string, unknown>): Promise<UserListItemData> {
  return {
    id: randomUUID(),
    email: String(body.email ?? 'user@qc-oms.local'),
    username: nullableString(body.username),
    phone: nullableString(body.phone),
    birthday: nullableString(body.birthday),
    region: nullableString(body.region),
    ward: nullableString(body.ward),
    address: nullableString(body.address),
    note: nullableString(body.note),
    display_name: String(body.display_name ?? body.email ?? 'User'),
    status: body.status === 'inactive' ? 'inactive' : 'active',
    permissions: normalizePermissions(body.permissions),
  }
}

function enrichCurrentUser(currentUser: CurrentUserData, profilePatch: Record<string, unknown> = {}): CurrentUserData {
  return {
    ...currentUser,
    profile: {
      username: 'admin',
      phone: null,
      email: currentUser.user.email,
      birthday: null,
      region: null,
      ward: null,
      address: null,
      note: null,
      ...profilePatch,
    },
    devices: [
      {
        id: 'device-current',
        device_name: 'NAS dev browser',
        device_type: 'desktop',
        browser_name: 'Chrome',
        os_name: 'Windows',
        ip_address: null,
        last_seen_at: nowIso,
        created_at: nowIso,
        is_current_device: true,
        status: 'active',
      },
    ],
    permissions: currentUser.permissions.length > 0 ? currentUser.permissions : allPermissions.map((permission) => permission.code),
  }
}

function toUserListItem(currentUser: CurrentUserData) {
  return {
    id: currentUser.user.id,
    email: currentUser.user.email,
    username: 'admin',
    phone: null,
    birthday: null,
    region: null,
    ward: null,
    address: null,
    note: null,
    display_name: currentUser.user.display_name,
    status: 'active',
    permissions: enrichCurrentUser(currentUser).permissions,
  }
}

function paged<T>(items: readonly T[], page: number, pageSize: number) {
  const start = Math.max(0, page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, page_size: pageSize, total: items.length }
}

function salesDocumentListSummary(items: readonly SalesDocumentData[]) {
  return {
    total_amount: items.reduce((sum, item) => sum + item.total_amount, 0),
    debt_amount: items.reduce((sum, item) => sum + item.debt_amount, 0),
  }
}

function customerListSummary(items: readonly CustomerListData[]) {
  return {
    total_debt_amount: items.reduce((sum, item) => sum + item.total_debt_amount, 0),
    total_sales_amount: items.reduce((sum, item) => sum + item.total_sales_amount, 0),
  }
}

function supplierListSummary(items: readonly SupplierListData[]) {
  return {
    current_payable_amount: items.reduce((sum, item) => sum + item.current_payable_amount, 0),
    total_purchase_amount: items.reduce((sum, item) => sum + item.total_purchase_amount, 0),
  }
}

function purchaseReceiptListSummary(items: readonly PurchaseReceiptData[]) {
  return {
    payable_amount: items.reduce((sum, item) => sum + item.payable_amount, 0),
    remaining_amount: items.reduce((sum, item) => sum + item.remaining_amount, 0),
  }
}

function inventoryProductListSummary(items: ReadonlyArray<{ available_qty: number; is_negative: boolean }>) {
  return {
    total_qty: items.reduce((sum, item) => sum + item.available_qty, 0),
    negative_count: items.filter((item) => item.is_negative).length,
  }
}

function cashbookSummarySourceUrl(url: URL) {
  if (!url.searchParams.get('from')) return null
  const summaryUrl = new URL(url)
  summaryUrl.searchParams.delete('from')
  summaryUrl.searchParams.delete('to')
  return summaryUrl
}

function cashbookEntriesUrl(url: URL) {
  const entriesUrl = new URL(url)
  if (entriesUrl.searchParams.get('finance_account_type') === 'bank' && !entriesUrl.searchParams.get('finance_account_id')) {
    entriesUrl.searchParams.set('exclude_replaced_deleted_accounts', 'true')
  }
  return entriesUrl
}

function cashbookListSummary(items: readonly CashbookEntryData[], options: { from?: string | null; sourceEntries?: readonly CashbookEntryData[] } = {}) {
  const fromDate = displayDateKey(options.from)
  const openingBalance = fromDate
    ? (options.sourceEntries ?? items)
      .filter((item) => displayDateKey(item.created_at) < fromDate)
      .reduce((sum, item) => sum + item.amount_delta, 0)
    : 0
  const totalIn = items.reduce((sum, item) => sum + Math.max(item.amount_delta, 0), 0)
  const totalOut = items.reduce((sum, item) => sum + Math.max(-item.amount_delta, 0), 0)
  return {
    opening_balance: openingBalance,
    total_in: totalIn,
    total_out: totalOut,
    ending_balance: openingBalance + totalIn - totalOut,
  }
}

function stocktakeCreatorOptions(items: readonly StocktakeListData[]) {
  const creators = new Map<string, string>()
  for (const item of items) {
    if (!item.created_by) continue
    creators.set(item.created_by.id, item.created_by.name)
  }
  return [...creators.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
}

function getIdFromPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) === 'post' || parts.at(-1) === 'bom' || parts.at(-1) === 'permissions' ? parts.at(-2) : parts.at(-1)
}

function getSupplierIdFromPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  const supplierIndex = parts.indexOf('suppliers')
  return supplierIndex >= 0 ? parts.at(supplierIndex + 1) ?? '' : ''
}

function getFinanceCustomerId(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts.at(-2) ?? 'customer-an'
}

function financeAccountFromBody(body: Partial<FinanceAccountData>): Omit<FinanceAccountData, 'id'> {
  const accountType = body.account_type === 'cash' ? 'cash' : 'bank'
  return {
    code: requiredString(body.code, 'code'),
    name: requiredString(body.name, 'name'),
    account_type: accountType,
    is_default_cash: Boolean(body.is_default_cash),
    is_active: body.is_active ?? true,
    account_number: body.account_number ?? null,
    account_holder: body.account_holder ?? null,
    opening_balance: Number(body.opening_balance ?? 0),
    note: body.note ?? null,
    notify_on_transaction: Boolean(body.notify_on_transaction),
  }
}

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) return allPermissions.map((permission) => permission.code)
  return value.filter((permission): permission is PermissionCode => typeof permission === 'string' && permission.startsWith('perm.'))
}

function requiredString(value: unknown, field: string) {
  const result = String(value ?? '').trim()
  if (!result) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required.`, { [field]: [`${field} is required.`] })
  return result
}

function nullableString(value: unknown) {
  const result = String(value ?? '').trim()
  return result ? result : null
}

function makeInternalUserEmail(username: string) {
  const normalized = username.trim().toLowerCase()
  const safeLocalPart = normalized.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  if (safeLocalPart && safeLocalPart === normalized) return `${safeLocalPart}@users.qcvl.local`
  const digest = createHash('sha1').update(username).digest('hex').slice(0, 10)
  return `${safeLocalPart || 'user'}-${digest}@users.qcvl.local`
}

function makeStocktake(createdBy: { id: string; display_name?: string; name?: string } = { id: 'admin', name: 'Admin' }) {
  const creatorName = createdBy.display_name ?? createdBy.name ?? createdBy.id
  return {
    id: randomUUID(),
    code: 'KK0001',
    status: 'balanced',
    source_type: 'manual',
    created_at: nowIso,
    balanced_at: nowIso,
    created_by: { id: createdBy.id, name: creatorName },
    total_actual_qty: 1,
    total_actual_value: 250000,
    total_difference_value: 0,
    increased_qty: 0,
    decreased_qty: 0,
    product_system_qty: 0,
    product_actual_qty: 1,
    product_difference_qty: 1,
    note: null,
  }
}

function makeQuoteReopenPayload(quoteId: string) {
  const customer = defaultRetailCustomer()
  return {
    quote: { id: quoteId, code: 'BG0001', status: 'active' },
    customer: { customer_id: customer.id, snapshot: { code: customer.code, name: customer.name, phone: customer.phone }, warnings: [] },
    price_list: { price_list_id: 'pl-default', snapshot: { code: 'BG-LE', name: 'Bang gia le' }, warnings: [] },
    items: [
      {
        order_item_id: 'quote-item-1',
        product_id: products[0].id,
        product_snapshot: { code: products[0].code, name: products[0].name, unit_name: products[0].unit_name, sell_method: products[0].sell_method },
        quantity: 1,
        width_m: null,
        height_m: null,
        linear_m: null,
        unit_price: 600000,
        discount_amount: 0,
        price_source: 'default_price_list',
        note: null,
        warnings: [],
      },
    ],
    summary: { subtotal_amount: 600000, discount_amount: 0, total_amount: 600000 },
    note: null,
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function supplierPatchFromBody(body: Record<string, unknown>) {
  return {
    ...(body.code === undefined ? {} : { code: String(body.code).trim() }),
    ...(body.name === undefined ? {} : { name: String(body.name).trim() }),
    ...(body.phone === undefined ? {} : { phone: nullableString(body.phone) }),
    ...(body.email === undefined ? {} : { email: nullableString(body.email) }),
    ...(body.address === undefined ? {} : { address: nullableString(body.address) }),
    ...(body.tax_code === undefined ? {} : { tax_code: nullableString(body.tax_code) }),
    ...(body.linked_customer_id === undefined ? {} : { linked_customer_id: nullableString(body.linked_customer_id) }),
    ...(body.notes === undefined ? {} : { notes: nullableString(body.notes) }),
    ...(body.status === undefined ? {} : { status: String(body.status) }),
  }
}

function importRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietProductWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function customerImportRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietCustomerWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function supplierImportRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietSupplierWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function purchaseReceiptImportRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietPurchaseReceiptWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function invoiceImportRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietInvoiceWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function cashbookImportRowsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) return body.rows
  if (typeof body.file_base64 === 'string' && body.file_base64.trim() !== '') {
    return parseKiotVietCashbookWorkbookBuffer(Buffer.from(body.file_base64, 'base64'))
  }
  return []
}

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolvePromise, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolvePromise(derivedKey)
    })
  })
}

