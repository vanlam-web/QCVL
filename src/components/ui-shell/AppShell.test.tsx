import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from './AppShell'
import { ThemeProvider } from './ThemeProvider'
import type { CurrentUserData } from '../../lib/api/types'

const inventoryUser: CurrentUserData = {
  user: { id: 'u-1', email: 'owner@qc.local', display_name: 'Owner' },
  organization: { id: 'o-1', code: 'QC', name: 'QC OMS' },
  workstation: null,
  permissions: ['perm.manage_inventory'],
}

const fullNavigationUser: CurrentUserData = {
  ...inventoryUser,
  permissions: [
    'perm.create_order',
    'perm.manage_finance',
    'perm.manage_inventory',
    'perm.edit_price_book',
    'perm.access_admin_panel',
  ],
}

const priceBookUser: CurrentUserData = {
  ...inventoryUser,
  permissions: ['perm.edit_price_book'],
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

function renderShell(initialPath = '/purchase/receipts', currentUser = inventoryUser) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell currentUser={currentUser} onSignOut={vi.fn()}>
          <main>
            <h1>Phiếu nhập</h1>
          </main>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

it('renders adaptive navigation with purchase supplier entries and active route', () => {
  renderShell()

  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Hàng hóa/i })).toHaveAttribute('href', '/products')
  expect(screen.queryByRole('link', { name: /^Kho$/i })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Nhà cung cấp/i })).toHaveAttribute('href', '/suppliers')
  expect(screen.getByRole('link', { name: /Nhập hàng/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('link', { name: /Phiếu nhập/i })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Phiếu nhập' })).toBeInTheDocument()
})

it('renders POS as a quick action and keeps module navigation for management pages', () => {
  renderShell('/pos', fullNavigationUser)

  const banner = screen.getByRole('banner')
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng chính' })
  const quickActions = screen.getByLabelText('Thao tác nhanh')

  expect(banner).toContainElement(navigation)
  expect(screen.getByRole('link', { name: 'Mở tổng quan' })).toHaveAttribute('href', '/dashboard')
  expect(within(navigation).queryByRole('link', { name: /Tổng quan/i })).not.toBeInTheDocument()
  expect(quickActions.closest('.app-topbar')).not.toBeNull()

  expect(within(navigation).queryByRole('link', { name: /POS/i })).not.toBeInTheDocument()
  expect(within(quickActions).getByRole('link', { name: 'Mở POS' })).toHaveAttribute('href', '/pos')
  expect(within(quickActions).getByRole('link', { name: 'Mở POS' })).toHaveAttribute('aria-current', 'page')
  expect(within(navigation).getByRole('link', { name: /Chứng từ/i })).toHaveAttribute('href', '/sales-documents')
  expect(within(navigation).queryByRole('link', { name: /Hóa đơn/i })).not.toBeInTheDocument()
  expect(within(navigation).getByRole('link', { name: /Sổ quỹ/i })).toHaveAttribute('href', '/finance')
  expect(within(navigation).getByRole('link', { name: /Báo cáo/i })).toHaveAttribute('href', '/reports')
  expect(within(navigation).getByRole('link', { name: /Khách hàng/i })).toHaveAttribute('href', '/customers')
  expect(within(navigation).getByRole('link', { name: /Hàng hóa/i })).toHaveAttribute('href', '/products')
  expect(within(navigation).queryByRole('link', { name: /^Kho$/i })).not.toBeInTheDocument()
  expect(within(navigation).getByRole('link', { name: /Bảng giá/i })).toHaveAttribute('href', '/price-book')
  expect(within(navigation).getByRole('link', { name: /Nhà cung cấp/i })).toHaveAttribute('href', '/suppliers')
  expect(within(navigation).getByRole('link', { name: /Nhập hàng/i })).toHaveAttribute('href', '/purchase/receipts')
  expect(within(navigation).queryByRole('link', { name: /Quản trị/i })).not.toBeInTheDocument()
  expect(within(navigation).queryByRole('button', { name: /Đổi sang giao diện/i })).not.toBeInTheDocument()
})

it('keeps theme toggle visible inside shell', async () => {
  renderShell()

  await userEvent.click(screen.getByRole('button', { name: 'Đổi sang giao diện tối' }))

  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})

it('keeps theme and account controls before POS in the topbar quick actions', async () => {
  const onSignOut = vi.fn()
  const accountUser: CurrentUserData = {
    ...fullNavigationUser,
    user: {
      ...fullNavigationUser.user,
      display_name: '0947900909',
    },
  }
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/customers']}>
        <AppShell currentUser={accountUser} onSignOut={onSignOut}>
          <main>
            <h1>Khách hàng</h1>
          </main>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )

  const userActions = screen.getByLabelText('Tài khoản và giao diện')
  expect(userActions).toHaveClass('shell-user-actions')
  const quickActions = screen.getByLabelText('Thao tác nhanh')
  expect(quickActions).toContainElement(userActions)
  expect(userActions.closest('.app-topbar')).not.toBeNull()
  expect(Array.from(quickActions.children).at(0)).toBe(userActions)
  expect(within(userActions).getByRole('button', { name: 'Thông báo' })).toHaveClass('management-icon-button')
  expect(within(userActions).getByRole('button', { name: 'Cài đặt' })).toHaveClass('management-icon-button')
  expect(within(userActions).getByRole('button', { name: 'Đổi sang giao diện tối' })).toBeInTheDocument()

  await userEvent.click(within(userActions).getByRole('button', { name: 'Tài khoản' }))
  const profileItem = within(userActions).getByRole('menuitem', { name: /0947900909/ })
  expect(profileItem).toHaveAttribute('href', '/account')
  expect(profileItem).toHaveClass('account-menu-profile')
  expect(within(profileItem).getByText('0947900909')).toHaveClass('account-menu-profile-label')
  expect(within(userActions).queryByText(/xác (thực|minh) 2 lớp/i)).not.toBeInTheDocument()
  expect(within(userActions).getByRole('menuitem', { name: 'Quản trị' })).toHaveAttribute('href', '/admin')
  await userEvent.click(within(userActions).getByRole('menuitem', { name: 'Đăng xuất' }))

  expect(onSignOut).toHaveBeenCalled()
})

