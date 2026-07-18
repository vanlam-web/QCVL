import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { displayDateRangeMatches } from './date-filter.js'
import { hashPassword, type AuthUserRow, type CashbookEntryData, type CurrentUserData, type CustomerListData, type FinanceAccountData, type ProductGroupListData, type ProductListData, type PurchaseReceiptData, type SalesDocumentData, type SalesDocumentPaymentReceiptData, type ServerRepository, type StockMovementData, type StocktakeDetailData, type StocktakeListData, type SupplierListData, type UserListItemData } from './http.js'

const organization = { id: 'org-dev-memory', code: 'DEV', name: 'QCVL Dev' }
const defaultPriceList = { id: 'pl-dev-default', name: 'Bang gia le' }
const adminUser = {
  id: 'user-dev-admin',
  email: 'admin@qc-oms.local',
  organization_id: organization.id,
  display_name: 'Admin',
  status: 'active',
} satisfies Omit<AuthUserRow, 'password_hash'>

export async function createDevMemoryRepository(options: { stateFile?: string } = {}): Promise<ServerRepository & { close(): Promise<void> }> {
  const sessions = new Map<string, string>()
  const products = new Map<string, ProductListData>()
  const defaultSalePrices = new Map<string, number>()
  const priceListNames = new Map<string, { id: string; name: string }>([
    [priceListKey(defaultPriceList.name), defaultPriceList],
    [priceListKey('Bảng giá chung'), defaultPriceList],
  ])
  const namedSalePrices = new Map<string, Map<string, number>>()
  const provisionalStockBalances = new Map<string, { quantity: number; unit_name: string; source_label: string | null }>()
  const draftBoms = new Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>()
  const stocktakes = new Map<string, StocktakeListData>()
  const stocktakeItems = new Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>>()
  const purchaseReceipts = new Map<string, PurchaseReceiptData>()
  const purchaseReceiptItems = new Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'][number]>>()
  const salesDocuments = new Map<string, SalesDocumentData>()
  const salesDocumentItems = new Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]>>()
  const cashbookEntries = new Map<string, CashbookEntryData>()
  const financeAccounts = new Map<string, FinanceAccountData>([
    ['cash-main', { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash', is_default_cash: true, is_active: true, opening_balance: 0, note: null, notify_on_transaction: false }],
    ['bank-main', { id: 'bank-main', code: 'VCB', name: 'Vietcombank', account_type: 'bank', is_default_cash: false, is_active: true, account_number: '0000000000', account_holder: 'VAN LAM', opening_balance: 0, note: null, notify_on_transaction: true }],
  ])
  const customers = new Map<string, CustomerListData>()
  const suppliers = new Map<string, SupplierListData>()
  const customerGroupIds = new Map<string, string>()
  const customerGroupNamesById = new Map<string, string>()
  const users = new Map<string, UserListItemData>()
  const authUsers = new Map<string, AuthUserRow>()
  const userOrder: string[] = []
  const groupIds = new Map<string, string>()
  const groupNamesById = new Map<string, string>()
  const adminAuthUser: AuthUserRow = {
    ...adminUser,
    password_hash: await hashPassword(process.env.QCVL_DEV_PASSWORD ?? 'ChangeMe123!'),
  }
  seedAdminUser(adminAuthUser)

  function seedAdminUser(userRecord: AuthUserRow) {
    authUsers.set(userRecord.email, userRecord)
    users.set(userRecord.id, {
      id: userRecord.id,
      email: userRecord.email,
      username: 'admin',
      phone: null,
      birthday: null,
      region: null,
      ward: null,
      address: null,
      note: null,
      display_name: userRecord.display_name,
      status: userRecord.status,
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
    })
    if (!userOrder.includes(userRecord.id)) userOrder.push(userRecord.id)
  }

  if (options.stateFile) {
    await loadState(options.stateFile, {
      products,
      defaultSalePrices,
      priceListNames,
      namedSalePrices,
      provisionalStockBalances,
      draftBoms,
      stocktakes,
      stocktakeItems,
      purchaseReceipts,
      purchaseReceiptItems,
      salesDocuments,
      salesDocumentItems,
      cashbookEntries,
      financeAccounts,
      customers,
      suppliers,
      customerGroupIds,
      customerGroupNamesById,
      users,
      authUsers,
      userOrder,
      groupIds,
      groupNamesById,
    })
    if (!users.has(adminAuthUser.id)) seedAdminUser(adminAuthUser)
  }

  async function persist() {
    if (!options.stateFile) return
    await saveState(options.stateFile, {
      products,
      defaultSalePrices,
      priceListNames,
      namedSalePrices,
      provisionalStockBalances,
      draftBoms,
      stocktakes,
      stocktakeItems,
      purchaseReceipts,
      purchaseReceiptItems,
      salesDocuments,
      salesDocumentItems,
      cashbookEntries,
      financeAccounts,
      customers,
      suppliers,
      customerGroupIds,
      customerGroupNamesById,
      users,
      authUsers,
      userOrder,
      groupIds,
      groupNamesById,
    })
  }

  if (syncExactCustomerSupplierLinks(customers, suppliers) > 0) await persist()

  function activeAdminAuthUser() {
    return [...authUsers.values()].find((candidate) => candidate.id === adminAuthUser.id) ?? adminAuthUser
  }

  function currentUserSnapshot(): CurrentUserData {
    const activeAdmin = users.get(adminAuthUser.id)
    const authAdmin = activeAdminAuthUser()
    const adminPermissions: UserListItemData['permissions'] = [
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
    ]
    const currentAdminPermissions: UserListItemData['permissions'] = activeAdmin?.id === adminAuthUser.id
      ? Array.from(new Set([...(activeAdmin.permissions ?? []), ...adminPermissions]))
      : activeAdmin?.permissions ?? adminPermissions
    return {
      user: {
        id: adminAuthUser.id,
        email: activeAdmin?.email ?? authAdmin.email,
        display_name: activeAdmin?.display_name ?? authAdmin.display_name,
      },
      organization,
      workstation: { id: 'ws-dev', code: 'DEV', name: 'May dev' },
      permissions: currentAdminPermissions,
    }
  }

  return {
    async findUserByEmail(email) {
      const normalized = email.trim().toLowerCase()
      if (normalized === 'adminnas') return activeAdminAuthUser()
      return authUsers.get(normalized) ?? null
    },
    async findUserByLogin(login) {
      const normalized = login.trim().toLowerCase()
      if (normalized === 'adminnas') return activeAdminAuthUser()
      const byEmail = authUsers.get(normalized)
      if (byEmail) return byEmail
      const exactUsernameMatches = userOrder
        .map((id) => users.get(id))
        .filter((item): item is UserListItemData => Boolean(item))
        .filter((item) => item.username?.trim().toLowerCase() === normalized)
      if (exactUsernameMatches.length === 1) {
        return authUsers.get(exactUsernameMatches[0].email.trim().toLowerCase()) ?? null
      }
      if (exactUsernameMatches.length > 1) return null
      const phoneDigits = normalized.replace(/\D/g, '')
      const matches = userOrder
        .map((id) => users.get(id))
        .filter((item): item is UserListItemData => Boolean(item))
        .filter((item) => {
          if (item.username?.trim().toLowerCase() === normalized) return true
          return phoneDigits.length > 0 && (item.phone ?? '').replace(/\D/g, '') === phoneDigits
        })
      if (matches.length !== 1) return null
      return authUsers.get(matches[0].email.trim().toLowerCase()) ?? null
    },
    async createSession(input) {
      sessions.set(input.token, input.userId)
    },
    async deleteSession(token) {
      sessions.delete(token)
    },
    async getSessionUser(token) {
      return sessions.has(token) || token.trim().length > 0 ? currentUserSnapshot() : null
    },
    async listWorkstations() {
      return [{ id: 'ws-dev', code: 'DEV', name: 'May dev', status: 'active' }]
    },
    async getPosProductUsageCounts() {
      return posProductUsageCountsFromSalesDocuments(salesDocuments)
    },
    async recordPosProductUsage() {
      // Dev memory derives POS usage from saved sales documents, including imported history.
    },
    async listUsers(input) {
      const search = normalize(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      return userOrder
        .map((id) => users.get(id))
        .filter((item): item is UserListItemData => Boolean(item))
        .filter((item) => {
          if (status === 'active' || status === 'inactive') {
            if (item.status !== status) return false
          }
          if (!search) return true
          return normalize(`${item.display_name} ${item.email} ${item.username ?? ''} ${item.phone ?? ''}`).includes(search)
        })
    },
    async listFinanceAccounts(input) {
      const isActive = input.url.searchParams.get('is_active')
      const accountType = input.url.searchParams.get('account_type')
      return [...financeAccounts.values()]
        .filter((account) => isActive === null || String(account.is_active) === isActive)
        .filter((account) => !accountType || account.account_type === accountType)
        .sort((left, right) => {
          if (left.account_type !== right.account_type) return left.account_type === 'cash' ? -1 : 1
          return left.name.localeCompare(right.name, 'vi')
        })
    },
    async createFinanceAccount(input) {
      const id = input.account.id ?? `finance-account-${slug(`${input.account.account_type}-${input.account.account_number ?? input.account.code}`)}`
      const created = { ...input.account, id }
      financeAccounts.set(id, created)
      await persist()
      return created
    },
    async updateFinanceAccount(input) {
      const existing = financeAccounts.get(input.id)
      if (!existing) return null
      const updated = { ...existing, ...input.patch, id: existing.id }
      financeAccounts.set(input.id, updated)
      await persist()
      return updated
    },
    async createUser(input) {
      const normalizedEmail = input.email.trim().toLowerCase()
      const normalizedUsername = input.username?.trim().toLowerCase() ?? null
      const exists = [...users.values()].some((item) =>
        item.email.trim().toLowerCase() === normalizedEmail
        || (normalizedUsername && item.username?.trim().toLowerCase() === normalizedUsername),
      )
      if (exists) throw new Error('USER_ALREADY_EXISTS')
      const idBase = slug(input.username ?? input.displayName)
      const id = `user-dev-${idBase}-${users.size + 1}`
      const created: UserListItemData = {
        id,
        email: normalizedEmail,
        username: input.username,
        phone: input.phone,
        birthday: input.birthday,
        region: input.region,
        ward: input.ward,
        address: input.address,
        note: input.note,
        display_name: input.displayName,
        status: 'active',
        permissions: input.permissions,
      }
      users.set(id, created)
      userOrder.unshift(id)
      authUsers.set(normalizedEmail, {
        id,
        email: normalizedEmail,
        password_hash: input.passwordHash,
        organization_id: input.organizationId,
        display_name: input.displayName,
        status: 'active',
      })
      await persist()
      return created
    },
    async updateUser(input) {
      const item = users.get(input.id)
      if (!item) return null
      const nextEmail = input.email ?? item.email
      const normalizedEmail = nextEmail.trim().toLowerCase()
      const normalizedUsername = input.username?.trim().toLowerCase() ?? item.username?.trim().toLowerCase() ?? null
      const exists = [...users.values()].some((candidate) =>
        candidate.id !== input.id
        && (
          candidate.email.trim().toLowerCase() === normalizedEmail
          || (normalizedUsername && candidate.username?.trim().toLowerCase() === normalizedUsername)
        ),
      )
      if (exists) throw new Error('USER_ALREADY_EXISTS')
      const updated = {
        ...item,
        email: normalizedEmail,
        username: input.username ?? item.username,
        phone: input.phone !== undefined ? input.phone : item.phone,
        birthday: input.birthday ?? item.birthday,
        region: input.region ?? item.region,
        ward: input.ward ?? item.ward,
        address: input.address ?? item.address,
        note: input.note ?? item.note,
        display_name: input.displayName ?? item.display_name,
        status: input.status ?? item.status,
      }
      users.set(input.id, updated)
      const authUser = authUsers.get(item.email.trim().toLowerCase())
      if (authUser) {
        authUsers.delete(item.email.trim().toLowerCase())
        authUsers.set(normalizedEmail, {
          ...authUser,
          email: normalizedEmail,
          password_hash: input.passwordHash ?? authUser.password_hash,
          display_name: updated.display_name,
          status: updated.status,
        })
      }
      await persist()
      return updated
    },
    async replaceUserPermissions(input) {
      const item = users.get(input.id)
      if (!item) return null
      const updated = { ...item, permissions: input.permissions }
      users.set(input.id, updated)
      await persist()
      return updated
    },
    async listProductGroups() {
      return uniqueProductGroups([...groupNamesById.entries()]
        .map(([id, name]): ProductGroupListData => ({
          id,
          code: slug(name).toUpperCase(),
          name,
          is_default: name === 'Gia chung' || name === 'Giá chung',
          is_active: true,
        }))
        .sort((left, right) => Number(right.is_default) - Number(left.is_default) || left.name.localeCompare(right.name, 'vi')))
    },
    async updateProductGroup(input) {
      const currentName = groupNamesById.get(input.id)
      if (!currentName) return null
      const nextName = input.name.trim()
      if (!nextName) return null
      groupNamesById.set(input.id, nextName)
      groupIds.delete(currentName)
      groupIds.set(nextName, input.id)
      await persist()
      return {
        id: input.id,
        code: slug(nextName).toUpperCase(),
        name: nextName,
        is_default: nextName === 'Gia chung' || nextName === 'GiÃ¡ chung',
        is_active: true,
      }
    },
    async listProducts(input) {
      const search = normalize(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const sellMethod = input.url.searchParams.get('sell_method')
      const inventoryShape = input.url.searchParams.get('inventory_shape')
      const productKind = input.url.searchParams.get('product_kind')
      const productGroupIds = input.url.searchParams.getAll('product_group_id')
      const createdFrom = input.url.searchParams.get('created_from')
      const createdTo = input.url.searchParams.get('created_to')

      const operatingStock = operatingStockByProductId(stockMovementsFromDocuments(purchaseReceipts, purchaseReceiptItems, salesDocuments, salesDocumentItems, stocktakes, stocktakeItems, products, draftBoms))
      return [...products.values()].filter((product) => {
        if (status === 'deleted') {
          if (!/\{DEL\}/i.test(product.code)) return false
        } else if (status && status !== 'all') {
          if (product.status !== status || /\{DEL\}/i.test(product.code)) return false
        }
        if (sellMethod && product.sell_method !== sellMethod) return false
        if (inventoryShape && product.inventory_shape !== inventoryShape) return false
        if (productKind && product.product_kind !== productKind) return false
        if (productGroupIds.length > 0 && !productGroupIds.includes(product.product_group_id ?? '')) return false
        if (!dateRangeMatches(product.created_at, createdFrom, createdTo)) return false
      if (search && !normalize(`${product.code} ${product.name}`).includes(search)) return false
      return true
      }).map((product) => ({
        ...withImportReviewMetadata(product, provisionalStockBalances, draftBoms, operatingStock),
        price_list_prices: priceListPricesForProduct(product.code, defaultSalePrices, priceListNames, namedSalePrices),
      }))
    },
    async findProductsByCodes(input) {
      return new Set(input.codes.filter((code) => resolveProductByImportCode(products, code)))
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
      await persist()
      return { deleted: before - products.size, blocked: 0 }
    },
    async deleteImportedKiotVietProducts() {
      const deleted = products.size
      products.clear()
      defaultSalePrices.clear()
      namedSalePrices.clear()
      provisionalStockBalances.clear()
      draftBoms.clear()
      await persist()
      return { deleted, blocked: 0 }
    },
    async findDefaultPriceList() {
      return defaultPriceList
    },
    async listPriceLists() {
      const byId = new Map<string, { id: string; code: string; name: string; is_default: boolean; is_active: boolean }>()
      for (const priceList of priceListNames.values()) {
        byId.set(priceList.id, {
          id: priceList.id,
          code: priceList.id === defaultPriceList.id ? 'DEFAULT' : priceList.name,
          name: priceList.name,
          is_default: priceList.id === defaultPriceList.id,
          is_active: true,
        })
      }
      return [...byId.values()].sort((left, right) => Number(right.is_default) - Number(left.is_default) || left.name.localeCompare(right.name, 'vi'))
    },
    async resolvePrices(input) {
      const customer = input.customerId
        ? [...customers.values()].find((item) => item.id === input.customerId) ?? null
        : null
      const customerPriceListKey = customer?.customer_group?.name
        ? priceListKey(customer.customer_group.name)
        : null
      const customerPriceList = customerPriceListKey ? namedSalePrices.get(customerPriceListKey) ?? null : null
      const customerPriceListMeta = customerPriceListKey ? priceListNames.get(customerPriceListKey) ?? null : null

      return input.productIds.map((productId) => {
        const product = [...products.values()].find((item) => item.id === productId)
        const productCode = product?.code ?? productId
        const defaultPrice = defaultSalePrices.get(productCode) ?? product?.default_sale_price ?? 0
        const customerPrice = customerPriceList?.get(productCode)
        if (customerPrice !== undefined && customerPriceListMeta) {
          return {
            product_id: productId,
            unit_price: customerPrice,
            price_source: 'customer_group_price_list' as const,
            price_list_id: customerPriceListMeta.id,
          }
        }
        return {
          product_id: productId,
          unit_price: defaultPrice,
          price_source: customerPriceList ? (defaultPrice > 0 ? 'fallback_default_price_list' as const : 'default_price_list' as const) : 'default_price_list' as const,
          price_list_id: defaultPriceList.id,
        }
      })
    },
    async upsertProductGroupsByName(input) {
      for (const name of input.names) {
        if (!groupIds.has(name)) {
          const id = `pg-${slug(name)}`
          groupIds.set(name, id)
          groupNamesById.set(id, name)
        }
      }
      await persist()
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
      await persist()
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
      await persist()
      return { created, updated, skipped }
    },
    async upsertPriceListItemsByName(input) {
      let created = 0
      let updated = 0
      let skipped = 0
      for (const row of input.rows) {
        const product = products.get(row.product_code)
        if (!product) {
          skipped += 1
          continue
        }
        if (isDefaultSalePriceListName(row.price_list_name)) {
          if (defaultSalePrices.has(row.product_code)) updated += 1
          else created += 1
          defaultSalePrices.set(row.product_code, row.unit_price)
          products.set(row.product_code, { ...product, default_sale_price: row.unit_price, updated_at: new Date().toISOString() })
          continue
        }
        const key = priceListKey(row.price_list_name)
        if (!priceListNames.has(key)) {
          priceListNames.set(key, { id: `pl-${slug(row.price_list_name)}`, name: row.price_list_name })
        }
        const prices = namedSalePrices.get(key) ?? new Map<string, number>()
        if (prices.has(row.product_code)) updated += 1
        else created += 1
        prices.set(row.product_code, row.unit_price)
        namedSalePrices.set(key, prices)
      }
      await persist()
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
      await persist()
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
      await persist()
      return { created, updated, skipped }
    },
    async listCustomers(input) {
      const search = normalize(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const customerGroupId = input.url.searchParams.get('customer_group_id')
      const createdFrom = input.url.searchParams.get('created_from')
      const createdTo = input.url.searchParams.get('created_to')
      const createdBy = input.url.searchParams.get('created_by')
      const status = input.url.searchParams.get('status')
      return [...customers.values()]
        .filter((customer) => {
          const hydrated = hydrateCustomerCreator(customer, users)
          if (customerGroupId && customerGroupId !== 'all' && customer.customer_group_id !== customerGroupId) return false
          if (status && status !== 'all' && customer.status !== status) return false
          if (createdBy && createdBy !== 'all' && hydrated.created_by?.id !== createdBy) return false
          if (!dateRangeMatches(customer.created_at, createdFrom, createdTo)) return false
          if (search && !normalize(`${customer.code} ${customer.name} ${customer.phone ?? ''} ${customer.note ?? ''}`).includes(search)) return false
          return true
        })
        .map((customer) => hydrateCustomerLinkedSupplier(hydrateCustomerCreator(customerWithDisplaySalesAmount(customer), users), suppliers))
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    },
    async findCustomerByCode(input) {
      const customer = customers.get(input.code)
        ?? [...customers.values()].find((item) => normalize(item.code) === normalize(input.code))
        ?? null
      return customer ? hydrateCustomerLinkedSupplier(hydrateCustomerCreator(customer, users), suppliers) : null
    },
    async findCustomersByCodes(input) {
      return new Set(input.codes.filter((code) => customers.has(code)))
    },
    async upsertCustomerGroupsByName(input) {
      for (const name of input.names) {
        if (!name.trim()) continue
        if (!customerGroupIds.has(name)) {
          const id = `cg-${slug(name)}`
          customerGroupIds.set(name, id)
          customerGroupNamesById.set(id, name)
        }
      }
      await persist()
      return customerGroupIds
    },
    async upsertCustomersByCode(input) {
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const existing = customers.get(row.code)
        if (existing) updated += 1
        else created += 1
        customers.set(row.code, toCustomer(row, existing, customerGroupNamesById, users))
      }
      syncExactCustomerSupplierLinks(customers, suppliers)
      await persist()
      return { created, updated, skipped: 0 }
    },
    async deleteImportedKiotVietCustomers() {
      let deleted = 0
      for (const [code, customer] of customers.entries()) {
        if (normalize(code) === 'khachle' || normalize(customer.code) === 'khachle') continue
        if (!customer.id.startsWith('customer-kv-')) continue
        customers.delete(code)
        deleted += 1
      }
      await persist()
      return { deleted, blocked: 0 }
    },
    async listSuppliers(input) {
      const search = normalize(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const status = input.url.searchParams.get('status')
      const totalPurchaseMin = optionalNumber(input.url.searchParams.get('total_purchase_min'))
      const totalPurchaseMax = optionalNumber(input.url.searchParams.get('total_purchase_max'))
      const currentPayableMin = optionalNumber(input.url.searchParams.get('current_payable_min'))
      const currentPayableMax = optionalNumber(input.url.searchParams.get('current_payable_max'))
      return [...suppliers.values()]
        .filter((supplier) => {
          if (status && status !== 'all' && supplier.status !== status) return false
          if (totalPurchaseMin !== undefined && supplier.total_purchase_amount < totalPurchaseMin) return false
          if (totalPurchaseMax !== undefined && supplier.total_purchase_amount > totalPurchaseMax) return false
          if (currentPayableMin !== undefined && supplier.current_payable_amount < currentPayableMin) return false
          if (currentPayableMax !== undefined && supplier.current_payable_amount > currentPayableMax) return false
          if (search && !normalize(`${supplier.code} ${supplier.name} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.tax_code ?? ''} ${supplier.notes ?? ''}`).includes(search)) return false
          return true
        })
        .sort((left, right) => Date.parse(right.created_at ?? '') - Date.parse(left.created_at ?? ''))
    },
    async findSuppliersByCodes(input) {
      return new Set(input.codes.filter((code) => suppliers.has(code)))
    },
    async upsertSuppliersByCode(input) {
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const existing = suppliers.get(row.code)
        if (existing) updated += 1
        else created += 1
        suppliers.set(row.code, toSupplier(row, existing, customers))
      }
      await persist()
      return { created, updated, skipped: 0 }
    },
    async updateSupplier(input) {
      const existing = suppliers.get(input.id) ?? [...suppliers.values()].find((supplier) => supplier.id === input.id)
      if (!existing) return null
      const nextCode = input.patch.code ?? existing.code
      const nextLinkedCustomerId = input.patch.linked_customer_id !== undefined ? input.patch.linked_customer_id : existing.linked_customer_id ?? null
      const linkedCustomer = nextLinkedCustomerId ? [...customers.values()].find((customer) => customer.id === nextLinkedCustomerId) ?? null : null
      const updated: SupplierListData = {
        ...existing,
        code: nextCode,
        name: input.patch.name ?? existing.name,
        phone: input.patch.phone ?? existing.phone,
        email: input.patch.email ?? existing.email,
        address: input.patch.address ?? existing.address,
        tax_code: input.patch.tax_code ?? existing.tax_code,
        linked_customer_id: nextLinkedCustomerId,
        linked_customer: linkedCustomer ? { id: linkedCustomer.id, code: linkedCustomer.code, name: linkedCustomer.name } : null,
        notes: input.patch.notes ?? existing.notes,
        status: (input.patch.status as SupplierListData['status'] | undefined) ?? existing.status,
        current_payable_amount: existing.current_payable_amount,
        total_purchase_amount: existing.total_purchase_amount,
        created_at: existing.created_at,
        source_creator_name: existing.source_creator_name,
        source_created_at: existing.source_created_at,
        company_name: existing.company_name,
      }
      suppliers.delete(existing.code)
      suppliers.set(updated.code, updated)
      await persist()
      return updated
    },
    async deleteImportedKiotVietSuppliers() {
      let deleted = 0
      for (const [code, supplier] of suppliers.entries()) {
        if (!supplier.id.startsWith('supplier-kv-')) continue
        suppliers.delete(code)
        deleted += 1
      }
      await persist()
      return { deleted, blocked: 0 }
    },
    async findPurchaseReceiptsByCodes(input) {
      return new Set(input.codes.filter((code) => purchaseReceipts.has(code)))
    },
    async deleteImportedKiotVietPurchaseReceipts() {
      const deleted = purchaseReceipts.size
      purchaseReceipts.clear()
      purchaseReceiptItems.clear()
      await persist()
      return { deleted, blocked: 0 }
    },
    async upsertImportedKiotVietPurchaseReceipts(input) {
      let receiptsCreated = 0
      let receiptsUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let skippedRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        if (!suppliers.has(baseKiotVietImportCode(row.supplier_code)) || !resolveProductByImportCode(products, row.product_code)) {
          skippedRows += 1
          continue
        }
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      for (const [sourceCode, rows] of rowsBySourceCode) {
        const existing = purchaseReceipts.get(sourceCode)
        if (existing) receiptsUpdated += 1
        else receiptsCreated += 1

        const itemMap = purchaseReceiptItems.get(sourceCode) ?? new Map<number, typeof rows[number]>()
        for (const row of rows) {
          if (itemMap.has(row.rowNumber)) itemsUpdated += 1
          else itemsCreated += 1
          itemMap.set(row.rowNumber, row)
        }
        purchaseReceiptItems.set(sourceCode, itemMap)
        purchaseReceipts.set(sourceCode, toImportedPurchaseReceipt(sourceCode, itemMap, suppliers, products, users))
      }
      await persist()

      return {
        receipts_created: receiptsCreated,
        receipts_updated: receiptsUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        skipped_rows: skippedRows,
      }
    },
    async listPurchaseReceipts(input) {
      const search = normalize(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const status = input.url.searchParams.get('status')
      const dateFrom = input.url.searchParams.get('date_from')
      const dateTo = input.url.searchParams.get('date_to')
      const createdBy = input.url.searchParams.get('created_by')
      const supplierId = input.url.searchParams.get('supplier_id')
      const supplierCode = normalize(input.url.searchParams.get('supplier_code') ?? '')
      return [...purchaseReceipts.values()]
        .filter((receipt) => {
          if (status && status !== 'all' && receipt.status !== status) return false
          if (
            (supplierId || supplierCode) &&
            receipt.supplier_id !== supplierId &&
            receipt.supplier.id !== supplierId &&
            normalize(receipt.supplier.code) !== supplierCode
          ) return false
          if (!dateRangeMatches(receipt.received_at, dateFrom, dateTo)) return false
          if (createdBy && createdBy !== 'all' && receipt.created_by.id !== createdBy) return false
          if (search && !normalize(`${receipt.code} ${receipt.supplier.code} ${receipt.supplier.name} ${receipt.supplier_document_no ?? ''} ${receipt.notes ?? ''}`).includes(search)) return false
          return true
        })
        .sort((left, right) => Date.parse(right.received_at) - Date.parse(left.received_at))
    },
    async getPurchaseReceipt(input) {
      return [...purchaseReceipts.values()].find((receipt) => receipt.id === input.id || receipt.code === input.id) ?? null
    },
    async findSalesDocumentsByCodes(input) {
      return new Set(input.codes.filter((code) => salesDocuments.has(code)))
    },
    async deleteImportedKiotVietInvoices() {
      const deleted = salesDocuments.size
      salesDocuments.clear()
      salesDocumentItems.clear()
      await persist()
      return { deleted, blocked: 0 }
    },
    async upsertImportedKiotVietInvoices(input) {
      let invoicesCreated = 0
      let invoicesUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let skippedRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        if (!resolveCustomerByImportCode(customers, row.customer_code) || !resolveProductByImportCode(products, row.product_code)) {
          skippedRows += 1
          continue
        }
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      for (const [sourceCode, rows] of rowsBySourceCode) {
        const existing = salesDocuments.get(sourceCode)
        if (existing) invoicesUpdated += 1
        else invoicesCreated += 1

        const itemMap = new Map<number, typeof rows[number]>()
        for (const row of rows) {
          if (existing) itemsUpdated += 1
          else itemsCreated += 1
          itemMap.set(row.rowNumber, row)
        }
        salesDocumentItems.set(sourceCode, itemMap)
        salesDocuments.set(sourceCode, toImportedSalesDocument(sourceCode, itemMap, customers, products, users))
      }
      await persist()

      return {
        invoices_created: invoicesCreated,
        invoices_updated: invoicesUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        skipped_rows: skippedRows,
      }
    },
    async listSalesDocuments(input) {
      const search = normalize(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const type = input.url.searchParams.get('type')
      const status = input.url.searchParams.get('status')
      const customerId = input.url.searchParams.get('customer_id')
      const paymentStatus = input.url.searchParams.get('payment_status')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const createdBy = input.url.searchParams.get('created_by')
      return [...salesDocuments.values()]
        .map((document) => hydrateSalesDocumentUserSnapshot(document, users))
        .filter((document) => {
          if (type && type !== 'all' && !type.split(',').includes(document.order_type)) return false
          if (status && status !== 'all' && !status.split(',').includes(document.status)) return false
          if (customerId && document.customer.id !== customerId) return false
          if (paymentStatus && paymentStatus !== 'all' && !paymentStatus.split(',').includes(document.payment_status)) return false
          if (!dateRangeMatches(document.created_at, from, to)) return false
          if (createdBy && createdBy !== 'all' && document.seller.id !== createdBy) return false
          if (search && !normalize(`${document.code} ${document.customer.code ?? ''} ${document.customer.name} ${document.note ?? ''}`).includes(search)) return false
          return true
        })
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    },
    async saveSalesDocument(input) {
      salesDocuments.set(input.document.code, input.document)
      for (const entry of input.cashbookEntries) cashbookEntries.set(entry.id, entry)
      if (input.document.order_type === 'invoice' && input.document.status === 'completed') {
        salesDocumentItems.set(input.document.code, posInvoiceRowsFromSalesDocument(input.document, products))
      } else {
        salesDocumentItems.delete(input.document.code)
      }
      await persist()
    },
    async reviseSalesDocument(input) {
      const original = [...salesDocuments.entries()].find(([, document]) => document.id === input.originalOrderId || document.code === input.originalOrderCode)
      if (!original) return null
      const [originalCode, originalDocument] = original
      const revised = {
        ...input.document,
        base_code: input.document.base_code ?? originalDocument.base_code ?? invoiceBaseCode(originalDocument.code),
        revision_no: input.document.revision_no ?? 1,
        revised_from_order_id: originalDocument.id,
      } as SalesDocumentData
      const cancelled = {
        ...originalDocument,
        status: 'cancelled',
        replaced_by_order_id: revised.id,
        cancel_reason_type: 'revised',
      } as SalesDocumentData
      salesDocuments.set(originalCode, cancelled)
      salesDocuments.set(revised.code, revised)
      salesDocumentItems.set(revised.code, posInvoiceRowsFromSalesDocument(revised, products))
      for (const entry of input.cashbookEntries) cashbookEntries.set(entry.id, entry)
      await persist()
      return revised
    },
    async getSalesDocument(input) {
      const document = [...salesDocuments.values()].find((item) => item.id === input.id || item.code === input.id)
      if (!document) return null
      const hydratedDocument = hydrateSalesDocumentUserSnapshot(document, users)
      const rawItems = salesDocumentItems.get(document.code)
      const hydratedItems = rawItems
        ? salesDocumentItemsToDetailItems(rawItems, products)
        : document.items
      const hydratedCashbookEntries = [...cashbookEntries.values()].map((entry) => hydrateCashbookEntryUserSnapshot(entry, users))
      return hydrateSalesDocumentPaymentReceipts({ ...hydratedDocument, items: hydratedItems }, hydratedCashbookEntries)
    },
    async cancelSalesDocument(input) {
      const entry = [...salesDocuments.entries()].find(([, document]) => document.id === input.id || document.code === input.id)
      if (!entry) return null
      const [code, document] = entry
      const cancelled = {
        ...document,
        status: 'cancelled',
        payment_status: document.payment_status,
      } as SalesDocumentData
      salesDocuments.set(code, cancelled)
      await persist()
      return cancelled
    },
    async updateSalesDocumentNote(input) {
      const entry = [...salesDocuments.entries()].find(([, document]) => document.id === input.id || document.code === input.id)
      if (!entry) return null
      const [code, document] = entry
      const updated = {
        ...document,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.created_at !== undefined ? { created_at: input.created_at } : {}),
      } as SalesDocumentData
      salesDocuments.set(code, updated)
      if (input.created_at !== undefined) {
        for (const [entryId, cashbookEntry] of cashbookEntries.entries()) {
          if (!cashbookEntryMatchesSalesDocument(cashbookEntry, updated)) continue
          cashbookEntries.set(entryId, { ...cashbookEntry, created_at: input.created_at })
        }
      }
      await persist()
      return updated
    },
    async upsertImportedKiotVietCashbook(input) {
      let accountsCreated = 0
      let accountsUpdated = 0
      let entriesCreated = 0
      let entriesUpdated = 0
      for (const row of preferPostedKiotVietCashbookRows(input.rows)) {
        const account = financeAccountFromCashbookRow(row)
        if (financeAccounts.has(account.id)) accountsUpdated += 1
        else accountsCreated += 1
        financeAccounts.set(account.id, { ...financeAccounts.get(account.id), ...account })
        const entry = toImportedCashbookEntry(row)
        if (cashbookEntries.has(entry.id)) entriesUpdated += 1
        else entriesCreated += 1
        cashbookEntries.set(entry.id, entry)
      }
      rebuildKiotVietCashbookLedger(cashbookEntries, salesDocuments, purchaseReceipts, customers, suppliers)
      await persist()
      return {
        accounts_created: accountsCreated,
        accounts_updated: accountsUpdated,
        entries_created: entriesCreated,
        entries_updated: entriesUpdated,
        skipped_rows: 0,
      }
    },
    async deleteImportedKiotVietCashbook() {
      let deleted = 0
      for (const [id, entry] of [...cashbookEntries.entries()]) {
        if (entry.source?.type !== 'kiotviet_cashbook') continue
        cashbookEntries.delete(id)
        deleted += 1
      }
      rebuildKiotVietCashbookLedger(cashbookEntries, salesDocuments, purchaseReceipts, customers, suppliers)
      await persist()
      return { deleted, blocked: 0 }
    },
    async listCashbookEntries(input) {
      const search = normalize(input.url.searchParams.get('search') ?? '')
      const direction = input.url.searchParams.get('direction')
      const status = input.url.searchParams.get('status')
      const financeAccountId = input.url.searchParams.get('finance_account_id')
      const financeAccountType = input.url.searchParams.get('finance_account_type')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      return [...cashbookEntries.values()]
        .map((entry) => hydrateCashbookEntryUserSnapshot(entry, users))
        .map((entry) => hydrateCashbookEntryFinanceAccount(entry, financeAccounts))
        .filter((entry) => {
          if (financeAccountId && financeAccountId !== 'all' && entry.finance_account.id !== financeAccountId) return false
          if (financeAccountType && financeAccountType !== 'all' && entry.finance_account.account_type !== financeAccountType) return false
          if (input.url.searchParams.get('exclude_replaced_deleted_accounts') === 'true' && isReplacedDeletedFinanceAccount(entry.finance_account, financeAccounts)) return false
          if (direction && direction !== 'all' && entry.direction !== direction) return false
          if (status && status !== 'all' && entry.status !== status) return false
          if (!dateRangeMatches(entry.created_at, from, to)) return false
          if (search && !normalize(`${entry.code} ${entry.note} ${entry.counterparty.name} ${entry.finance_account.name} ${entry.finance_account.code}`).includes(search)) return false
          return true
        })
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    },
    async getCashbookEntry(input) {
      const entry = [...cashbookEntries.values()].find((item) => item.id === input.id || item.code === input.id)
      return entry ? hydrateCashbookEntryFinanceAccount(hydrateCashbookEntryUserSnapshot(entry, users), financeAccounts) : null
    },
    async listStockMovements(input) {
      const productId = input.url.searchParams.get('product_id')
      return stockMovementsFromDocuments(purchaseReceipts, purchaseReceiptItems, salesDocuments, salesDocumentItems, stocktakes, stocktakeItems, products, draftBoms)
        .filter((movement) => !productId || movement.product_id === productId)
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
      await persist()
      return { deleted, blocked: 0 }
    },
    async deleteImportedKiotVietStocktakes() {
      const deleted = stocktakes.size
      stocktakes.clear()
      stocktakeItems.clear()
      await persist()
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
        stocktakes.set(sourceCode, toImportedStocktake(sourceCode, rows, itemMap, resolveSourceCreator(rows, users)))
      }
      await persist()

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
      const createdBy = input.url.searchParams.get('created_by')
      return [...stocktakes.entries()]
        .filter(([sourceCode, stocktake]) => {
          if (statuses !== null && !statuses.has(stocktake.status)) return false
          if (!dateRangeMatches(stocktake.created_at, from, to)) return false
          if (createdBy && createdBy !== 'all' && stocktake.created_by?.id !== createdBy) return false
          if (search) {
            const rows = [...(stocktakeItems.get(sourceCode)?.values() ?? [])]
            const rowText = rows.map((row) => `${row.product_code} ${row.product_name ?? ''}`).join(' ')
            if (!normalize(`${stocktake.code} ${stocktake.note ?? ''} ${rowText}`).includes(search)) return false
          }
          return true
        })
        .map(([sourceCode, stocktake]) => {
          const rows = [...(stocktakeItems.get(sourceCode)?.values() ?? [])].sort((left, right) => left.rowNumber - right.rowNumber)
          const firstRow = rows[0]
          const product = firstRow ? products.get(firstRow.product_code) : null
          return {
            ...hydrateStocktakeCreator(stocktake, users),
            product_code: firstRow?.product_code ?? null,
            product_name: firstRow?.product_name ?? product?.name ?? firstRow?.product_code ?? null,
            product_system_qty: firstRow?.system_qty ?? null,
            product_actual_qty: firstRow?.actual_qty ?? null,
            product_difference_qty: firstRow?.difference_qty ?? null,
          }
        })
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    },
    async getStocktake(input) {
      const sourceCode = [...stocktakes.entries()].find(([, stocktake]) => stocktake.id === input.id || stocktake.code === input.id)?.[0]
      if (!sourceCode) return null
      const stocktake = stocktakes.get(sourceCode)
      if (!stocktake) return null
      const rows = [...(stocktakeItems.get(sourceCode)?.values() ?? [])].sort((left, right) => left.rowNumber - right.rowNumber)
      const hydrated = hydrateStocktakeCreator(stocktake, users)
      return {
        ...hydrated,
        items: rows.map((row) => {
          const product = products.get(row.product_code)
          return {
            id: `stocktake-item-${slug(sourceCode)}-${row.rowNumber}`,
            line_no: row.rowNumber,
            product_id: product?.id ?? null,
            product_code: row.product_code,
            product_name: row.product_name ?? product?.name ?? row.product_code,
            unit_name: row.unit_name,
            system_qty: row.system_qty,
            actual_qty: row.actual_qty,
            difference_qty: row.difference_qty,
            line_actual_value: row.total_actual_value,
            line_difference_value: row.line_difference_value ?? row.total_difference_value,
            note: row.note,
          }
        }),
      } satisfies StocktakeDetailData
    },
    async updateStocktakeNote(input) {
      const sourceCode = [...stocktakes.entries()].find(([, stocktake]) => stocktake.id === input.id || stocktake.code === input.id)?.[0]
      if (!sourceCode) return null
      const stocktake = stocktakes.get(sourceCode)
      if (!stocktake) return null
      stocktakes.set(sourceCode, { ...stocktake, note: input.note })
      await persist()
      return (this as ServerRepository).getStocktake?.({ organizationId: input.organizationId, id: input.id }) ?? null
    },
    async cancelStocktake(input) {
      const sourceCode = [...stocktakes.entries()].find(([, stocktake]) => stocktake.id === input.id || stocktake.code === input.id)?.[0]
      if (!sourceCode) return null
      const stocktake = stocktakes.get(sourceCode)
      if (!stocktake) return null
      stocktakes.set(sourceCode, { ...stocktake, status: 'cancelled', balanced_at: null })
      await persist()
      return (this as ServerRepository).getStocktake?.({ organizationId: input.organizationId, id: input.id }) ?? null
    },
    async close() {
      await persist()
    },
  }
}

function invoiceBaseCode(code: string) {
  const match = /^(HD\d{6})(?:\.\d+)?$/.exec(code)
  return match ? match[1] : code
}

interface DevMemoryMaps {
  products: Map<string, ProductListData>
  defaultSalePrices: Map<string, number>
  priceListNames: Map<string, { id: string; name: string }>
  namedSalePrices: Map<string, Map<string, number>>
  provisionalStockBalances: Map<string, { quantity: number; unit_name: string; source_label: string | null }>
  draftBoms: Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>
  stocktakes: Map<string, StocktakeListData>
  stocktakeItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>>
  purchaseReceipts: Map<string, PurchaseReceiptData>
  purchaseReceiptItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'][number]>>
  salesDocuments: Map<string, SalesDocumentData>
  salesDocumentItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]>>
  cashbookEntries: Map<string, CashbookEntryData>
  financeAccounts: Map<string, FinanceAccountData>
  customers: Map<string, CustomerListData>
  suppliers: Map<string, SupplierListData>
  customerGroupIds: Map<string, string>
  customerGroupNamesById: Map<string, string>
  users: Map<string, UserListItemData>
  authUsers: Map<string, AuthUserRow>
  userOrder: string[]
  groupIds: Map<string, string>
  groupNamesById: Map<string, string>
}

interface DevMemoryState {
  version: 1
  products: Array<[string, ProductListData]>
  defaultSalePrices: Array<[string, number]>
  priceListNames: Array<[string, { id: string; name: string }]>
  namedSalePrices: Array<[string, Array<[string, number]>]>
  provisionalStockBalances: Array<[string, { quantity: number; unit_name: string; source_label: string | null }]>
  draftBoms: Array<[string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]]>
  stocktakes: Array<[string, StocktakeListData]>
  stocktakeItems: Array<[string, Array<[number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]]>]>
  purchaseReceipts: Array<[string, PurchaseReceiptData]>
  purchaseReceiptItems: Array<[string, Array<[number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'][number]]>]>
  salesDocuments: Array<[string, SalesDocumentData]>
  salesDocumentItems: Array<[string, Array<[number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]]>]>
  cashbookEntries: Array<[string, CashbookEntryData]>
  financeAccounts: Array<[string, FinanceAccountData]>
  customers: Array<[string, CustomerListData]>
  suppliers: Array<[string, SupplierListData]>
  customerGroupIds: Array<[string, string]>
  customerGroupNamesById: Array<[string, string]>
  users: Array<[string, UserListItemData]>
  authUsers: Array<[string, AuthUserRow]>
  userOrder: string[]
  groupIds: Array<[string, string]>
  groupNamesById: Array<[string, string]>
}

async function loadState(stateFile: string, maps: DevMemoryMaps) {
  let raw: string
  try {
    raw = await readFile(stateFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  const state = JSON.parse(raw) as Partial<DevMemoryState>
  if (state.version !== 1) return
  replaceMap(maps.products, state.products)
  replaceMap(maps.defaultSalePrices, state.defaultSalePrices)
  replaceMap(maps.priceListNames, state.priceListNames)
  replaceMap(maps.provisionalStockBalances, state.provisionalStockBalances)
  replaceMap(maps.draftBoms, state.draftBoms)
  replaceMap(maps.stocktakes, state.stocktakes?.map(([key, stocktake]) => [key, sanitizePersistedStocktake(stocktake)]))
  replaceMap(maps.purchaseReceipts, state.purchaseReceipts)
  replaceMap(maps.salesDocuments, state.salesDocuments)
  replaceMap(maps.cashbookEntries, state.cashbookEntries)
  replaceMap(maps.financeAccounts, state.financeAccounts)
  replaceMap(maps.customers, state.customers?.map(([key, customer]) => [key, sanitizePersistedCustomer(customer)]))
  replaceMap(maps.suppliers, state.suppliers)
  replaceMap(maps.customerGroupIds, state.customerGroupIds)
  replaceMap(maps.customerGroupNamesById, state.customerGroupNamesById)
  replaceMap(maps.users, state.users)
  replaceMap(maps.authUsers, state.authUsers)
  replaceMap(maps.groupIds, state.groupIds)
  replaceMap(maps.groupNamesById, state.groupNamesById)
  maps.stocktakeItems.clear()
  maps.namedSalePrices.clear()
  for (const [priceListName, rows] of state.namedSalePrices ?? []) {
    maps.namedSalePrices.set(priceListName, new Map(rows))
  }
  if (!maps.priceListNames.has(priceListKey(defaultPriceList.name))) {
    maps.priceListNames.set(priceListKey(defaultPriceList.name), defaultPriceList)
  }
  if (!maps.priceListNames.has(priceListKey('Bảng giá chung'))) {
    maps.priceListNames.set(priceListKey('Bảng giá chung'), defaultPriceList)
  }
  for (const [sourceCode, rows] of state.stocktakeItems ?? []) {
    maps.stocktakeItems.set(sourceCode, new Map(rows))
  }
  maps.purchaseReceiptItems.clear()
  for (const [sourceCode, rows] of state.purchaseReceiptItems ?? []) {
    maps.purchaseReceiptItems.set(sourceCode, new Map(rows))
  }
  maps.salesDocumentItems.clear()
  for (const [sourceCode, rows] of state.salesDocumentItems ?? []) {
    maps.salesDocumentItems.set(sourceCode, new Map(rows))
  }
  maps.userOrder.splice(0, maps.userOrder.length, ...(state.userOrder ?? []))
}

async function saveState(stateFile: string, maps: DevMemoryMaps) {
  const state: DevMemoryState = {
    version: 1,
    products: [...maps.products.entries()],
    defaultSalePrices: [...maps.defaultSalePrices.entries()],
    priceListNames: [...maps.priceListNames.entries()],
    namedSalePrices: [...maps.namedSalePrices.entries()].map(([priceListName, rows]) => [priceListName, [...rows.entries()]]),
    provisionalStockBalances: [...maps.provisionalStockBalances.entries()],
    draftBoms: [...maps.draftBoms.entries()],
    stocktakes: [...maps.stocktakes.entries()].map(([key, stocktake]) => [key, sanitizePersistedStocktake(stocktake)]),
    stocktakeItems: [...maps.stocktakeItems.entries()].map(([sourceCode, rows]) => [sourceCode, [...rows.entries()]]),
    purchaseReceipts: [...maps.purchaseReceipts.entries()],
    purchaseReceiptItems: [...maps.purchaseReceiptItems.entries()].map(([sourceCode, rows]) => [sourceCode, [...rows.entries()]]),
    salesDocuments: [...maps.salesDocuments.entries()],
    salesDocumentItems: [...maps.salesDocumentItems.entries()].map(([sourceCode, rows]) => [sourceCode, [...rows.entries()]]),
    cashbookEntries: [...maps.cashbookEntries.entries()],
    financeAccounts: [...maps.financeAccounts.entries()],
    customers: [...maps.customers.entries()].map(([key, customer]) => [key, sanitizePersistedCustomer(customer)]),
    suppliers: [...maps.suppliers.entries()],
    customerGroupIds: [...maps.customerGroupIds.entries()],
    customerGroupNamesById: [...maps.customerGroupNamesById.entries()],
    users: [...maps.users.entries()],
    authUsers: [...maps.authUsers.entries()],
    userOrder: [...maps.userOrder],
    groupIds: [...maps.groupIds.entries()],
    groupNamesById: [...maps.groupNamesById.entries()],
  }
  await mkdir(dirname(stateFile), { recursive: true })
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function replaceMap<K, V>(map: Map<K, V>, entries: Array<[K, V]> | undefined) {
  if (!entries) return
  map.clear()
  for (const [key, value] of entries) map.set(key, value)
}

function sanitizePersistedStocktake(stocktake: StocktakeListData): StocktakeListData {
  return stocktake.source_type === 'kiotviet_import' && !stocktake.source_creator_name ? { ...stocktake, created_by: null } : stocktake
}

function sanitizePersistedCustomer(customer: CustomerListData): CustomerListData {
  const sanitized = customer.id.startsWith('customer-kv-') && !customer.source_creator_name ? { ...customer, created_by: null } : customer
  return customerWithDisplaySalesAmount(sanitized)
}

function customerWithDisplaySalesAmount(customer: CustomerListData): CustomerListData {
  return customer.kiotviet_net_sales !== null && customer.kiotviet_net_sales !== undefined
    ? { ...customer, total_sales_amount: customer.kiotviet_net_sales }
    : customer
}

function hydrateUserReference<T extends { id: string; name: string }>(reference: T, users: Map<string, UserListItemData>): T {
  const user = users.get(reference.id)
  return user ? { ...reference, name: user.display_name } : reference
}

function hydrateSalesDocumentUserSnapshot(document: SalesDocumentData, users: Map<string, UserListItemData>): SalesDocumentData {
  return {
    ...document,
    seller: hydrateUserReference(document.seller, users),
  }
}

function hydrateCashbookEntryUserSnapshot(entry: CashbookEntryData, users: Map<string, UserListItemData>): CashbookEntryData {
  return {
    ...entry,
    created_by: entry.created_by ? hydrateUserReference(entry.created_by, users) : entry.created_by,
  }
}

function hydrateStocktakeCreator(stocktake: StocktakeListData, users: Map<string, UserListItemData>): StocktakeListData {
  if (!stocktake.created_by) return stocktake
  const user = users.get(stocktake.created_by.id)
  return user ? { ...stocktake, created_by: { id: user.id, name: user.display_name } } : stocktake
}

function hydrateCustomerCreator(customer: CustomerListData, users: Map<string, UserListItemData>): CustomerListData {
  if (customer.created_by) {
    const user = users.get(customer.created_by.id)
    return user ? { ...customer, created_by: { id: user.id, name: user.display_name } } : customer
  }
  const creator = resolveCustomerCreator(customer.source_creator_name, users)
  return creator ? { ...customer, created_by: creator } : customer
}

function hydrateCustomerLinkedSupplier(customer: CustomerListData, suppliers: Map<string, SupplierListData>): CustomerListData {
  const linkedSupplier = [...suppliers.values()].find((supplier) => supplier.linked_customer_id === customer.id)
    ?? [...suppliers.values()].find((supplier) => supplierMatchesCustomer(supplier, customer))
    ?? null
  return linkedSupplier
    ? { ...customer, linked_supplier: { id: linkedSupplier.id, code: linkedSupplier.code, name: linkedSupplier.name, linked_at: linkedSupplier.created_at ?? null } }
    : { ...customer, linked_supplier: null }
}

function withImportReviewMetadata(
  product: ProductListData,
  provisionalStockBalances: Map<string, { quantity: number; unit_name: string; source_label: string | null }>,
  draftBoms: Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>,
  operatingStockById: Map<string, { quantity: number; updated_at: string | null }>,
): ProductListData {
  const provisionalStock = provisionalStockBalances.get(product.code)
  const draftBom = draftBoms.get(product.code)
  const operatingStock = operatingStockById.get(product.id)
  return {
    ...product,
    operating_stock: operatingStock
      ? {
          quantity: operatingStock.quantity,
          unit_name: product.unit_name,
          source_type: 'stock_movements',
          source_label: 'Nhap hang - hoa don',
          updated_at: operatingStock.updated_at,
        }
      : null,
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
    unit_conversions: row.unit_conversions.length > 0 ? row.unit_conversions : existing?.unit_conversions ?? [],
    created_at: sourceCreatedAt ?? existing?.created_at ?? now,
    updated_at: now,
  }
}

function toCustomer(
  row: Parameters<NonNullable<ServerRepository['upsertCustomersByCode']>>[0]['rows'][number],
  existing: CustomerListData | undefined,
  customerGroupNamesById: Map<string, string>,
  users: Map<string, UserListItemData>,
): CustomerListData {
  const now = new Date().toISOString()
  const groupName = row.customer_group_id ? customerGroupNamesById.get(row.customer_group_id) : null
  return {
    id: existing?.id ?? `customer-kv-${slug(row.code)}`,
    code: row.code,
    name: row.name,
    phone: row.phone,
    tax_code: row.tax_code,
    address: row.address,
    customer_group_id: row.customer_group_id,
    customer_group: row.customer_group_id && groupName ? { id: row.customer_group_id, code: slug(groupName).toUpperCase(), name: groupName } : null,
    created_by: resolveCustomerCreator(row.source_creator_name, users),
    created_at: row.source_created_at ?? existing?.created_at ?? now,
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
  } satisfies CustomerListData
}

function operatingStockByProductId(movements: StockMovementData[]) {
  const balances = new Map<string, { quantity: number; updated_at: string | null }>()
  for (const movement of movements) {
    const existing = balances.get(movement.product_id) ?? { quantity: 0, updated_at: null }
    balances.set(movement.product_id, {
      quantity: existing.quantity + movement.quantity_delta,
      updated_at: movement.created_at,
    })
  }
  return balances
}

function toSupplier(
  row: Parameters<NonNullable<ServerRepository['upsertSuppliersByCode']>>[0]['rows'][number],
  existing: SupplierListData | undefined,
  customers: Map<string, CustomerListData>,
): SupplierListData {
  const now = new Date().toISOString()
  const linkedCustomer = findMatchingCustomerForSupplier(row, customers)
  return {
    id: existing?.id ?? `supplier-kv-${slug(row.code)}`,
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
    created_at: row.source_created_at ?? existing?.created_at ?? now,
    source_creator_name: row.source_creator_name,
    source_created_at: row.source_created_at,
    company_name: row.company_name,
  } satisfies SupplierListData
}

function supplierMatchesCustomer(supplier: Pick<SupplierListData, 'code' | 'name'>, customer: Pick<CustomerListData, 'code' | 'name'>) {
  return normalize(supplier.code) === normalize(customer.code)
    || normalize(supplier.name) === normalize(customer.name)
}

function findMatchingCustomerForSupplier(row: Pick<Parameters<NonNullable<ServerRepository['upsertSuppliersByCode']>>[0]['rows'][number], 'code' | 'name'>, customers: Map<string, CustomerListData>) {
  return [...customers.values()].find((customer) => supplierMatchesCustomer(row, customer)) ?? null
}

function syncExactCustomerSupplierLinks(customers: Map<string, CustomerListData>, suppliers: Map<string, SupplierListData>) {
  let updated = 0
  for (const [code, supplier] of suppliers.entries()) {
    if (supplier.linked_customer_id) continue
    const customer = findMatchingCustomerForSupplier(supplier, customers)
    if (!customer) continue
    suppliers.set(code, {
      ...supplier,
      linked_customer_id: customer.id,
      linked_customer: { id: customer.id, code: customer.code, name: customer.name },
    })
    updated += 1
  }
  return updated
}

function toImportedPurchaseReceipt(
  sourceCode: string,
  itemMap: Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'][number]>,
  suppliers: Map<string, SupplierListData>,
  products: Map<string, ProductListData>,
  users: Map<string, UserListItemData>,
): PurchaseReceiptData {
  const rows = [...itemMap.values()].sort((left, right) => left.rowNumber - right.rowNumber)
  const firstRow = rows[0]
  const supplier = suppliers.get(baseKiotVietImportCode(firstRow?.supplier_code ?? '')) ?? [...suppliers.values()][0]
  const now = new Date().toISOString()
  const subtotal = firstRow?.subtotal_amount ?? rows.reduce((total, row) => total + row.line_amount, 0)
  const discount = firstRow?.receipt_discount_amount ?? 0
  const payable = firstRow?.payable_amount ?? Math.max(subtotal - discount, 0)
  const paid = firstRow?.paid_amount ?? 0
  const createdBy = resolveCustomerCreator(firstRow?.source_creator_name, users)

  return {
    id: `purchase-receipt-kv-${slug(sourceCode)}`,
    code: sourceCode,
    supplier_id: supplier?.id ?? `supplier-kv-${slug(firstRow?.supplier_code ?? 'unknown')}`,
    supplier: {
      id: supplier?.id ?? `supplier-kv-${slug(firstRow?.supplier_code ?? 'unknown')}`,
      code: supplier?.code ?? firstRow?.supplier_code ?? '',
      name: supplier?.name ?? firstRow?.supplier_name ?? '',
    },
    received_at: firstRow?.received_at ?? firstRow?.source_created_at ?? now,
    status: firstRow?.status ?? 'posted',
    supplier_document_no: firstRow?.supplier_document_no ?? null,
    subtotal_amount: subtotal,
    discount_amount: discount,
    payable_amount: payable,
    paid_amount: paid,
    remaining_amount: Math.max(payable - paid, 0),
    notes: firstRow?.note ?? null,
    created_by: createdBy ?? { id: adminUser.id, name: adminUser.display_name },
    created_at: firstRow?.source_created_at ?? firstRow?.received_at ?? now,
    updated_at: firstRow?.updated_at ?? now,
    items: rows.map((row, index) => {
      const product = resolveProductByImportCode(products, row.product_code)
      return {
        id: `purchase-receipt-item-kv-${slug(sourceCode)}-${row.rowNumber}`,
        product_id: product?.id ?? `product-${slug(row.product_code)}`,
        product: {
          id: product?.id ?? `product-${slug(row.product_code)}`,
          code: product?.code ?? baseKiotVietImportCode(row.product_code),
          name: product?.name ?? row.product_name ?? row.product_code,
        },
        line_no: index + 1,
        inventory_shape: product?.inventory_shape === 'roll' || product?.inventory_shape === 'sheet' ? product.inventory_shape : 'normal',
        unit_name_snapshot: row.unit_name ?? product?.unit_name ?? '',
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        discount_amount: row.line_discount_amount,
        line_amount: row.line_amount,
        physical_payload: null,
      }
    }),
    supplier_payments: [],
  } as PurchaseReceiptData
}

function toImportedCashbookEntry(
  row: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]['rows'][number],
): CashbookEntryData {
  const account = financeAccountFromCashbookRow(row)
  const note = [row.source_note, row.transfer_content].filter(Boolean).join(' - ')
  return {
    id: `cashbook-kv-${slug(row.source_code)}`,
    code: row.source_code,
    status: row.status,
    direction: row.direction,
    amount_delta: row.amount_delta,
    finance_account: {
      id: account.id,
      code: account.code,
      name: account.name,
      account_type: account.account_type,
    },
    is_business_accounted: true,
    source_type: 'kiotviet_cashbook',
    created_at: row.entry_time ?? new Date().toISOString(),
    note,
    counterparty: {
      type: 'other',
      name: row.counterparty_name ?? row.counterparty_code ?? '',
      phone: row.counterparty_phone,
    },
    source: {
      type: 'kiotviet_cashbook',
      id: row.source_code,
      code: row.source_code,
      order_code: null,
      source_created_at: row.source_created_at,
      source_creator_name: row.source_creator_name,
      category_name: row.category_name,
      transfer_content: row.transfer_content,
      source_note: row.source_note,
      counterparty_code: row.counterparty_code,
      counterparty_address: row.counterparty_address,
    },
    allocations: [],
    payment_method: row.account_type,
  } as CashbookEntryData
}

function hydrateCashbookEntryFinanceAccount(
  entry: CashbookEntryData,
  financeAccounts: Map<string, FinanceAccountData>,
): CashbookEntryData {
  const account = financeAccounts.get(entry.finance_account.id)
  if (!account) return entry
  return {
    ...entry,
    finance_account: cashbookFinanceAccountSnapshot(account),
  }
}

function hydrateSalesDocumentPaymentReceipts(
  document: SalesDocumentData,
  entries: CashbookEntryData[],
): SalesDocumentData & { payment_receipts: SalesDocumentPaymentReceiptData[] } {
  const paymentReceipts = entries
    .filter((entry) => cashbookEntryMatchesSalesDocument(entry, document))
    .map((entry) => cashbookEntrySalesDocumentPaymentReceipt(entry, document))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))

  return { ...document, payment_receipts: paymentReceipts }
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

type KiotVietCashbookRepositoryRow = Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]['rows'][number]
type KiotVietInvoiceRepositoryRow = Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]

