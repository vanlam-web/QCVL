import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'

export const pwaOptions = {
  registerType: 'autoUpdate',
  includeAssets: ['pwa-icon.svg'],
  manifest: {
    name: 'QC-OMS',
    short_name: 'QC-OMS',
    description: 'QC-OMS operations app shell',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#9a3412',
    icons: [
      {
        src: '/pwa-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    navigateFallback: '/index.html',
  },
} satisfies Partial<VitePWAOptions>

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.VITE_ENABLE_PWA === 'true' ? [VitePWA(pwaOptions)] : []),
  ],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 10_000,
  },
})
