import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 개발 서버가 /api·/ws 요청을 백엔드(Spring Boot)로 넘긴다 → 브라우저는 같은 주소로 보내니 CORS 설정이 필요 없다
  const backend = loadEnv(mode, process.cwd(), '').BACKEND_URL ?? 'http://localhost:8080'
  return {
  plugins: [vue()],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: backend, changeOrigin: true, ws: true },
    },
  },
  resolve: {
    // 층 사이 가져오기는 '@/…'로 쓴다 (FRONTEND.md 2장 의존 방향을 ESLint가 경로로 검사)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  }
})
