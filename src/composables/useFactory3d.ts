// 3D 공장 화면 값 (SCR-005): 기준정보 + 1초 상태 + 10초 요약 + 제품 위치(데모)
import { now as clockNow } from '@/clock'
import { computed } from 'vue'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useProductFlow } from '@/composables/useProductFlow'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { source } from '@/data'
import { toDateStr } from '@/lib/format'
import type { LineId } from '@/types/plant'

/** 추가 주문 배정 반영은 사람이 승인할 때만 바뀌어서 10초마다면 충분 */
const ADDITIONS_MS = 10_000

export function useFactory3d() {
  const { master } = useMaster()
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const flow = useProductFlow()
  const now = useNow()
  // 오늘 승인·적용된 추가 주문 배정 (R-06) → 배정 칸 "+N 추가 배정"
  const { data: additions } = usePoll(
    () => source.q.getOrderAdditions(toDateStr(clockNow())).catch((): Partial<Record<LineId, number>> => ({})), ADDITIONS_MS)
  const view = computed(() => {
    const m = master.value
    const s = snapshot.value
    if (!m || !s) return null
    const out = summary.value?.plant?.quality?.outbound
    return { equipment: m.equipment, lines: m.lines, live: s.equipment, lineSummaries: summary.value?.lines ?? [], additions: additions.value ?? {},
      vision: out ? { ok: out.ok, ng: out.ng } : null }
  })
  return { view, flow, now }
}
