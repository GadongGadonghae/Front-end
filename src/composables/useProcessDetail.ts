// 공정 상세 (SCR-002 1·2번): 제목 줄 요약 숫자 + 설비 카드. 1초 snapshot(상태) + 30초 공정 요약(API-030)
import { computed } from 'vue'
import { source } from '@/data'
import type { AreaId, Equipment, ProcessId } from '@/types/plant'
import type { EquipmentLive } from '@/types/live'
import type { EquipCardView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { countByState, longShortName } from '@/lib/status'
import { formatDuration, formatNumber } from '@/lib/format'

/** 공정 요약 갱신 주기 (API 명세 6장) */
const PROCESS_POLL_MS = 30_000

/** 설비 + 현재 상태 → 카드 모양 */
export function toEquipCard(e: Equipment, live: EquipmentLive | undefined, nowMs: number, info: EquipCardView['info'], tag: string | null = null): EquipCardView {
  return {
    id: e.id,
    name: longShortName(e),
    state: live?.state ?? 'R',
    duration: live ? formatDuration((nowMs - Date.parse(live.since)) / 1000) : '-',
    pdm: live?.pdm ? { level: live.pdm.level, text: `${live.pdm.level === 'danger' ? '위험' : '주의'} · ${live.pdm.item} ${live.pdm.percent}%` } : null,
    tag,
    info,
  }
}

export function useProcessDetail(area: AreaId, process: ProcessId) {
  const { master } = useMaster()
  const snapshot = useLiveSnapshot()
  const now = useNow()

  const { data: today } = usePoll(
    () => (area === 'CM' ? Promise.resolve(null) : source.q.getProcessToday(area, process)),
    PROCESS_POLL_MS,
  )

  const equipment = computed(() => (master.value?.equipment ?? []).filter((e) => e.area === area && e.process === process).sort((a, b) => a.order - b.order))
  const liveById = computed(() => new Map((snapshot.value?.equipment ?? []).map((e) => [e.id, e])))

  const cards = computed<EquipCardView[]>(() => equipment.value.map((e) => {
    const row = today.value?.equipment.find((x) => x.id === e.id)
    const info: EquipCardView['info'] = []
    if (process === 'B') {
      info.push({ label: '오늘 생산', value: formatNumber(today.value?.output) })
      const inv = today.value?.inverter
      if (inv) info.push({ label: '출력 주파수', value: `${formatNumber(inv.outputHz, 2)} Hz` })
    } else {
      info.push({ label: '오늘 사이클', value: formatNumber(row?.cycles) })
      if (row?.avgCtMs != null) info.push({ label: '평균 CT', value: `${formatNumber(row.avgCtMs / 1000, 1)}초`, mark: row.slowest ? '가장 느림' : undefined })
    }
    // 슬리팅은 실설비(L1, iG5A)와 시뮬레이터를 구분해 표시 (D-43)
    const tag = process === 'B' ? (e.real ? '실설비 · LS iG5A' : '시뮬레이터') : null
    return toEquipCard(e, liveById.value.get(e.id), now.value, info, tag)
  }))

  const head = computed(() => ({
    counts: countByState(equipment.value.map((e) => liveById.value.get(e.id)?.state ?? 'R')),
    total: equipment.value.length,
    output: today.value?.output ?? null,
    good: today.value?.good ?? null,
    oee: today.value?.oee ?? null,
    wip: today.value?.wip ?? { before: null, after: null },
  }))

  return { equipment, cards, head, today, liveById }
}
