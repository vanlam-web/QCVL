import { describe, expect, test, vi } from 'vitest'
import { createDevMemoryRepository } from './dev-memory-repository'
import { createHttpHandler, hashPassword, type ServerRepository } from './http'

const user = {
  id: 'user-1',
  email: 'admin@qc-oms.local',
  password_hash: '',
  organization_id: 'org-1',
  display_name: 'Admin',
  status: 'active' as const,
}

function repository(passwordHash: string, displayName = 'Admin'): ServerRepository {
  const sessions = new Map<string, string>()
  const userWithPassword = { ...user, display_name: displayName, password_hash: passwordHash }

  return {
    async findUserByEmail(email) {
      return email === user.email ? userWithPassword : null
    },
    async findUserByLogin(login) {
      return login === user.email || login === 'admin' || login === '0947900909' ? userWithPassword : null
    },
    async createSession(input) {
      sessions.set(input.token, input.userId)
    },
    async deleteSession(token) {
      sessions.delete(token)
    },
    async getSessionUser(token) {
      return sessions.get(token) === user.id
        ? {
            user: { id: user.id, email: user.email, display_name: displayName },
            organization: { id: 'org-1', code: 'VAN-LAM', name: 'Xuong Van Lam' },
            workstation: null,
            permissions: ['perm.create_order', 'perm.manage_users'],
          }
        : null
    },
    async listWorkstations() {
      return [{ id: 'ws-1', code: 'POS-01', name: 'Quay 1', status: 'active' }]
    },
  }
}

