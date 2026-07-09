import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, KeyRound, Lock, Search, Settings, Unlock, X } from 'lucide-react'
import type { Permission, UserListItem } from '../users/types'
import type { FoundationService } from '../users/foundation-service'
import { formatApiError } from '../../lib/api/error-message'
import {
  ManagementDetailRow,
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementListSurface,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { permissions } from '../users/permissions'
import {
  adminNullableFormValue,
  findAdminRoleById,
  groupAdminPermissionsByModule,
  permissionDescription,
  permissionTitle,
  userRoleLabel,
  userStatusLabel,
} from './admin-presenter'

interface AdminState {
  users: UserListItem[]
  permissions: Permission[]
}

interface RoleListItem {
  id: string
  name: string
  description: string
  permissions: Permission['code'][]
  status: 'active' | 'inactive'
  userCount: number
}

type UserStatusFilter = 'all' | 'active' | 'inactive'

const internalStaffDefaultPermissions = [
  permissions.createOrder,
  permissions.applyDiscount,
  permissions.editPriceBook,
  permissions.manageInventory,
  permissions.manageFinance,
  permissions.viewShiftReport,
] as const

const roleDefinitions = [
  {
    id: 'admin',
    name: 'Quản trị',
    description: 'Toàn quyền thiết lập người dùng và cấu hình vận hành.',
    permissions: ['perm.manage_users'],
  },
  {
    id: 'cashier',
    name: 'Nhân viên thu ngân',
    description: 'Tạo đơn, áp dụng chiết khấu và thao tác bán hàng tại quầy.',
    permissions: ['perm.create_order', 'perm.apply_discount', 'perm.view_shift_report'],
  },
  {
    id: 'accountant',
    name: 'Kế toán',
    description: 'Theo dõi sổ quỹ, công nợ và dữ liệu tài chính.',
    permissions: ['perm.manage_finance'],
  },
  {
    id: 'inventory-manager',
    name: 'Quản lý kho',
    description: 'Quản lý hàng hóa, bảng giá và tồn kho.',
    permissions: ['perm.manage_inventory', 'perm.edit_price_book'],
  },
] satisfies Array<{
  id: string
  name: string
  description: string
  permissions: Permission['code'][]
}>

export function FoundationAdminPage({
  service,
}: {
  service: FoundationService
  onOpenDashboard: () => void
}) {
  const [state, setState] = useState<AdminState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userForm, setUserForm] = useState({
    displayName: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    passwordConfirmation: '',
    roleId: 'cashier',
    birthday: '',
    address: '',
    region: '',
    ward: '',
    note: '',
  })
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [customRoles, setCustomRoles] = useState<RoleListItem[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] as Permission['code'][] })
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [savingUser, setSavingUser] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState<UserStatusFilter>('all')
  const [lastUserSearch, setLastUserSearch] = useState('')
  const [lastUserStatus, setLastUserStatus] = useState<UserStatusFilter>('all')
  const createUserEmailRef = useRef<HTMLInputElement | null>(null)

  async function load(input: { search?: string; status?: UserStatusFilter } = {}) {
    const search = input.search ?? lastUserSearch
    const status = input.status ?? lastUserStatus
    setError(null)
    try {
      const [users, permissions] = await Promise.all([
        service.listUsers({ search: search.trim() || undefined, status: status === 'all' ? undefined : status }),
        service.listPermissions(),
      ])
      setLastUserSearch(search)
      setLastUserStatus(status)
      setState({ users: users.items, permissions })
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được dữ liệu quản trị.'))
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      setError(null)
      try {
        const [users, permissions] = await Promise.all([service.listUsers({}), service.listPermissions()])
        if (!active) return
        setState({ users: users.items, permissions })
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được dữ liệu quản trị.'))
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [service])

  useEffect(() => {
    if (userDialogOpen) createUserEmailRef.current?.focus()
  }, [userDialogOpen])

  function openUserDialog() {
    setUserForm({
      displayName: '',
      phone: '',
      email: '',
      username: '',
      password: '',
      passwordConfirmation: '',
      roleId: 'cashier',
      birthday: '',
      address: '',
      region: '',
      ward: '',
      note: '',
    })
    setUserDialogOpen(true)
  }

  function closeUserDialog() {
    setUserDialogOpen(false)
  }

  async function filterUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await load({ search: userSearch, status: userStatus })
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (userForm.password !== userForm.passwordConfirmation) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setSavingUser(true)
    setError(null)
    try {
      const role = findAdminRoleById(userForm.roleId, [...roleDefinitions, ...customRoles])
      await service.createUser({
        email: userForm.email,
        username: userForm.username,
        phone: userForm.phone,
        birthday: adminNullableFormValue(userForm.birthday),
        address: adminNullableFormValue(userForm.address),
        region: adminNullableFormValue(userForm.region),
        ward: adminNullableFormValue(userForm.ward),
        note: adminNullableFormValue(userForm.note),
        password: userForm.password,
        display_name: userForm.displayName,
        permissions: role ? role.permissions : [...internalStaffDefaultPermissions],
      })
      await load()
      closeUserDialog()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được người dùng.'))
    } finally {
      setSavingUser(false)
    }
  }

  async function updateUserStatus(user: UserListItem, status: UserListItem['status']) {
    setSavingUser(true)
    setError(null)
    try {
      await service.updateUser(user.id, { status })
      await load()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được người dùng.'))
    } finally {
      setSavingUser(false)
    }
  }

  async function togglePermission(code: Permission['code']) {
    if (!selectedUser) return
    setSavingUser(true)
    setError(null)
    try {
      const permissions = selectedUser.permissions.includes(code)
        ? selectedUser.permissions.filter((permission) => permission !== code)
        : [...selectedUser.permissions, code]
      await service.replaceUserPermissions(selectedUser.id, permissions)
      setSelectedUser({ ...selectedUser, permissions })
      await load()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được quyền người dùng.'))
    } finally {
      setSavingUser(false)
    }
  }

  function openRoleDialog() {
    setRoleForm({ name: '', description: '', permissions: [] })
    setRoleDialogOpen(true)
  }

  function closeRoleDialog() {
    setRoleDialogOpen(false)
  }

  function toggleRoleFormPermission(code: Permission['code']) {
    setRoleForm((current) => ({
      ...current,
      permissions: current.permissions.includes(code)
        ? current.permissions.filter((permission) => permission !== code)
        : [...current.permissions, code],
    }))
  }

  function createTemporaryRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = roleForm.name.trim()
    if (!name) return
    const role: RoleListItem = {
      id: `custom-${Date.now()}`,
      name,
      description: roleForm.description.trim() || 'Chưa có mô tả',
      permissions: roleForm.permissions,
      status: 'active',
      userCount: 0,
    }
    setCustomRoles((current) => [...current, role])
    setSelectedRoleId(null)
    closeRoleDialog()
  }

  const roleRows = useMemo<RoleListItem[]>(() => {
    if (!state) return []
    const builtInRoles = roleDefinitions.map((role) => ({
      ...role,
      status: 'active' as const,
      userCount: state.users.filter((user) => userRoleLabel(user) === role.name).length,
    }))
    return [...builtInRoles, ...customRoles]
  }, [customRoles, state])
  const selectedRole = roleRows.find((role) => role.id === selectedRoleId) ?? null
  const permissionsByModule = useMemo(() => groupAdminPermissionsByModule(state?.permissions ?? []), [state?.permissions])

  return (
    <ManagementPage
      title="Thiết lập"
      actions={
        <div className="admin-header-tabs">
          <div aria-label="Quản lý người dùng" className="inline-detail-tabs" role="tablist">
            <button
              aria-selected={activeTab === 'users'}
              role="tab"
              type="button"
              onClick={() => setActiveTab('users')}
            >
              Tài khoản người dùng
            </button>
            <button
              aria-selected={activeTab === 'roles'}
              role="tab"
              type="button"
              onClick={() => setActiveTab('roles')}
            >
              Quản lý vai trò
            </button>
          </div>
        </div>
      }
      filter={
        <AdminSettingsMenu />
      }
    >
      {error ? <p role="alert">{error}</p> : null}
      {state === null && error === null ? <p>Đang tải dữ liệu quản trị...</p> : null}

      {state ? (
        <div className="admin-settings-workspace">
          {activeTab === 'users' ? (
          <ManagementListSurface ariaLabel="Tài khoản người dùng">
            <div className="admin-list-toolbar">
              <ManagementCompactToolbar ariaLabel="Lọc người dùng" onSubmit={filterUsers}>
                <ManagementCompactSearch
                  label="Tìm người dùng"
                  leadingIcon={<Search aria-hidden="true" size={16} />}
                  placeholder="Tìm tên, email, điện thoại"
                  trailingAction={<ManagementCompactCreateAction ariaLabel="Tạo người dùng" onClick={openUserDialog} />}
                  value={userSearch}
                  onChange={setUserSearch}
                />
                <label className="admin-status-filter">
                  Trạng thái
                  <select
                    value={userStatus}
                    onChange={(event) => setUserStatus(event.target.value as UserStatusFilter)}
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </label>
                <button className="button button-secondary" type="submit">Lọc</button>
              </ManagementCompactToolbar>
            </div>
            <ManagementTableViewport>
              <table>
                <thead>
                  <tr>
                    <th>Tên hiển thị</th>
                    <th>Tên đăng nhập</th>
                    <th>Điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => (
                    <Fragment key={user.id}>
                      <tr className={selectedUser?.id === user.id ? 'management-data-row-selected' : undefined}>
                        <td>{user.display_name}</td>
                        <td>{user.username || user.email || 'Chưa có'}</td>
                        <td>{user.phone || 'Chưa có'}</td>
                        <td>{userRoleLabel(user)}</td>
                        <td>{userStatusLabel(user.status)}</td>
                        <td>
                          <ManagementRowActionButton
                            ariaLabel={`${selectedUser?.id === user.id ? 'Đóng' : 'Mở'} quyền ${user.display_name}`}
                            onClick={() => setSelectedUser((current) => (current?.id === user.id ? null : user))}
                          >
                            <KeyRound aria-hidden="true" size={15} />
                          </ManagementRowActionButton>
                          <ManagementRowActionButton
                            ariaLabel={`${user.status === 'active' ? 'Ngừng hoạt động' : 'Kích hoạt'} ${user.display_name}`}
                            disabled={savingUser}
                            onClick={() =>
                              void updateUserStatus(user, user.status === 'active' ? 'inactive' : 'active')
                            }
                          >
                            {user.status === 'active' ? (
                              <Lock aria-hidden="true" size={15} />
                            ) : (
                              <Unlock aria-hidden="true" size={15} />
                            )}
                          </ManagementRowActionButton>
                        </td>
                      </tr>
                      {selectedUser?.id === user.id ? (
                        <ManagementDetailRow colSpan={6} label={`Quyền người dùng ${selectedUser.display_name}`}>
                          <div className="permission-editor">
                            <h3>{selectedUser.display_name}</h3>
                            {state.permissions.map((permission) => (
                              <label key={permission.code}>
                                <input
                                  aria-label={permissionTitle(permission)}
                                  checked={selectedUser.permissions.includes(permission.code)}
                                  disabled={savingUser}
                                  type="checkbox"
                                  onChange={() => void togglePermission(permission.code)}
                                />
                                <span>{permissionTitle(permission)}</span>
                                <small>{permissionDescription(permission)}</small>
                              </label>
                            ))}
                          </div>
                        </ManagementDetailRow>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang người dùng"
              canGoNext={false}
              canGoPrevious={false}
              entityLabel="người dùng"
              page={1}
              pageSize={Math.max(1, state.users.length)}
              total={state.users.length}
              onNext={() => undefined}
              onPrevious={() => undefined}
            />
          </ManagementListSurface>
          ) : null}

          {userDialogOpen ? (
            <div className="management-modal-backdrop">
              <section aria-label="Tạo tài khoản" aria-modal="true" className="management-modal-dialog admin-user-dialog" role="dialog">
                <header className="management-modal-header">
                  <h2>Tạo tài khoản</h2>
                  <button aria-label="Đóng" className="management-icon-button" type="button" onClick={closeUserDialog}>
                    <X aria-hidden="true" size={18} />
                  </button>
                </header>
                <form aria-label="Tạo người dùng" className="admin-user-form" onSubmit={createUser}>
                  <div className="admin-user-form-fields">
                    <label>
                      Tên hiển thị
                      <input
                        value={userForm.displayName}
                        onChange={(event) =>
                          setUserForm((current) => ({ ...current, displayName: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Điện thoại
                      <input
                        value={userForm.phone}
                        onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        ref={createUserEmailRef}
                        type="email"
                        value={userForm.email}
                        onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Tên đăng nhập
                      <input
                        value={userForm.username}
                        onChange={(event) =>
                          setUserForm((current) => ({ ...current, username: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Mật khẩu
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(event) =>
                          setUserForm((current) => ({ ...current, password: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Nhập lại mật khẩu
                      <input
                        type="password"
                        value={userForm.passwordConfirmation}
                        onChange={(event) =>
                          setUserForm((current) => ({ ...current, passwordConfirmation: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Vai trò
                      <select
                        value={userForm.roleId}
                        onChange={(event) => setUserForm((current) => ({ ...current, roleId: event.target.value }))}
                      >
                        {roleRows.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <section className="admin-user-form-section" aria-label="Thông tin khác">
                    <h3>Thông tin khác</h3>
                    <div className="admin-user-form-fields">
                      <label>
                        Sinh nhật
                        <span className="admin-user-input-with-icon">
                          <input
                            placeholder="--/--/----"
                            type="date"
                            value={userForm.birthday}
                            onChange={(event) =>
                              setUserForm((current) => ({ ...current, birthday: event.target.value }))
                            }
                          />
                          <CalendarDays aria-hidden="true" size={15} />
                        </span>
                      </label>
                      <label>
                        Địa chỉ
                        <input
                          placeholder="Nhập địa chỉ"
                          value={userForm.address}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, address: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Khu vực
                        <span className="admin-user-input-with-icon admin-user-input-with-leading-icon">
                          <Search aria-hidden="true" size={15} />
                          <input
                            placeholder="Chọn Tỉnh/Thành phố"
                            value={userForm.region}
                            onChange={(event) =>
                              setUserForm((current) => ({ ...current, region: event.target.value }))
                            }
                          />
                        </span>
                      </label>
                      <label>
                        Phường/Xã
                        <span className="admin-user-input-with-icon admin-user-input-with-leading-icon">
                          <Search aria-hidden="true" size={15} />
                          <input
                            placeholder="Chọn Phường/Xã"
                            value={userForm.ward}
                            onChange={(event) => setUserForm((current) => ({ ...current, ward: event.target.value }))}
                          />
                        </span>
                      </label>
                    </div>
                  </section>
                  <section className="admin-user-form-section" aria-label="Ghi chú">
                    <h3>Ghi chú</h3>
                    <label className="admin-user-note-field">
                      <span className="sr-only">Ghi chú</span>
                      <textarea
                        aria-label="Ghi chú"
                        placeholder="Nhập ghi chú"
                        value={userForm.note}
                        onChange={(event) => setUserForm((current) => ({ ...current, note: event.target.value }))}
                      />
                    </label>
                  </section>
                  <footer className="management-modal-footer">
                    <button className="button button-secondary" type="button" onClick={closeUserDialog}>Bỏ qua</button>
                    <button className="button button-primary" disabled={savingUser} type="submit">Lưu</button>
                  </footer>
                </form>
              </section>
            </div>
          ) : null}

          {activeTab === 'roles' ? (
          <ManagementListSurface ariaLabel="Quản lý vai trò">
            <div className="admin-list-toolbar">
              <button className="button button-secondary" type="button" onClick={openRoleDialog}>Tạo vai trò</button>
            </div>
            <ManagementTableViewport>
              <table>
                <thead>
                  <tr>
                    <th>Tên vai trò</th>
                    <th>Mô tả</th>
                    <th>Số tài khoản</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {roleRows.map((role) => (
                    <Fragment key={role.id}>
                      <tr className={selectedRoleId === role.id ? 'management-data-row-selected' : undefined}>
                        <td>{role.name}</td>
                        <td>{role.description}</td>
                        <td>{role.userCount}</td>
                        <td>{userStatusLabel(role.status)}</td>
                        <td>
                          <ManagementRowActionButton
                            ariaLabel={`${selectedRoleId === role.id ? 'Đóng' : 'Mở'} quyền vai trò ${role.name}`}
                            onClick={() => setSelectedRoleId((current) => (current === role.id ? null : role.id))}
                          >
                            <KeyRound aria-hidden="true" size={15} />
                          </ManagementRowActionButton>
                        </td>
                      </tr>
                      {selectedRole?.id === role.id ? (
                        <ManagementDetailRow colSpan={5} label={`Quyền vai trò ${role.name}`}>
                          <div className="role-permission-panel">
                            {permissionsByModule.map(([module, permissions]) => (
                              <section key={module} aria-label={module}>
                                <h3>{module}</h3>
                                <div>
                                  {permissions.map((permission) => (
                                    <label key={permission.code}>
                                      <input
                                        aria-label={permissionTitle(permission)}
                                        checked={role.permissions.includes(permission.code)}
                                        readOnly
                                        type="checkbox"
                                      />
                                      <span>{permissionTitle(permission)}</span>
                                      {' '}
                                      <small>{permissionDescription(permission)}</small>
                                    </label>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </div>
                        </ManagementDetailRow>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang vai trò"
              canGoNext={false}
              canGoPrevious={false}
              entityLabel="vai trò"
              page={1}
              pageSize={Math.max(1, roleRows.length)}
              total={roleRows.length}
              onNext={() => undefined}
              onPrevious={() => undefined}
            />
          </ManagementListSurface>
          ) : null}

          {roleDialogOpen ? (
            <div className="management-modal-backdrop">
              <section aria-label="Tạo vai trò" aria-modal="true" className="management-modal-dialog admin-role-dialog" role="dialog">
                <header className="management-modal-header">
                  <h2>Tạo vai trò</h2>
                  <button aria-label="Đóng" className="management-icon-button" type="button" onClick={closeRoleDialog}>
                    <X aria-hidden="true" size={18} />
                  </button>
                </header>
                <form className="admin-role-form" onSubmit={createTemporaryRole}>
                  <div className="admin-role-form-fields">
                    <label>
                      Tên vai trò
                      <input
                        placeholder="Nhập tên vai trò"
                        value={roleForm.name}
                        onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label>
                      Mô tả
                      <input
                        placeholder="Nhập mô tả"
                        value={roleForm.description}
                        onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="admin-role-permissions-shell">
                    <div className="role-permission-panel admin-role-permissions">
                      {permissionsByModule.map(([module, permissions]) => (
                        <section key={module} aria-label={module}>
                          <h3>{module}</h3>
                          <div>
                            {permissions.map((permission) => (
                              <label key={permission.code}>
                                <input
                                  aria-label={permissionTitle(permission)}
                                  checked={roleForm.permissions.includes(permission.code)}
                                  type="checkbox"
                                  onChange={() => toggleRoleFormPermission(permission.code)}
                                />
                                <span>{permissionTitle(permission)}</span>
                                {' '}
                                <small>{permissionDescription(permission)}</small>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <aside className="admin-role-permission-nav" aria-label="Điều hướng quyền">
                      <p>Ctrl + F để tìm nhanh quyền cần thiết.</p>
                      {permissionsByModule.map(([module]) => (
                        <span key={module}>{module}</span>
                      ))}
                    </aside>
                  </div>

                  <footer className="management-modal-footer">
                    <button className="button button-secondary" type="button" onClick={closeRoleDialog}>Bỏ qua</button>
                    <button className="button button-primary" type="submit">Lưu</button>
                  </footer>
                </form>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </ManagementPage>
  )
}

function AdminSettingsMenu() {
  return (
    <nav aria-label="Menu thiết lập" className="admin-settings-menu">
      <label className="admin-settings-search">
        <Search aria-hidden="true" size={15} />
        <span className="sr-only">Tìm kiếm thiết lập</span>
        <input placeholder="Tìm kiếm thiết lập" />
      </label>
      <AdminSettingsGroup title="Tiện ích" items={['Giao hàng', 'Thanh toán', 'Gửi SMS', 'Zalo']} />
      <AdminSettingsGroup
        title="Cửa hàng"
        activeItem="Quản lý người dùng"
        items={['Thông tin cửa hàng', 'Quản lý tiền tệ', 'Quản lý người dùng', 'Quản lý chi nhánh', 'Bảo mật']}
      />
      <AdminSettingsGroup title="Dữ liệu" items={['Khóa sổ', 'Lịch sử thao tác', 'Xóa dữ liệu gian hàng']} />
      <AdminSettingsGroup title="Thiết bị" items={['Cân điện tử']} />
    </nav>
  )
}

function AdminSettingsGroup({
  title,
  items,
  activeItem,
}: {
  title: string
  items: string[]
  activeItem?: string
}) {
  return (
    <section aria-label={title} className="admin-settings-group">
      <h2>{title}</h2>
      <div>
        {items.map((item) => (
          <button
            key={item}
            aria-current={item === activeItem ? 'page' : undefined}
            type="button"
          >
            <Settings aria-hidden="true" size={15} />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

