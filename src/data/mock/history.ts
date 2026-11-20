// 데모 알람·비가동 이력 (API-070)과 예지보전 위험 이력 (API-071).
// 오늘은 지금 상태 이력 그대로, 지난 날은 가동률 화면과 같은 비가동 구간(analysis.stopsOf)에 상세·메모·발송 결과를 붙인다. 값은 데모용 (CLAUDE.md)
import type { DowntimeCode, StateCode, StopState } from '@/types/state'
import type { HistoryEvent, HistoryQuery, HistorySummary, HistorySummaryQuery, NotifyResult, RiskEvent, RiskQuery, StateEvent } from '@/types/events'
import type { Equipment } from '@/types/plant'
import type { Paged } from '@/types/production'
import { MASTER } from '@/data/mock/master'
import { isTodo, summarize } from '@/data/historyTodo'
import { PAST_DETAIL, PAST_MEMOS, MAIL_FAIL_TODAY } from '@/data/mock/scenario'
import { between, dayStart, daysOf, hash, localDate, noise, rng } from '@/data/mock/rand'

type Stop = { state: StopState; code: DowntimeCode; from: number; to: number }

interface Ctx {
  now: () => number
  events: () => StateEvent[]
  risks: () => RiskEvent[]
  stopsOf: (e: Equipment, date: string) => Stop[]
  /** 지난 날 건의 계획수정 보고서 ID (reports가 정한다) */
  reportOf: (eventId: string, state: StateCode) => string | null
  pageSize: number
}

const iso = (ms: number) => new Date(ms).toISOString()
/** 데모 조회 상한: 기간이 길어도 31일까지만 (D-66) */
const MAX_DAYS = 31
/** 데모 상세 문구에 쓸 항목 한국어 이름 (화면용 이름 표는 lib/metrics. data는 lib을 쓰지 않는다) */
const ITEM_KO: Record<string, string> = { pressureLeft: '압력(좌)', pressureRight: '압력(우)', pressureTotal: '압력 합계', pressTime: '프레스 시간', current: '전류', voltage: '전압', weldTime: '통전시간' }
/** 예지보전 대상: 관리값이 있는 설비 (비전 제외) */
const PDM_TYPES = new Set(['slitter', 'press', 'welder', 'painter'])

