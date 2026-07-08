import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage } from './DashboardPage'
import type { CurrentUserData } from '../../lib/api/types'

const currentUser: CurrentUserData = {
  user: { id: 'u-1', email: 'admin@qc.local', display_name: 'Admin' },
  organization: { id: 'o-1', code: 'VAN-LAM', name: 'Văn Lâm' },
  workstation: null,
  permissions: ['perm.create_order', 'perm.access_admin_panel'],
}

it('shows account-based modules without requiring a POS machine', async () => {
  const onOpenPos = vi.fn()
  const onOpenAdmin = vi.fn()
  const onOpenPriceBook = vi.fn()
  const onOpenSalesDocuments = vi.fn()
  const onOpenSuppliers = vi.fn()
  const onOpenPurchaseReceipts = vi.fn()
  const onSignOut = vi.fn()

  render(
    <DashboardPage
      currentUser={currentUser}
      onOpenPos={onOpenPos}
      onOpenAdmin={onOpenAdmin}
      onOpenPriceBook={onOpenPriceBook}
      onOpenSalesDocuments={onOpenSalesDocuments}
      onOpenSuppliers={onOpenSuppliers}
      onOpenPurchaseReceipts={onOpenPurchaseReceipts}
      onSignOut={onSignOut}
    />,
  )

  expect(screen.queryByRole('heading', { name: 'QC-OMS' })).not.toBeInTheDocument()
  expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  expect(screen.queryByText('POS-01')).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Điều hướng tổng quan' })).not.toBeInTheDocument()
  expect(screen.queryByText('Tổng quan')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thông báo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Kết quả bán hàng hôm nay' })).toHaveClass('dashboard-kpi-card')
  expect(screen.getByText('Doanh thu')).toBeInTheDocument()
  expect(screen.getAllByText('Doanh thu thuần')).toHaveLength(2)
  expect(screen.queryByText('Trả hàng')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Biểu đồ doanh thu thuần' })).toHaveClass('dashboard-chart-card')
  expect(screen.getByRole('img', { name: 'Sóng doanh thu thuần' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Top hàng bán chạy' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Hoạt động gần đây' })).toHaveClass('dashboard-activity-card')
  expect(screen.queryByRole('region', { name: 'Tiện ích' })).not.toBeInTheDocument()
  expect(screen.queryByText('Thanh toán')).not.toBeInTheDocument()
  expect(screen.queryByText('Vay vốn')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Bán hàng' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Module hệ thống' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))

  expect(onOpenPos).not.toHaveBeenCalled()
  expect(onOpenAdmin).not.toHaveBeenCalled()
  expect(onOpenPriceBook).not.toHaveBeenCalled()
  expect(onOpenSalesDocuments).not.toHaveBeenCalled()
  expect(onOpenSuppliers).not.toHaveBeenCalled()
  expect(onOpenPurchaseReceipts).not.toHaveBeenCalled()
  expect(onSignOut).toHaveBeenCalled()
})
