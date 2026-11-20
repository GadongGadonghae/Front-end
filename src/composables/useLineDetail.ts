// 라인 상세 (SCR-010 2·3번): 1초 snapshot(상태·실적) + 10초 summary(계획·OEE·불량·재공) + 30초 공정 요약(API-030, 사이클·CT)
import { computed } from 'vue'
import { source } from '@/data'
import type { Equipment, LineId, ProcessId } from '@/types/plant'
import type { ProcessToday } from '@/types/process'
import type { BarRowView, FlowCellView, LineFlowView, LineNowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useNow } from '@/composables/useNow'
import { usePoll } from '@/composables/usePoll'
import { useTodayAlarms } from '@/composables/useTodayAlarms'
import { countByState, DOWNTIME_NAME, longShortName, PROCESS_NAME, worstState } from '@/lib/status'
import { formatDuration, formatNumber, toDateStr } from '@/lib/format'

/** 공정 요약 갱신 주기 (API 명세 6장) */
const PROCESS_POLL_MS = 30_000
/** 프레스는 4단 뒤 1회 검사 (A-09) */
const INSPECTION_NOTE: Partial<Record<ProcessId, string>> = { PRESS: '4단 뒤 검사' }

export function useLineDetail(lineId: LineId) {
  const { master } = useMaster()
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const now = useNow()

  const processes: ProcessId[] = lineId === 'PT' ? ['PAINTING'] : ['SLITTING', 'PRESS', 'WELDING']
  const { data: today } = usePoll(() => Promise.all(processes.map((p) => source.q.getProcessToday(lineId, p))), PROCESS_POLL_MS)
  // 라인 OEE 3요소 (가동률 화면과 같은 API-050, 오늘·이 라인)
  const { data: oeeReport } = usePoll(() => source.q.getOee({ period: 'day', date: toDateStr(Date.now()), lineId }), PROCESS_POLL_MS)
  // 오늘 알람 이력 (11/20): 알람 이력 탭과 같은 기준 = 이 라인 설비의 고장(D) + 통신 끊김(DC)
  const { rows: alarms } = useTodayAlarms(lineId)

  const oeeRows = computed<BarRowView[]>(() => {
    const o = oeeReport.value?.oee
    const row = (key: string, label: string, v: number | null | undefined): BarRowView => ({ key, label, value: v ?? null, display: v == null ? '-' : formatNumber(v, 1) })
    return [row('a', '시간가동률', o?.availability), row('p', '성능가동률', o?.performance), row('q', '양품률', o?.quality)]
  })

  const equipment = computed(() => (master.value?.equipment ?? []).filter((e) => e.area === lineId))
  const liveById = computed(() => new Map((snapshot.value?.equipment ?? []).map((e) => [e.id, e])))
  const lineSummary = computed(() => summary.value?.lines.find((l) => l.lineId === lineId) ?? null)
  const todayOf = (p: ProcessId): ProcessToday | undefined => today.value?.find((t) => t.process === p)

  const states = computed(() => equipment.value.map((e) => liveById.value.get(e.id)?.state ?? 'R'))

  function cell(e: Equipment): FlowCellView {
    const l = liveById.value.get(e.id)
    const state = l?.state ?? 'R'
    const row = todayOf(e.process)?.equipment.find((x) => x.id === e.id)
    const info: FlowCellView['info'] = []
    if (row) {
      info.push({ label: e.process === 'PRESS' ? '오늘 사이클' : '오늘 생산', value: formatNumber(row.cycles) })
      // 그 설비에서 공정 판정 NG(폐기)된 수 (11/20). 있으면 빨간 글씨
      info.push({ label: '불량', value: formatNumber(row.ng ?? 0), alert: (row.ng ?? 0) > 0 })
      if (row.avgCtMs != null) info.push({ label: '평균 CT', value: `${formatNumber(row.avgCtMs / 1000, 1)}초` })
    }
    return {
      id: e.id,
      name: longShortName(e),
      state,
      duration: l ? formatDuration((now.value - Date.parse(l.since)) / 1000) : '-',
      pdm: l?.pdm ? { level: l.pdm.level, text: `${l.pdm.level === 'danger' ? '위험' : '주의'} ${l.pdm.percent}%` } : null,
      reason: l && state !== 'R' && l.code ? { code: DOWNTIME_NAME[l.code], detail: l.detail } : null,
      note: row?.slowest ? '가장 느린 단' : null,
      info,
    }
  }

  const flow = computed<LineFlowView | null>(() => {
    if (!master.value || !snapshot.value) return null
    const groups: LineFlowView['groups'] = processes.map((p) => ({
      process: p,
      name: PROCESS_NAME[p],
      cells: equipment.value.filter((e) => e.process === p).sort((a, b) => a.order - b.order).map(cell),
      output: todayOf(p)?.output ?? null,
      ng: lineSummary.value?.ngByProcess[p as 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING'] ?? null,
      note: INSPECTION_NOTE[p] ?? null,
    }))
    if (lineId === 'PT') {
      // 도장 #1·#2는 병렬: 세로로 쌓고, A~F 라인이 지금 어느 도장으로 보내는지 선으로 보인다
      groups[0].stack = true
      const feeds = master.value.lines.filter((l) => l.kind === 'production').map((l) => ({ label: l.name, to: l.currentPaintId }))
      return { from: '라인에서', to: '출고로', groups, wip: [], feeds }
    }
    const wip = lineSummary.value?.wip.map((w) => w.qty) ?? [null, null]
    return { from: '입고에서', to: '도장으로', groups, wip, endWip: [null, null] }
  })

  const now_ = computed<LineNowView>(() => {
    const ls = lineSummary.value
    const done = snapshot.value?.lines.find((l) => l.lineId === lineId)?.done ?? ls?.done ?? null
    const plan = ls?.plan ?? null
    const ngRows = processes.map((p) => ({
      process: p,
      label: INSPECTION_NOTE[p] ? `${PROCESS_NAME[p]} (${INSPECTION_NOTE[p]})` : PROCESS_NAME[p],
      value: ls?.ngByProcess[p as 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING'] ?? 0,
    }))
    return {
      state: worstState(states.value),
      counts: countByState(states.value),
      equipmentCount: equipment.value.length,
      done,
      plan,
      rate: done != null && plan ? Math.round((done / plan) * 1000) / 10 : null,
      oee: ls?.oee ?? null,
      ngTotal: ls ? ngRows.reduce((a, r) => a + r.value, 0) : null,
      ngRows,
    }
  })

  return { flow, now: now_, oeeRows, alarms }
}
