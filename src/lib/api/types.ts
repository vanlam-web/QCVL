export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_INACTIVE'
  | 'WORKSTATION_INVALID'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR'

export interface SuccessEnvelope<T> {
  success: true
  data: T
  trace_id: string
}

export interface ErrorEnvelope {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    fields?: Record<string, string[]>
  }
  trace_id: string
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope

export interface CurrentUserData {
  user: { id: string; email: string; display_name: string }
  profile?: {
    username: string | null
    phone: string | null
    email: string | null
    birthday: string | null
    region: string | null
    ward: string | null
    address: string | null
    note: string | null
  }
  organization: { id: string; code: string; name: string }
  workstation: { id: string; code: string; name: string } | null
  devices?: {
    id: string
    device_name: string
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
    browser_name: string | null
    os_name: string | null
    ip_address: string | null
    last_seen_at: string
    created_at: string
    is_current_device: boolean
    status: 'active' | 'signed_out'
  }[]
  permissions: `perm.${string}`[]
}
