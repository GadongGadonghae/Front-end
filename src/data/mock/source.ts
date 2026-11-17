// 데모 데이터 공급기: contracts.ts의 DataSource를 프론트 안에서 흉내 낸다 (주기는 API 명세 3.1).
// Vue를 모르는 순수 TypeScript (FRONTEND.md 2장). 타이머는 구독자가 있을 때만 돈다.
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { EquipmentLive, LineSummary, PlantSnapshot, PlantSummary, ProductMove } from '@/types/live'
import type { AlarmEvent, RiskEvent, StateEvent } from '@/types/events'
import type { HourlyOutput } from '@/types/production'
import type { LineId } from '@/types/plant'
import { MASTER } from '@/data/mock/master'
import {
  CURRENT_STATES, HOURLY_WEIGHT, INBOUND, LINE_DETAIL, LINE_DONE, OUTBOUND_NG, PAST_STATES, PDM, PLANT_OEE, RISK_EVENTS, RUN_AGO_SEC, TARGET,
} from '@/data/mock/scenario'

const SNAPSHOT_MS = 1000 // snapshot 1초
const SUMMARY_MS = 10_000 // summary 10초 [제안]
/** 라인 CT 120초 [가정] → 1초에 1/120 확률로 라인 실적 +1 (데모) */
const LINE_DONE_PER_SEC = 1 / 120
const PRODUCTION_LINES: LineId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

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
    return { date: iso(now()).slice(0, 10), lineId: lineId ?? null, target, hours }
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
    },
    q: {
      getMaster: async () => MASTER,
      getTodayHourly: async (lineId) => hourly(lineId),
      getTodayStateEvents: async (filter) => events.filter((e) => inArea(filter?.area)(e.equipmentId)).map((e) => ({ ...e })),
      getTodayRiskEvents: async (filter) => risks.filter((r) => inArea(filter?.area)(r.equipmentId)).map((r) => ({ ...r })),
    },
    cmd: {
      // 데모 계정: 아이디·비밀번호가 비어 있지 않으면 통과 (실제 계정은 백엔드, DT-008)
      login: async (userId, password) => (userId && password ? { ok: true, name: '김현수' } : { ok: false }),
      logout: async () => {},
    },
  }
}
