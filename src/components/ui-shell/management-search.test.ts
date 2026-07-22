import { expect, it, vi } from 'vitest'

import { normalizeManagementSearchText, preventManagementSearchSubmit } from './management-search'

it('normalizes Vietnamese accents for management search matching', () => {
  expect(normalizeManagementSearchText('  Điện thoại Đỗ Mai Phương  ')).toBe('dien thoai do mai phuong')
  expect(normalizeManagementSearchText('Khách lẻ nhà cung cấp đơn demo')).toBe('khach le nha cung cap don demo')
})

it('prevents form submit before running the management search action', () => {
  const preventDefault = vi.fn()
  const action = vi.fn()

  preventManagementSearchSubmit({ preventDefault }, action)

  expect(preventDefault).toHaveBeenCalled()
  expect(action).toHaveBeenCalled()
})