it('falls back to email in account menu and keeps long account names clipped', async () => {
  const longAccountUser: CurrentUserData = {
    ...inventoryUser,
    user: {
      id: 'u-long',
      email: 'long-account-name-that-should-stay-inside-the-menu@example.test',
      display_name: '',
    },
  }

  renderShell('/products', longAccountUser)

  await userEvent.click(screen.getByRole('button', { name: 'Tài khoản' }))

  const profileLabel = screen.getByText('long-account-name-that-should-stay-inside-the-menu@example.test')
  expect(profileLabel).toHaveClass('account-menu-profile-label')
})

it('routes the price book nav item to the dedicated price book page', () => {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/price-book']}>
        <AppShell currentUser={priceBookUser} onSignOut={vi.fn()}>
          <main>
            <h1>Bảng giá</h1>
          </main>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )

  expect(screen.getByRole('link', { name: /Bảng giá/i })).toHaveAttribute('href', '/price-book')
  expect(screen.getByRole('link', { name: /Bảng giá/i })).toHaveAttribute('aria-current', 'page')
})

it('shows reports only when user has both finance and inventory permissions', () => {
  const financeOnly = renderShell('/finance', { ...inventoryUser, permissions: ['perm.manage_finance'] })
  expect(screen.queryByRole('link', { name: /Báo cáo/i })).not.toBeInTheDocument()
  financeOnly.unmount()

  renderShell('/inventory', { ...inventoryUser, permissions: ['perm.manage_finance', 'perm.manage_inventory'] })
  expect(screen.getByRole('link', { name: /Báo cáo/i })).toHaveAttribute('href', '/reports')
})
