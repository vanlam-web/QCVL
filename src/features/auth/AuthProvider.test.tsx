import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'
import type { AuthService } from './auth-service'
import { ApiError } from '../../lib/api/client'
import type { CurrentUserData } from '../../lib/api/types'
import type { RealtimeChannel } from '../../lib/realtime/access-channel'
import type { ApiRequester } from '../users/foundation-service'

const currentUser: CurrentUserData = {
  user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
  organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
  workstation: null,
  permissions: ['perm.create_order'],
}

beforeEach(() => {
  window.sessionStorage.clear()
})

function makeAuthService(token: string | null): AuthService {
  return {
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(token),
  }
}

function StatusProbe() {
  const auth = useAuth()
  return (
    <div>
      <span>{auth.initialized ? 'ready' : 'booting'}</span>
      <span>{auth.currentUser?.user.id ?? 'anonymous'}</span>
      <span>{auth.accessConnection}</span>
    </div>
  )
}

it('marks bootstrap ready when no stored session exists', async () => {
  render(
    <AuthProvider
      service={makeAuthService(null)}
      api={{ request: vi.fn() }}
      realtimeClient={{ channel: vi.fn(), removeChannel: vi.fn() }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  expect(screen.getByText('anonymous')).toBeInTheDocument()
})

it('clears the active user when the stored token disappears during the session', async () => {
  const api = { request: vi.fn().mockResolvedValue(currentUser) }
  const { rerender } = render(
    <AuthProvider
      service={makeAuthService('token')}
      api={api}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('u-1')).toBeInTheDocument()

  rerender(
    <AuthProvider
      service={makeAuthService(null)}
      api={api}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
})

it('keeps protected routes pending while a stored session is being restored', () => {
  render(
    <AuthProvider
      service={{
        signIn: vi.fn(),
        signOut: vi.fn(),
        getAccessToken: vi.fn(() => new Promise<string | null>(() => undefined)),
      }}
      api={{ request: vi.fn() }}
      realtimeClient={{ channel: vi.fn(), removeChannel: vi.fn() }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(screen.getByText('booting')).toBeInTheDocument()
  expect(screen.getByText('anonymous')).toBeInTheDocument()
})

it('marks bootstrap ready when restoring the session fails', async () => {
  render(
    <AuthProvider
      service={{
        signIn: vi.fn(),
        signOut: vi.fn(),
        getAccessToken: vi.fn().mockRejectedValue(new Error('offline')),
      }}
      api={{ request: vi.fn() }}
      realtimeClient={{ channel: vi.fn(), removeChannel: vi.fn() }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  expect(screen.getByText('anonymous')).toBeInTheDocument()
})

it('returns to ready state when sign in fails', async () => {
  function SignInProbe() {
    const auth = useAuth()
    return (
      <button type="button" onClick={() => void auth.signIn('admin@qc.local', 'bad').catch(() => undefined)}>
        {auth.initialized ? 'ready' : 'booting'}
      </button>
    )
  }

  render(
    <AuthProvider
      service={{
        signIn: vi.fn(async () => {
          throw new Error('bad credentials')
        }),
        signOut: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue(null),
      }}
      api={{ request: vi.fn() }}
      realtimeClient={{ channel: vi.fn(), removeChannel: vi.fn() }}
    >
      <SignInProbe />
    </AuthProvider>,
  )

  await screen.findByRole('button', { name: 'ready' })
  await userEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('button', { name: 'ready' })).toBeInTheDocument()
})

it('keeps auth initialized while sign in is pending', async () => {
  function SignInProbe() {
    const auth = useAuth()
    return (
      <button type="button" onClick={() => void auth.signIn('admin@qc.local', '123456').catch(() => undefined)}>
        {auth.initialized ? 'ready' : 'booting'}
      </button>
    )
  }

  render(
    <AuthProvider
      service={{
        signIn: vi.fn(() => new Promise<void>(() => undefined)),
        signOut: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue(null),
      }}
      api={{ request: vi.fn() }}
      realtimeClient={{ channel: vi.fn(), removeChannel: vi.fn() }}
    >
      <SignInProbe />
    </AuthProvider>,
  )

  await screen.findByRole('button', { name: 'ready' })
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button', { name: 'ready' })).toBeInTheDocument()
})

it('restores /me and refreshes when the access channel changes', async () => {
  let signal: () => void = () => undefined
  const channel: RealtimeChannel = {
    on: (_type, _filter, callback) => {
      signal = callback
      return channel
    },
    subscribe: (callback) => {
      callback('SUBSCRIBED')
      return channel
    },
    unsubscribe: vi.fn(),
  }
  const api = { request: vi.fn().mockResolvedValue(currentUser) }

  render(
    <AuthProvider
      service={makeAuthService('token')}
      api={api}
      realtimeClient={{ channel: vi.fn(() => channel), removeChannel: vi.fn() }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('u-1')).toBeInTheDocument()
  expect(await screen.findByText('connected')).toBeInTheDocument()

  signal()
  await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2))
})

it('uses cached /me data immediately while refreshing the session', async () => {
  let resolveMe: (value: CurrentUserData) => void = () => undefined
  const request = vi.fn(<T,>() => new Promise<T>((resolve) => {
    resolveMe = (value) => resolve(value as T)
  }) as Promise<T>) as ApiRequester['request']
  const api: ApiRequester = {
    request,
  }
  window.sessionStorage.setItem(
    'qc-oms.auth.current-user.v2',
    JSON.stringify({ cached_at: Date.now() - 301_000, data: currentUser }),
  )

  render(
    <AuthProvider
      service={makeAuthService('token')}
      api={api}
      realtimeClient={{
        channel: vi.fn(() => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
          unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
      }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  expect(screen.getByText('u-1')).toBeInTheDocument()
  expect(api.request).toHaveBeenCalledTimes(1)

  resolveMe({
    ...currentUser,
    user: { ...currentUser.user, display_name: 'Cashier refreshed' },
  })

  await waitFor(() => {
    expect(JSON.parse(window.sessionStorage.getItem('qc-oms.auth.current-user.v2') ?? '{}')).toMatchObject({
      data: { user: { display_name: 'Cashier refreshed' } },
    })
  })
})

it('does not reuse the memory user fallback when sessionStorage is available but empty', async () => {
  const firstApi = { request: vi.fn().mockResolvedValue(currentUser) }
  const firstRender = render(
    <AuthProvider service={makeAuthService('token')} api={firstApi}>
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('u-1')).toBeInTheDocument()
  firstRender.unmount()
  window.sessionStorage.clear()

  const secondApi: ApiRequester = {
    request: vi.fn(<T,>() => new Promise<T>(() => undefined)) as ApiRequester['request'],
  }
  render(
    <AuthProvider service={makeAuthService('token')} api={secondApi}>
      <StatusProbe />
    </AuthProvider>,
  )

  expect(screen.getByText('booting')).toBeInTheDocument()
  expect(screen.getByText('anonymous')).toBeInTheDocument()
})

it('keeps fresh cached /me data visible while refreshing the session in background', async () => {
  const api = { request: vi.fn().mockResolvedValue(currentUser) }
  window.sessionStorage.setItem(
    'qc-oms.auth.current-user.v2',
    JSON.stringify({ cached_at: Date.now(), data: currentUser }),
  )

  render(
    <AuthProvider
      service={makeAuthService('token')}
      api={api}
      realtimeClient={{
        channel: vi.fn(() => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
          unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
      }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  expect(screen.getByText('u-1')).toBeInTheDocument()
  await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1))
})

it('revalidates a fresh cached /me session and signs out when the token is no longer valid', async () => {
  const signOut = vi.fn()
  const api = {
    request: vi.fn().mockRejectedValue(new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.', 'trace-auth')),
  }
  window.sessionStorage.setItem(
    'qc-oms.auth.current-user.v2',
    JSON.stringify({ cached_at: Date.now(), data: currentUser }),
  )

  render(
    <AuthProvider
      service={{
        signIn: vi.fn(),
        signOut,
        getAccessToken: vi.fn().mockResolvedValue('stale-token'),
      }}
      api={api}
      realtimeClient={{
        channel: vi.fn(() => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
          unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
      }}
    >
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
})
