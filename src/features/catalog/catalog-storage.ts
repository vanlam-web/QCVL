export const productFavoritesStorageKey = 'catalog.product.favoriteProductIds'

export function readProductFavoriteIds() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(productFavoritesStorageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function writeProductFavoriteIds(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(productFavoritesStorageKey, JSON.stringify(ids))
}
