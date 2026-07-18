import type { InvoiceRevisionHandoffPayload } from '../orders/types'

const storageKey = 'qc_oms.invoice_revision_payload'

export function saveInvoiceRevisionHandoffPayload(payload: InvoiceRevisionHandoffPayload): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(payload))
}

export function consumeInvoiceRevisionHandoffPayload(): InvoiceRevisionHandoffPayload | null {
  const raw = window.sessionStorage.getItem(storageKey)
  if (raw === null) return null
  window.sessionStorage.removeItem(storageKey)
  try {
    return JSON.parse(raw) as InvoiceRevisionHandoffPayload
  } catch {
    return null
  }
}
