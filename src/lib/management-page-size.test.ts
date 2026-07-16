import { managementPageSizeOptions, pageSizeForManagementViewport } from './management-page-size'

it('chooses management page size from viewport width', () => {
  expect(pageSizeForManagementViewport(1024)).toBe(15)
  expect(pageSizeForManagementViewport(1366)).toBe(20)
  expect(pageSizeForManagementViewport(1680)).toBe(25)
  expect(pageSizeForManagementViewport(2209)).toBe(30)
})

it('keeps shared management page size options dense enough for large screens', () => {
  expect(managementPageSizeOptions).toEqual([15, 20, 25, 30, 50, 100])
})
