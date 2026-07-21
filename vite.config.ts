import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'

export const pwaOptions = {
  registerType: 'autoUpdate',
  includeAssets: ['pwa-icon.svg', 'brand-logo.png'],
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
        src: '/brand-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
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

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(env.VITE_ENABLE_PWA === 'true' ? [VitePWA(pwaOptions)] : []),
    ],
    server: {
      watch: {
        ignored: ['**/backups/**', '**/logs/**', '**/dist/**', '**/dist-server/**', '**/coverage/**'],
      },
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY_TARGET ?? 'http://100.84.228.125:3200',
          changeOrigin: true,
        },
      },
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      testTimeout: 10_000,
    },
  }
})
