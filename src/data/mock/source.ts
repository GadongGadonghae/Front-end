// 데모 데이터 공급기: contracts.ts의 DataSource를 프론트 안에서 흉내 낸다 (주기는 API 명세 3.1).
// Vue를 모르는 순수 TypeScript (FRONTEND.md 2장). 타이머는 구독자가 있을 때만 돈다.
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { EquipmentLive, LineSummary, PlantSnapshot, PlantSummary, ProductMove } from '@/types/live'
import type { AlarmEvent, RiskEvent, StateEvent } from '@/types/events'
import type { HourlyOutput, ProductDetail, ProductionQuery, ProductionSummary, StepResult } from '@/types/production'
import type { InboundToday, InspectionToday, ProcessToday, TelemetryTick } from '@/types/process'
import type { LineId, ProcessId } from '@/types/plant'
import { MASTER } from '@/data/mock/master'
import {
  CURRENT_STATES, HOURLY_WEIGHT, INBOUND, LINE_DETAIL, LINE_DONE, OUTBOUND_NG, PAST_STATES, PDM, PLANT_OEE, RISK_EVENTS, RUN_AGO_SEC, TARGET,
} from '@/data/mock/scenario'
import { createTelemetry } from '@/data/mock/telemetry'
import { createProducts, PRODUCTION_LINES } from '@/data/mock/products'
import { createAnalysis } from '@/data/mock/analysis'
import { dayStart, daysOf, hash, localDate, noise, periodRange, rng } from '@/data/mock/rand'

