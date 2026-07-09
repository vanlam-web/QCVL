import { describe, expect, it, vi } from 'vitest'
import { readProductFavoriteIds, writeProductFavoriteIds } from './catalog-storage'

describe('catalog storage', () => {
  it('stores product favorite ids outside the page', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    })

    writeProductFavoriteIds(['p-1'])

    expect(readProductFavoriteIds()).toEqual(['p-1'])
    vi.unstubAllGlobals()
  })
})
