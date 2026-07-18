import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AccountPage } from './AccountPage'
import type { CurrentUserData } from '../../lib/api/types'

const currentUser: CurrentUserData = {
  user: { id: 'u-1', email: 'advvanlam@gmail.com', display_name: 'Văn Viết Phương Lâm' },
  organization: { id: 'o-1', code: 'QC', name: 'QC OMS' },
  workstation: { id: 'w-1', code: 'POS01', name: 'Quầy bán hàng' },
  permissions: ['perm.access_admin_panel'],
}

const currentUserWithProfile: CurrentUserData = {
  ...currentUser,
  profile: {
    username: '0947900909',
    phone: '0947900909',
    email: 'advvanlam@gmail.com',
    birthday: '1990-01-31',
    region: 'TP Hồ Chí Minh',
    ward: 'Phường Bến Nghé',
    address: '1 Lê Lợi',
    note: 'Khách nội bộ',
  },
}

const currentUserWithDevices: CurrentUserData = {
  ...currentUserWithProfile,
  devices: [
    {
      id: 'device-1',
      device_name: 'MacBook Pro',
      device_type: 'desktop',
      browser_name: 'Chrome',
      os_name: 'macOS',
      ip_address: '203.0.113.10',
      last_seen_at: '2026-07-06T14:00:00Z',
      created_at: '2026-07-06T13:00:00Z',
      is_current_device: true,
      status: 'active',
    },
    {
      id: 'device-2',
      device_name: 'Windows PC',
      device_type: 'desktop',
      browser_name: 'Edge',
      os_name: 'Windows',
      ip_address: '203.0.113.20',
      last_seen_at: '2026-07-06T13:00:00Z',
      created_at: '2026-07-06T12:00:00Z',
      is_current_device: false,
      status: 'active',
    },
  ],
}

it('renders account management cards from the current user profile', () => {
  render(<AccountPage currentUser={currentUser} />)

  expect(screen.getByRole('main')).toHaveClass('management-page', 'account-page')
  expect(screen.getByRole('heading', { name: 'Tài khoản' })).toBeInTheDocument()

  const userCard = screen.getByRole('region', { name: 'Thông tin người dùng' })
  expect(within(userCard).getByRole('heading', { name: 'Thông tin người dùng' })).toBeInTheDocument()
  expect(within(userCard).getByRole('button', { name: 'Sửa thông tin người dùng' })).toHaveClass('button-secondary')
  expect(within(userCard).getByText('Văn Viết Phương Lâm')).toBeInTheDocument()
  expect(within(userCard).getByText('Điện thoại')).toBeInTheDocument()
  expect(within(userCard).getByText('Địa chỉ')).toBeInTheDocument()
  expect(within(userCard).getByText('Sinh nhật')).toBeInTheDocument()
  const profileValues = Array.from(userCard.querySelectorAll('dd')).map((item) => item.textContent?.trim() ?? '')
  expect(profileValues.filter((value) => value === '')).toHaveLength(3)
  expect(within(userCard).getAllByText('advvanlam@gmail.com', { selector: 'dd' })).toHaveLength(2)
  expect(within(userCard).getByText('Admin')).toBeInTheDocument()
  expect(within(userCard).queryByText('Chưa có ghi chú')).not.toBeInTheDocument()
  expect(within(userCard).queryByText('0947900909')).not.toBeInTheDocument()
  expect(within(userCard).queryByText('u-1')).not.toBeInTheDocument()
  expect(within(userCard).queryByText('QC OMS')).not.toBeInTheDocument()
  expect(within(userCard).queryByText('Quầy bán hàng')).not.toBeInTheDocument()

  const securityCard = screen.getByRole('region', { name: 'Đăng nhập và bảo mật' })
  expect(within(securityCard).getByText('Mật khẩu')).toBeInTheDocument()
  expect(within(securityCard).getByRole('button', { name: 'Đổi mật khẩu' })).toHaveClass('button-secondary')
  expect(within(securityCard).getByText('Chưa có dữ liệu xác thực 2 lớp')).toBeInTheDocument()
  expect(within(securityCard).queryByRole('switch', { name: 'Xác thực 2 lớp' })).not.toBeInTheDocument()

  const devicesCard = screen.getByRole('region', { name: 'Các thiết bị đã đăng nhập' })
  expect(within(devicesCard).getByText('Chưa có dữ liệu thiết bị đăng nhập')).toBeInTheDocument()
  expect(within(devicesCard).queryByText('Máy tính Mac OS')).not.toBeInTheDocument()
  expect(within(devicesCard).queryByRole('button', { name: /Kiểm tra/ })).not.toBeInTheDocument()
})

