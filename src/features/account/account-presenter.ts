import type { CurrentUserData } from '../../lib/api/types'
import { formatKvDateTime } from '../../lib/date-format'

type CurrentDevice = NonNullable<CurrentUserData['devices']>[number]

export function accountRole(currentUser: CurrentUserData) {
  return currentUser.permissions.includes('perm.access_admin_panel') ? 'Admin' : 'Nhân viên'
}

export function deviceSummaryText(device: Pick<CurrentDevice, 'browser_name' | 'os_name' | 'ip_address'>) {
  return [device.browser_name, device.os_name, device.ip_address].filter(Boolean).join(' • ') || 'Chưa có thông tin thiết bị'
}

export function deviceSeenAtText(value: string) {
  return formatKvDateTime(value)
}

export function accountValueOrFallback(value: string | null | undefined, fallback = '') {
  const text = value?.trim()
  return text ? text : fallback
}

export function requiredFormValue(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim()
}

export function nullableFormValue(data: FormData, name: string) {
  const value = requiredFormValue(data, name)
  return value.length > 0 ? value : null
}

export function profileSaveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `Không lưu được: ${error.message}`
  }
  return 'Không lưu được. Kiểm tra API hoặc kết nối.'
}
