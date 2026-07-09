import { describe, expect, it, vi } from 'vitest'
import {
  cashbookFavoritesStorageKey,
  pinnedBankAccountsStorageKey,
  readCashbookFavoriteIds,
  readPinnedBankAccountIds,
  writeCashbookFavoriteIds,
  writePinnedBankAccountIds,
} from './finance-storage'

describe('finance storage', () => {
  it('stores and reads string id arrays', () => {
    localStorage.clear()

    writeCashbookFavoriteIds(['entry-1'])
    writePinnedBankAccountIds(['bank-1'])

    expect(localStorage.getItem(cashbookFavoritesStorageKey)).toBe('["entry-1"]')
    expect(localStorage.getItem(pinnedBankAccountsStorageKey)).toBe('["bank-1"]')
    expect(readCashbookFavoriteIds()).toEqual(['entry-1'])
    expect(readPinnedBankAccountIds()).toEqual(['bank-1'])
  })

  it('returns empty array for invalid stored data', () => {
    localStorage.setItem(cashbookFavoritesStorageKey, '{"bad":true}')
    localStorage.setItem(pinnedBankAccountsStorageKey, 'bad-json')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(readCashbookFavoriteIds()).toEqual([])
    expect(readPinnedBankAccountIds()).toEqual([])

    spy.mockRestore()
  })
})
