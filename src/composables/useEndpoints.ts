// 입고·출고 상세 (SCR-002-1, 002-6): 라인 밖 공용 구역 화면 (D-79)
import { computed } from 'vue'
import { source } from '@/data'
import type { BarRowView, EquipCardView } from '@/types/view'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { toEquipCard, useProcessDetail } from '@/composables/useProcessDetail'
import { useInspections } from '@/composables/useInspections'
import { formatNumber } from '@/lib/format'

/** 코일입고: 1분마다 기록·재고 추이, 오늘 입고·재고 숫자는 1초 snapshot (API 명세 6장) */
export function useInbound() {
  const snapshot = useLiveSnapshot()
  const { data } = usePoll(() => source.q.getInboundToday(), 60_000, undefined, 'inbound-today')
  const figures = computed(() => ({
    today: snapshot.value?.inbound.today ?? data.value?.today ?? null,
    stock: snapshot.value?.inbound.stock ?? data.value?.stock ?? null,
    input: data.value?.input ?? null,
  }))
  return { data, figures }
}

/** 출고: 비전 1대 + 출고 검사 (D-90) */
export function useOutbound() {
  const { equipment, liveById } = useProcessDetail('VI', 'INSPECTION')
  const inspections = useInspections('INSPECTION', undefined, 'line')
  const now = useNow()

  const card = computed<EquipCardView | null>(() => {
    const e = equipment.value[0]
    if (!e) return null
    const d = inspections.data.value
    return toEquipCard(e, liveById.value.get(e.id), now.value, [
      { label: '오늘 검사', value: formatNumber(d?.inspected) },
      { label: '불량', value: formatNumber(d?.ng) },
    ])
  })

  const byLine = computed<BarRowView[]>(() => {
    const counts = new Map<string, number>(['A', 'B', 'C', 'D', 'E', 'F'].map((l) => [l, 0]))
    for (const r of inspections.rows.value) counts.set(r.where, (counts.get(r.where) ?? 0) + 1)
    return [...counts].map(([l, n]) => ({ key: l, label: l, value: n, muted: n === 0 }))
  })

  return { card, inspections, byLine, equipmentId: computed(() => equipment.value[0]?.id ?? null) }
}