function preferPostedKiotVietCashbookRows(rows: KiotVietCashbookRepositoryRow[]) {
  const byCode = new Map<string, KiotVietCashbookRepositoryRow>()
  for (const row of rows) {
    const previous = byCode.get(row.source_code)
    if (!previous || (previous.status === 'cancelled' && row.status === 'posted')) {
      byCode.set(row.source_code, row)
    }
  }
  return [...byCode.values()]
}

function rebuildKiotVietCashbookLedger(
  cashbookEntries: Map<string, CashbookEntryData>,
  salesDocuments: Map<string, SalesDocumentData>,
  purchaseReceipts: Map<string, PurchaseReceiptData>,
  customers: Map<string, CustomerListData>,
  suppliers: Map<string, SupplierListData>,
) {
  resetImportedKiotVietDocumentPayments(salesDocuments, purchaseReceipts)

  const rows = [...cashbookEntries.values()]
    .filter((entry) => entry.source?.type === 'kiotviet_cashbook')
    .map((entry) => {
      const source = entry.source ?? { type: 'kiotviet_cashbook', id: entry.code, code: entry.code, order_code: null }
      entry.allocations = []
      entry.source = { ...source, order_code: null }
      return { entry, row: cashbookRowFromEntry(entry) }
    })
    .filter(({ row }) => row.status === 'posted')
    .sort((left, right) => Date.parse(left.row.entry_time ?? '') - Date.parse(right.row.entry_time ?? '') || left.row.source_code.localeCompare(right.row.source_code))

  for (const { entry, row } of rows) {
    const allocations = allocateImportedCashbookRow(row, salesDocuments, purchaseReceipts, customers, suppliers)
    if (allocations.length === 0) continue
    entry.allocations = allocations
    const source = entry.source ?? { type: 'kiotviet_cashbook', id: entry.code, code: entry.code, order_code: null }
    entry.source = { ...source, order_code: allocations[0]?.order_code ?? null }
  }

  recalculatePartnerDebtTotals(salesDocuments, purchaseReceipts, customers, suppliers)
}

