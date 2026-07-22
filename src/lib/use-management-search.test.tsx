import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useManagementSearch } from './use-management-search'

describe('useManagementSearch', () => {
  it('keeps draft separate and applies search only on submit', () => {
    const onApply = vi.fn()
    const { result } = renderHook(() => useManagementSearch({ initialSearch: '', onApply }))

    act(() => result.current.changeSearch('Phong'))

    expect(result.current.draftSearch).toBe('Phong')
    expect(result.current.appliedSearch).toBe('')
    expect(onApply).not.toHaveBeenCalled()

    act(() => result.current.submitSearch())

    expect(result.current.appliedSearch).toBe('Phong')
    expect(onApply).toHaveBeenCalledWith('Phong')
  })

  it('clears draft and applied search immediately', () => {
    const onApply = vi.fn()
    const { result } = renderHook(() => useManagementSearch({ initialSearch: 'KH0001', onApply }))

    act(() => result.current.clearSearch())

    expect(result.current.draftSearch).toBe('')
    expect(result.current.appliedSearch).toBe('')
    expect(onApply).toHaveBeenCalledWith('')
  })
})