it('renders real signed-in devices on the account page', () => {
  render(<AccountPage currentUser={currentUserWithDevices} />)

  const devicesCard = screen.getByRole('region', { name: 'Các thiết bị đã đăng nhập' })
  expect(within(devicesCard).getByText('MacBook Pro')).toBeInTheDocument()
  expect(within(devicesCard).getByText('Đang dùng')).toBeInTheDocument()
  expect(within(devicesCard).getByText('Chrome • macOS • 203.0.113.10')).toBeInTheDocument()
  expect(within(devicesCard).getByText('Hoạt động gần nhất: 06/07/2026 14:00')).toBeInTheDocument()
  expect(within(devicesCard).getByRole('button', { name: 'Thiết bị này' })).toBeDisabled()
  expect(within(devicesCard).getByRole('button', { name: 'Đăng xuất' })).toBeEnabled()
  expect(within(devicesCard).queryByText('Chưa có dữ liệu thiết bị đăng nhập')).not.toBeInTheDocument()
})

it('signs out another device through the account handler', async () => {
  const onSignOutDevice = vi.fn().mockResolvedValue(undefined)
  render(<AccountPage currentUser={currentUserWithDevices} onSignOutDevice={onSignOutDevice} />)

  const devicesCard = screen.getByRole('region', { name: 'Các thiết bị đã đăng nhập' })
  await userEvent.click(within(devicesCard).getByRole('button', { name: 'Đăng xuất' }))

  expect(onSignOutDevice).toHaveBeenCalledWith('device-2')
})

it('opens the account edit dialog with real profile values and empty missing fields', async () => {
  render(<AccountPage currentUser={currentUser} />)

  await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin người dùng' }))

  const dialog = screen.getByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })
  expect(dialog).toHaveClass('management-modal-dialog', 'account-edit-dialog')
  expect(dialog.closest('.management-modal-backdrop')).toBeInTheDocument()

  expect(within(dialog).getByLabelText('Tên hiển thị')).toHaveValue('Văn Viết Phương Lâm')
  expect(within(dialog).getByLabelText('Tên đăng nhập')).toHaveValue('advvanlam@gmail.com')
  expect(within(dialog).getByLabelText('Vai trò')).toHaveValue('Admin')
  expect(within(dialog).getByLabelText('Vai trò')).toHaveAttribute('readonly')
  expect(within(dialog).getByLabelText('Điện thoại')).toHaveValue('')
  expect(within(dialog).getByLabelText('Điện thoại')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByLabelText('Email')).toHaveValue('advvanlam@gmail.com')
  expect(within(dialog).getByLabelText('Sinh nhật')).toHaveValue('')
  expect(within(dialog).getByLabelText('Sinh nhật')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByLabelText('Khu vực')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByLabelText('Phường/Xã')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByLabelText('Địa chỉ')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByLabelText('Ghi chú')).not.toHaveAttribute('placeholder')
  expect(within(dialog).getByRole('button', { name: 'Đóng popup sửa thông tin' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Hủy' })).toHaveClass('button-secondary')
  expect(within(dialog).getByRole('button', { name: 'Lưu' })).toHaveClass('button-primary')

  await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }))
  expect(screen.queryByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })).not.toBeInTheDocument()
})

it('saves editable profile fields through the account profile handler', async () => {
  const onSaveProfile = vi.fn().mockResolvedValue(undefined)
  render(<AccountPage currentUser={currentUserWithProfile} onSaveProfile={onSaveProfile} />)

  const userCard = screen.getByRole('region', { name: 'Thông tin người dùng' })
  expect(within(userCard).getAllByText('0947900909')).toHaveLength(2)
  expect(within(userCard).getByText('1 Lê Lợi')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin người dùng' }))
  const dialog = screen.getByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })
  expect(within(dialog).getByLabelText('Tên đăng nhập')).toHaveValue('0947900909')
  expect(within(dialog).getByLabelText('Điện thoại')).toHaveValue('0947900909')
  expect(within(dialog).getByLabelText('Sinh nhật')).toHaveValue('1990-01-31')
  expect(within(dialog).getByLabelText('Ghi chú')).toHaveValue('Khách nội bộ')

  await userEvent.clear(within(dialog).getByLabelText('Tên hiển thị'))
  await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Văn Lâm')
  await userEvent.clear(within(dialog).getByLabelText('Phường/Xã'))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

  expect(onSaveProfile).toHaveBeenCalledWith({
    display_name: 'Văn Lâm',
    username: '0947900909',
    phone: '0947900909',
    email: 'advvanlam@gmail.com',
    birthday: '1990-01-31',
    region: 'TP Hồ Chí Minh',
    ward: null,
    address: '1 Lê Lợi',
    note: 'Khách nội bộ',
  })
  expect(screen.queryByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })).not.toBeInTheDocument()
})

it('keeps the account edit dialog open and shows save errors', async () => {
  const onSaveProfile = vi.fn().mockRejectedValue(new Error('Không tìm thấy API'))
  render(<AccountPage currentUser={currentUserWithProfile} onSaveProfile={onSaveProfile} />)

  await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin người dùng' }))
  const dialog = screen.getByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })

  await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không lưu được: Không tìm thấy API')
  expect(screen.getByRole('dialog', { name: 'Sửa thông tin của Văn Viết Phương Lâm' })).toBeInTheDocument()
})