function resetImportedKiotVietDocumentPayments(
  salesDocuments: Map<string, SalesDocumentData>,
  purchaseReceipts: Map<string, PurchaseReceiptData>,
) {
  for (const document of salesDocuments.values()) {
    if (!document.id.startsWith('order-kv-')) continue
    const debt = document.status === 'completed' && document.order_type === 'invoice' ? document.total_amount : 0
    document.paid_amount = 0
    document.debt_amount = debt
    document.payment_status = invoicePaymentStatus(0, debt)
  }

  for (const receipt of purchaseReceipts.values()) {
    if (!receipt.id.startsWith('purchase-receipt-kv-')) continue
    receipt.paid_amount = 0
    receipt.remaining_amount = receipt.status === 'posted' ? receipt.payable_amount : 0
  }
}

function cashbookRowFromEntry(entry: CashbookEntryData): KiotVietCashbookRepositoryRow {
  const source = entry.source as CashbookEntryData['source'] & {
    category_name?: string | null
    source_created_at?: string | null
    transfer_content?: string | null
    source_note?: string | null
    counterparty_code?: string | null
    counterparty_address?: string | null
  }

  return {
    rowNumber: 0,
    source_code: entry.code,
    entry_time: entry.created_at,
    source_created_at: source?.source_created_at ?? null,
    source_creator_name: source?.source_creator_name ?? null,
    staff_name: null,
    category_name: source?.category_name ?? null,
    account_type: entry.finance_account.account_type,
    account_name: entry.finance_account.name,
    account_number: entry.finance_account.account_type === 'bank' ? entry.finance_account.code : null,
    counterparty_code: source?.counterparty_code ?? null,
    counterparty_name: entry.counterparty.name ?? null,
    counterparty_phone: entry.counterparty.phone ?? null,
    counterparty_address: source?.counterparty_address ?? null,
    transfer_content: source?.transfer_content ?? null,
    source_note: source?.source_note ?? null,
    direction: entry.direction as KiotVietCashbookRepositoryRow['direction'],
    amount_delta: entry.amount_delta,
    book_type_name: entry.finance_account.account_type === 'bank' ? 'Ngan hang' : 'Tien mat',
    status: entry.status as KiotVietCashbookRepositoryRow['status'],
  }
}