function persistentRepository(passwordHash: string, displayName = 'Admin'): ServerRepository {
  const base = repository(passwordHash, displayName)
  const documents: Array<{
    id: string
    code: string
    order_type: 'invoice' | 'quote'
    status: string
    created_at: string
    customer: { id: string; code: string; name: string; phone: string | null }
    seller: { id: string; name: string }
    subtotal_amount: number
    discount_amount: number
    total_amount: number
    paid_amount: number
    debt_amount: number
    payment_status: string
    note: string
    items: Array<{ product_id: string }>
  }> = []
  const cashbook: Array<{
    id: string
    code: string
    status: string
    direction: string
    amount_delta: number
    finance_account: { id: string; code: string; name: string; account_type: string }
    is_business_accounted: boolean
    source_type: string
    created_at: string
    note: string
    counterparty: { type: string; name: string; phone: string | null }
    created_by?: { id: string; name: string } | null
    source?: { type: string; id: string; code: string; order_code: string | null }
    allocations?: Array<{
      order_id: string
      order_code: string
      order_total_amount: number
      collected_before: number
      allocated_amount: number
      remaining_after: number
    }>
    payment_method?: string
  }> = []

  function normalize(value: string) {
    return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  }

  function documentMatches(url: URL, document: (typeof documents)[number]) {
    const search = normalize(url.searchParams.get('search') ?? '')
    const type = url.searchParams.get('type')
    const customerId = url.searchParams.get('customer_id')
    if (type && document.order_type !== type) return false
    if (customerId && document.customer.id !== customerId) return false
    if (search && !normalize(`${document.code} ${document.customer.code} ${document.customer.name} ${document.note}`).includes(search)) return false
    return true
  }

  function cashbookMatches(url: URL, entry: (typeof cashbook)[number]) {
    const search = normalize(url.searchParams.get('search') ?? '')
    if (search && !normalize(`${entry.code} ${entry.note} ${entry.counterparty.name}`).includes(search)) return false
    return true
  }

  return {
    ...base,
    async saveSalesDocument(input) {
      documents.unshift(input.document)
      cashbook.unshift(...input.cashbookEntries)
    },
    async listSalesDocuments(input) {
      return documents.filter((document) => documentMatches(input.url, document))
    },
    async getSalesDocument(input) {
      return documents.find((document) => document.id === input.id || document.code === input.id) ?? null
    },
    async updateSalesDocumentNote(input) {
      const document = documents.find((item) => item.id === input.id || item.code === input.id)
      if (!document) return null
      if (input.note !== undefined) document.note = input.note ?? ''
      if (input.created_at !== undefined) {
        document.created_at = input.created_at
        for (const entry of cashbook) entry.created_at = input.created_at
      }
      return document
    },
    async listCashbookEntries(input) {
      return cashbook.filter((entry) => cashbookMatches(input.url, entry))
    },
    async getCashbookEntry(input) {
      return cashbook.find((entry) => entry.id === input.id || entry.code === input.id) ?? null
    },
    async getCustomerDebt(input) {
      const invoices = documents
        .filter((document) => document.order_type === 'invoice' && document.customer.id === input.customerId && document.debt_amount > 0)
        .map((document) => ({
          order_id: document.id,
          order_code: document.code,
          created_at: document.created_at,
          total_amount: document.total_amount,
          paid_amount: document.paid_amount,
          debt_amount: document.debt_amount,
          remaining_debt: document.debt_amount,
        }))
      return {
        customer_id: input.customerId,
        total_debt: invoices.reduce((sum, invoice) => sum + invoice.remaining_debt, 0),
        invoices,
      }
    },
    async listCustomerDebts() {
      const debtByCustomer = new Map<string, {
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
      }>()
      for (const document of documents) {
        if (document.order_type !== 'invoice' || document.debt_amount <= 0) continue
        const invoice = {
          order_id: document.id,
          order_code: document.code,
          created_at: document.created_at,
          total_amount: document.total_amount,
          paid_amount: document.paid_amount,
          debt_amount: document.debt_amount,
          remaining_debt: document.debt_amount,
        }
        const existing = debtByCustomer.get(document.customer.id)
        if (existing) {
          existing.total_debt += document.debt_amount
          existing.open_invoice_count += 1
          existing.invoices.unshift(invoice)
        } else {
          debtByCustomer.set(document.customer.id, {
            customer_id: document.customer.id,
            customer_code: document.customer.code,
            customer_name: document.customer.name,
            total_debt: document.debt_amount,
            oldest_order_code: document.code,
            open_invoice_count: 1,
            invoices: [invoice],
          })
        }
      }
      return [...debtByCustomer.values()]
    },
    async collectCustomerDebt(input) {
      if (input.amount <= 0 || input.cashAmount + input.bankAmount !== input.amount) return { payment_receipt_id: '', allocated_amount: 0 }
      let remainingPayment = input.amount
      const allocations: Array<{
        order_id: string
        order_code: string
        order_total_amount: number
        collected_before: number
        allocated_amount: number
        remaining_after: number
      }> = []
      for (const document of [...documents].reverse()) {
        if (remainingPayment <= 0) break
        if (document.order_type !== 'invoice' || document.customer.id !== input.customerId || document.debt_amount <= 0) continue
        const allocated = Math.min(document.debt_amount, remainingPayment)
        const nextDebt = document.debt_amount - allocated
        document.paid_amount += allocated
        document.debt_amount = nextDebt
        document.payment_status = nextDebt <= 0 ? 'paid' : 'partial'
        allocations.push({
          order_id: document.id,
          order_code: document.code,
          order_total_amount: document.total_amount,
          collected_before: document.paid_amount - allocated,
          allocated_amount: allocated,
          remaining_after: nextDebt,
        })
        remainingPayment -= allocated
      }
      const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
      const receiptCode = `TT${String(cashbook.length + 1).padStart(6, '0')}`
      if (allocatedAmount > 0) {
        cashbook.unshift({
          id: `cashbook-test-${cashbook.length + 1}`,
          code: receiptCode,
          status: 'posted',
          direction: 'in',
          amount_delta: allocatedAmount,
          finance_account: { id: input.bankAccountId ?? 'bank-main', code: 'VCB', name: 'Vietcombank', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'payment_receipt_method',
          created_at: '2026-07-08T08:30:00.000Z',
          note: `${input.note ?? 'Thu no'} (${input.bankTransactionRef ?? ''})`,
          counterparty: { type: 'customer', name: input.customerId, phone: null },
        })
      }
      return { payment_receipt_id: receiptCode, allocated_amount: allocatedAmount }
    },
    async listCashbookEntries(input) {
      return cashbook.filter((entry) => cashbookMatches(input.url, entry))
    },
    async getCashbookEntry(input) {
      return cashbook.find((entry) => entry.id === input.id) ?? null
    },
    async getCustomerFinancialTotals() {
      const totals = new Map<string, { total_sales_amount: number; total_debt_amount: number }>()
      for (const document of documents) {
        if (document.order_type !== 'invoice' || document.status === 'cancelled') continue
        const existing = totals.get(document.customer.id) ?? { total_sales_amount: 0, total_debt_amount: 0 }
        totals.set(document.customer.id, {
          total_sales_amount: existing.total_sales_amount + document.total_amount,
          total_debt_amount: existing.total_debt_amount + Math.max(document.debt_amount, 0),
        })
      }
      return totals
    },
  }
}

describe('createHttpHandler', () => {
  test('reports persistence mode in health response', async () => {
    const handler = createHttpHandler({
      persistence: 'postgres',
      repository: repository(await hashPassword('ChangeMe123!')),
      version: 'test',
    })

    const response = await handler(new Request('http://api.local/api/v1/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      persistence: 'postgres',
      service: 'qcvl-api',
      status: 'ok',
      version: 'test',
    })
  })

  test('logs in with a password and returns the current user with the session token', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    expect(login.status).toBe(200)
    expect(loginBody.data.access_token).toEqual(expect.any(String))

    const me = await handler(
      new Request('http://api.local/api/v1/me', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const meBody = await me.json()

    expect(me.status).toBe(200)
    expect(meBody.data.user.email).toBe('admin@qc-oms.local')
    expect(meBody.data.permissions).toContain('perm.manage_users')
  })

  test('logs in with username or phone instead of requiring an email address', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })

    const usernameLogin = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const phoneLogin = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: '0947900909', password: 'ChangeMe123!' }),
      }),
    )

    expect(usernameLogin.status).toBe(200)
    expect((await usernameLogin.json()).data.access_token).toEqual(expect.any(String))
    expect(phoneLogin.status).toBe(200)
    expect((await phoneLogin.json()).data.access_token).toEqual(expect.any(String))
  })

  test('rejects creating a user when the username or phone would collide with another login id', async () => {
    const handler = createHttpHandler({
      repository: {
        ...repository(await hashPassword('ChangeMe123!')),
        async listUsers() {
          return [
            {
              id: 'user-admin',
              email: 'admin@example.test',
              username: 'admin',
              phone: null,
              birthday: null,
              region: null,
              ward: null,
              address: null,
              note: null,
              display_name: 'Admin',
              status: 'active',
              permissions: ['perm.manage_users'],
            },
            {
              id: 'user-cashier',
              email: 'cashier@example.test',
              username: '0947900909',
              phone: '0900000000',
              birthday: null,
              region: null,
              ward: null,
              address: null,
              note: null,
              display_name: 'Cashier',
              status: 'active',
              permissions: ['perm.create_order'],
            },
          ]
        },
      } as ServerRepository,
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          email: 'newcashier@example.test',
          username: 'new-cashier',
          phone: '0947900909',
          password: 'Password123!',
          display_name: 'New Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('RESOURCE_CONFLICT')
  })

  test('rejects invalid login without creating a token', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })

    const response = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'wrong-password' }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  test('allows the browser client device header for cross-origin dev sessions', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })

    const response = await handler(
      new Request('http://api.local/api/v1/me', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://127.0.0.1:3202',
          'access-control-request-headers': 'authorization,content-type,x-request-id,x-client-device-id',
        },
      }),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-headers')).toContain('x-client-device-id')
  })

  test('creates users through repository and returns persisted user list', async () => {
    const passwordHash = await hashPassword('ChangeMe123!')
    const createdUsers: unknown[] = []
    const base = repository(passwordHash)
    const handler = createHttpHandler({
      repository: {
        ...base,
        async listUsers() {
          return [
            {
              id: user.id,
              email: user.email,
              username: 'admin',
              phone: null,
              birthday: null,
              region: null,
              ward: null,
              address: null,
              note: null,
              display_name: user.display_name,
              status: 'active',
              permissions: ['perm.manage_users'],
            },
            ...createdUsers,
          ]
        },
        async createUser() {
          createdUsers.push({
            id: 'user-cashier',
            email: 'cashier@example.test',
            username: 'cashier-login',
            phone: '0912345678',
            birthday: '2026-07-07',
            region: 'TP Ho Chi Minh',
            ward: 'Phuong Ben Thanh',
            address: '12 Nguyen Trai',
            note: 'Ca toi',
            display_name: 'Cashier',
            status: 'active',
            permissions: ['perm.create_order'],
          })
          return createdUsers[0]
        },
      } as ServerRepository,
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const create = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          email: 'cashier@example.test',
          username: 'cashier-login',
          phone: '0912345678',
          birthday: '2026-07-07',
          region: 'TP Ho Chi Minh',
          ward: 'Phuong Ben Thanh',
          address: '12 Nguyen Trai',
          note: 'Ca toi',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const createBody = await create.json()

    expect(create.status).toBe(201)
    expect(createBody.data.username).toBe('cashier-login')
    expect(createdUsers).toHaveLength(1)

    const list = await handler(
      new Request('http://api.local/api/v1/users', {
        headers: { authorization },
      }),
    )
    const listBody = await list.json()

    expect(listBody.data.items).toHaveLength(2)
    expect(listBody.data.items[1].email).toBe('cashier@example.test')
  })

  test('persists created users in the dev memory repository', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const create = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          email: '',
          username: 'cashier-login',
          phone: '0912345678',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const createBody = await create.json()

    expect(create.status).toBe(201)
    expect(createBody.data.username).toBe('cashier-login')

    const list = await handler(
      new Request('http://api.local/api/v1/users', {
        headers: { authorization },
      }),
    )
    const listBody = await list.json()

    expect(listBody.data.items.map((item: { username: string | null }) => item.username)).toEqual([
      'cashier-login',
      'admin',
    ])
  })

  test('logs in as a created dev-memory user by username or phone', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'
    await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          email: 'cashier-login@example.test',
          username: 'cashier-login',
          phone: '0912345678',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )

    const usernameLogin = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: 'cashier-login', password: 'Password123!' }),
      }),
    )
    const phoneLogin = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: '0912345678', password: 'Password123!' }),
      }),
    )

    expect(usernameLogin.status).toBe(200)
    expect((await usernameLogin.json()).data.access_token).toEqual(expect.any(String))
    expect(phoneLogin.status).toBe(200)
    expect((await phoneLogin.json()).data.access_token).toEqual(expect.any(String))
  })

  test('rejects creating a user without required identity fields', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          email: 'cashier@example.test',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields).toEqual({ username: ['username is required.'] })
  })

  test('creates a user without a contact email by generating an internal email', async () => {
    const createdUsers: unknown[] = []
    const handler = createHttpHandler({
      repository: {
        ...repository(await hashPassword('ChangeMe123!')),
        async createUser(input: unknown) {
          createdUsers.push(input)
          return {
            id: 'user-no-email',
            email: (input as { email: string }).email,
            username: (input as { username: string }).username,
            phone: null,
            birthday: null,
            region: null,
            ward: null,
            address: null,
            note: null,
            display_name: 'Cashier',
            status: 'active',
            permissions: ['perm.create_order'],
          }
        },
      } as ServerRepository,
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          username: 'cashier-login',
          phone: '0912345678',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.email).toBe('cashier-login@users.qcvl.local')
    expect(createdUsers).toEqual([
      expect.objectContaining({
        email: 'cashier-login@users.qcvl.local',
        username: 'cashier-login',
        phone: '0912345678',
        displayName: 'Cashier',
      }),
    ])
  })

  test('rejects creating a user without a phone number', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          username: 'cashier-login',
          password: 'Password123!',
          display_name: 'Cashier',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('updates user profile fields and password through repository', async () => {
    const updatedUsers: unknown[] = []
    const handler = createHttpHandler({
      repository: {
        ...repository(await hashPassword('ChangeMe123!')),
        async updateUser(input: unknown) {
          updatedUsers.push(input)
          return {
            id: 'user-1',
            email: 'admin-updated@example.test',
            username: 'admin-updated',
            phone: '0900000000',
            birthday: null,
            region: null,
            ward: null,
            address: null,
            note: null,
            display_name: 'Admin Updated',
            status: 'active',
            permissions: ['perm.manage_users'],
          }
        },
      } as ServerRepository,
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users/user-1', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          email: 'admin-updated@example.test',
          username: 'admin-updated',
          phone: '0900000000',
          password: 'NewPassword123!',
          display_name: 'Admin Updated',
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.display_name).toBe('Admin Updated')
    expect(updatedUsers).toHaveLength(1)
    expect(updatedUsers[0]).toEqual(expect.objectContaining({
      email: 'admin-updated@example.test',
      username: 'admin-updated',
      phone: '0900000000',
      displayName: 'Admin Updated',
      id: 'user-1',
      passwordHash: expect.any(String),
    }))
  })

  test('updates a user display name when phone is empty', async () => {
    const updatedUsers: unknown[] = []
    const handler = createHttpHandler({
      repository: {
        ...repository(await hashPassword('ChangeMe123!')),
        async updateUser(input: unknown) {
          updatedUsers.push(input)
          return {
            id: 'user-1',
            email: 'admin@qc-oms.local',
            username: 'admin',
            phone: null,
            birthday: null,
            region: null,
            ward: null,
            address: null,
            note: null,
            display_name: 'Phạm Nhật Linh 2',
            status: 'active',
            permissions: ['perm.manage_users'],
          }
        },
      } as ServerRepository,
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/users/user-1', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({
          email: 'admin@qc-oms.local',
          username: 'admin',
          phone: null,
          display_name: 'Phạm Nhật Linh 2',
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.display_name).toBe('Phạm Nhật Linh 2')
    expect(updatedUsers[0]).toEqual(expect.objectContaining({
      id: 'user-1',
      displayName: 'Phạm Nhật Linh 2',
      phone: null,
    }))
  })

  test('filters demo sales documents by customer and document type', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const invoices = await handler(
      new Request('http://api.local/api/v1/sales-documents?customer_id=customer-retail&type=invoice&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const quotes = await handler(
      new Request('http://api.local/api/v1/sales-documents?customer_id=customer-retail&type=quote&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const invoiceBody = await invoices.json()
    const quoteBody = await quotes.json()

    expect(invoices.status).toBe(200)
    expect(quotes.status).toBe(200)
    expect(invoiceBody.data.items).toHaveLength(2)
    expect(quoteBody.data.items).toHaveLength(2)
    expect(invoiceBody.data.items.every((item: { order_type: string; customer: { code: string } }) => item.order_type === 'invoice' && item.customer.code === 'khachle')).toBe(true)
    expect(quoteBody.data.items.every((item: { order_type: string; customer: { code: string } }) => item.order_type === 'quote' && item.customer.code === 'khachle')).toBe(true)
    expect(invoiceBody.data.items[0].code).toContain('HD')
    expect(quoteBody.data.items[0].code).toContain('BG')
  })

  test('returns stock card movements with document codes for the selected product', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/inventory/stock-movements?product_id=product-002&page=1&page_size=15', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.total).toBe(20)
    expect(body.data.items).toHaveLength(15)
    expect(body.data.items.every((item: { product_id: string; document_code: string }) => item.product_id === 'product-002' && item.document_code)).toBe(true)
    expect(body.data.items.map((item: { document_code: string }) => item.document_code).join(',')).toMatch(/DEV20-(PN|HD)-/)
  })

  test('lists product groups from repository instead of static demo groups', async () => {
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      listProductGroups: vi.fn(async () => [
        { id: 'pg-alu', code: 'ALU', name: 'Alu>>Vật tư', is_default: false, is_active: true },
        { id: 'pg-fomex', code: 'FOMEX', name: 'Fomex', is_default: false, is_active: true },
      ]),
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/product-groups', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(testRepository.listProductGroups).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(body.data.items.map((item: { name: string }) => item.name)).toEqual(['Alu>>Vật tư', 'Fomex'])
  })

  test('creates a product group through repository upsert', async () => {
    const upsertProductGroupsByName = vi.fn(async () => new Map([['Mica >> Cắt laser', 'pg-mica-cat-laser']]))
    const listProductGroups = vi.fn(async () => [
      { id: 'pg-mica-cat-laser', code: 'MICA-CAT-LASER', name: 'Mica >> Cắt laser', is_default: false, is_active: true },
    ])
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      upsertProductGroupsByName,
      listProductGroups,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/product-groups', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({ name: 'Mica >> Cắt laser' }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(upsertProductGroupsByName).toHaveBeenCalledWith({ organizationId: 'org-1', names: ['Mica >> Cắt laser'] })
    expect(body.data).toEqual({ id: 'pg-mica-cat-laser', code: 'MICA-CAT-LASER', name: 'Mica >> Cắt laser', is_default: false, is_active: true })
  })

  test('renames a product group through repository update', async () => {
    const updateProductGroup = vi.fn(async () => ({
      id: 'pg-co-khi',
      code: 'KV-CO-KHI-MOI',
      name: 'Cơ khí mới',
      is_default: false,
      is_active: true,
    }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      updateProductGroup,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/product-groups/pg-co-khi', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
        body: JSON.stringify({ name: 'Cơ khí mới' }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(updateProductGroup).toHaveBeenCalledWith({ organizationId: 'org-1', id: 'pg-co-khi', name: 'Cơ khí mới' })
    expect(body.data).toEqual({ id: 'pg-co-khi', code: 'KV-CO-KHI-MOI', name: 'Cơ khí mới', is_default: false, is_active: true })
  })

  test('filters demo products by product kind and group', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const combo = await handler(
      new Request('http://api.local/api/v1/products?status=active&product_kind=combo&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const rollMica = await handler(
      new Request('http://api.local/api/v1/products?status=active&product_kind=roll&product_group_id=pg-mica&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const comboBody = await combo.json()
    const rollBody = await rollMica.json()

    expect(combo.status).toBe(200)
    expect(comboBody.data.total).toBeGreaterThan(0)
    expect(comboBody.data.items.every((item: { product_kind: string }) => item.product_kind === 'combo')).toBe(true)
    expect(rollBody.data.total).toBeGreaterThan(0)
    expect(rollBody.data.items.every((item: { product_kind: string; product_group_id: string }) => item.product_kind === 'roll' && item.product_group_id === 'pg-mica')).toBe(true)
  })

  test('filters demo products by created date range', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/products?status=active&created_from=2020-01-01&created_to=2020-01-31&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.total).toBe(0)
    expect(body.data.items).toEqual([])
  })

  test('filters deleted KiotViet products with the deleted status filter', async () => {
    const repository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository })
    const authorization = 'Bearer dev-token'

    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev',
      rows: [
        {
          code: 'SP000064{DEL}',
          name: 'Sat V2',
          status: 'inactive',
          product_group_id: null,
          unit_name: 'm',
          sell_method: 'quantity',
          product_kind: 'goods',
          inventory_shape: 'normal',
          track_inventory: true,
          latest_purchase_cost: 0,
          source_created_at: null,
          unit_conversions: [],
        },
        {
          code: 'LIVE',
          name: 'Hang dang ban',
          status: 'active',
          product_group_id: null,
          unit_name: 'cai',
          sell_method: 'quantity',
          product_kind: 'goods',
          inventory_shape: 'normal',
          track_inventory: true,
          latest_purchase_cost: 0,
          source_created_at: null,
          unit_conversions: [],
        },
      ],
    })

    const response = await handler(
      new Request('http://api.local/api/v1/products?status=deleted&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].code).toBe('SP000064{DEL}')
  })

  test('sorts POS quick products by persisted invoice and quote usage', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await handler(
      new Request('http://api.local/api/v1/orders/quotes', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-retail',
          items: [
            { product_id: 'product-005', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'manual' },
            { product_id: 'product-005', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'manual' },
          ],
          payment: { cash_amount: 0, bank_amount: 0, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )

    const response = await handler(
      new Request('http://api.local/api/v1/products?status=active&page=1&page_size=5&sort=pos_usage', {
        headers: { authorization },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items[0].id).toBe('product-005')
  })

  test('sorts POS quick products by dev-memory quote usage', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã hàng': 'LOW', 'Tên hàng': 'Ít bán', ĐVT: 'cái', 'Giá bán': 10000 },
            { rowNumber: 3, 'Mã hàng': 'HOT', 'Tên hàng': 'Bán nhiều', ĐVT: 'cái', 'Giá bán': 25000 },
          ],
        }),
      }),
    )

    for (let index = 0; index < 10; index++) {
      await handler(
        new Request('http://api.local/api/v1/orders/quotes', {
          method: 'POST',
          headers: { authorization },
          body: JSON.stringify({
            customer_id: 'customer-retail',
            items: [{ product_id: 'product-hot', quantity: 1, unit_price: 25000, discount_amount: 0, price_source: 'manual' }],
            payment: { cash_amount: 0, bank_amount: 0, old_debt_payment_amount: 0, change_returned_amount: 0 },
          }),
        }),
      )
    }

    const response = await handler(
      new Request('http://api.local/api/v1/products?status=active&page=1&page_size=5&sort=pos_usage', {
        headers: { authorization },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items[0].id).toBe('product-hot')
  })

  test('previews KiotViet product import without writing products', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet/preview', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            {
              rowNumber: 2,
              'Loại hàng': 'Hàng hóa',
              'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
              'Mã hàng': 'A10T',
              'Tên hàng': 'Alu 3li 0.1 Trắng',
              'Giá bán': 650000,
              'Giá vốn': 200000,
              'Giá bán': 650000,
              ĐVT: 'Tấm',
              'Đang kinh doanh': 1,
            },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ valid_rows: 1, invalid_rows: 0, create_rows: 1, update_rows: 0 })
  })

  test('previews KiotViet product import from uploaded xlsx base64 when browser cannot parse it', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`
    const workbook = buildMinimalXlsxBase64([
      ['Mã hàng', 'Tên hàng', 'ĐVT'],
      ['A10T', 'Alu 3li 0.1 Trắng', 'Tấm'],
      ['NO-UNIT', 'Thiếu đơn vị', ''],
    ])

    const response = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet/preview', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ cleanup_demo: false, file_base64: workbook }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ valid_rows: 2, invalid_rows: 0, unit_review_rows: 1 })
  })

  test('previews KiotViet customer import without writing customers', async () => {
    const findCustomersByCodes = vi.fn(async () => new Set(['KH000001']))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      findCustomersByCodes,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet/preview', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH000001', 'Tên khách hàng': 'A Cường', 'Nhóm khách hàng': '35', 'Nợ cần thu hiện tại': 100000, 'Tổng bán': 200000 },
            { rowNumber: 3, 'Mã khách hàng': 'KH000002', 'Tên khách hàng': 'A Cường', 'Loại khách': 'Công ty', 'Công ty': 'ABC', 'Phường/Xã': 'Triệu Ái', 'Khu vực giao hàng': 'Quảng Trị' },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(findCustomersByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['KH000001', 'KH000002'] })
    expect(body.data.summary).toMatchObject({
      total_rows: 2,
      valid_rows: 2,
      invalid_rows: 0,
      create_rows: 1,
      update_rows: 1,
      group_rows: 1,
      kiotviet_debt_total: 100000,
      kiotviet_total_sales: 200000,
    })
  })

  test('imports KiotViet customers by upserting customer codes', async () => {
    const upsertCustomersByCode = vi.fn(async () => ({ created: 1, updated: 1, skipped: 0 }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      upsertCustomerGroupsByName: vi.fn(async () => new Map([['35', 'cg-35']])),
      upsertCustomersByCode,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH000001', 'Tên khách hàng': 'A Cường', 'Nhóm khách hàng': '35' },
            { rowNumber: 3, 'Mã khách hàng': 'KH000002', 'Tên khách hàng': 'A Cường', 'Loại khách': 'Công ty', 'Công ty': 'ABC' },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ created_rows: 1, updated_rows: 1, skipped_rows: 0 })
    expect(upsertCustomersByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({ code: 'KH000001', name: 'A Cường', customer_group_id: 'cg-35' }),
        expect.objectContaining({ code: 'KH000002', name: 'A Cường', customer_type: 'company', company_name: 'ABC' }),
      ],
    })
  })

  test('lists customers imported into the demo customer repository fallback', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const importResponse = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH-KV-001', 'Tên khách hàng': 'Khách KV mới', 'Nhóm khách hàng': '35', 'Phường/Xã': 'Triệu Ái', 'Khu vực giao hàng': 'Quảng Trị' },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/customers?search=khach%20kv%20moi&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items).toEqual([
      expect.objectContaining({
        code: 'KH-KV-001',
        name: 'Khách KV mới',
        address: 'Triệu Ái, Quảng Trị',
      }),
    ])
  })

  test('imports KiotViet suppliers by upserting supplier codes', async () => {
    const upsertSuppliersByCode = vi.fn(async () => ({ created: 1, updated: 1, skipped: 0 }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      upsertSuppliersByCode,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/suppliers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma nha cung cap': 'THN', 'Ten nha cung cap': 'Thinh Hong Nguyen', 'Tong mua': 31973289 },
            { rowNumber: 3, 'Ma nha cung cap': 'NCC000038', 'Ten nha cung cap': 'O Hoa', 'Trang thai': 0 },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ created_rows: 1, updated_rows: 1, skipped_rows: 0 })
    expect(upsertSuppliersByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [
        expect.objectContaining({ code: 'THN', name: 'Thinh Hong Nguyen', kiotviet_total_purchase: 31973289 }),
        expect.objectContaining({ code: 'NCC000038', name: 'O Hoa', status: 'inactive' }),
      ],
    })
  })

  test('maps KiotViet customer creator to a QCVL account by username', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          username: 'maiphuong',
          phone: '0901000000',
          password: 'Password123!',
          display_name: 'Mai Phương',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const createUserBody = await createUser.json()

    const importResponse = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH-CREATOR-MAP', 'Tên khách hàng': 'Khách có người tạo', 'Người tạo': 'maiphuong{DEL}' },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/customers?search=KH-CREATOR-MAP&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items[0]).toEqual(expect.objectContaining({
      code: 'KH-CREATOR-MAP',
      source_creator_name: 'maiphuong{DEL}',
      created_by: { id: createUserBody.data.id, name: 'Mai Phương' },
    }))
  })

  test('maps KiotViet customer creator to a unique QCVL account by display name tokens', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          username: '0947900909',
          phone: '0901000000',
          password: 'Password123!',
          display_name: 'Văn Lâm',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const createUserBody = await createUser.json()

    const importResponse = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH-CREATOR-DISPLAY', 'Tên khách hàng': 'Khách có người tạo theo tên', 'Người tạo': 'Văn Viết Phương Lâm' },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/customers?search=KH-CREATOR-DISPLAY&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items[0]).toEqual(expect.objectContaining({
      code: 'KH-CREATOR-DISPLAY',
      source_creator_name: 'Văn Viết Phương Lâm',
      created_by: { id: createUserBody.data.id, name: 'Văn Lâm' },
    }))
  })

  test('resolves existing imported customer creator when the QCVL account is created later', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã khách hàng': 'KH-CREATOR-BACKFILL', 'Tên khách hàng': 'Khách backfill người tạo', 'Người tạo': 'bichnuong' },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          username: 'bichnuong',
          phone: '0902000000',
          password: 'Password123!',
          display_name: 'Nguyễn Thị Bích Nương',
          permissions: ['perm.create_order'],
        }),
      }),
    )
    const createUserBody = await createUser.json()

    const listResponse = await handler(
      new Request('http://api.local/api/v1/customers?search=KH-CREATOR-BACKFILL&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items[0]).toEqual(expect.objectContaining({
      code: 'KH-CREATOR-BACKFILL',
      source_creator_name: 'bichnuong',
      created_by: { id: createUserBody.data.id, name: 'Nguyễn Thị Bích Nương' },
    }))
  })

  test('deletes old KiotViet customer import data with a dedicated endpoint', async () => {
    const deleteImportedKiotVietCustomers = vi.fn(async () => ({ deleted: 531, blocked: 2 }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      deleteImportedKiotVietCustomers,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'DELETE',
        headers: { authorization },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(deleteImportedKiotVietCustomers).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(body.data).toEqual({ deleted_rows: 531, blocked_rows: 2 })
  })

  test('previews KiotViet stocktake import without writing inventory', async () => {
    const findProductsByCodes = vi.fn(async () => new Set(['HDA5']))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      findProductsByCodes,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet/preview', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'HDA5', 'Tồn kho': 60, 'Kiểm thực tế': 58, 'SL lệch': -2 },
            { rowNumber: 3, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'MISS', 'Tồn kho': 1, 'Kiểm thực tế': 2, 'SL lệch': 1 },
            { rowNumber: 4, 'Mã kiểm kho': 'KK2', 'Mã hàng': 'BAD', 'Tồn kho': 5, 'Kiểm thực tế': 7, 'SL lệch': 3 },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(findProductsByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['HDA5', 'MISS'] })
    expect(body.data.summary).toMatchObject({
      total_rows: 3,
      valid_rows: 2,
      invalid_rows: 1,
      stocktake_count: 1,
      product_code_count: 2,
      matched_product_count: 1,
      missing_product_count: 1,
      formula_error_count: 1,
    })
    expect(body.data.missing_product_codes).toEqual(['MISS'])
  })

  test('previews KiotViet stocktake import from uploaded xlsx base64', async () => {
    const findProductsByCodes = vi.fn(async () => new Set(['HDA5']))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      findProductsByCodes,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`
    const workbook = buildMinimalXlsxBase64([
      ['Ma kiem kho', 'Ma hang', 'Ton kho', 'Kiem thuc te', 'SL lech'],
      ['KK1', 'HDA5', '60', '58', '-2'],
    ])

    const response = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet/preview', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ file_base64: workbook }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ total_rows: 1, valid_rows: 1, stocktake_count: 1 })
    expect(findProductsByCodes).toHaveBeenCalledWith({ organizationId: 'org-1', codes: ['HDA5'] })
  })

  test('imports KiotViet stocktake history without changing stock movements', async () => {
    const deleteDemoStocktakesForImport = vi.fn(async () => ({ deleted: 1, blocked: 0 }))
    const upsertImportedKiotVietStocktakes = vi.fn(async () => ({
      stocktakes_created: 1,
      stocktakes_updated: 0,
      items_created: 2,
      items_updated: 0,
      missing_product_rows: 1,
    }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      deleteDemoStocktakesForImport,
      upsertImportedKiotVietStocktakes,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: true,
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK1', 'Ma hang': 'HDA5', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
            { rowNumber: 3, 'Ma kiem kho': 'KK1', 'Ma hang': 'OLD{DEL}', 'Ton kho': 3, 'Kiem thuc te': 0, 'SL lech': -3 },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(deleteDemoStocktakesForImport).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(upsertImportedKiotVietStocktakes).toHaveBeenCalledWith({
      organizationId: 'org-1',
      createdBy: null,
      rows: [
        expect.objectContaining({ source_code: 'KK1', product_code: 'HDA5', difference_qty: -2 }),
        expect.objectContaining({ source_code: 'KK1', product_code: 'OLD{DEL}', is_deleted_product_code: true }),
      ],
    })
    expect(body.data.summary).toMatchObject({
      valid_rows: 2,
      invalid_rows: 0,
      stocktakes_created: 1,
      items_created: 2,
      missing_product_rows: 1,
      cleanup_deleted_rows: 1,
      cleanup_blocked_rows: 0,
      creates_stock_movements: false,
    })
  })

  test('lists imported KiotViet stocktakes after import in dev memory repository', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK1', 'Ma hang': 'HDA5', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
          ],
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(importResponse.status).toBe(200)
    expect(listResponse.status).toBe(200)
    expect(listBody.data.items).toEqual([
      expect.objectContaining({
        code: 'KK1',
        source_type: 'kiotviet_import',
        created_by: null,
        total_actual_qty: 58,
        decreased_qty: 2,
      }),
    ])
  })

  test('loads imported KiotViet stocktake detail with source rows in dev memory repository', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              'Ma kiem kho': 'KK-DETAIL',
              'Nguoi tao': 'admin',
              'Ma hang': 'HDA5',
              'Ten hang': 'Hộp đèn alu 5mm',
              'DVT': 'Tấm',
              'Ton kho': 60,
              'Kiem thuc te': 58,
              'SL lech': -2,
              'Gia tri lech': -120000,
            },
            {
              rowNumber: 3,
              'Ma kiem kho': 'KK-DETAIL',
              'Ma hang': 'MISSING',
              'Ten hang': 'Hàng chưa có trong QCVL',
              'DVT': 'Tấm',
              'Ton kho': 0,
              'Kiem thuc te': 1,
              'SL lech': 1,
              'Gia tri lech': 690000,
            },
          ],
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?search=KK-DETAIL&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()
    const detailId = listBody.data.items[0].id
    const detailResponse = await handler(
      new Request(`http://api.local/api/v1/inventory/stocktakes/${detailId}`, {
        headers: { authorization },
      }),
    )
    const detailBody = await detailResponse.json()

    expect(importResponse.status).toBe(200)
    expect(detailResponse.status).toBe(200)
    expect(detailBody.data).toEqual(expect.objectContaining({
      id: detailId,
      code: 'KK-DETAIL',
      source_type: 'kiotviet_import',
      created_by: { id: 'user-dev-admin', name: 'Admin' },
    }))
    expect(detailBody.data.items).toEqual([
      expect.objectContaining({
        line_no: 2,
        product_id: null,
        product_code: 'HDA5',
        product_name: 'Hộp đèn alu 5mm',
        unit_name: 'Tấm',
        system_qty: 60,
        actual_qty: 58,
        difference_qty: -2,
        line_difference_value: -120000,
      }),
      expect.objectContaining({
        line_no: 3,
        product_id: null,
        product_code: 'MISSING',
        product_name: 'Hàng chưa có trong QCVL',
        actual_qty: 1,
        difference_qty: 1,
        line_difference_value: 690000,
      }),
    ])
  })

  test('maps KiotViet stocktake creator to a QCVL account when importing', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: 'maiphuong',
          phone: '0799481481',
          password: 'Password123!',
          display_name: 'Nguyễn Thị Mai Phương',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              'Ma kiem kho': 'KK-CREATOR',
              'Nguoi tao': 'maiphuong{DEL}',
              'Ma hang': 'HDA5',
              'Ton kho': 60,
              'Kiem thuc te': 58,
              'SL lech': -2,
            },
          ],
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(createUser.status).toBe(201)
    expect(importResponse.status).toBe(200)
    expect(listBody.data.items).toEqual([
      expect.objectContaining({
        code: 'KK-CREATOR',
        source_type: 'kiotviet_import',
        source_creator_name: 'maiphuong{DEL}',
        created_by: { id: expect.any(String), name: 'Nguyễn Thị Mai Phương' },
      }),
    ])
  })

  test('returns stocktake creator options independently from the selected creator filter', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    const firstUserResponse = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: 'maiphuong',
          phone: '0799481481',
          password: 'Password123!',
          display_name: 'Nguyễn Thị Mai Phương',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const secondUserResponse = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: 'vanlam',
          phone: '0947900909',
          password: 'Password123!',
          display_name: 'Văn Lâm',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const firstUserBody = await firstUserResponse.json()
    const secondUserBody = await secondUserResponse.json()

    await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-CREATOR-1', 'Nguoi tao': 'maiphuong', 'Ma hang': 'HDA5', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
            { rowNumber: 3, 'Ma kiem kho': 'KK-CREATOR-2', 'Nguoi tao': 'vanlam', 'Ma hang': 'F8', 'Ton kho': 1, 'Kiem thuc te': 2, 'SL lech': 1 },
          ],
        }),
      }),
    )

    const filteredResponse = await handler(
      new Request(`http://api.local/api/v1/inventory/stocktakes?created_by=${firstUserBody.data.id}&page=1&page_size=15`, {
        headers: { authorization },
      }),
    )
    const filteredBody = await filteredResponse.json()

    expect(filteredBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-CREATOR-1'])
    expect(filteredBody.data.creator_options).toEqual(expect.arrayContaining([
      { id: firstUserBody.data.id, name: 'Nguyễn Thị Mai Phương' },
      { id: secondUserBody.data.id, name: 'Văn Lâm' },
    ]))
  })

  test('updates a stocktake note and returns the refreshed detail', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-NOTE', 'Ghi chu': 'Ghi chú cũ', 'Ma hang': 'HDA5', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
          ],
        }),
      }),
    )

    const updateResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/KK-NOTE', {
        method: 'PATCH',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'Ghi chú mới' }),
      }),
    )
    const updateBody = await updateResponse.json()

    const detailResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/KK-NOTE', {
        headers: { authorization },
      }),
    )
    const detailBody = await detailResponse.json()

    expect(updateResponse.status).toBe(200)
    expect(updateBody.data).toEqual(expect.objectContaining({ code: 'KK-NOTE', note: 'Ghi chú mới' }))
    expect(detailBody.data).toEqual(expect.objectContaining({ code: 'KK-NOTE', note: 'Ghi chú mới' }))
  })

  test('cancels a stocktake and returns the refreshed detail', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-CANCEL', 'Ma hang': 'HDA5', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
          ],
        }),
      }),
    )

    const cancelResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/KK-CANCEL', {
        method: 'PATCH',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    )
    const cancelBody = await cancelResponse.json()

    const detailResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/KK-CANCEL', {
        headers: { authorization },
      }),
    )
    const detailBody = await detailResponse.json()

    expect(cancelResponse.status).toBe(200)
    expect(cancelBody.data).toEqual(expect.objectContaining({ code: 'KK-CANCEL', status: 'cancelled' }))
    expect(detailBody.data).toEqual(expect.objectContaining({ code: 'KK-CANCEL', status: 'cancelled' }))
  })

  test('maps KiotViet creator 0947900909 by QCVL username only', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: '0947900909',
          phone: '0900000000',
          password: 'Password123!',
          display_name: 'Tai khoan KV',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              'Ma kiem kho': 'KK-ADMIN-PHONE',
              'Nguoi tao': '0947900909',
              'Ma hang': 'HDA5',
              'Ton kho': 60,
              'Kiem thuc te': 58,
              'SL lech': -2,
            },
          ],
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(createUser.status).toBe(201)
    expect(importResponse.status).toBe(200)
    expect(listBody.data.items).toEqual([
      expect.objectContaining({
        code: 'KK-ADMIN-PHONE',
        source_creator_name: '0947900909',
        created_by: { id: expect.any(String), name: 'Tai khoan KV' },
      }),
    ])
  })

  test('does not map KiotViet creator by QCVL display name or phone', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: 'not-kv-creator',
          phone: '0947900909',
          password: 'Password123!',
          display_name: '0947900909',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              'Ma kiem kho': 'KK-NO-DISPLAY-PHONE',
              'Nguoi tao': '0947900909',
              'Ma hang': 'HDA5',
              'Ton kho': 60,
              'Kiem thuc te': 58,
              'SL lech': -2,
            },
          ],
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(importResponse.status).toBe(200)
    expect(listBody.data.items).toEqual([
      expect.objectContaining({
        code: 'KK-NO-DISPLAY-PHONE',
        source_creator_name: '0947900909',
        created_by: null,
      }),
    ])
  })

  test('shows the current QCVL display name after a mapped creator account is renamed', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    const createUser = await handler(
      new Request('http://api.local/api/v1/users', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '',
          username: '0947900909',
          phone: '0900000000',
          password: 'Password123!',
          display_name: 'Tên cũ',
          permissions: ['perm.manage_inventory'],
        }),
      }),
    )
    const createBody = await createUser.json()
    await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              'Ma kiem kho': 'KK-RENAME',
              'Nguoi tao': '0947900909',
              'Ma hang': 'HDA5',
              'Ton kho': 60,
              'Kiem thuc te': 58,
              'SL lech': -2,
            },
          ],
        }),
      }),
    )
    await handler(
      new Request(`http://api.local/api/v1/users/${createBody.data.id}`, {
        method: 'PATCH',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: createBody.data.email,
          username: '0947900909',
          phone: '0900000000',
          display_name: 'Tên mới',
        }),
      }),
    )
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(listBody.data.items).toEqual([
      expect.objectContaining({
        code: 'KK-RENAME',
        created_by: { id: createBody.data.id, name: 'Tên mới' },
      }),
    ])
  })

  test('filters imported KiotViet stocktakes by search, status, and source date in dev memory repository', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const importResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-JUNE', 'Thoi gian': '2026-06-15T09:30:00.000Z', 'Ma hang': 'HDA5', 'Ten hang': 'Hộp đèn alu 5mm', 'Trang thai': 'Da can bang', 'Ton kho': 60, 'Kiem thuc te': 58, 'SL lech': -2 },
            { rowNumber: 3, 'Ma kiem kho': 'KK-JULY', 'Thoi gian': '2026-07-02T09:30:00.000Z', 'Ma hang': 'F8', 'Ten hang': 'Fomex 8mm', 'Trang thai': 'Da huy', 'Ton kho': 60, 'Kiem thuc te': 60, 'SL lech': 0 },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const [statusResponse, dateResponse, searchResponse, productCodeSearchResponse, productNameSearchResponse, noneResponse] = await Promise.all([
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?status=cancelled&page=1&page_size=15', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?from=2026-06-01&to=2026-06-30&page=1&page_size=15', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?search=KK-JULY&page=1&page_size=15', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?search=F8&page=1&page_size=15', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?search=alu&page=1&page_size=15', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/stocktakes?status=__none__&page=1&page_size=15', { headers: { authorization } })),
    ])
    const [statusBody, dateBody, searchBody, productCodeSearchBody, productNameSearchBody, noneBody] = await Promise.all([
      statusResponse.json(),
      dateResponse.json(),
      searchResponse.json(),
      productCodeSearchResponse.json(),
      productNameSearchResponse.json(),
      noneResponse.json(),
    ])

    expect(statusBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-JULY'])
    expect(dateBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-JUNE'])
    expect(searchBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-JULY'])
    expect(productCodeSearchBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-JULY'])
    expect(productNameSearchBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-JUNE'])
    expect(productCodeSearchBody.data.items[0]).toEqual(expect.objectContaining({
      code: 'KK-JULY',
      product_code: 'F8',
      product_name: 'Fomex 8mm',
      product_system_qty: 60,
      product_actual_qty: 60,
      product_difference_qty: 0,
    }))
    expect(productNameSearchBody.data.items[0]).toEqual(expect.objectContaining({
      code: 'KK-JUNE',
      product_code: 'HDA5',
      product_name: 'Hộp đèn alu 5mm',
      product_system_qty: 60,
      product_actual_qty: 58,
      product_difference_qty: -2,
    }))
    expect(noneBody.data.items).toEqual([])
  })

  test('cleans dev stocktake test artifacts before KiotViet import', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const seedResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-CLEANUP-CHECK', 'Ma hang': 'HDA5', 'Ton kho': 1, 'Kiem thuc te': 1, 'SL lech': 0 },
          ],
        }),
      }),
    )
    expect(seedResponse.status).toBe(200)

    const cleanupResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: true,
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-REAL', 'Ma hang': 'HDA5', 'Ton kho': 2, 'Kiem thuc te': 2, 'SL lech': 0 },
          ],
        }),
      }),
    )
    const cleanupBody = await cleanupResponse.json()
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const listBody = await listResponse.json()

    expect(cleanupResponse.status).toBe(200)
    expect(cleanupBody.data.summary.cleanup_deleted_rows).toBe(1)
    expect(listBody.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-REAL'])
  })

  test('deletes old KiotViet stocktake imports through a dedicated endpoint', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK-REAL', 'Ma hang': 'HDA5', 'Ton kho': 2, 'Kiem thuc te': 2, 'SL lech': 0 },
          ],
        }),
      }),
    )

    const deleteResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'DELETE',
        headers: { authorization },
      }),
    )
    const deleteBody = await deleteResponse.json()
    const listResponse = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes?page=1&page_size=15', { headers: { authorization } }),
    )
    const listBody = await listResponse.json()

    expect(deleteResponse.status).toBe(200)
    expect(deleteBody.data).toEqual({ deleted_rows: 1, blocked_rows: 0 })
    expect(listBody.data.items).toEqual([])
  })

  test('deletes old KiotViet product imports through a dedicated endpoint', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma hang': 'P1', 'Ten hang': 'Product 1', DVT: 'tam' },
            { rowNumber: 3, 'Ma hang': 'P2', 'Ten hang': 'Product 2', DVT: 'tam' },
          ],
        }),
      }),
    )

    const deleteResponse = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'DELETE',
        headers: { authorization },
      }),
    )
    const deleteBody = await deleteResponse.json()
    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?page=1&page_size=15', { headers: { authorization } }),
    )
    const listBody = await listResponse.json()

    expect(deleteResponse.status).toBe(200)
    expect(deleteBody.data).toEqual({ deleted_rows: 2, blocked_rows: 0 })
    expect(listBody.data.items).toEqual([])
  })

  test('rejects KiotViet stocktake import when formulas are invalid', async () => {
    const upsertImportedKiotVietStocktakes = vi.fn()
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      upsertImportedKiotVietStocktakes,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma kiem kho': 'KK1', 'Ma hang': 'BAD', 'Ton kho': 5, 'Kiem thuc te': 7, 'SL lech': 3 },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(upsertImportedKiotVietStocktakes).not.toHaveBeenCalled()
  })

  test('imports KiotViet products by upserting product codes', async () => {
    const upsertProductsByCode = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      deleteDemoProductsForImport: vi.fn(async () => ({ deleted: 0, blocked: 0 })),
      upsertProductGroupsByName: vi.fn(async () => new Map([['Alu>>Vật tư', 'pg-alu']])),
      upsertProductsByCode,
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: true,
          rows: [
            {
              rowNumber: 2,
              'Loại hàng': 'Hàng hóa',
              'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
              'Mã hàng': 'A10T',
              'Tên hàng': 'Alu 3li 0.1 Trắng',
              'Giá vốn': 200000,
              ĐVT: 'Tấm',
              'Đang kinh doanh': 1,
            },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.summary).toMatchObject({ created_rows: 1, updated_rows: 0 })
    expect(upsertProductsByCode).toHaveBeenCalledWith({
      organizationId: 'org-1',
      rows: [expect.objectContaining({ code: 'A10T', product_group_id: 'pg-alu' })],
    })
  })

  test('lists products imported into the dev memory repository', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            {
              rowNumber: 2,
              'Loại hàng': 'Hàng hóa',
              'Nhóm hàng(3 Cấp)': 'Alu',
              'Mã hàng': 'A10T',
              'Tên hàng': 'Alu 3li 0.1 Trắng',
              'Giá vốn': 200000,
              'Giá bán': 650000,
              'ĐVT': 'Tấm',
              'Đang kinh doanh': 1,
            },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?search=A10T&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(body.data.items).toEqual([
      expect.objectContaining({ code: 'A10T', name: 'Alu 3li 0.1 Trắng', default_sale_price: 650000 }),
    ])
  })

  test('lists KiotViet provisional stock and draft BOM metadata for imported products', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            { rowNumber: 2, 'Mã hàng': 'DCS', 'Tên hàng': 'Decal sua', ĐVT: 'm2', 'Tồn kho': 12, 'Đang kinh doanh': 1 },
            { rowNumber: 3, 'Mã hàng': 'F5', 'Tên hàng': 'Fomex 5mm', ĐVT: 'tam', 'Đang kinh doanh': 1 },
            { rowNumber: 4, 'Mã hàng': 'HH', 'Tên hàng': 'Hop hoa', ĐVT: 'cai', 'Tồn kho': 4, 'Hàng thành phần': 'DCS:0.6|F5:0.3', 'Đang kinh doanh': 1 },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?search=HH&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(body.data.items).toEqual([
      expect.objectContaining({
        code: 'HH',
        kiotviet_provisional_stock: expect.objectContaining({
          quantity: 4,
          unit_name: 'cai',
          source_type: 'kiotviet_import',
        }),
        draft_bom: expect.objectContaining({
          status: 'draft',
          item_count: 2,
        }),
      }),
    ])
  })

  test('returns latest KiotViet stocktake evidence in product list data', async () => {
    const testRepository: ServerRepository = {
      ...repository(await hashPassword('ChangeMe123!')),
      listProducts: vi.fn(async () => [{
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
        kiotviet_provisional_stock: { quantity: 60, unit_name: 'Cuộn', source_type: 'kiotviet_import', source_label: 'KiotViet product import' },
        latest_kiotviet_stocktake: {
          code: 'KK000333',
          source_created_at: '2026-07-10T09:30:00.000Z',
          source_balanced_at: '2026-07-10T09:45:00.000Z',
          system_qty: 60,
          actual_qty: 58,
          difference_qty: -2,
          unit_name: 'Cuộn',
        },
      }]),
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/products?search=HDA5&page=1&page_size=15', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items[0].latest_kiotviet_stocktake).toMatchObject({
      code: 'KK000333',
      actual_qty: 58,
      difference_qty: -2,
      unit_name: 'Cuộn',
    })
  })

  test('returns product code total for the current product filter for KiotViet style footer', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            { rowNumber: 2, 'Mã hàng': 'ACTIVE-1', 'Tên hàng': 'Active 1', 'ĐVT': 'Cái', 'Đang kinh doanh': 1 },
            { rowNumber: 3, 'Mã hàng': 'ACTIVE-2', 'Tên hàng': 'Active 2', 'ĐVT': 'Cái', 'Đang kinh doanh': 1 },
            { rowNumber: 4, 'Mã hàng': 'INACTIVE-1', 'Tên hàng': 'Inactive 1', 'ĐVT': 'Cái', 'Đang kinh doanh': 0 },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?status=active&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(body.data.total).toBe(2)
    expect(body.data.total_all).toBe(2)
  })

  test('resolves POS prices from imported KiotViet price lists with fallback to default price', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            { rowNumber: 2, SKU: 'F5d2', 'Tên hàng': 'Fomex 5mm - decal', ĐVT: 'Tấm', 'Nhóm hàng': 'Fomex', 'Bảng giá chung': 80000, 25: 75000 },
            { rowNumber: 3, SKU: 'ADC', 'Tên hàng': 'Bảng Alu dán decal', ĐVT: 'Cái', 'Nhóm hàng': 'Thi công', 'Bảng giá chung': 30000 },
            { rowNumber: 4, SKU: 'Z0', 'Tên hàng': 'Chưa có giá', ĐVT: 'Cái', 'Nhóm hàng': 'Thi công' },
          ],
        }),
      }),
    )
    await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [{ rowNumber: 2, 'Mã khách hàng': 'KH25', 'Tên khách hàng': 'Khách bảng 25', 'Nhóm khách hàng': '25' }],
        }),
      }),
    )

    async function productId(code: string) {
      const response = await handler(new Request(`http://api.local/api/v1/products?search=${code}`, { headers: { authorization } }))
      const body = await response.json()
      return body.data.items.find((product: { code: string }) => product.code === code).id as string
    }

    const customerResponse = await handler(new Request('http://api.local/api/v1/customers?search=KH25', { headers: { authorization } }))
    const customerBody = await customerResponse.json()
    const priceListResponse = await handler(new Request('http://api.local/api/v1/price-lists', { headers: { authorization } }))
    const priceListBody = await priceListResponse.json()
    const customerId = customerBody.data.items[0].id
    const f5Id = await productId('F5d2')
    const adcId = await productId('ADC')
    const z0Id = await productId('Z0')

    const response = await handler(
      new Request('http://api.local/api/v1/pricing/resolve', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, product_ids: [f5Id, adcId, z0Id] }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(priceListBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '25', is_active: true }),
    ]))
    expect(body.data.items).toEqual([
      expect.objectContaining({ product_id: f5Id, unit_price: 75000, price_source: 'customer_group_price_list' }),
      expect.objectContaining({ product_id: adcId, unit_price: 30000, price_source: 'fallback_default_price_list' }),
      expect.objectContaining({ product_id: z0Id, unit_price: 0, price_source: 'default_price_list' }),
    ])
  })

  test('sorts product list by created time by default instead of import time', async () => {
    const productRepository = await createDevMemoryRepository()
    await productRepository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [
        { rowNumber: 2, code: 'TXHP', name: 'Ton xop da Hoa Phat', product_group_name: 'Vat tu', product_group_id: null, product_kind: 'goods', inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true, unit_name: 'm', latest_purchase_cost: 163000, status: 'active', unit_conversions: [], sale_price: null, provisional_stock: null, bom_text: null, source_created_at: '2026-06-13T09:05:00.000Z', ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null } },
        { rowNumber: 3, code: 'NGD', name: 'Nhua gia da', product_group_name: 'Vat tu', product_group_id: null, product_kind: 'goods', inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true, unit_name: 'Tam', latest_purchase_cost: 280000, status: 'active', unit_conversions: [], sale_price: null, provisional_stock: null, bom_text: null, source_created_at: '2026-07-11T14:50:00.000Z', ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null } },
        { rowNumber: 4, code: 'lpn', name: 'Laphong Nhua', product_group_name: 'Vat tu', product_group_id: null, product_kind: 'goods', inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true, unit_name: 'Goi', latest_purchase_cost: 4754000, status: 'active', unit_conversions: [], sale_price: null, provisional_stock: null, bom_text: null, source_created_at: '2026-07-01T10:07:00.000Z', ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null } },
      ],
    })
    const handler = createHttpHandler({ repository: productRepository })

    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?status=active&page=1&page_size=15', {
        headers: { authorization: 'Bearer dev-token' },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items.map((item: { code: string }) => item.code)).toEqual(['NGD', 'lpn', 'TXHP'])
  })

  test('counts KiotViet unit conversion rows as source codes but not products', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/products/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          cleanup_demo: false,
          rows: [
            { rowNumber: 2, 'Mã hàng': 'BT', 'Tên hàng': 'Bạt 300g Ojet Tím', 'ĐVT': 'm2', 'Mã ĐVT Cơ bản': '1', 'Quy đổi': '' },
            { rowNumber: 3, 'Mã hàng': 'B50', 'Tên hàng': 'Bạt 300g Ojet Tím', 'ĐVT': 'Khổ 50', 'Mã ĐVT Cơ bản': 'BT', 'Quy đổi': 40 },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/products?status=all&page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.total).toBe(1)
    expect(body.data.total_all).toBe(2)
    expect(body.data.items).toEqual([
      expect.objectContaining({
        code: 'BT',
        unit_conversions: [expect.objectContaining({ unit_name: 'Khổ 50', stock_qty_per_unit: 40 })],
      }),
    ])
  })

  test('searches demo customers by POS query text', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/customers?search=0908000002&page=1&page_size=10', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].code).toBe('DEV20-KH-002')
  })

  test('searches demo customers without Vietnamese accents', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    const response = await handler(
      new Request('http://api.local/api/v1/customers?search=khach%20le&page=1&page_size=10', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items.some((item: { code: string; name: string }) => item.code === 'khachle' && item.name === 'Khách lẻ')).toBe(true)
  })

  test('filters imported customers by status and summarizes KiotViet net sales', async () => {
    const handler = createHttpHandler({ repository: await createDevMemoryRepository() })
    const authorization = 'Bearer dev-token'

    const importResponse = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: [
            { rowNumber: 2, 'Ma khach hang': 'KH-ACTIVE', 'Ten khach hang': 'Khach active', 'No can thu hien tai': 100000, 'Tong ban': 500000, 'Tong ban tru tra hang': 450000, 'Trang thai': 1 },
            { rowNumber: 3, 'Ma khach hang': 'KH-INACTIVE', 'Ten khach hang': 'Khach inactive', 'No can thu hien tai': 200000, 'Tong ban': 700000, 'Tong ban tru tra hang': 650000, 'Trang thai': 0 },
          ],
        }),
      }),
    )
    expect(importResponse.status).toBe(200)

    const listResponse = await handler(
      new Request('http://api.local/api/v1/customers?status=active&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const body = await listResponse.json()

    expect(body.data.items.map((item: { code: string }) => item.code)).toEqual(['KH-ACTIVE'])
    expect(body.data.summary).toMatchObject({
      total_debt_amount: 100000,
      total_sales_amount: 450000,
    })
  })

  test('searches demo management lists by the fields advertised in each search box', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const requests = await Promise.all([
      handler(new Request('http://api.local/api/v1/sales-documents?search=don%20demo%20004&page=1&page_size=10', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/inventory/products?q=mica&page=1&page_size=10', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/suppliers?q=nha%20cung%20cap%20demo%20003&page=1&page_size=10', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/purchase/receipts?q=hd-ncc-004&page=1&page_size=10', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/finance/customer-debts?search=khach%20demo%20002&page=1&page_size=10', { headers: { authorization } })),
      handler(new Request('http://api.local/api/v1/finance/cashbook?search=khach%20demo%20002&page=1&page_size=10', { headers: { authorization } })),
    ])
    const [salesDocuments, inventory, suppliersList, purchaseReceiptsList, customerDebts, cashbook] = await Promise.all(requests.map((response) => response.json()))

    expect(requests.every((response) => response.status === 200)).toBe(true)
    expect(salesDocuments.data.items.map((item: { note: string }) => item.note)).toContain('Don demo 004')
    expect(inventory.data.items.every((item: { code: string; name: string }) => `${item.code} ${item.name}`.toLowerCase().includes('mica'))).toBe(true)
    expect(suppliersList.data.items).toHaveLength(1)
    expect(suppliersList.data.items[0].code).toBe('DEV20-NCC-003')
    expect(purchaseReceiptsList.data.items).toHaveLength(1)
    expect(purchaseReceiptsList.data.items[0].supplier_document_no).toBe('HD-NCC-004')
    expect(customerDebts.data.items).toHaveLength(1)
    expect(customerDebts.data.items[0].customer_name).toBe('Khach demo 002')
    expect(cashbook.data.items.every((item: { counterparty: { name: string } }) => item.counterparty.name === 'Khach demo 002')).toBe(true)
  })

  test('previews, imports, and deletes KiotViet sales invoices through sales document endpoints', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'
    await testRepository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'active',
      }],
    })
    await testRepository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'BT',
        name: 'Bat 300g Ojet Tim',
        product_group_name: 'Bat',
        product_group_id: null,
        product_kind: 'roll',
        inventory_shape: 'roll',
        sell_method: 'area_m2',
        track_inventory: true,
        unit_name: 'm2',
        latest_purchase_cost: 20000,
        status: 'active',
        unit_conversions: [{ source_code: 'B260', unit_name: 'Kho 260', stock_qty_per_unit: 208, is_default_purchase_unit: false, is_default_sale_unit: true }],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })
    const payload = {
      rows: [{
        rowNumber: 2,
        'Ma hoa don': 'HD-KV-001',
        'Thoi gian tao': '2026-07-13T00:00:00.000Z',
        'Ma khach hang': '',
        'Ten khach hang': 'Khach le',
        'Nguoi ban': 'Admin',
        'Tong tien hang': 500000,
        'Giam gia hoa don': 0,
        'Khach can tra': 500000,
        'Khach da tra': 300000,
        'Tien mat': 100000,
        'Chuyen khoan': 200000,
        'Trang thai': 'Hoan thanh',
        'Ma hang': 'B260',
        'Ten hang': 'Bat 300g Ojet Tim',
        'DVT': 'Kho 260',
        'So luong': 0.5,
        'Gia ban': 500000,
        'Thanh tien': 250000,
      }],
    }

    const previewResponse = await handler(new Request('http://api.local/api/v1/sales-documents/import/kiotviet/preview', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    const importResponse = await handler(new Request('http://api.local/api/v1/sales-documents/import/kiotviet', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    const listResponse = await handler(new Request('http://api.local/api/v1/sales-documents?search=HD-KV-001&page=1&page_size=10', { headers: { authorization } }))
    const deleteResponse = await handler(new Request('http://api.local/api/v1/sales-documents/import/kiotviet', { method: 'DELETE', headers: { authorization } }))
    const listAfterDeleteResponse = await handler(new Request('http://api.local/api/v1/sales-documents?search=HD-KV-001&page=1&page_size=10', { headers: { authorization } }))

    const previewBody = await previewResponse.json()
    const importBody = await importResponse.json()
    const listBody = await listResponse.json()
    const deleteBody = await deleteResponse.json()
    const listAfterDeleteBody = await listAfterDeleteResponse.json()

    expect(previewResponse.status).toBe(200)
    expect(previewBody.data.summary).toMatchObject({ invoice_count: 1, missing_customer_count: 0, missing_product_count: 0 })
    expect(importResponse.status).toBe(200)
    expect(importBody.data.summary).toMatchObject({ created_rows: 1, items_created: 1, invalid_rows: 0 })
    expect(listBody.data.items).toEqual([expect.objectContaining({ code: 'HD-KV-001', paid_amount: 300000, debt_amount: 200000 })])
    expect(listBody.data.summary).toMatchObject({ total_amount: 500000, debt_amount: 200000 })
    expect(deleteResponse.status).toBe(200)
    expect(deleteBody.data).toEqual({ deleted_rows: 1, blocked_rows: 0 })
    expect(listAfterDeleteBody.data.items).toEqual([])
  })

  test('previews, imports, and deletes KiotViet cashbook rows through finance endpoints', async () => {
    const testRepository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'
    const payload = {
      rows: [
        { rowNumber: 2, 'Ma phieu': 'PT-KV-OPEN-001', 'Thoi gian': '2026-06-30T08:00:00.000Z', 'Gia tri': 4000, 'Loai so quy': 'Tien mat', 'Trang thai': 'Da thanh toan', 'Loai thu chi': 'Phieu thu Tien khach tra' },
        { rowNumber: 3, 'Ma phieu': 'PT-KV-001', 'Thoi gian': '2026-07-01T08:00:00.000Z', 'Gia tri': 1000, 'Loai so quy': 'Tien mat', 'Trang thai': 'Da thanh toan', 'Loai thu chi': 'Phieu thu Tien khach tra' },
        { rowNumber: 4, 'Ma phieu': 'PC-KV-001', 'Thoi gian': '2026-07-02T08:00:00.000Z', 'Gia tri': -3000, 'Loai so quy': 'Ngan hang', 'Ten tai khoan': 'TK Chi', 'So tai khoan': '7059359298', 'Trang thai': 'Da thanh toan' },
      ],
    }

    const previewResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook/import/kiotviet/preview', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    const importResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook/import/kiotviet', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    const listResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook?search=KV&page=1&page_size=10', { headers: { authorization } }))
    const julyListResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook?search=KV&from=2026-07-01&to=2026-07-31&page=1&page_size=1', { headers: { authorization } }))
    const accountsResponse = await handler(new Request('http://api.local/api/v1/finance/accounts?is_active=true', { headers: { authorization } }))
    const deleteResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook/import/kiotviet', { method: 'DELETE', headers: { authorization } }))
    const listAfterDeleteResponse = await handler(new Request('http://api.local/api/v1/finance/cashbook?search=KV&page=1&page_size=10', { headers: { authorization } }))

    const previewBody = await previewResponse.json()
    const importBody = await importResponse.json()
    const listBody = await listResponse.json()
    const julyListBody = await julyListResponse.json()
    const accountsBody = await accountsResponse.json()
    const deleteBody = await deleteResponse.json()
    const listAfterDeleteBody = await listAfterDeleteResponse.json()

    expect(previewResponse.status).toBe(200)
    expect(previewBody.data.summary).toMatchObject({ account_count: 2, cash_rows: 2, bank_rows: 1 })
    expect(importResponse.status).toBe(200)
    expect(importBody.data.summary).toMatchObject({ created_rows: 3, accounts_created: 1, accounts_updated: 2 })
    expect(listBody.data.items).toHaveLength(3)
    expect(listBody.data.summary).toMatchObject({
      opening_balance: 0,
      total_in: 5000,
      total_out: 3000,
      ending_balance: 2000,
    })
    expect(julyListBody.data.items).toHaveLength(1)
    expect(julyListBody.data.total).toBe(2)
    expect(julyListBody.data.summary).toMatchObject({
      opening_balance: 4000,
      total_in: 1000,
      total_out: 3000,
      ending_balance: 2000,
    })
    expect(listBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PC-KV-001', amount_delta: -3000 }),
      expect.objectContaining({ code: 'PT-KV-001', amount_delta: 1000 }),
    ]))
    expect(accountsBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ account_number: '7059359298', name: 'TK Chi', account_type: 'bank' }),
    ]))
    expect(deleteResponse.status).toBe(200)
    expect(deleteBody.data).toEqual({ deleted_rows: 3, blocked_rows: 0 })
    expect(listAfterDeleteBody.data.items).toEqual([])
  })

  test('filters management lists by time range', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const salesResponse = await handler(
      new Request('http://api.local/api/v1/sales-documents?from=2999-01-01&to=2999-01-31&page=1&page_size=15', { headers: { authorization } }),
    )
    const cashbookResponse = await handler(
      new Request('http://api.local/api/v1/finance/cashbook?from=2999-01-01&to=2999-01-31&page=1&page_size=15', { headers: { authorization } }),
    )
    const customersResponse = await handler(
      new Request('http://api.local/api/v1/customers?created_from=2999-01-01&created_to=2999-01-31&page=1&page_size=15', { headers: { authorization } }),
    )
    const receiptsResponse = await handler(
      new Request('http://api.local/api/v1/purchase/receipts?date_from=2999-01-01&date_to=2999-01-31&page=1&page_size=15', { headers: { authorization } }),
    )
    const salesBody = await salesResponse.json()
    const cashbookBody = await cashbookResponse.json()
    const customersBody = await customersResponse.json()
    const receiptsBody = await receiptsResponse.json()

    expect(salesResponse.status).toBe(200)
    expect(cashbookResponse.status).toBe(200)
    expect(customersResponse.status).toBe(200)
    expect(receiptsResponse.status).toBe(200)
    expect(salesBody.data.total).toBe(0)
    expect(cashbookBody.data.total).toBe(0)
    expect(customersBody.data.total).toBe(0)
    expect(receiptsBody.data.total).toBe(0)
  })

  test('returns empty demo customer debt detail when customer has no debt invoice', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/finance/customers/customer-008/debt', { headers: { authorization } }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.customer_id).toBe('customer-008')
    expect(body.data.total_debt).toBe(0)
    expect(body.data.invoices).toHaveLength(0)
  })

  test('keeps all demo customer debt summaries aligned with invoice history', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const customersResponse = await handler(
      new Request('http://api.local/api/v1/customers?page=1&page_size=100', { headers: { authorization } }),
    )
    const customersBody = await customersResponse.json()

    for (const customer of customersBody.data.items) {
      const debtResponse = await handler(
        new Request(`http://api.local/api/v1/finance/customers/${customer.id}/debt`, { headers: { authorization } }),
      )
      const historyResponse = await handler(
        new Request(`http://api.local/api/v1/sales-documents?customer_id=${customer.id}&type=invoice&page=1&page_size=100`, { headers: { authorization } }),
      )
      const debtBody = await debtResponse.json()
      const historyBody = await historyResponse.json()
      const historyDebt = historyBody.data.items
        .filter((item: { debt_amount: number }) => item.debt_amount > 0)
        .reduce((sum: number, item: { debt_amount: number }) => sum + item.debt_amount, 0)
      const historySales = historyBody.data.items
        .filter((item: { status: string }) => item.status !== 'cancelled')
        .reduce((sum: number, item: { total_amount: number }) => sum + item.total_amount, 0)

      expect(customer.total_sales_amount, customer.code).toBe(historySales)
      expect(customer.total_debt_amount, customer.code).toBe(historyDebt)
      expect(debtBody.data.total_debt, customer.code).toBe(historyDebt)
      expect(
        debtBody.data.invoices.reduce((sum: number, item: { remaining_debt: number }) => sum + item.remaining_debt, 0),
        customer.code,
      ).toBe(historyDebt)
    }
  })

  test('keeps demo supplier summaries aligned with purchase receipts', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const suppliersResponse = await handler(
      new Request('http://api.local/api/v1/suppliers?page=1&page_size=100', { headers: { authorization } }),
    )
    const receiptsResponse = await handler(
      new Request('http://api.local/api/v1/purchase/receipts?page=1&page_size=100', { headers: { authorization } }),
    )
    const suppliersBody = await suppliersResponse.json()
    const receiptsBody = await receiptsResponse.json()

    for (const supplier of suppliersBody.data.items) {
      const supplierReceipts = receiptsBody.data.items.filter((receipt: { supplier: { id: string }; status: string }) => (
        receipt.supplier.id === supplier.id && receipt.status !== 'cancelled'
      ))
      const totalPurchase = supplierReceipts.reduce((sum: number, receipt: { payable_amount: number }) => sum + receipt.payable_amount, 0)
      const totalPayable = supplierReceipts.reduce((sum: number, receipt: { remaining_amount: number }) => sum + receipt.remaining_amount, 0)

      expect(supplier.total_purchase_amount, supplier.code).toBe(totalPurchase)
      expect(supplier.current_payable_amount, supplier.code).toBe(totalPayable)
    }
  })

  test('persists checkout into demo sales documents and cashbook', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-002',
          items: [{ product_id: 'product-001', quantity: 2, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 1200000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code

    const documents = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${orderCode}&page=1&page_size=10`, {
        headers: { authorization },
      }),
    )
    const cashbook = await handler(
      new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=15', {
        headers: { authorization },
      }),
    )
    const customerResponse = await handler(
      new Request('http://api.local/api/v1/customers?search=DEV20-KH-002&page=1&page_size=10', {
        headers: { authorization },
      }),
    )
    const documentBody = await documents.json()
    const cashbookBody = await cashbook.json()
    const customerBody = await customerResponse.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.total_amount).toBe(1200000)
    expect(documentBody.data.items[0].code).toBe(orderCode)
    expect(cashbookBody.data.items[0].note).toContain(orderCode)
    expect(cashbookBody.data.items[0].amount_delta).toBe(1200000)
    expect(customerBody.data.items[0].total_sales_amount).toBe(4000000)
  })

  test('uses repository cashbook page response instead of loading the full list', async () => {
    const listCashbookEntriesPage = vi.fn(async () => ({
      items: [],
      total: 0,
      summary: {
        opening_balance: 0,
        total_in: 0,
        total_out: 0,
        ending_balance: 0,
      },
    }))
    const listCashbookEntries = vi.fn(async () => [])
    const handler = createHttpHandler({
      repository: {
        ...repository(await hashPassword('ChangeMe123!')),
        listCashbookEntriesPage,
        listCashbookEntries,
      },
    })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/finance/cashbook?finance_account_type=bank&page=3&page_size=20', {
        headers: { authorization },
      }),
    )
    const body = await response.json()
    const routedUrl = listCashbookEntriesPage.mock.calls[0]?.[0].url

    expect(response.status).toBe(200)
    expect(body.data).toEqual({
      items: [],
      total: 0,
      summary: {
        opening_balance: 0,
        total_in: 0,
        total_out: 0,
        ending_balance: 0,
      },
      page: 3,
      page_size: 20,
    })
    expect(routedUrl?.searchParams.get('exclude_replaced_deleted_accounts')).toBe('true')
    expect(listCashbookEntries).not.toHaveBeenCalled()
  })

  test('revises a completed invoice by creating .01 and cancelling the old invoice', async () => {
    const repository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-retail',
          created_at: '2026-07-18T04:10:00.000Z',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 100000, discount_amount: 0, price_source: 'manual' }],
          payment: { cash_amount: 100000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const originalOrderId = checkoutBody.data.order.id

    const revise = await handler(
      new Request(`http://api.local/api/v1/orders/${originalOrderId}/revise`, {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-retail',
          created_at: '2026-07-18T04:51:00.000Z',
          note: 'Sua gia',
          revision_reason_code: 'wrong_price',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 120000, discount_amount: 0, price_source: 'manual' }],
          payment: { cash_amount: 120000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const reviseBody = await revise.json()

    const originalResponse = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${originalOrderId}`, {
        headers: { authorization },
      }),
    )
    const originalBody = await originalResponse.json()

    expect(revise.status).toBe(201)
    expect(reviseBody.data.order).toMatchObject({
      code: `${checkoutBody.data.order.code}.01`,
      order_type: 'invoice',
      status: 'completed',
      total_amount: 120000,
      paid_amount: 120000,
      debt_amount: 0,
      payment_status: 'paid',
      revision_no: 1,
      base_code: checkoutBody.data.order.code,
      revised_from_order_id: originalOrderId,
    })
    expect(originalBody.data).toMatchObject({
      id: originalOrderId,
      code: checkoutBody.data.order.code,
      status: 'cancelled',
      cancel_reason_type: 'revised',
      replaced_by_order_id: reviseBody.data.order.id,
    })
  })

  test('rejects invoice revision without a reason code', async () => {
    const repository = await createDevMemoryRepository()
    const handler = createHttpHandler({ repository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/orders/order-001/revise', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-retail',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 120000, discount_amount: 0, price_source: 'manual' }],
          payment: { cash_amount: 120000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields.revision_reason_code).toEqual(['revision_reason_code is required.'])
  })

  test('validates POS cart product existence and measurement fields before checkout', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/pos/cart/validate', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [
            { client_line_id: 'missing-product', product_id: 'product-missing', sell_method: 'quantity', quantity: 1, unit_price: 100000, price_source: 'manual' },
            { client_line_id: 'bad-area', product_id: 'product-002', sell_method: 'area_m2', quantity: 1, width_m: 1.2, unit_price: 120000, price_source: 'manual' },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.valid).toBe(false)
    expect(body.data.errors).toEqual([
      { client_line_id: 'missing-product', product_id: 'product-missing', field: 'product_id', code: 'PRODUCT_MISSING', message: 'Product does not exist or is inactive.' },
      { client_line_id: 'bad-area', product_id: 'product-002', field: 'height_m', code: 'MEASUREMENT_REQUIRED', message: 'height_m must be greater than 0 for area_m2.' },
    ])
  })

  test('normalizes valid POS cart totals including manual linear pricing', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/pos/cart/validate', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: null,
          items: [
            { client_line_id: 'sheet-line', product_id: 'product-001', sell_method: 'sheet', quantity: 2, unit_price: 600000, price_source: 'default_price_list' },
            { client_line_id: 'linear-line', product_id: 'product-002', sell_method: 'linear_m', quantity: 1, linear_m: 1.5, unit_price: 120000, price_source: 'manual' },
          ],
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      valid: true,
      subtotal_amount: 1380000,
      total_amount: 1380000,
      items: [
        { client_line_id: 'sheet-line', product_id: 'product-001', quantity: 2, unit_price: 600000, line_total: 1200000, price_source: 'default_price_list' },
        { client_line_id: 'linear-line', product_id: 'product-002', quantity: 1, linear_m: 1.5, unit_price: 120000, line_total: 180000, price_source: 'manual' },
      ],
    })
  })

  test('creates POS invoice code with KiotViet-style HD sequence', async () => {
    const repo = persistentRepository(await hashPassword('ChangeMe123!'))
    const handler = createHttpHandler({ repository: repo })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await repo.saveSalesDocument?.({
      organizationId: 'org-1',
      document: {
        id: 'order-hd-011149',
        code: 'HD011149',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-15T09:00:00.000Z',
        customer: { id: 'customer-001', code: 'KH000001', name: 'Khach cu', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 100000,
        discount_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{ product_id: 'product-001' }],
      },
      cashbookEntries: [],
    })

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-002',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.code).toBe('HD011150')
    expect(checkoutBody.data.order.code).not.toContain('HD-POS')
    expect(checkoutBody.data.payment_receipt.code).toBe('TTHD011150')
    expect(checkoutBody.data.payment_receipt.code).not.toContain('PT-POS')
  })

  test('stores POS checkout cashbook creator from the current display name', async () => {
    const repo = persistentRepository(await hashPassword('ChangeMe123!'), 'Thu ngân QCVL')
    const handler = createHttpHandler({ repository: repo })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-002',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const cashbook = await handler(
      new Request(`http://api.local/api/v1/finance/cashbook?search=${checkoutBody.data.payment_receipt.code}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const cashbookBody = await cashbook.json()

    expect(checkout.status).toBe(201)
    expect(cashbookBody.data.items[0].code).toBe(checkoutBody.data.payment_receipt.code)
    expect(cashbookBody.data.items[0].created_by).toEqual({ id: 'user-1', name: 'Thu ngân QCVL' })
  })

  test('returns the checked-out product in POS sales document detail', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-002',
          items: [{ product_id: 'product-002', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()

    const detail = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${checkoutBody.data.order.code}`, {
        headers: { authorization },
      }),
    )
    const detailBody = await detail.json()

    expect(detail.status).toBe(200)
    expect(detailBody.data.items[0].product.id).toBe('product-002')
    expect(detailBody.data.items[0].product.code).toBe('DECAL-PP')
    expect(detailBody.data.items[0].unit_price).toBe(600000)
  })

  test('preserves repository payment history in POS sales document detail', async () => {
    const baseRepository = repository(await hashPassword('ChangeMe123!'))
    const testRepository: ServerRepository = {
      ...baseRepository,
      getSalesDocument: vi.fn(async () => ({
        id: 'order-payment-history',
        code: 'HD011137',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-10T09:00:00.000Z',
        customer: { id: 'customer-kl4', code: 'KH-KL4', name: 'kl4', phone: null },
        seller: { id: 'seller-kv', name: 'KiotViet' },
        subtotal_amount: 3000000,
        discount_amount: 0,
        total_amount: 3000000,
        paid_amount: 1000000,
        debt_amount: 2000000,
        payment_status: 'partial',
        note: null,
        items: [{ product_id: 'product-001' }],
        payment_receipts: [{
          id: 'cashbook-tthd-011137',
          code: 'TTHD011137',
          status: 'posted',
          receipt_type: 'sale_payment',
          total_received_amount: 1000000,
          created_at: '2026-07-10T09:01:00.000Z',
          created_by: { id: 'seller-kv', name: 'KiotViet' },
          methods: [{
            method_type: 'bank_transfer',
            amount: 1000000,
            finance_account: { id: 'bank-kv-0947900909', code: '0947900909', name: 'MBBank' },
          }],
          allocations: [{
            order_id: 'order-payment-history',
            order_code: 'HD011137',
            allocated_amount: 1000000,
            remaining_after: 2000000,
          }],
        }],
      })),
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const detail = await handler(
      new Request('http://api.local/api/v1/sales-documents/order-payment-history', {
        headers: { authorization },
      }),
    )
    const detailBody = await detail.json()

    expect(detail.status).toBe(200)
    expect(detailBody.data.payment_receipts.map((receipt: { code: string }) => receipt.code)).toEqual(['TTHD011137'])
  })

  test('updates a POS sales document note and returns refreshed detail', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-002',
          items: [{ product_id: 'product-002', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
          note: 'Ghi chú cũ',
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const receiptCode = checkoutBody.data.payment_receipt.code

    const update = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${checkoutBody.data.order.id}`, {
        method: 'PATCH',
        headers: { authorization },
        body: JSON.stringify({ note: 'Ghi chú mới', created_at: '2026-07-18T04:15:00.000Z' }),
      }),
    )
    const detail = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${checkoutBody.data.order.id}`, {
        headers: { authorization },
      }),
    )
    const cashbook = await handler(
      new Request(`http://api.local/api/v1/finance/cashbook?search=${receiptCode}&page=1&page_size=10`, {
        headers: { authorization },
      }),
    )
    const updateBody = await update.json()
    const detailBody = await detail.json()
    const cashbookBody = await cashbook.json()
    const linkedCashbook = cashbookBody.data.items.find((item: { code: string; created_at: string }) => item.code === receiptCode)

    expect(update.status).toBe(200)
    expect(updateBody.data.note).toBe('Ghi chú mới')
    expect(detailBody.data.note).toBe('Ghi chú mới')
    expect(detailBody.data.created_at).toBe('2026-07-18T04:15:00.000Z')
    expect(linkedCashbook?.created_at).toBe('2026-07-18T04:15:00.000Z')
  })

  test('hydrates POS sales document detail products from repository catalog for imported products', async () => {
    const baseRepository = persistentRepository(await hashPassword('ChangeMe123!'))
    const testRepository: ServerRepository = {
      ...baseRepository,
      listProducts: vi.fn(async () => [{
        id: 'product-import-ib',
        code: 'IB',
        name: 'In bạt',
        status: 'active',
        product_kind: 'combo',
        unit_name: 'm2',
        sell_method: 'combo',
        latest_purchase_cost: null,
        latest_purchase_cost_at: null,
        default_sale_price: 600000,
        product_group_id: null,
        product_group: null,
        inventory_shape: 'normal',
        track_inventory: false,
        unit_conversions: [],
      }]),
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-import-ib', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()

    const detail = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${checkoutBody.data.order.id}`, {
        headers: { authorization },
      }),
    )
    const detailBody = await detail.json()

    expect(detail.status).toBe(200)
    expect(detailBody.data.items[0].product).toMatchObject({
      id: 'product-import-ib',
      code: 'IB',
      name: 'In bạt',
      unit_name: 'm2',
      sell_method: 'combo',
    })
  })

  test('subtracts operating stock when POS checkout saves an invoice', async () => {
    const repo = await createDevMemoryRepository()
    await repo.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        code: 'POS-STOCK-LIVE',
        name: 'POS stock live',
        status: 'active',
        product_group_id: null,
        unit_name: 'Cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 10000,
        unit_conversions: [],
        source_created_at: null,
        source: {
          rowNumber: 2,
          code: 'POS-STOCK-LIVE',
          name: 'POS stock live',
          product_group_name: 'Vat lieu',
          product_kind: 'goods',
          inventory_shape: 'normal',
          sell_method: 'quantity',
          track_inventory: true,
          unit_name: 'Cai',
          unit_name_needs_review: false,
          latest_purchase_cost: 10000,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          expected_out_of_stock_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      }],
    })
    await repo.upsertImportedKiotVietStocktakes?.({
      organizationId: 'org-dev-memory',
      createdBy: null,
      rows: [{
        rowNumber: 2,
        source_code: 'XNT-POS-LIVE',
        source_created_at: '2026-07-12T16:00:00.000Z',
        source_creator_name: 'KiotViet XNT',
        source_balanced_at: '2026-07-12T16:00:00.000Z',
        status: 'balanced',
        product_code: 'POS-STOCK-LIVE',
        product_name: 'POS stock live',
        unit_name: 'Cai',
        system_qty: null,
        actual_qty: 10,
        difference_qty: null,
        increased_qty: null,
        decreased_qty: null,
        total_actual_value: null,
        total_difference_value: null,
        line_difference_value: null,
        note: 'Checkpoint',
        is_deleted_product_code: false,
        formula_valid: true,
      }],
    })
    const handler = createHttpHandler({ repository: repo })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-pos-stock-live', quantity: 2, unit_price: 50000, discount_amount: 0, price_source: 'manual' }],
          payment: { cash_amount: 100000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const productsResponse = await handler(
      new Request('http://api.local/api/v1/products?search=POS-STOCK-LIVE&status=all&page=1&page_size=10', { headers: { authorization } }),
    )
    const productsBody = await productsResponse.json()

    expect(productsBody.data.items[0].operating_stock.quantity).toBe(8)
  })

  test('cancels a POS invoice and restores operating stock', async () => {
    const repo = await createDevMemoryRepository()
    await repo.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        code: 'POS-CANCEL',
        name: 'POS cancel product',
        status: 'active',
        product_group_id: null,
        unit_name: 'Cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 10000,
        unit_conversions: [],
        source_created_at: null,
        source: {
          rowNumber: 2,
          code: 'POS-CANCEL',
          name: 'POS cancel product',
          product_group_name: 'Vat lieu',
          product_kind: 'goods',
          inventory_shape: 'normal',
          sell_method: 'quantity',
          track_inventory: true,
          unit_name: 'Cai',
          unit_name_needs_review: false,
          latest_purchase_cost: 10000,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          expected_out_of_stock_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      }],
    })
    await repo.upsertImportedKiotVietStocktakes?.({
      organizationId: 'org-dev-memory',
      createdBy: null,
      rows: [{
        rowNumber: 2,
        source_code: 'XNT-POS-CANCEL',
        source_created_at: '2026-07-12T16:00:00.000Z',
        source_creator_name: 'KiotViet XNT',
        source_balanced_at: '2026-07-12T16:00:00.000Z',
        status: 'balanced',
        product_code: 'POS-CANCEL',
        product_name: 'POS cancel product',
        unit_name: 'Cai',
        system_qty: null,
        actual_qty: 10,
        difference_qty: null,
        increased_qty: null,
        decreased_qty: null,
        total_actual_value: null,
        total_difference_value: null,
        line_difference_value: null,
        note: 'Checkpoint',
        is_deleted_product_code: false,
        formula_valid: true,
      }],
    })
    const handler = createHttpHandler({ repository: repo })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: 'admin', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`
    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-pos-cancel', quantity: 2, unit_price: 50000, discount_amount: 0, price_source: 'manual' }],
          payment: { cash_amount: 100000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()

    const cancel = await handler(
      new Request(`http://api.local/api/v1/sales-documents/${checkoutBody.data.order.id}`, {
        method: 'PATCH',
        headers: { authorization },
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    )
    const productsResponse = await handler(
      new Request('http://api.local/api/v1/products?search=POS-CANCEL&status=all&page=1&page_size=10', { headers: { authorization } }),
    )
    const cancelBody = await cancel.json()
    const productsBody = await productsResponse.json()

    expect(cancel.status).toBe(200)
    expect(cancelBody.data.status).toBe('cancelled')
    expect(productsBody.data.items[0].operating_stock.quantity).toBe(10)
  })

  test('maps blank POS customer to khachle for checkout and quote documents', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const quote = await handler(
      new Request('http://api.local/api/v1/orders/quotes', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 0, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const quoteBody = await quote.json()
    const checkoutCode = checkoutBody.data.order.code
    const quoteCode = quoteBody.data.code

    const checkoutDocument = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${checkoutCode}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const quoteDocument = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${quoteCode}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const checkoutDocumentBody = await checkoutDocument.json()
    const quoteDocumentBody = await quoteDocument.json()

    expect(checkout.status).toBe(201)
    expect(quote.status).toBe(201)
    expect(checkoutDocumentBody.data.items[0].customer.code).toBe('khachle')
    expect(quoteDocumentBody.data.items[0].customer.code).toBe('khachle')
  })

  test('maps blank POS customer to the repository khachle record when it exists', async () => {
    const testRepository = await createDevMemoryRepository()
    await testRepository.upsertCustomersByCode?.({
      organizationId: 'org-1',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le repository',
        customer_type: 'individual',
        company_name: null,
        phone: null,
        tax_code: null,
        address: null,
        area_name: null,
        ward_name: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        status: 'active',
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
      }],
    })
    const handler = createHttpHandler({ repository: testRepository })
    const authorization = 'Bearer dev-token'

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const documentResponse = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${checkoutBody.data.order.code}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const documentBody = await documentResponse.json()

    expect(checkout.status).toBe(201)
    expect(documentBody.data.items[0].customer).toEqual(expect.objectContaining({
      id: 'customer-kv-khachle',
      code: 'khachle',
      name: 'Khach le repository',
    }))
  })

  test('opens cashbook detail from persisted checkout entry instead of fixture invoice', async () => {
    const handler = createHttpHandler({ repository: persistentRepository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-009',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 100000, bank_amount: 200000, bank_account_id: 'bank-main', old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code

    const cashbook = await handler(
      new Request(`http://api.local/api/v1/finance/cashbook?search=${orderCode}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const cashbookBody = await cashbook.json()
    const entryId = cashbookBody.data.items[0].id

    const detail = await handler(
      new Request(`http://api.local/api/v1/finance/cashbook/${entryId}`, { headers: { authorization } }),
    )
    const detailBody = await detail.json()

    expect(detail.status).toBe(200)
    expect(detailBody.data.id).toBe(entryId)
    expect(detailBody.data.source.order_code).toBe(orderCode)
    expect(detailBody.data.source.order_code).not.toBe('HD0001')
    expect(detailBody.data.allocations[0].order_code).toBe(orderCode)
  })

  test('hydrates imported invoice cashbook payer from inferred sales document code', async () => {
    const repo = persistentRepository(await hashPassword('ChangeMe123!'))
    const handler = createHttpHandler({ repository: repo })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await repo.saveSalesDocument?.({
      organizationId: 'org-1',
      document: {
        id: 'order-hd-999999',
        code: 'HD999999',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T09:22:00.000Z',
        customer: { id: 'customer-hd-999999', code: 'KH999999', name: 'Khách từ hóa đơn', phone: '0909999999' },
        seller: { id: 'seller-1', name: 'Seller 1' },
        subtotal_amount: 220000,
        discount_amount: 0,
        total_amount: 220000,
        paid_amount: 220000,
        debt_amount: 0,
        payment_status: 'paid',
        note: 'Invoice imported before cashbook',
        items: [{ product_id: 'product-001' }],
      },
      cashbookEntries: [
        {
          id: 'cashbook-tthd-999999',
          code: 'TTHD999999',
          status: 'posted',
          direction: 'in',
          amount_delta: 220000,
          finance_account: { id: 'bank-main', code: '0947900909', name: 'Văn Viết Phương Lâm', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T09:22:00.000Z',
          note: 'Phiếu thu Tiền khách trả',
          counterparty: { type: 'none', name: '', phone: null },
        },
      ],
    })

    const detail = await handler(
      new Request('http://api.local/api/v1/finance/cashbook/cashbook-tthd-999999', { headers: { authorization } }),
    )
    const detailBody = await detail.json()

    expect(detail.status).toBe(200)
    expect(detailBody.data.source.order_code).toBe('HD999999')
    expect(detailBody.data.counterparty).toEqual({
      type: 'customer',
      name: 'Khách từ hóa đơn',
      phone: '0909999999',
    })
  })

  test('does not fallback to a demo invoice when sales document code is missing', async () => {
    const handler = createHttpHandler({ repository: persistentRepository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(
      new Request('http://api.local/api/v1/sales-documents/HD011149', { headers: { authorization } }),
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.data.code).not.toBe('DEV20-HD-001')
  })

  test('adds fully unpaid POS checkout to customer debt detail', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const beforeDebt = await handler(
      new Request('http://api.local/api/v1/finance/customers/customer-008/debt', { headers: { authorization } }),
    )
    const beforeDebtBody = await beforeDebt.json()

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-008',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 0, bank_amount: 0, bank_account_id: null, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code

    const afterDebt = await handler(
      new Request('http://api.local/api/v1/finance/customers/customer-008/debt', { headers: { authorization } }),
    )
    const afterDebtBody = await afterDebt.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.paid_amount).toBe(0)
    expect(checkoutBody.data.order.debt_amount).toBe(600000)
    expect(checkoutBody.data.order.payment_status).toBe('unpaid')
    expect(afterDebtBody.data.total_debt).toBe(beforeDebtBody.data.total_debt + 600000)
    expect(afterDebtBody.data.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          order_code: orderCode,
          remaining_debt: 600000,
        }),
      ]),
    )
  })

  test('uses actual post time for new checkout invoice instead of demo fixture time', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`
    const before = Date.now()

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-011',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code
    const documents = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${orderCode}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const documentsBody = await documents.json()
    const createdAt = documentsBody.data.items[0].created_at
    const createdTime = new Date(createdAt).getTime()

    expect(checkout.status).toBe(201)
    expect(createdAt).not.toBe('2026-07-08T08:30:00.000Z')
    expect(createdTime).toBeGreaterThanOrEqual(before - 1000)
    expect(createdTime).toBeLessThanOrEqual(Date.now() + 1000)
  })

  test('uses checkout payload created_at for new invoice time', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-011',
          created_at: '2026-07-08T08:15:00.000Z',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code
    const documents = await handler(
      new Request(`http://api.local/api/v1/sales-documents?search=${orderCode}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const documentsBody = await documents.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.created_at).toBe('2026-07-08T08:15:00.000Z')
    expect(documentsBody.data.items[0].created_at).toBe('2026-07-08T08:15:00.000Z')
  })

  test('moves customer with newest bill to top of default customer list', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    await handler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-018',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 600000, bank_amount: 0, old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )

    const customersResponse = await handler(
      new Request('http://api.local/api/v1/customers?page=1&page_size=10', { headers: { authorization } }),
    )
    const customersBody = await customersResponse.json()

    expect(customersBody.data.items[0]).toEqual(expect.objectContaining({
      id: 'customer-018',
      code: 'DEV20-KH-018',
    }))
  })

  test('keeps customer 11 partial bank checkout after server restart', async () => {
    const passwordHash = await hashPassword('ChangeMe123!')
    const sharedRepository = persistentRepository(passwordHash)
    const firstModule = await import('./http')
    const firstHandler = firstModule.createHttpHandler({ repository: sharedRepository })
    const login = await firstHandler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await firstHandler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-011',
          note: 'Persistent customer 11 invoice',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 0, bank_amount: 300000, bank_account_id: 'bank-main', old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code

    vi.resetModules()
    const restartedModule = await import('./http')
    const restartedHandler = restartedModule.createHttpHandler({ repository: sharedRepository })
    const documents = await restartedHandler(
      new Request(`http://api.local/api/v1/sales-documents?search=${orderCode}&customer_id=customer-011&type=invoice&page=1&page_size=20`, { headers: { authorization } }),
    )
    const debt = await restartedHandler(
      new Request('http://api.local/api/v1/finance/customers/customer-011/debt', { headers: { authorization } }),
    )
    const documentsBody = await documents.json()
    const debtBody = await debt.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.debt_amount).toBe(300000)
    expect(documentsBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: orderCode,
        customer: expect.objectContaining({ id: 'customer-011' }),
        paid_amount: 300000,
        debt_amount: 300000,
        payment_status: 'partial',
      }),
    ]))
    expect(debtBody.data.total_debt).toBeGreaterThanOrEqual(300000)
    expect(debtBody.data.invoices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        order_code: orderCode,
        paid_amount: 300000,
        debt_amount: 300000,
        remaining_debt: 300000,
      }),
    ]))
  })

  test('keeps customer 11 bank debt collection after server restart', async () => {
    const passwordHash = await hashPassword('ChangeMe123!')
    const sharedRepository = persistentRepository(passwordHash)
    const firstModule = await import('./http')
    const firstHandler = firstModule.createHttpHandler({ repository: sharedRepository })
    const login = await firstHandler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const checkout = await firstHandler(
      new Request('http://api.local/api/v1/orders/checkout', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-011',
          note: 'Persistent customer 11 debt collection',
          items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
          payment: { cash_amount: 0, bank_amount: 300000, bank_account_id: 'bank-main', old_debt_payment_amount: 0, change_returned_amount: 0 },
        }),
      }),
    )
    const checkoutBody = await checkout.json()
    const orderCode = checkoutBody.data.order.code

    const collection = await firstHandler(
      new Request('http://api.local/api/v1/finance/debt-collections', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-011',
          amount: 100000,
          payment_method: { cash_amount: 0, bank_amount: 100000, bank_account_id: 'bank-main', bank_transaction_ref: 'VCB-KH011' },
          note: 'Thu no KH011',
        }),
      }),
    )
    const collectionBody = await collection.json()

    vi.resetModules()
    const restartedModule = await import('./http')
    const restartedHandler = restartedModule.createHttpHandler({ repository: sharedRepository })
    const debt = await restartedHandler(
      new Request('http://api.local/api/v1/finance/customers/customer-011/debt', { headers: { authorization } }),
    )
    const cashbook = await restartedHandler(
      new Request(`http://api.local/api/v1/finance/cashbook?search=${collectionBody.data.payment_receipt_id}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const customerList = await restartedHandler(
      new Request('http://api.local/api/v1/customers?search=DEV20-KH-011&page=1&page_size=10', { headers: { authorization } }),
    )
    const debtBody = await debt.json()
    const cashbookBody = await cashbook.json()
    const customerListBody = await customerList.json()

    expect(collection.status).toBe(201)
    expect(collectionBody.data.payment_receipt_id).toMatch(/^TT\d{6}$/)
    expect(collectionBody.data.allocated_amount).toBe(100000)
    expect(debtBody.data.total_debt).toBe(200000)
    expect(debtBody.data.invoices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        order_code: orderCode,
        paid_amount: 400000,
        debt_amount: 200000,
        remaining_debt: 200000,
      }),
    ]))
    expect(cashbookBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        amount_delta: 100000,
        note: expect.stringContaining('VCB-KH011'),
      }),
    ]))
    expect(customerListBody.data.items[0]).toEqual(expect.objectContaining({
      total_sales_amount: 600000,
      total_debt_amount: 200000,
    }))
  })

  test('uses repository as sales finance source of truth when repository supports it', async () => {
    const sharedRepository = persistentRepository(await hashPassword('ChangeMe123!'))
    const handler = createHttpHandler({ repository: sharedRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const documents = await handler(
      new Request('http://api.local/api/v1/sales-documents?page=1&page_size=100', { headers: { authorization } }),
    )
    const debts = await handler(
      new Request('http://api.local/api/v1/finance/customer-debts?page=1&page_size=100', { headers: { authorization } }),
    )
    const cashbook = await handler(
      new Request('http://api.local/api/v1/finance/cashbook?page=1&page_size=100', { headers: { authorization } }),
    )
    const documentsBody = await documents.json()
    const debtsBody = await debts.json()
    const cashbookBody = await cashbook.json()

    expect(documentsBody.data.items).toEqual([])
    expect(debtsBody.data.items).toEqual([])
    expect(cashbookBody.data.items).toEqual([])
  })

  test('allocates partial bank debt collection to customer invoice debt and cashbook', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const collection = await handler(
      new Request('http://api.local/api/v1/finance/debt-collections', {
        method: 'POST',
        headers: { authorization },
        body: JSON.stringify({
          customer_id: 'customer-003',
          amount: 300000,
          payment_method: {
            cash_amount: 0,
            bank_amount: 300000,
            bank_account_id: 'bank-main',
            bank_transaction_ref: 'VCB-001',
          },
          note: 'Thu no ngan hang mot phan',
        }),
      }),
    )
    const collectionBody = await collection.json()

    const debt = await handler(
      new Request('http://api.local/api/v1/finance/customers/customer-003/debt', { headers: { authorization } }),
    )
    const documents = await handler(
      new Request('http://api.local/api/v1/sales-documents?customer_id=customer-003&type=invoice&page=1&page_size=20', { headers: { authorization } }),
    )
    const cashbook = await handler(
      new Request(`http://api.local/api/v1/finance/cashbook?search=${collectionBody.data.payment_receipt_id}&page=1&page_size=10`, { headers: { authorization } }),
    )
    const debtBody = await debt.json()
    const documentBody = await documents.json()
    const cashbookBody = await cashbook.json()
    const updatedInvoice = documentBody.data.items.find((item: { code: string }) => item.code === 'DEV20-HD-013')

    expect(collection.status).toBe(201)
    expect(collectionBody.data.payment_receipt_id).toMatch(/^TT\d{6}$/)
    expect(collectionBody.data.allocated_amount).toBe(300000)
    expect(debtBody.data.total_debt).toBe(437500)
    expect(debtBody.data.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          order_code: 'DEV20-HD-013',
          paid_amount: 1037500,
          debt_amount: 437500,
          remaining_debt: 437500,
        }),
      ]),
    )
    expect(updatedInvoice).toEqual(expect.objectContaining({
      paid_amount: 1037500,
      debt_amount: 437500,
      payment_status: 'partial',
    }))
    expect(cashbookBody.data.items[0]).toEqual(expect.objectContaining({
      amount_delta: 300000,
      note: expect.stringContaining('DEV20-HD-013'),
    }))
    expect(cashbookBody.data.items[0].finance_account).toEqual(expect.objectContaining({
      id: 'bank-main',
      account_type: 'bank',
    }))
  })

  test('deletes demo customer rows when clearing old KiotViet import data', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const before = await handler(
      new Request('http://api.local/api/v1/customers?search=DEV20-KH-002&page=1&page_size=10', { headers: { authorization } }),
    )
    const beforeBody = await before.json()

    const cleanup = await handler(
      new Request('http://api.local/api/v1/customers/import/kiotviet', {
        method: 'DELETE',
        headers: { authorization },
      }),
    )
    const cleanupBody = await cleanup.json()

    const afterDemo = await handler(
      new Request('http://api.local/api/v1/customers?search=DEV20-KH-002&page=1&page_size=10', { headers: { authorization } }),
    )
    const afterDefault = await handler(
      new Request('http://api.local/api/v1/customers?search=khachle&page=1&page_size=10', { headers: { authorization } }),
    )
    const afterDemoBody = await afterDemo.json()
    const afterDefaultBody = await afterDefault.json()

    expect(beforeBody.data.items[0]).toEqual(expect.objectContaining({ code: 'DEV20-KH-002' }))
    expect(cleanup.status).toBe(200)
    expect(cleanupBody.data.deleted_rows).toBeGreaterThanOrEqual(19)
    expect(afterDemoBody.data.items).toEqual([])
    expect(afterDefaultBody.data.items[0]).toEqual(expect.objectContaining({ code: 'khachle' }))
  })

  test('uses paged product repository for product list instead of loading the full catalog twice', async () => {
    const baseRepository = repository(await hashPassword('ChangeMe123!'))
    const listProducts = vi.fn(async () => [])
    const listProductsPage = vi.fn(async () => ({
      items: [{
        id: 'product-fast-1',
        code: 'FAST-1',
        name: 'Fast product',
        status: 'active',
        product_kind: 'goods',
        unit_name: 'pcs',
        sell_method: 'quantity',
        latest_purchase_cost: null,
        latest_purchase_cost_at: null,
        default_sale_price: 1000,
        price_list_prices: {},
        product_group_id: null,
        product_group: null,
        inventory_shape: 'normal',
        track_inventory: true,
        unit_conversions: [],
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      }],
      total: 51,
      total_all: 51,
    }))
    const testRepository = { ...baseRepository, listProducts, listProductsPage }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(new Request('http://api.local/api/v1/products?status=active&page=1&page_size=15', { headers: { authorization } }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(listProductsPage).toHaveBeenCalledTimes(1)
    expect(listProducts).not.toHaveBeenCalled()
    expect(body.data.items.map((item: { code: string }) => item.code)).toEqual(['FAST-1'])
    expect(body.data.total).toBe(51)
    expect(body.data.total_all).toBe(51)
  })

  test('uses paged stocktake repository with creator options instead of loading all stocktakes twice', async () => {
    const baseRepository = repository(await hashPassword('ChangeMe123!'))
    const listStocktakes = vi.fn(async () => [])
    const listStocktakesPage = vi.fn(async () => ({
      items: [{
        id: 'stocktake-fast-1',
        code: 'KK-FAST-1',
        status: 'balanced',
        source_type: 'kiotviet_import',
        created_at: '2026-07-01T00:00:00.000Z',
        balanced_at: null,
        source_creator_name: null,
        created_by: { id: 'user-1', name: 'Admin' },
        total_actual_qty: 1,
        total_actual_value: null,
        total_difference_value: null,
        increased_qty: 0,
        decreased_qty: 0,
        product_code: 'FAST-1',
        product_name: 'Fast product',
        product_system_qty: 1,
        product_actual_qty: 1,
        product_difference_qty: 0,
        note: null,
      }],
      total: 42,
      creator_options: [{ id: 'user-1', name: 'Admin' }],
    }))
    const testRepository = { ...baseRepository, listStocktakes, listStocktakesPage }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(new Request('http://api.local/api/v1/inventory/stocktakes?status=balanced&page=1&page_size=15', { headers: { authorization } }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(listStocktakesPage).toHaveBeenCalledTimes(1)
    expect(listStocktakes).not.toHaveBeenCalled()
    expect(body.data.items.map((item: { code: string }) => item.code)).toEqual(['KK-FAST-1'])
    expect(body.data.total).toBe(42)
    expect(body.data.creator_options).toEqual([{ id: 'user-1', name: 'Admin' }])
  })

  test('hydrates sales document detail from item snapshots without loading the full product catalog', async () => {
    const baseRepository = repository(await hashPassword('ChangeMe123!'))
    const listProducts = vi.fn(async () => [])
    const testRepository: ServerRepository = {
      ...baseRepository,
      listProducts,
      getSalesDocument: vi.fn(async () => ({
        id: 'order-snapshot-1',
        code: 'HD-SNAPSHOT-1',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-01T00:00:00.000Z',
        customer: { id: 'customer-1', code: 'KH-1', name: 'Customer 1', phone: null },
        seller: { id: 'seller-1', name: 'Seller 1' },
        subtotal_amount: 2000,
        discount_amount: 0,
        total_amount: 2000,
        paid_amount: 2000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{
          product_id: 'missing-product',
          product_snapshot: { code: 'SNAP-1', name: 'Snapshot product', unit_name: 'pcs', sell_method: 'quantity' },
          quantity: 2,
          unit_price: 1000,
          discount_amount: 0,
          line_total: 2000,
        }],
      })),
    }
    const handler = createHttpHandler({ repository: testRepository })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()
    const authorization = `Bearer ${loginBody.data.access_token}`

    const response = await handler(new Request('http://api.local/api/v1/sales-documents/HD-SNAPSHOT-1', { headers: { authorization } }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(listProducts).not.toHaveBeenCalled()
    expect(body.data.items[0].product).toEqual({
      id: 'missing-product',
      code: 'SNAP-1',
      name: 'Snapshot product',
      unit_name: 'pcs',
      sell_method: 'quantity',
    })
  })
})

function buildMinimalXlsxBase64(values: string[][]) {
  const sheetRows = values.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const cellRef = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`
      return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return buildStoredZip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  }).toString('base64')
}

function buildStoredZip(entries: Record<string, string>) {
  const chunks: Buffer[] = []
  const centralDirectory: Buffer[] = []
  let offset = 0

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const local = Buffer.alloc(30 + nameBytes.length + data.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    data.copy(local, 30 + nameBytes.length)
    chunks.push(local)

    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBytes.copy(central, 46)
    centralDirectory.push(central)
    offset += local.length
  }

  const centralStart = offset
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centralDirectory.length, 8)
  end.writeUInt16LE(centralDirectory.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralStart, 16)
  return Buffer.concat([...chunks, ...centralDirectory, end])
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
