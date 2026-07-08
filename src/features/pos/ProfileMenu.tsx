import { useEffect, useId, useRef, useState } from 'react'
import { BarChart3, LogOut, Settings, UserCircle } from 'lucide-react'
import type { PermissionCode } from '../users/types'
import { permissions as permissionCodes } from '../users/permissions'

export function ProfileMenu({
  displayName,
  permissions,
  onSignOut,
  onOpenAdmin,
  onOpenDashboard,
  compact = false,
}: {
  displayName: string
  permissions: PermissionCode[]
  onSignOut: () => void
  onOpenAdmin: () => void
  onOpenDashboard: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function pointerdown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('pointerdown', pointerdown)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('pointerdown', pointerdown)
    }
  }, [open])

  return (
    <div ref={ref} className={compact ? 'account-menu profile-menu profile-menu-compact' : 'account-menu profile-menu'}>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={compact ? 'Tài khoản' : undefined}
        className={compact ? 'account-menu-trigger management-icon-button' : 'button button-secondary'}
        onClick={() => setOpen((value) => !value)}
        title={compact ? displayName : undefined}
        type="button"
      >
        {compact ? <UserCircle aria-hidden="true" size={20} /> : `👤 ${displayName}`}
      </button>
      {open ? (
        <div className="account-menu-popover" id={id} role="menu">
          <button className="account-menu-profile" role="menuitem" onClick={onOpenDashboard} type="button">
            <span aria-hidden="true" className="account-menu-profile-avatar">
              <UserCircle size={20} />
            </span>
            <span className="account-menu-profile-label" title={displayName}>
              {displayName}
            </span>
          </button>
          <button className="button button-secondary" role="menuitem" type="button">
            <BarChart3 aria-hidden="true" size={16} />
            Báo cáo ca
          </button>
          {permissions.includes(permissionCodes.accessAdminPanel) ? (
            <button className="button button-secondary" role="menuitem" onClick={onOpenAdmin} type="button">
              <Settings aria-hidden="true" size={16} />
              Quản trị
            </button>
          ) : null}
          <button className="button button-secondary" role="menuitem" onClick={onSignOut} type="button">
            <LogOut aria-hidden="true" size={16} />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  )
}
