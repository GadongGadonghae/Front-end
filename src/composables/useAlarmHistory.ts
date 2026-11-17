// 알람·비가동 이력 (SCR-006, API-070·071·042): 탭 [알람·비가동] / [예지보전 위험] (D-65)
// 필터 순서 기간 → 라인 → 공정 → 상태 → 코드 → 진행 중만, 기본 오늘·전체·D·I (D-64, D-84). 기간 최대 31일, 50건씩 (D-66)
// 필터·페이지가 바뀌면 다시 부른다. 진행 중 건의 지속시간은 화면 시계로 늘리고, 알람이 생기거나 풀리면 다시 부른다 (API 명세 4.6)
import { computed, onScopeDispose, ref, watch } from 'vue'
import { source } from '@/data'
import type { HistoryEvent, HistoryQuery, RiskEvent, RiskQuery } from '@/types/events'
import type { DowntimeCode, StopState } from '@/types/state'
import { useMaster } from '@/composables/useMaster'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME, PROCESS_NAME, byProcess, lineName, ALARM_LEVEL_NAME } from '@/lib/status'
import { formatDuration, formatTime, toDateStr } from '@/lib/format'
import { metricLabel } from '@/lib/metrics'

export type HistoryTab = 'alarm' | 'risk'


/** 기간 최대 31일 (D-66) */
export const MAX_DAYS = 31
const DAY = 86_400_000
const AREAS = [
  { value: 'A', label: 'A라인' }, { value: 'B', label: 'B라인' }, { value: 'C', label: 'C라인' }, { value: 'D', label: 'D라인' },
  { value: 'E', label: 'E라인' }, { value: 'F', label: 'F라인' }, { value: 'PT', label: '도장' }, { value: 'VI', label: '출고' },
]

/** 표 한 줄 (알람·비가동) */
export interface AlarmRow {
  id: string
  state: StopState
  ongoing: boolean
  start: string
  end: string
  line: string
  equipment: string
  code: string
  /** 관리값 이탈 알람 등급 (경고·심각) */
  level: string | null
  critical: boolean
  detail: string
  duration: string
  notify: HistoryEvent['notify']
  memo: string | null
  memoBy: string | null
  memoAt: string
  /** D 건만: 보고서가 있으면 view, 없으면 create */
  report: 'view' | 'create' | null
  reportId: string | null
}

/** 표 한 줄 (예지보전 위험) */
export interface RiskRow {
  id: string
  ongoing: boolean
  start: string
  end: string
  line: string
  equipment: string
  item: string
  max: string
}

