// 입고 · 비전 검사 · 적재 상세 (SCR-002-1, 002-6, 002-7): 라인 밖 공용 구역 화면 (D-79)
import { computed } from 'vue'
import { source } from '@/data'
import type { BarRowView, EquipCardView } from '@/types/view'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { toEquipCard, useProcessDetail } from '@/composables/useProcessDetail'
import { useInspections } from '@/composables/useInspections'
import { niceTicks } from '@/lib/chart'
import { formatNumber, formatTime } from '@/lib/format'
import { PER_BOX } from '@/lib/loading'

/** 코일입고: 1분마다 기록·재고 추이, 오늘 입고·재고 숫자는 1초 snapshot (API 명세 6장) */
export function useInbound() {
  const snapshot = useLiveSnapshot()
  const { data } = usePoll(() => source.q.getInboundToday(), 60_000)
  const figures = computed(() => ({
    today: snapshot.value?.inbound.today ?? data.value?.today ?? null,
    stock: snapshot.value?.inbound.stock ?? data.value?.stock ?? null,
    input: data.value?.input ?? null,
  }))
  return { data, figures }
}

/** 비전 검사: 비전 1대 + 검사 결과 (D-90) */
export function useVision() {
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

const LINE_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']
/** 시간대별 막대의 기본 범위: 근무 09~18시 */
const SHIFT = [9, 17]

/** 적재: 라인별 완성품 · 시간대별 · 최근 적재 제품. 비전 검사에 합격하면 바로 적재로 센다 (11/22) */
export function useLoading() {
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const { data: hourly } = usePoll(() => source.q.getTodayHourly(), 60_000)
  const { data: loaded } = usePoll(() => source.q.getLoadedToday(), 10_000)

  const figures = computed(() => {
    const done = snapshot.value?.plant.done ?? summary.value?.plant.done ?? null
    const plan = summary.value?.plant.target ?? null
    return { done, plan, rate: done != null && plan ? (done / plan) * 100 : null, boxes: done == null ? null : Math.ceil(done / PER_BOX) }
  })

  const byLine = computed<BarRowView[]>(() => LINE_KEYS.map((k) => {
    const row = summary.value?.lines.find((l) => l.lineId === k)
    const done = snapshot.value?.lines.find((l) => l.lineId === k)?.done ?? row?.done ?? null
    const plan = row?.plan ?? null
    const rate = done != null && plan ? (done / plan) * 100 : null
    return { key: k, label: `${k}라인`, value: rate, display: `${formatNumber(done)} / ${formatNumber(plan)}`, sub: rate == null ? '-' : `${formatNumber(rate, 1)}%`, muted: !done && !plan }
  }))

  const hours = computed(() => {
    const list = (hourly.value?.hours ?? []).filter((h) => h.done > 0)
    const from = Math.min(SHIFT[0], list[0]?.hour ?? SHIFT[0])
    const to = Math.max(SHIFT[1], list.at(-1)?.hour ?? SHIFT[1])
    const keys = Array.from({ length: to - from + 1 }, (_, i) => from + i)
    const values = keys.map((h) => list.find((x) => x.hour === h)?.done ?? null)
    const y = niceTicks(0, Math.max(10, ...values.map((v) => v ?? 0)) * 1.1, 4)
    return { labels: keys.map((h) => `${h}시`), values, yTicks: y.ticks, empty: !list.length }
  })

  const rows = computed(() => (loaded.value ?? []).map((p) => ({ key: p.productId, time: formatTime(p.t), productId: p.productId, where: p.lineId })))

  return { figures, byLine, hours, rows }
}
