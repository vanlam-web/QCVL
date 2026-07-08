import type { CurrentUserData } from '../../lib/api/types'
import { appRoutes } from '../../app/routes'
import { permissions } from '../users/permissions'

export const phaseOneModules = [
  { id: 'pos', label: 'POS', path: appRoutes.pos, permissions: [permissions.createOrder] },
  {
    id: 'sales-documents',
    label: 'Chứng từ bán hàng',
    path: appRoutes.salesDocuments,
    permissions: [permissions.createOrder],
  },
  { id: 'customers', label: 'Khách hàng', path: appRoutes.customers, permissions: [permissions.createOrder] },
  { id: 'goods', label: 'Hàng hóa', path: appRoutes.products, permissions: [permissions.manageInventory] },
  { id: 'suppliers', label: 'Nhà cung cấp', path: appRoutes.suppliers, permissions: [permissions.manageInventory] },
  {
    id: 'purchase-receipts',
    label: 'Nhập hàng',
    path: appRoutes.purchaseReceipts,
    permissions: [permissions.manageInventory],
  },
  { id: 'price-book', label: 'Bảng giá', path: appRoutes.priceBook, permissions: [permissions.editPriceBook] },
  { id: 'finance', label: 'Sổ quỹ', path: appRoutes.finance, permissions: [permissions.manageFinance] },
  {
    id: 'reports',
    label: 'Báo cáo',
    path: appRoutes.reports,
    permissions: [permissions.manageFinance, permissions.manageInventory],
    requireAllPermissions: true,
  },
] as const

export function canOpenModule(
  currentUser: CurrentUserData,
  module: (typeof phaseOneModules)[number],
) {
  if ('requireAllPermissions' in module && module.requireAllPermissions) {
    return module.permissions.every((permission) => currentUser.permissions.includes(permission))
  }
  return module.permissions.some((permission) => currentUser.permissions.includes(permission))
}
