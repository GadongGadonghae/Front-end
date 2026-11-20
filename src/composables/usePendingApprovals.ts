// 결재 대기 카드 (11/20): 생산관리팀장이 AI 계획수정 보고서를 올리면 공장장 화면 오른쪽 위에 작게 알려요.
// 오늘 만든 보고서 중 아직 승인 안 된 것. X로 닫으면 그때까지 본 보고서는 다시 안 떠요 (계정마다 브라우저에 기억). 10초마다 확인.
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { source } from '@/data'
import { useAuth } from '@/composables/useAuth'
import { toDateStr } from '@/lib/format'
import type { ReplanSummary } from '@/types/report'

const EVERY_MS = 10_000
const keyOf = (loginId: string) => `sfaas.approvalSeen.${loginId}`

function readSeen(loginId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(keyOf(loginId)) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writeSeen(loginId: string, ids: string[]) {
  try {
    localStorage.setItem(keyOf(loginId), JSON.stringify(ids.slice(-200)))
  } catch {
    // 저장소를 못 쓰면 이번 창 동안만
  }
}

export function usePendingApprovals() {
  const { role, loginId } = useAuth()
  const pending = shallowRef<ReplanSummary[]>([])
  let memory: string[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  async function check() {
    const id = loginId.value
    if (!id) return
    const today = toDateStr(Date.now())
    const list = await source.q.getReplanReports(today, today).catch(() => [])
    const seen = new Set([...readSeen(id), ...memory])
    pending.value = list.filter((r) => r.approved === false && !seen.has(r.id))
  }

  /** X: 지금 보이는 보고서는 봤다고 기억 */
  function dismiss() {
    const id = loginId.value
    const ids = pending.value.map((r) => r.id)
    memory = [...memory, ...ids]
    if (id) writeSeen(id, [...readSeen(id), ...ids])
    pending.value = []
  }

  const active = computed(() => role.value === 'PLANT_HEAD')
  watch(active, (on) => {
    if (timer) clearInterval(timer)
    timer = null
    pending.value = []
    if (!on) return
    check()
    timer = setInterval(check, EVERY_MS)
  }, { immediate: true })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { pending, dismiss, reload: check }
}
