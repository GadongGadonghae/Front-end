import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import { setClock } from '@/clock'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/state.css'

createApp(App).use(router).mount('#app')

// 시연용 가상 시계 (11/21): 실서버면 백엔드 시계(GET /api/sim/clock)를 5초마다 받아 화면 "지금"을 맞춘다
if ((import.meta.env.VITE_DATA_SOURCE ?? 'mock') === 'api') {
  const base = import.meta.env.VITE_API_BASE ?? '/api'
  const sync = () => fetch(`${base}/sim/clock`).then((r) => (r.ok ? r.json() : null))
    .then((c: { now: string; speed: number; active: boolean } | null) => { if (c) setClock(c.now, c.speed, c.active) })
    .catch(() => {})
  sync()
  setInterval(sync, 5000)
}
