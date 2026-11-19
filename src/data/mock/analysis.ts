// 데모 가동률·상태 타임라인 (API-050, 051). 오늘은 지금 상태 이력에서, 지난 날은 난수로 만든다. 값은 데모용 (CLAUDE.md)
import type { DowntimeCode, StateCode, StopState } from '@/types/state'
import type { StateEvent } from '@/types/events'
import type { Oee } from '@/types/live'
import type { Equipment } from '@/types/plant'
import type { OeeQuery, OeeReport, StateTimeline } from '@/types/analysis'
import { MASTER } from '@/data/mock/master'
import { LINE_DETAIL, PLANT_OEE } from '@/data/mock/scenario'
import { between, dayStart, daysOf, hash, localDate, noise, periodRange, rng } from '@/data/mock/rand'

const AREAS = ['A', 'B', 'C', 'D', 'E', 'F', 'PT', 'VI'] as const
const AREA_LABEL: Record<string, string> = { PT: '도장', VI: '출고', A: 'A라인', B: 'B라인', C: 'C라인', D: 'D라인', E: 'E라인', F: 'F라인' }
const PROCESS_NAME: Record<string, string> = { SLITTING: '슬리팅', PRESS: '프레스', WELDING: '용접', PAINTING: '도장', INSPECTION: '출고' }
// 대표 상태 순서 D > DC > S > I > R (백엔드 API v3.1)
const RANK: Record<StateCode, number> = { R: 0, I: 1, S: 2, DC: 3, D: 4 }
const round1 = (n: number) => Math.round(n * 10) / 10

interface Ctx {
  now: () => number
  events: () => StateEvent[]
}

/** 조회 범위 안 설비 */
export function scopeEquipment(q: Pick<OeeQuery, 'lineId' | 'process' | 'equipmentId'>): Equipment[] {
  return MASTER.equipment.filter((e) =>
    e.process !== 'COIL'
    && (!q.equipmentId || e.id === q.equipmentId)
    && (!q.lineId || e.area === q.lineId)
    && (!q.process || e.process === q.process))
}

/** 지난 날 비가동 코드 비율 (데모): 계획정지·셋업이 많고 안전문제는 드물게 */
const CODE_WEIGHT: [DowntimeCode, number][] = [
  ['PL_SHIFT', 0.06], ['PL_PM', 0.1], ['PL_CHANGE', 0.08], ['PL_SETUP', 0.24], ['UP_SHORTAGE', 0.2], ['UP_DELAY', 0.1],
  ['UP_BREAKDOWN', 0.08], ['UP_ALARM', 0.09], ['UP_SAFETY', 0.03], ['UP_ETC', 0.02],
]
function pickCode(x: number) {
  let acc = 0
  const code = CODE_WEIGHT.find(([, w]) => (acc += w) > x)?.[0] ?? 'PL_PM'
  return MASTER.downtimeCodes.find((d) => d.code === code)!
}

