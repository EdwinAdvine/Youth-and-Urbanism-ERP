import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
