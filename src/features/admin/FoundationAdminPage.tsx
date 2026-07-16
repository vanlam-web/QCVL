import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, KeyRound, Lock, Search, Settings, SquarePen, Unlock, X } from 'lucide-react'
import type { Permission, UserListItem } from '../users/types'
import type { FoundationService } from '../users/foundation-service'
import { ApiError } from '../../lib/api/client'
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
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
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
type UserFormErrors = Partial<Record<'displayName' | 'phone' | 'email' | 'username' | 'password' | 'passwordConfirmation' | 'roleId', string>>
type UserDialogMode = 'create' | 'edit'
type AdminUserSortKey = 'display_name' | 'username' | 'phone' | 'role' | 'status'
type AdminRoleSortKey = 'name' | 'description' | 'userCount' | 'status'

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

function validateUserForm(form: {
  displayName: string
  phone: string
  email: string
  username: string
  password: string
  passwordConfirmation: string
  roleId: string
}, mode: UserDialogMode) {
  const errors: UserFormErrors = {}
  if (!form.displayName.trim()) errors.displayName = 'Tên hiển thị là bắt buộc.'
  if (!form.phone.trim()) errors.phone = 'SĐT là bắt buộc.'
  if (!form.username.trim()) errors.username = 'Tên đăng nhập là bắt buộc.'
  if (mode === 'create' && !form.password) errors.password = 'Mật khẩu là bắt buộc.'
  if (mode === 'create' && !form.passwordConfirmation) errors.passwordConfirmation = 'Nhập lại mật khẩu là bắt buộc.'
  if (!form.roleId.trim()) errors.roleId = 'Vai trò là bắt buộc.'
  return errors
}

function emptyUserForm() {
  return {
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
  }
}

function roleIdForUser(user: UserListItem, roles: RoleListItem[]) {
  return roles.find((role) => role.name === userRoleLabel(user))?.id ?? 'cashier'
}

function FieldError({ message }: { message?: string }) {
  return message ? <span aria-hidden="true" className="admin-user-field-inline-error">{message}</span> : null
}

function FieldErrorIcon({ label, show }: { label: string; show?: boolean }) {
  return show ? (
    <span aria-hidden="true" className="admin-user-field-error-icon" data-field-error-icon={label}>
      !
    </span>
  ) : null
}

const createUserApiFieldMap: Record<string, { key: keyof UserFormErrors; label: string; requiredMessage: string }> = {
  display_name: { key: 'displayName', label: 'Tên hiển thị', requiredMessage: 'Tên hiển thị là bắt buộc.' },
  phone: { key: 'phone', label: 'SĐT', requiredMessage: 'SĐT là bắt buộc.' },
  email: { key: 'email', label: 'Email', requiredMessage: 'Email là bắt buộc.' },
  username: { key: 'username', label: 'Tên đăng nhập', requiredMessage: 'Tên đăng nhập là bắt buộc.' },
  password: { key: 'password', label: 'Mật khẩu', requiredMessage: 'Mật khẩu là bắt buộc.' },
}

function getCreateUserApiValidation(cause: unknown) {
  if (!(cause instanceof ApiError) || cause.code !== 'VALIDATION_ERROR') return null
  const fields = cause.fields ?? parseRequiredFieldFromMessage(cause.message)
  const errors: UserFormErrors = {}
  const labels: string[] = []

  for (const [apiField, messages] of Object.entries(fields)) {
    const mapping = createUserApiFieldMap[apiField]
    if (!mapping) continue
    labels.push(mapping.label)
    const firstMessage = messages[0] ?? ''
    errors[mapping.key] = firstMessage.includes('is required') ? mapping.requiredMessage : `${mapping.label} chưa hợp lệ.`
  }

  return labels.length > 0 ? { errors, notice: `Vui lòng kiểm tra lại ${labels.join(', ')}.` } : null
}

function parseRequiredFieldFromMessage(message: string) {
  const match = message.match(/^([a-z_]+) is required\.$/)
  return match ? { [match[1]]: [message] } : {}
}

