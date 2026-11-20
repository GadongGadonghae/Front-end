// 알람·비가동 이력 (SCR-006, API-070·071·042): 탭 [알람·비가동] / [예지보전 위험] (D-65)
// 필터 순서 기간 → 라인 → 공정 → 상태 → 코드 → 진행 중만, 기본 오늘·전체·상태 고르지 않음=모두 (D-64, D-84, 11/20). 기간 최대 31일, 50건씩 (D-66)
// 필터·페이지가 바뀌면 다시 부른다. 진행 중 건의 지속시간은 화면 시계로 늘리고, 알람이 생기거나 풀리면 다시 부른다 (API 명세 4.6)
import { computed, onScopeDispose, ref, watch } from 'vue'
import { source } from '@/data'
import type { HistoryEvent, HistoryQuery, HistorySummaryQuery, HistoryTodo, RiskEvent, RiskQuery } from '@/types/events'
import type { DowntimeCode, StopState } from '@/types/state'
import { useMaster } from '@/composables/useMaster'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME, PROCESS_NAME, byProcess, lineName, ALARM_LEVEL_NAME } from '@/lib/status'
import { formatDuration, formatTime, toDateStr } from '@/lib/format'
import { metricLabel } from '@/lib/metrics'

export type HistoryTab = 'alarm' | 'risk'

/** 알람 = 고장(D) 코드. 명세 3종(장비고장 · 장비고장(알람) · 안전문제, FN-005)은 0건이어도 늘 보이고, 백엔드에만 있는 고장 코드는 건이 있을 때만 (D-109, Q-39) */
const ALARM_CODES: DowntimeCode[] = ['UP_BREAKDOWN', 'UP_ALARM', 'UP_SAFETY']
const TODO_LABEL: Record<HistoryTodo, string> = { ongoingFault: '진행 중 고장', notifyFail: '메일 발송 실패' }
/** 아직 손볼 건 (D-111): 지금 손볼 것만 */
const TODO_KEYS: HistoryTodo[] = ['ongoingFault', 'notifyFail']
const STATE_LABEL: Record<StopState, string> = { D: '고장', I: '대기', S: '정지' }

