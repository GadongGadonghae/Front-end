// 데모 데이터 공급기: contracts.ts의 DataSource를 프론트 안에서 흉내 낸다 (주기는 API 명세 3.1).
// Vue를 모르는 순수 TypeScript (FRONTEND.md 2장). 타이머는 구독자가 있을 때만 돈다.
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { EquipmentLive, LineSummary, PlantSnapshot, PlantSummary, ProductMove, FlowPositions } from '@/types/live'
import type { AlarmEvent, RiskEvent, StateEvent } from '@/types/events'
import type { HourlyOutput, ProductDetail, ProductionQuery, ProductionSummary, StepResult } from '@/types/production'
import type { InboundToday, InspectionToday, ProcessToday, TelemetryTick } from '@/types/process'
import type { TargetRow } from '@/types/report'
import type { LineId, ProcessId } from '@/types/plant'
import { MASTER } from '@/data/mock/master'
import {
  CURRENT_DC, CURRENT_STATES, HOURLY_WEIGHT, INBOUND, LINE_DETAIL, LINE_DONE, OUTBOUND_NG, PAST_STATES, PAST_TARGET, PDM, PLANT_OEE, RISK_EVENTS, RUN_AGO_SEC, TARGET, TARGET_SEED_DAYS,
} from '@/data/mock/scenario'
import { createTelemetry } from '@/data/mock/telemetry'
import { createProducts, PRODUCTION_LINES } from '@/data/mock/products'
import { createAnalysis } from '@/data/mock/analysis'
import { createHistory } from '@/data/mock/history'
import { asStateEvent } from '@/data/historyTodo'
import { createReports } from '@/data/mock/reports'
import { createPdm } from '@/data/mock/pdm'
import { createFlow } from '@/data/mock/flow'
import { addDays, dayStart, daysOf, hash, localDate, noise, periodRange, rng } from '@/data/mock/rand'

const SNAPSHOT_MS = 1000 // snapshot 1초
const SUMMARY_MS = 10_000 // summary 10초 [제안]
const RISK_MS = 5000 // risk 5초 [제안]
/** 라인 능력 17초에 1개 (백엔드 v3.1) → 1초에 1/17 확률로 라인 실적 +1 (데모) */
const LINE_DONE_PER_SEC = 1 / 17
/** 데모 계정 이름. 조치 메모 담당자도 이 이름 (실제는 서버가 로그인 사용자로 기록, D-84) */
const DEMO_USER = '김현수'
/** 데모 사용자 목록 (사용자 관리 화면) */
const demoUsers: import('@/types/user').UserRow[] = [
  { loginId: 'abc', name: DEMO_USER, role: 'PLANT_HEAD', email: null, memo: '데모 공장장', lastLoginAt: null },
  { loginId: 'prodlead', name: '이도윤', role: 'PROD_LEAD', email: null, memo: '데모 생산관리팀장', lastLoginAt: null },
  { loginId: 'linelead', name: '박서연', role: 'LINE_WORKER', email: null, memo: 'A·B라인', lastLoginAt: null },
]
const PAGE_SIZE = 50

const iso = (ms: number) => new Date(ms).toISOString()
const round1 = (n: number) => Math.round(n * 10) / 10
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

