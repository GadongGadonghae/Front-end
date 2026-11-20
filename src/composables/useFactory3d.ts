// 3D 공장 화면 값 (SCR-005): 기준정보 + 1초 상태 + 10초 요약 + 제품 위치(데모)
import { computed } from 'vue'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useProductFlow } from '@/composables/useProductFlow'
import { useNow } from '@/composables/useNow'

export function useFactory3d() {
  const { master } = useMaster()
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const flow = useProductFlow()
  const now = useNow()
  const view = computed(() => {
    const m = master.value
    const s = snapshot.value
    if (!m || !s) return null
    return { equipment: m.equipment, lines: m.lines, live: s.equipment, lineSummaries: summary.value?.lines ?? [] }
  })
  return { view, flow, now }
}
