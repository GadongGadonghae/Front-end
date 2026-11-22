// 예지보전 (SCR-004) 고른 설비의 센서 한눈에: 센서 카드(지금 값 · 위험도 · 1시간 미니 그래프)와 센서별 오늘 이력 띠
// 설비 상태 센서(온도·진동·전류, 더미 data/dummy/sensors.ts)만. 공정 관리값·인버터 값은 라인 화면(공정 상세)에서 본다
import { computed, ref, type Ref } from 'vue'
import type { TelemetryItem, TelemetryRange } from '@/types/process'
import type { StateCode } from '@/types/state'
import { useTelemetry } from '@/composables/useTelemetry'
import { gradeOf, type Grade } from '@/composables/usePdm'
import { formatNumber, formatTime } from '@/lib/format'
import { metricLabel } from '@/lib/metrics'

/** 최근 10분 평균 (D-58) */
const WINDOW_MS = 600_000
/** 이보다 길게 점이 비면 멈춘 구간으로 본다 */
const GAP_MS = 5 * 60_000
const SOURCE_LABEL = { process: '공정값', inverter: '인버터', sensor: '센서' } as const

export type LaneGrade = 'normal' | 'warn' | 'danger' | 'down' | 'none'

const dig = (n: number) => (Math.abs(n) < 10 ? 2 : 1)

/** 위험도 %: 가운데에서 한계까지 (하한 없는 항목은 0에서 상한까지) */
function percentOf(avg: number | null, lower: number | null, upper: number | null): number | null {
  if (avg == null || upper == null) return null
  if (lower == null) return upper > 0 ? Math.round((avg / upper) * 100) : null
  if (upper <= lower) return null
  return Math.round((Math.abs(avg - (lower + upper) / 2) / ((upper - lower) / 2)) * 100)
}

const avgBetween = (it: TelemetryItem, from: number, to: number) => {
  const vs = it.points.filter((p) => { const t = Date.parse(p.t); return t >= from && t <= to }).map((p) => p.value)
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
}

