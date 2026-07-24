// Pure allocation helpers for KiotViet cashbook → invoice / purchase receipt
// paydowns. Used by both Postgres rebuild and the in-memory repository so the
// two runtimes stay on the same matching rules.

export interface KiotVietCashbookAllocationRow {
  source_code: string
  entry_time: string | null
  direction: 'in' | 'out'
  amount_delta: number
  status: 'posted' | 'cancelled' | string
  counterparty_code: string | null
  counterparty_name: string | null
  category_name?: string | null
}

export interface AllocatableInvoice {
  id: string
  code: string
  created_at: string
  status: string
  order_type: string
  total_amount: number
  paid_amount: number
  debt_amount: number
  customer: { id: string; code: string; name?: string }
}

export interface AllocatablePurchaseReceipt {
  id: string
  code: string
  received_at: string
  status: string
  payable_amount: number
  paid_amount: number
  remaining_amount: number
  supplier: { id: string; code: string; name?: string }
  supplier_id?: string
}

export interface CashbookAllocation {
  order_id: string
  order_code: string
  order_total_amount: number
  collected_before: number
  allocated_amount: number
  remaining_after: number
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function linkedInvoiceCodeFromCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^TTHDO?(\d+(?:\.\d+)?)$/)
  return match ? `HD${match[1]}` : null
}

export function linkedPurchaseReceiptCodeFromCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^PCPN(\d+(?:\.\d+)?)$/)
  return match ? `PN${match[1]}` : null
}

export function isKiotVietDelayedCustomerPayment(row: Pick<KiotVietCashbookAllocationRow, 'direction' | 'source_code' | 'category_name'>) {
  const code = normalize(row.source_code)
  if (code.startsWith('tthd') || code.startsWith('pcpn')) return false
  if (row.direction !== 'in') return false
  const category = normalize(row.category_name ?? '')
  return category.includes('khach tra no') || category.includes('tien khach tra')
}

export function isKiotVietDelayedSupplierPayment(row: Pick<KiotVietCashbookAllocationRow, 'direction' | 'source_code' | 'category_name'>) {
  const code = normalize(row.source_code)
  if (!code.startsWith('pc') || code.startsWith('pcpn')) return false
  if (row.direction !== 'out') return false
  return normalize(row.category_name ?? '').includes('tien tra ncc')
}

export function invoicePaymentStatus(paidAmount: number, debtAmount: number) {
  if (debtAmount <= 0) return 'paid'
  if (paidAmount <= 0) return 'unpaid'
  return 'partial'
}

export function resetImportedKiotVietInvoicePayment(document: AllocatableInvoice) {
  const debt = document.status === 'completed' && document.order_type === 'invoice' ? document.total_amount : 0
  document.paid_amount = 0
  document.debt_amount = debt
}

export function resetImportedKiotVietPurchasePayment(receipt: AllocatablePurchaseReceipt) {
  receipt.paid_amount = 0
  receipt.remaining_amount = receipt.status === 'posted' ? receipt.payable_amount : 0
}

function matchCustomer(
  row: KiotVietCashbookAllocationRow,
  invoices: AllocatableInvoice[],
) {
  const code = normalize(row.counterparty_code ?? '')
  const name = normalize(row.counterparty_name ?? '')
  return invoices.find((invoice) => (
    (code && normalize(invoice.customer.code) === code)
    || (name && normalize(invoice.customer.name ?? '') === name)
  ))?.customer ?? null
}

function matchSupplier(
  row: KiotVietCashbookAllocationRow,
  receipts: AllocatablePurchaseReceipt[],
) {
  const code = normalize(row.counterparty_code ?? '')
  const name = normalize(row.counterparty_name ?? '')
  return receipts.find((receipt) => (
    (code && normalize(receipt.supplier.code) === code)
    || (name && normalize(receipt.supplier.name ?? '') === name)
  ))?.supplier ?? null
}

function strictShiftedPcpnReceipt(
  row: KiotVietCashbookAllocationRow,
  receipts: AllocatablePurchaseReceipt[],
) {
  if (!/^PCPN\d+(?:\.\d+)?$/i.test(row.source_code) || row.direction !== 'out') return null
  const supplier = matchSupplier(row, receipts)
  if (!supplier) return null
  const entryTime = Date.parse(row.entry_time ?? '')
  const amount = Math.abs(row.amount_delta)
  const candidates = receipts.filter((receipt) => (
    receipt.status === 'posted'
    && receipt.remaining_amount === amount
    && (receipt.supplier.id === supplier.id || normalize(receipt.supplier.code) === normalize(supplier.code))
    && Number.isFinite(entryTime)
    && Math.abs(Date.parse(receipt.received_at) - entryTime) <= 12 * 60 * 60 * 1000
  ))
  return candidates.length === 1 ? candidates[0] : null
}

function allocateDirectCustomerPayment(
  row: KiotVietCashbookAllocationRow,
  invoice: AllocatableInvoice | null,
): CashbookAllocation[] {
  if (!invoice || invoice.order_type !== 'invoice' || invoice.status === 'cancelled' || invoice.debt_amount <= 0) return []
  const allocated = Math.min(invoice.debt_amount, Math.max(row.amount_delta, 0))
  if (allocated <= 0) return []
  const collectedBefore = invoice.paid_amount
  invoice.paid_amount += allocated
  invoice.debt_amount = Math.max(invoice.debt_amount - allocated, 0)
  return [{
    order_id: invoice.id,
    order_code: invoice.code,
    order_total_amount: invoice.total_amount,
    collected_before: collectedBefore,
    allocated_amount: allocated,
    remaining_after: invoice.debt_amount,
  }]
}

