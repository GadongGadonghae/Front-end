// 공정 검사 (SCR-002 7번, API-043) 30초마다, 미세정지 (SCR-002 8번, API-044) 1분마다
import { computed, type Ref } from 'vue'
import { source } from '@/data'
import type { LineId, ProcessId } from '@/types/plant'
import type { DefectRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { formatTime } from '@/lib/format'

export function useInspections(process: ProcessId, lineId?: LineId, where: 'equipment' | 'line' = 'equipment') {
  const { equipmentName } = useMaster()
  const { data } = usePoll(() => source.q.getInspectionsToday(process, lineId), 30_000)
  const rows = computed<DefectRowView[]>(() => (data.value?.defects ?? []).map((d) => ({
    key: d.productId,
    time: formatTime(d.t),
    productId: d.productId,
    where: where === 'line' ? d.productId.slice(0, 2) : equipmentName(d.equipmentId),
    reason: d.reason,
  })))
  return { data, rows }
}

export function useMicrostops(equipmentId: Ref<string | null>) {
  const { data } = usePoll(() => (equipmentId.value ? source.q.getMicrostopsToday(equipmentId.value) : Promise.resolve(null)), 60_000, equipmentId)
  return data
}
