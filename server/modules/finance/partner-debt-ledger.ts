export type PartnerDebtView = 'customer' | 'supplier'

export function debtDeltaForVoucher(input: {
  code: string
  view: PartnerDebtView
  linked: boolean
  sourceAmount?: number
  normalizedAmountDelta?: number
}) {
  const code = input.code.trim().toUpperCase()
  const amount = Math.abs(Number(input.sourceAmount ?? input.normalizedAmountDelta ?? 0))
  const signed = Number(input.normalizedAmountDelta ?? amount)
  const customerDelta = customerViewDelta(code, amount, signed, input.linked)
  if (input.view === 'customer') return customerDelta
  return input.linked ? -customerDelta : supplierViewDelta(code, amount, signed)
}

export interface PartnerDebtDocumentInput {
  id: string
  code: string
  time: string
  amount: number
  normalizedAmountDelta?: number
  status: 'posted' | 'cancelled' | 'replaced' | string
  sourceType?: string
  sourceId?: string | null
}

export interface PartnerDebtLedgerRow {
  id: string
  code: string
  time: string
  amountDelta: number
  balanceAfter: number
  sourceType?: string
  sourceId?: string | null
}

export function buildPartnerDebtLedger(input: {
  view: PartnerDebtView
  linked: boolean
  documents: PartnerDebtDocumentInput[]
}) {
  let balance = 0
  const rows: PartnerDebtLedgerRow[] = []
  const documents = [...input.documents].sort((left, right) => (
    Date.parse(left.time) - Date.parse(right.time)
    || left.code.localeCompare(right.code)
  ))
  for (const document of documents) {
    if (document.status !== 'posted') continue
    const amountDelta = debtDeltaForVoucher({
      code: document.code,
      view: input.view,
      linked: input.linked,
      sourceAmount: document.amount,
      normalizedAmountDelta: document.normalizedAmountDelta,
    })
    if (amountDelta === 0) continue
    balance += amountDelta
    rows.push({
      id: document.id,
      code: document.code,
      time: document.time,
      amountDelta,
      balanceAfter: balance,
      sourceType: document.sourceType,
      sourceId: document.sourceId,
    })
  }
  return { totalDebt: balance, rows }
}

export function allocateOldestFirst(input: {
  amount: number
  documents: Array<{ id: string; code: string; time: string; remainingAmount: number }>
}) {
  let remaining = Math.max(input.amount, 0)
  const allocations: Array<{
    documentId: string
    documentCode: string
    allocatedAmount: number
    remainingAfter: number
  }> = []
  const documents = [...input.documents].sort((left, right) => (
    Date.parse(left.time) - Date.parse(right.time)
    || left.code.localeCompare(right.code)
  ))
  for (const document of documents) {
    if (remaining <= 0) break
    const allocatedAmount = Math.min(Math.max(document.remainingAmount, 0), remaining)
    if (allocatedAmount <= 0) continue
    allocations.push({
      documentId: document.id,
      documentCode: document.code,
      allocatedAmount,
      remainingAfter: Math.max(document.remainingAmount - allocatedAmount, 0),
    })
    remaining -= allocatedAmount
  }
  return allocations
}

function customerViewDelta(code: string, amount: number, signed: number, linked: boolean) {
  if (/^HDO?\d/.test(code)) return amount
  if (/^(TT|TTHD|TTHDO|TTM|TTMHD|TNH|TNHHD)\d/.test(code)) return -amount
  if (/^CKKH\d/.test(code)) return -amount
  if (/^CB\d/.test(code)) return signed
  if (/^PN\d/.test(code)) return linked ? -amount : 0
  if (/^PC(PN)?\d/.test(code)) return linked ? amount : 0
  return 0
}

function supplierViewDelta(code: string, amount: number, signed: number) {
  if (/^PN\d/.test(code)) return amount
  if (/^PC(PN)?\d/.test(code)) return -amount
  if (/^CB\d/.test(code)) return signed
  return 0
}