function allocateImportedCashbookRow(
  row: KiotVietCashbookRepositoryRow,
  salesDocuments: Map<string, SalesDocumentData>,
  purchaseReceipts: Map<string, PurchaseReceiptData>,
  customers: Map<string, CustomerListData>,
  suppliers: Map<string, SupplierListData>,
): NonNullable<CashbookEntryData['allocations']> {
  const directInvoiceCode = linkedInvoiceCodeFromCashbookCode(row.source_code)
  if (directInvoiceCode !== null && row.direction === 'in') {
    return allocateDirectCustomerCashbookPayment(row, salesDocuments.get(directInvoiceCode) ?? null)
  }

  const directReceiptCode = linkedPurchaseReceiptCodeFromCashbookCode(row.source_code)
  if (directReceiptCode !== null && row.direction === 'out') {
    return allocateDirectSupplierCashbookPayment(row, purchaseReceipts.get(directReceiptCode) ?? null)
  }

  if (isKiotVietDelayedCustomerPayment(row)) {
    return allocateCustomerCashbookPayment(row, salesDocuments, customers)
  }
  if (isKiotVietDelayedSupplierPayment(row)) {
    return allocateSupplierCashbookPayment(row, purchaseReceipts, suppliers)
  }
  return []
}

function allocateCustomerCashbookPayment(
  row: KiotVietCashbookRepositoryRow,
  salesDocuments: Map<string, SalesDocumentData>,
  customers: Map<string, CustomerListData>,
): NonNullable<CashbookEntryData['allocations']> {
  const customer = resolveCashbookCustomer(row, customers)
  if (!customer) return []
  let remaining = Math.max(row.amount_delta, 0)
  const entryTime = Date.parse(row.entry_time ?? '')
  const allocations: NonNullable<CashbookEntryData['allocations']> = []
  const invoices = [...salesDocuments.values()]
    .filter((document) => (
      document.order_type === 'invoice'
      && document.status !== 'cancelled'
      && document.debt_amount > 0
      && (!Number.isFinite(entryTime) || Date.parse(document.created_at) <= entryTime)
      && (document.customer.id === customer.id || normalize(document.customer.code ?? '') === normalize(customer.code))
    ))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))

  for (const invoice of invoices) {
    if (remaining <= 0) break
    const allocated = Math.min(invoice.debt_amount, remaining)
    const collectedBefore = invoice.paid_amount
    invoice.paid_amount += allocated
    invoice.debt_amount = Math.max(invoice.debt_amount - allocated, 0)
    invoice.payment_status = invoicePaymentStatus(invoice.paid_amount, invoice.debt_amount)
    allocations.push({
      order_id: invoice.id,
      order_code: invoice.code,
      order_total_amount: invoice.total_amount,
      collected_before: collectedBefore,
      allocated_amount: allocated,
      remaining_after: invoice.debt_amount,
    })
    remaining -= allocated
  }

  if (allocations.length > 0) {
    customer.total_debt_amount = Math.max(customer.total_debt_amount - sumAllocations(allocations), 0)
    customer.last_transaction_at = row.entry_time ?? customer.last_transaction_at
  }

  return allocations
}

