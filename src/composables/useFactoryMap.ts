// 공장 배치도 모양 (SCR-001 1~5번, D-81): 기준정보(설비 배치) + 1초 snapshot(상태) + 10초 summary(라인 계획)
import { computed } from 'vue'
import type { Equipment, LineId } from '@/types/plant'
import type { EquipmentLive } from '@/types/live'
import type { EquipCellView, FactoryMapView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useNow } from '@/composables/useNow'
import { countByState, byProcess } from '@/lib/status'
import { formatDuration } from '@/lib/format'

const PRODUCTION_LINES: LineId[] = ['A', 'B', 'C', 'D', 'E', 'F']

export function useFactoryMap() {
  const { master } = useMaster()
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const now = useNow()

  const liveById = computed(() => new Map<string, EquipmentLive>((snapshot.value?.equipment ?? []).map((e) => [e.id, e])))

  const cell = (e: Equipment): EquipCellView => {
    const l = liveById.value.get(e.id)
    const state = l?.state ?? 'R'
    return {
      id: e.id,
      name: e.shortName,
      state,
      duration: l && state === 'D' ? formatDuration((now.value - Date.parse(l.since)) / 1000) : null,
      pdm: l?.pdm ? { level: l.pdm.level, text: `${l.pdm.level === 'danger' ? '위험' : '주의'} ${l.pdm.percent}%` } : null,
    }
  }

  const view = computed<FactoryMapView | null>(() => {
    const m = master.value
    const s = snapshot.value
    if (!m || !s) return null
    const byArea = (area: string) => m.equipment.filter((e) => e.area === area)
    const order = (a: Equipment, b: Equipment) => byProcess(a.process, b.process) || a.order - b.order
    const planOf = (id: LineId) => summary.value?.lines.find((x) => x.lineId === id)?.plan ?? null
    return {
      inbound: s.inbound,
      lines: PRODUCTION_LINES.map((id) => ({
        id,
        done: s.lines.find((x) => x.lineId === id)?.done ?? null,
        plan: planOf(id),
        cells: byArea(id).sort(order).map(cell),
        reroute: (() => {
          const l = m.lines.find((x) => x.id === id)
          return l && l.currentPaintId !== l.defaultPaintId ? (m.equipment.find((e) => e.id === l.currentPaintId)?.shortName ?? null) : null
        })(),
      })),
      paint: byArea('PT').sort(order).map(cell),
      vision: byArea('VI').map(cell)[0] ?? null,
    }
  })

  /** 범례에 붙일 상태별 대수와 예지보전 주의·위험 대수 */
  const counts = computed(() => {
    const list = snapshot.value?.equipment ?? []
    return {
      state: countByState(list.map((e) => e.state)),
      warn: list.filter((e) => e.pdm?.level === 'warn').length,
      danger: list.filter((e) => e.pdm?.level === 'danger').length,
      total: list.length,
    }
  })

  return { view, counts }
}
