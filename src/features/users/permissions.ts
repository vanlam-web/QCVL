import type { PermissionCode } from './types'

export const permissions = {
  accessAdminPanel: 'perm.access_admin_panel',
  applyDiscount: 'perm.apply_discount',
  createOrder: 'perm.create_order',
  editOrderLocked: 'perm.edit_order_locked',
  editPriceBook: 'perm.edit_price_book',
  manageFinance: 'perm.manage_finance',
  manageInventory: 'perm.manage_inventory',
  manageUsers: 'perm.manage_users',
  refundOrder: 'perm.refund_order',
  viewShiftReport: 'perm.view_shift_report',
} as const satisfies Record<string, PermissionCode>
