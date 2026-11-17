// 라우트 표 (FRONTEND.md 5장). 화면이 만들어지기 전까지는 자리표시 페이지를 쓴다.
// 로그인 확인 (FN-016): /login 외에는 로그인해야 들어가고, 안 했으면 /login?redirect=원래경로
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn } from '@/composables/useAuth'

declare module 'vue-router' {
  interface RouteMeta {
    /** 화면정의서 화면 ID */
    screen?: string
    /** 화면 이름 */
    title?: string
    /** 상단 메뉴에서 켜질 항목 */
    menu?: '대시보드' | '생산' | '가동률' | '예지보전' | '알람이력' | '리포트' | '설정'
    /** 로그인 없이 들어갈 수 있는 화면 */
    public?: boolean
  }
}

const Placeholder = () => import('@/pages/ScrPlaceholderPage.vue')

/** 상단 메뉴가 있는 화면들 */
const appRoutes: RouteRecordRaw[] = [
  { path: '', component: () => import('@/pages/Scr001DashboardPage.vue'), meta: { screen: 'SCR-001', title: '대시보드', menu: '대시보드' } },
  { path: 'lines/:lineId(L[1-6]|PT)', component: () => import('@/pages/Scr010LinePage.vue'), meta: { screen: 'SCR-010', title: '라인 상세', menu: '대시보드' } },
  { path: 'lines/:lineId(L[1-6])/:process(slit|press|weld)', component: () => import('@/pages/Scr002ProcessPage.vue'), meta: { screen: 'SCR-002-2~4', title: '공정 상세', menu: '대시보드' } },
  { path: 'lines/PT/paint', component: () => import('@/pages/Scr002ProcessPage.vue'), meta: { screen: 'SCR-002-5', title: '도장 상세', menu: '대시보드' } },
  { path: 'inbound', component: () => import('@/pages/Scr0021InboundPage.vue'), meta: { screen: 'SCR-002-1', title: '코일입고 상세', menu: '대시보드' } },
  { path: 'outbound', component: () => import('@/pages/Scr0026OutboundPage.vue'), meta: { screen: 'SCR-002-6', title: '출고 상세', menu: '대시보드' } },
  { path: 'production', component: Placeholder, meta: { screen: 'SCR-011', title: '생산 조회', menu: '생산' } },
  { path: 'utilization', component: () => import('@/pages/Scr003UtilizationPage.vue'), meta: { screen: 'SCR-003', title: '가동률', menu: '가동률' } },
  { path: 'pdm', component: Placeholder, meta: { screen: 'SCR-004', title: '예지보전', menu: '예지보전' } },
  { path: 'alarms', component: Placeholder, meta: { screen: 'SCR-006', title: '알람·비가동 이력', menu: '알람이력' } },
  { path: 'reports/daily', component: Placeholder, meta: { screen: 'SCR-007', title: '일일 생산 리포트', menu: '리포트' } },
  { path: 'reports/replan/:id?', component: Placeholder, meta: { screen: 'SCR-007', title: '계획수정 보고서', menu: '리포트' } },
  { path: 'settings/target', component: Placeholder, meta: { screen: 'SCR-008', title: '생산 목표 설정', menu: '설정' } },
  { path: 'settings/limits', component: Placeholder, meta: { screen: 'SCR-009', title: '관리값 기준 설정', menu: '설정' } },
  { path: 'reports', redirect: '/reports/daily' },
  { path: 'settings', redirect: '/settings/target' },
]

// 부품 견본: 개발 모드에서만 (빌드 결과에는 들어가지 않음)
if (import.meta.env.DEV) {
  appRoutes.push({ path: 'dev/parts', component: () => import('@/pages/DevPartsPage.vue'), meta: { title: '부품 견본' } })
}

const routes: RouteRecordRaw[] = [
  { path: '/login', component: () => import('@/pages/Scr000LoginPage.vue'), meta: { screen: 'SCR-000', title: '로그인', public: true } },
  { path: '/', component: () => import('@/layouts/AppShell.vue'), children: appRoutes },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const loggedIn = isLoggedIn()
  if (!to.meta.public && !loggedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.path === '/login' && loggedIn) return '/'
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 라인가동현황` : '라인가동현황'
})
