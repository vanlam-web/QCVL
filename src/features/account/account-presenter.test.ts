import { describe, expect, it } from 'vitest'
import type { CurrentUserData } from '../../lib/api/types'
import {
  accountRole,
  accountValueOrFallback,
  deviceSeenAtText,
  deviceSummaryText,
  nullableFormValue,
  profileSaveErrorMessage,
  requiredFormValue,
} from './account-presenter'

const currentUser = {
  user: { id: 'user-1', email: 'admin@example.test', display_name: 'Admin' },
  organization: { id: 'org-1', code: 'QC', name: 'QC' },
  workstation: null,
  permissions: ['perm.access_admin_panel'],
} satisfies CurrentUserData

describe('account presenter', () => {
  it('maps account role and fallback text outside the page', () => {
    expect(accountRole(currentUser)).toBe('Admin')
    expect(accountRole({ ...currentUser, permissions: [] })).toBe('Nhân viên')
    expect(accountValueOrFallback('')).toBe('Chưa có')
    expect(accountValueOrFallback('abc')).toBe('abc')
  })

  it('formats device display outside the page', () => {
    expect(deviceSummaryText({ browser_name: 'Chrome', os_name: 'Windows', ip_address: '127.0.0.1' })).toBe('Chrome • Windows • 127.0.0.1')
    expect(deviceSummaryText({ browser_name: null, os_name: null, ip_address: null })).toBe('Chưa có thông tin thiết bị')
    expect(deviceSeenAtText('bad-date')).toBe('Chưa có')
  })

  it('reads profile form values outside the page', () => {
    const data = new FormData()
    data.set('name', '  Van Lam  ')
    data.set('empty', ' ')

    expect(requiredFormValue(data, 'name')).toBe('Van Lam')
    expect(nullableFormValue(data, 'empty')).toBeNull()
    expect(profileSaveErrorMessage(new Error('API fail'))).toBe('Không lưu được: API fail')
  })
})
