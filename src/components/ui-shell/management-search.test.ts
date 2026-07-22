import { expect, it, vi } from 'vitest'

import { managementSearchQuery, normalizeManagementSearchText, runManagementLiveSearch } from './management-search'

it('normalizes Vietnamese accents for management search matching', () => {
  expect(normalizeManagementSearchText('  Điện thoại Đỗ Mai Phương  ')).toBe('dien thoai do mai phuong')
  expect(normalizeManagementSearchText('Khách lẻ nhà cung cấp đơn demo')).toBe('khach le nha cung cap don demo')
})

it('keeps submitted management search text readable while matching can be accent-insensitive', () => {
  expect(managementSearchQuery('  Điện thoại Đỗ  ')).toBe('Điện thoại Đỗ')
})

it('keeps management search changes as draft until the form is submitted', () => {
  const setSearch = vi.fn()
  const resetSelection = vi.fn()
  const load = vi.fn()

  runManagementLiveSearch('  PT0001  ', { setSearch, resetSelection, load })

  expect(setSearch).toHaveBeenCalledWith('  PT0001  ')
  expect(resetSelection).toHaveBeenCalled()
  expect(load).not.toHaveBeenCalled()
})

it('resets management search immediately when the search text is cleared', () => {
  const setSearch = vi.fn()
  const load = vi.fn()

  runManagementLiveSearch('', { setSearch, load })

  expect(setSearch).toHaveBeenCalledWith('')
  expect(load).toHaveBeenCalledWith('')
})