/** 왼쪽 요약 열 (D-109) */
export interface AlarmSummaryView {
  /** hidden = 상태 필터에서 빠져 표에 안 나옴 (요약은 셋 다 센다) */
  states: { state: StopState; label: string; count: number; hidden: boolean }[]
  alarms: { code: DowntimeCode; name: string; count: number }[]
  todo: { key: HistoryTodo; label: string; count: number }[]
}


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
  /** 설비 ID (조치 쓰기 권한: 라인 담당자는 본인 라인만) */
  equipmentId: string
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
  // 처음엔 아무것도 안 고름 = 모든 상태 (11/20: 예전엔 고장·대기가 미리 골라져 있었음)
  const states = ref<Record<StopState, boolean>>({ D: false, I: false, S: false })
  const anyState = computed(() => states.value.D || states.value.I || states.value.S)
  const code = ref<'' | DowntimeCode>('')
  const ongoing = ref(false)
  /** 아직 손볼 건만 (왼쪽 열에서 고름) */
  const todo = ref<'' | HistoryTodo>('')
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

  /** 대시보드 팝업 "조치 가기"(?eq=설비ID): 그 설비의 라인·공정, 진행 중 건으로 필터를 맞춘다 */
  const focusEquipment = (id: string) => {
    const e = equipmentById.value.get(id)
    if (!e) return
    tab.value = 'alarm'
    lineId.value = e.area
    process.value = e.process
    ongoing.value = true
  }

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
    ...(master.value?.downtimeCodes ?? []).filter((d) => !anyState.value || states.value[d.state as StopState]).map((d) => ({ value: d.code, label: d.name })),
  ])
  watch(codeOptions, (opts) => { if (!opts.some((o) => o.value === code.value)) code.value = '' })

  // ── 조회 ──
  const pickedStates = computed(() => (['D', 'I', 'S'] as StopState[]).filter((s) => states.value[s]))
  const alarmQuery = computed<HistoryQuery>(() => ({
    from: from.value, to: to.value, lineId: lineId.value || undefined, process: process.value || undefined,
    states: pickedStates.value, code: code.value || undefined, ongoing: ongoing.value || undefined, todo: todo.value || undefined, page: page.value,
    // 짧은 건도 모두 남긴다 (1분 미만으로 끝난 대기도 해제 시각과 함께, 11/20)
    minMinutes: 0,
  }))
  // 요약은 표와 같은 기준으로 센다 (1분 미만 포함)
  const summaryQuery = computed<HistorySummaryQuery>(() => ({ from: from.value, to: to.value, lineId: lineId.value || undefined, process: process.value || undefined, minMinutes: 0 }))
  const riskQuery = computed<RiskQuery>(() => ({ from: from.value, to: to.value, lineId: lineId.value || undefined, page: page.value }))
  watch([tab, from, to, lineId, process, pickedStates, code, ongoing, todo], () => { page.value = 1 })

  const alarms = usePoll(
    () => (tab.value === 'alarm' ? source.q.getHistory(alarmQuery.value) : Promise.resolve(null)),
    null, () => [tab.value, alarmQuery.value],
  )
  const risks = usePoll(
    () => (tab.value === 'risk' ? source.q.getRiskHistory(riskQuery.value) : Promise.resolve(null)),
    null, () => [tab.value, riskQuery.value],
  )
  const summary = usePoll(
    () => (tab.value === 'alarm' ? source.q.getHistorySummary(summaryQuery.value) : Promise.resolve(null)),
    null, () => [tab.value, summaryQuery.value],
  )
  // 새 알람·해제, 위험 진입·해제가 오면 지금 보는 표를 다시 부른다
  const offAlarm = source.live.onAlarm(() => { if (tab.value === 'alarm') { alarms.reload(); summary.reload() } })
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

  /** 진행 중 고장 → 진행 중 대기 → 나머지 발생 최근순 (D-111). 진행 중 건은 늘 가장 최근이라 첫 페이지 안에서 다시 줄 세운다 */
  const rank = (e: HistoryEvent) => (e.end != null ? 2 : e.state === 'D' ? 0 : 1)
  const ordered = computed(() => [...(alarms.data.value?.items ?? [])].sort((a, b) => rank(a) - rank(b)))
  const alarmRows = computed<AlarmRow[]>(() => ordered.value.map((e) => ({
    id: e.id,
    state: e.state,
    ongoing: e.end == null,
    start: when(e.start),
    // 해제가 발생과 다른 날이면 날짜를 붙인다
    end: e.end ? (multiDay.value || !sameDay(e.start, e.end) ? when(e.end) : formatTime(e.end)) : '',
    line: areaLabel(e.equipmentId),
    equipmentId: e.equipmentId,
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

  const summaryView = computed<AlarmSummaryView | null>(() => {
    const s = summary.data.value
    if (!s) return null
    const of = (st: StopState) => s.byCode.filter((c) => c.state === st)
    const otherAlarms = of('D').filter((c) => !ALARM_CODES.includes(c.code)).map((c) => c.code)
    return {
      states: (['D', 'I', 'S'] as StopState[]).map((st) => {
        const cs = of(st)
        return { state: st, label: STATE_LABEL[st], count: cs.reduce((a, c) => a + c.count, 0), hidden: !states.value[st] }
      }),
      alarms: [...ALARM_CODES, ...otherAlarms].map((c) => ({ code: c, name: DOWNTIME_NAME[c], count: s.byCode.find((x) => x.code === c)?.count ?? 0 })),
      todo: TODO_KEYS.map((k) => ({ key: k, label: TODO_LABEL[k], count: s.todo[k] })),
    }
  })

  /** 왼쪽 알람 코드: 누르면 그 코드만 (고장을 켠다), 다시 누르면 풀림 */
  function pickAlarm(c: DowntimeCode) {
    if (code.value === c) { code.value = ''; return }
    states.value = { ...states.value, D: true }
    code.value = c
  }
  function pickTodo(k: HistoryTodo) {
    todo.value = todo.value === k ? '' : k
  }
  /** 요약에서 "표에 없음"인 상태를 표에도 보이게 */
  function showState(st: StopState) {
    states.value = { ...states.value, [st]: true }
  }

  /** 조치 메모 저장. 빈 글이면 지운다. 담당자는 로그인 사용자 (D-84) */
  async function saveMemo(eventId: string, memo: string) {
    await source.cmd.saveActionMemo(eventId, memo)
    alarms.reload()
    summary.reload()
  }

  return {
    tab, from, to, lineId, process, states, code, ongoing, todo, page, today, focusEquipment, equipmentById,
    lineOptions, processOptions, codeOptions,
    alarmRows, riskRows, total, size, loading, saveMemo,
    summaryView, pickAlarm, pickTodo, showState, todoLabel: (k: HistoryTodo) => TODO_LABEL[k], codeLabel: (c: DowntimeCode) => DOWNTIME_NAME[c],
  }
}
