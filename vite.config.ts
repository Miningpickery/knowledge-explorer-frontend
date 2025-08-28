import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    host: true,
    // HMR 설정 (WebSocket 문제 시 주석 해제)
    hmr: {
      port: 8000,
      host: 'localhost',
      protocol: 'ws'
    },
    // HMR 완전 비활성화 (WebSocket 문제 지속 시 사용)
    // hmr: false,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: http: https: localhost:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';"
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
