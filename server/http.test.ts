import { describe, expect, test } from 'vitest'
import { createHttpHandler, hashPassword, type ServerRepository } from './http'

const user = {
  id: 'user-1',
  email: 'admin@qc-oms.local',
  password_hash: '',
  organization_id: 'org-1',
  display_name: 'Admin',
  status: 'active' as const,
}

function repository(passwordHash: string): ServerRepository {
  const sessions = new Map<string, string>()
  const userWithPassword = { ...user, password_hash: passwordHash }

  return {
    async findUserByEmail(email) {
      return email === user.email ? userWithPassword : null
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
            user: { id: user.id, email: user.email, display_name: user.display_name },
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

describe('createHttpHandler', () => {
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
    expect(invoiceBody.data.items.every((item: { order_type: string; customer: { code: string } }) => item.order_type === 'invoice' && item.customer.code === 'KH000001')).toBe(true)
    expect(quoteBody.data.items.every((item: { order_type: string; customer: { code: string } }) => item.order_type === 'quote' && item.customer.code === 'KH000001')).toBe(true)
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
    expect(body.data.items.some((item: { code: string; name: string }) => item.code === 'KH000001' && item.name === 'Khách lẻ')).toBe(true)
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
    const documentBody = await documents.json()
    const cashbookBody = await cashbook.json()

    expect(checkout.status).toBe(201)
    expect(checkoutBody.data.order.total_amount).toBe(1200000)
    expect(documentBody.data.items[0].code).toBe(orderCode)
    expect(cashbookBody.data.items[0].note).toContain(orderCode)
    expect(cashbookBody.data.items[0].amount_delta).toBe(1200000)
  })
})