function allocateSupplierCashbookPayment(
  row: KiotVietCashbookRepositoryRow,
  purchaseReceipts: Map<string, PurchaseReceiptData>,
  suppliers: Map<string, SupplierListData>,
): NonNullable<CashbookEntryData['allocations']> {
  const supplier = resolveCashbookSupplier(row, suppliers)
  if (!supplier) return []
  let remaining = Math.abs(row.amount_delta)
  const entryTime = Date.parse(row.entry_time ?? '')
  const allocations: NonNullable<CashbookEntryData['allocations']> = []
  const receipts = [...purchaseReceipts.values()]
    .filter((receipt) => (
      receipt.status === 'posted'
      && receipt.remaining_amount > 0
      && (!Number.isFinite(entryTime) || Date.parse(receipt.received_at) <= entryTime)
      && (receipt.supplier.id === supplier.id || normalize(receipt.supplier.code) === normalize(supplier.code))
    ))
    .sort((left, right) => Date.parse(left.received_at) - Date.parse(right.received_at))

  for (const receipt of receipts) {
    if (remaining <= 0) break
    const allocated = Math.min(receipt.remaining_amount, remaining)
    const paidBefore = receipt.paid_amount
    receipt.paid_amount += allocated
    receipt.remaining_amount = Math.max(receipt.remaining_amount - allocated, 0)
    allocations.push({
      order_id: receipt.id,
      order_code: receipt.code,
      order_total_amount: receipt.payable_amount,
      collected_before: paidBefore,
      allocated_amount: allocated,
      remaining_after: receipt.remaining_amount,
    })
    remaining -= allocated
  }

  if (allocations.length > 0) {
    supplier.current_payable_amount = Math.max(supplier.current_payable_amount - sumAllocations(allocations), 0)
  }

  return allocations
}

