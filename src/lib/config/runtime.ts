const sharedServerHost = import.meta.env.VITE_SHARED_SERVER_HOST ?? '100.84.228.125'
const fallbackApiBaseUrl = import.meta.env.DEV ? '' : `http://${sharedServerHost}:3200`

export const runtimeConfig = {
  sharedServerHost,
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL, fallbackApiBaseUrl),
  appEnv: normalizeAppEnv(import.meta.env.VITE_APP_ENV),
  sentryDsn: emptyToUndefined(import.meta.env.VITE_SENTRY_DSN),
  sentryTracesSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
}

export type RuntimeConfig = typeof runtimeConfig

function emptyToUndefined(value: string | undefined) {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function parseSampleRate(value: string | undefined) {
  if (value === undefined || value.trim().length === 0) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(Math.max(parsed, 0), 1)
}

function normalizeApiBaseUrl(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  if (trimmed.endsWith('/functions/v1')) return fallback
  return trimmed.replace(/\/$/, '')
}

function normalizeAppEnv(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === 'local' || trimmed === 'cloud-dev') return 'nas-dev'
  return trimmed
}
