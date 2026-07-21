import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoundationAdminPage } from './FoundationAdminPage'
import type { FoundationService } from '../users/foundation-service'
import { ApiError } from '../../lib/api/client'

function makeService(overrides: Partial<FoundationService> = {}): FoundationService {
  return {
    getMe: vi.fn(),
    updateCurrentUserProfile: vi.fn(),
    signOutCurrentUserDevice: vi.fn(async () => []),
    listUsers: vi.fn(async () => ({
      total: 1,
      items: [
        {
          id: 'u-1',
          email: 'admin@example.test',
          username: 'admin',
          phone: '0947900909',
          display_name: 'Admin',
          status: 'active' as const,
          permissions: ['perm.manage_users' as const, 'perm.create_order' as const],
        },
      ],
    })),
    listPermissions: vi.fn(async () => [
      { code: 'perm.manage_users' as const, module: 'administration', description: 'Manage users' },
      { code: 'perm.create_order' as const, module: 'sales', description: 'Create sales orders' },
      { code: 'perm.apply_discount' as const, module: 'sales', description: 'Apply discounts' },
      { code: 'perm.edit_price_book' as const, module: 'catalog', description: 'Edit price book' },
      { code: 'perm.manage_inventory' as const, module: 'inventory', description: 'Manage inventory' },
      { code: 'perm.manage_finance' as const, module: 'finance', description: 'Manage finance' },
      { code: 'perm.view_shift_report' as const, module: 'reports', description: 'View reports' },
    ]),
    createUser: vi.fn(async () => ({
      id: 'u-2',
      email: 'cashier@example.test',
      username: 'cashier-login',
      phone: '0912345678',
      display_name: 'Cashier',
      status: 'active' as const,
      permissions: ['perm.create_order' as const],
    })),
    updateUser: vi.fn(async () => ({
      id: 'u-1',
      email: 'admin@example.test',
      username: 'admin',
      phone: '0947900909',
      display_name: 'Admin',
      status: 'inactive' as const,
      permissions: ['perm.manage_users' as const, 'perm.create_order' as const],
    })),
    replaceUserPermissions: vi.fn(async () => ({
      id: 'u-1',
      email: 'admin@example.test',
      username: 'admin',
      phone: '0947900909',
      display_name: 'Admin',
      status: 'active' as const,
      permissions: ['perm.manage_users' as const],
    })),
    getOrganizationBillSettings: vi.fn(async () => ({
      shop_name: 'QCVL',
      shop_address: 'Xưởng in và thi công quảng cáo',
      shop_phone: '',
      default_bill_template: 'a4' as const,
      invoice_title: 'HÓA ĐƠN BÁN HÀNG',
      quote_title: 'BÁO GIÁ',
      footer_note: '',
      show_product_code: true,
      show_unit: true,
      show_discount: true,
      logo_data_url: null,
    })),
    updateOrganizationBillSettings: vi.fn(async (input) => ({
      shop_name: input.shop_name ?? 'QCVL',
      shop_address: input.shop_address ?? 'Xưởng in và thi công quảng cáo',
      shop_phone: input.shop_phone ?? '',
      default_bill_template: input.default_bill_template ?? ('a4' as const),
      invoice_title: input.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG',
      quote_title: input.quote_title ?? 'BÁO GIÁ',
      footer_note: input.footer_note ?? '',
      show_product_code: input.show_product_code ?? true,
      show_unit: input.show_unit ?? true,
      show_discount: input.show_discount ?? true,
      logo_data_url: input.logo_data_url !== undefined ? input.logo_data_url : null,
    })),
    ...overrides,
  }
}

function expectInlineErrorIcon(form: HTMLElement, fieldName: string) {
  const field = within(form).getByRole('textbox', { name: fieldName })
  expect(field.closest('label')?.querySelector('.admin-user-field-error-icon')).toHaveTextContent('!')
}

function expectNoInlineErrorIcon(form: HTMLElement, fieldName: string) {
  const field = within(form).getByRole('textbox', { name: fieldName })
  expect(field.closest('label')?.querySelector('.admin-user-field-error-icon')).toBeNull()
}

