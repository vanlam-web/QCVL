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

const products = [
  {
    id: 'product-mica-3mm',
    code: 'MICA-3MM',
    name: 'Mica trong 3mm',
    status: 'active',
    product_kind: 'sheet',
    unit_name: 'tam',
    sell_method: 'sheet',
    latest_purchase_cost: 250000,
    latest_purchase_cost_at: nowIso,
    product_group_id: 'pg-mica',
    product_group: { id: 'pg-mica', code: 'MICA', name: 'Mica' },
    inventory_shape: 'sheet',
    track_inventory: true,
    unit_conversions: [],
  },
  {
    id: 'product-decal',
    code: 'DECAL-PP',
    name: 'Decal PP',
    status: 'active',
    product_kind: 'roll',
    unit_name: 'm2',
    sell_method: 'area_m2',
    latest_purchase_cost: 18000,
    latest_purchase_cost_at: nowIso,
    product_group_id: 'pg-mica',
    product_group: { id: 'pg-mica', code: 'MICA', name: 'Mica' },
    inventory_shape: 'roll',
    track_inventory: true,
    unit_conversions: [],
  },
  {
    id: 'product-cut',
    code: 'CUT-CNC',
    name: 'Cat CNC',
    status: 'active',
    product_kind: 'service',
    unit_name: 'lan',
    sell_method: 'quantity',
    latest_purchase_cost: null,
    latest_purchase_cost_at: null,
    product_group_id: 'pg-service',
    product_group: { id: 'pg-service', code: 'DV', name: 'Dich vu' },
    inventory_shape: 'normal',
    track_inventory: false,
    unit_conversions: [],
  },
] as const

const priceLists = [
  { id: 'pl-default', code: 'BG-LE', name: 'Bang gia le', is_default: true, is_active: true },
  { id: 'pl-vip', code: 'BG-SI', name: 'Bang gia si', is_default: false, is_active: true },
]

const customerGroups = [
  { id: 'cg-retail', code: 'LE', name: 'Khach le', price_list_id: 'pl-default', is_active: true },
  { id: 'cg-vip', code: 'SI', name: 'Khach si', price_list_id: 'pl-vip', is_active: true },
]

const customers = [
  {
    id: 'customer-an',
    code: 'KH0001',
    name: 'Cong ty An Phat',
    phone: '0909000001',
    tax_code: '0312345678',
    address: 'Binh Tan, TP.HCM',
    customer_group_id: 'cg-vip',
    customer_group: { id: 'cg-vip', code: 'SI', name: 'Khach si' },
    created_by: { id: 'admin', name: 'Admin' },
    created_at: nowIso,
    total_sales_amount: 2450000,
    total_debt_amount: 450000,
  },
  {
    id: 'customer-le',
    code: 'KH0002',
    name: 'Khach le',
    phone: null,
    tax_code: null,
    address: null,
    customer_group_id: 'cg-retail',
    customer_group: { id: 'cg-retail', code: 'LE', name: 'Khach le' },
    created_by: { id: 'admin', name: 'Admin' },
    created_at: nowIso,
    total_sales_amount: 680000,
    total_debt_amount: 0,
  },
]

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

const suppliers = [
  {
    id: 'supplier-minh',
    code: 'NCC0001',
    name: 'Vat tu Minh Phat',
    phone: '0911000001',
    email: 'minhphat@example.local',
    address: 'Quan 12, TP.HCM',
    tax_code: '0300000001',
    linked_customer_id: null,
    linked_customer: null,
    notes: null,
    status: 'active',
    current_payable_amount: 1200000,
    total_purchase_amount: 8200000,
  },
  {
    id: 'supplier-hung',
    code: 'NCC0002',
    name: 'Nhua Hung Thinh',
    phone: '0911000002',
    email: null,
    address: 'Tan Phu, TP.HCM',
    tax_code: null,
    linked_customer_id: null,
    linked_customer: null,
    notes: null,
    status: 'active',
    current_payable_amount: 0,
    total_purchase_amount: 3200000,
  },
] as const

