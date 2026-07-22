export type HttpErrorCode =
  | 'AUTH_REQUIRED'
  | 'ACCOUNT_INACTIVE'
  | 'WORKSTATION_INVALID'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: HttpErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export function success<T>(data: T, traceId: string, status = 200) {
  return jsonResponse({ success: true, data, trace_id: traceId }, status)
}

export function failure(status: number, code: HttpError['code'], message: string, traceId: string, fields?: Record<string, string[]>) {
  return jsonResponse({ success: false, error: { code, message, ...(fields ? { fields } : {}) }, trace_id: traceId }, status)
}

export function emptyResponse(traceId: string) {
  return new Response(null, { status: 204, headers: responseHeaders(traceId) })
}

export function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(),
  })
}

export function responseHeaders(traceId?: string) {
  const headers = new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-request-id,x-client-device-id,x-workstation-id',
    'content-type': 'application/json',
  })
  if (traceId) headers.set('x-request-id', traceId)
  return headers
}
