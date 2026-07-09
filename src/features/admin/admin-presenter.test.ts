import { describe, expect, it } from 'vitest'
import type { Permission, UserListItem } from '../users/types'
import {
  adminNullableFormValue,
  findAdminRoleById,
  groupAdminPermissionsByModule,
  permissionModuleLabel,
  permissionTitle,
  userRoleLabel,
  userStatusLabel,
} from './admin-presenter'

const user = {
  id: 'user-1',
  email: 'admin@example.test',
  username: 'admin',
  phone: null,
  display_name: 'Admin',
  status: 'active',
  permissions: ['perm.manage_users'],
} satisfies UserListItem

const permissions = [
  { code: 'perm.create_order', module: 'sales', description: 'Create order' },
  { code: 'perm.manage_users', module: 'administration', description: 'Manage users' },
] as Permission[]

describe('admin presenter', () => {
  it('maps user and permission labels outside the page', () => {
    expect(userStatusLabel('active')).toBe('Đã hoạt động')
    expect(userRoleLabel(user)).toBe('Quản trị')
    expect(permissionModuleLabel(permissions[0])).toBe('Bán hàng')
    expect(permissionTitle(permissions[0])).toBe('Tạo đơn bán hàng')
  })

  it('groups permissions and finds roles outside the page', () => {
    expect(groupAdminPermissionsByModule(permissions).map(([name]) => name)).toEqual(['Bán hàng', 'Thiết lập'])
    expect(findAdminRoleById('cashier', [{ id: 'cashier', permissions: ['perm.create_order'] }])?.permissions).toEqual(['perm.create_order'])
  })

  it('normalizes optional form values outside the page', () => {
    expect(adminNullableFormValue('  abc ')).toBe('abc')
    expect(adminNullableFormValue(' ')).toBeNull()
  })
})
