// 리포트 (SCR-007): 일일 생산 리포트 (API-080) · 계획수정 보고서 목록·내용·만들기 (API-081~084)
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { source } from '@/data'
import type { StopState } from '@/types/state'
import type { ReplanReport, ReplanSummary } from '@/types/report'
import type { BarRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME, PROCESS_NAME } from '@/lib/status'
import { formatDuration, formatNumber, formatTime, toDateStr } from '@/lib/format'
import { josa } from '@/lib/josa'

/** 오늘 리포트는 1분마다 다시 (지난 날은 마감 값이라 한 번) */
const POLL_MS = 60_000
/** 보고서 목록 기간: 최근 31일 */
const LIST_DAYS = 31
const DAY = 86_400_000
const TONE: Record<StopState, BarRowView['tone']> = { S: 'stop', I: 'idle', D: 'down' }
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 2026-11-16 (월) */
export function dateWithDay(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${date} (${WEEKDAY[new Date(y, m - 1, d).getDay()]})`
}

export function useDailyReport() {
  const today = toDateStr(Date.now())
  const date = ref(today)
  const { data: report } = usePoll(
    () => source.q.getDailyReport(date.value),
    POLL_MS, date,
  )

  const procLabel = (p: string) => (p === 'INSPECTION' ? '출고 (비전)' : PROCESS_NAME[p as keyof typeof PROCESS_NAME])
  /** 공정 앞 재공: 그 공정으로 들어오기 전 공정 사이에 쌓인 수 (슬리팅 앞은 코일, 롤) */
  const wipBefore = (p: string) => report.value?.wip.find((w) => w.to === p) ?? null
  const processRows = computed(() => (report.value?.processes ?? []).map((p) => {
    const w = wipBefore(p.process)
    return {
      key: p.process, label: procLabel(p.process), output: p.output, ng: p.ng, rate: p.output ? Math.round((p.ng / p.output) * 1000) / 10 : null,
      wip: w?.qty ?? null, wipUnit: w ? (w.unit === 'roll' ? '롤' : '개') : '',
    }
  }))
  const downtime = computed<(BarRowView & { state: StopState })[]>(() => (report.value?.downtime ?? []).map((d) => ({
    key: d.code, label: DOWNTIME_NAME[d.code], value: d.sec, display: formatDuration(d.sec), sub: `${d.count}건`, tone: TONE[d.state], state: d.state,
  })))
  const stamp = computed(() => {
    const r = report.value
    if (!r) return ''
    return r.closed ? `${r.date.slice(5)} 마감` : `00:00 ~ ${formatTime(r.at).slice(0, 5)} 기준`
  })

  return { date, today, report, processRows, downtime, stamp }
}

export function useReplanReports(selectedId: Ref<string | null>) {
  const { equipmentName } = useMaster()
  const today = toDateStr(Date.now())
  const from = toDateStr(Date.parse(today) - (LIST_DAYS - 1) * DAY)

  const list = shallowRef<ReplanSummary[] | null>(null)
  const loadList = () => source.q.getReplanReports(from, today).then((l) => { list.value = l })
  loadList()

  const report = shallowRef<ReplanReport | null>(null)
  const missing = ref(false)
  watch(selectedId, (id) => {
    report.value = null
    missing.value = false
    if (!id) return
    source.q.getReplanReport(id).then((r) => {
      if (selectedId.value !== id) return
      report.value = r
      missing.value = !r
    })
  }, { immediate: true })

  /** 날짜별로 묶은 목록 */
  const groups = computed(() => {
    const out: { date: string; label: string; items: (ReplanSummary & { name: string; codeName: string; time: string })[] }[] = []
    for (const r of list.value ?? []) {
      const d = toDateStr(Date.parse(r.createdAt))
      let g = out.at(-1)
      if (!g || g.date !== d) out.push(g = { date: d, label: dateWithDay(d), items: [] })
      g.items.push({ ...r, name: equipmentName(r.equipmentId), codeName: DOWNTIME_NAME[r.code], time: formatTime(r.createdAt) })
    }
    return out
  })

  /** 고장 건으로 보고서 만들기 (D-68). 만든 보고서 ID */
  async function create(stateEventId: string) {
    const r = await source.cmd.createReplanReport(stateEventId)
    await loadList()
    return r.id
  }

  // ── 보고서 내용의 문장과 숫자 ──
  const view = computed(() => {
    const r = report.value
    if (!r) return null
    const name = equipmentName(r.equipmentId)
    const line = r.kind === 'line' ? `${r.equipmentId.split('-')[0]}라인` : null
    const capSum = r.allocations.reduce((a, x) => a + x.capacity, 0)
    const planSum = r.allocations.reduce((a, x) => a + x.remainingPlan, 0)
    const addSum = r.allocations.reduce((a, x) => a + x.add, 0)
    const ct = `${formatNumber(r.ctSec)}초`
    const remaining = formatDuration(r.remainingSec)
    const baseDay = toDateStr(Date.parse(r.baseAt))
    return {
      title: `계획수정 보고서 · ${name}`,
      created: `${dateWithDay(toDateStr(Date.parse(r.createdAt)))} ${formatTime(r.createdAt)} 생성 · ${r.createdBy}`,
      name, line,
      start: formatTime(r.start),
      code: DOWNTIME_NAME[r.code],
      detail: r.detail ?? '-',
      occurred: r.kind === 'line'
        ? `${josa(name, '이/가')} ${formatTime(r.start)}에 ${josa(DOWNTIME_NAME[r.code], '으로/로')} 멈췄습니다. 라인 안 설비는 한 줄로 이어져 있어 ${line} 전체가 멈춘 것으로 보고 계산했습니다.`
        : r.kind === 'paint'
          ? `${josa(name, '이/가')} ${formatTime(r.start)}에 ${josa(DOWNTIME_NAME[r.code], '으로/로')} 멈췄습니다. 같은 도장 공정의 다른 1대가 나머지를 맡는 것으로 계산했습니다.`
          : `${josa(name, '이/가')} ${formatTime(r.start)}에 ${josa(DOWNTIME_NAME[r.code], '으로/로')} 멈췄습니다. 비전검사기는 1대뿐이라 대신할 설비가 없습니다.`,
      remaining,
      remainingRange: `${formatTime(r.baseAt)} ~ 24:00${baseDay !== toDateStr(Date.parse(r.createdAt)) ? ` (${baseDay})` : ''}`,
      stoppedLabel: r.kind === 'line' ? `${line} 남은 라인 계획` : r.kind === 'paint' ? `${name} 남은 계획` : '남은 출고 (목표 − 실적)',
      stoppedSub: r.kind === 'line'
        ? `라인 계획 ${formatNumber(r.stoppedPlan)} − 실적 ${formatNumber(r.stoppedDone)}`
        : r.kind === 'paint'
          ? `목표의 절반 ${formatNumber(r.stoppedPlan)} − 실적 ${formatNumber(r.stoppedDone)}`
          : `목표 ${formatNumber(r.stoppedPlan)} − 실적 ${formatNumber(r.stoppedDone)}`,
      shortageText: r.kind === 'line'
        ? `${josa(line ?? '', '이/가')} 자정까지 만들 예정이던 라인 계획이 부족 수량입니다.`
        : r.kind === 'paint'
          ? `${josa(name, '이/가')} 자정까지 맡을 예정이던 수량이 부족 수량입니다.`
          : '오늘 남은 출고 전량이 부족 수량입니다.',
      allocText: r.allocations.length
        ? `${r.kind === 'line' ? `정상 라인 ${r.allocations.length}개` : '다른 도장 설비'}의 남은 능력 비율대로 ${formatNumber(r.shortage)}개를 나눴습니다. 남은 능력 = 남은 시간 ÷ ${r.kind === 'line' ? '라인 CT' : '도장 CT'} ${ct} − 남은 계획.`
        : r.kind === 'vision' ? '대신할 설비가 없어 나눌 곳이 없습니다.' : '정상인 다른 라인(설비)이 없어 나눌 곳이 없습니다.',
      rows: r.allocations.map((a) => ({
        key: a.target,
        target: a.target.length === 1 ? `${a.target}라인` : equipmentName(a.target),
        remainingPlan: a.remainingPlan, capacity: a.capacity, share: a.share, add: a.add,
      })),
      sums: { remainingPlan: planSum, capacity: capSum, add: addSum },
      ok: r.unmet === 0,
      result: r.unmet === 0
        ? `남은 능력 합 ${formatNumber(capSum)}개가 부족 수량 ${formatNumber(r.shortage)}개보다 많아${r.target != null ? ` 오늘 목표 ${formatNumber(r.target)}개를` : ''} 맞출 수 있을 것으로 예상합니다.`
        : `${r.allocations.length ? `남은 능력 합 ${formatNumber(capSum)}개가 부족 수량 ${formatNumber(r.shortage)}개보다 적어` : '나눌 곳이 없어'} ${formatNumber(r.unmet)}개가 목표에 못 미칠 것으로 예상합니다.`,
      unmet: r.unmet,
    }
  })

  return { list, groups, report, view, missing, create, reload: loadList }
}
