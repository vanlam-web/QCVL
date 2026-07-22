import { useEffect, useRef, useState } from 'react'
import { quickPickSearchDebounceMs, useDebouncedValue } from './use-debounced-value'

export type QuickPickSearchResult<T> = { items: T[] }

export function useQuickPickSearch<T>({
  search,
  minLength = 1,
  debounceMs = quickPickSearchDebounceMs,
  formatError,
  shouldSearch,
}: {
  search: (query: string) => Promise<QuickPickSearchResult<T>>
  minLength?: number
  debounceMs?: number
  formatError?: (cause: unknown) => string
  shouldSearch?: (query: string) => boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const requestId = useRef(0)
  const lastSearchQuery = useRef<string | null>(null)
  const debouncedQuery = useDebouncedValue(query, debounceMs)

  function canSearch(nextQuery: string) {
    const trimmed = nextQuery.trim()
    if (trimmed.length < minLength) return false
    return shouldSearch ? shouldSearch(trimmed) : true
  }

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!suggestionsOpen || !canSearch(trimmed)) {
      requestId.current += 1
      lastSearchQuery.current = null
      const stopLoadingId = window.setTimeout(() => setLoading(false), 0)
      if (trimmed.length === 0 || !canSearch(trimmed)) {
        const clearId = window.setTimeout(() => setResults([]), 0)
        return () => {
          window.clearTimeout(stopLoadingId)
          window.clearTimeout(clearId)
        }
      }
      return () => window.clearTimeout(stopLoadingId)
    }
    if (lastSearchQuery.current === trimmed) return undefined

    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    setError(null)
    setLoading(true)

    search(trimmed)
      .then((response) => {
        if (requestId.current !== currentRequestId) return
        lastSearchQuery.current = trimmed
        setResults(response.items)
        setLoading(false)
      })
      .catch((cause) => {
        if (requestId.current !== currentRequestId) return
        lastSearchQuery.current = trimmed
        setResults([])
        setLoading(false)
        setError(formatError ? formatError(cause) : 'Không tìm được kết quả.')
      })

    return undefined
  }, [debouncedQuery, formatError, minLength, search, shouldSearch, suggestionsOpen])

  async function submitSearch(event?: Pick<Event, 'preventDefault'>) {
    event?.preventDefault()
    const trimmed = query.trim()
    if (!canSearch(trimmed)) {
      clear()
      return
    }
    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    lastSearchQuery.current = trimmed
    setSuggestionsOpen(true)
    setLoading(true)
    setError(null)
    try {
      const response = await search(trimmed)
      if (requestId.current !== currentRequestId) return
      setResults(response.items)
      setLoading(false)
    } catch (cause) {
      if (requestId.current !== currentRequestId) return
      setResults([])
      setLoading(false)
      setError(formatError ? formatError(cause) : 'Không tìm được kết quả.')
    }
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery)
    const trimmed = nextQuery.trim()
    const nextOpen = canSearch(trimmed)
    setSuggestionsOpen(nextOpen)
    if (!nextOpen) {
      requestId.current += 1
      lastSearchQuery.current = null
      setResults([])
      setLoading(false)
    }
  }

  function clear() {
    requestId.current += 1
    lastSearchQuery.current = null
    setQuery('')
    setResults([])
    setLoading(false)
    setError(null)
    setSuggestionsOpen(false)
  }

  return {
    query,
    debouncedQuery,
    results,
    loading,
    error,
    suggestionsOpen,
    setQuery,
    setResults,
    setError,
    setSuggestionsOpen,
    changeQuery,
    submitSearch,
    clear,
  }
}
