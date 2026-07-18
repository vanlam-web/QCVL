import { ApiError } from '../../lib/api/client'
import type { ApiErrorCode } from '../../lib/api/types'

export interface AuthService {
  signIn(login: string, password: string): Promise<void>
  signOut(): Promise<void>
  getAccessToken(): Promise<string | null>
}

export interface AuthServiceOptions {
  baseUrl: string
  fetch?: typeof fetch
}

const accessTokenStorageKey = 'qc_oms.access_token'
let fallbackAccessToken: string | null = null

export function createAuthService(options: AuthServiceOptions): AuthService {
  const fetcher = options.fetch ?? fetch

  return {
    async signIn(login, password) {
      const response = await fetcher(`${options.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: login.trim().toLowerCase(), password }),
      })
      const body = (await response.json()) as {
        success: boolean
        data?: { access_token: string }
        error?: { code?: string; message?: string }
        trace_id?: string
      }

      if (!response.ok || !body.success || !body.data?.access_token) {
        const errorCode = body.error?.code === 'AUTH_REQUIRED' && response.status === 401 ? 'LOGIN_FAILED' : body.error?.code
        throw new ApiError(
          response.status,
          (errorCode as ApiErrorCode | undefined) ?? 'LOGIN_FAILED',
          body.error?.message ?? 'Đăng nhập không thành công.',
          body.trace_id ?? 'local',
        )
      }

      setStoredAccessToken(body.data.access_token)
    },
    async signOut() {
      const token = getStoredAccessToken()
      if (token) {
        await fetcher(`${options.baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        }).catch(() => undefined)
      }
      removeStoredAccessToken()
    },
    async getAccessToken() {
      return getStoredAccessToken()
    },
  }
}

function getStoredAccessToken() {
  try {
    return window.localStorage.getItem(accessTokenStorageKey)
  } catch {
    return fallbackAccessToken
  }
}

function setStoredAccessToken(token: string) {
  fallbackAccessToken = token
  try {
    window.localStorage.setItem(accessTokenStorageKey, token)
  } catch {
    // Some embedded browser contexts block storage; memory fallback keeps the session usable.
  }
}

function removeStoredAccessToken() {
  fallbackAccessToken = null
  try {
    window.localStorage.removeItem(accessTokenStorageKey)
  } catch {
    // Storage may be unavailable in embedded browsers.
  }
}