function allocateDirectCustomerCashbookPayment(
  row: KiotVietCashbookRepositoryRow,
  invoice: SalesDocumentData | null,
): NonNullable<CashbookEntryData['allocations']> {
  if (!invoice || invoice.order_type !== 'invoice' || invoice.status === 'cancelled' || invoice.debt_amount <= 0) return []
  const allocated = Math.min(invoice.debt_amount, Math.max(row.amount_delta, 0))
  if (allocated <= 0) return []
  const collectedBefore = invoice.paid_amount
  invoice.paid_amount += allocated
  invoice.debt_amount = Math.max(invoice.debt_amount - allocated, 0)
  invoice.payment_status = invoicePaymentStatus(invoice.paid_amount, invoice.debt_amount)
  return [{
    order_id: invoice.id,
    order_code: invoice.code,
    order_total_amount: invoice.total_amount,
    collected_before: collectedBefore,
    allocated_amount: allocated,
    remaining_after: invoice.debt_amount,
  }]
}

function allocateDirectSupplierCashbookPayment(
  row: KiotVietCashbookRepositoryRow,
  receipt: PurchaseReceiptData | null,
): NonNullable<CashbookEntryData['allocations']> {
  if (!receipt || receipt.status !== 'posted' || receipt.remaining_amount <= 0) return []
  const allocated = Math.min(receipt.remaining_amount, Math.abs(row.amount_delta))
  if (allocated <= 0) return []
  const paidBefore = receipt.paid_amount
  receipt.paid_amount += allocated
  receipt.remaining_amount = Math.max(receipt.remaining_amount - allocated, 0)
  return [{
    order_id: receipt.id,
    order_code: receipt.code,
    order_total_amount: receipt.payable_amount,
    collected_before: paidBefore,
    allocated_amount: allocated,
    remaining_after: receipt.remaining_amount,
  }]
}

function linkedInvoiceCodeFromCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^TTHDO?(\d+(?:\.\d+)?)$/)
  return match ? `HD${match[1]}` : null
}

function linkedPurchaseReceiptCodeFromCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^PCPN(\d+(?:\.\d+)?)$/)
  return match ? `PN${match[1]}` : null
}

function recalculatePartnerDebtTotals(
  salesDocuments: Map<string, SalesDocumentData>,
  purchaseReceipts: Map<string, PurchaseReceiptData>,
  customers: Map<string, CustomerListData>,
  suppliers: Map<string, SupplierListData>,
) {
  for (const customer of customers.values()) {
    customer.total_debt_amount = 0
    customer.last_transaction_at = null
  }

  for (const document of salesDocuments.values()) {
    if (document.order_type !== 'invoice' || document.status === 'cancelled' || document.debt_amount <= 0) continue
    const customer = resolveDocumentCustomer(document, customers)
    if (!customer) continue
    customer.total_debt_amount += document.debt_amount
    if (!customer.last_transaction_at || Date.parse(document.created_at) > Date.parse(customer.last_transaction_at)) {
      customer.last_transaction_at = document.created_at
    }
  }

  for (const supplier of suppliers.values()) supplier.current_payable_amount = 0

  for (const receipt of purchaseReceipts.values()) {
    if (receipt.status !== 'posted' || receipt.remaining_amount <= 0) continue
    const supplier = resolveReceiptSupplier(receipt, suppliers)
    if (!supplier) continue
    supplier.current_payable_amount += receipt.remaining_amount
  }
}

function resolveDocumentCustomer(document: SalesDocumentData, customers: Map<string, CustomerListData>) {
  const byId = [...customers.values()].find((customer) => customer.id === document.customer.id)
  if (byId) return byId
  const code = normalize(document.customer.code ?? '')
  return [...customers.values()].find((customer) => normalize(customer.code) === code) ?? null
}

function resolveReceiptSupplier(receipt: PurchaseReceiptData, suppliers: Map<string, SupplierListData>) {
  const byId = [...suppliers.values()].find((supplier) => supplier.id === receipt.supplier.id || supplier.id === receipt.supplier_id)
  if (byId) return byId
  const code = normalize(receipt.supplier.code)
  return [...suppliers.values()].find((supplier) => normalize(supplier.code) === code) ?? null
}

function resolveCashbookCustomer(
  row: KiotVietCashbookRepositoryRow,
  customers: Map<string, CustomerListData>,
) {
  const code = row.counterparty_code?.trim()
  if (code && customers.has(code)) return customers.get(code)
  const normalizedCode = normalize(code ?? '')
  const normalizedName = normalize(row.counterparty_name ?? '')
  return [...customers.values()].find((customer) => (
    (normalizedCode && normalize(customer.code) === normalizedCode)
    || (normalizedName && normalize(customer.name) === normalizedName)
  )) ?? null
}

function resolveCashbookSupplier(
  row: KiotVietCashbookRepositoryRow,
  suppliers: Map<string, SupplierListData>,
) {
  const code = row.counterparty_code?.trim()
  if (code && suppliers.has(code)) return suppliers.get(code)
  const normalizedCode = normalize(code ?? '')
  const normalizedName = normalize(row.counterparty_name ?? '')
  return [...suppliers.values()].find((supplier) => (
    (normalizedCode && normalize(supplier.code) === normalizedCode)
    || (normalizedName && normalize(supplier.name) === normalizedName)
  )) ?? null
}

function isKiotVietDelayedCustomerPayment(
  row: KiotVietCashbookRepositoryRow,
) {
  const code = normalize(row.source_code)
  if (code.startsWith('tthd') || code.startsWith('pcpn')) return false
  if (row.direction !== 'in') return false
  const category = normalize(row.category_name ?? '')
  return category.includes('khach tra no') || category.includes('tien khach tra')
}

function isKiotVietDelayedSupplierPayment(
  row: KiotVietCashbookRepositoryRow,
) {
  const code = normalize(row.source_code)
  if (!code.startsWith('pc') || code.startsWith('pcpn')) return false
  if (row.direction !== 'out') return false
  return normalize(row.category_name ?? '').includes('tien tra ncc')
}

function invoicePaymentStatus(paidAmount: number, debtAmount: number) {
  if (debtAmount <= 0) return 'paid'
  if (paidAmount <= 0) return 'unpaid'
  return 'partial'
}

function sumAllocations(allocations: NonNullable<CashbookEntryData['allocations']>) {
  return allocations.reduce((total, allocation) => total + allocation.allocated_amount, 0)
}