export function createMockSource(now: () => number = Date.now): DataSource {
  const startedAt = now()
  const ago = (sec: number) => iso(startedAt - sec * 1000)

  // ── 현재 상태 ──
  const live = new Map<string, EquipmentLive>()
  for (const e of MASTER.equipment) {
    live.set(e.id, { id: e.id, state: 'R', code: null, detail: null, since: ago(RUN_AGO_SEC), pdm: null })
  }
  for (const s of CURRENT_STATES) {
    live.set(s.equipmentId, { ...live.get(s.equipmentId)!, state: s.state, code: s.code, detail: s.detail, since: ago(s.agoSec) })
  }
  for (const d of CURRENT_DC) {
    live.set(d.equipmentId, { ...live.get(d.equipmentId)!, state: 'DC', code: null, detail: null, since: ago(d.agoSec) })
  }
  for (const p of PDM) {
    live.get(p.equipmentId)!.pdm = { level: p.level, item: p.item, percent: p.percent }
  }
  const lineDone: Record<string, number> = { ...LINE_DONE }
  const inbound = { ...INBOUND }
  const plantDone = () => sum(PRODUCTION_LINES.map((l) => lineDone[l]))

  // ── 생산 목표 (DT-016): 날짜별 하루 목표. 오늘은 TARGET, 지난 날은 데모 값, 내일까지 미리 넣어 둔다 ──
  const targets = new Map<string, { quantity: number; by: string }>()
  for (let i = -TARGET_SEED_DAYS; i <= 1; i++) {
    const d = addDays(localDate(startedAt), i)
    const q = i >= -2 ? TARGET : PAST_TARGET(d, -i)
    if (q != null) targets.set(d, { quantity: q, by: DEMO_USER })
  }
  /** 그날 목표. 없으면 null (D-72). 오래된 날은 TARGET으로 본다 */
  const targetOf = (date: string) => (date < addDays(localDate(startedAt), -TARGET_SEED_DAYS) ? TARGET : targets.get(date)?.quantity ?? null)
  /** 라인 계획 = 목표 ÷ 가동 라인 수 (D-87) */
  const linePlanOf = (date: string) => { const t = targetOf(date); return t == null ? null : Math.round(t / PRODUCTION_LINES.length) }
  const pct = (a: number, b: number | null) => (b ? round1((a / b) * 100) : null)

  // ── 오늘 상태 이력 ──
  let seq = 0
  const events: StateEvent[] = [
    ...CURRENT_STATES.map((s): StateEvent => ({
      id: `EV-${++seq}`, equipmentId: s.equipmentId, state: s.state, code: s.code, detail: s.detail,
      start: ago(s.agoSec), end: null, memo: null, memoBy: null, memoAt: null,
      reportId: s.state === 'D' ? 'RP-1' : null,
    })),
    ...PAST_STATES.map((s): StateEvent => ({
      id: `EV-${++seq}`, equipmentId: s.equipmentId, state: s.state, code: s.code, detail: s.detail,
      start: ago(s.agoSec), end: ago(s.agoSec - s.durSec),
      memo: s.memo?.[0] ?? null, memoBy: s.memo?.[1] ?? null, memoAt: s.memo ? ago(s.agoSec - s.durSec - 240) : null,
      reportId: null,
    })),
  ].sort((a, b) => b.start.localeCompare(a.start))

  const risks: RiskEvent[] = RISK_EVENTS.map((r, i) => ({
    id: `RK-${i + 1}`, equipmentId: r.equipmentId, item: r.item, start: ago(r.agoSec), end: null, maxPercent: r.maxPercent,
  }))

  const areaOf = (id: string) => MASTER.equipment.find((e) => e.id === id)?.area
  const inArea = (area?: string) => (id: string) => !area || areaOf(id) === area

  // ── 메시지 만들기 ──
  const snapshot = (): PlantSnapshot => ({
    at: iso(now()),
    equipment: [...live.values()].map((e) => ({ ...e, pdm: e.pdm && { ...e.pdm } })),
    plant: { done: plantDone() },
    lines: Object.entries(lineDone).map(([lineId, done]) => ({ lineId: lineId as LineId, done })),
    inbound: { ...inbound },
  })

  const summary = (): PlantSummary => {
    const done = plantDone()
    const target = targetOf(localDate(now()))
    const plan = linePlanOf(localDate(now()))
    const lines: LineSummary[] = (Object.keys(LINE_DETAIL) as LineId[]).map((lineId) => {
      const d = LINE_DETAIL[lineId]
      const linePlan = lineId === 'PT' ? target : plan
      const isPaint = lineId === 'PT'
      return {
        lineId, plan: linePlan, done: lineDone[lineId], rate: pct(lineDone[lineId], linePlan), oee: d.oee, ngByProcess: { ...d.ng },
        wip: isPaint ? [{ from: 'PAINTING', to: 'INSPECTION', qty: d.wip[0] }] : [{ from: 'SLITTING', to: 'PRESS', qty: d.wip[0] }, { from: 'PRESS', to: 'WELDING', qty: d.wip[1] }],
      }
    })
    const ngByProcess = { SLITTING: 0, PRESS: 0, WELDING: 0, PAINTING: 0 }
    for (const l of lines) for (const [p, n] of Object.entries(l.ngByProcess)) ngByProcess[p as keyof typeof ngByProcess] += n
    const inspected = done + OUTBOUND_NG
    return {
      at: iso(now()),
      plant: {
        target, done, rate: pct(done, target), oee: { ...PLANT_OEE },
        quality: { ngByProcess, outbound: { inspected, ok: done, ng: OUTBOUND_NG, rate: round1((OUTBOUND_NG / inspected) * 100) } },
      },
      lines,
    }
  }

  /** 시간대별 생산: 지금까지 실적을 데모 비율로 시간마다 나눈다. 계획선 = 목표 × 지난 시간 비율 [가정] */
  const hourly = (lineId?: LineId): HourlyOutput => {
    const t = new Date(now())
    const hourNow = t.getHours()
    const fracNow = (t.getMinutes() * 60 + t.getSeconds()) / 3600
    const total = lineId ? lineDone[lineId] : plantDone()
    const day = localDate(now())
    const target = lineId && lineId !== 'PT' ? linePlanOf(day) : targetOf(day)
    const weights = HOURLY_WEIGHT.slice(0, hourNow + 1).map((w, h) => (h === hourNow ? w * fracNow : w))
    const wsum = sum(weights) || 1
    let cum = 0
    const hours = weights.map((w, hour) => {
      const done = hour === hourNow ? total - cum : Math.round((w / wsum) * total)
      cum += done
      const elapsed = hour === hourNow ? hour + fracNow : hour + 1
      return { hour, done, cumulative: cum, planCumulative: target == null ? null : Math.round((target * elapsed) / 24) }
    })
    return { date: localDate(now()), lineId: lineId ?? null, target, hours }
  }

  // ── 상세 화면 (공정·가동률·생산) ──
  const telemetry = createTelemetry({ now, live, events: () => events })
  const products = createProducts({ now, lineDone, live })
  const pdm = createPdm({ now, live, valueOf: telemetry.valueOf, itemsOf: telemetry.itemsOf })
  const analysis = createAnalysis({ now, events: () => events })
  // history와 reports는 서로를 부른다 (이력의 보고서 ID ↔ 보고서의 원인 이력). 부르는 때는 둘 다 만든 뒤
  const history = createHistory({
    now, events: () => events, risks: () => risks, stopsOf: analysis.stopsOf, pageSize: PAGE_SIZE,
    reportOf: (id, state) => reports.reportOf(id, state),
  })
  const reports = createReports({
    now, lineDone, live, inboundStock: () => inbound.stock,
    counts: products.counts, oee: analysis.oee, oeeOf: analysis.oeeOf, targetOf, linePlanOf,
    findEvent: (id) => asStateEvent(history.find(id)),
    pastDEvents: (from, to) => history.all({ from, to, states: ['D'] }),
    setTodayReport: (eventId, reportId) => { const ev = events.find((e) => e.id === eventId); if (ev) ev.reportId = reportId },
    user: DEMO_USER,
  })
  for (const ev of events) if (ev.reportId) reports.seedToday(ev.id, ev.reportId, Date.parse(ev.start) + 4 * 60_000)

  /** 날짜별 목표·실적 (API-090) */
  const targetRows = (from: string, to: string): TargetRow[] => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    return daysOf(a, b).reverse().map((d) => ({
      date: d, quantity: targetOf(d), done: d <= today() ? tally(PRODUCTION_LINES, [d]).done : null,
      updatedBy: targets.get(d)?.by ?? null,
    }))
  }
  const today = () => localDate(now())
  const resultAt = (x: ProductDetail, p: ProcessId): StepResult => x.steps.find((s) => s.process === p)?.result ?? 'no'
  const countAt = (list: ProductDetail[], p: ProcessId, ...rs: StepResult[]) => list.filter((x) => rs.includes(resultAt(x, p))).length
  const todayProducts = (lines: LineId[]) => lines.flatMap((l) => products.day(today(), l))

  const processToday = (lineId: LineId, process: ProcessId): ProcessToday => {
    const list = todayProducts(process === 'PAINTING' ? PRODUCTION_LINES : [lineId])
    const at = (p: ProcessId) => countAt(list, p, 'now')
    const output = countAt(list, process, 'ok', 'ng')
    const wipOf: Partial<Record<ProcessId, ProcessToday['wip']>> = {
      SLITTING: { before: null, after: at('PRESS') }, PRESS: { before: at('PRESS'), after: at('WELDING') }, WELDING: { before: at('WELDING'), after: at('PAINTING') }, PAINTING: { before: at('PAINTING'), after: null },
    }
    const eqs = MASTER.equipment.filter((e) => e.area === lineId && e.process === process).sort((a, b) => a.order - b.order)
    // 평균 CT는 처리 시간 17초 둘레 데모 값 (프레스 단별만 표시, SCR-002-3 3번)
    const rows = eqs.map((e) => ({
      id: e.id,
      // 프레스: 앞 단일수록 한 개씩 더 지나감. 도장: 두 대가 나눠 받음
      cycles: process === 'PRESS' ? output + (eqs.length - e.order) : process === 'PAINTING' ? Math.round(output / 2 + (e.order === 1 ? 0.5 : -0.5) * (output % 2)) : output,
      avgCtMs: process === 'PRESS' ? Math.round((16.6 + noise('ct', e.id, today()) * 1.4) * 1000) : null,
    }))
    const slowest = Math.max(...rows.map((r) => r.avgCtMs ?? 0))
    return {
      lineId, process, output, good: countAt(list, process, 'ok'), oee: analysis.oeeOf(`${lineId}:${process}`, today()),
      wip: wipOf[process] ?? { before: null, after: null },
      equipment: rows.map((r) => ({ ...r, slowest: r.avgCtMs != null && r.avgCtMs === slowest })),
      receivedByLine: process === 'PAINTING'
        ? PRODUCTION_LINES.map((l) => ({ lineId: l, qty: countAt(list.filter((x) => x.lineId === l), 'PAINTING', 'ok', 'ng', 'now') }))
        : undefined,
      inverter: process === 'SLITTING' ? (telemetry.inverter(`${lineId}-SL`) ?? undefined) : undefined,
    }
  }

  const inspections = (process: ProcessId, lineId?: LineId): InspectionToday => {
    const list = todayProducts(lineId && process !== 'PAINTING' && process !== 'INSPECTION' ? [lineId] : PRODUCTION_LINES)
    const inspected = countAt(list, process, 'ok', 'ng')
    const ng = countAt(list, process, 'ng')
    const defects = list.filter((x) => x.ngProcess === process).map((x) => {
      const r = x.records.find((rec) => rec.process === process)
      return { t: r?.to ?? x.inputAt, productId: x.id, equipmentId: r?.equipment ?? '', reason: r?.reason ?? '' }
    }).sort((a, b) => b.t.localeCompare(a.t))
    return { lineId: lineId ?? null, process, inspected, ng, rate: inspected ? round1((ng / inspected) * 100) : null, defects }
  }

  /** 코일입고 (데모): 오늘 입고를 1~3코일씩 나눠 시각을 매기고, 재고는 지금 값에서 거꾸로 계산 */
  const inboundToday = (): InboundToday => {
    const start = dayStart(today())
    const elapsed = Math.max(1, now() - start)
    const r = rng(hash('inbound', today()))
    const receipts: { t: string; coils: number }[] = []
    for (let left = inbound.today; left > 0;) {
      const coils = Math.min(left, 8 + Math.floor(r() * 9))
      left -= coils
      receipts.push({ t: '', coils })
    }
    receipts.forEach((x, i) => { x.t = iso(start + ((i + 0.3 + r() * 0.4) / receipts.length) * elapsed) })
    const input = todayProducts(PRODUCTION_LINES).length
    // 코일 1롤 = 제품 20개 (백엔드 M-13)
    const consumed = Math.round(input / 20)
    const first = inbound.stock + consumed - inbound.today
    const weights = PRODUCTION_LINES.map((l) => 0.8 + noise('stock-w', l) * 0.4)
    const wsum = sum(weights)
    const stockTrend: InboundToday['stockTrend'] = []
    const slots = [...Array(Math.floor(elapsed / 1_800_000) + 1).keys()].map((i) => start + i * 1_800_000).concat(now())
    for (const t of slots) {
      const got = sum(receipts.filter((x) => Date.parse(x.t) <= t).map((x) => x.coils))
      const total = Math.max(0, Math.round(first + got - consumed * ((t - start) / elapsed)))
      const byLine: Record<string, number> = {}
      let rest = total
      PRODUCTION_LINES.forEach((l, i) => {
        const n = i === PRODUCTION_LINES.length - 1 ? rest : Math.floor((total * weights[i]) / wsum)
        byLine[l] = n
        rest -= n
      })
      stockTrend.push({ t: iso(t), total, byLine })
    }
    return { today: inbound.today, stock: inbound.stock, input, receipts: receipts.reverse(), stockTrend }
  }

  /** 하루들·라인들 수량 합 */
  const tally = (lines: LineId[], days: string[]) => {
    const t = { done: 0, ng: { SLITTING: 0, PRESS: 0, WELDING: 0, PAINTING: 0, INSPECTION: 0 } as Record<'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING' | 'INSPECTION', number>, wip: 0 }
    for (const d of days) for (const l of lines) {
      const c = products.counts(d, l)
      if (!c) continue
      t.done += c.done
      for (const p of Object.keys(c.ng) as (keyof typeof c.ng)[]) t.ng[p] += c.ng[p]
      t.wip += c.wip.PRESS + c.wip.WELDING + c.wip.PAINTING
    }
    return t
  }
  /** 양품률 = 출고 양품 ÷ 생산 (생산 = 출고 양품 + 공정·비전 불량) */
  const yieldOf = (t: ReturnType<typeof tally>) => {
    const total = t.done + sum(Object.values(t.ng))
    return { total, good: t.done, rate: total ? round1((t.done / total) * 100) : null }
  }
  const linesOf = (lineId?: LineId) => (lineId && lineId !== 'PT' ? [lineId] : PRODUCTION_LINES)

  /** 생산 요약 (API-100). 기간 계획 = 라인 계획 × 라인 수 × 오늘까지 일수 [가정] */
  const productionSummary = (q: ProductionQuery): ProductionSummary => {
    const { first, last } = periodRange(q.period, q.date)
    const upto = daysOf(first, last).filter((d) => d <= today())
    const lines = linesOf(q.lineId)
    const all = tally(lines, upto)
    // 기간 계획 = 날마다 라인 계획 × 라인 수의 합. 목표 없는 날이 섞이면 계획을 낼 수 없다
    const dayPlanOf = (d: string) => { const lp = linePlanOf(d); return lp == null ? null : lp * lines.length }
    const plans = upto.map(dayPlanOf)
    const plan = upto.length && plans.every((x) => x != null) ? sum(plans as number[]) : null
    const dayPlan = dayPlanOf(q.date)

    let trend: ProductionSummary['trend'] = []
    if (q.period === 'day' && q.date <= today()) {
      const d = q.date
      const isToday = d === today()
      const endH = isToday ? (now() - dayStart(d)) / 3_600_000 : 24
      const doneH = lines.flatMap((l) => products.day(d, l)).filter((x) => x.result === 'ok' && x.doneAt).map((x) => (Date.parse(x.doneAt!) - dayStart(d)) / 3_600_000)
      const hours = [...Array(Math.floor(endH) + 1).keys(), ...(isToday ? [endH] : [])]
      // 90일 넘은 날은 제품이 없으므로 하루 실적을 고르게 나눈다
      const at = (h: number) => (doneH.length || !all.done ? doneH.filter((x) => x <= h).length : Math.round((all.done * h) / 24))
      trend = hours.map((h) => ({ x: h, label: `${String(Math.floor(h)).padStart(2, '0')}시`, done: at(h), plan: dayPlan == null ? null : Math.round((dayPlan * h) / 24) }))
    } else if (q.period !== 'day') {
      trend = upto.map((d, i) => ({ x: i, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, done: tally(lines, [d]).done, plan: dayPlanOf(d) }))
    }

    return {
      from: iso(dayStart(first)),
      to: iso(upto.at(-1) === today() ? now() : dayStart(last) + 86_400_000),
      plan, done: all.done, rate: plan ? round1((all.done / plan) * 100) : null,
      input: all.done + sum(Object.values(all.ng)) + all.wip, wip: all.wip, ngByProcess: all.ng,
      byLine: PRODUCTION_LINES.map((l) => ({ lineId: l, plan: plan == null ? null : plan / lines.length, done: tally([l], upto).done })),
      trend, trendKind: q.period === 'day' ? 'hourly' : 'daily',
      yieldRate: yieldOf(all).rate,
      yieldTrend: (q.period === 'day' ? daysOf(addDays(q.date, -6), q.date).filter((d) => d <= today()) : upto).map((d) => {
        const y = yieldOf(tally(lines, [d]))
        return { date: d, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, ...y }
      }),
    }
  }

  const productList = (q: ProductionQuery) => {
    const { first, last } = periodRange(q.period, q.date)
    const needle = q.q?.trim().toUpperCase()
    const list = daysOf(first, last).filter((d) => d <= today())
      .flatMap((d) => linesOf(q.lineId).flatMap((l) => products.day(d, l)))
      .filter((x) => (!q.result || q.result === 'all' || x.result === q.result) && (!needle || x.id.includes(needle)))
      .sort((a, b) => b.inputAt.localeCompare(a.inputAt))
    const page = Math.max(1, q.page ?? 1)
    return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(products.strip), total: list.length, page, size: PAGE_SIZE }
  }

  // ── 구독과 타이머 ──
  const subs = {
    snapshot: new Set<(s: PlantSnapshot) => void>(),
    summary: new Set<(s: PlantSummary) => void>(),
    move: new Set<(m: ProductMove) => void>(),
    flow: new Set<(f: FlowPositions) => void>(),
    alarm: new Set<(a: AlarmEvent) => void>(),
    risk: new Set<(r: RiskEvent) => void>(),
  }
  let snapTimer: ReturnType<typeof setInterval> | null = null
  let sumTimer: ReturnType<typeof setInterval> | null = null

  // 데모 물류: 화면을 열자마자 공장이 비어 보이지 않게 10분을 미리 돌려 둔다 [데모]
  const flow = createFlow(
    () => live.values(),
    (l) => MASTER.lines.find((x) => x.id === l)?.currentPaintId ?? 'PT1',
    today().replaceAll('-', ''),
    () => iso(now()),
  )
  flow.advance(600)

  const tickSnapshot = () => {
    for (const lineId of Object.keys(lineDone)) {
      const rate = lineId === 'PT' ? LINE_DONE_PER_SEC * PRODUCTION_LINES.length : LINE_DONE_PER_SEC
      // 고장 라인(B)은 멈춰 있다
      if (lineId !== 'B' && Math.random() < rate) lineDone[lineId] += 1
    }
    const s = snapshot()
    subs.snapshot.forEach((cb) => cb(s))
    if (subs.flow.size) {
      flow.advance(SNAPSHOT_MS / 1000)
      const f = flow.positions()
      subs.flow.forEach((cb) => cb(f))
    }
  }
  const tickSummary = () => {
    const s = summary()
    subs.summary.forEach((cb) => cb(s))
  }

  const ensureTimers = () => {
    const anyone = Object.values(subs).some((set) => set.size > 0)
    if (anyone && !snapTimer) {
      snapTimer = setInterval(tickSnapshot, SNAPSHOT_MS)
      sumTimer = setInterval(tickSummary, SUMMARY_MS)
    }
    if (!anyone && snapTimer) {
      clearInterval(snapTimer)
      if (sumTimer) clearInterval(sumTimer)
      snapTimer = sumTimer = null
    }
  }
  const subscribe = <T>(set: Set<T>, cb: T): Unsubscribe => {
    set.add(cb)
    ensureTimers()
    return () => { set.delete(cb); ensureTimers() }
  }

  return {
    demo: true,
    live: {
      onSnapshot(cb) { const off = subscribe(subs.snapshot, cb); cb(snapshot()); return off },
      onSummary(cb) { const off = subscribe(subs.summary, cb); cb(summary()); return off },
      onProductMove: (cb) => subscribe(subs.move, cb),
      onFlowPositions(cb) { const off = subscribe(subs.flow, cb); cb(flow.positions()); return off },
      onAlarm: (cb) => subscribe(subs.alarm, cb),
      onRiskChanged: (cb) => subscribe(subs.risk, cb),
      // 예지보전 위험도 5초 (API 명세 3.1). 위험도는 최근 10분 평균이라 자주 바뀌지 않는다
      onRisk(cb) {
        cb(pdm.risks())
        const timer = setInterval(() => cb(pdm.risks()), RISK_MS)
        return () => clearInterval(timer)
      },
      // 설비 하나의 관리값: 수집 주기마다 (슬리터 1초 · 도장 5초 · 프레스·용접 사이클)
      onTelemetry(equipmentId, cb: (t: TelemetryTick) => void) {
        const sec = telemetry.cadenceOf(equipmentId)
        if (!sec) return () => {}
        const timer = setInterval(() => {
          const t = telemetry.tick(equipmentId)
          if (t) cb(t)
        }, sec * 1000)
        return () => clearInterval(timer)
      },
    },
    q: {
      // 관리값 기준이 저장되면 바뀌므로 새 객체로 준다 (화면이 다시 그리게)
      getMaster: async () => ({ ...MASTER, lines: MASTER.lines.map((l) => ({ ...l })), controlLimits: MASTER.controlLimits.map((l) => ({ ...l })) }),
      getTodayHourly: async (lineId) => hourly(lineId),
      getTodayStateEvents: async (filter) => events.filter((e) => inArea(filter?.area)(e.equipmentId)).map((e) => ({ ...e })),
      getTodayRiskEvents: async (filter) => risks.filter((r) => inArea(filter?.area)(r.equipmentId)).map((r) => ({ ...r })),
      getRisks: async () => pdm.risks(),
      getPdmEta: async (id) => pdm.eta(id),
      getProcessToday: async (lineId, process) => processToday(lineId, process),
      getTelemetry: async (equipmentId, range) => telemetry.series(equipmentId, range),
      getStateEvents: async ({ equipmentId }) => events.filter((e) => e.equipmentId === equipmentId).map((e) => ({ ...e })),
      getInspectionsToday: async (process, lineId) => inspections(process, lineId),
      getMicrostopsToday: async (equipmentId) => telemetry.microstops(equipmentId),
      getInboundToday: async () => inboundToday(),
      // 라인 수율 = 출고 양품 ÷ 슬리팅 투입 (D-92). 공장·생산 라인 단위만
      getOee: async (q) => {
        const r = analysis.oee(q)
        if (q.process || q.equipmentId || (q.lineId && !PRODUCTION_LINES.includes(q.lineId as LineId))) return r
        const { first, last } = periodRange(q.period, q.date)
        const t = tally(linesOf(q.lineId as LineId | undefined), daysOf(first, last).filter((d) => d <= today()))
        const input = t.done + sum(Object.values(t.ng)) + t.wip
        return { ...r, lineYield: input ? round1((t.done / input) * 100) : null }
      },
      getStateTimeline: async (q) => analysis.timeline(q),
      getHistory: async (q) => history.list(q),
      getHistorySummary: async (q) => history.summary(q),
      getRiskHistory: async (q) => history.risks(q),
      getDailyReport: async (date) => reports.daily(date),
      getReplanReports: async (from, to) => reports.list(from, to),
      getReplanReport: async (id) => reports.get(id),
      getOrderAdditions: async (date) => reports.orderAdditions(date),
      // 데모에는 PDF 서버가 없다 → 화면이 브라우저 인쇄로 대신한다
      getReplanPdf: async () => null,
      getTargets: async (from, to) => targetRows(from, to),
      getUsers: async () => demoUsers.map((u) => ({ ...u })),
      getControlLimits: async (equipmentId) => MASTER.controlLimits.filter((l) => l.equipmentId === equipmentId).map((l) => ({ ...l })),
      getProductionSummary: async (q) => productionSummary(q),
      getProducts: async (q) => productList(q),
      getProduct: async (id) => products.find(id),
    },
    cmd: {
      // 데모 계정: 아이디·비밀번호가 비어 있지 않으면 통과 (실제 계정은 백엔드, DT-008)
      // 데모: 아이디로 권한을 고름 (prodlead 생산관리팀장 · linelead 라인 담당자 · 그 밖 공장장)
      login: async (userId, password) => {
        if (!userId || !password) return { ok: false }
        const u = demoUsers.find((x) => x.loginId === userId)
        return { ok: true, name: u?.name ?? DEMO_USER, role: u?.role ?? 'PLANT_HEAD' }
      },
      logout: async () => {},
      async saveActionMemo(eventId, memo) {
        const text = memo.trim()
        const patch = text ? { memo: text, memoBy: DEMO_USER, memoAt: iso(now()) } : { memo: null, memoBy: null, memoAt: null }
        const ev = events.find((e) => e.id === eventId)
        if (ev) return { ...Object.assign(ev, patch), notify: null }
        const past = history.saveMemo(eventId, patch)
        if (!past) throw new Error(`상태 이력 없음: ${eventId}`)
        return past
      },
      createReplanReport: async (eventId) => reports.create(eventId),
      approveReplanReport: async (reportId) => reports.approve(reportId, DEMO_USER),
      syncReportFlow: async () => {},
      createTargetReport: async () => { throw new Error('데모 데이터에서는 목표 변동 보고서를 만들 수 없어요 (실서버 전용)') },
      createOrderReport: async (request) => reports.createOrder(request),
      applyOrderReport: async (id) => reports.applyOrder(id),
      // 데모 데이터: 슬랙으로 보내지 않고 보고서 요약만 돌려준다
      async sendReplanToSlack(reportId) {
        const r = reports.get(reportId)
        if (!r) throw new Error('보고서를 찾을 수 없습니다')
        return { sentAt: iso(now()), mock: true, summary: r.ai?.summary ? [r.ai.summary] : [], summaryFallback: null }
      },
      async createUser(u) {
        if (demoUsers.some((x) => x.loginId === u.loginId)) return { ok: false, error: '이미 있는 아이디입니다' }
        demoUsers.push({ loginId: u.loginId, name: u.name, role: u.role, email: u.email || null, memo: u.memo || null, lastLoginAt: null })
        return { ok: true, value: { loginId: u.loginId } }
      },
      async saveTarget(date, quantity) {
        if (date < today()) return { ok: false, error: '지난 날짜의 목표는 바꿀 수 없습니다' }
        if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: '목표 수량은 1 이상의 정수로 입력하세요' }
        targets.set(date, { quantity, by: DEMO_USER })
        tickSummary()
        return { ok: true, value: targetRows(date, date)[0] }
      },
      async setPaintRoute(lineId, paintId, reason) {
        const line = MASTER.lines.find((l) => l.id === lineId && l.kind === 'production')
        if (!line) return { ok: false, error: `생산 라인이 아닙니다: ${lineId}` }
        if (!MASTER.equipment.some((e) => e.id === paintId && e.type === 'painter')) return { ok: false, error: `도장 설비가 아닙니다: ${paintId}` }
        void reason
        line.currentPaintId = paintId
        return { ok: true, value: { lineId, currentPaintId: paintId, changedAt: iso(now()) } }
      },
      async saveControlLimits(equipmentId, rows) {
        const bad = rows.find((x) => x.lower != null && x.upper != null && x.lower > x.upper)
        if (bad) return { ok: false, error: `${bad.item}: 하한이 상한보다 큽니다` }
        const at = iso(now())
        for (const x of rows) {
          const l = MASTER.controlLimits.find((c) => c.equipmentId === equipmentId && c.item === x.item)
          if (!l || (l.lower === x.lower && l.upper === x.upper)) continue
          Object.assign(l, { lower: x.lower, upper: x.upper, updatedAt: at, updatedBy: DEMO_USER })
        }
        return { ok: true, value: MASTER.controlLimits.filter((l) => l.equipmentId === equipmentId).map((l) => ({ ...l })) }
      },
    },
  }
}
