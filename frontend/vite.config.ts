import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// Bundle visualizer — run: ANALYZE=true npm run build
// to open an interactive treemap of the bundle.
// Install with: npm i -D rollup-plugin-visualizer
let visualizer: ((opts: Record<string, unknown>) => unknown) | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  visualizer = require('rollup-plugin-visualizer').visualizer
} catch { /* not installed */ }

export default defineConfig({
  plugins: [
    react(),
    // Bundle analysis (only when ANALYZE=true)
    ...(process.env.ANALYZE === 'true' && visualizer ? [visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/bundle-analysis.html',
    })] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Urban Vibes Dynamics',
        short_name: 'Urban Vibes Dynamics',
        description: 'Urban Vibes Dynamics — Self-hosted enterprise platform',
        theme_color: '#51459d',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Push notification handlers + SKIP_WAITING message listener
        importScripts: ['/push-sw.js'],
        runtimeCaching: [
          {
            // Docs API
            urlPattern: /^\/api\/v1\/docs\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'docs-api', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            // Form schemas — offline use
            urlPattern: /^\/api\/v1\/forms\/[^/]+$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'forms-schema', expiration: { maxAgeSeconds: 900, maxEntries: 50 } },
          },
          {
            // Notes, notebooks, note-databases — offline use
            urlPattern: /^https?:\/\/.*\/api\/v1\/(notes|notebooks|note-databases).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'notes-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // ERP reference data (employees, customers, products) — offline pickers
            urlPattern: /^\/api\/v1\/(hr\/employees|crm\/contacts|inventory\/products|finance\/gl-accounts)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'erp-reference-data',
              expiration: { maxAgeSeconds: 1800, maxEntries: 20 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Core module endpoints — 30-min TTL, 5s network timeout
            urlPattern: /^\/api\/v1\/(finance|hr|crm|projects|inventory|support)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'module-api-cache',
              expiration: { maxAgeSeconds: 1800, maxEntries: 200 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // General API — network-first, broad match
            urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images — cache-first, long TTL
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@apps': path.resolve(__dirname, './src/apps'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Only split pure utility libs that never touch React at module scope
          if (id.includes('node_modules')) {
            if (id.includes('axios') || id.includes('date-fns') || id.includes('lodash') || id.includes('zod')) {
              return 'vendor-utils'
            }
            // All other node_modules: let Vite/Rollup handle chunking naturally
            // (no catch-all — avoids splitting React-dependent libs away from React)
            return
          }
          // Feature code-splitting by module
          const m = id.match(/(?:features|apps\/yu-)(finance|hr|crm|inventory|projects|forms|admin|mail|calendar|docs|notes|drive|analytics|teams|pos|ecommerce|manufacturing|support|supplychain|supply-chain)\//)
          if (m) {
            return `mod-${m[1].replace('-', '')}`
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true,
    },
    hmr: {
      host: 'localhost',
      port: 3010,
      clientPort: 3010,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8010',
        changeOrigin: false,
        ws: true,
      },
      '/ws': {
        target: process.env.VITE_WS_TARGET || 'ws://localhost:8010',
        ws: true,
        changeOrigin: false,
      },
    },
  },
})
