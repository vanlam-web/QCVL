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

function persistentRepository(passwordHash: string): ServerRepository {
  const base = repository(passwordHash)
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
      return documents.find((document) => document.id === input.id) ?? null
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
      const receiptCode = `PT-CN-TEST-${cashbook.length + 1}`
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
})
