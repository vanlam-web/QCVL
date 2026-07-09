export const cashbookFavoritesStorageKey = 'finance.cashbook.favoriteEntryIds'
export const pinnedBankAccountsStorageKey = 'finance.bankAccounts.pinnedIds'

function readStringArrayStorage(key: string) {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeStringArrayStorage(key: string, ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(ids))
}

export function readCashbookFavoriteIds() {
  return readStringArrayStorage(cashbookFavoritesStorageKey)
}

export function writeCashbookFavoriteIds(ids: string[]) {
  writeStringArrayStorage(cashbookFavoritesStorageKey, ids)
}

export function readPinnedBankAccountIds() {
  return readStringArrayStorage(pinnedBankAccountsStorageKey)
}

export function writePinnedBankAccountIds(ids: string[]) {
  writeStringArrayStorage(pinnedBankAccountsStorageKey, ids)
}
