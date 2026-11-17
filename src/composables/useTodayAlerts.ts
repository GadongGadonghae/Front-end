// 오늘 알림: 상태 이력(API-022) + 예지보전 위험 이력(API-023). 처음에 조회하고 실시간 이벤트로 이어 붙인다.
// 화면에는 알림 한 줄 모양(AlertRowView)으로 넘긴다: 진행 중 위, 해제는 아래, 각각 최근순 (화면정의서 SCR-001 10번)
import { computed, onScopeDispose, ref } from 'vue'
import { source } from '@/data'
import type { RiskEvent, StateEvent } from '@/types/events'
import type { AlertRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { useNow } from '@/composables/useNow'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDuration, formatTime } from '@/lib/format'

export function useTodayAlerts(filter?: { area?: string }) {
  const events = ref<StateEvent[]>([])
  const risks = ref<RiskEvent[]>([])
  const { equipmentName } = useMaster()
  const now = useNow()

  const load = () => {
    source.q.getTodayStateEvents(filter).then((list) => { events.value = list })
    source.q.getTodayRiskEvents(filter).then((list) => { risks.value = list })
  }
  load()

  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list.splice(i, 1, item)
    else list.unshift(item)
  }
  const offAlarm = source.live.onAlarm(({ event }) => upsert(events.value, event))
  const offRisk = source.live.onRiskChanged((r) => upsert(risks.value, r))
  onScopeDispose(() => { offAlarm(); offRisk() })

  /** 진행 중이면 지금까지, 해제면 "지속 시간" */
  const duration = (start: string, end: string | null) => {
    const s = ((end ? Date.parse(end) : now.value) - Date.parse(start)) / 1000
    return end ? `지속 ${formatDuration(s)}` : formatDuration(s)
  }

  const rows = computed<AlertRowView[]>(() => {
    const stateRows = events.value.map((e): AlertRowView => ({
      id: e.id,
      kind: e.state,
      title: equipmentName(e.equipmentId),
      message: [DOWNTIME_NAME[e.code], e.detail].filter(Boolean).join(' · '),
      start: e.start,
      time: formatTime(e.start),
      duration: duration(e.start, e.end),
      ongoing: e.end === null,
      report: e.state === 'D' ? (e.reportId ? 'view' : 'create') : null,
      reportId: e.reportId,
      equipmentId: e.equipmentId,
    }))
    const riskRows = risks.value.map((r): AlertRowView => ({
      id: r.id,
      kind: 'risk',
      title: equipmentName(r.equipmentId),
      message: `예지보전 위험 · ${r.item} ${r.maxPercent}%`,
      start: r.start,
      time: formatTime(r.start),
      duration: duration(r.start, r.end),
      ongoing: r.end === null,
      report: null,
      reportId: null,
      equipmentId: r.equipmentId,
    }))
    const all = [...stateRows, ...riskRows]
    const byRecent = (a: AlertRowView, b: AlertRowView) => b.start.localeCompare(a.start)
    return [...all.filter((r) => r.ongoing).sort(byRecent), ...all.filter((r) => !r.ongoing).sort(byRecent)]
  })

  const ongoingCount = computed(() => rows.value.filter((r) => r.ongoing).length)

  return { rows, ongoingCount, reload: load }
}