export function useAlarmHistory() {
  const { master, equipmentById } = useMaster()
  const now = useNow()
  const today = toDateStr(Date.now())

  const tab = ref<HistoryTab>('alarm')
  const from = ref(today)
  const to = ref(today)
  const lineId = ref('')
  const process = ref('')
  const states = ref<Record<StopState, boolean>>({ D: true, I: true, S: false })
  const code = ref<'' | DowntimeCode>('')
  const ongoing = ref(false)
  const page = ref(1)

  // 기간: 끝이 시작보다 앞이면 맞추고, 31일을 넘으면 반대쪽을 당긴다
  const span = () => (Date.parse(to.value) - Date.parse(from.value)) / DAY
  watch(from, () => {
    if (to.value < from.value) to.value = from.value
    else if (span() >= MAX_DAYS) to.value = toDateStr(Math.min(Date.parse(from.value) + (MAX_DAYS - 1) * DAY, Date.parse(today)))
  })
  watch(to, () => {
    if (from.value > to.value) from.value = to.value
    else if (span() >= MAX_DAYS) from.value = toDateStr(Date.parse(to.value) - (MAX_DAYS - 1) * DAY)
  })

  // ── 고를 것 ──
  const scoped = computed(() => (master.value?.equipment ?? []).filter((e) => e.process !== 'COIL' && (!lineId.value || e.area === lineId.value)))
  const lineOptions = [{ value: '', label: '전체' }, ...AREAS]
  const processOptions = computed(() => [
    { value: '', label: '전체' },
    ...[...new Set(scoped.value.map((e) => e.process))].sort(byProcess).map((p) => ({ value: p, label: PROCESS_NAME[p] })),
  ])
  watch(lineId, () => { if (!processOptions.value.some((o) => o.value === process.value)) process.value = '' })
  /** 코드는 고른 상태의 것만 */
  const codeOptions = computed(() => [
    { value: '' as const, label: '전체' },
    ...(master.value?.downtimeCodes ?? []).filter((d) => states.value[d.state as StopState]).map((d) => ({ value: d.code, label: d.name })),
  ])
  watch(codeOptions, (opts) => { if (!opts.some((o) => o.value === code.value)) code.value = '' })

  // ── 조회 ──
  const pickedStates = computed(() => (['D', 'I', 'S'] as StopState[]).filter((s) => states.value[s]))
  const alarmQuery = computed<HistoryQuery>(() => ({
    from: from.value, to: to.value, lineId: lineId.value || undefined, process: process.value || undefined,
    states: pickedStates.value, code: code.value || undefined, ongoing: ongoing.value || undefined, page: page.value,
  }))
  const riskQuery = computed<RiskQuery>(() => ({ from: from.value, to: to.value, lineId: lineId.value || undefined, page: page.value }))
  watch([tab, from, to, lineId, process, pickedStates, code, ongoing], () => { page.value = 1 })

  const alarms = usePoll(
    () => (tab.value === 'alarm' ? source.q.getHistory(alarmQuery.value) : Promise.resolve(null)),
    null, () => [tab.value, alarmQuery.value],
  )
  const risks = usePoll(
    () => (tab.value === 'risk' ? source.q.getRiskHistory(riskQuery.value) : Promise.resolve(null)),
    null, () => [tab.value, riskQuery.value],
  )
  // 새 알람·해제, 위험 진입·해제가 오면 지금 보는 표를 다시 부른다
  const offAlarm = source.live.onAlarm(() => { if (tab.value === 'alarm') alarms.reload() })
  const offRisk = source.live.onRiskChanged(() => { if (tab.value === 'risk') risks.reload() })
  onScopeDispose(() => { offAlarm(); offRisk() })

  // ── 보이는 모양 ──
  const multiDay = computed(() => from.value !== to.value)
  /** 하루만 보면 시각만, 여러 날이면 날짜도 */
  const when = (iso: string) => (multiDay.value ? `${toDateStr(Date.parse(iso)).slice(5).replace('-', '/')} ${formatTime(iso)}` : formatTime(iso))
  const areaLabel = (equipmentId: string) => {
    const a = equipmentById.value.get(equipmentId)?.area
    return a ? lineName(a) : '-'
  }
  /** 라인 열이 따로 있으니 설비는 라인 없이 (프레스 3단, 도장 #2) */
  const eqLabel = (equipmentId: string) => {
    const e = equipmentById.value.get(equipmentId)
    return e ? (e.process === 'PRESS' ? `프레스 ${e.shortName}` : e.shortName) : equipmentId
  }
  const sameDay = (a: string, b: string) => toDateStr(Date.parse(a)) === toDateStr(Date.parse(b))

  const alarmRows = computed<AlarmRow[]>(() => (alarms.data.value?.items ?? []).map((e) => ({
    id: e.id,
    state: e.state,
    ongoing: e.end == null,
    start: when(e.start),
    // 해제가 발생과 다른 날이면 날짜를 붙인다
    end: e.end ? (multiDay.value || !sameDay(e.start, e.end) ? when(e.end) : formatTime(e.end)) : '',
    line: areaLabel(e.equipmentId),
    equipment: eqLabel(e.equipmentId),
    code: DOWNTIME_NAME[e.code],
    level: e.alarmLevel ? ALARM_LEVEL_NAME[e.alarmLevel] : null,
    critical: e.alarmLevel === 'CRITICAL',
    detail: e.detail ?? '-',
    duration: formatDuration(((e.end ? Date.parse(e.end) : now.value) - Date.parse(e.start)) / 1000),
    notify: e.notify,
    memo: e.memo,
    memoBy: e.memoBy,
    memoAt: e.memoAt ? when(e.memoAt).trim().slice(0, -3) : '',
    report: e.state === 'D' ? (e.reportId ? 'view' : 'create') : null,
    reportId: e.reportId,
  })))

  const riskRows = computed<RiskRow[]>(() => (risks.data.value?.items ?? []).map((r: RiskEvent) => ({
    id: r.id,
    ongoing: r.end == null,
    start: when(r.start),
    end: r.end ? when(r.end) : '',
    line: areaLabel(r.equipmentId),
    equipment: eqLabel(r.equipmentId),
    item: metricLabel(r.item),
    max: `${r.maxPercent}%`,
  })))

  const total = computed(() => (tab.value === 'alarm' ? alarms.data.value?.total : risks.data.value?.total) ?? 0)
  const size = computed(() => (tab.value === 'alarm' ? alarms.data.value?.size : risks.data.value?.size) ?? 50)
  const loading = computed(() => (tab.value === 'alarm' ? alarms.loading.value : risks.loading.value))

  /** 조치 메모 저장. 빈 글이면 지운다. 담당자는 로그인 사용자 (D-84) */
  async function saveMemo(eventId: string, memo: string) {
    await source.cmd.saveActionMemo(eventId, memo)
    alarms.reload()
  }

  return {
    tab, from, to, lineId, process, states, code, ongoing, page, today,
    lineOptions, processOptions, codeOptions,
    alarmRows, riskRows, total, size, loading, saveMemo,
  }
}