it('loads user and permission administration data from the API service', async () => {
  render(<FoundationAdminPage service={makeService()} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải dữ liệu quản trị...').closest('.management-main')).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Quản trị nền tảng' })).not.toBeInTheDocument()
  expect(screen.queryByText('Người dùng và danh mục quyền')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()
  expect(await screen.findByRole('tab', { name: 'Tài khoản người dùng' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Tài khoản người dùng' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Quản lý vai trò' })).toHaveAttribute('aria-selected', 'false')
  expect(screen.getByRole('main')).toHaveClass('management-page')
  expect(screen.getByRole('heading', { name: 'Thiết lập' }).closest('.management-page-header')).not.toBeNull()
  const sidebar = screen.getByRole('navigation', { name: 'Menu thiết lập' })
  expect(sidebar).toHaveClass('admin-settings-menu')
  expect(within(sidebar).getByPlaceholderText('Tìm kiếm thiết lập')).toBeInTheDocument()
  expect(within(sidebar).getByRole('button', { name: 'Quản lý người dùng' })).toHaveAttribute('aria-current', 'page')
  expect(within(sidebar).getByRole('heading', { name: 'Cửa hàng' })).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: 'Tài khoản người dùng' })).toHaveClass('management-list-surface')
  expect(document.querySelector('.admin-grid')).toBeNull()
  expect(document.querySelector('.admin-form')).toBeNull()
  const userSearch = screen.getByRole('search', { name: 'Lọc người dùng' })
  expect(userSearch).toBeInTheDocument()
  expect(within(userSearch).getByRole('textbox', { name: 'Tìm người dùng' })).toHaveAttribute(
    'placeholder',
    'Tìm tên, email, điện thoại',
  )
  expect(within(userSearch).getByRole('button', { name: 'Tạo người dùng' })).toHaveClass(
    'management-compact-create-action',
  )
  expect(screen.queryByRole('button', { name: 'Tạo tài khoản' })).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Tạo người dùng' })).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Tài khoản người dùng' }).closest('.management-page-actions')).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Máy trạm' })).not.toBeInTheDocument()
  expect(screen.queryByText('POS-01')).not.toBeInTheDocument()
  expect(screen.getByText('admin')).toBeInTheDocument()
  expect(screen.getByText('0947900909')).toBeInTheDocument()
  expect(screen.getByText('Quản trị')).toBeInTheDocument()
  expect(screen.getByText('Đã hoạt động')).toBeInTheDocument()
  expect(screen.getByText('admin').closest('.management-table-viewport')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Mở quyền Admin' })).toHaveClass('management-row-action')
  expect(screen.getByRole('button', { name: 'Ngừng hoạt động Admin' })).toHaveClass('management-row-action')
  expect(screen.getByRole('navigation', { name: 'Phân trang người dùng' })).toHaveClass('management-table-footer')
  await userEvent.click(screen.getByRole('tab', { name: 'Quản lý vai trò' }))
  expect(screen.getByRole('region', { name: 'Quản lý vai trò' })).toHaveClass('management-list-surface')
  expect(screen.getByRole('button', { name: 'Tạo vai trò' })).toHaveClass('button-secondary')
  expect(screen.getByRole('columnheader', { name: 'Tên vai trò' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Mô tả' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Số tài khoản' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument()
  expect(screen.getByText('Quản trị')).toBeInTheDocument()
  expect(screen.getByText('Nhân viên thu ngân')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Phân trang vai trò' })).toHaveClass('management-table-footer')
  await userEvent.click(screen.getByRole('button', { name: 'Mở quyền vai trò Quản trị' }))
  const roleDetail = screen.getByRole('region', { name: 'Quyền vai trò Quản trị' })
  expect(roleDetail).toHaveClass('management-inline-detail')
  expect(within(roleDetail).getByRole('heading', { name: 'Thiết lập' })).toBeInTheDocument()
  expect(within(roleDetail).getByRole('checkbox', { name: 'Quản lý người dùng' })).toBeChecked()
})

it('sorts admin user and role tables from shared column headers', async () => {
  const service = makeService({
    listUsers: vi.fn(async () => ({
      total: 2,
      items: [
        {
          id: 'u-2',
          email: 'cashier@example.test',
          username: 'cashier',
          phone: '0912345678',
          display_name: 'Cashier',
          status: 'active' as const,
          permissions: ['perm.create_order' as const],
        },
        {
          id: 'u-1',
          email: 'admin@example.test',
          username: 'admin',
          phone: '0947900909',
          display_name: 'Admin',
          status: 'active' as const,
          permissions: ['perm.manage_users' as const],
        },
      ],
    })),
  })
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('Cashier')
  const userTable = screen.getByText('Cashier').closest('table') as HTMLTableElement
  expect(within(userTable).getAllByRole('row')[1]).toHaveTextContent('Cashier')

  await userEvent.click(within(userTable).getByRole('button', { name: 'Tên hiển thị' }))

  expect(within(userTable).getAllByRole('row')[1]).toHaveTextContent('Admin')
  expect(within(userTable).getByRole('columnheader', { name: 'Tên hiển thị' })).toHaveAttribute('aria-sort', 'ascending')

  await userEvent.click(screen.getByRole('tab', { name: 'Quản lý vai trò' }))
  const roleTable = screen.getByText('Nhân viên thu ngân').closest('table') as HTMLTableElement
  await userEvent.click(within(roleTable).getByRole('button', { name: 'Số tài khoản' }))

  expect(within(roleTable).getAllByRole('row')[1]).toHaveTextContent('Quản trị')
  expect(within(roleTable).getByRole('columnheader', { name: 'Số tài khoản' })).toHaveAttribute('aria-sort', 'descending')
})

it('shows an error when admin data cannot be loaded', async () => {
  render(
    <FoundationAdminPage
      service={makeService({
        listUsers: vi.fn(async () => {
          throw new Error('boom')
        }),
      })}
      onOpenDashboard={vi.fn()}
    />,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dữ liệu quản trị.')
})

it('maps API errors to operator-facing messages', async () => {
  render(
    <FoundationAdminPage
      service={makeService({
        createUser: vi.fn(async () => {
          throw new ApiError(409, 'RESOURCE_CONFLICT', 'Conflict', 'trace-1')
        }),
      })}
      onOpenDashboard={vi.fn()}
    />,
  )

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })
  expect(screen.getByRole('dialog', { name: 'Tạo tài khoản' })).toHaveClass('management-modal-dialog')
  expect(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' })).toBeInTheDocument()
  expect(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' })).toBeInTheDocument()
  expect(within(createUserForm).getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
  expect(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' })).toBeInTheDocument()
  expect(within(createUserForm).getByRole('combobox', { name: 'Vai trò' })).toBeInTheDocument()
  expect(within(createUserForm).getByRole('button', { name: 'Thông tin khác' })).toHaveAttribute('aria-expanded', 'false')
  expect(within(createUserForm).queryByRole('button', { name: 'Ghi chú' })).not.toBeInTheDocument()
  expect(within(createUserForm).queryByLabelText('Sinh nhật')).not.toBeInTheDocument()
  expect(within(createUserForm).queryByRole('textbox', { name: 'Ghi chú' })).not.toBeInTheDocument()

  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Thông tin khác' }))
  expect(within(createUserForm).getByRole('button', { name: 'Thông tin khác' })).toHaveAttribute('aria-expanded', 'true')
  expect(within(createUserForm).getByLabelText('Sinh nhật')).toBeInTheDocument()
  expect(within(createUserForm).getByRole('textbox', { name: 'Địa chỉ' })).toHaveAttribute(
    'placeholder',
    'Nhập địa chỉ',
  )
  expect(within(createUserForm).getByRole('textbox', { name: 'Khu vực' })).toHaveAttribute(
    'placeholder',
    'Chọn Tỉnh/Thành phố',
  )
  expect(within(createUserForm).getByRole('textbox', { name: 'Phường/Xã' })).toHaveAttribute(
    'placeholder',
    'Chọn Phường/Xã',
  )
  expect(within(createUserForm).getByRole('textbox', { name: 'Ghi chú' })).toHaveAttribute(
    'placeholder',
    'Nhập ghi chú',
  )
  await userEvent.type(createUserForm.querySelector('input[type="email"]') as HTMLInputElement, 'admin@example.test')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Admin')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0912345678')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' }), 'admin-login')
  await userEvent.type(createUserForm.querySelector('input[type="password"]') as HTMLInputElement, 'Password123!')
  await userEvent.type(within(createUserForm).getByLabelText('Nhập lại mật khẩu'), 'Password123!')
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Dữ liệu đã tồn tại hoặc xung đột với bản ghi hiện có.',
  )
})

it('blocks creating a user when required fields are missing', async () => {
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })
  expect(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' })).toHaveFocus()

  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))

  expect(service.createUser).not.toHaveBeenCalled()
  expect(await within(createUserForm).findByRole('alert')).toHaveTextContent('Vui lòng nhập đủ các trường bắt buộc.')
  expect(within(createUserForm).getByText('Tên hiển thị là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).getByText('SĐT là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).getByText('Tên đăng nhập là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).getByText('Mật khẩu là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).getByText('Nhập lại mật khẩu là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).queryByText('Email là bắt buộc.')).not.toBeInTheDocument()
  expectInlineErrorIcon(createUserForm, 'Tên hiển thị')
  expectInlineErrorIcon(createUserForm, 'Điện thoại')
  expectNoInlineErrorIcon(createUserForm, 'Email')
})

it('creates a user when optional email is empty', async () => {
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })

  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Cashier')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0912345678')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' }), 'cashier-login')
  await userEvent.type(createUserForm.querySelector('input[type="password"]') as HTMLInputElement, 'Password123!')
  await userEvent.type(within(createUserForm).getByLabelText('Nhập lại mật khẩu'), 'Password123!')
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))

  expect(service.createUser).toHaveBeenCalledWith({
    email: null,
    username: 'cashier-login',
    phone: '0912345678',
    birthday: null,
    address: null,
    region: null,
    ward: null,
    note: null,
    password: 'Password123!',
    display_name: 'Cashier',
    permissions: ['perm.create_order', 'perm.apply_discount', 'perm.view_shift_report'],
  })
})

