import { describe, expect, test } from 'vitest'
import { createHttpHandler, hashPassword, type ServerRepository } from './http'

const user = {
  id: 'user-1',
  email: 'admin@qc-oms.local',
  password_hash: '',
  organization_id: 'org-1',
  display_name: 'Admin',
  status: 'active' as const,
}

function repository(passwordHash: string): ServerRepository {
  const sessions = new Map<string, string>()
  const userWithPassword = { ...user, password_hash: passwordHash }

  return {
    async findUserByEmail(email) {
      return email === user.email ? userWithPassword : null
    },
    async createSession(input) {
      sessions.set(input.token, input.userId)
    },
    async deleteSession(token) {
      sessions.delete(token)
    },
    async getSessionUser(token) {
      return sessions.get(token) === user.id
        ? {
            user: { id: user.id, email: user.email, display_name: user.display_name },
            organization: { id: 'org-1', code: 'VAN-LAM', name: 'Xuong Van Lam' },
            workstation: null,
            permissions: ['perm.create_order', 'perm.manage_users'],
          }
        : null
    },
    async listWorkstations() {
      return [{ id: 'ws-1', code: 'POS-01', name: 'Quay 1', status: 'active' }]
    },
  }
}

describe('createHttpHandler', () => {
  test('logs in with a password and returns the current user with the session token', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })
    const login = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'ChangeMe123!' }),
      }),
    )
    const loginBody = await login.json()

    expect(login.status).toBe(200)
    expect(loginBody.data.access_token).toEqual(expect.any(String))

    const me = await handler(
      new Request('http://api.local/api/v1/me', {
        headers: { authorization: `Bearer ${loginBody.data.access_token}` },
      }),
    )
    const meBody = await me.json()

    expect(me.status).toBe(200)
    expect(meBody.data.user.email).toBe('admin@qc-oms.local')
    expect(meBody.data.permissions).toContain('perm.manage_users')
  })

  test('rejects invalid login without creating a token', async () => {
    const handler = createHttpHandler({ repository: repository(await hashPassword('ChangeMe123!')) })

    const response = await handler(
      new Request('http://api.local/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@qc-oms.local', password: 'wrong-password' }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })
})