function allocateDirectSupplierPayment(
  row: KiotVietCashbookAllocationRow,
  receipt: AllocatablePurchaseReceipt | null,
): CashbookAllocation[] {
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

function allocateFifoCustomerPayment(
  row: KiotVietCashbookAllocationRow,
  invoices: AllocatableInvoice[],
): CashbookAllocation[] {
  const customer = matchCustomer(row, invoices)
  if (!customer) return []
  let remaining = Math.max(row.amount_delta, 0)
  const entryTime = Date.parse(row.entry_time ?? '')
  const allocations: CashbookAllocation[] = []
  const openInvoices = invoices
    .filter((document) => (
      document.order_type === 'invoice'
      && document.status !== 'cancelled'
      && document.debt_amount > 0
      && (!Number.isFinite(entryTime) || Date.parse(document.created_at) <= entryTime)
      && (document.customer.id === customer.id || normalize(document.customer.code) === normalize(customer.code))
    ))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))

  for (const invoice of openInvoices) {
    if (remaining <= 0) break
    const allocated = Math.min(invoice.debt_amount, remaining)
    const collectedBefore = invoice.paid_amount
    invoice.paid_amount += allocated
    invoice.debt_amount = Math.max(invoice.debt_amount - allocated, 0)
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
  return allocations
}

function allocateFifoSupplierPayment(
  row: KiotVietCashbookAllocationRow,
  receipts: AllocatablePurchaseReceipt[],
): CashbookAllocation[] {
  const supplier = matchSupplier(row, receipts)
  if (!supplier) return []
  let remaining = Math.abs(row.amount_delta)
  const entryTime = Date.parse(row.entry_time ?? '')
  const allocations: CashbookAllocation[] = []
  const openReceipts = receipts
    .filter((receipt) => (
      receipt.status === 'posted'
      && receipt.remaining_amount > 0
      && (!Number.isFinite(entryTime) || Date.parse(receipt.received_at) <= entryTime)
      && (receipt.supplier.id === supplier.id || normalize(receipt.supplier.code) === normalize(supplier.code))
    ))
    .sort((left, right) => Date.parse(left.received_at) - Date.parse(right.received_at))

  for (const receipt of openReceipts) {
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
  return allocations
}

export function allocateImportedCashbookRow(
  row: KiotVietCashbookAllocationRow,
  invoices: AllocatableInvoice[],
  receipts: AllocatablePurchaseReceipt[],
): CashbookAllocation[] {
  if (row.status !== 'posted') return []

  const directInvoiceCode = linkedInvoiceCodeFromCashbookCode(row.source_code)
  if (directInvoiceCode !== null && row.direction === 'in') {
    return allocateDirectCustomerPayment(
      row,
      invoices.find((invoice) => invoice.code.toUpperCase() === directInvoiceCode) ?? null,
    )
  }

  const directReceiptCode = linkedPurchaseReceiptCodeFromCashbookCode(row.source_code)
  if (directReceiptCode !== null && row.direction === 'out') {
    const directReceipt = receipts.find((receipt) => receipt.code.toUpperCase() === directReceiptCode) ?? null
    const strictFallback = directReceipt?.status === 'posted' && directReceipt.remaining_amount > 0
      ? null
      : strictShiftedPcpnReceipt(row, receipts)
    return allocateDirectSupplierPayment(row, directReceipt?.status === 'posted' ? directReceipt : strictFallback)
  }

  if (isKiotVietDelayedCustomerPayment(row)) return allocateFifoCustomerPayment(row, invoices)
  if (isKiotVietDelayedSupplierPayment(row)) return allocateFifoSupplierPayment(row, receipts)
  return []
}

export function rebuildKiotVietCashbookAllocations(input: {
  invoices: AllocatableInvoice[]
  receipts: AllocatablePurchaseReceipt[]
  cashbookRows: Array<KiotVietCashbookAllocationRow & { id: string }>
  shouldResetInvoice?: (invoice: AllocatableInvoice) => boolean
  shouldResetReceipt?: (receipt: AllocatablePurchaseReceipt) => boolean
}) {
  for (const invoice of input.invoices) {
    if (input.shouldResetInvoice?.(invoice) ?? true) resetImportedKiotVietInvoicePayment(invoice)
  }
  for (const receipt of input.receipts) {
    if (input.shouldResetReceipt?.(receipt) ?? true) resetImportedKiotVietPurchasePayment(receipt)
  }

  const results: Array<{ id: string; allocations: CashbookAllocation[]; order_code: string | null }> = []
  const rows = [...input.cashbookRows]
    .filter((row) => row.status === 'posted')
    .sort((left, right) => (
      Date.parse(left.entry_time ?? '') - Date.parse(right.entry_time ?? '')
      || left.source_code.localeCompare(right.source_code)
    ))

  for (const row of rows) {
    const allocations = allocateImportedCashbookRow(row, input.invoices, input.receipts)
    results.push({
      id: row.id,
      allocations,
      order_code: allocations[0]?.order_code
        ?? linkedInvoiceCodeFromCashbookCode(row.source_code)
        ?? linkedPurchaseReceiptCodeFromCashbookCode(row.source_code),
    })
  }

  return {
    invoices: input.invoices,
    receipts: input.receipts,
    cashbookAllocations: results,
  }
}
