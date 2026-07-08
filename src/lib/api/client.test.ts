import { ApiError, createApiClient } from './client'

it('sends bearer token and request id without workstation coupling', async () => {
  const calls: [RequestInfo | URL, RequestInit | undefined][] = []
  const fetchSpy: typeof fetch = async (input, init) => {
    calls.push([input, init])
    return new Response(JSON.stringify({ success: true, data: { ok: true }, trace_id: 'trace' }), {
      status: 200,
    })
  }
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => 'token-123',
    fetch: fetchSpy as typeof fetch,
  })

  await expect(client.request('/api/v1/me')).resolves.toEqual({ ok: true })
  const request = calls[0][1] as RequestInit
  const headers = request.headers as Headers
  expect(headers.get('authorization')).toBe('Bearer token-123')
  expect(headers.has('x-workstation-id')).toBe(false)
  expect(headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/)
})

it('throws typed API errors preserving metadata', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => null,
    fetch: (async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid', fields: { email: ['bad'] } },
          trace_id: 'trace-err',
        }),
        { status: 400 },
      )) as typeof fetch,
  })

  await expect(client.request('/api/v1/users')).rejects.toMatchObject({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Invalid',
    traceId: 'trace-err',
    fields: { email: ['bad'] },
  })
})

it('deduplicates concurrent GET requests for the same resource and token', async () => {
  let fetchCount = 0
  const responseResolvers: Array<(response: Response) => void> = []
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => 'token-123',
    fetch: (async () => {
      fetchCount += 1
      return new Promise<Response>((resolve) => {
        responseResolvers.push(resolve)
      })
    }) as typeof fetch,
  })

  const first = client.request('/api/v1/products?status=active&page=1&page_size=12')
  const second = client.request('/api/v1/products?status=active&page=1&page_size=12')
  await Promise.resolve()
  responseResolvers.forEach((resolveResponse) =>
    resolveResponse(
    new Response(JSON.stringify({ success: true, data: { items: [] }, trace_id: 'trace' }), {
      status: 200,
    }),
    ),
  )

  await expect(Promise.all([first, second])).resolves.toEqual([{ items: [] }, { items: [] }])
  expect(fetchCount).toBe(1)
})

it('does not deduplicate concurrent write requests', async () => {
  let fetchCount = 0
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => 'token-123',
    fetch: (async () => {
      fetchCount += 1
      return new Response(JSON.stringify({ success: true, data: { ok: true }, trace_id: 'trace' }), {
        status: 200,
      })
    }) as typeof fetch,
  })

  await Promise.all([
    client.request('/api/v1/products', { method: 'POST', body: JSON.stringify({ name: 'A' }) }),
    client.request('/api/v1/products', { method: 'POST', body: JSON.stringify({ name: 'A' }) }),
  ])

  expect(fetchCount).toBe(2)
})

it('reuses a recently completed GET request for the same resource and token', async () => {
  let fetchCount = 0
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => 'token-123',
    fetch: (async () => {
      fetchCount += 1
      return new Response(JSON.stringify({ success: true, data: { count: fetchCount }, trace_id: 'trace' }), {
        status: 200,
      })
    }) as typeof fetch,
  })

  await expect(client.request('/api/v1/price-lists')).resolves.toEqual({ count: 1 })
  await expect(client.request('/api/v1/price-lists')).resolves.toEqual({ count: 1 })
  expect(fetchCount).toBe(1)
})

it('clears completed GET cache before write requests', async () => {
  let fetchCount = 0
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => 'token-123',
    fetch: (async () => {
      fetchCount += 1
      return new Response(JSON.stringify({ success: true, data: { count: fetchCount }, trace_id: 'trace' }), {
        status: 200,
      })
    }) as typeof fetch,
  })

  await client.request('/api/v1/products?page=1&page_size=15')
  await client.request('/api/v1/products', { method: 'POST', body: JSON.stringify({ name: 'A' }) })
  await expect(client.request('/api/v1/products?page=1&page_size=15')).resolves.toEqual({ count: 3 })
  expect(fetchCount).toBe(3)
})

it('rejects base URLs that already include the API route prefix', async () => {
  expect(() =>
    createApiClient({
      baseUrl: 'https://example.supabase.co/functions/v1/api',
      getAccessToken: async () => null,
      fetch: (async () =>
        new Response(JSON.stringify({ success: true, data: {}, trace_id: 'trace' }), {
          status: 200,
        })) as typeof fetch,
    }),
  ).toThrow(
    'VITE_API_BASE_URL must not include /api because client requests already include /api/v1',
  )
})

it('maps network failures to typed internal API errors with the request id', async () => {
  let requestId = ''
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => null,
    fetch: (async (_input, init) => {
      requestId = (init?.headers as Headers).get('x-request-id') ?? ''
      throw new TypeError('Failed to fetch')
    }) as typeof fetch,
  })

  let error: unknown
  try {
    await client.request('/api/v1/me')
  } catch (cause) {
    error = cause
  }

  expect(error).toMatchObject({
    status: 0,
    code: 'INTERNAL_ERROR',
    message: 'Không kết nối được máy chủ.',
    traceId: requestId,
  } satisfies Partial<ApiError>)
  expect(requestId).toMatch(/[0-9a-f-]{36}/)
})

it('maps malformed server responses to typed internal API errors with response request id', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => null,
    fetch: (async () =>
      new Response('not-json', {
        status: 500,
        headers: { 'x-request-id': 'server-trace-1' },
      })) as typeof fetch,
  })

  await expect(client.request('/api/v1/me')).rejects.toMatchObject({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Máy chủ trả dữ liệu không hợp lệ.',
    traceId: 'server-trace-1',
  } satisfies Partial<ApiError>)
})
