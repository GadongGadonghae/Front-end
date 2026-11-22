// 결재 대기 카드 (11/20): 생산관리 팀장이 [작성 완료 · 결재 요청]을 누르면 공장장 화면 오른쪽 위에 작게 알려요.
// AI 보고서를 만들기만 한 것(작성 중)은 알리지 않아요. 회수했다가 다시 요청하면 다시 알려요.
// X로 닫으면 그때까지 본 요청은 다시 안 떠요 (계정마다 브라우저에 기억). 결재 상태는 useReportFlow가 5초마다 서버에서 읽어요.
import { computed, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useReportFlow, type ReportFlow } from '@/composables/useReportFlow'

const keyOf = (loginId: string) => `sfaas.approvalSeen.${loginId}`
/** 같은 보고서라도 다시 결재 요청하면 새 알림 */
const idOf = (f: ReportFlow) => `${f.key}@${f.writtenAt ?? ''}`

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
  const flow = useReportFlow()
  /** 이번 창에서 닫은 것 (저장소를 못 쓸 때도 다시 안 뜨게) */
  const memory = ref<string[]>([])

  const pending = computed(() => {
    const id = loginId.value
    if (role.value !== 'PLANT_HEAD' || !id) return []
    const seen = new Set([...readSeen(id), ...memory.value])
    return flow.requested.value.filter((f) => !seen.has(idOf(f)))
  })

  /** X: 지금 보이는 요청은 봤다고 기억 */
  function dismiss() {
    const id = loginId.value
    const ids = pending.value.map(idOf)
    memory.value = [...memory.value, ...ids]
    if (id) writeSeen(id, [...readSeen(id), ...ids])
  }

  return { pending, dismiss, reload: flow.refresh }
}
