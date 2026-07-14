import { expect, it } from 'vitest'

import { managementSearchQuery, normalizeManagementSearchText } from './management-search'

it('normalizes Vietnamese accents for management search matching', () => {
  expect(normalizeManagementSearchText('  Điện thoại Đỗ Mai Phương  ')).toBe('dien thoai do mai phuong')
  expect(normalizeManagementSearchText('Khách lẻ nhà cung cấp đơn demo')).toBe('khach le nha cung cap don demo')
})

it('keeps submitted management search text readable while matching can be accent-insensitive', () => {
  expect(managementSearchQuery('  Điện thoại Đỗ  ')).toBe('Điện thoại Đỗ')
})
