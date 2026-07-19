import { createApiClient } from './api/client'
import { runtimeConfig } from './config/runtime'

export interface SystemClockApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

let systemClockOffsetMs = 0
let systemClockReady = false

export function currentSystemDate() {
  return new Date(Date.now() + systemClockOffsetMs)
}

export function currentSystemISOString() {
  return currentSystemDate().toISOString()
}

export function isSystemClockReady() {
  return systemClockReady
}

export async function syncSystemClock(api: SystemClockApiRequester) {
  const requestedAt = Date.now()
  const response = await api.request<{ now: string }>('/api/v1/system/clock')
  const receivedAt = Date.now()
  const serverTime = Date.parse(response.now)
  if (!Number.isFinite(serverTime)) throw new Error('Server clock response is invalid.')
  const clientMidpoint = requestedAt + Math.round((receivedAt - requestedAt) / 2)
  systemClockOffsetMs = serverTime - clientMidpoint
  systemClockReady = true
}

export function createBrowserSystemClockApi(getAccessToken: () => Promise<string | null>) {
  return createApiClient({
    baseUrl: runtimeConfig.apiBaseUrl,
    getAccessToken,
  })
}

export function setSystemClockForTests(nowIso: string) {
  const serverTime = Date.parse(nowIso)
  if (!Number.isFinite(serverTime)) throw new Error('Test system clock is invalid.')
  systemClockOffsetMs = serverTime - Date.now()
  systemClockReady = true
}

export function resetSystemClockForTests() {
  systemClockOffsetMs = 0
  systemClockReady = false
}
