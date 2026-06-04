import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Read PORT from .env so the dev proxy always targets the same port the API
// server (server/index.ts) listens on — change PORT in one place (.env) only.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '8787'
  return {
    plugins: [react()],
    server: {
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
    },
  }
})
