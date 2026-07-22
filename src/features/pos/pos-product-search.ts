import { useEffect, useMemo, useRef, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import { quickPickSearchDebounceMs, useDebouncedValue } from '../../lib/use-debounced-value'
import type { CatalogService } from '../catalog/catalog-service'
import type { Product } from '../catalog/types'
import { normalizeSearch, quickProductLoadSize } from './pos-core'

const productSearchPageSize = 20

function productMatchesSearch(product: Product, query: string) {
  const normalizedText = normalizeSearch(`${product.code} ${product.name}`)
  if (normalizedText.includes(query)) return true
  return normalizedText.split(/\s+/).some((part) => part.includes(query))
}

function productSearchRank(product: Product, query: string) {
  const code = normalizeSearch(product.code)
  const name = normalizeSearch(product.name)
  const combined = normalizeSearch(`${product.code} ${product.name}`)
  if (code === query || name === query) return 0
  if (code.startsWith(query) || name.startsWith(query)) return 1
  if (name.split(/\s+/).some((part) => part.startsWith(query))) return 2
  if (combined.split(/\s+/).some((part) => part.startsWith(query))) return 3
  if (name.includes(query)) return 4
  if (combined.includes(query)) return 5
  return 6
}

function uniqueProductsById(products: Product[]) {
  const seen = new Set<string>()
  return products.filter((product) => {
    if (seen.has(product.id)) return false
    seen.add(product.id)
    return true
  })
}

export function usePosProductSearch({
  catalogService,
  onError,
}: {
  catalogService: CatalogService
  onError: (message: string) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebouncedValue(productSearch, quickPickSearchDebounceMs)
  const [catalogSearchResult, setCatalogSearchResult] = useState<{ search: string; products: Product[] }>({
    search: '',
    products: [],
  })
  const productSearchRef = useRef<HTMLInputElement>(null)

  const productSearchResults = useMemo(() => {
    const search = debouncedProductSearch.trim()
    const query = normalizeSearch(productSearch)
    if (query.length === 0) return []
    const searchProducts = catalogSearchResult.search === search ? catalogSearchResult.products : []
    return uniqueProductsById([...searchProducts, ...products])
      .filter((product) => productMatchesSearch(product, query))
      .sort((left, right) => {
        const rankDelta = productSearchRank(left, query) - productSearchRank(right, query)
        if (rankDelta !== 0) return rankDelta
        return left.name.localeCompare(right.name, 'vi')
      })
      .slice(0, 7)
  }, [catalogSearchResult, debouncedProductSearch, productSearch, products])

  useEffect(() => {
    let active = true

    async function loadProducts() {
      setLoadingProducts(true)
      try {
        const productResult = await catalogService.listProducts({
          status: 'active',
          page: 1,
          page_size: quickProductLoadSize,
          sort: 'pos_usage',
        })
        if (!active) return
        setProducts(productResult.items)
      } catch (cause) {
        if (active) onError(formatApiError(cause, 'Không tải được sản phẩm POS.'))
      } finally {
        if (active) setLoadingProducts(false)
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [catalogService, onError])

  useEffect(() => {
    const search = debouncedProductSearch.trim()
    if (search.length === 0) return undefined
    let active = true

    async function searchProducts() {
      try {
        const productResult = await catalogService.listProducts({
          status: 'active',
          page: 1,
          page_size: productSearchPageSize,
          search,
          search_context: 'quick_pick',
        })
        if (active) setCatalogSearchResult({ search, products: productResult.items })
      } catch (cause) {
        if (active) {
          setCatalogSearchResult({ search, products: [] })
          onError(formatApiError(cause, 'Không tìm được hàng hóa POS.'))
        }
      }
    }

    void searchProducts()

    return () => {
      active = false
    }
  }, [catalogService, debouncedProductSearch, onError])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== 'F3') return
      event.preventDefault()
      productSearchRef.current?.focus()
      productSearchRef.current?.select()
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function addQuickProduct(product: Product) {
    setProducts((current) => [product, ...current].slice(0, quickProductLoadSize))
  }

  return {
    addQuickProduct,
    loadingProducts,
    products,
    productSearch,
    productSearchRef,
    productSearchResults,
    setProductSearch,
  }
}
