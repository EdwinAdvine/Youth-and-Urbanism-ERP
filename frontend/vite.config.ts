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
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router') || id.includes('scheduler')) {
              return 'vendor-react'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix'
            }
            return 'vendor-misc'
          }
          // Match both features/ and apps/ paths for code splitting
          const m = id.match(/(?:features|apps\/yu-)(finance|hr|crm|inventory|projects|forms|admin|mail|calendar|docs|notes|drive|analytics|teams|pos|ecommerce|manufacturing|support|supplychain|supply-chain)\//)
          if (m) {
            const mod = m[1].replace('-', '')
            return `mod-${mod}`
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