const purchaseReceipt = {
  id: 'pr-0001',
  code: 'PN0001',
  supplier_id: 'supplier-minh',
  supplier: { id: 'supplier-minh', code: 'NCC0001', name: 'Vat tu Minh Phat' },
  received_at: nowIso,
  status: 'posted',
  supplier_document_no: 'HD-NCC-001',
  subtotal_amount: 2200000,
  discount_amount: 0,
  payable_amount: 2200000,
  paid_amount: 1000000,
  remaining_amount: 1200000,
  notes: null,
  created_by: 'Admin',
  created_at: nowIso,
  updated_at: nowIso,
  items: [
    {
      id: 'pr-item-1',
      product_id: 'product-mica-3mm',
      product: { id: 'product-mica-3mm', code: 'MICA-3MM', name: 'Mica trong 3mm' },
      line_no: 1,
      inventory_shape: 'sheet',
      unit_name_snapshot: 'tam',
      quantity: 8,
      unit_cost: 250000,
      discount_amount: 0,
      line_amount: 2000000,
      physical_payload: null,
    },
  ],
  supplier_payments: [],
}

const salesDocument = {
  id: 'order-0001',
  code: 'HD0001',
  order_type: 'invoice',
  status: 'completed',
  created_at: nowIso,
  customer: { id: 'customer-an', code: 'KH0001', name: 'Cong ty An Phat', phone: '0909000001' },
  seller: { id: 'admin', name: 'Admin' },
  subtotal_amount: 1200000,
  discount_amount: 50000,
  total_amount: 1150000,
  paid_amount: 700000,
  debt_amount: 450000,
  payment_status: 'partial',
  note: 'Don demo tren NAS',
}

const salesDocumentDetail = {
  ...salesDocument,
  price_list: { id: 'pl-default', code: 'BG-LE', name: 'Bang gia le' },
  change_returned_amount: 0,
  items: [
    {
      id: 'order-item-1',
      line_no: 1,
      product: { id: 'product-mica-3mm', code: 'MICA-3MM', name: 'Mica trong 3mm', unit_name: 'tam', sell_method: 'sheet' },
      quantity: 2,
      width_m: null,
      height_m: null,
      linear_m: null,
      unit_price: 600000,
      line_subtotal_amount: 1200000,
      discount_amount: 50000,
      line_total: 1150000,
      price_source: 'default_price_list',
      note: null,
    },
  ],
  payment_receipts: [],
  debt_entries: [
    {
      id: 'debt-1',
      entry_type: 'invoice_debt',
      amount_delta: 450000,
      balance_after_order: 450000,
      balance_after_customer: 450000,
      created_at: nowIso,
    },
  ],
  stock_movements: [
    { id: 'sm-1', product_id: 'product-mica-3mm', movement_type: 'sale', quantity_delta: -2, created_at: nowIso, unit_name: 'tam', note: null },
  ],
  history: [{ at: nowIso, action: 'created', actor_name: 'Admin', note: null }],
}

const inventoryProducts = products.map((product, index) => ({
  product_id: product.id,
  code: product.code,
  name: product.name,
  status: product.status,
  inventory_shape: product.inventory_shape,
  stock_unit: product.unit_name,
  available_qty: [18, 76.5, 0][index] ?? 0,
  is_negative: false,
}))

const stockMovements = [
  { id: 'sm-1', product_id: 'product-mica-3mm', movement_type: 'purchase', quantity_delta: 8, created_at: nowIso },
  { id: 'sm-2', product_id: 'product-mica-3mm', movement_type: 'sale', quantity_delta: -2, created_at: nowIso },
]

