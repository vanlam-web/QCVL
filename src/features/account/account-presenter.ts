import type { CurrentUserData } from '../../lib/api/types'

type CurrentDevice = NonNullable<CurrentUserData['devices']>[number]

export function accountRole(currentUser: CurrentUserData) {
  return currentUser.permissions.includes('perm.access_admin_panel') ? 'Admin' : 'Nhân viên'
}

export function deviceSummaryText(device: Pick<CurrentDevice, 'browser_name' | 'os_name' | 'ip_address'>) {
  return [device.browser_name, device.os_name, device.ip_address].filter(Boolean).join(' • ') || 'Chưa có thông tin thiết bị'
}

export function deviceSeenAtText(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('day')}/${pick('month')}/${pick('year')} ${pick('hour')}:${pick('minute')}`
}

export function accountValueOrFallback(value: string | null | undefined, fallback = 'Chưa có') {
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
