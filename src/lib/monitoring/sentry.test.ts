import { describe, expect, test } from 'vitest'
import { initializeSentryMonitoring } from './sentry'

describe('initializeSentryMonitoring', () => {
  test('does not initialize Sentry when no DSN is configured', () => {
    const calls: unknown[] = []

    const started = initializeSentryMonitoring(
      { init: (options) => calls.push(options) },
      { appEnv: 'cloud-dev', sentryDsn: undefined, sentryTracesSampleRate: 0 },
    )

    expect(started).toBe(false)
    expect(calls).toEqual([])
  })

  test('initializes Sentry with environment and trace sampling when DSN exists', () => {
    const calls: unknown[] = []

    const started = initializeSentryMonitoring(
      { init: (options) => calls.push(options) },
      {
        appEnv: 'cloud-dev',
        sentryDsn: 'https://public@sentry.example/1',
        sentryTracesSampleRate: 0.2,
      },
    )

    expect(started).toBe(true)
    expect(calls).toEqual([
      {
        dsn: 'https://public@sentry.example/1',
        environment: 'cloud-dev',
        tracesSampleRate: 0.2,
      },
    ])
  })
})
