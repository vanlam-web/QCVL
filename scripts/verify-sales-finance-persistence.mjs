const baseUrl = process.env.QCVL_VERIFY_BASE_URL ?? 'http://100.84.228.125:3200'
const password = process.env.QCVL_VERIFY_PASSWORD
const email = process.env.QCVL_VERIFY_EMAIL ?? 'admin@qc-oms.local'
const existingOrderCode = process.env.QCVL_VERIFY_ORDER_CODE

if (!password) {
  throw new Error('QCVL_VERIFY_PASSWORD is required')
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} ${response.status}: ${JSON.stringify(body)}`)
  }
  return body.data
}

const login = await api('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const headers = {
  authorization: `Bearer ${login.access_token}`,
  'content-type': 'application/json',
}

let orderCode = existingOrderCode
let receiptCode = process.env.QCVL_VERIFY_RECEIPT_CODE

if (!orderCode) {
  const checkout = await api('/api/v1/orders/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer_id: 'customer-011',
      note: 'Verify PostgreSQL persistence customer 11',
      items: [{ product_id: 'product-001', quantity: 1, unit_price: 600000, discount_amount: 0, price_source: 'default_price_list' }],
      payment: { cash_amount: 0, bank_amount: 300000, bank_account_id: 'bank-main', old_debt_payment_amount: 0, change_returned_amount: 0 },
    }),
  })
  orderCode = checkout.order.code

  const collection = await api('/api/v1/finance/debt-collections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer_id: 'customer-011',
      amount: 100000,
      payment_method: { cash_amount: 0, bank_amount: 100000, bank_account_id: 'bank-main', bank_transaction_ref: 'VERIFY-KH011' },
      note: 'Verify debt collection customer 11',
    }),
  })
  receiptCode = collection.payment_receipt_id
}

const documents = await api(`/api/v1/sales-documents?search=${encodeURIComponent(orderCode)}&customer_id=customer-011&type=invoice&page=1&page_size=20`, { headers })
const debt = await api('/api/v1/finance/customers/customer-011/debt', { headers })
const cashbook = receiptCode
  ? await api(`/api/v1/finance/cashbook?search=${encodeURIComponent(receiptCode)}&page=1&page_size=20`, { headers })
  : { items: [] }

const document = documents.items.find((item) => item.code === orderCode)
const debtInvoice = debt.invoices.find((item) => item.order_code === orderCode)
const cashbookEntry = receiptCode ? cashbook.items.find((item) => item.code === receiptCode || item.note?.includes(receiptCode) || item.note?.includes('VERIFY-KH011')) : null

if (!document) throw new Error(`Missing sales document ${orderCode}`)
if (!debtInvoice) throw new Error(`Missing debt invoice ${orderCode}`)
if (debtInvoice.remaining_debt !== 200000) throw new Error(`Expected remaining debt 200000 for ${orderCode}, got ${debtInvoice.remaining_debt}`)
if (receiptCode && !cashbookEntry) throw new Error(`Missing cashbook entry for receipt ${receiptCode}`)

console.log(JSON.stringify({
  baseUrl,
  orderCode,
  receiptCode,
  document: {
    paid_amount: document.paid_amount,
    debt_amount: document.debt_amount,
    payment_status: document.payment_status,
  },
  debtInvoice: {
    paid_amount: debtInvoice.paid_amount,
    debt_amount: debtInvoice.debt_amount,
    remaining_debt: debtInvoice.remaining_debt,
  },
  cashbookCode: cashbookEntry?.code ?? null,
  status: 'ok',
}, null, 2))
