import type { QuoteReopenPayload } from '../orders/types'

const storageKey = 'qc_oms.quote_reopen_payload'

export function saveQuoteReopenPayload(payload: QuoteReopenPayload): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(payload))
}

export function consumeQuoteReopenPayload(): QuoteReopenPayload | null {
  const raw = window.sessionStorage.getItem(storageKey)
  if (raw === null) return null
  window.sessionStorage.removeItem(storageKey)

  try {
    return JSON.parse(raw) as QuoteReopenPayload
  } catch {
    return null
  }
}