const SNAPSHOT_MS = 1000 // snapshot 1초
const SUMMARY_MS = 10_000 // summary 10초 [제안]
/** 라인 CT 120초 [가정] → 1초에 1/120 확률로 라인 실적 +1 (데모) */
const LINE_DONE_PER_SEC = 1 / 120
/** 데모 계정 이름. 조치 메모 담당자도 이 이름 (실제는 서버가 로그인 사용자로 기록, D-84) */
const DEMO_USER = '김현수'
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
  for (const p of PDM) {
    live.get(p.equipmentId)!.pdm = { level: p.level, item: p.item, percent: p.percent }
  }
  const lineDone: Record<string, number> = { ...LINE_DONE }
  const inbound = { ...INBOUND }
  const plantDone = () => sum(PRODUCTION_LINES.map((l) => lineDone[l]))

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
    const plan = TARGET / PRODUCTION_LINES.length
    const lines: LineSummary[] = (Object.keys(LINE_DETAIL) as LineId[]).map((lineId) => {
      const d = LINE_DETAIL[lineId]
      const linePlan = lineId === 'PT' ? TARGET : plan
      const isPaint = lineId === 'PT'
      return {
        lineId, plan: linePlan, done: lineDone[lineId], rate: round1((lineDone[lineId] / linePlan) * 100), oee: d.oee, ngByProcess: { ...d.ng },
        wip: isPaint ? [{ from: 'E', to: 'F', qty: d.wip[0] }] : [{ from: 'B', to: 'C', qty: d.wip[0] }, { from: 'C', to: 'D', qty: d.wip[1] }],
      }
    })
    const ngByProcess = { B: 0, C: 0, D: 0, E: 0 }
    for (const l of lines) for (const [p, n] of Object.entries(l.ngByProcess)) ngByProcess[p as keyof typeof ngByProcess] += n
    const inspected = done + OUTBOUND_NG
    return {
      at: iso(now()),
      plant: {
        target: TARGET, done, rate: round1((done / TARGET) * 100), oee: { ...PLANT_OEE },
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
    const target = lineId ? (lineId === 'PT' ? TARGET : TARGET / PRODUCTION_LINES.length) : TARGET
    const weights = HOURLY_WEIGHT.slice(0, hourNow + 1).map((w, h) => (h === hourNow ? w * fracNow : w))
    const wsum = sum(weights) || 1
    let cum = 0
    const hours = weights.map((w, hour) => {
      const done = hour === hourNow ? total - cum : Math.round((w / wsum) * total)
      cum += done
      const elapsed = hour === hourNow ? hour + fracNow : hour + 1
      return { hour, done, cumulative: cum, planCumulative: Math.round((target * elapsed) / 24) }
    })
    return { date: localDate(now()), lineId: lineId ?? null, target, hours }
  }

  // ── 상세 화면 (공정·가동률·생산) ──
  const telemetry = createTelemetry({ now, live, events: () => events })
  const products = createProducts({ now, lineDone, live })
  const analysis = createAnalysis({ now, events: () => events })
  const today = () => localDate(now())
  const linePlan = TARGET / PRODUCTION_LINES.length
  const resultAt = (x: ProductDetail, p: ProcessId): StepResult => x.steps.find((s) => s.process === p)?.result ?? 'no'
  const countAt = (list: ProductDetail[], p: ProcessId, ...rs: StepResult[]) => list.filter((x) => rs.includes(resultAt(x, p))).length
  const todayProducts = (lines: LineId[]) => lines.flatMap((l) => products.day(today(), l))

  const processToday = (lineId: LineId, process: ProcessId): ProcessToday => {
    const list = todayProducts(process === 'E' ? PRODUCTION_LINES : [lineId])
    const at = (p: ProcessId) => countAt(list, p, 'now')
    const output = countAt(list, process, 'ok', 'ng')
    const wipOf: Partial<Record<ProcessId, ProcessToday['wip']>> = {
      B: { before: null, after: at('C') }, C: { before: at('C'), after: at('D') }, D: { before: at('D'), after: at('E') }, E: { before: at('E'), after: null },
    }
    const eqs = MASTER.equipment.filter((e) => e.area === lineId && e.process === process).sort((a, b) => a.order - b.order)
    // 평균 CT는 표준CT 120초 둘레 데모 값 (프레스 단별만 표시, SCR-002-3 3번)
    const rows = eqs.map((e) => ({
      id: e.id,
      // 프레스: 앞 단일수록 한 개씩 더 지나감. 도장: 두 대가 나눠 받음
      cycles: process === 'C' ? output + (eqs.length - e.order) : process === 'E' ? Math.round(output / 2 + (e.order === 1 ? 0.5 : -0.5) * (output % 2)) : output,
      avgCtMs: process === 'C' ? Math.round((117 + noise('ct', e.id, today()) * 9) * 1000) : null,
    }))
    const slowest = Math.max(...rows.map((r) => r.avgCtMs ?? 0))
    return {
      lineId, process, output, good: countAt(list, process, 'ok'), oee: analysis.oeeOf(`${lineId}:${process}`, today()),
      wip: wipOf[process] ?? { before: null, after: null },
      equipment: rows.map((r) => ({ ...r, slowest: r.avgCtMs != null && r.avgCtMs === slowest })),
      receivedByLine: process === 'E'
        ? PRODUCTION_LINES.map((l) => ({ lineId: l, qty: countAt(list.filter((x) => x.lineId === l), 'E', 'ok', 'ng', 'now') }))
        : undefined,
      inverter: process === 'B' ? (telemetry.inverter(`${lineId}-SLT`) ?? undefined) : undefined,
    }
  }

  const inspections = (process: ProcessId, lineId?: LineId): InspectionToday => {
    const list = todayProducts(lineId && process !== 'E' && process !== 'F' ? [lineId] : PRODUCTION_LINES)
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
      const coils = Math.min(left, 1 + Math.floor(r() * 3))
      left -= coils
      receipts.push({ t: '', coils })
    }
    receipts.forEach((x, i) => { x.t = iso(start + ((i + 0.3 + r() * 0.4) / receipts.length) * elapsed) })
    const input = todayProducts(PRODUCTION_LINES).length
    const consumed = Math.round(input / 24)
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
    const t = { done: 0, ng: { B: 0, C: 0, D: 0, E: 0, F: 0 } as Record<'B' | 'C' | 'D' | 'E' | 'F', number>, wip: 0 }
    for (const d of days) for (const l of lines) {
      const c = products.counts(d, l)
      if (!c) continue
      t.done += c.done
      for (const p of Object.keys(c.ng) as (keyof typeof c.ng)[]) t.ng[p] += c.ng[p]
      t.wip += c.wip.C + c.wip.D + c.wip.E
    }
    return t
  }
  const linesOf = (lineId?: LineId) => (lineId && lineId !== 'PT' ? [lineId] : PRODUCTION_LINES)

  /** 생산 요약 (API-100). 기간 계획 = 라인 계획 × 라인 수 × 오늘까지 일수 [가정] */
  const productionSummary = (q: ProductionQuery): ProductionSummary => {
    const { first, last } = periodRange(q.period, q.date)
    const upto = daysOf(first, last).filter((d) => d <= today())
    const lines = linesOf(q.lineId)
    const all = tally(lines, upto)
    const plan = upto.length ? linePlan * lines.length * upto.length : null
    const dayPlan = linePlan * lines.length

    let trend: ProductionSummary['trend'] = []
    if (q.period === 'day' && q.date <= today()) {
      const d = q.date
      const isToday = d === today()
      const endH = isToday ? (now() - dayStart(d)) / 3_600_000 : 24
      const doneH = lines.flatMap((l) => products.day(d, l)).filter((x) => x.result === 'ok' && x.doneAt).map((x) => (Date.parse(x.doneAt!) - dayStart(d)) / 3_600_000)
      const hours = [...Array(Math.floor(endH) + 1).keys(), ...(isToday ? [endH] : [])]
      // 90일 넘은 날은 제품이 없으므로 하루 실적을 고르게 나눈다
      const at = (h: number) => (doneH.length || !all.done ? doneH.filter((x) => x <= h).length : Math.round((all.done * h) / 24))
      trend = hours.map((h) => ({ x: h, label: `${String(Math.floor(h)).padStart(2, '0')}시`, done: at(h), plan: Math.round((dayPlan * h) / 24) }))
    } else if (q.period !== 'day') {
      trend = upto.map((d, i) => ({ x: i, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, done: tally(lines, [d]).done, plan: dayPlan }))
    }

    return {
      from: iso(dayStart(first)),
      to: iso(upto.at(-1) === today() ? now() : dayStart(last) + 86_400_000),
      plan, done: all.done, rate: plan ? round1((all.done / plan) * 100) : null,
      input: all.done + sum(Object.values(all.ng)) + all.wip, wip: all.wip, ngByProcess: all.ng,
      byLine: PRODUCTION_LINES.map((l) => ({ lineId: l, plan: upto.length ? linePlan * upto.length : null, done: tally([l], upto).done })),
      trend, trendKind: q.period === 'day' ? 'hourly' : 'daily',
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
    alarm: new Set<(a: AlarmEvent) => void>(),
    risk: new Set<(r: RiskEvent) => void>(),
  }
  let snapTimer: ReturnType<typeof setInterval> | null = null
  let sumTimer: ReturnType<typeof setInterval> | null = null

  const tickSnapshot = () => {
    for (const lineId of Object.keys(lineDone)) {
      const rate = lineId === 'PT' ? LINE_DONE_PER_SEC * PRODUCTION_LINES.length : LINE_DONE_PER_SEC
      // 고장 라인(L2)은 멈춰 있다
      if (lineId !== 'L2' && Math.random() < rate) lineDone[lineId] += 1
    }
    const s = snapshot()
    subs.snapshot.forEach((cb) => cb(s))
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
      onAlarm: (cb) => subscribe(subs.alarm, cb),
      onRiskChanged: (cb) => subscribe(subs.risk, cb),
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
      getMaster: async () => MASTER,
      getTodayHourly: async (lineId) => hourly(lineId),
      getTodayStateEvents: async (filter) => events.filter((e) => inArea(filter?.area)(e.equipmentId)).map((e) => ({ ...e })),
      getTodayRiskEvents: async (filter) => risks.filter((r) => inArea(filter?.area)(r.equipmentId)).map((r) => ({ ...r })),
      getProcessToday: async (lineId, process) => processToday(lineId, process),
      getTelemetry: async (equipmentId, range) => telemetry.series(equipmentId, range),
      getStateEvents: async ({ equipmentId }) => events.filter((e) => e.equipmentId === equipmentId).map((e) => ({ ...e })),
      getInspectionsToday: async (process, lineId) => inspections(process, lineId),
      getMicrostopsToday: async (equipmentId) => telemetry.microstops(equipmentId),
      getInboundToday: async () => inboundToday(),
      getOee: async (q) => analysis.oee(q),
      getStateTimeline: async (q) => analysis.timeline(q),
      getProductionSummary: async (q) => productionSummary(q),
      getProducts: async (q) => productList(q),
      getProduct: async (id) => products.find(id),
    },
    cmd: {
      // 데모 계정: 아이디·비밀번호가 비어 있지 않으면 통과 (실제 계정은 백엔드, DT-008)
      login: async (userId, password) => (userId && password ? { ok: true, name: DEMO_USER } : { ok: false }),
      logout: async () => {},
      async saveActionMemo(eventId, memo) {
        const ev = events.find((e) => e.id === eventId)
        if (!ev) throw new Error(`상태 이력 없음: ${eventId}`)
        const text = memo.trim()
        Object.assign(ev, text ? { memo: text, memoBy: DEMO_USER, memoAt: iso(now()) } : { memo: null, memoBy: null, memoAt: null })
        return { ...ev }
      },
    },
  }
}
