// 화면 사이 이어지는 전환 (D-119): 대시보드 3D 공장 ↔ 라인 상세.
// 브라우저 View Transitions로 "공장 배치도" 칸이 "라인 흐름" 칸으로 옮겨 가며 커진다 (돌아올 때는 거꾸로)
// 두 칸에 같은 view-transition-name(.vt-line-stage, base.css)을 붙여 둔다. 나머지 화면은 짧게 겹쳐 바뀐다
// 지원하지 않는 브라우저 · 움직임 줄이기 설정이면 그냥 바뀐다
import { nextTick } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'

type VtDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }

const isDash = (r: RouteLocationNormalized) => r.path === '/'
const isLine = (r: RouteLocationNormalized) => /^\/lines\/[A-F]$/.test(r.path)
/** 대시보드 → 라인 상세, 라인 상세 → 대시보드만 */
const linked = (to: RouteLocationNormalized, from: RouteLocationNormalized) => (isDash(from) && isLine(to)) || (isLine(from) && isDash(to))

export function installViewTransition(router: Router) {
  let finish: (() => void) | null = null
  router.beforeResolve((to, from) => {
    const d = document as VtDocument
    if (!d.startViewTransition || !linked(to, from) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // 옛 화면을 찍은 뒤 이동을 이어 가고, 새 화면이 그려지면(afterEach + nextTick) 전환을 끝낸다
    return new Promise<void>((resolve) => {
      d.startViewTransition!(() => new Promise<void>((done) => { finish = done; resolve() }))
    })
  })
  router.afterEach(async () => {
    if (!finish) return
    const f = finish
    finish = null
    await nextTick()
    f()
  })
}
