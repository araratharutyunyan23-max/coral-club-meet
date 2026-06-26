import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to the Go backend so the browser talks to a
// single origin (no CORS needed in development). `host: true` exposes the dev
// server on the LAN so you can test across devices.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/healthz': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/recordings': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
