// 목표 생산량 변동 카드 (11/20): 공장장이 오늘 목표를 바꾸면 생산관리팀장 화면 오른쪽 위에 작게 알려요.
// 서버에 기록된 목표 변경(G-05)마다 한 번, X로 닫으면 그 변경은 다시 안 떠요 (11/21). 10초마다 확인.
// 목표는 공장장만 바꿀 수 있어서(lib/permissions.ts) "다른 사람이 바꾼 오늘 목표" = 공장장 변경이에요.
import { now as clockNow } from '@/clock'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { source } from '@/data'
import { useAuth } from '@/composables/useAuth'
import { toDateStr } from '@/lib/format'

const EVERY_MS = 10_000

export interface TargetChange { date: string; before: number | null; after: number | null; by: string | null; at: string | null }

export function useTargetChange() {
  const { role, userName, loginId } = useAuth()
  const change = shallowRef<TargetChange | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  // 11/21: 서버에 기록된 실제 목표 변경(target_change, G-05)만 알린다. 예전엔 "브라우저가 마지막으로 본 목표"와 비교해서
  //        시뮬을 다시 준비할 때마다(목표가 원래대로 돌아가면) 바뀐 걸로 알렸음. 변경 번호마다 한 번, X로 닫으면 그 번호는 다시 안 뜸
  const seenIds = (id: string): number[] => {
    try {
      return JSON.parse(localStorage.getItem(`sfaas.targetChangeSeen.${id}`) ?? '[]') as number[]
    } catch {
      return []
    }
  }
  let shownId: number | null = null

  async function check() {
    const id = loginId.value
    if (!id) return
    const today = toDateStr(clockNow())
    const p = await source.q.getPendingTarget(today).catch(() => null)
    if (!p || seenIds(id).includes(p.changeId) || p.changedBy === userName.value) {
      if (!p) change.value = null
      return
    }
    shownId = p.changeId
    change.value = { date: today, before: p.before, after: p.after, by: p.changedBy, at: p.changedAt }
  }

  /** X: 이 변경은 봤다고 기억 */
  function dismiss() {
    const id = loginId.value
    if (id && shownId != null) {
      try {
        localStorage.setItem(`sfaas.targetChangeSeen.${id}`, JSON.stringify([...seenIds(id), shownId].slice(-100)))
      } catch {
        // 저장소를 못 쓰면 이번 창 동안만
      }
    }
    change.value = null
  }

  const active = computed(() => role.value === 'PROD_LEAD')
  watch(active, (on) => {
    if (timer) clearInterval(timer)
    timer = null
    change.value = null
    if (!on) return
    check()
    timer = setInterval(check, EVERY_MS)
  }, { immediate: true })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { change, dismiss }
}
