// 관리값 추이 (SCR-002 4번): 설비·구간을 고르면 API-040으로 처음 값을 받고, 웹소켓 telemetry로 새 값을 이어 붙인다 (API 명세 3.1)
// 1시간·8시간은 창을 밀어 오래된 점을 버리고, 오늘은 00시부터 쌓는다
import { shallowRef, watch, type Ref } from 'vue'
import { source } from '@/data'
import type { TelemetryRange, TelemetrySeries, TelemetryTick } from '@/types/process'
import { niceTicks, timeTicks } from '@/lib/chart'
import { formatNumber } from '@/lib/format'

const WINDOW_MS: Record<TelemetryRange, number | null> = { '1h': 3_600_000, '8h': 8 * 3_600_000, today: null }

export function useTelemetry(equipmentId: Ref<string | null>, range: Ref<TelemetryRange>) {
  const series = shallowRef<TelemetrySeries | null>(null)
  let seq = 0

  const append = (tick: TelemetryTick) => {
    const s = series.value
    if (!s || s.equipmentId !== tick.equipmentId) return
    const span = WINDOW_MS[s.range]
    const cutoff = span ? Date.parse(tick.values[0]?.t ?? '') - span : -Infinity
    series.value = {
      ...s,
      items: s.items.map((it) => {
        const add = tick.values.filter((v) => v.item === it.item).map((v) => ({ t: v.t, value: v.value, result: v.result }))
        return add.length ? { ...it, points: [...it.points.filter((p) => Date.parse(p.t) >= cutoff), ...add] } : it
      }),
    }
  }

  watch([equipmentId, range], ([id, r], _old, onCleanup) => {
    series.value = null
    if (!id) return
    const n = ++seq
    source.q.getTelemetry(id, r).then((s) => { if (n === seq) series.value = s })
    const off = source.live.onTelemetry(id, append)
    onCleanup(off)
  }, { immediate: true })

  return series
}

/** 관리값 그래프 모양: 고른 항목 하나의 선 + 상·하한 점선 (기준 미정이면 선 없이). x는 시각(ms) */
export function telemetryChart(series: TelemetrySeries | null, item: string, range: TelemetryRange, nowMs: number) {
  const it = series?.items.find((i) => i.item === item) ?? null
  const span = WINDOW_MS[range]
  const from = span ? nowMs - span : new Date(new Date(nowMs).setHours(0, 0, 0, 0)).getTime()
  const points: [number, number][] = (it?.points ?? []).map((p) => [Date.parse(p.t), p.value])
  const values = [...points.map((p) => p[1]), ...(it?.lower != null ? [it.lower] : []), ...(it?.upper != null ? [it.upper] : [])]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const padY = (hi - lo || Math.abs(hi) || 1) * 0.08
  const y = niceTicks(lo - padY, hi + padY, 4)
  const unit = it?.unit ? ` ${it.unit}` : ''
  const refLines: { value: number; kind: 'limit'; label: string }[] = []
  if (it?.upper != null) refLines.push({ value: it.upper, kind: 'limit', label: `상한 ${formatNumber(it.upper, y.digits)}` })
  if (it?.lower != null) refLines.push({ value: it.lower, kind: 'limit', label: `하한 ${formatNumber(it.lower, y.digits)}` })
  return {
    item: it,
    unit,
    hasLimits: it?.lower != null || it?.upper != null,
    x: [from, nowMs] as [number, number],
    xTicks: timeTicks(from, nowMs, range === '1h' ? 10 : range === '8h' ? 60 : 180),
    y: y.domain,
    yTicks: y.ticks,
    yDigits: y.digits,
    points,
    refLines,
    /** 백엔드가 NG로 판정한 점 (빨강 점) */
    ngPoints: (it?.points ?? []).filter((p) => p.result === 'NG').map((p): [number, number] => [Date.parse(p.t), p.value]),
  }
}
