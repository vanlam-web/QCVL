import { runtimeConfig, type RuntimeConfig } from '../config/runtime'

interface SentryAdapter {
  init(options: {
    dsn: string
    environment: string
    tracesSampleRate: number
  }): void
}

export function initializeSentryMonitoring(
  sentry: SentryAdapter,
  config: Pick<RuntimeConfig, 'appEnv' | 'sentryDsn' | 'sentryTracesSampleRate'> = runtimeConfig,
) {
  if (config.sentryDsn === undefined) return false

  sentry.init({
    dsn: config.sentryDsn,
    environment: config.appEnv,
    tracesSampleRate: config.sentryTracesSampleRate,
  })

  return true
}

export async function startSentryMonitoring(config: Pick<RuntimeConfig, 'appEnv' | 'sentryDsn' | 'sentryTracesSampleRate'> = runtimeConfig) {
  if (config.sentryDsn === undefined) return false

  const sentry = await import('@sentry/react')
  return initializeSentryMonitoring(sentry, config)
}
