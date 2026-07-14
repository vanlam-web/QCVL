import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import type { ServerRepository } from '../../http-types.js'
import { HttpError, success } from '../../http-response.js'

interface AuthRouteContext {
  request: Request
  repository: ServerRepository
  traceId: string
}

export async function handleAuthRoute(context: AuthRouteContext) {
  const url = new URL(context.request.url)

  if (context.request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    const body = await readJson(context.request)
    const login = (typeof body.login === 'string' ? body.login : typeof body.email === 'string' ? body.email : '').trim().toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const user = await context.repository.findUserByLogin?.(login) ?? await context.repository.findUserByEmail(login)

    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'AUTH_REQUIRED', 'Invalid email or password.')
    }

    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    await context.repository.createSession({ token, userId: user.id, expiresAt })
    return {
      found: true as const,
      response: success({ access_token: token, expires_at: expiresAt.toISOString() }, context.traceId),
    }
  }

  if (context.request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
    const token = getBearerToken(context.request)
    if (token) await context.repository.deleteSession(token)
    return { found: true as const, response: success({}, context.traceId) }
  }

  return { found: false as const }
}

export async function requireCurrentUser(repository: ServerRepository, request: Request, traceId: string) {
  const token = getBearerToken(request)
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  const user = await repository.getSessionUser(token, request.headers.get('x-workstation-id'))
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  if (user.user.id.length === 0) {
    throw new HttpError(500, 'INTERNAL_ERROR', `Invalid current user for trace ${traceId}.`)
  }
  return user
}

function createSessionToken() {
  return `${randomUUID()}.${randomBytes(32).toString('base64url')}`
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, version, n, r, p, salt, storedKey] = passwordHash.split(':')
  if (scheme !== 'scrypt' || version !== 'v1' || !salt || !storedKey) return false

  const key = await scrypt(password, salt, Buffer.from(storedKey, 'hex').length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  const expected = Buffer.from(storedKey, 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolvePromise, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolvePromise(derivedKey)
    })
  })
}