export function FoundationAdminPage({
  service,
}: {
  service: FoundationService
  onOpenDashboard: () => void
}) {
  const [state, setState] = useState<AdminState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userFormNotice, setUserFormNotice] = useState<string | null>(null)
  const [userExtraOpen, setUserExtraOpen] = useState(false)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [userFormErrors, setUserFormErrors] = useState<UserFormErrors>({})
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [userDialogMode, setUserDialogMode] = useState<UserDialogMode>('create')
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
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
  const createUserDisplayNameRef = useRef<HTMLInputElement | null>(null)

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
    if (userDialogOpen) createUserDisplayNameRef.current?.focus()
  }, [userDialogOpen])

  function openUserDialog() {
    setUserDialogMode('create')
    setEditingUser(null)
    setUserForm(emptyUserForm())
    setUserFormErrors({})
    setUserFormNotice(null)
    setUserExtraOpen(false)
    setUserDialogOpen(true)
  }

  function openEditUserDialog(user: UserListItem) {
    setUserDialogMode('edit')
    setEditingUser(user)
    setUserForm({
      displayName: user.display_name,
      phone: user.phone ?? '',
      email: user.email ?? '',
      username: user.username ?? '',
      password: '',
      passwordConfirmation: '',
      roleId: roleIdForUser(user, roleRows),
      birthday: user.birthday ?? '',
      address: user.address ?? '',
      region: user.region ?? '',
      ward: user.ward ?? '',
      note: user.note ?? '',
    })
    setUserFormErrors({})
    setUserFormNotice(null)
    setUserExtraOpen(Boolean(user.birthday || user.address || user.region || user.ward || user.note))
    setUserDialogOpen(true)
  }

  function closeUserDialog() {
    setUserFormNotice(null)
    setUserDialogOpen(false)
    setEditingUser(null)
  }

  function updateUserFormField<K extends keyof typeof userForm>(field: K, value: (typeof userForm)[K], errorKey?: keyof UserFormErrors) {
    setUserForm((current) => ({ ...current, [field]: value }))
    if (!errorKey || !userFormErrors[errorKey]) return
    setUserFormErrors((current) => {
      const next = { ...current }
      delete next[errorKey]
      if (Object.keys(next).length === 0) setUserFormNotice(null)
      return next
    })
  }

  async function filterUsers(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => load({ search: userSearch, status: userStatus }))
  }

  function changeUserSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch: setUserSearch,
      resetSelection: () => setSelectedUser(null),
      load: (query) => load({ search: query, status: userStatus }),
    })
  }

  function changeUserStatus(nextStatus: UserStatusFilter) {
    setUserStatus(nextStatus)
    setSelectedUser(null)
    void load({ search: userSearch, status: nextStatus })
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateUserForm(userForm, userDialogMode)
    if (Object.keys(validationErrors).length > 0) {
      setUserFormErrors(validationErrors)
      setUserFormNotice('Vui lòng nhập đủ các trường bắt buộc.')
      return
    }
    const shouldUpdatePassword = userDialogMode === 'create' || Boolean(userForm.password || userForm.passwordConfirmation)
    if (shouldUpdatePassword && userForm.password !== userForm.passwordConfirmation) {
      setUserFormErrors({ passwordConfirmation: 'Mật khẩu nhập lại không khớp.' })
      setUserFormNotice('Mật khẩu nhập lại không khớp.')
      return
    }
    if (userDialogMode === 'edit' && !editingUser) {
      setUserFormNotice('Không tìm thấy tài khoản cần sửa.')
      return
    }
    setSavingUser(true)
    setUserFormNotice(null)
    setUserFormErrors({})
    try {
      const role = findAdminRoleById(userForm.roleId, [...roleDefinitions, ...customRoles])
      const permissions = role ? role.permissions : [...internalStaffDefaultPermissions]
      if (userDialogMode === 'create') {
        await service.createUser({
          email: adminNullableFormValue(userForm.email),
          username: userForm.username,
          phone: adminNullableFormValue(userForm.phone),
          birthday: adminNullableFormValue(userForm.birthday),
          address: adminNullableFormValue(userForm.address),
          region: adminNullableFormValue(userForm.region),
          ward: adminNullableFormValue(userForm.ward),
          note: adminNullableFormValue(userForm.note),
          password: userForm.password,
          display_name: userForm.displayName,
          permissions,
        })
      } else if (editingUser) {
        await service.updateUser(editingUser.id, {
          email: adminNullableFormValue(userForm.email),
          username: userForm.username,
          phone: adminNullableFormValue(userForm.phone),
          birthday: adminNullableFormValue(userForm.birthday),
          address: adminNullableFormValue(userForm.address),
          region: adminNullableFormValue(userForm.region),
          ward: adminNullableFormValue(userForm.ward),
          note: adminNullableFormValue(userForm.note),
          password: userForm.password || undefined,
          display_name: userForm.displayName,
        })
        await service.replaceUserPermissions(editingUser.id, permissions)
        setSelectedUser(null)
      }
      await load()
      closeUserDialog()
    } catch (cause) {
      const validation = getCreateUserApiValidation(cause)
      if (validation) {
        setUserFormErrors(validation.errors)
        setUserFormNotice(validation.notice)
      } else {
        setUserFormNotice(formatApiError(cause, 'Không lưu được người dùng.'))
      }
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

  const roleRows: RoleListItem[] = state
    ? [
        ...roleDefinitions.map((role) => ({
          ...role,
          status: 'active' as const,
          userCount: state.users.filter((user) => userRoleLabel(user) === role.name).length,
        })),
        ...customRoles,
      ]
    : []
  const {
    sortedItems: sortedAdminUsers,
    sortState: adminUserSortState,
    requestSort: requestAdminUserSort,
  } = useManagementTableSort<UserListItem, AdminUserSortKey>(state?.users ?? [], {
    display_name: { kind: 'text', value: (user) => user.display_name },
    username: { kind: 'text', value: (user) => user.username || user.email },
    phone: { kind: 'text', value: (user) => user.phone },
    role: { kind: 'text', value: (user) => userRoleLabel(user) },
    status: { kind: 'text', value: (user) => userStatusLabel(user.status) },
  })
  const {
    sortedItems: sortedRoleRows,
    sortState: adminRoleSortState,
    requestSort: requestAdminRoleSort,
  } = useManagementTableSort<RoleListItem, AdminRoleSortKey>(roleRows, {
    name: { kind: 'text', value: (role) => role.name },
    description: { kind: 'text', value: (role) => role.description },
    userCount: { kind: 'number', value: (role) => role.userCount },
    status: { kind: 'text', value: (role) => userStatusLabel(role.status) },
  })
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
      {error && !userDialogOpen ? <p role="alert">{error}</p> : null}
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
                  onChange={changeUserSearch}
                />
                <label className="admin-status-filter">
                  Trạng thái
                  <select
                    value={userStatus}
                    onChange={(event) => changeUserStatus(event.target.value as UserStatusFilter)}
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </label>
              </ManagementCompactToolbar>
            </div>
            <ManagementTableViewport>
              <table>
                <thead>
                  <tr>
                    <ManagementSortableHeader kind="text" sortKey="display_name" sortState={adminUserSortState} onSort={requestAdminUserSort}>Tên hiển thị</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="username" sortState={adminUserSortState} onSort={requestAdminUserSort}>Tên đăng nhập</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="phone" sortState={adminUserSortState} onSort={requestAdminUserSort}>Điện thoại</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="role" sortState={adminUserSortState} onSort={requestAdminUserSort}>Vai trò</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="status" sortState={adminUserSortState} onSort={requestAdminUserSort}>Trạng thái</ManagementSortableHeader>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAdminUsers.map((user) => (
                    <Fragment key={user.id}>
                      <tr className={selectedUser?.id === user.id ? 'management-data-row-selected' : undefined}>
                        <td>{user.display_name}</td>
                        <td>{user.username || user.email || 'Chưa có'}</td>
                        <td>{user.phone || 'Chưa có'}</td>
                        <td>{userRoleLabel(user)}</td>
                        <td>{userStatusLabel(user.status)}</td>
                        <td>
                          <ManagementRowActionButton
                            ariaLabel={`Sửa ${user.display_name}`}
                            disabled={savingUser}
                            onClick={() => openEditUserDialog(user)}
                          >
                            <SquarePen aria-hidden="true" size={15} />
                          </ManagementRowActionButton>
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
              <section aria-label={userDialogMode === 'create' ? 'Tạo tài khoản' : 'Sửa tài khoản'} aria-modal="true" className="management-modal-dialog admin-user-dialog" role="dialog">
                <header className="management-modal-header">
                  <h2>{userDialogMode === 'create' ? 'Tạo tài khoản' : 'Sửa tài khoản'}</h2>
                  <button aria-label="Đóng" className="management-icon-button" type="button" onClick={closeUserDialog}>
                    <X aria-hidden="true" size={18} />
                  </button>
                </header>
                <form aria-label={userDialogMode === 'create' ? 'Tạo người dùng' : 'Sửa người dùng'} className="admin-user-form" noValidate onSubmit={saveUser}>
                  {userFormNotice ? <p className="management-form-error" role="alert">{userFormNotice}</p> : null}
                  <div className="admin-user-form-fields">
                    <label>
                      Tên hiển thị
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.displayName)}
                          ref={createUserDisplayNameRef}
                          required
                          value={userForm.displayName}
                          onChange={(event) =>
                            updateUserFormField('displayName', event.target.value, 'displayName')
                          }
                        />
                        <FieldError message={userFormErrors.displayName} />
                        <FieldErrorIcon label="Tên hiển thị" show={Boolean(userFormErrors.displayName)} />
                      </span>
                    </label>
                    <label>
                      Điện thoại
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.phone)}
                          required
                          value={userForm.phone}
                          onChange={(event) => updateUserFormField('phone', event.target.value, 'phone')}
                        />
                        <FieldError message={userFormErrors.phone} />
                        <FieldErrorIcon label="SĐT" show={Boolean(userFormErrors.phone)} />
                      </span>
                    </label>
                    <label>
                      Email
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.email)}
                          type="email"
                          value={userForm.email}
                          onChange={(event) => updateUserFormField('email', event.target.value, 'email')}
                        />
                        <FieldError message={userFormErrors.email} />
                        <FieldErrorIcon label="Email" show={Boolean(userFormErrors.email)} />
                      </span>
                    </label>
                    <label>
                      Tên đăng nhập
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.username)}
                          required
                          value={userForm.username}
                          onChange={(event) =>
                            updateUserFormField('username', event.target.value, 'username')
                          }
                        />
                        <FieldError message={userFormErrors.username} />
                        <FieldErrorIcon label="Tên đăng nhập" show={Boolean(userFormErrors.username)} />
                      </span>
                    </label>
                    <label>
                      Mật khẩu
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.password)}
                          required={userDialogMode === 'create'}
                          type="password"
                          value={userForm.password}
                          onChange={(event) =>
                            updateUserFormField('password', event.target.value, 'password')
                          }
                        />
                        <FieldError message={userFormErrors.password} />
                        <FieldErrorIcon label="Mật khẩu" show={Boolean(userFormErrors.password)} />
                      </span>
                    </label>
                    <label>
                      Nhập lại mật khẩu
                      <span className="admin-user-field-control">
                        <input
                          aria-invalid={Boolean(userFormErrors.passwordConfirmation)}
                          required={userDialogMode === 'create'}
                          type="password"
                          value={userForm.passwordConfirmation}
                          onChange={(event) =>
                            updateUserFormField('passwordConfirmation', event.target.value, 'passwordConfirmation')
                          }
                        />
                        <FieldError message={userFormErrors.passwordConfirmation} />
                        <FieldErrorIcon label="Nhập lại mật khẩu" show={Boolean(userFormErrors.passwordConfirmation)} />
                      </span>
                    </label>
                    <label>
                      Vai trò
                      <select
                        aria-invalid={Boolean(userFormErrors.roleId)}
                        required
                        value={userForm.roleId}
                        onChange={(event) => setUserForm((current) => ({ ...current, roleId: event.target.value }))}
                      >
                        {roleRows.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <FieldError message={userFormErrors.roleId} />
                    </label>
                  </div>
                  <section className="admin-user-form-section admin-user-form-section-collapsible" aria-label="Thông tin khác">
                    <button
                      aria-expanded={userExtraOpen}
                      className="admin-user-section-toggle"
                      type="button"
                      onClick={() => setUserExtraOpen((current) => !current)}
                    >
                      <span>Thông tin khác</span>
                      <ChevronDown aria-hidden="true" className={userExtraOpen ? 'admin-user-section-toggle-open' : undefined} size={16} />
                    </button>
                    {userExtraOpen ? (
                      <div className="admin-user-form-fields">
                        <label>
                          Sinh nhật
                          <input
                            placeholder="--/--/----"
                            type="date"
                            value={userForm.birthday}
                            onChange={(event) =>
                              setUserForm((current) => ({ ...current, birthday: event.target.value }))
                            }
                          />
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
                        <label className="admin-user-note-field admin-user-field-wide">
                          Ghi chú
                          <textarea
                            aria-label="Ghi chú"
                            placeholder="Nhập ghi chú"
                            value={userForm.note}
                            onChange={(event) => setUserForm((current) => ({ ...current, note: event.target.value }))}
                          />
                        </label>
                      </div>
                    ) : null}
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
                    <ManagementSortableHeader kind="text" sortKey="name" sortState={adminRoleSortState} onSort={requestAdminRoleSort}>Tên vai trò</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="description" sortState={adminRoleSortState} onSort={requestAdminRoleSort}>Mô tả</ManagementSortableHeader>
                    <ManagementSortableHeader kind="number" sortKey="userCount" sortState={adminRoleSortState} onSort={requestAdminRoleSort}>Số tài khoản</ManagementSortableHeader>
                    <ManagementSortableHeader kind="text" sortKey="status" sortState={adminRoleSortState} onSort={requestAdminRoleSort}>Trạng thái</ManagementSortableHeader>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoleRows.map((role) => (
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