it('includes admin panel access when creating an admin role user', async () => {
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })

  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Admin 2')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0900000001')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' }), 'admin-2')
  await userEvent.type(createUserForm.querySelector('input[type="password"]') as HTMLInputElement, 'Password123!')
  await userEvent.type(within(createUserForm).getByLabelText('Nhập lại mật khẩu'), 'Password123!')
  await userEvent.selectOptions(within(createUserForm).getByRole('combobox', { name: 'Vai trò' }), 'admin')
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))

  expect(service.createUser).toHaveBeenCalledWith(expect.objectContaining({
    permissions: expect.arrayContaining(['perm.access_admin_panel', 'perm.manage_users']),
  }))
})

it('opens the account form from the edit action and saves profile changes without requiring a password', async () => {
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Sửa Admin' }))
  const editUserForm = screen.getByRole('form', { name: 'Sửa người dùng' })

  expect(screen.getByRole('dialog', { name: 'Sửa tài khoản' })).toBeInTheDocument()
  expect(within(editUserForm).getByRole('textbox', { name: 'Tên hiển thị' })).toHaveValue('Admin')
  expect(within(editUserForm).getByRole('textbox', { name: 'Điện thoại' })).toHaveValue('0947900909')
  expect(within(editUserForm).getByRole('textbox', { name: 'Email' })).toHaveValue('admin@example.test')
  expect(within(editUserForm).getByRole('textbox', { name: 'Tên đăng nhập' })).toHaveValue('admin')
  expect(editUserForm.querySelector('input[type="password"]')).toHaveValue('')

  await userEvent.clear(within(editUserForm).getByRole('textbox', { name: 'Tên hiển thị' }))
  await userEvent.type(within(editUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Admin Updated')
  await userEvent.clear(within(editUserForm).getByRole('textbox', { name: 'Điện thoại' }))
  await userEvent.type(within(editUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0900000000')
  await userEvent.selectOptions(within(editUserForm).getByRole('combobox', { name: 'Vai trò' }), 'accountant')
  await userEvent.click(within(editUserForm).getByRole('button', { name: 'Lưu' }))

  expect(service.updateUser).toHaveBeenCalledWith('u-1', {
    email: 'admin@example.test',
    username: 'admin',
    phone: '0900000000',
    birthday: null,
    address: null,
    region: null,
    ward: null,
    note: null,
    display_name: 'Admin Updated',
  })
  expect(service.replaceUserPermissions).toHaveBeenCalledWith('u-1', ['perm.manage_finance'])
  expect(screen.queryByRole('dialog', { name: 'Sửa tài khoản' })).not.toBeInTheDocument()
})

it('saves display name edits for existing users with an empty phone number', async () => {
  const service = makeService({
    listUsers: vi.fn(async () => ({
      total: 1,
      items: [
        {
          id: 'u-1',
          email: 'admin@qc-oms.local',
          username: 'admin',
          phone: null,
          display_name: 'Admin',
          status: 'active' as const,
          permissions: ['perm.manage_users' as const],
        },
      ],
    })),
  })
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Sửa Admin' }))
  const editUserForm = screen.getByRole('form', { name: 'Sửa người dùng' })

  await userEvent.clear(within(editUserForm).getByRole('textbox', { name: 'Tên hiển thị' }))
  await userEvent.type(within(editUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Phạm Nhật Linh')
  await userEvent.click(within(editUserForm).getByRole('button', { name: 'Lưu' }))

  expect(service.updateUser).toHaveBeenCalledWith('u-1', expect.objectContaining({
    display_name: 'Phạm Nhật Linh',
    phone: null,
  }))
  expect(screen.queryByText('SĐT là bắt buộc.')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Sửa tài khoản' })).not.toBeInTheDocument()
})

it('shows backend validation errors on the matching create-user field', async () => {
  const service = makeService({
    createUser: vi.fn(async () => {
      throw new ApiError(400, 'VALIDATION_ERROR', 'phone is required.', 'trace-1', {
        phone: ['phone is required.'],
      })
    }),
  })
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })

  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), 'Cashier')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0912345678')
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' }), 'cashier-login')
  await userEvent.type(createUserForm.querySelector('input[type="password"]') as HTMLInputElement, 'Password123!')
  await userEvent.type(within(createUserForm).getByLabelText('Nhập lại mật khẩu'), 'Password123!')
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))

  expect(await within(createUserForm).findByRole('alert')).toHaveTextContent('Vui lòng kiểm tra lại SĐT.')
  expect(within(createUserForm).getByText('SĐT là bắt buộc.')).toBeInTheDocument()
  expect(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' })).toHaveAttribute('aria-invalid', 'true')
  expectInlineErrorIcon(createUserForm, 'Điện thoại')

  await userEvent.clear(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }))
  await userEvent.type(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), '0900000000')

  expect(within(createUserForm).queryByText('SĐT là bắt buộc.')).not.toBeInTheDocument()
  expectNoInlineErrorIcon(createUserForm, 'Điện thoại')
  expect(within(createUserForm).queryByRole('alert')).not.toBeInTheDocument()
})

