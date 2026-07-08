import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { PermissionCode } from '../features/users/types'
import { appRoutes } from './routes'

export function RequirePermission({
  authenticated,
  pending = false,
  permissions,
  permission,
  children,
}: {
  authenticated: boolean
  pending?: boolean
  permissions: PermissionCode[]
  permission: PermissionCode
  children: ReactNode
}) {
  if (pending) return null
  if (!authenticated) return <Navigate to={appRoutes.login} replace />
  if (!permissions.includes(permission)) return <Navigate to={appRoutes.forbidden} replace />
  return children
}
