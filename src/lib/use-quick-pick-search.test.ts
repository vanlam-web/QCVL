import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quickPickCustomerPageSize, quickPickDefaultPage, quickPickSearchContext } from './search-contract'
import { useQuickPickSearch } from './use-quick-pick-search'

type ResultItem = { id: string; name: string }

afterEach(() => {
  vi.useRealTimers()
})

describe('useQuickPickSearch', () => {
  it('debounces quick-pick searches and exposes loading state', async () => {
    vi.useFakeTimers()
    let resolveSearch: (value: { items: ResultItem[] }) => void = () => undefined
    const search = vi.fn(() => new Promise<{ items: ResultItem[] }>((resolve) => {
      resolveSearch = resolve
    }))
    const { result } = renderHook(() => useQuickPickSearch<ResultItem>({
      search,
      minLength: 1,
    }))

    act(() => {
      result.current.changeQuery('k')
      result.current.changeQuery('kl')
    })

    expect(search).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })

    expect(search).toHaveBeenCalledWith('kl')
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveSearch({ items: [{ id: 'customer-1', name: 'KL2' }] })
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.results).toEqual([{ id: 'customer-1', name: 'KL2' }])
  })

  it('ignores stale quick-pick responses', async () => {
    vi.useFakeTimers()
    const resolvers: Array<(value: { items: ResultItem[] }) => void> = []
    const search = vi.fn(() => new Promise<{ items: ResultItem[] }>((resolve) => {
      resolvers.push(resolve)
    }))
    const { result } = renderHook(() => useQuickPickSearch<ResultItem>({
      search,
      minLength: 1,
    }))

    act(() => result.current.changeQuery('kl2'))
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })
    act(() => result.current.changeQuery('hlo'))
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
    })

    await act(async () => {
      resolvers[0]({ items: [{ id: 'old', name: 'Old' }] })
      await Promise.resolve()
    })
    expect(result.current.results).toEqual([])

    await act(async () => {
      resolvers[1]({ items: [{ id: 'new', name: 'New' }] })
      await Promise.resolve()
    })
    expect(result.current.results).toEqual([{ id: 'new', name: 'New' }])
  })

  it('clears empty query and keeps shared quick-pick constants', () => {
    const search = vi.fn(async () => ({ items: [] as ResultItem[] }))
    const { result } = renderHook(() => useQuickPickSearch<ResultItem>({ search }))

    act(() => {
      result.current.changeQuery('abc')
      result.current.clear()
    })

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.suggestionsOpen).toBe(false)
    expect(quickPickDefaultPage).toBe(1)
    expect(quickPickCustomerPageSize).toBe(8)
    expect(quickPickSearchContext).toBe('quick_pick')
  })
})

