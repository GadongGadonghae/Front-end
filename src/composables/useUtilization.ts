// 가동률 (SCR-003, API-050·051, D-108 시안 G): 타임라인을 보여 주며 라인별 OEE를 비교한다.
// 탭 = 생산 라인 6 · 코일입고 · 도장 · 비전 검사. 라인을 누르면 그 라인 설비별로 내려간다.
// 줄마다 OEE(기준 대비) · 손실 시간 · 24시간 띠(일) 또는 날짜 칸(주·월). 조건이 바뀌면 바로, 그대로 두면 1분마다 다시 부른다
import { now as clockNow } from '@/clock'
import { computed, ref, watch } from 'vue'
import { source } from '@/data'
import type { OeeQuery, OeeReport, Period, StateTimeline } from '@/types/analysis'
import type { Equipment, LineId } from '@/types/plant'
import type { DowntimeSliceView, LedgerRowView, StateSpanView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { DOWNTIME_NAME, STATE_NAME, byProcess, lineName, longShortName } from '@/lib/status'
import { formatDate, formatNumber, toDateStr } from '@/lib/format'
import { shiftBasis } from '@/lib/shift'

const POLL_MS = 60_000
const LINES: LineId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const hm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`

export type UtilTab = 'line' | 'inbound' | 'paint' | 'out'
interface Unit { key: string; label: string; q: Partial<OeeQuery>; clickable: boolean }

export function useUtilization(init: { tab?: string; line?: string } = {}) {
  const { master } = useMaster()
  const today = toDateStr(clockNow())

  // ── 화면 상태 ──
  const period = ref<Period>('day')
  const date = ref(today)
  const tab = ref<UtilTab>((['line', 'paint', 'out'] as const).find((t) => t === init.tab) ?? 'line')
  const line = ref<LineId | null>(LINES.find((l) => l === init.line) ?? null)
  const sort = ref<'line' | 'low'>('line')
  watch(tab, () => { line.value = null })

  /** 지금 보는 범위 (종합·비가동·비교 기준): 라인을 고르면 그 라인, 도장·비전 검사 탭은 그 구역, 아니면 공장 */
  const area = computed<string | null>(() => (tab.value === 'line' ? line.value : tab.value === 'paint' ? 'PT' : tab.value === 'out' ? 'VI' : null))

  const equipmentOf = (a: string): Equipment[] => (master.value?.equipment ?? [])
    .filter((e) => e.area === a && e.process !== 'COIL')
    .sort((x, y) => byProcess(x.process, y.process) || x.order - y.order)

  /** 줄 하나하나 */
  const units = computed<Unit[]>(() => {
    if (tab.value === 'inbound') return []
    if (tab.value === 'line' && !line.value) return LINES.map((id) => ({ key: id, label: lineName(id), q: { lineId: id }, clickable: true }))
    const a = area.value!
    return equipmentOf(a).map((e) => ({ key: e.id, label: longShortName(e), q: { lineId: a, equipmentId: e.id }, clickable: false }))
  })

  const key = computed(() => [period.value, date.value, area.value ?? '', units.value.map((u) => u.key).join(',')].join('|'))
  const { data } = usePoll(async () => {
    const base: OeeQuery = { period: period.value, date: date.value }
    const list = units.value
    const scope: OeeQuery = { ...base, lineId: area.value ?? undefined }
    const [summary, timeline, reports] = await Promise.all([
      source.q.getOee(scope),
      period.value === 'day' && list.length ? source.q.getStateTimeline(scope) : Promise.resolve(null as StateTimeline | null),
      Promise.all(list.map((u) => source.q.getOee({ ...base, ...u.q }))),
    ])
    return { summary, timeline, rows: list.map((u, i) => ({ u, r: reports[i] as OeeReport })) }
  }, POLL_MS, key)

  // ── 보이는 모양 ──
  const summary = computed(() => data.value?.summary ?? null)
  const isToday = computed(() => date.value === today)
  const until = computed(() => data.value?.timeline?.until ?? 86_400)
  const scopeName = computed(() => (area.value ? lineName(area.value) : '공장'))
  const title = computed(() => `${scopeName.value} 종합`)
  const periodWord = computed(() => (period.value === 'day' ? (isToday.value ? '오늘' : formatDate(`${date.value}T00:00:00`)) : period.value === 'week' ? '그 주' : '그 달'))

  const rangeText = computed(() => {
    const r = summary.value
    if (!r) return ''
    if (period.value === 'day') return isToday.value ? shiftBasis(clockNow()) : `${formatDate(r.from)} 하루`
    return `${toDateStr(Date.parse(r.from))} ~ ${toDateStr(Date.parse(r.to) - 1).slice(5)}`
  })

  const spansOf = (key: string): StateSpanView[] => {
    const row = data.value?.timeline?.rows.find((r) => r.key === key)
    if (!row) return []
    return row.segments.map((s) => {
      const ongoing = isToday.value && s.state !== 'R' && s.to >= until.value - 1
      return { state: s.state, from: s.from, to: s.to, ongoing, title: `${STATE_NAME[s.state]} ${hm(s.from)}~${ongoing ? '진행 중' : hm(s.to)}` }
    })
  }

  const rows = computed<LedgerRowView[]>(() => {
    const d = data.value
    if (!d) return []
    const base = d.summary.oee.oee
    const plantDaily = d.summary.daily
    const list = d.rows.map(({ u, r }): LedgerRowView => {
      const spans = period.value === 'day' ? spansOf(u.key) : []
      const last = spans.at(-1)
      return {
        key: u.key,
        label: u.label,
        now: last?.ongoing && last.state !== 'R' ? last.state : null,
        oee: r.oee.oee,
        base,
        lossSec: r.downtime.filter((x) => x.state !== 'S').reduce((a, x) => a + x.sec, 0),
        spans,
        days: r.daily.map((x, i) => ({ date: x.date, oee: x.oee, base: plantDaily[i]?.oee ?? null, future: x.date > today, today: x.date === today })),
        clickable: u.clickable,
      }
    })
    return sort.value === 'low' ? [...list].sort((a, b) => (a.oee ?? 999) - (b.oee ?? 999)) : list
  })

  const dayHead = computed(() => (summary.value?.daily ?? []).map((x) => {
    const dt = new Date(`${x.date}T00:00:00`)
    const d = dt.getDate()
    // 월: 1일 · 5일 간격 · 오늘만. 오늘 바로 옆 날짜는 글자가 붙어 보여 뺀다
    const nearToday = Math.abs(Date.parse(`${x.date}T00:00:00`) - Date.parse(`${today}T00:00:00`)) === 86_400_000
    const label = period.value === 'week' ? `${dt.getMonth() + 1}/${d} ${WEEKDAY[dt.getDay()]}` : x.date === today || ((d === 1 || d % 5 === 0) && !nearToday) ? String(d) : ''
    return { label, today: x.date === today }
  }))

  const oeeHead = computed(() => `OEE · ${scopeName.value} ${formatNumber(summary.value?.oee.oee, 1)}% 대비`)

  // 0건 코드는 뺀다
  const downtime = computed<DowntimeSliceView[]>(() => (summary.value?.downtime ?? []).filter((x) => x.sec > 0).map((x) => ({
    key: x.code, label: DOWNTIME_NAME[x.code], state: x.state, sec: x.sec, count: x.count,
  })))

  const pickLine = (key: string) => { line.value = key as LineId }
  const backToLines = () => { line.value = null }

  return {
    period, date, tab, line, sort, today,
    summary, rows, until, dayHead, oeeHead, downtime, title, scopeName, periodWord, rangeText,
    pickLine, backToLines, loading: computed(() => !data.value),
  }
}
