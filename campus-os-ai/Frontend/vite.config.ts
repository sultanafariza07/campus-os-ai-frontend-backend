import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy every /api/* request to the backend — avoids CORS entirely
      '/api': {
        // Local dev backend (edit if you want to point to a deployed backend)
        target: 'http://localhost:3001',
        changeOrigin: true,
      },

    },
  },
})
