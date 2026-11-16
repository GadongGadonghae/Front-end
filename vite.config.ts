import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 층 사이 가져오기는 '@/…'로 쓴다 (FRONTEND.md 2장 의존 방향을 ESLint가 경로로 검사)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
