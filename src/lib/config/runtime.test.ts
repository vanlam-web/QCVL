import { runtimeConfig } from './runtime'

it('defaults browser runtime to the shared NAS API when frontend env is missing', () => {
  expect(runtimeConfig.sharedServerHost).toBe('100.84.228.125')
  expect(runtimeConfig.apiBaseUrl).toBe('http://100.84.228.125:3200')
  expect(runtimeConfig.appEnv).toBe('nas-dev')
  expect(runtimeConfig.sentryDsn).toBeUndefined()
  expect(runtimeConfig.sentryTracesSampleRate).toBe(0)
})
