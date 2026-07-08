import { useEffect, useId, useRef, useState } from 'react'
import { UserCircle } from 'lucide-react'
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
    <div ref={ref} className={compact ? 'profile-menu profile-menu-compact' : 'profile-menu'}>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={compact ? 'Tài khoản' : undefined}
        className={compact ? 'management-icon-button' : 'button button-secondary'}
        onClick={() => setOpen((value) => !value)}
        title={compact ? displayName : undefined}
        type="button"
      >
        {compact ? <UserCircle aria-hidden="true" size={20} /> : `👤 ${displayName}`}
      </button>
      {open ? (
        <div id={id} role="menu">
          <button className="button button-secondary" role="menuitem" onClick={onOpenDashboard} type="button">
            Trang chủ
          </button>
          {permissions.includes(permissionCodes.viewShiftReport) ? (
            <button className="button button-secondary" role="menuitem">
              Báo cáo ca
            </button>
          ) : null}
          {permissions.includes(permissionCodes.accessAdminPanel) ? (
            <button className="button button-secondary" role="menuitem" onClick={onOpenAdmin} type="button">
              Quản trị
            </button>
          ) : null}
          <button className="button button-secondary" role="menuitem" onClick={onSignOut} type="button">
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  )
}
