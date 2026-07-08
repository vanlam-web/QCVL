import { ApiError } from './client'

export function formatApiError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return fallback

  switch (cause.code) {
    case 'VALIDATION_ERROR':
      return 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin nhập.'
    case 'RESOURCE_CONFLICT':
      return 'Dữ liệu đã tồn tại hoặc xung đột với bản ghi hiện có.'
    case 'RATE_LIMITED':
      return 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
    case 'PERMISSION_DENIED':
      return 'Tài khoản không có quyền thực hiện thao tác này.'
    case 'RESOURCE_NOT_FOUND':
      return 'Không tìm thấy dữ liệu cần thao tác.'
    case 'ACCOUNT_INACTIVE':
      return 'Tài khoản hiện không còn hoạt động.'
    case 'AUTH_REQUIRED':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    case 'WORKSTATION_INVALID':
      return 'Phiên làm việc không còn hợp lệ. Vui lòng đăng nhập lại.'
    case 'CONFIGURATION_ERROR':
      return cause.message
    case 'INTERNAL_ERROR':
      return `Máy chủ gặp lỗi. Vui lòng thử lại sau. Mã lỗi: ${cause.traceId}`
    default:
      return fallback
  }
}
