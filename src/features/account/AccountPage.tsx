import { useState } from 'react'
import { CalendarDays, Edit3, KeyRound, Monitor, Search, ShieldCheck, Smartphone, Tablet, X } from 'lucide-react'
import type { CurrentUserData } from '../../lib/api/types'

export interface AccountProfileInput {
  display_name: string
  username: string | null
  phone: string | null
  email: string | null
  birthday: string | null
  region: string | null
  ward: string | null
  address: string | null
  note: string | null
}

function accountRole(currentUser: CurrentUserData) {
  return currentUser.permissions.includes('perm.access_admin_panel') ? 'Admin' : 'Nhân viên'
}

export function AccountPage({
  currentUser,
  onSaveProfile,
  onSignOutDevice,
}: {
  currentUser: CurrentUserData
  onSaveProfile?: (input: AccountProfileInput) => Promise<void>
  onSignOutDevice?: (deviceId: string) => Promise<void>
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)
  const [signingOutDeviceId, setSigningOutDeviceId] = useState<string | null>(null)
  const [deviceSignOutError, setDeviceSignOutError] = useState<string | null>(null)
  const displayName = currentUser.user.display_name.trim() || currentUser.user.email
  const profile = currentUser.profile
  const username = profile?.username ?? currentUser.user.email
  const contactEmail = profile?.email ?? currentUser.user.email
  const role = accountRole(currentUser)
  const devices = currentUser.devices ?? []
  const editDialogTitle = `Sửa thông tin của ${displayName}`
  const closeEditDialog = () => {
    if (isSavingProfile) return
    setProfileSaveError(null)
    setIsEditingProfile(false)
  }
  const saveProfile = async (form: HTMLFormElement) => {
    const data = new FormData(form)
    setIsSavingProfile(true)
    setProfileSaveError(null)
    try {
      await onSaveProfile?.({
        display_name: requiredValue(data, 'displayName'),
        username: nullableValue(data, 'username'),
        phone: nullableValue(data, 'phone'),
        email: nullableValue(data, 'email'),
        birthday: nullableValue(data, 'birthday'),
        region: nullableValue(data, 'region'),
        ward: nullableValue(data, 'ward'),
        address: nullableValue(data, 'address'),
        note: nullableValue(data, 'note'),
      })
      setIsEditingProfile(false)
    } catch (error) {
      setProfileSaveError(profileSaveMessage(error))
    } finally {
      setIsSavingProfile(false)
    }
  }
  const signOutDevice = async (deviceId: string) => {
    setSigningOutDeviceId(deviceId)
    setDeviceSignOutError(null)
    try {
      await onSignOutDevice?.(deviceId)
    } catch (error) {
      setDeviceSignOutError(profileSaveMessage(error))
    } finally {
      setSigningOutDeviceId(null)
    }
  }

  return (
    <main className="management-page account-page">
      <header className="management-page-header account-page-header">
        <h1>Tài khoản</h1>
      </header>

      <div className="account-page-content">
        <section aria-labelledby="account-user-heading" className="management-list-surface account-card" role="region">
          <header className="account-card-header">
            <h2 id="account-user-heading">Thông tin người dùng</h2>
            <button
              className="button button-secondary"
              type="button"
              aria-label="Sửa thông tin người dùng"
              onClick={() => setIsEditingProfile(true)}
            >
              <Edit3 aria-hidden="true" size={16} />
              Sửa
            </button>
          </header>

          <div className="account-profile-grid">
            <dl>
              <div>
                <dt>Tên hiển thị</dt>
                <dd>{displayName}</dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{emptyFallback(profile?.phone)}</dd>
              </div>
              <div>
                <dt>Địa chỉ</dt>
                <dd>{emptyFallback(profile?.address)}</dd>
              </div>
            </dl>
            <dl>
              <div>
                <dt>Tên đăng nhập</dt>
                <dd>{username}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{contactEmail}</dd>
              </div>
            </dl>
            <dl>
              <div>
                <dt>Vai trò</dt>
                <dd>{role}</dd>
              </div>
              <div>
                <dt>Sinh nhật</dt>
                <dd>{emptyFallback(profile?.birthday)}</dd>
              </div>
            </dl>
          </div>

          <p className="management-detail-inline-note account-note">
            <Edit3 aria-hidden="true" size={15} />
            {emptyFallback(profile?.note, 'Chưa có ghi chú')}
          </p>
        </section>

        <section aria-labelledby="account-security-heading" className="management-list-surface account-card" role="region">
          <header className="account-card-header">
            <h2 id="account-security-heading">Đăng nhập và bảo mật</h2>
          </header>

          <div className="account-security-list">
            <div className="account-security-row">
              <span aria-hidden="true" className="account-row-icon">
                <KeyRound size={20} />
              </span>
              <div>
                <h3>Mật khẩu</h3>
                <p>Mật khẩu mạnh giúp bảo vệ tài khoản. Nên đổi mật khẩu định kỳ mỗi 6 tháng.</p>
              </div>
              <button className="button button-secondary" type="button">Đổi mật khẩu</button>
            </div>

            <div className="account-security-row">
              <span aria-hidden="true" className="account-row-icon">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3>Xác thực 2 lớp cho tài khoản của bạn</h3>
                <p>Chưa có dữ liệu xác thực 2 lớp</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="account-devices-heading" className="management-list-surface account-card" role="region">
          <header className="account-card-header">
            <h2 id="account-devices-heading">Các thiết bị đã đăng nhập</h2>
          </header>

          <div className="account-device-list">
            {deviceSignOutError ? (
              <p className="management-form-error account-edit-error" role="alert">
                {deviceSignOutError}
              </p>
            ) : null}
            {devices.length > 0 ? (
              devices.map((device) => (
                <article className="account-device-row" key={device.id}>
                  <span aria-hidden="true" className="account-row-icon">
                    <DeviceIcon type={device.device_type} />
                  </span>
                  <div>
                    <h3>
                      {device.device_name}
                      {device.is_current_device ? <span className="status-chip status-chip-success">Đang dùng</span> : null}
                    </h3>
                    <p>{deviceSummary(device)}</p>
                    <p>Hoạt động gần nhất: {formatDeviceSeenAt(device.last_seen_at)}</p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={device.is_current_device || signingOutDeviceId !== null}
                    onClick={() => void signOutDevice(device.id)}
                  >
                    {signingOutDeviceId === device.id ? 'Đang xử lý' : device.is_current_device ? 'Thiết bị này' : 'Đăng xuất'}
                  </button>
                </article>
              ))
            ) : (
              <p className="management-detail-inline-note account-note">Chưa có dữ liệu thiết bị đăng nhập</p>
            )}
          </div>
        </section>
      </div>

      {isEditingProfile ? (
        <div className="management-modal-backdrop">
          <section
            aria-labelledby="account-edit-heading"
            className="management-modal-dialog account-edit-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header className="management-modal-header">
              <h2 id="account-edit-heading">{editDialogTitle}</h2>
              <button
                aria-label="Đóng popup sửa thông tin"
                className="management-icon-button account-edit-close"
                type="button"
                onClick={closeEditDialog}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <form
              className="management-modal-form account-edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveProfile(event.currentTarget)
              }}
            >
              <div className="account-edit-form-grid">
                <label>
                  Tên hiển thị
                  <input name="displayName" defaultValue={displayName} />
                </label>
                <label>
                  Tên đăng nhập
                  <input name="username" defaultValue={username} />
                </label>
                <label>
                  Vai trò
                  <input name="role" value={role} readOnly />
                </label>
                <label>
                  Điện thoại
                  <span className="account-input-with-prefix">
                    <span aria-hidden="true">VN</span>
                    <input aria-label="Điện thoại" name="phone" defaultValue={profile?.phone ?? ''} placeholder="Chưa có" />
                  </span>
                </label>
                <label>
                  Email
                  <input name="email" type="email" defaultValue={contactEmail} />
                </label>
                <label>
                  Sinh nhật
                  <span className="management-input-with-icon account-input-with-icon">
                    <input aria-label="Sinh nhật" name="birthday" defaultValue={profile?.birthday ?? ''} placeholder="Chưa có" />
                    <CalendarDays aria-hidden="true" size={16} />
                  </span>
                </label>
                <label>
                  Khu vực
                  <span className="management-input-with-icon account-input-with-icon">
                    <input aria-label="Khu vực" name="region" defaultValue={profile?.region ?? ''} placeholder="Chưa có" />
                    <Search aria-hidden="true" size={16} />
                  </span>
                </label>
                <label>
                  Phường/Xã
                  <span className="management-input-with-icon account-input-with-icon">
                    <input aria-label="Phường/Xã" name="ward" defaultValue={profile?.ward ?? ''} placeholder="Chưa có" />
                    <Search aria-hidden="true" size={16} />
                  </span>
                </label>
                <label>
                  Địa chỉ
                  <input name="address" defaultValue={profile?.address ?? ''} placeholder="Chưa có" />
                </label>
                <label className="account-edit-field-wide">
                  Ghi chú
                  <textarea name="note" defaultValue={profile?.note ?? ''} placeholder="Chưa có" />
                </label>
              </div>

              <footer className="management-modal-footer account-edit-footer">
                {profileSaveError ? (
                  <p className="management-form-error account-edit-error" role="alert">
                    {profileSaveError}
                  </p>
                ) : null}
                <button className="button button-secondary" type="button" onClick={closeEditDialog} disabled={isSavingProfile}>
                  Hủy
                </button>
                <button className="button button-primary" type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Đang lưu' : 'Lưu'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function DeviceIcon({ type }: { type: NonNullable<CurrentUserData['devices']>[number]['device_type'] }) {
  if (type === 'mobile') return <Smartphone size={20} />
  if (type === 'tablet') return <Tablet size={20} />
  return <Monitor size={20} />
}

function deviceSummary(device: NonNullable<CurrentUserData['devices']>[number]) {
  return [device.browser_name, device.os_name, device.ip_address].filter(Boolean).join(' • ') || 'Chưa có thông tin thiết bị'
}

function formatDeviceSeenAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('day')}/${pick('month')}/${pick('year')} ${pick('hour')}:${pick('minute')}`
}

function emptyFallback(value: string | null | undefined, fallback = 'Chưa có') {
  const text = value?.trim()
  return text ? text : fallback
}

function requiredValue(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim()
}

function nullableValue(data: FormData, name: string) {
  const value = requiredValue(data, name)
  return value.length > 0 ? value : null
}

function profileSaveMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `Không lưu được: ${error.message}`
  }
  return 'Không lưu được. Kiểm tra API hoặc kết nối.'
}
