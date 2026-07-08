import { ApiError } from './client'
import { formatApiError } from './error-message'

it('maps known API errors and falls back for unknown causes', () => {
  expect(formatApiError(new ApiError(400, 'VALIDATION_ERROR', 'Invalid', 'trace'), 'Fallback')).not.toBe('Fallback')
  expect(formatApiError(new Error('boom'), 'Fallback')).toBe('Fallback')
})

it('shows configuration errors from the client instead of a generic fallback', () => {
  expect(
    formatApiError(
      new ApiError(0, 'CONFIGURATION_ERROR', 'Thieu cau hinh API. Vui long nhap VITE_API_BASE_URL.', 'local'),
      'Fallback',
    ),
  ).toBe('Thieu cau hinh API. Vui long nhap VITE_API_BASE_URL.')
})

it('includes the trace id for server errors so support can find the failing request', () => {
  expect(
    formatApiError(
      new ApiError(500, 'INTERNAL_ERROR', 'Server failed', 'trace-support-1'),
      'Fallback',
    ),
  ).toBe('Máy chủ gặp lỗi. Vui lòng thử lại sau. Mã lỗi: trace-support-1')
})