export function createHistory(ctx: Ctx) {
  const today = () => localDate(ctx.now())
  /** 지난 날 이력에 저장한 메모 (데모 안에서만 유지) */
  const memoEdits = new Map<string, Pick<StateEvent, 'memo' | 'memoBy' | 'memoAt'>>()

  const days = (from: string, to: string) => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    return daysOf(a, b).filter((d) => d <= today()).slice(-MAX_DAYS)
  }
  const page = <T>(list: T[], n: number): Paged<T> => {
    const p = Math.max(1, n)
    return { items: list.slice((p - 1) * ctx.pageSize, p * ctx.pageSize), total: list.length, page: p, size: ctx.pageSize }
  }

  const notifyOf = (id: string, state: StateCode, failMail: boolean): NotifyResult | null =>
    state === 'D' ? { email: !failMail && noise('mail', id) > 0.03 } : null

  /** 장비고장(알람) 상세: 그 설비 종류의 상한 있는 관리값 하나 */
  function alarmDetail(e: Equipment, r: () => number) {
    const items = MASTER.controlLimits.filter((l) => l.equipmentId === e.id && l.upper != null)
    if (!items.length) return PAST_DETAIL['UP_ALARM'][0]
    return `${ITEM_KO[items[Math.floor(r() * items.length)].item] ?? '관리값'} 상한 초과`
  }

  /** 지난 하루의 이력 (설비마다 analysis와 같은 구간) */
  function pastDay(date: string): HistoryEvent[] {
    const start = dayStart(date)
    return MASTER.equipment.flatMap((e) => ctx.stopsOf(e, date).map((s, i): HistoryEvent => {
      const id = `EV-${date.replaceAll('-', '')}-${e.id}-${i + 1}`
      const r = rng(hash('hist', id))
      const words = PAST_DETAIL[s.code]
      const detail = s.code === 'UP_ALARM' ? alarmDetail(e, r) : words[Math.floor(r() * words.length)]
      const memos = PAST_MEMOS[s.code] ?? []
      const memo = memos.length && r() < 0.55 ? memos[Math.floor(r() * memos.length)] : null
      const end = start + s.to * 1000
      const base: HistoryEvent = {
        id, equipmentId: e.id, state: s.state, code: s.code, detail,
        start: iso(start + s.from * 1000), end: iso(end),
        memo: memo?.[0] ?? null, memoBy: memo?.[1] ?? null, memoAt: memo ? iso(end + between(r, 3, 20) * 60_000) : null,
        reportId: ctx.reportOf(id, s.state),
        alarmLevel: s.code === 'UP_ALARM' ? (r() < 0.6 ? 'CRITICAL' : 'WARNING') : null,
        notify: notifyOf(id, s.state, r() < 0.08),
      }
      return { ...base, ...memoEdits.get(id) }
    }))
  }

  const todayEvents = (): HistoryEvent[] =>
    ctx.events().map((ev) => ({ ...ev, alarmLevel: ev.code === 'UP_ALARM' ? 'CRITICAL' as const : null, notify: notifyOf(ev.id, ev.state, MAIL_FAIL_TODAY.includes(ev.equipmentId)) }))

  const eqOf = (id: string) => MASTER.equipment.find((e) => e.id === id)

  function all(q: Omit<HistoryQuery, 'page'>): HistoryEvent[] {
    return days(q.from, q.to)
      .flatMap((d) => (d === today() ? todayEvents() : pastDay(d)))
      .filter((ev) => {
        const e = eqOf(ev.equipmentId)
        return !!e
          && (!q.lineId || e.area === q.lineId)
          && (!q.process || e.process === q.process)
          && q.states.includes(ev.state)
          && (!q.code || ev.code === q.code)
          && (!q.ongoing || ev.end == null)
          && (!q.todo || isTodo[q.todo](ev))
          // 1분 미만은 비가동 1건으로 세지 않는다 (백엔드 minMinutes=1). 진행 중이면 지금까지 길이로
          && ((ev.end ? Date.parse(ev.end) : ctx.now()) - Date.parse(ev.start)) >= (q.minMinutes ?? 1) * 60_000
      })
      .sort((a, b) => b.start.localeCompare(a.start))
  }
  const list = (q: HistoryQuery): Paged<HistoryEvent> => page(all(q), q.page)
  /** 왼쪽 요약 열 (D-109): 상태 셋을 모두 넣어 센다 */
  const summary = (q: HistorySummaryQuery): HistorySummary => summarize(all({ ...q, states: ['D', 'I', 'S'] }), ctx.now())

  /** 이력 한 건 (오늘 건 EV-n, 지난 날 건 EV-YYYYMMDD-설비-n) */
  function find(id: string): HistoryEvent | null {
    const m = /^EV-(\d{4})(\d{2})(\d{2})-/.exec(id)
    if (!m) return todayEvents().find((ev) => ev.id === id) ?? null
    return pastDay(`${m[1]}-${m[2]}-${m[3]}`).find((ev) => ev.id === id) ?? null
  }

  /** 지난 하루의 예지보전 위험 (90% 진입~해제). 공장 전체에서 하루 0~2건 */
  function pastRisks(date: string): RiskEvent[] {
    const r = rng(hash('risk-day', date))
    const pool = MASTER.equipment.filter((e) => PDM_TYPES.has(e.type))
    return Array.from({ length: between(r, 0, 2) }, (_, i) => {
      const e = pool[Math.floor(r() * pool.length)]
      const items = MASTER.controlLimits.filter((l) => l.type === e.type)
      const from = dayStart(date) + Math.floor(r() * 80_000) * 1000
      return {
        id: `RK-${date.replaceAll('-', '')}-${i + 1}`, equipmentId: e.id, item: items[Math.floor(r() * items.length)].item,
        start: iso(from), end: iso(from + between(r, 5, 40) * 60_000), maxPercent: between(r, 90, 97),
      }
    })
  }

  function risks(q: RiskQuery): Paged<RiskEvent> {
    const rows = days(q.from, q.to)
      .flatMap((d) => (d === today() ? ctx.risks().map((x) => ({ ...x })) : pastRisks(d)))
      .filter((x) => !q.lineId || eqOf(x.equipmentId)?.area === q.lineId)
      .sort((a, b) => b.start.localeCompare(a.start))
    return page(rows, q.page)
  }

  /** 지난 날 이력의 메모 저장. 찾으면 저장한 건을 돌려준다 */
  function saveMemo(id: string, memo: Pick<StateEvent, 'memo' | 'memoBy' | 'memoAt'>): StateEvent | null {
    if (!/^EV-\d{8}-/.test(id)) return null
    const found = find(id)
    if (!found) return null
    memoEdits.set(id, memo)
    return { ...found, ...memo }
  }

  return { list, all, summary, find, risks, saveMemo }
}
