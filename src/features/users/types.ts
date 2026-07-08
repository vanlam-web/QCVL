import type { CurrentUserData } from '../../lib/api/types'

export type PermissionCode = CurrentUserData['permissions'][number]

export interface UserListItem {
  id: string
  email: string
  username: string | null
  phone: string | null
  birthday?: string | null
  region?: string | null
  ward?: string | null
  address?: string | null
  note?: string | null
  display_name: string
  status: 'active' | 'inactive'
  permissions: PermissionCode[]
}

export interface UserListResponse {
  items: UserListItem[]
  total: number
}

export interface Permission {
  code: PermissionCode
  module: string
  description: string
}
