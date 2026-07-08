import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileMenu } from './ProfileMenu'

it('shows permission-allowed items and signs out', async () => {
  const onSignOut = vi.fn()
  const onOpenAdmin = vi.fn()
  const onOpenDashboard = vi.fn()
  render(
    <ProfileMenu
      displayName="Cashier"
      permissions={['perm.view_shift_report']}
      onSignOut={onSignOut}
      onOpenAdmin={onOpenAdmin}
      onOpenDashboard={onOpenDashboard}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: '👤 Cashier' }))
  expect(screen.getByRole('menuitem', { name: 'Báo cáo ca' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Quản trị' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }))
  expect(onSignOut).toHaveBeenCalled()
})

it('opens the dashboard from the profile menu', async () => {
  const onOpenDashboard = vi.fn()
  render(
    <ProfileMenu
      displayName="Cashier"
      permissions={[]}
      onSignOut={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenDashboard={onOpenDashboard}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: '👤 Cashier' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Trang chủ' }))
  expect(onOpenDashboard).toHaveBeenCalled()
})

it('opens administration from the permission-aware menu item', async () => {
  const onOpenAdmin = vi.fn()
  render(
    <ProfileMenu
      displayName="Admin"
      permissions={['perm.access_admin_panel']}
      onSignOut={vi.fn()}
      onOpenAdmin={onOpenAdmin}
      onOpenDashboard={vi.fn()}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: '👤 Admin' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Quản trị' }))

  expect(onOpenAdmin).toHaveBeenCalled()
})

it('closes on Escape', async () => {
  render(
    <ProfileMenu
      displayName="Cashier"
      permissions={[]}
      onSignOut={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenDashboard={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '👤 Cashier' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
