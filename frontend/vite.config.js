import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Doctor web dev server. The /api proxy forwards to the CLINIC-001 backend on
// :4000 so the browser makes same-origin requests (no CORS) — the apiClient
// attaches the x-role: doctor header on each call.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
