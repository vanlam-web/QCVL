import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createAuthService } from './auth-service'

describe('createAuthService', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('signs in through the NAS API and stores the access token', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: { access_token: 'token-1' },
          trace_id: 'trace-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    const service = createAuthService({ baseUrl: 'http://nas:3100', fetch: fetcher })

    await service.signIn('ADMIN@QC-OMS.LOCAL ', 'password-1')

    expect(fetcher).toHaveBeenCalledWith(
      'http://nas:3100/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'password-1' }),
      }),
    )
    await expect(service.getAccessToken()).resolves.toBe('token-1')
  })

  test('signs out through the NAS API and clears the stored token', async () => {
    window.localStorage.setItem('qc_oms.access_token', 'token-1')
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true, data: {}, trace_id: 'trace-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const service = createAuthService({ baseUrl: 'http://nas:3100', fetch: fetcher })

    await service.signOut()

    expect(fetcher).toHaveBeenCalledWith(
      'http://nas:3100/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer token-1' },
      }),
    )
    await expect(service.getAccessToken()).resolves.toBeNull()
  })
})
