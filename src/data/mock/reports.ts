// 데모 리포트 (API-080 일일 생산 리포트, API-081~083 계획수정 보고서).
// 일일 리포트는 생산 조회·가동률과 같은 수(제품 목록·비가동 구간)에서 셈한다. 보고서 계산은 FN-009 규칙 그대로. 값은 데모용 (CLAUDE.md)
import type { DailyReport, ReplanAllocation, ReplanReport, ReplanSummary } from '@/types/report'
import type { EquipmentLive } from '@/types/live'
import type { HistoryEvent } from '@/types/events'
import type { OeeQuery, OeeReport } from '@/types/analysis'
import type { LineId } from '@/types/plant'
import type { StateCode } from '@/types/state'
import type { DayCounts } from '@/data/mock/products'
import { MASTER } from '@/data/mock/master'
import { PRODUCTION_LINES } from '@/data/mock/products'
import { addDays, dayStart, hash, localDate, noise, rng } from '@/data/mock/rand'
import { demoCauseTrace } from '@/data/mock/causeTrace'

interface Ctx {
  now: () => number
  lineDone: Record<string, number>
  live: Map<string, EquipmentLive>
  inboundStock: () => number
  counts: (date: string, lineId: LineId) => DayCounts | null
  oee: (q: OeeQuery) => OeeReport
  oeeOf: (key: string, date: string) => number | null
  targetOf: (date: string) => number | null
  linePlanOf: (date: string) => number | null
  findEvent: (id: string) => HistoryEvent | null
  pastDEvents: (from: string, to: string) => HistoryEvent[]
  setTodayReport: (eventId: string, reportId: string) => void
  user: string
}

const iso = (ms: number) => new Date(ms).toISOString()
const round1 = (n: number) => Math.round(n * 10) / 10
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const pct = (a: number, b: number | null) => (b ? round1((a / b) * 100) : null)
/** 라인 CT [가정] (FN-009 2번, 표준CT 120초) */
const LINE_CT = MASTER.equipmentTypes.find((t) => t.code === 'press')?.standardCtSec ?? 120
const PAINT_CT = MASTER.equipmentTypes.find((t) => t.code === 'painter')?.standardCtSec ?? 40
/** 지난 날 고장 건 중 보고서를 만들어 둔 비율 (데모). 사람이 눌러야 생기므로 일부만 (D-68) */
const PAST_REPORT_RATE = 0.12
const PAST_REPORT_USERS = ['김현수', '박서연', '이민재']

