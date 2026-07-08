import { describe, expect, test } from 'vitest'
import { pwaOptions } from './vite.config'

describe('PWA shell configuration', () => {
  test('caches app shell assets without claiming offline business flows', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate')
    expect(pwaOptions.manifest).toMatchObject({
      name: 'QC-OMS',
      short_name: 'QC-OMS',
      start_url: '/',
      display: 'standalone',
    })
    expect(pwaOptions.manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/pwa-icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
        }),
      ]),
    )
    expect(pwaOptions.workbox).toMatchObject({
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      navigateFallback: '/index.html',
    })
  })
})