const cashbookEntries = [
  {
    id: 'cashbook-1',
    code: 'PT0001',
    status: 'posted',
    direction: 'in',
    amount_delta: 700000,
    finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
    is_business_accounted: true,
    source_type: 'payment_receipt_method',
    created_at: nowIso,
    note: 'Thu tien ban hang',
    counterparty: { type: 'customer', name: 'Cong ty An Phat', phone: '0909000001' },
  },
  {
    id: 'cashbook-2',
    code: 'PC0001',
    status: 'posted',
    direction: 'out',
    amount_delta: -1000000,
    finance_account: { id: 'bank-main', code: 'VCB', name: 'Vietcombank', account_type: 'bank' },
    is_business_accounted: true,
    source_type: 'cashbook_voucher',
    created_at: nowIso,
    note: 'Tra tien NCC',
    counterparty: { type: 'supplier', name: 'Vat tu Minh Phat', phone: '0911000001' },
  },
] as const

const productionQueueItems = [
  {
    id: 'pq-1',
    production_machine: { id: 'machine-1', code: 'CNC-01', name: 'May CNC 01' },
    raw_file_name: 'bang-hieu-an-phat.cdr',
    received_at: nowIso,
    status: 'queued',
    parse_status: 'ok',
    parse_error: null,
    parsed: { customer_code: 'KH0001', width_m: 1.2, height_m: 0.8 },
  },
] as const

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
  if (method === 'GET' && path === '/api/v1/products') return { found: true, data: paged(products, page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/products\/[^/]+\/bom$/.test(path)) return { found: true, data: null }
  if (method === 'POST' && path === '/api/v1/products') return { found: true, data: { ...products[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/products\/[^/]+$/.test(path)) return { found: true, data: { ...products[0], ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'PUT' && /^\/api\/v1\/products\/[^/]+\/bom$/.test(path)) {
    return { found: true, data: { id: randomUUID(), product_id: path.split('/')[4], version: 1, status: 'active', notes: null, created_at: nowIso, items: [] } }
  }

  if (method === 'GET' && path === '/api/v1/customer-groups') return { found: true, data: { items: customerGroups } }
  if (method === 'GET' && path === '/api/v1/customers') return { found: true, data: paged(customers, page, pageSize) }
  if (method === 'POST' && path === '/api/v1/customers') return { found: true, data: { ...customers[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }
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

  if (method === 'GET' && path === '/api/v1/inventory/products') return { found: true, data: paged(inventoryProducts, page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/inventory\/products\/[^/]+$/.test(path)) return { found: true, data: inventoryProducts.find((product) => product.product_id === getIdFromPath(path)) ?? inventoryProducts[0] }
  if (method === 'PATCH' && /^\/api\/v1\/inventory\/products\/[^/]+\/adjust-stock$/.test(path)) return { found: true, data: makeStocktake() }
  if (method === 'GET' && path === '/api/v1/inventory/stock-movements') return { found: true, data: paged(stockMovements, page, pageSize) }
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

  if (method === 'GET' && path === '/api/v1/suppliers') return { found: true, data: paged(suppliers, page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+$/.test(path)) return { found: true, data: suppliers.find((supplier) => supplier.id === getIdFromPath(path)) ?? suppliers[0] }
  if (method === 'POST' && path === '/api/v1/suppliers') return { found: true, data: { ...suppliers[0], ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/suppliers\/[^/]+$/.test(path)) return { found: true, data: { ...suppliers[0], ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+\/payable-receipts$/.test(path)) {
    return { found: true, data: { items: [{ id: purchaseReceipt.id, code: purchaseReceipt.code, supplier_document_no: purchaseReceipt.supplier_document_no, received_at: purchaseReceipt.received_at, payable_amount: purchaseReceipt.payable_amount, paid_amount: purchaseReceipt.paid_amount, remaining_amount: purchaseReceipt.remaining_amount, paid_after_post_amount: 0, outstanding_amount: purchaseReceipt.remaining_amount }] } }
  }
  if (method === 'POST' && /^\/api\/v1\/suppliers\/[^/]+\/payments$/.test(path)) return { found: true, data: { supplier_payment_id: randomUUID(), code: 'PC0002', amount: 100000, cashbook_voucher_id: randomUUID() }, status: 201 }

  if (method === 'GET' && path === '/api/v1/purchase/receipts') return { found: true, data: paged([purchaseReceipt], page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(path)) return { found: true, data: purchaseReceipt }
  if (method === 'POST' && path === '/api/v1/purchase/receipts') return { found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: randomUUID() }, status: 201 }
  if (method === 'PATCH' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(path)) return { found: true, data: { ...purchaseReceipt, ...(await readJson(request)), id: getIdFromPath(path) } }
  if (method === 'POST' && /^\/api\/v1\/purchase\/receipts\/[^/]+\/post$/.test(path)) return { found: true, data: { purchase_receipt_id: path.split('/')[4], status: 'posted', posted_at: nowIso, cashbook_voucher_id: randomUUID() } }

  if (method === 'POST' && path === '/api/v1/pos/cart/validate') return { found: true, data: { valid: true } }
  if (method === 'POST' && path === '/api/v1/orders/checkout') return { found: true, data: { order: { id: randomUUID(), code: 'HD0002', order_type: 'invoice', status: 'completed', total_amount: 0, paid_amount: 0, debt_amount: 0, payment_status: 'paid' }, payment_receipt: null, inventory_warnings: [] }, status: 201 }
  if (method === 'POST' && path === '/api/v1/orders/quotes') return { found: true, data: { id: randomUUID(), code: 'BG0001', order_type: 'quote', status: 'active', total_amount: 0 }, status: 201 }
  if (method === 'GET' && /^\/api\/v1\/orders\/quotes\/[^/]+\/reopen-payload$/.test(path)) return { found: true, data: makeQuoteReopenPayload(getIdFromPath(path) ?? 'quote-1') }

  if (method === 'GET' && path === '/api/v1/sales-documents') return { found: true, data: paged([salesDocument], page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/sales-documents\/[^/]+$/.test(path)) return { found: true, data: salesDocumentDetail }

  if (method === 'GET' && path === '/api/v1/finance/accounts') return { found: true, data: { items: financeAccounts } }
  if (method === 'GET' && path === '/api/v1/finance/customer-debts') return { found: true, data: paged([{ customer_id: 'customer-an', customer_code: 'KH0001', customer_name: 'Cong ty An Phat', total_debt: 450000, oldest_order_code: 'HD0001', open_invoice_count: 1 }], page, pageSize) }
  if (method === 'GET' && /^\/api\/v1\/finance\/customers\/[^/]+\/debt$/.test(path)) return { found: true, data: { customer_id: getFinanceCustomerId(path), total_debt: 450000, invoices: [{ order_id: 'order-0001', order_code: 'HD0001', created_at: nowIso, total_amount: 1150000, paid_amount: 700000, debt_amount: 450000, remaining_debt: 450000 }] } }
  if (method === 'POST' && path === '/api/v1/finance/debt-collections') return { found: true, data: { payment_receipt_id: randomUUID(), allocated_amount: 100000 }, status: 201 }
  if (method === 'GET' && path === '/api/v1/finance/cashbook/balances') return { found: true, data: { items: financeAccounts.map((account) => ({ finance_account_id: account.id, code: account.code, name: account.name, account_type: account.account_type, balance: account.id === 'cash-main' ? 5700000 : 14000000 })) } }
  if (method === 'GET' && path === '/api/v1/finance/cashbook/vouchers') return { found: true, data: { items: [{ id: 'voucher-1', code: 'PC0001', source_type: 'manual_voucher', status: 'posted', amount: 1000000 }], total: 1 } }
  if (method === 'GET' && path === '/api/v1/finance/cashbook') return { found: true, data: { summary: { opening_balance: 20000000, total_in: 700000, total_out: 1000000, ending_balance: 19700000 }, items: cashbookEntries, page, page_size: pageSize, total: cashbookEntries.length } }
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
  return { items, page, page_size: pageSize, total: items.length }
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
    'access-control-allow-headers': 'authorization,content-type,x-request-id,x-workstation-id',
    'content-type': 'application/json',
  })
  if (traceId) headers.set('x-request-id', traceId)
  return headers
}