export function createReports(ctx: Ctx) {
  const today = () => localDate(ctx.now())

  // ── 일일 생산 리포트 ──
  function daily(date: string): DailyReport {
    const isToday = date === today()
    const counts = PRODUCTION_LINES.map((l) => ({ l, c: ctx.counts(date, l) }))
    const target = ctx.targetOf(date)
    const linePlan = ctx.linePlanOf(date)
    const ngOf = (c: DayCounts) => sum(Object.values(c.ng))

    const lines: DailyReport['lines'] = counts.map(({ l, c }) => ({
      lineId: l, plan: linePlan, done: c?.done ?? 0, rate: c ? pct(c.done, linePlan) : null, oee: ctx.oeeOf(l, date), ng: c ? ngOf(c) : null,
    }))
    const done = sum(lines.map((x) => x.done))

    // 공정별 검사 수: 슬리팅을 지난 수에서 공정마다 불량·재공을 빼 간다 (제품 목록과 같은 셈)
    const all = { ng: { SLITTING: 0, PRESS: 0, WELDING: 0, PAINTING: 0, INSPECTION: 0 }, wip: { PRESS: 0, WELDING: 0, PAINTING: 0 } }
    for (const { c } of counts) {
      if (!c) continue
      for (const k of Object.keys(all.ng) as (keyof typeof all.ng)[]) all.ng[k] += c.ng[k]
      for (const k of Object.keys(all.wip) as (keyof typeof all.wip)[]) all.wip[k] += c.wip[k]
    }
    const outB = done + sum(Object.values(all.ng)) + sum(Object.values(all.wip))
    const outC = outB - all.ng.SLITTING - all.wip.PRESS
    const outD = outC - all.ng.PRESS - all.wip.WELDING
    const outE = outD - all.ng.WELDING - all.wip.PAINTING
    const outF = outE - all.ng.PAINTING
    const processes: DailyReport['processes'] = [
      { process: 'SLITTING', output: outB, ng: all.ng.SLITTING }, { process: 'PRESS', output: outC, ng: all.ng.PRESS }, { process: 'WELDING', output: outD, ng: all.ng.WELDING },
      { process: 'PAINTING', output: outE, ng: all.ng.PAINTING }, { process: 'INSPECTION', output: outF, ng: all.ng.INSPECTION },
    ]
    // 도장 줄: 도장을 지난 수 = 출고 검사 받은 수
    lines.push({ lineId: 'PT', plan: target, done: outF, rate: pct(outF, target), oee: ctx.oeeOf('PT', date), ng: null })

    const report = ctx.oee({ period: 'day', date })
    const stock = isToday ? ctx.inboundStock() : 25 + Math.floor(noise('stock-close', date) * 15)
    return {
      date, closed: !isToday,
      at: iso(isToday ? ctx.now() : dayStart(date) + 86_400_000),
      target, done, rate: pct(done, target), oee: report.oee,
      ngTotal: sum(processes.map((p) => p.ng)),
      lines, processes,
      downtime: report.downtime.filter((d) => d.count > 0),
      wip: [
        { from: 'COIL', to: 'SLITTING', qty: stock, unit: 'roll' },
        { from: 'SLITTING', to: 'PRESS', qty: all.wip.PRESS, unit: 'ea' },
        { from: 'PRESS', to: 'WELDING', qty: all.wip.WELDING, unit: 'ea' },
        { from: 'WELDING', to: 'PAINTING', qty: all.wip.PAINTING, unit: 'ea' },
        { from: 'PAINTING', to: 'INSPECTION', qty: 0, unit: 'ea' },
      ],
    }
  }

  // ── 계획수정 보고서 (FN-009) ──
  const made = new Map<string, ReplanReport>()
  const byEvent = new Map<string, string>()
  let seq = 0

  /** 부족 수량을 남은 능력 비율대로 나눈다. 반올림 나머지는 큰 쪽부터 (FN-009 3·4번) */
  function allocate(shortage: number, rows: Omit<ReplanAllocation, 'share' | 'add'>[]) {
    const cap = sum(rows.map((r) => r.capacity))
    const give = Math.min(shortage, cap)
    const raw = rows.map((r) => (cap ? (give * r.capacity) / cap : 0))
    const add = raw.map(Math.floor)
    let left = give - sum(add)
    raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => { if (left > 0) { add[i]++; left-- } })
    return {
      allocations: rows.map((r, i) => ({ ...r, share: cap ? round1((r.capacity / cap) * 100) : 0, add: add[i] })),
      unmet: shortage - give,
    }
  }

  /** 고장 건과 기준 시각으로 보고서를 계산한다 */
  function compute(ev: HistoryEvent, base: number, id: string, createdAt: number, createdBy: string): ReplanReport {
    const e = MASTER.equipment.find((x) => x.id === ev.equipmentId)!
    const date = localDate(base)
    const isToday = date === today()
    const remainingSec = Math.max(0, Math.round((dayStart(date) + 86_400_000 - base) / 1000))
    const frac = (base - dayStart(date)) / 86_400_000
    /** 기준 시각까지 라인 실적: 오늘은 지금 값, 지난 날은 그날 실적 × 지난 비율 */
    const doneAt = (l: LineId) => (isToday ? ctx.lineDone[l] : Math.round((ctx.counts(date, l)?.done ?? 0) * frac))
    const target = ctx.targetOf(date)
    const head = { id, createdAt: iso(createdAt), createdBy, equipmentId: e.id, code: ev.code, stateEventId: ev.id, start: ev.start, detail: ev.detail, baseAt: iso(base), remainingSec, target, causeTrace: demoCauseTrace(ev, e) }

    if (e.area === 'VI') {
      // 비전은 1대라 대체 없음 → 남은 출고 전량 미달 예상 [가정 A-13]
      const plantDone = sum(PRODUCTION_LINES.map(doneAt))
      const shortage = Math.max(0, (target ?? 0) - plantDone)
      return { ...head, kind: 'vision', ctSec: MASTER.equipmentTypes.find((t) => t.code === 'vision')?.standardCtSec ?? 20, stoppedPlan: target ?? 0, stoppedDone: plantDone, shortage, allocations: [], unmet: shortage }
    }

    if (e.area === 'PT') {
      // 도장 1대 고장 → 같은 공정의 다른 1대로 같은 계산 (FN-009 5번). 두 대가 목표를 반씩 맡는다고 본다 [가정]
      const plan = Math.round((target ?? 0) / 2)
      const paintDone = Math.round((isToday ? ctx.lineDone.PT : sum(PRODUCTION_LINES.map(doneAt))) / 2)
      const shortage = Math.max(0, plan - paintDone)
      const other = MASTER.equipment.filter((x) => x.area === 'PT' && x.id !== e.id && (!isToday || ctx.live.get(x.id)?.state !== 'D'))
      const rows = other.map((x) => {
        const remainingPlan = Math.max(0, plan - paintDone)
        return { target: x.id, remainingPlan, capacity: Math.max(0, Math.floor(remainingSec / PAINT_CT) - remainingPlan) }
      })
      return { ...head, kind: 'paint', ctSec: PAINT_CT, stoppedPlan: plan, stoppedDone: paintDone, shortage, ...allocate(shortage, rows) }
    }

    // 라인 안 설비 → 직렬이라 라인 전체가 멈춘 것으로 본다 (FN-009 1번)
    const line = e.area as LineId
    const plan = ctx.linePlanOf(date) ?? 0
    const stoppedDone = doneAt(line)
    const shortage = Math.max(0, plan - stoppedDone)
    /** 다른 정상 라인: 오늘이면 지금 고장 설비가 없는 라인 */
    const downNow = (l: LineId) => isToday && MASTER.equipment.some((x) => x.area === l && ctx.live.get(x.id)?.state === 'D')
    const rows = PRODUCTION_LINES.filter((l) => l !== line && !downNow(l)).map((l) => {
      const remainingPlan = Math.max(0, plan - doneAt(l))
      return { target: l, remainingPlan, capacity: Math.max(0, Math.floor(remainingSec / LINE_CT) - remainingPlan) }
    })
    return { ...head, kind: 'line', ctSec: LINE_CT, stoppedPlan: plan, stoppedDone, shortage, ...allocate(shortage, rows) }
  }

  /** 지난 날 고장 건의 보고서 (데모로 일부만 만들어 둠). ID는 RP-이력ID */
  function reportOf(eventId: string, state: StateCode): string | null {
    const id = byEvent.get(eventId)
    if (id) return id
    if (state !== 'D' || !/^EV-\d{8}-/.test(eventId)) return null
    return noise('report', eventId) < PAST_REPORT_RATE ? `RP-${eventId}` : null
  }

  function get(id: string): ReplanReport | null {
    const hit = made.get(id)
    if (hit) return hit
    const evId = id.startsWith('RP-EV-') ? id.slice(3) : null
    const ev = evId ? ctx.findEvent(evId) : null
    if (!ev || ev.reportId !== id) return null
    // 고장 몇 분 뒤에 만든 것으로 본다
    const r = rng(hash('report-at', id))
    const at = Date.parse(ev.start) + (2 + Math.floor(r() * 8)) * 60_000
    const rep = compute(ev, at, id, at, PAST_REPORT_USERS[Math.floor(r() * PAST_REPORT_USERS.length)])
    made.set(id, rep)
    return rep
  }

  /** 보고서 만들기 (D-68): 오늘 건은 지금 기준, 지난 날 건은 그 고장 시각 기준 */
  function create(eventId: string): ReplanReport {
    const ev = ctx.findEvent(eventId)
    if (!ev) throw new Error(`상태 이력 없음: ${eventId}`)
    if (ev.state !== 'D') throw new Error('계획수정 보고서는 고장(D) 건만 만듭니다')
    const existing = ev.reportId ? get(ev.reportId) : null
    if (existing) return existing
    const id = `RP-${++seq + 1}`
    const isToday = localDate(Date.parse(ev.start)) === today()
    const rep = compute(ev, isToday ? ctx.now() : Date.parse(ev.start), id, ctx.now(), ctx.user)
    made.set(id, rep)
    byEvent.set(eventId, id)
    if (isToday) ctx.setTodayReport(eventId, id)
    return rep
  }

  /** 오늘 이미 있는 보고서 (데모 장면): 고장 몇 분 뒤 만든 것 */
  function seedToday(eventId: string, reportId: string, at: number) {
    const ev = ctx.findEvent(eventId)
    if (!ev) return
    made.set(reportId, compute(ev, at, reportId, at, ctx.user))
    byEvent.set(eventId, reportId)
  }


  /**
   * 추가 주문 배정 검토 (R-04 데모). 실서버는 AI가 요청을 해석하지만 데모는 간단한 규칙으로 읽는다:
   * "300개" 수량, "A~D"·"A·B라인" 가동 중 라인, "F라인 더/추가" 새 라인, "한 라인 더" 라인 수. 준비 30분, 납기 오늘 24:00
   */
  function createOrder(text: string): ReplanReport {
    const qtyHit = [...text.matchAll(/(\d[\d,]*)\s*개(?!\s*라인)/g)][0]
    const addQty = qtyHit ? Number(qtyHit[1].replace(/,/g, '')) : 0
    if (!addQty) throw new Error('추가 주문 수량을 알 수 없습니다. 요청에 수량을 적어 주세요 (예: 추가 주문 300개)')
    const norm = text.replace(/([A-F])\s*[~-]\s*([A-F])/gi, (_m, a: string, b: string) => {
      const [x, y] = [a.toUpperCase().charCodeAt(0), b.toUpperCase().charCodeAt(0)].sort((m, n) => m - n)
      return Array.from({ length: y - x + 1 }, (_v, i) => String.fromCharCode(x + i)).join(',') + '라인'
    })
    const running: string[] = []
    const said: string[] = []
    for (const m of norm.matchAll(/([A-F](?:\s*[,·/와과]\s*[A-F])*)\s*라인/gi)) {
      const ids = m[1].toUpperCase().match(/[A-F]/g) ?? []
      const ctx2 = norm.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20)
      if (/(더|추가|새로|켜|돌려|가동)/.test(ctx2) && !/(돌리고|돌아가|돌리는|가동 중|가동중)/.test(ctx2)) said.push(...ids)
      else running.push(...ids)
    }
    const want = /(한|하나|1)\s*(개\s*)?라인\s*(을|를)?\s*(더|추가)/.test(text) ? 1 : /(두|둘|2)\s*(개\s*)?라인\s*(을|를)?\s*(더|추가)/.test(text) ? 2 : 0
    const now = ctx.now()
    const date = localDate(now)
    const remainingSec = Math.max(0, Math.round((dayStart(date) + 86_400_000 - now) / 1000))
    const setup = 30
    const plan = ctx.linePlanOf(date) ?? 0
    const runLines = (running.length ? running : PRODUCTION_LINES.map(String)).filter((l, i, a) => a.indexOf(l) === i) as LineId[]
    const idle = PRODUCTION_LINES.filter((l) => !runLines.includes(l))
    const runRows = runLines.map((l) => {
      const remainingPlan = Math.max(0, plan - (ctx.lineDone[l] ?? 0))
      return { target: l, remainingPlan, capacity: Math.max(0, Math.floor(remainingSec / LINE_CT) - remainingPlan) }
    })
    const currentCap = sum(runRows.map((r) => r.capacity))
    const newCap = Math.max(0, Math.floor(Math.max(0, remainingSec - setup * 60) / LINE_CT))
    let newLines = said.filter((l) => idle.includes(l as LineId))
    const recommended = !newLines.length
    if (recommended) {
      let cap = currentCap
      for (const l of idle) {
        if (want ? newLines.length >= want : cap >= addQty) break
        newLines.push(l)
        cap += newCap
      }
    }
    newLines = [...new Set(newLines)]
    const rows = [...runRows, ...newLines.map((l) => ({ target: l, remainingPlan: 0, capacity: newCap }))].sort((a, b) => a.target.localeCompare(b.target))
    const withCap = sum(rows.map((r) => r.capacity))
    const id = `RP-${++seq + 1}`
    const { allocations, unmet } = allocate(addQty, rows)
    const rep: ReplanReport = {
      id, createdAt: iso(now), createdBy: ctx.user, equipmentId: '', code: 'UP_ETC', stateEventId: '', start: iso(now), detail: null,
      kind: 'order', baseAt: iso(now), remainingSec, ctSec: LINE_CT, stoppedPlan: addQty, stoppedDone: 0, shortage: addQty,
      allocations, unmet, target: ctx.targetOf(date),
      order: {
        request: text, addQty, dueAt: '24:00', setupMinutes: setup, runningLines: runLines, newLines, recommended: recommended && newLines.length > 0,
        idleLines: idle.filter((l) => !newLines.includes(l)), excludedLines: [], parsedBy: '규칙 (데모)', notes: ['데모 모드: 요청은 간단한 규칙으로 읽었습니다'],
        current: { lines: runLines, capacity: currentCap, unmet: Math.max(0, addQty - currentCap) },
        withNew: { lines: rows.map((r) => r.target), capacity: withCap, unmet: Math.max(0, addQty - withCap) },
      },
    }
    made.set(id, rep)
    return rep
  }

  function list(from: string, to: string): ReplanSummary[] {
    const [a, b] = from <= to ? [from, to] : [to, from]
    const inRange = (t: string) => { const d = localDate(Date.parse(t)); return d >= a && d <= b }
    const ids = new Set<string>()
    for (const r of made.values()) if (inRange(r.createdAt)) ids.add(r.id)
    const lastPast = addDays(today(), -1)
    if (a <= lastPast) {
      for (const ev of ctx.pastDEvents(a, b < lastPast ? b : lastPast)) if (ev.reportId) ids.add(ev.reportId)
    }
    return [...ids].map(get).filter((r): r is ReplanReport => !!r && inRange(r.createdAt))
      .map(({ id, createdAt, equipmentId, code, kind }) => ({ id, createdAt, equipmentId, code, kind }))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
  }

  /** 추가 주문 배정 승인·적용 (R-05 데모): 적용 표시만. 데모 대시보드의 라인 상태는 바뀌지 않는다 */
  function applyOrder(id: string) {
    const r = made.get(id)
    if (!r || r.kind !== 'order') throw new Error('추가 주문 배정 보고서만 적용할 수 있습니다')
    if (r.appliedAt) throw new Error('이미 적용한 보고서입니다')
    const at = iso(ctx.now())
    made.set(id, { ...r, appliedAt: at, appliedBy: ctx.user })
    return {
      appliedAt: at, startedLines: r.order?.newLines ?? [], lineCommandSent: false,
      targets: r.allocations.filter((a) => a.add > 0).map((a) => ({ lineId: a.target, before: 0, after: a.add })),
      notes: ['데모 모드: 적용 표시만 하고 대시보드 라인 상태는 바뀌지 않습니다'],
    }
  }

  return { daily, list, get, create, createOrder, applyOrder, reportOf, seedToday }
}
