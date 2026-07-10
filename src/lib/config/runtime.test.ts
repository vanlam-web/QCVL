import { runtimeConfig } from './runtime'

it('defaults browser runtime to same-origin API in dev when frontend env is missing', () => {
  expect(runtimeConfig.sharedServerHost).toBe('100.84.228.125')
  expect(runtimeConfig.apiBaseUrl).toBe('')
  expect(runtimeConfig.appEnv).toBe('nas-dev')
  expect(runtimeConfig.sentryDsn).toBeUndefined()
  expect(runtimeConfig.sentryTracesSampleRate).toBe(0)
})
