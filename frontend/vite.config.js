import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Doctor web dev server. The /api proxy forwards to the CLINIC-001 backend so the
// browser makes same-origin requests (no CORS) — the apiClient attaches the
// x-role: doctor header on each call. Override the target with VITE_API_TARGET
// when the backend is not on the default port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
