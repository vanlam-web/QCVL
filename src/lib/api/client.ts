import type { ApiErrorCode, ApiEnvelope } from './types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly traceId: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiClientOptions {
  baseUrl: string
  getAccessToken: () => Promise<string | null>
  fetch?: typeof fetch
}

const inFlightGetRequests = new WeakMap<typeof fetch, Map<string, Promise<unknown>>>()
const completedGetRequests = new WeakMap<typeof fetch, Map<string, { expiresAt: number; value: unknown }>>()
const completedGetCacheTtlMs = 1000
const clientDeviceIdStorageKey = 'qc-oms.client-device-id.v1'

export function createApiClient(options: ApiClientOptions) {
  const fetcher = options.fetch ?? fetch
  const baseUrl = normalizeApiBaseUrl(options.baseUrl)

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const accessToken = await options.getAccessToken()
      const inFlightKey = makeInFlightGetKey(baseUrl, path, accessToken, init)
      if (inFlightKey !== null) {
        const inFlightByFetcher = getInFlightByFetcher(fetcher)
        const existingRequest = inFlightByFetcher.get(inFlightKey)
        if (existingRequest !== undefined) return existingRequest as Promise<T>

        const completedByFetcher = getCompletedByFetcher(fetcher)
        const completedRequest = completedByFetcher.get(inFlightKey)
        if (completedRequest !== undefined) {
          if (completedRequest.expiresAt > Date.now()) return completedRequest.value as T
          completedByFetcher.delete(inFlightKey)
        }

        const requestPromise = executeRequest<T>(fetcher, baseUrl, path, init, accessToken)
        inFlightByFetcher.set(inFlightKey, requestPromise)
        try {
          const value = await requestPromise
          completedByFetcher.set(inFlightKey, {
            expiresAt: Date.now() + completedGetCacheTtlMs,
            value,
          })
          return value
        } finally {
          inFlightByFetcher.delete(inFlightKey)
        }
      }

      getCompletedByFetcher(fetcher).clear()
      return executeRequest<T>(fetcher, baseUrl, path, init, accessToken)
    },
  }
}

async function executeRequest<T>(
  fetcher: typeof fetch,
  baseUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string | null,
): Promise<T> {
  const traceId = createRequestId()
  const headers = new Headers(init.headers)
  headers.set('x-request-id', traceId)
  headers.set('content-type', headers.get('content-type') ?? 'application/json')
  headers.set('x-client-device-id', getClientDeviceId())

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`)
  }

  let response: Response
  try {
    response = await fetcher(`${baseUrl}${path}`, { ...init, headers })
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw new ApiError(0, 'INTERNAL_ERROR', 'Không kết nối được máy chủ.', traceId)
  }

  const responseTraceId = response.headers.get('x-request-id') ?? traceId
  let body: ApiEnvelope<T>
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw new ApiError(
      response.status,
      'INTERNAL_ERROR',
      'Máy chủ trả dữ liệu không hợp lệ.',
      responseTraceId,
    )
  }

  if (!body.success) {
    throw new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.trace_id || responseTraceId,
      body.error.fields,
    )
  }

  return body.data
}

function getClientDeviceId() {
  if (typeof window === 'undefined') return createRequestId()

  try {
    const existing = window.localStorage.getItem(clientDeviceIdStorageKey)
    if (existing !== null && existing.trim().length > 0) return existing

    const next = createRequestId()
    window.localStorage.setItem(clientDeviceIdStorageKey, next)
    return next
  } catch {
    return createRequestId()
  }
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getInFlightByFetcher(fetcher: typeof fetch) {
  let requests = inFlightGetRequests.get(fetcher)
  if (requests === undefined) {
    requests = new Map<string, Promise<unknown>>()
    inFlightGetRequests.set(fetcher, requests)
  }
  return requests
}

function getCompletedByFetcher(fetcher: typeof fetch) {
  let requests = completedGetRequests.get(fetcher)
  if (requests === undefined) {
    requests = new Map<string, { expiresAt: number; value: unknown }>()
    completedGetRequests.set(fetcher, requests)
  }
  return requests
}

function makeInFlightGetKey(
  baseUrl: string,
  path: string,
  accessToken: string | null,
  init: RequestInit,
) {
  const method = init.method?.toUpperCase() ?? 'GET'
  if (method !== 'GET') return null
  if (init.body !== undefined || init.headers !== undefined || init.signal !== undefined) return null
  return JSON.stringify([baseUrl, path, accessToken])
}

function normalizeApiBaseUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '')

  if (normalized.endsWith('/api') || normalized.endsWith('/api/v1')) {
    throw new Error('VITE_API_BASE_URL must not include /api because client requests already include /api/v1')
  }

  return normalized
}
