import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createAuthService, type AuthService } from './auth-service'
import { createApiClient, ApiError } from '../../lib/api/client'
import type { CurrentUserData } from '../../lib/api/types'
import {
  createFoundationService,
  type ApiRequester,
} from '../users/foundation-service'
import { AccessSync } from './AccessSync'
import type { AccessConnectionState, RealtimeClient } from '../../lib/realtime/access-channel'
import { AuthContext, type AuthContextValue } from './auth-context'
import { runtimeConfig } from '../../lib/config/runtime'

const bootstrapTimeoutMs = 8000
const currentUserCacheKey = 'qc-oms.auth.current-user.v2'
const currentUserCacheTtlMs = 5 * 60_000
let fallbackCurrentUserCache: { data: CurrentUserData; cached_at: number } | null = null

export function AuthProvider({
  children,
  service,
  api,
  realtimeClient,
}: {
  children: ReactNode
  service?: AuthService
  api?: ApiRequester
  realtimeClient?: RealtimeClient
}) {
  const authService = useMemo(
    () => service ?? createAuthService({ baseUrl: runtimeConfig.apiBaseUrl }),
    [service],
  )
  const foundation = useMemo(() => {
    if (api) return createFoundationService(api)

    const client = createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken: authService.getAccessToken,
    })
    return createFoundationService(client)
  }, [api, authService])
  const [initialized, setInitialized] = useState(false)
  const [accessConnection, setAccessConnection] = useState<AccessConnectionState>('disconnected')
  const [currentUser, setCurrentUser] = useState<CurrentUserData | null>(null)

  const signOut = useCallback(async () => {
    await authService.signOut()
    setAccessConnection('disconnected')
    setCurrentUser(null)
    writeCachedCurrentUser(null)
  }, [authService])

  const refreshMe = useCallback(async () => {
    try {
      const me = await foundation.getMe()
      setCurrentUser(me)
      writeCachedCurrentUser(me)
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        ['AUTH_REQUIRED', 'ACCOUNT_INACTIVE', 'PERMISSION_DENIED'].includes(cause.code)
      ) {
        await signOut()
        return
      }

      throw cause
    } finally {
      setInitialized(true)
    }
  }, [foundation, signOut])

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        await authService.signIn(email, password)
        await refreshMe()
      } catch (cause) {
        setInitialized(true)
        throw cause
      }
    },
    [authService, refreshMe],
  )

  useEffect(() => {
    let active = true

    void withTimeout(authService.getAccessToken(), bootstrapTimeoutMs)
      .then(async (token) => {
        if (!active) return
        if (!token) {
          writeCachedCurrentUser(null)
          setCurrentUser(null)
          setAccessConnection('disconnected')
          setInitialized(true)
          return
        }

        const cachedCurrentUser = readCachedCurrentUser()
        if (cachedCurrentUser !== null) {
          setCurrentUser(cachedCurrentUser.data)
          setInitialized(true)
          if (cachedCurrentUser.fresh) {
            void withTimeout(refreshMe(), bootstrapTimeoutMs).catch(() => undefined)
            return
          }
        }
        await withTimeout(refreshMe(), bootstrapTimeoutMs)
      })
      .catch(() => {
        if (!active) return
        setInitialized(true)
      })

    return () => {
      active = false
    }
  }, [authService, refreshMe])

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      accessConnection,
      currentUser,
      signIn,
      signOut,
      getAccessToken: authService.getAccessToken,
      refreshMe,
    }),
    [
      accessConnection,
      authService.getAccessToken,
      currentUser,
      initialized,
      refreshMe,
      signIn,
      signOut,
    ],
  )

  return (
    <AuthContext value={value}>
      {realtimeClient ? (
        <AccessSync
          client={realtimeClient}
          userId={currentUser?.user.id ?? null}
          refreshMe={refreshMe}
          onConnectionChange={setAccessConnection}
        />
      ) : null}
      {children}
    </AuthContext>
  )
}

function readCachedCurrentUser(): { data: CurrentUserData; fresh: boolean } | null {
  try {
    const raw = window.sessionStorage.getItem(currentUserCacheKey)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as CurrentUserData | { data?: CurrentUserData; cached_at?: number }
    if (isCachedCurrentUser(parsed)) {
      return {
        data: parsed.data,
        fresh: Date.now() - parsed.cached_at < currentUserCacheTtlMs,
      }
    }
    return { data: parsed as CurrentUserData, fresh: false }
  } catch {
    return readFallbackCurrentUser()
  }
}

function writeCachedCurrentUser(value: CurrentUserData | null) {
  if (value === null) {
    fallbackCurrentUserCache = null
    try {
      window.sessionStorage.removeItem(currentUserCacheKey)
    } catch {
      // Some embedded browser contexts block session storage.
    }
    return
  }

  const cached = { cached_at: Date.now(), data: value }
  fallbackCurrentUserCache = cached
  try {
    window.sessionStorage.setItem(currentUserCacheKey, JSON.stringify(cached))
  } catch {
    // Memory fallback keeps login flow usable when storage is unavailable.
  }
}

function readFallbackCurrentUser(): { data: CurrentUserData; fresh: boolean } | null {
  if (fallbackCurrentUserCache === null) return null
  return {
    data: fallbackCurrentUserCache.data,
    fresh: Date.now() - fallbackCurrentUserCache.cached_at < currentUserCacheTtlMs,
  }
}

function isCachedCurrentUser(value: CurrentUserData | { data?: CurrentUserData; cached_at?: number }): value is {
  data: CurrentUserData
  cached_at: number
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'cached_at' in value &&
    typeof value.cached_at === 'number' &&
    value.data !== undefined
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Timed out.')), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (cause) => {
        window.clearTimeout(timeout)
        reject(cause)
      },
    )
  })
}
