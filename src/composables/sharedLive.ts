// 실시간 구독 하나를 앱 전체가 같이 쓴다 (1초 상태 · 10초 요약 · 3D 물류)
// 성능 개선 3 (D-120, docs/10_성능검토.md): 화면을 옮기면 옛 화면이 먼저 내려가 쓰는 곳이 잠깐 0이 된다.
// 그때 바로 끊으면 새 화면이 같은 구독을 다시 열며 첫 조회가 한꺼번에 나가므로(실서버 약 21건), 쓰는 곳이 0이 되어도 GRACE_MS 동안은 두었다가 끊는다
// 보관된 화면(KeepAlive, 대시보드)은 떠나 있는 동안 쓰는 곳에서 빠진다: 다른 화면에 GRACE_MS 넘게 있으면 그 화면이 안 쓰는 구독은 멈춘다
import { getCurrentInstance, onActivated, onDeactivated, onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import type { Unsubscribe } from '@/data/contracts'

/** 쓰는 곳이 없어진 뒤 구독을 끊기까지 (화면 전환 사이를 넉넉히 넘기게) */
const GRACE_MS = 30_000

/** start = 구독 시작 (끊는 함수를 돌려준다). 돌려받은 함수를 composable 안에서 부르면 값(처음 null)을 준다 */
export function sharedLive<T>(start: (cb: (v: T) => void) => Unsubscribe) {
  const value = shallowRef<T | null>(null)
  let users = 0
  let off: Unsubscribe | null = null
  let stopTimer: ReturnType<typeof setTimeout> | null = null

  const acquire = () => {
    users += 1
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
    if (!off) off = start((v) => { value.value = v })
  }
  const release = () => {
    users -= 1
    if (users > 0 || !off) return
    stopTimer = setTimeout(() => {
      stopTimer = null
      if (users === 0 && off) { off(); off = null }
    }, GRACE_MS)
  }

  return function use(): Readonly<ShallowRef<T | null>> {
    acquire()
    let held = true
    if (getCurrentInstance()) {
      // 보관(KeepAlive)되는 동안은 쓰는 곳에서 빠졌다가, 돌아오면 다시 (처음 붙을 때도 onActivated가 불리므로 held로 두 번 세지 않게)
      onDeactivated(() => { if (held) { held = false; release() } })
      onActivated(() => { if (!held) { held = true; acquire() } })
    }
    onScopeDispose(() => { if (held) { held = false; release() } })
    return value
  }
}
