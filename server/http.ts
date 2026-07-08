import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

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

export interface WorkstationData {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive'
}

export interface ServerRepository {
  findUserByEmail(email: string): Promise<AuthUserRow | null>
  createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>
  deleteSession(token: string): Promise<void>
  getSessionUser(token: string, workstationId?: string | null): Promise<CurrentUserData | null>
  listWorkstations(organizationId: string): Promise<WorkstationData[]>
  getPosProductUsageCounts?(organizationId: string): Promise<Map<string, number>>
  recordPosProductUsage?(input: { organizationId: string; productIds: string[] }): Promise<void>
}

export interface HttpHandlerOptions {
  repository: ServerRepository
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
    product_group_id: isService ? 'pg-service' : 'pg-mica',
    product_group: isService ? { id: 'pg-service', code: 'DV', name: 'Dich vu' } : { id: 'pg-mica', code: 'MICA', name: 'Mica' },
    inventory_shape: inventoryShape,
    track_inventory: !isService,
    unit_conversions: [],
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

const customers = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1
  const isRetail = number === 1
  const vip = number % 4 === 0
  return {
    id: isRetail ? 'customer-retail' : `customer-${pad(number)}`,
    code: isRetail ? 'KH000001' : `DEV20-KH-${pad(number)}`,
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

const financeAccounts = [
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
] as const

const suppliers = Array.from({ length: 20 }, (_, index) => {
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
  }
})

const purchaseReceipts = Array.from({ length: 20 }, (_, index) => makePurchaseReceipt(index + 1))
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

const stockMovements = products.flatMap((product) => (
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
const customerDebtItems = customers
  .filter((customer) => customer.total_debt_amount > 0)
  .map((customer, index) => ({
    customer_id: customer.id,
    customer_code: customer.code,
    customer_name: customer.name,
    total_debt: customer.total_debt_amount,
    oldest_order_code: salesDocuments[index % salesDocuments.length].code,
    open_invoice_count: 1 + (index % 3),
  }))

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
    created_by: 'Admin',
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

function optionalNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function filterSalesDocuments(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')
  const customerId = url.searchParams.get('customer_id')
  const paymentStatus = url.searchParams.get('payment_status')

  return salesDocuments.filter((document) => {
    if (type && document.order_type !== type) return false
    if (status && document.status !== status) return false
    if (customerId && document.customer.id !== customerId) return false
    if (paymentStatus && document.payment_status !== paymentStatus) return false
    if (search) {
      const haystack = normalizeSearchText(`${document.code} ${document.customer.code ?? ''} ${document.customer.name} ${document.note ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

async function listProductsForRequest(url: URL, repository: ServerRepository, organizationId: string) {
  const filtered = filterProducts(url)
  if (url.searchParams.get('sort') !== 'pos_usage') return filtered

  const persistedUsage = await repository.getPosProductUsageCounts?.(organizationId)
  return sortProductsByUsage(filtered, persistedUsage ?? productUsageCounts())
}

function filterProducts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const status = url.searchParams.get('status')
  const sellMethod = url.searchParams.get('sell_method')
  const inventoryShape = url.searchParams.get('inventory_shape')
  const productKind = url.searchParams.get('product_kind')
  const productGroupId = url.searchParams.get('product_group_id')

  return products.filter((product) => {
    if (status && status !== 'all' && product.status !== status) return false
    if (sellMethod && product.sell_method !== sellMethod) return false
    if (inventoryShape && product.inventory_shape !== inventoryShape) return false
    if (productKind && product.product_kind !== productKind) return false
    if (productGroupId && product.product_group_id !== productGroupId) return false
    if (search) {
      const haystack = normalizeSearchText(`${product.code} ${product.name}`)
      if (!haystack.includes(search)) return false
    }
    return true
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

function filterCustomers(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const customerGroupId = url.searchParams.get('customer_group_id')

  return customers.filter((customer) => {
    if (customerGroupId && customerGroupId !== 'all' && customer.customer_group_id !== customerGroupId) return false
    if (search) {
      const haystack = normalizeSearchText(`${customer.code} ${customer.name} ${customer.phone ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

function filterInventoryProducts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const inventoryShape = url.searchParams.get('inventory_shape')

  return inventoryProducts.filter((product) => {
    if (status && status !== 'all' && product.status !== status) return false
    if (inventoryShape && inventoryShape !== 'all' && product.inventory_shape !== inventoryShape) return false
    if (search) {
      const haystack = normalizeSearchText(`${product.code} ${product.name} ${product.stock_unit}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

function filterSuppliers(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const totalPurchaseMin = optionalNumber(url.searchParams.get('total_purchase_min'))
  const totalPurchaseMax = optionalNumber(url.searchParams.get('total_purchase_max'))
  const currentPayableMin = optionalNumber(url.searchParams.get('current_payable_min'))
  const currentPayableMax = optionalNumber(url.searchParams.get('current_payable_max'))

  return suppliers.filter((supplier) => {
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
  })
}

function filterPurchaseReceipts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const createdBy = url.searchParams.get('created_by')

  return purchaseReceipts.filter((receipt) => {
    if (status && status !== 'all' && receipt.status !== status) return false
    if (dateFrom && receipt.received_at.slice(0, 10) < dateFrom) return false
    if (dateTo && receipt.received_at.slice(0, 10) > dateTo) return false
    if (createdBy && createdBy !== 'all' && receipt.created_by !== createdBy) return false
    if (search) {
      const haystack = normalizeSearchText(`${receipt.code} ${receipt.supplier.code} ${receipt.supplier.name} ${receipt.supplier_document_no ?? ''} ${receipt.notes ?? ''}`)
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

function filterCustomerDebts(url: URL) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')

  return customerDebtItems.filter((debt) => {
    if (!search) return true
    const haystack = normalizeSearchText(`${debt.customer_code} ${debt.customer_name} ${debt.oldest_order_code}`)
    return haystack.includes(search)
  })
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

  return cashbookEntries.filter((entry) => {
    if (financeAccountId && financeAccountId !== 'all' && entry.finance_account.id !== financeAccountId) return false
    if (financeAccountType && financeAccountType !== 'all' && entry.finance_account.account_type !== financeAccountType) return false
    if (direction && direction !== 'all' && entry.direction !== direction) return false
    if (status && status !== 'all' && entry.status !== status) return false
    if (isBusinessAccounted === 'true' && !entry.is_business_accounted) return false
    if (isBusinessAccounted === 'false' && entry.is_business_accounted) return false
    if (from && entry.created_at < from) return false
    if (to && entry.created_at > to) return false
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
  })
}

function makeOrderFromCheckout(body: {
  customer_id?: string
  note?: string
  items?: Array<{ product_id?: string; quantity?: number; unit_price?: number; discount_amount?: number }>
  payment?: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; change_returned_amount?: number; bank_account_id?: string | null }
}, orderType: 'invoice' | 'quote') {
  const number = salesDocuments.length + 1
  const customer = customers.find((item) => item.id === body.customer_id) ?? customers[0]
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
    id: `order-pos-${pad(number)}`,
    code: `${orderType === 'quote' ? 'BG-POS' : 'HD-POS'}-${pad(number)}`,
    order_type: orderType,
    status: orderType === 'quote' ? 'active' : 'completed',
    created_at: nowIso,
    customer: { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone },
    seller: { id: 'admin', name: 'Admin' },
    subtotal_amount: subtotal,
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    debt_amount: debtAmount,
    payment_status: orderType === 'quote' ? 'not_applicable' : debtAmount > 0 ? 'partial' : 'paid',
    note: body.note ?? '',
    items: checkoutProductIds(body).map((productId) => ({ product_id: productId })),
  }
}

function addCashbookEntriesFromCheckout(order: ReturnType<typeof makeOrderFromCheckout>, payment: { cash_amount?: number; bank_amount?: number; old_debt_payment_amount?: number; change_returned_amount?: number; bank_account_id?: string | null } = {}) {
  const entries: typeof cashbookEntries = []
  const cashAmount = Math.max(Number(payment.cash_amount ?? 0) - Number(payment.change_returned_amount ?? 0), 0)
  const bankAmount = Math.max(Number(payment.bank_amount ?? 0), 0)
  const methods = [
    { amount: cashAmount, account: financeAccounts[0] },
    { amount: bankAmount, account: financeAccounts.find((account) => account.id === payment.bank_account_id) ?? financeAccounts[1] },
  ]

  for (const method of methods) {
    if (method.amount <= 0) continue
    entries.push({
      id: `cashbook-pos-${randomUUID()}`,
      code: `PT-POS-${pad(cashbookEntries.length + entries.length + 1)}`,
      status: 'posted',
      direction: 'in',
      amount_delta: method.amount,
      finance_account: { id: method.account.id, code: method.account.code, name: method.account.name, account_type: method.account.account_type },
      is_business_accounted: true,
      source_type: 'payment_receipt_method',
      created_at: nowIso,
      note: `Thu tien ${order.code}`,
      counterparty: { type: 'customer', name: order.customer.name, phone: order.customer.phone },
    })
  }

  cashbookEntries.unshift(...entries)
  return entries
}

function makeSalesDocumentDetail(document: ReturnType<typeof makeSalesDocument>) {
  const product = products[0]
  return {
    ...document,
    price_list: { id: 'pl-default', code: 'BG-LE', name: 'Bang gia le' },
    change_returned_amount: 0,
    items: [
      {
        id: `${document.id}-item-1`,
        line_no: 1,
        product: { id: product.id, code: product.code, name: product.name, unit_name: product.unit_name, sell_method: product.sell_method },
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
      },
    ],
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
    stock_movements: [
      { id: `${document.id}-sm-1`, product_id: product.id, movement_type: 'sale', quantity_delta: -1, created_at: nowIso, unit_name: product.unit_name, note: null },
    ],
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
  const document = salesDocuments.find((item) => item.code === debt.oldest_order_code) ?? salesDocuments[0]
  return {
    customer_id: customerId,
    total_debt: debt.total_debt,
    invoices: [
      {
        order_id: document.id,
        order_code: document.code,
        created_at: nowIso,
        total_amount: document.total_amount,
        paid_amount: document.paid_amount,
        debt_amount: document.debt_amount,
        remaining_debt: debt.total_debt,
      },
    ],
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
          { status: 'ok', service: 'qcvl-api', version: options.version ?? 'dev' },
          traceId,
        )
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
        const body = await readJson(request)
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        const password = typeof body.password === 'string' ? body.password : ''
        const user = await options.repository.findUserByEmail(email)

        if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
          return failure(401, 'AUTH_REQUIRED', 'Invalid email or password.', traceId)
        }

        const token = createSessionToken()
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
        await options.repository.createSession({ token, userId: user.id, expiresAt })
        return success({ access_token: token, expires_at: expiresAt.toISOString() }, traceId)
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
        const token = getBearerToken(request)
        if (token) await options.repository.deleteSession(token)
        return success({}, traceId)
      }

      const currentUser = await requireCurrentUser(options.repository, request, traceId)
      const devResponse = await getDevApiResponse(request, url, currentUser, options.repository)
      if (devResponse.found) return success(devResponse.data, traceId, devResponse.status)

      return failure(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.', traceId)
    } catch (error) {
      if (error instanceof HttpError) {
        return failure(error.status, error.code, error.message, traceId)
      }
      console.error(error)
      return failure(500, 'INTERNAL_ERROR', 'An internal error occurred.', traceId)
    }
  }
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
  if (method === 'GET' && path === '/api/v1/users') return { found: true, data: { items: [toUserListItem(currentUser)], total: 1 } }
  if (method === 'GET' && /^\/api\/v1\/users\/[^/]+$/.test(path)) return { found: true, data: toUserListItem(currentUser) }
  if (method === 'POST' && path === '/api/v1/users') return { found: true, data: await makeUserResponse(request), status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/users\/[^/]+$/.test(path)) return { found: true, data: { ...toUserListItem(currentUser), ...(await readJson(request)) } }
  if (method === 'PUT' && /^\/api\/v1\/users\/[^/]+\/permissions$/.test(path)) {
    const body = await readJson(request)
    return { found: true, data: { ...toUserListItem(currentUser), permissions: normalizePermissions(body.permissions) } }
  }

  if (method === 'GET' && path === '/api/v1/product-groups') return { found: true, data: { items: productGroups } }
  if (method === 'GET' && path === '/api/v1/products') return { found: true, data: paged(await listProductsForRequest(url, repository, currentUser.organization.id), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/products\/[^/]+\/bom$/.test(path)) return { found: true, data: null }
  if (method === 'POST' && path === '/api/v1/products') return { found: true, data: { ...products[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/products\/[^/]+$/.test(path)) return { found: true, data: { ...products[0], ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'PUT' && /^\/api\/v1\/products\/[^/]+\/bom$/.test(path)) {
    return { found: true, data: { id: randomUUID(), product_id: path.split('/')[4], version: 1, status: 'active', notes: null, created_at: nowIso, items: [] } }
  }

  if (method === 'GET' && path === '/api/v1/customer-groups') return { found: true, data: { items: customerGroups } }
  if (method === 'GET' && path === '/api/v1/customers') return { found: true, data: paged(filterCustomers(url), page, pageSize) }
  if (method === 'POST' && path === '/api/v1/customers') {
    const body = await readJson(request) as { code?: string; name?: string; phone?: string; customer_group_id?: string | null }
    const created = { ...customers[0], ...body, id: randomUUID(), code: body.code || `KH${String(customers.length + 1).padStart(6, '0')}`, customer_group_id: body.customer_group_id ?? 'cg-retail' }
    customers.push(created)
    return { found: true, data: created, status: 201 }
  }
  if (method === 'GET' && /^\/api\/v1\/customers\/[^/]+\/products\/[^/]+\/recent-prices$/.test(path)) {
    return { found: true, data: { items: [{ unitPrice: 600000, soldAt: nowIso, orderCode: 'HD0001' }] } }
  }

  if (method === 'POST' && path === '/api/v1/pricing/resolve') {
    const body = await readJson(request)
    const productIds = Array.isArray(body.product_ids) ? body.product_ids : products.map((product) => product.id)
    return {
      found: true,
      data: { items: productIds.map((productId) => ({ product_id: productId, unit_price: 600000, price_source: 'default_price_list', price_list_id: 'pl-default' })) },
    }
  }
  if (method === 'GET' && path === '/api/v1/price-lists') return { found: true, data: { items: priceLists } }
  if (method === 'POST' && path === '/api/v1/price-lists/formulas/preview') {
    return { found: true, data: { affected_count: 1, items: [{ product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, latest_purchase_cost: 250000, current_mode: 'manual', current_unit_price: 600000, computed_prices: [{ price_list_id: 'pl-default', price_list_name: 'Bang gia le', current_unit_price: 600000, computed_unit_price: 620000, delta: 20000 }] }] } }
  }
  if (method === 'POST' && path === '/api/v1/price-lists/formulas/apply') return { found: true, data: { formula_rule_id: randomUUID(), affected_count: 1 } }

  if (method === 'GET' && path === '/api/v1/inventory/products') return { found: true, data: paged(filterInventoryProducts(url), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/inventory\/products\/[^/]+$/.test(path)) return { found: true, data: inventoryProducts.find((product) => product.product_id === getIdFromPath(path)) ?? inventoryProducts[0] }
  if (method === 'PATCH' && /^\/api\/v1\/inventory\/products\/[^/]+\/adjust-stock$/.test(path)) return { found: true, data: makeStocktake() }
  if (method === 'GET' && path === '/api/v1/inventory/stock-movements') {
    const productId = url.searchParams.get('product_id')
    const items = productId ? stockMovements.filter((movement) => movement.product_id === productId) : stockMovements
    return { found: true, data: paged(items, page, pageSize) }
  }
  if (method === 'GET' && path === '/api/v1/inventory/stocktakes') return { found: true, data: paged([makeStocktake()], page, pageSize) }
  if (method === 'GET' && path === '/api/v1/inventory/rolls') return { found: true, data: paged([{ id: 'roll-1', product_id: 'product-decal', code: 'ROLL0001', width_m: 1.27, initial_length_m: 50, remaining_length_m: 42, initial_area_m2: 63.5, remaining_area_m2: 53.34, status: 'in_use', note: null, created_at: nowIso }], page, pageSize) }
  if (method === 'GET' && path === '/api/v1/inventory/sheets') return { found: true, data: paged([{ id: 'sheet-1', product_id: 'product-mica-3mm', code: 'SHEET0001', sheet_kind: 'full', width_m: 1.22, length_m: 2.44, area_m2: 2.9768, status: 'available', note: null, created_at: nowIso }], page, pageSize) }
  if (method === 'POST' && path === '/api/v1/inventory/pos-shortage-preview') return { found: true, data: { product_id: products[0].id, quantity: 1, source: 'product', shortages: [], warnings: [] } }
  if (method === 'GET' && path === '/api/v1/inventory/material-openings/options') {
    return { found: true, data: { product: { id: products[0].id, code: products[0].code, name: products[0].name, inventory_shape: 'sheet', stock_unit: { id: 'unit-sheet', code: 'TAM', name: 'tam' } }, conversions: [], warnings: [] } }
  }
  if (method === 'POST' && path === '/api/v1/inventory/material-openings') {
    return { found: true, data: { id: randomUUID(), product_id: products[0].id, inventory_shape: 'normal', source_type: 'manual_normal', opened_unit_id: null, opened_qty: null, opened_stock_qty: null, stock_movement_id: null, warnings: [], created_at: nowIso }, status: 201 }
  }

  if (method === 'GET' && path === '/api/v1/suppliers') return { found: true, data: paged(filterSuppliers(url), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+$/.test(path)) return { found: true, data: suppliers.find((supplier) => supplier.id === getIdFromPath(path)) ?? suppliers[0] }
  if (method === 'POST' && path === '/api/v1/suppliers') return { found: true, data: { ...suppliers[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/suppliers\/[^/]+$/.test(path)) return { found: true, data: { ...suppliers[0], ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+\/payable-receipts$/.test(path)) {
    return { found: true, data: { items: purchaseReceipts.slice(0, 10).map((receipt) => ({ id: receipt.id, code: receipt.code, supplier_document_no: receipt.supplier_document_no, received_at: receipt.received_at, payable_amount: receipt.payable_amount, paid_amount: receipt.paid_amount, remaining_amount: receipt.remaining_amount, paid_after_post_amount: 0, outstanding_amount: receipt.remaining_amount })) } }
  }
  if (method === 'POST' && /^\/api\/v1\/suppliers\/[^/]+\/payments$/.test(path)) return { found: true, data: { supplier_payment_id: randomUUID(), code: 'PC0002', amount: 100000, cashbook_voucher_id: randomUUID() }, status: 201 }

  if (method === 'GET' && path === '/api/v1/purchase/receipts') return { found: true, data: paged(filterPurchaseReceipts(url), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(path)) return { found: true, data: purchaseReceipts.find((receipt) => receipt.id === getIdFromPath(path)) ?? purchaseReceipt }
  if (method === 'POST' && path === '/api/v1/purchase/receipts') return { found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(path)) return { found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'POST' && /^\/api\/v1\/purchase\/receipts\/[^/]+\/post$/.test(path)) return { found: true, data: { purchase_receipt_id: path.split('/')[4], status: 'posted', posted_at: nowIso, cashbook_voucher_id: randomUUID() } }

  if (method === 'POST' && path === '/api/v1/pos/cart/validate') return { found: true, data: { valid: true } }
  if (method === 'POST' && path === '/api/v1/orders/checkout') {
    const body = await readJson(request) as Parameters<typeof makeOrderFromCheckout>[0]
    const order = makeOrderFromCheckout(body, 'invoice')
    salesDocuments.unshift(order)
    await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
    const paymentEntries = addCashbookEntriesFromCheckout(order, body.payment)
    return { found: true, data: { order: { id: order.id, code: order.code, order_type: 'invoice', status: 'completed', total_amount: order.total_amount, paid_amount: order.paid_amount, debt_amount: order.debt_amount, payment_status: order.payment_status }, payment_receipt: paymentEntries.length > 0 ? { id: paymentEntries[0].id, code: paymentEntries[0].code, total_received_amount: paymentEntries.reduce((sum, entry) => sum + entry.amount_delta, 0) } : null, inventory_warnings: [] }, status: 201 }
  }
  if (method === 'POST' && path === '/api/v1/orders/quotes') {
    const body = await readJson(request) as Parameters<typeof makeOrderFromCheckout>[0]
    const quote = makeOrderFromCheckout(body, 'quote')
    salesDocuments.unshift(quote)
    await repository.recordPosProductUsage?.({ organizationId: currentUser.organization.id, productIds: checkoutProductIds(body) })
    return { found: true, data: { id: quote.id, code: quote.code, order_type: 'quote', status: 'active', total_amount: quote.total_amount }, status: 201 }
  }
  if (method === 'GET' && /^\/api\/v1\/orders\/quotes\/[^/]+\/reopen-payload$/.test(path)) return { found: true, data: makeQuoteReopenPayload(getIdFromPath(path) ?? 'quote-1') }

  if (method === 'GET' && path === '/api/v1/sales-documents') return { found: true, data: paged(filterSalesDocuments(url), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/sales-documents\/[^/]+$/.test(path)) return { found: true, data: makeSalesDocumentDetail(salesDocuments.find((document) => document.id === getIdFromPath(path)) ?? salesDocuments[0]) }

  if (method === 'GET' && path === '/api/v1/finance/accounts') return { found: true, data: { items: financeAccounts } }
  if (method === 'GET' && path === '/api/v1/finance/customer-debts') return { found: true, data: paged(filterCustomerDebts(url), page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/finance\/customers\/[^/]+\/debt$/.test(path)) return { found: true, data: makeCustomerDebtDetail(getFinanceCustomerId(path)) }
  if (method === 'POST' && path === '/api/v1/finance/debt-collections') return { found: true, data: { payment_receipt_id: randomUUID(), allocated_amount: 100000 }, status: 201 }
  if (method === 'GET' && path === '/api/v1/finance/cashbook/balances') return { found: true, data: { items: financeAccounts.map((account) => ({ finance_account_id: account.id, code: account.code, name: account.name, account_type: account.account_type, balance: account.id === 'cash-main' ? 5700000 : 14000000 })) } }
  if (method === 'GET' && path === '/api/v1/finance/cashbook/vouchers') return { found: true, data: { items: cashbookEntries.filter((entry) => entry.source_type === 'cashbook_voucher').map((entry) => ({ id: entry.id, code: entry.code, source_type: 'manual_voucher', status: 'posted', amount: Math.abs(entry.amount_delta) })), total: cashbookEntries.filter((entry) => entry.source_type === 'cashbook_voucher').length } }
  if (method === 'GET' && path === '/api/v1/finance/cashbook') {
    const entries = filterCashbookEntries(url)
    return { found: true, data: { summary: { opening_balance: 20000000, total_in: 700000, total_out: 1000000, ending_balance: 19700000 }, items: entries.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: entries.length } }
  }
  if (method === 'GET' && /^\/api\/v1\/finance\/cashbook\/[^/]+$/.test(path)) return { found: true, data: { ...cashbookEntries[0], created_by: { id: currentUser.user.id, name: currentUser.user.display_name }, payment_method: 'cash', source: { type: 'payment_receipt', id: 'receipt-1', code: 'PT0001', order_code: 'HD0001' }, allocations: [{ order_id: 'order-0001', order_code: 'HD0001', order_total_amount: 1150000, collected_before: 0, allocated_amount: 700000, remaining_after: 450000 }] } }
  if (method === 'POST' && path === '/api/v1/finance/cashbook-vouchers') return { found: true, data: { id: randomUUID(), code: 'PC0002', source_type: 'manual_voucher', status: 'posted', amount: Number((await readJson(request)).amount ?? 0) }, status: 201 }
  if (method === 'POST' && /^\/api\/v1\/finance\/cashbook-vouchers\/[^/]+\/cancel$/.test(path)) return { found: true, data: { id: path.split('/')[4], code: 'PC0001', source_type: 'manual_voucher', status: 'cancelled', amount: 1000000 } }
  if (method === 'POST' && /^\/api\/v1\/finance\/cashbook-vouchers\/[^/]+\/revise$/.test(path)) return { found: true, data: { id: path.split('/')[4], code: 'PC0001', source_type: 'manual_voucher', status: 'posted', amount: 1000000 } }

  if (method === 'GET' && path === '/api/v1/production-queue') return { found: true, data: paged(productionQueueItems, page, pageSize) }
  if (method === 'GET' && path === '/api/v1/production-queue/history') return { found: true, data: paged([], page, pageSize) }
  if (method === 'POST' && /^\/api\/v1\/production-queue\/[^/]+\/add-to-draft$/.test(path)) return { found: true, data: { queue_item_id: path.split('/')[4], customer: customers[0], draft_line: { product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, unit_name: products[0].unit_name, sell_method: products[0].sell_method, width_m: 1.2, height_m: 0.8, linear_m: null, quantity: 1, source: 'production_queue' } } }
  if (method === 'POST' && /^\/api\/v1\/production-queue\/[^/]+\/(dismiss|restore)$/.test(path)) return { found: true, data: {} }

  return { found: false }
}

async function makeUserResponse(request: Request) {
  const body = await readJson(request)
  return {
    id: randomUUID(),
    email: String(body.email ?? 'user@qc-oms.local'),
    username: null,
    phone: null,
    birthday: null,
    region: null,
    ward: null,
    address: null,
    note: null,
    display_name: String(body.display_name ?? body.email ?? 'User'),
    status: body.status ?? 'active',
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

function getIdFromPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) === 'post' || parts.at(-1) === 'bom' || parts.at(-1) === 'permissions' ? parts.at(-2) : parts.at(-1)
}

function getFinanceCustomerId(path: string) {
  return path.split('/')[4] ?? 'customer-an'
}

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) return allPermissions.map((permission) => permission.code)
  return value.filter((permission): permission is PermissionCode => typeof permission === 'string' && permission.startsWith('perm.'))
}

function makeStocktake() {
  return {
    id: randomUUID(),
    code: 'KK0001',
    status: 'balanced',
    source_type: 'manual',
    created_at: nowIso,
    balanced_at: nowIso,
    total_actual_qty: 1,
    total_actual_value: 250000,
    total_difference_value: 0,
    increased_qty: 0,
    decreased_qty: 0,
    note: null,
  }
}

function makeQuoteReopenPayload(quoteId: string) {
  return {
    quote: { id: quoteId, code: 'BG0001', status: 'active' },
    customer: { customer_id: customers[0].id, snapshot: { code: customers[0].code, name: customers[0].name, phone: customers[0].phone }, warnings: [] },
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

async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, version, n, r, p, salt, storedKey] = passwordHash.split(':')
  if (scheme !== 'scrypt' || version !== 'v1' || !salt || !storedKey) return false

  const key = await scrypt(password, salt, Buffer.from(storedKey, 'hex').length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  const expected = Buffer.from(storedKey, 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}

function createSessionToken() {
  return `${randomUUID()}.${randomBytes(32).toString('base64url')}`
}

async function requireCurrentUser(repository: ServerRepository, request: Request, traceId: string) {
  const token = getBearerToken(request)
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  const user = await repository.getSessionUser(token, request.headers.get('x-workstation-id'))
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  if (user.user.id.length === 0) {
    throw new HttpError(500, 'INTERNAL_ERROR', `Invalid current user for trace ${traceId}.`)
  }
  return user
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
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

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code:
      | 'AUTH_REQUIRED'
      | 'ACCOUNT_INACTIVE'
      | 'WORKSTATION_INVALID'
      | 'PERMISSION_DENIED'
      | 'VALIDATION_ERROR'
      | 'RESOURCE_CONFLICT'
      | 'RESOURCE_NOT_FOUND'
      | 'RATE_LIMITED'
      | 'INTERNAL_ERROR',
    message: string,
  ) {
    super(message)
  }
}

function success<T>(data: T, traceId: string, status = 200) {
  return jsonResponse({ success: true, data, trace_id: traceId }, status)
}

function failure(status: number, code: HttpError['code'], message: string, traceId: string) {
  return jsonResponse({ success: false, error: { code, message }, trace_id: traceId }, status)
}

function emptyResponse(traceId: string) {
  return new Response(null, { status: 204, headers: responseHeaders(traceId) })
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(),
  })
}

function responseHeaders(traceId?: string) {
  const headers = new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-request-id,x-client-device-id,x-workstation-id',
    'content-type': 'application/json',
  })
  if (traceId) headers.set('x-request-id', traceId)
  return headers
}
