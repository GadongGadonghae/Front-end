// 오늘 알람 (11/20): 알람 이력 탭과 같은 기준 = 고장(D) + 통신 끊김(DC). 대기·정지는 가동률·공정 상세에서 봐요.
// 상단 종 · 전체 라인 화면 · 라인 상세 "오늘 알람 이력"이 같이 써요. 같은 범위(전체·라인)는 조회를 하나로 나눠 써요
import { now as clockNow } from '@/clock'
import { computed, effectScope, onScopeDispose, type ComputedRef, type EffectScope } from 'vue'
import { source } from '@/data'
import type { AlertRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDuration, formatTime, toDateStr } from '@/lib/format'

/** 갱신 주기 */
const EVERY_MS = 5_000

interface Shared { users: number; scope: EffectScope; rows: ComputedRef<AlertRowView[]>; ongoingCount: ComputedRef<number> }
const shared = new Map<string, Shared>()

function create(lineId: string | undefined): Shared {
  const scope = effectScope(true)
  const { rows, ongoingCount } = scope.run(() => {
    const { equipmentName } = useMaster()
    const now = useNow()
    const { data } = usePoll(() => {
      const d = toDateStr(clockNow())
      return source.q.getHistory({ from: d, to: d, lineId, states: ['D', 'DC'], minMinutes: 0, page: 1 }).then((p) => p.items)
    }, EVERY_MS)
    const rows = computed<AlertRowView[]>(() => (data.value ?? []).map((e): AlertRowView => {
      const sec = ((e.end ? Date.parse(e.end) : now.value) - Date.parse(e.start)) / 1000
      return {
        id: e.id, kind: e.state, title: equipmentName(e.equipmentId),
        message: [e.code ? DOWNTIME_NAME[e.code] : '통신 끊김', e.detail].filter(Boolean).join(' · '),
        start: e.start, time: formatTime(e.start),
        duration: e.end ? `지속 ${formatDuration(sec)}` : formatDuration(sec),
        ongoing: e.end === null,
        report: e.state === 'D' ? (e.reportId ? 'view' : 'create') : null,
        reportId: e.reportId, equipmentId: e.equipmentId,
      }
    }).sort((a, b) => Number(b.ongoing) - Number(a.ongoing) || b.start.localeCompare(a.start)))   // 진행 중 위, 최근순
    return { rows, ongoingCount: computed(() => rows.value.filter((r) => r.ongoing).length) }
  })!
  return { users: 0, scope, rows, ongoingCount }
}

/** lineId를 주면 그 라인 설비만 */
export function useTodayAlarms(lineId?: string) {
  const key = lineId ?? '*'
  let s = shared.get(key)
  if (!s) {
    s = create(lineId)
    shared.set(key, s)
  }
  s.users += 1
  const mine = s
  onScopeDispose(() => {
    mine.users -= 1
    if (mine.users === 0) {
      mine.scope.stop()
      shared.delete(key)
    }
  })
  return { rows: s.rows, ongoingCount: s.ongoingCount }
}