export function createAnalysis(ctx: Ctx) {
  const today = () => localDate(ctx.now())

  /** 범위 키 하나의 하루 OEE. 오늘 공장·라인은 scenario 값, 나머지는 그 둘레 난수 */
  function oeeOf(key: string, date: string): number | null {
    if (date > today()) return null
    // 설비 키(B-PR3)면 그 설비의 구역(B)을 기준으로 삼는다
    const eq = MASTER.equipment.find((e) => e.id === key)
    const line = eq ? eq.area : key.split(':')[0]
    const anchor = date === today()
      ? (key === 'plant' ? PLANT_OEE.oee : LINE_DETAIL[line]?.oee ?? 90)
      : 72 + noise('oee', key === 'plant' ? 'plant' : line, date) * 14
    if (key === 'plant' || key === line) return round1(anchor)
    // 설비: 그날 손실(대기·고장)이 길수록 낮게 [데모]
    const lossMin = eq ? stopsOf(eq, date).filter((x) => x.state !== 'S').reduce((a, x) => a + (x.to - x.from), 0) / 60 : 0
    return round1(Math.max(40, Math.min(99, anchor + 3 + (noise('oee-part', key, date) - 0.5) * 6 - lossMin * 0.3)))
  }

  /** OEE를 3요소로 나눈다: 성능·양품을 정하고 시간가동률 = OEE ÷ (성능 × 양품) */
  function split(oee: number | null, key: string, date: string): Oee {
    if (oee == null) return { oee: null, availability: null, performance: null, quality: null }
    if (key === 'plant' && date === today()) return { ...PLANT_OEE }
    const performance = round1(90 + noise('perf', key, date) * 5)
    const quality = round1(94 + noise('qual', key, date) * 4)
    return { oee, availability: round1(Math.min(100, (oee * 10000) / (performance * quality))), performance, quality }
  }

  const avg = (ns: (number | null)[]) => {
    const v = ns.filter((n): n is number => n != null)
    return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null
  }

  /** 그날 설비의 비가동 구간 (00:00부터 초). 오늘은 실제 이력, 지난 날은 난수 */
  function stopsOf(e: Equipment, date: string): { state: StopState; code: DowntimeCode; from: number; to: number }[] {
    if (date > today()) return []
    const start = dayStart(date)
    if (date === today()) {
      const nowSec = (ctx.now() - start) / 1000
      return ctx.events().filter((ev) => ev.equipmentId === e.id).map((ev) => ({
        state: ev.state, code: ev.code,
        from: Math.max(0, (Date.parse(ev.start) - start) / 1000),
        to: Math.min(nowSec, ((ev.end ? Date.parse(ev.end) : ctx.now()) - start) / 1000),
      })).filter((s) => s.to > s.from)
    }
    const r = rng(hash('stops', e.id, date))
    return Array.from({ length: between(r, 0, 2) }, () => {
      const def = pickCode(r())
      const from = Math.floor(r() * 80_000)
      return { state: def.state, code: def.code, from, to: Math.min(86_400, from + 120 + Math.floor(r() * 1500)) }
    })
  }

  function scopeKey(q: OeeQuery) {
    if (q.equipmentId) return q.equipmentId
    if (q.lineId && q.process) return `${q.lineId}:${q.process}`
    return q.lineId ?? 'plant'
  }

  function oee(q: OeeQuery): OeeReport {
    const { first, last } = periodRange(q.period, q.date)
    const days = daysOf(first, last).filter((d) => d <= today())
    const key = scopeKey(q)
    const over = (k: string) => avg(days.map((d) => oeeOf(k, d)))

    let bars: OeeReport['bars']
    if (!q.lineId) bars = AREAS.map((a) => ({ key: a, label: AREA_LABEL[a] ?? a, oee: over(a) }))
    else if (!q.process) {
      const ps = [...new Set(scopeEquipment({ lineId: q.lineId }).map((e) => e.process))]
      bars = ps.map((p) => ({ key: p, label: PROCESS_NAME[p], oee: over(`${q.lineId}:${p}`) }))
    } else bars = scopeEquipment({ lineId: q.lineId, process: q.process }).map((e) => ({ key: e.id, label: e.shortName, oee: over(e.id) }))

    const eqs = scopeEquipment(q)
    const downtime = MASTER.downtimeCodes.map((def) => {
      let sec = 0, count = 0
      for (const d of days) for (const e of eqs) for (const s of stopsOf(e, d)) if (s.code === def.code) { sec += s.to - s.from; count++ }
      return { code: def.code, state: def.state, sec: Math.round(sec), count }
    }).sort((a, b) => b.sec - a.sec)

    const value = over(key)
    const lastDay = days.at(-1)
    return {
      lineYield: null,
      query: q,
      from: new Date(dayStart(first)).toISOString(),
      to: new Date(lastDay === today() ? ctx.now() : dayStart(last) + 86_400_000).toISOString(),
      oee: days.length === 1 ? split(value, key, days[0]) : { oee: value, availability: avg(days.map((d) => split(oeeOf(key, d), key, d).availability)), performance: avg(days.map((d) => split(oeeOf(key, d), key, d).performance)), quality: avg(days.map((d) => split(oeeOf(key, d), key, d).quality)) },
      bars,
      downtime,
      daily: q.period === 'day' ? [] : daysOf(first, last).map((d) => ({ date: d, oee: oeeOf(key, d) })),
    }
  }

  /** 여러 설비 구간을 합쳐 각 순간 가장 나쁜 상태로 (D > DC > S > I > R) */
  function merge(lists: { state: StateCode; from: number; to: number }[][], until: number) {
    const all = lists.flat()
    const cuts = [...new Set([0, until, ...all.flatMap((s) => [s.from, s.to])])].filter((t) => t <= until).sort((a, b) => a - b)
    const out: { state: StateCode; from: number; to: number }[] = []
    for (let i = 0; i < cuts.length - 1; i++) {
      const mid = (cuts[i] + cuts[i + 1]) / 2
      const state = all.filter((s) => s.from <= mid && mid < s.to).reduce<StateCode>((w, s) => (RANK[s.state] > RANK[w] ? s.state : w), 'R')
      const prev = out.at(-1)
      if (prev && prev.state === state) prev.to = cuts[i + 1]
      else out.push({ state, from: cuts[i], to: cuts[i + 1] })
    }
    return out
  }

  function timeline(q: OeeQuery): StateTimeline {
    const date = q.date
    const until = date > today() ? 0 : date === today() ? Math.floor((ctx.now() - dayStart(date)) / 1000) : 86_400
    const rowOf = (key: string, label: string, eqs: Equipment[]) => ({ key, label, segments: until ? merge(eqs.map((e) => stopsOf(e, date)), until) : [] })
    const rows = q.lineId
      ? scopeEquipment(q).map((e) => rowOf(e.id, e.shortName, [e]))
      : AREAS.map((a) => rowOf(a, AREA_LABEL[a] ?? a, scopeEquipment({ lineId: a })))
    return { date, until, rows }
  }

  return { oee, timeline, oeeOf, stopsOf }
}
