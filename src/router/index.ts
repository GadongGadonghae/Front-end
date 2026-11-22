// 라우트 표 (FRONTEND.md 5장).
// 로그인 확인 (FN-016): /login 외에는 로그인해야 들어가고, 안 했으면 /login?redirect=원래경로
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { hasPerm, homePath, isLoggedIn, currentRole } from '@/composables/useAuth'
import { settingsTabsFor } from '@/lib/permissions'
import { installViewTransition } from '@/router/viewTransition'

declare module 'vue-router' {
  interface RouteMeta {
    /** 화면정의서 화면 ID */
    screen?: string
    /** 화면 이름 */
    title?: string
    /** 상단 메뉴에서 켜질 항목 */
    menu?: '대시보드' | '생산' | '가동률' | '예지보전' | '알람이력' | 'AI 리포트' | '설정'
    /** 로그인 없이 들어갈 수 있는 화면 */
    public?: boolean
    /** 이 권한이 있어야 들어가는 화면 (없으면 첫 화면으로) */
    perm?: import('@/lib/access').Perm
    /** 보고서 문서만 (임시 MES 틀 안, 11/21) */
    docOnly?: boolean
  }
}


/** 상단 메뉴가 있는 화면들 */
const appRoutes: RouteRecordRaw[] = [
  { path: '', component: () => import('@/pages/Scr001DashboardPage.vue'), meta: { screen: 'SCR-001', title: '대시보드', menu: '대시보드' } },
  { path: 'lines', component: () => import('@/pages/Scr010AllLinesPage.vue'), meta: { screen: 'SCR-010', title: '전체 라인', menu: '대시보드' } },
  { path: 'lines/:lineId([A-F]|PT)', component: () => import('@/pages/Scr010LinePage.vue'), meta: { screen: 'SCR-010', title: '라인 상세', menu: '대시보드' } },
  { path: 'lines/:lineId([A-F])/:process(slit|press|weld)', component: () => import('@/pages/Scr002ProcessPage.vue'), meta: { screen: 'SCR-002-2~4', title: '공정 상세', menu: '대시보드' } },
  { path: 'lines/PT/paint', component: () => import('@/pages/Scr002ProcessPage.vue'), meta: { screen: 'SCR-002-5', title: '도장 상세', menu: '대시보드' } },
  { path: 'inbound', component: () => import('@/pages/Scr0021InboundPage.vue'), meta: { screen: 'SCR-002-1', title: '코일입고 상세', menu: '대시보드' } },
  { path: 'vision', component: () => import('@/pages/Scr0026VisionPage.vue'), meta: { screen: 'SCR-002-6', title: '비전 검사', menu: '대시보드' } },
  { path: 'loading', component: () => import('@/pages/Scr0027LoadingPage.vue'), meta: { screen: 'SCR-002-7', title: '적재', menu: '대시보드' } },
  { path: 'outbound', redirect: '/loading' },
  { path: 'production', component: () => import('@/pages/Scr011ProductionPage.vue'), meta: { screen: 'SCR-011', title: '생산 조회', menu: '생산' } },
  { path: 'utilization', component: () => import('@/pages/Scr003UtilizationPage.vue'), meta: { screen: 'SCR-003', title: '가동률', menu: '가동률' } },
  { path: 'pdm', component: () => import('@/pages/Scr004PdmPage.vue'), meta: { screen: 'SCR-004', title: '예지보전', menu: '예지보전' } },
  { path: 'alarms', component: () => import('@/pages/Scr006AlarmsPage.vue'), meta: { screen: 'SCR-006', title: '알람·비가동 이력', menu: '알람이력' } },
  { path: 'reports/daily', component: () => import('@/pages/Scr007DailyPage.vue'), meta: { screen: 'SCR-007', title: '일일 생산 리포트', menu: 'AI 리포트' } },
  { path: 'reports/replan/:id?', component: () => import('@/pages/Scr007ReplanPage.vue'), meta: { screen: 'SCR-007', title: '계획수정 보고서', menu: 'AI 리포트' } },
  { path: 'settings/target', component: () => import('@/pages/Scr008TargetPage.vue'), meta: { screen: 'SCR-008', title: '생산 목표 설정', menu: '설정', perm: 'target' } },
  { path: 'settings/limits', component: () => import('@/pages/Scr009LimitsPage.vue'), meta: { screen: 'SCR-009', title: '관리값 기준 설정', menu: '설정', perm: 'limits' } },
  { path: 'settings/users', component: () => import('@/pages/Scr012UsersPage.vue'), meta: { screen: 'SCR-012', title: '사용자 관리', menu: '설정', perm: 'users' } },
  { path: 'reports', redirect: '/reports/daily' },
  { path: 'settings', redirect: '/settings/target' },
]

// 부품 견본: 개발 모드에서만 (빌드 결과에는 들어가지 않음)
if (import.meta.env.DEV) {
  appRoutes.push({ path: 'dev/parts', component: () => import('@/pages/DevPartsPage.vue'), meta: { title: '부품 견본' } })
}

const routes: RouteRecordRaw[] = [
  { path: '/login', component: () => import('@/pages/Scr000LoginPage.vue'), meta: { screen: 'SCR-000', title: '로그인', public: true } },
  // 임시 MES (11/20, 시연용): 상단 메뉴 없이 따로. 캠퍼스장 계정만
  { path: '/mes', component: () => import('@/pages/MesPage.vue'), meta: { title: 'MES', perm: 'mes' } },
  // 11/21 보고서 문서만 (우리 시스템 보고서 화면과 같은 부품·같은 레이아웃). 임시 MES가 틀(iframe) 안에 띄워요
  { path: '/doc/replan/:id', component: () => import('@/pages/Scr007ReplanPage.vue'), meta: { title: '생산계획 수정 보고서', docOnly: true } },
  { path: '/doc/daily/:date', component: () => import('@/pages/Scr007DailyPage.vue'), meta: { title: '일일 생산 보고서', docOnly: true } },
  { path: '/', component: () => import('@/layouts/AppShell.vue'), children: appRoutes },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({ history: createWebHistory(), routes })
installViewTransition(router)

router.beforeEach((to) => {
  const loggedIn = isLoggedIn()
  if (!to.meta.public && !loggedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.path === '/login' && loggedIn) return homePath()
  // 권한이 없는 화면(설정 탭 등): 쓸 수 있는 첫 설정 탭, 없으면 첫 화면 (11/20)
  if (to.meta.perm && !hasPerm(to.meta.perm)) return (to.path.startsWith('/settings') ? settingsTabsFor(currentRole())[0]?.to : null) ?? homePath()
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 라인가동현황` : '라인가동현황'
})
