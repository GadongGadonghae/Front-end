// 가동률 (SCR-003, API-050·051): 조회 조건 → OEE·3요소, 라인·공정·설비별 막대, 비가동 코드별, 상태 타임라인(일) 또는 일별 추이(주·월)
// 조건이 바뀌면 바로 다시 부르고, 그대로 두면 1분마다 갱신 (API 명세 6장)
import { computed, ref, watch } from 'vue'
import { source } from '@/data'
import type { OeeQuery, Period } from '@/types/analysis'
import type { StateCode, StopState } from '@/types/state'
import type { BarRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME, PROCESS_NAME, STATE_NAME, longShortName, byProcess } from '@/lib/status'
import { formatDate, formatDuration, formatHm, formatNumber, toDateStr } from '@/lib/format'

const POLL_MS = 60_000
const AREAS = [
  { value: 'A', label: 'A라인' }, { value: 'B', label: 'B라인' }, { value: 'C', label: 'C라인' }, { value: 'D', label: 'D라인' },
  { value: 'E', label: 'E라인' }, { value: 'F', label: 'F라인' }, { value: 'PT', label: '도장' }, { value: 'VI', label: '출고' },
]
const TONE: Record<StateCode, 'run' | 'stop' | 'idle' | 'down' | 'dc'> = { R: 'run', S: 'stop', I: 'idle', D: 'down', DC: 'dc' }
const hm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`

export function useUtilization() {
  const { master } = useMaster()
  const today = toDateStr(Date.now())

  // 조회 조건 (SCR-003 1번). 기본 오늘·전체 (D-54). ''는 전체
  const period = ref<Period>('day')
  const date = ref(today)
  const lineId = ref('')
  const process = ref('')
  const equipmentId = ref('')

  const query = computed<OeeQuery>(() => ({
    period: period.value, date: date.value,
    lineId: lineId.value || undefined, process: process.value || undefined, equipmentId: equipmentId.value || undefined,
  }))

  const { data: report } = usePoll(() => source.q.getOee(query.value), POLL_MS, query)
  const { data: timeline } = usePoll(
    () => (query.value.period === 'day' ? source.q.getStateTimeline(query.value) : Promise.resolve(null)),
    POLL_MS, query,
  )

  // ── 고를 것 ──
  const scoped = computed(() => (master.value?.equipment ?? []).filter((e) => e.process !== 'COIL' && (!lineId.value || e.area === lineId.value)))
  const lineOptions = [{ value: '', label: '전체' }, ...AREAS]
  const processOptions = computed(() => [
    { value: '', label: '전체' },
    ...[...new Set(scoped.value.map((e) => e.process))].sort(byProcess).map((p) => ({ value: p, label: PROCESS_NAME[p] })),
  ])
  const equipmentOptions = computed(() => [
    { value: '', label: '전체' },
    ...(lineId.value ? scoped.value.filter((e) => !process.value || e.process === process.value).sort((a, b) => byProcess(a.process, b.process) || a.order - b.order).map((e) => ({ value: e.id, label: longShortName(e) })) : []),
  ])
  // 상위 조건이 바뀌면 맞지 않는 하위 조건을 비운다
  watch(lineId, () => { if (!processOptions.value.some((o) => o.value === process.value)) process.value = ''; equipmentId.value = '' })
  watch(process, () => { if (!equipmentOptions.value.some((o) => o.value === equipmentId.value)) equipmentId.value = '' })

  // ── 보이는 모양 ──
  const rangeText = computed(() => {
    const r = report.value
    if (!r) return ''
    if (period.value === 'day') return date.value === today ? `00:00 ~ ${formatHm(r.to)} 기준` : `${formatDate(r.from)} 하루`
    const last = toDateStr(Date.parse(r.to) - 1)
    return `${toDateStr(Date.parse(r.from))} ~ ${last.slice(5)}`
  })

  const barTitle = computed(() => (!lineId.value ? '라인별 OEE' : !process.value ? '공정별 OEE' : '설비별 OEE'))
  const bars = computed<BarRowView[]>(() => {
    const list = report.value?.bars ?? []
    const vals = list.map((b) => b.oee).filter((v): v is number => v != null)
    const low = vals.length > 1 ? Math.min(...vals) : null
    return list.map((b) => ({
      key: b.key, label: b.label, value: b.oee, display: formatNumber(b.oee, 1),
      strong: b.oee != null && b.oee === low, sub: b.oee != null && b.oee === low ? '가장 낮음' : '',
    }))
  })
  /** 막대를 누르면 그 조건으로 거른다 [가정] */
  function pickBar(key: string) {
    if (!lineId.value) lineId.value = key
    else if (!process.value) process.value = key
    else equipmentId.value = key
  }

  const downtime = computed<(BarRowView & { state: StopState })[]>(() => (report.value?.downtime ?? []).map((d) => ({
    key: d.code, label: DOWNTIME_NAME[d.code], value: d.sec, display: d.sec ? formatDuration(d.sec) : '-',
    sub: `${d.count}건`, tone: TONE[d.state], muted: d.sec === 0, state: d.state,
  })))

  const timelineRows = computed(() => (timeline.value?.rows ?? []).map((r) => ({
    key: r.key, label: r.label,
    segments: r.segments.map((s) => ({ from: s.from, to: s.to, tone: TONE[s.state], letter: s.state, title: `${STATE_NAME[s.state]} ${hm(s.from)}~${hm(s.to)}` })),
  })))

  /** 주·월: 일별 OEE (x = 그 기간 몇째 날) */
  const daily = computed(() => {
    const d = report.value?.daily ?? []
    const points = d.map((x, i): [number, number | null] => [i, x.oee]).filter((p): p is [number, number] => p[1] != null)
    const step = d.length > 10 ? 5 : 1
    const ticks = d.map((x, i) => ({ value: i, label: `${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))}` })).filter((_, i) => i % step === 0)
    return { points, ticks, n: d.length }
  })

  return {
    period, date, lineId, process, equipmentId, today,
    lineOptions, processOptions, equipmentOptions,
    report, timeline, rangeText, barTitle, bars, pickBar, downtime, timelineRows, daily,
  }
}
