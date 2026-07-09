import type { Permission, UserListItem } from '../users/types'

export interface AdminRolePermissionSource {
  id: string
  permissions: Permission['code'][]
}

export function adminNullableFormValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function userStatusLabel(status: UserListItem['status']) {
  return status === 'active' ? 'Đã hoạt động' : 'Ngừng hoạt động'
}

export function userRoleLabel(user: Pick<UserListItem, 'permissions'>) {
  if (user.permissions.includes('perm.manage_users')) return 'Quản trị'
  if (user.permissions.includes('perm.manage_finance')) return 'Kế toán'
  if (user.permissions.includes('perm.manage_inventory')) return 'Quản lý kho'
  if (user.permissions.includes('perm.create_order')) return 'Nhân viên thu ngân'
  return 'Nhân viên'
}

export function findAdminRoleById(roleId: string, roles: AdminRolePermissionSource[]): Pick<AdminRolePermissionSource, 'permissions'> | undefined {
  return roles.find((role) => role.id === roleId)
}

export function groupAdminPermissionsByModule(permissions: Permission[]) {
  return Object.entries(
    permissions.reduce<Record<string, Permission[]>>((modules, permission) => {
      const module = permissionModuleLabel(permission)
      modules[module] = [...(modules[module] ?? []), permission]
      return modules
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b))
}

export function permissionModuleLabel(permission: Permission) {
  const byModule: Record<string, string> = {
    administration: 'Thiết lập',
    catalog: 'Hàng hóa',
    finance: 'Sổ quỹ',
    inventory: 'Kho hàng',
    reports: 'Báo cáo',
    sales: 'Bán hàng',
  }
  return byModule[permission.module] ?? permission.module
}

export function permissionTitle(permission: Permission) {
  const byCode: Partial<Record<Permission['code'], string>> = {
    'perm.access_admin_panel': 'Mở trang thiết lập',
    'perm.apply_discount': 'Áp dụng chiết khấu',
    'perm.create_order': 'Tạo đơn bán hàng',
    'perm.edit_order_locked': 'Sửa đơn đã khóa',
    'perm.edit_price_book': 'Quản lý bảng giá',
    'perm.manage_finance': 'Quản lý sổ quỹ',
    'perm.manage_inventory': 'Quản lý tồn kho',
    'perm.manage_users': 'Quản lý người dùng',
    'perm.refund_order': 'Trả hàng',
    'perm.view_shift_report': 'Xem báo cáo ca',
  }
  return byCode[permission.code] ?? permission.description
}

export function permissionDescription(permission: Permission) {
  const byCode: Partial<Record<Permission['code'], string>> = {
    'perm.access_admin_panel': 'Cho phép vào khu vực Thiết lập.',
    'perm.apply_discount': 'Cho phép giảm giá khi bán hàng.',
    'perm.create_order': 'Cho phép tạo hóa đơn và đơn bán hàng.',
    'perm.edit_order_locked': 'Cho phép sửa chứng từ đã bị khóa.',
    'perm.edit_price_book': 'Cho phép chỉnh bảng giá và danh sách giá.',
    'perm.manage_finance': 'Cho phép thao tác sổ quỹ, công nợ và đối soát.',
    'perm.manage_inventory': 'Cho phép quản lý tồn kho và nghiệp vụ kho.',
    'perm.manage_users': 'Cho phép tạo tài khoản, khóa tài khoản và phân quyền.',
    'perm.refund_order': 'Cho phép lập phiếu trả hàng.',
    'perm.view_shift_report': 'Cho phép xem báo cáo ca và tổng kết bán hàng.',
  }
  return byCode[permission.code] ?? permission.description
}
