// 예지보전 (SCR-004, FN-007): 위험도 목록(웹소켓 risk 5초) · 고른 설비의 관리값 추이 · 상한 도달 예상 [차순위, API-061 1분]
import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { source } from '@/data'
import type { EquipmentRisk } from '@/types/pdm'
import type { TelemetryRange } from '@/types/process'
import type { StateCode } from '@/types/state'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { telemetryChart, useTelemetry } from '@/composables/useTelemetry'
import { formatDuration, formatNumber, formatTime } from '@/lib/format'

/** 80% 주의 · 90% 위험 (D-29) */
export const WARN = 80
export const DANGER = 90
const ETA_POLL_MS = 60_000

/** 소수가 있는 기준값은 한 자리까지 (1.5 ~ 3.5) */
const dig = (n: number) => (Number.isInteger(n) ? 0 : 1)

export type Grade = 'danger' | 'warn' | 'normal' | 'unset'
export const gradeOf = (p: number | null): Grade => (p == null ? 'unset' : p >= DANGER ? 'danger' : p >= WARN ? 'warn' : 'normal')

export interface RiskRow {
  id: string
  name: string
  percent: number | null
  item: string | null
  grade: Grade
  state: StateCode
}

export function usePdm(selectedId: Ref<string | null>) {
  const { equipmentName } = useMaster()
  const snap = useLiveSnapshot()
  const now = useNow()

  const risks = shallowRef<EquipmentRisk[]>([])
  const off = source.live.onRisk((r) => { risks.value = r })
  onScopeDispose(off)

  const stateOf = (id: string): StateCode => snap.value?.equipment.find((e) => e.id === id)?.state ?? 'R'
  const rows = computed<RiskRow[]>(() => [...risks.value]
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .map((r) => ({ id: r.equipmentId, name: equipmentName(r.equipmentId), percent: r.percent, item: r.item, grade: gradeOf(r.percent), state: stateOf(r.equipmentId) })))

  // 지금 고장(D)인 설비는 이미 멈췄으므로 위험·주의 묶음과 따로 보인다 (값은 멈추기 전 10분 평균)
  const groups = computed(() => {
    const down = rows.value.filter((r) => r.state === 'D')
    const rest = rows.value.filter((r) => r.state !== 'D')
    return {
      down,
      danger: rest.filter((r) => r.grade === 'danger'),
      warn: rest.filter((r) => r.grade === 'warn'),
      normal: rest.filter((r) => r.grade === 'normal'),
      unset: rest.filter((r) => r.grade === 'unset'),
    }
  })

  // 처음 고를 설비: 가장 위험한 것 (고장 중 제외)
  watch(rows, (list) => {
    if (!selectedId.value && list.length) selectedId.value = (groups.value.danger[0] ?? groups.value.warn[0] ?? list[0]).id
  }, { immediate: true })

  const selected = computed(() => risks.value.find((r) => r.equipmentId === selectedId.value) ?? null)
  const selectedRow = computed(() => rows.value.find((r) => r.id === selectedId.value) ?? null)

  // ── 관리값 추이 ──
  const range = ref<TelemetryRange>('8h')
  const item = ref('')
  watch(selectedId, () => { item.value = '' })
  watch(selected, (s) => { if (s && !s.items.some((i) => i.item === item.value)) item.value = s.item ?? s.items[0]?.item ?? '' }, { immediate: true })
  const series = useTelemetry(selectedId, range)

  const chart = computed(() => {
    const c = telemetryChart(series.value, item.value, range.value, now.value)
    const it = c.item
    if (!it || it.lower == null || it.upper == null) return { ...c, bands: false }
    // 80%·90% 선: 가운데에서 상·하한 쪽으로 그 비율만큼 간 자리 (양쪽). 이름은 범례에 (선끼리 가까워 글자가 겹친다)
    const mid = (it.lower + it.upper) / 2
    const half = (it.upper - it.lower) / 2
    const lines = [
      { value: mid + half * 0.9, kind: 'danger' as const },
      { value: mid + half * 0.8, kind: 'warn' as const },
      { value: mid - half * 0.8, kind: 'warn' as const },
      { value: mid - half * 0.9, kind: 'danger' as const },
    ]
    return { ...c, refLines: [...c.refLines, ...lines], bands: true }
  })

  const itemRows = computed(() => (selected.value?.items ?? []).map((i) => ({
    key: i.item,
    item: i.item,
    avg: i.avg10 == null ? '-' : `${formatNumber(i.avg10, Math.abs(i.avg10) < 10 ? 2 : 1)}${i.unit ? ` ${i.unit}` : ''}`,
    limit: i.lower == null || i.upper == null ? '기준 미정' : `${formatNumber(i.lower, dig(i.lower))} ~ ${formatNumber(i.upper, dig(i.upper))}`,
    percent: i.percent,
    grade: gradeOf(i.percent),
  })))

  // ── 상한 도달 예상 [차순위] ──
  const { data: eta } = usePoll(() => (selectedId.value ? source.q.getPdmEta(selectedId.value) : Promise.resolve(null)), ETA_POLL_MS, selectedId)
  const etaText = computed(() => {
    const e = eta.value
    if (!e) return null
    const side = e.toward === 'lower' ? '하한' : '상한'
    if (e.etaSec == null) return { main: `${side}에 다가가지 않음`, sub: `${e.item} · 최근 1시간 기울기 기준` }
    const h = e.etaSec / 3600
    const when = h < 1 ? `약 ${Math.max(1, Math.round(e.etaSec / 60))}분 뒤` : h < 48 ? `약 ${Math.round(h)}시간 뒤` : `약 ${Math.round(h / 24)}일 뒤`
    return { main: `이대로면 ${when} ${side} 도달`, sub: `${e.item} · 최근 1시간 기울기 시간당 ${e.slopePerHour! > 0 ? '+' : ''}${formatNumber(e.slopePerHour, 2)}` }
  })

  // 위험 진입 시각: 오늘 위험 이력에서 진행 중인 건
  const { data: riskEvents } = usePoll(() => source.q.getTodayRiskEvents(), ETA_POLL_MS)
  const dangerSince = computed(() => {
    const ev = riskEvents.value?.find((r) => r.equipmentId === selectedId.value && !r.end)
    return ev ? `${formatTime(ev.start)} 위험 진입 · ${formatDuration((now.value - Date.parse(ev.start)) / 1000)} 지남` : null
  })

  const counts = computed(() => ({
    danger: groups.value.danger.length, warn: groups.value.warn.length,
    normal: groups.value.normal.length, unset: groups.value.unset.length, down: groups.value.down.length,
  }))

  return { rows, groups, counts, selected, selectedRow, range, item, chart, itemRows, etaText, dangerSince, now, equipmentName }
}