function financeAccountFromCashbookRow(
  row: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]['rows'][number],
): FinanceAccountData {
  if (row.account_type === 'cash') {
    return { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash', is_default_cash: true, is_active: true, opening_balance: 0, note: null, notify_on_transaction: false }
  }
  const accountNumber = row.account_number ?? `BANK-${slug(row.account_name)}`
  const isDeletedAccount = accountNumber.includes('{DEL}') || row.account_name.includes('{DEL}')
  return {
    id: `bank-kv-${slug(accountNumber)}`,
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

function isReplacedDeletedFinanceAccount(
  account: CashbookEntryData['finance_account'],
  financeAccounts: Map<string, FinanceAccountData>,
) {
  const repositoryAccount = financeAccounts.get(account.id)
  const accountNumber = normalizeFinanceAccountNumber(repositoryAccount?.account_number ?? account.code)
  if (!accountNumber) return false
  const isDeleted = repositoryAccount?.is_active === false
    || repositoryAccount?.code?.includes('{DEL}')
    || repositoryAccount?.account_number?.includes('{DEL}')
    || account.code.includes('{DEL}')
  if (!isDeleted) return false
  return [...financeAccounts.values()].some((candidate) => (
    candidate.id !== account.id
    && candidate.account_type === 'bank'
    && candidate.is_active
    && normalizeFinanceAccountNumber(candidate.account_number ?? candidate.code) === accountNumber
  ))
}

function normalizeFinanceAccountNumber(value: string | null | undefined) {
  return String(value ?? '').replaceAll('{DEL}', '').replace(/\D/g, '')
}

function toImportedSalesDocument(
  sourceCode: string,
  itemMap: Map<number, KiotVietInvoiceRepositoryRow>,
  customers: Map<string, CustomerListData>,
  products: Map<string, ProductListData>,
  users: Map<string, UserListItemData>,
): SalesDocumentData {
  const rows = [...itemMap.values()].sort((left, right) => left.rowNumber - right.rowNumber)
  const firstRow = rows[0]
  const customer = resolveCustomerByImportCode(customers, firstRow?.customer_code ?? '') ?? [...customers.values()][0]
  const now = new Date().toISOString()
  const subtotal = firstRow?.subtotal_amount ?? rows.reduce((total, row) => total + row.line_amount, 0)
  const discount = firstRow?.invoice_discount_amount ?? 0
  const total = firstRow?.total_amount ?? Math.max(subtotal - discount + (firstRow?.other_income_amount ?? 0), 0)
  const paid = firstRow?.paid_amount ?? 0
  const debt = Math.max(total - paid, 0)
  const seller = resolveCustomerCreator(firstRow?.source_user_name, users) ?? { id: adminUser.id, name: adminUser.display_name }

  return {
    id: `order-kv-${slug(sourceCode)}`,
    code: sourceCode,
    order_type: 'invoice',
    status: firstRow?.status ?? 'completed',
    created_at: firstRow?.created_at ?? now,
    customer: {
      id: customer?.id ?? `customer-kv-${slug(firstRow?.customer_code ?? 'unknown')}`,
      code: customer?.code ?? firstRow?.customer_code ?? '',
      name: customer?.name ?? firstRow?.customer_name ?? '',
      phone: customer?.phone ?? firstRow?.customer_phone ?? null,
    },
    seller,
    subtotal_amount: subtotal,
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    debt_amount: debt,
    payment_status: debt <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    note: firstRow?.note ?? null,
    items: salesDocumentItemsFromImportRows(rows, products) as SalesDocumentData['items'],
  } as SalesDocumentData
}

function salesDocumentItemsFromImportRows(
  rows: KiotVietInvoiceRepositoryRow[],
  products: Map<string, ProductListData>,
) {
  return rows.map((row) => {
    const product = resolveProductByImportCode(products, row.product_code)
    return {
      product_id: product?.id ?? `product-${slug(row.product_code)}`,
      quantity: row.quantity,
      unit_price: row.unit_price,
      discount_amount: row.line_discount_amount,
      line_total: row.line_amount,
      sale_unit_name: row.unit_name ?? product?.unit_name ?? '',
      note: row.product_note ?? null,
    }
  })
}

function salesDocumentItemsToDetailItems(
  itemMap: Map<number, KiotVietInvoiceRepositoryRow>,
  products: Map<string, ProductListData>,
) {
  return salesDocumentItemsFromImportRows([...itemMap.values()].sort((left, right) => left.rowNumber - right.rowNumber), products) as SalesDocumentData['items']
}

function posInvoiceRowsFromSalesDocument(
  document: SalesDocumentData,
  products: Map<string, ProductListData>,
) {
  const itemMap = new Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]>()
  const items = Array.isArray(document.items) ? document.items : []
  items.forEach((rawItem, index) => {
    const item = rawItem as {
      product_id?: unknown
      quantity?: unknown
      unit_price?: unknown
      discount_amount?: unknown
      sale_unit_name?: unknown
      stock_qty_per_sale_unit?: unknown
    }
    const productId = typeof item.product_id === 'string' ? item.product_id : null
    const product = productId ? [...products.values()].find((candidate) => candidate.id === productId) : null
    if (!product) return
    const rowNumber = index + 1
    const quantity = positiveNumber(item.quantity) ?? 1
    const unitPrice = nonNegativeNumber(item.unit_price) ?? product.default_sale_price ?? 0
    const discountAmount = nonNegativeNumber(item.discount_amount) ?? 0
    const stockQtyPerSaleUnit = positiveNumber(item.stock_qty_per_sale_unit)
    const saleUnitName = typeof item.sale_unit_name === 'string' && item.sale_unit_name.trim() !== ''
      ? item.sale_unit_name.trim()
      : product.unit_name
    itemMap.set(rowNumber, {
      rowNumber,
      source_code: document.code,
      created_at: document.created_at,
      updated_at: null,
      customer_code: document.customer.code ?? 'khachle',
      customer_name: document.customer.name,
      customer_phone: document.customer.phone ?? null,
      customer_address: null,
      price_list_name: null,
      source_user_name: document.seller.name,
      channel_name: null,
      note: document.note,
      subtotal_amount: document.subtotal_amount,
      invoice_discount_amount: document.discount_amount,
      other_income_amount: 0,
      total_amount: document.total_amount,
      paid_amount: document.paid_amount,
      cash_amount: document.paid_amount,
      bank_amount: 0,
      status: 'completed',
      product_code: product.code,
      product_name: product.name,
      unit_name: saleUnitName,
      stock_qty_per_sale_unit: stockQtyPerSaleUnit,
      product_note: null,
      quantity,
      list_unit_price: unitPrice,
      line_discount_percent: null,
      line_discount_amount: discountAmount,
      unit_price: unitPrice,
      line_amount: Math.max(quantity * unitPrice - discountAmount, 0),
    })
  })
  return itemMap
}

function posProductUsageCountsFromSalesDocuments(salesDocuments: Map<string, SalesDocumentData>) {
  const usageByProductId = new Map<string, number>()
  for (const document of salesDocuments.values()) {
    if (document.order_type !== 'invoice' && document.order_type !== 'quote') continue
    const items = Array.isArray(document.items) ? document.items : []
    for (const rawItem of items) {
      const item = rawItem as { product_id?: unknown }
      if (typeof item.product_id !== 'string' || item.product_id.trim() === '') continue
      usageByProductId.set(item.product_id, (usageByProductId.get(item.product_id) ?? 0) + 1)
    }
  }
  return usageByProductId
}

function stockMovementsFromDocuments(
  purchaseReceipts: Map<string, PurchaseReceiptData>,
  purchaseReceiptItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'][number]>>,
  salesDocuments: Map<string, SalesDocumentData>,
  salesDocumentItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]>>,
  stocktakes: Map<string, StocktakeListData>,
  stocktakeItems: Map<string, Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>>,
  products: Map<string, ProductListData>,
  draftBoms: Map<string, Parameters<NonNullable<ServerRepository['upsertDraftProductBoms']>>[0]['rows'][number]>,
): StockMovementData[] {
  const sourceRows: Array<{ sortAt: string; code: string; reset_qty?: number; movement: Omit<StockMovementData, 'ending_qty'> }> = []

  for (const receipt of [...purchaseReceipts.values()].filter((item) => item.status === 'posted')) {
    const rows = [...(purchaseReceiptItems.get(receipt.code)?.values() ?? [])].sort((left, right) => left.rowNumber - right.rowNumber)
    for (const row of rows) {
      const product = resolveProductByImportCode(products, row.product_code)
      if (!product || !product.track_inventory) continue
      const quantityDelta = row.quantity * productImportQuantityFactor(product, row.product_code)
      if (quantityDelta === 0) continue
      sourceRows.push({
        sortAt: receipt.received_at,
        code: receipt.code,
        movement: {
          id: `stock-movement-kv-purchase-${slug(receipt.code)}-${row.rowNumber}`,
          product_id: product.id,
          movement_type: 'purchase_receipt',
          quantity_delta: quantityDelta,
          created_at: receipt.received_at,
          document_code: receipt.code,
          document_type: 'purchase_receipt',
          transaction_price: row.unit_cost,
          cost_price: row.unit_cost,
          partner_name: receipt.supplier.name,
        },
      })
    }
  }

  for (const document of [...salesDocuments.values()].filter((item) => item.status === 'completed')) {
    const rows = [...(salesDocumentItems.get(document.code)?.values() ?? [])].sort((left, right) => left.rowNumber - right.rowNumber)
    for (const row of rows) {
      const product = resolveProductByImportCode(products, row.product_code)
      if (!product) continue
      const saleUnitFactor = row.stock_qty_per_sale_unit !== null && row.stock_qty_per_sale_unit !== undefined && row.stock_qty_per_sale_unit > 0
        ? row.stock_qty_per_sale_unit
        : productImportQuantityFactor(product, row.product_code)
      const soldQuantity = row.quantity * saleUnitFactor
      if (product.track_inventory) {
        const quantityDelta = -soldQuantity
        if (quantityDelta !== 0) {
          sourceRows.push({
            sortAt: document.created_at,
            code: document.code,
            movement: {
              id: `stock-movement-kv-sale-${slug(document.code)}-${row.rowNumber}`,
              product_id: product.id,
              movement_type: 'sale_deduction',
              quantity_delta: quantityDelta,
              created_at: document.created_at,
              document_code: document.code,
              document_type: 'sale_invoice',
              transaction_price: row.unit_price,
              cost_price: product.latest_purchase_cost,
              partner_name: document.customer.name,
            },
          })
        }
      }
      const bom = draftBoms.get(product.code)
      if (!bom) continue
      for (const component of bom.components) {
        const componentProduct = resolveProductByImportCode(products, component.component_code)
        if (!componentProduct || !componentProduct.track_inventory) continue
        const componentFactor = productImportQuantityFactor(componentProduct, component.component_code)
        const quantityDelta = -soldQuantity * component.quantity * componentFactor
        if (quantityDelta === 0) continue
        sourceRows.push({
          sortAt: document.created_at,
          code: document.code,
          movement: {
            id: `stock-movement-kv-sale-bom-${slug(document.code)}-${row.rowNumber}-${slug(component.component_code)}`,
            product_id: componentProduct.id,
            movement_type: 'sale_deduction',
            quantity_delta: quantityDelta,
            created_at: document.created_at,
            document_code: document.code,
            document_type: 'sale_invoice',
            transaction_price: null,
            cost_price: componentProduct.latest_purchase_cost,
            partner_name: document.customer.name,
          },
        })
      }
    }
  }

  for (const stocktake of [...stocktakes.values()].filter((item) => item.status === 'balanced')) {
    const rows = [...(stocktakeItems.get(stocktake.code)?.values() ?? [])].sort((left, right) => left.rowNumber - right.rowNumber)
    for (const row of rows) {
      const product = resolveProductByImportCode(products, row.product_code)
      if (!product || !product.track_inventory || row.actual_qty === null) continue
      const actualQty = row.actual_qty * productImportQuantityFactor(product, row.product_code)
      sourceRows.push({
        sortAt: stocktake.balanced_at ?? stocktake.created_at,
        code: stocktake.code,
        reset_qty: actualQty,
        movement: {
          id: `stock-movement-kv-stocktake-${slug(stocktake.code)}-${row.rowNumber}`,
          product_id: product.id,
          movement_type: 'stocktake_balance',
          quantity_delta: 0,
          created_at: stocktake.balanced_at ?? stocktake.created_at,
          document_code: stocktake.code,
          document_type: 'stocktake',
          transaction_price: null,
          cost_price: product.latest_purchase_cost,
          partner_name: null,
        },
      })
    }
  }

  sourceRows.sort((left, right) => Date.parse(left.sortAt) - Date.parse(right.sortAt) || left.code.localeCompare(right.code))
  const endingQtyByProductId = new Map<string, number>()
  const movements: StockMovementData[] = []

  for (const row of sourceRows) {
    const currentQty = endingQtyByProductId.get(row.movement.product_id) ?? 0
    const quantityDelta = row.reset_qty === undefined ? row.movement.quantity_delta : row.reset_qty - currentQty
    const endingQty = currentQty + quantityDelta
    endingQtyByProductId.set(row.movement.product_id, endingQty)
    movements.push({ ...row.movement, quantity_delta: quantityDelta, ending_qty: endingQty })
  }

  return movements
}

function baseKiotVietImportCode(value: string) {
  return value.trim().replace(/\{DEL\d*\}$/i, '')
}

function resolveCustomerByImportCode(customers: Map<string, CustomerListData>, customerCode: string) {
  const exact = customers.get(customerCode)
  if (exact) return exact
  return customers.get(baseKiotVietImportCode(customerCode)) ?? null
}

function resolveProductByImportCode(products: Map<string, ProductListData>, productCode: string) {
  const exact = products.get(productCode)
  if (exact) return exact
  if (isDeletedKiotVietImportCode(productCode)) return null
  const baseCode = baseKiotVietImportCode(productCode)
  const direct = products.get(baseCode)
  if (direct) return direct
  for (const product of products.values()) {
    if ((product.unit_conversions ?? []).some((conversion) => unitConversionSourceCode(conversion) === baseCode)) {
      return product
    }
  }
  return null
}

function isDeletedKiotVietImportCode(value: string) {
  return /\{DEL\d*\}$/i.test(value.trim())
}

function productImportQuantityFactor(product: ProductListData, productCode: string) {
  const baseCode = baseKiotVietImportCode(productCode)
  if (baseKiotVietImportCode(product.code) === baseCode) return 1
  for (const conversion of product.unit_conversions ?? []) {
    if (unitConversionSourceCode(conversion) !== baseCode) continue
    const factor = unitConversionStockQtyPerUnit(conversion)
    return factor > 0 ? factor : 1
  }
  return 1
}

function unitConversionSourceCode(conversion: unknown) {
  if (!conversion || typeof conversion !== 'object' || !('source_code' in conversion)) return null
  const sourceCode = (conversion as { source_code?: unknown }).source_code
  return typeof sourceCode === 'string' && sourceCode.trim() ? baseKiotVietImportCode(sourceCode) : null
}

function unitConversionStockQtyPerUnit(conversion: unknown) {
  if (!conversion || typeof conversion !== 'object' || !('stock_qty_per_unit' in conversion)) return 1
  const value = (conversion as { stock_qty_per_unit?: unknown }).stock_qty_per_unit
  return typeof value === 'number' ? value : Number(value)
}

function toImportedStocktake(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'],
  itemMap: Map<number, Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]>,
  creator: { sourceCreatorName: string | null; createdBy: { id: string; name: string } | null },
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
    source_creator_name: creator.sourceCreatorName,
    created_by: creator.createdBy,
    total_actual_qty: totalActualQty,
    total_actual_value: totalActualValue,
    total_difference_value: totalDifferenceValue,
    increased_qty: increasedQty,
    decreased_qty: decreasedQty,
    note: allRows.find((row) => row.note?.trim())?.note?.trim() ?? 'Lịch sử kiểm kho KiotViet',
  }
}

function resolveCreatorByUsername(sourceCreatorName: string | null | undefined, users: Map<string, UserListItemData>) {
  if (!sourceCreatorName?.trim()) return null
  const normalized = normalizeCreatorIdentity(sourceCreatorName)
  const matches = [...users.values()].filter((user) => normalizeCreatorIdentity(user.username) === normalized)
  if (matches.length !== 1) return null
  return { id: matches[0].id, name: matches[0].display_name }
}

function resolveCustomerCreator(sourceCreatorName: string | null | undefined, users: Map<string, UserListItemData>) {
  if (!sourceCreatorName?.trim()) return null
  const usernameMatch = resolveCreatorByUsername(sourceCreatorName, users)
  if (usernameMatch) return usernameMatch
  const normalized = normalizeCreatorIdentity(sourceCreatorName)
  const userList = [...users.values()]
  const exactDisplayMatches = userList.filter((user) => normalizeCreatorIdentity(user.display_name) === normalized)
  if (exactDisplayMatches.length === 1) return { id: exactDisplayMatches[0].id, name: exactDisplayMatches[0].display_name }
  const sourceTokens = new Set(normalized.split(' ').filter(Boolean))
  const tokenMatches = userList.filter((user) => {
    const displayTokens = normalizeCreatorIdentity(user.display_name).split(' ').filter(Boolean)
    return displayTokens.length > 0 && displayTokens.every((token) => sourceTokens.has(token))
  })
  if (tokenMatches.length !== 1) return null
  return { id: tokenMatches[0].id, name: tokenMatches[0].display_name }
}

function resolveSourceCreator(
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'],
  users: Map<string, UserListItemData>,
) {
  const sourceCreatorName = rows.find((row) => row.source_creator_name?.trim())?.source_creator_name?.trim() ?? null
  if (!sourceCreatorName) return { sourceCreatorName, createdBy: null }
  return { sourceCreatorName, createdBy: resolveCreatorByUsername(sourceCreatorName, users) }
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

function priceListKey(value: string) {
  return normalize(value).replace(/\s+/g, ' ').trim()
}

function productGroupKey(value: string) {
  return normalize(value)
    .replace(/\s*>>\s*/g, '>>')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueProductGroups(groups: ProductGroupListData[]) {
  const byKey = new Map<string, ProductGroupListData>()
  for (const group of groups) {
    const key = productGroupKey(group.name)
    const current = byKey.get(key)
    if (!current || (!current.is_default && group.is_default)) byKey.set(key, group)
  }
  return [...byKey.values()]
}

function isDefaultSalePriceListName(value: string) {
  const key = priceListKey(value)
  return key === priceListKey(defaultPriceList.name) || key === priceListKey('Bảng giá chung')
}

function priceListPricesForProduct(
  productCode: string,
  defaultSalePrices: Map<string, number>,
  priceListNames: Map<string, { id: string; name: string }>,
  namedSalePrices: Map<string, Map<string, number>>,
): Record<string, number> {
  const prices: Record<string, number> = {}
  const defaultPrice = defaultSalePrices.get(productCode)
  if (defaultPrice !== undefined) prices[defaultPriceList.id] = defaultPrice
  for (const [priceListKeyValue, priceRows] of namedSalePrices) {
    const price = priceRows.get(productCode)
    const priceList = priceListNames.get(priceListKeyValue)
    if (price !== undefined && priceList) prices[priceList.id] = price
  }
  return prices
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/đ/g, 'd')
}

function normalizeCreatorIdentity(value: string | null | undefined) {
  return normalize(String(value ?? '').replace(/\{DEL\}$/i, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function optionalNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function positiveNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function dateRangeMatches(value: string, from: string | null, to: string | null) {
  return displayDateRangeMatches(value, from, to)
}