it('creates, disables, and updates permissions for users', async () => {
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('admin')
  const userFilter = screen.getByRole('search', { name: 'Lọc người dùng' })
  await userEvent.type(within(userFilter).getByRole('textbox', { name: 'Tìm người dùng' }), 'Admin')
  await userEvent.selectOptions(within(userFilter).getByRole('combobox', { name: 'Trạng thái' }), 'active')
  await waitFor(() => expect(service.listUsers).toHaveBeenCalledWith({ search: 'Admin', status: 'active' }))
  expect(within(userFilter).queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  await userEvent.click(userFilter.querySelector('.management-compact-create-action-clear') as HTMLButtonElement)
  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const createUserForm = screen.getByRole('form', { name: 'Tạo người dùng' })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Tên hiển thị' }), {
    target: { value: 'Cashier' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Điện thoại' }), {
    target: { value: '0912345678' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Email' }), {
    target: { value: 'cashier@example.test' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Tên đăng nhập' }), {
    target: { value: 'cashier-login' },
  })
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Thông tin khác' }))
  fireEvent.change(within(createUserForm).getByLabelText('Sinh nhật'), { target: { value: '2026-07-07' } })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Địa chỉ' }), {
    target: { value: '12 Nguyen Trai' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Khu vực' }), {
    target: { value: 'TP Hồ Chí Minh' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Phường/Xã' }), {
    target: { value: 'Phường Bến Thành' },
  })
  fireEvent.change(within(createUserForm).getByRole('textbox', { name: 'Ghi chú' }), {
    target: { value: 'Ca tối' },
  })
  fireEvent.change(createUserForm.querySelector('input[type="password"]') as HTMLInputElement, {
    target: { value: 'Password123!' },
  })
  fireEvent.change(within(createUserForm).getByLabelText('Nhập lại mật khẩu'), {
    target: { value: 'Password123!' },
  })
  await userEvent.selectOptions(within(createUserForm).getByRole('combobox', { name: 'Vai trò' }), 'cashier')
  await userEvent.click(within(createUserForm).getByRole('button', { name: 'Lưu' }))
  expect(service.createUser).toHaveBeenCalledWith({
    email: 'cashier@example.test',
    username: 'cashier-login',
    phone: '0912345678',
    birthday: '2026-07-07',
    address: '12 Nguyen Trai',
    region: 'TP Hồ Chí Minh',
    ward: 'Phường Bến Thành',
    note: 'Ca tối',
    password: 'Password123!',
    display_name: 'Cashier',
    permissions: ['perm.create_order', 'perm.apply_discount', 'perm.view_shift_report'],
  })

  await userEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }))
  const mismatchForm = screen.getByRole('form', { name: 'Tạo người dùng' })
  fireEvent.change(within(mismatchForm).getByRole('textbox', { name: 'Tên hiển thị' }), {
    target: { value: 'Cashier 2' },
  })
  fireEvent.change(within(mismatchForm).getByRole('textbox', { name: 'Email' }), {
    target: { value: 'cashier2@example.test' },
  })
  fireEvent.change(within(mismatchForm).getByRole('textbox', { name: 'Điện thoại' }), {
    target: { value: '0912345679' },
  })
  fireEvent.change(within(mismatchForm).getByRole('textbox', { name: 'Tên đăng nhập' }), {
    target: { value: 'cashier-2' },
  })
  fireEvent.change(mismatchForm.querySelector('input[type="password"]') as HTMLInputElement, {
    target: { value: 'Password123!' },
  })
  fireEvent.change(within(mismatchForm).getByLabelText('Nhập lại mật khẩu'), {
    target: { value: 'Password456!' },
  })
  await userEvent.click(within(mismatchForm).getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu nhập lại không khớp.')

  await userEvent.click(screen.getByRole('button', { name: 'Ngừng hoạt động Admin' }))
  expect(service.updateUser).toHaveBeenCalledWith('u-1', { status: 'inactive' })

  await userEvent.click(screen.getByRole('button', { name: 'Mở quyền Admin' }))
  expect(screen.getByRole('region', { name: 'Quyền người dùng Admin' })).toHaveClass('management-inline-detail')
  expect(screen.queryByRole('region', { name: 'Quyền người dùng' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Tạo đơn bán hàng' }))
  expect(service.replaceUserPermissions).toHaveBeenCalledWith('u-1', ['perm.manage_users'])
})

it('creates a temporary role from the role modal with grouped permissions', async () => {
  render(<FoundationAdminPage service={makeService()} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('tab', { name: 'Tài khoản người dùng' })
  await userEvent.click(screen.getByRole('tab', { name: 'Quản lý vai trò' }))
  await userEvent.click(screen.getByRole('button', { name: 'Tạo vai trò' }))

  const dialog = screen.getByRole('dialog', { name: 'Tạo vai trò' })
  expect(dialog).toHaveClass('management-modal-dialog')
  expect(within(dialog).getByRole('textbox', { name: 'Tên vai trò' })).toHaveAttribute('placeholder', 'Nhập tên vai trò')
  expect(within(dialog).getByRole('textbox', { name: 'Mô tả' })).toHaveAttribute('placeholder', 'Nhập mô tả')
  expect(within(dialog).getByRole('heading', { name: 'Bán hàng' })).toBeInTheDocument()

  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Tên vai trò' }), 'Thu ngân ca tối')
  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), 'Bán hàng cuối ngày')
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Tạo đơn bán hàng' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

  expect(screen.queryByRole('dialog', { name: 'Tạo vai trò' })).not.toBeInTheDocument()
  expect(screen.getByText('Thu ngân ca tối')).toBeInTheDocument()
  expect(screen.getByText('Bán hàng cuối ngày')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mở quyền vai trò Thu ngân ca tối' }))
  expect(screen.getByRole('checkbox', { name: 'Tạo đơn bán hàng' })).toBeChecked()
})

it('saves shop info and default bill template from Thiết lập panels', async () => {
  window.localStorage.clear()
  const service = makeService()
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  const sidebar = await screen.findByRole('navigation', { name: 'Menu thiết lập' })
  await userEvent.click(within(sidebar).getByRole('button', { name: 'Thông tin cửa hàng' }))

  const shopPanel = await screen.findByRole('region', { name: 'Thông tin cửa hàng' })
  expect(within(sidebar).getByRole('button', { name: 'Thông tin cửa hàng' })).toHaveAttribute('aria-current', 'page')
  await waitFor(() => expect(service.getOrganizationBillSettings).toHaveBeenCalled())
  await userEvent.clear(within(shopPanel).getByRole('textbox', { name: /Tên cửa hàng/ }))
  await userEvent.type(within(shopPanel).getByRole('textbox', { name: /Tên cửa hàng/ }), 'In ảnh Văn Lâm')
  await userEvent.clear(within(shopPanel).getByRole('textbox', { name: 'Địa chỉ' }))
  await userEvent.type(within(shopPanel).getByRole('textbox', { name: 'Địa chỉ' }), '12 Nguyễn Trãi')
  await userEvent.clear(within(shopPanel).getByRole('textbox', { name: 'Điện thoại' }))
  await userEvent.type(within(shopPanel).getByRole('textbox', { name: 'Điện thoại' }), '0909111222')
  await userEvent.click(within(shopPanel).getByRole('button', { name: 'Lưu thông tin cửa hàng' }))
  await waitFor(() =>
    expect(service.updateOrganizationBillSettings).toHaveBeenCalledWith({
      shop_name: 'In ảnh Văn Lâm',
      shop_address: '12 Nguyễn Trãi',
      shop_phone: '0909111222',
    }),
  )
  expect(await within(shopPanel).findByRole('status')).toHaveTextContent('Đã lưu cấu hình bill lên server')
  expect(within(shopPanel).getByRole('complementary', { name: 'Xem trước đầu bill' })).toHaveTextContent('In ảnh Văn Lâm')

  await userEvent.click(within(sidebar).getByRole('button', { name: 'Quản lý mẫu in' }))
  const templatePanel = await screen.findByRole('region', { name: 'Quản lý mẫu in' })
  await userEvent.click(within(templatePanel).getByRole('radio', { name: /K80 \(nhiệt\)/ }))
  await userEvent.clear(within(templatePanel).getByRole('textbox', { name: 'Tiêu đề hóa đơn' }))
  await userEvent.type(within(templatePanel).getByRole('textbox', { name: 'Tiêu đề hóa đơn' }), 'PHIẾU BÁN HÀNG')
  await userEvent.click(within(templatePanel).getByRole('checkbox', { name: 'Hiện mã hàng' }))
  await userEvent.click(within(templatePanel).getByRole('button', { name: 'Lưu mẫu in' }))
  await waitFor(() =>
    expect(service.updateOrganizationBillSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        default_bill_template: 'k80',
        invoice_title: 'PHIẾU BÁN HÀNG',
        show_product_code: false,
      }),
    ),
  )
})

it('shows a clear cache notice when bill settings API is missing', async () => {
  window.localStorage.clear()
  const service = makeService({
    getOrganizationBillSettings: vi.fn(async () => {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'missing', 'trace-1')
    }),
  })
  render(<FoundationAdminPage service={service} onOpenDashboard={vi.fn()} />)

  const sidebar = await screen.findByRole('navigation', { name: 'Menu thiết lập' })
  await userEvent.click(within(sidebar).getByRole('button', { name: 'Quản lý mẫu in' }))
  const templatePanel = await screen.findByRole('region', { name: 'Quản lý mẫu in' })

  expect(await within(templatePanel).findByRole('alert')).toHaveTextContent(
    /Không tải được cấu hình bill từ server\. Đang dùng bản máy này/,
  )
  expect(within(templatePanel).getByRole('heading', { name: 'Quản lý mẫu in' })).toBeInTheDocument()
  expect(within(templatePanel).getByRole('radio', { name: /A4/ })).toBeChecked()
})
