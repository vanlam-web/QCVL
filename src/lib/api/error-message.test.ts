import { ApiError } from './client'
import { formatApiError } from './error-message'

it('maps known API errors and falls back for unknown causes', () => {
  expect(formatApiError(new ApiError(400, 'VALIDATION_ERROR', 'Invalid', 'trace'), 'Fallback')).toBe(
    'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin nhập.',
  )
  expect(formatApiError(new Error('boom'), 'Fallback')).toBe('Fallback')
})

it('shows configuration errors from the client instead of a generic fallback', () => {
  expect(
    formatApiError(
      new ApiError(
        0,
        'CONFIGURATION_ERROR',
        'Thiếu cấu hình Supabase anon key. Vui lòng nhập VITE_SUPABASE_ANON_KEY.',
        'local',
      ),
      'Fallback',
    ),
  ).toBe('Thiếu cấu hình Supabase anon key. Vui lòng nhập VITE_SUPABASE_ANON_KEY.')
})

it('includes the trace id for server errors so support can find the failing request', () => {
  expect(
    formatApiError(
      new ApiError(500, 'INTERNAL_ERROR', 'Server failed', 'trace-support-1'),
      'Fallback',
    ),
  ).toBe('Máy chủ gặp lỗi. Vui lòng thử lại sau. Mã lỗi: trace-support-1')
})