export function usePdmSensors(selectedId: Ref<string | null>, state: Ref<StateCode>, now: Ref<number>) {
  const hourRange = ref<TelemetryRange>('1h')
  const todayRange = ref<TelemetryRange>('today')
  const hour = useTelemetry(selectedId, hourRange)
  const today = useTelemetry(selectedId, todayRange)

  /** 예지보전은 설비 상태 센서만 (라인 화면의 공정 관리값·인버터 값과 나눔) */
  const shown = (items: TelemetryItem[]) => items.filter((i) => i.source === 'sensor')

  /** 센서 카드: 지금 값 · 최근 10분 위험도 · 1시간 전과 비교 · 1시간 미니 그래프 */
  const tiles = computed(() => {
    const end = now.value
    const from = end - 3_600_000
    return shown(hour.value?.items ?? []).map((it) => {
      const last = it.points.at(-1) ?? null
      const lastT = last ? Date.parse(last.t) : end
      const percent = percentOf(avgBetween(it, lastT - WINDOW_MS, lastT), it.lower, it.upper)
      const before = percentOf(avgBetween(it, from, from + WINDOW_MS), it.lower, it.upper)
      const toward = percent != null && before != null ? percent - before : null
      const values = [...it.points.map((p) => p.value), ...(it.upper != null ? [it.upper] : []), ...(it.lower != null ? [it.lower] : [0])]
      const lo = Math.min(...values)
      const hi = Math.max(...values)
      const pad = (hi - lo || 1) * 0.1
      const grade: Grade = gradeOf(percent)
      return {
        key: it.item,
        label: metricLabel(it.item),
        sourceLabel: SOURCE_LABEL[it.source ?? 'process'],
        value: state.value === 'D' || !last ? '-' : formatNumber(last.value, dig(last.value)),
        unit: it.unit,
        grade,
        percentText: percent == null ? '기준 미정' : `${grade === 'warn' ? '주의 ' : grade === 'danger' ? '위험 ' : ''}${percent}%`,
        changeText: toward == null ? '' : toward >= 5 ? `1시간 +${toward}%p` : toward <= -5 ? `1시간 ${toward}%p` : '1시간 변화 작음',
        spark: {
          points: it.points.map((p): [number, number] => [Date.parse(p.t), p.value]),
          x: [from, end] as [number, number],
          y: [lo - pad, hi + pad] as [number, number],
          lines: [it.upper, it.lower].filter((v): v is number => v != null),
        },
      }
    })
  })

  /** 센서별 오늘 이력: 점마다 그 앞 10분 평균의 등급, 점이 오래 비면 값 없음, 지금 고장이면 끝을 고장으로 */
  const lanes = computed(() => {
    const items = shown(today.value?.items ?? []).filter((i) => i.upper != null)
    const firsts = items.map((i) => i.points[0]).filter(Boolean).map((p) => Date.parse(p!.t))
    if (!firsts.length) return { from: now.value, rows: [], events: [] as { key: string; time: string; grade: LaneGrade; text: string; at: number }[] }
    const start = Math.min(...firsts)
    const end = Math.max(now.value, start + 60_000)
    const span = end - start
    const events: { key: string; time: string; grade: LaneGrade; text: string; at: number }[] = []
    const rows = items.map((it) => {
      const segs: { grade: LaneGrade; from: number; to: number }[] = []
      const push = (grade: LaneGrade, a: number, b: number) => {
        const s = segs.at(-1)
        if (s && s.grade === grade && Math.abs(s.to - a) < 1) s.to = b
        else segs.push({ grade, from: a, to: b })
      }
      let j = 0
      let sum = 0
      it.points.forEach((p, i) => {
        const t = Date.parse(p.t)
        sum += p.value
        while (Date.parse(it.points[j].t) < t - WINDOW_MS) { sum -= it.points[j].value; j++ }
        const g = gradeOf(percentOf(sum / (i - j + 1), it.lower, it.upper))
        const next = it.points[i + 1] ? Date.parse(it.points[i + 1].t) : end
        const grade: LaneGrade = g === 'unset' ? 'normal' : g
        if (i === 0 && t > start) push('none', start, t)
        if (next - t > GAP_MS) { push(grade, t, t + 60_000); push(i === it.points.length - 1 && state.value === 'D' ? 'down' : 'none', t + 60_000, next) }
        else push(grade, t, next)
      })
      segs.forEach((s, k) => {
        if (k === 0 || s.grade === 'none' || s.grade === segs[k - 1].grade) return
        const text = s.grade === 'down' ? '설비 고장 (상태 D)' : s.grade === 'normal' ? `${metricLabel(it.item)} 정상으로 돌아옴` : `${metricLabel(it.item)} ${s.grade === 'danger' ? '위험' : '주의'} 진입`
        if (s.grade === 'down' && events.some((e) => e.grade === 'down')) return
        if (s.grade === 'normal' && segs[k - 1].grade === 'none') return
        events.push({ key: `${it.item}${s.from}`, time: formatTime(new Date(s.from).toISOString()), grade: s.grade, text, at: s.from })
      })
      const lastTile = tiles.value.find((x) => x.key === it.item)
      return {
        key: it.item,
        label: metricLabel(it.item),
        percentText: lastTile?.percentText.replace(/^(주의|위험) /, '') ?? '-',
        segs: segs.map((s) => ({ grade: s.grade, left: ((s.from - start) / span) * 100, width: ((s.to - s.from) / span) * 100 })),
      }
    })
    events.sort((a, b) => b.at - a.at)
    return { from: start, rows, events: events.slice(0, 5) }
  })

  const axis = computed(() => {
    const a = lanes.value.from
    const b = now.value
    return [a, (a + b) / 2, b].map((t) => formatTime(new Date(t).toISOString()))
  })

  return { tiles, lanes, axis, hour }
}
