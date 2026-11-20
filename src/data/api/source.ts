// 실제 백엔드 어댑터: 화면 계약(contracts.ts)을 백엔드 엔드포인트(endpoints.ts, 명세 v3.1/v3.2)로 채운다.
// - 실시간은 STOMP 라이브러리 결정 전까지 REST 주기 조회로 대신한다 (상태 1초 M-01, 요약 10초, 알림 5초). 결정되면 W-01~04로 바꾼다
// - 백엔드에 아직 없는 기능(예지보전·제품 내역·시간대별 생산·리포트 등, docs/API-차이-v3.1.md)은 빈 값을 돌려준다 → 화면은 "데이터 없음"
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { ControlLimit, DowntimeCodeDef, Equipment, EquipmentType, EquipmentTypeCode, Line, LineId, MasterData, Process, ProcessId, ProductionLineId } from '@/types/plant'
import type { EquipmentLive, FlowPositions, PlantSnapshot, PlantSummary } from '@/types/live'
import type { AlarmEvent, HistoryEvent, HistoryQuery, StateEvent } from '@/types/events'
import type { TelemetryTick } from '@/types/process'
import type { DowntimeCode, StateCode, StopState } from '@/types/state'
import type { OeeReport } from '@/types/analysis'
import type { DowntimeEventDto, EquipmentStatusDto, FlowPositionsDto, ProductDetailDto, ProductDto, ReassignmentDetailDto, ThresholdDto } from '@/data/api/dto'
import type { Product, ProductDetail } from '@/types/production'
import type { ReplanReport } from '@/types/report'
import { api } from '@/data/api/endpoints'
import { ApiError, token } from '@/data/api/http'
import { isTodo, summarize } from '@/data/historyTodo'

const SNAPSHOT_MS = 1000
const SUMMARY_MS = 10_000
/** 알람 발생·해제 확인 주기. 짧을수록 해제 직후 지속시간이 덜 넘어가요 (11/20 5초 → 2초) */
const ALARM_MS = 2000
const TELEMETRY_MS = 2000
const LINES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

// ── 기준정보 중 API에 없는 것 (명세 공통 규칙에서 옮김) ──
const PROCESSES: Process[] = [
  { id: 'COIL', name: '코일입고', order: 1 }, { id: 'SLITTING', name: '슬리팅', order: 2 }, { id: 'PRESS', name: '프레스', order: 3 },
  { id: 'WELDING', name: '용접', order: 4 }, { id: 'PAINTING', name: '도장', order: 5 }, { id: 'INSPECTION', name: '출고', order: 6 },
]
/** 공정별 제품 1개 처리 시간 (명세 11/17 갱신) */
const TYPES: EquipmentType[] = [
  { code: 'slitter', name: '슬리터', standardCtSec: 16 }, { code: 'press', name: '프레스', standardCtSec: 17 },
  { code: 'welder', name: '용접로봇', standardCtSec: 17 }, { code: 'painter', name: '도장라인', standardCtSec: 4 },
  { code: 'vision', name: '비전검사기', standardCtSec: 7 },
]
const CODES: DowntimeCodeDef[] = [
  { code: 'PL_SHIFT', name: '교대', state: 'S' }, { code: 'PL_PM', name: '예방보전', state: 'S' }, { code: 'PL_CHANGE', name: '모델 교체', state: 'S' },
  { code: 'PL_SETUP', name: '코일·나이프 교체', state: 'S' }, { code: 'UP_SHORTAGE', name: '재공부족', state: 'I' }, { code: 'UP_BLOCKED', name: '후공정 정지 대기', state: 'I' }, { code: 'UP_DELAY', name: '작업지연', state: 'I' },
  { code: 'UP_BREAKDOWN', name: '장비고장', state: 'D' }, { code: 'UP_ALARM', name: '알람(관리값 이탈)', state: 'D' }, { code: 'UP_SAFETY', name: '안전문제', state: 'D' },
  { code: 'UP_LABOR', name: '노사협의', state: 'D' }, { code: 'UP_ETC', name: '기타', state: 'D' },
]
const TYPE_OF: Record<ProcessId, EquipmentTypeCode> = { COIL: 'vision', SLITTING: 'slitter', PRESS: 'press', WELDING: 'welder', PAINTING: 'painter', INSPECTION: 'vision' }
const stateOfCode = (c: DowntimeCode): StopState => CODES.find((x) => x.code === c)?.state ?? 'D'

// ── 시각: 백엔드는 ISO-8601 KST ──
const pad = (n: number) => String(n).padStart(2, '0')
function isoLocal(ms: number) {
  const d = new Date(ms)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}
const dateOf = (ms: number) => isoLocal(ms).slice(0, 10)
const dayStartMs = (date: string) => new Date(`${date}T00:00:00`).getTime()
// 백엔드 기간 쿼리 from·to는 날짜(yyyy-MM-dd, to 포함)만 받는다. 시각을 붙이면 400
const todayRange = () => ({ from: dateOf(Date.now()), to: dateOf(Date.now()) })
function periodRange(period: 'day' | 'week' | 'month', date: string) {
  const d = new Date(`${date}T00:00:00`)
  if (period === 'day') return { first: date, last: date }
  if (period === 'week') {
    const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const e = new Date(s); e.setDate(s.getDate() + 6)
    return { first: dateOf(s.getTime()), last: dateOf(e.getTime()) }
  }
  return { first: `${date.slice(0, 7)}-01`, last: dateOf(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime()) }
}
const rangeOf = (first: string, last: string) => ({ from: first, to: last })

// ── 변환 ──
function equipmentOf(e: { equipmentId: string; name: string; lineId: string | null; process: ProcessId }): Equipment {
  const m = /-PR(\d)$|^PT(\d)$/.exec(e.equipmentId)
  const order = m ? Number(m[1] ?? m[2]) : 1
  const area = e.lineId ?? (e.process === 'PAINTING' ? 'PT' : 'VI')
  const shortName = e.process === 'PRESS' ? `${order}단` : e.process === 'PAINTING' ? `도장 #${order}` : e.process === 'INSPECTION' ? '비전' : PROCESSES.find((p) => p.id === e.process)!.name
  return { id: e.equipmentId, area: area as Equipment['area'], process: e.process, order, type: TYPE_OF[e.process], name: e.name, shortName, real: e.equipmentId === 'A-SL' }
}
const liveOf = (s: EquipmentStatusDto): EquipmentLive => ({ id: s.equipmentId, state: s.status, code: s.reasonCode, detail: null, since: s.since, pdm: null })
const limitOf = (t: ThresholdDto, type: EquipmentTypeCode): ControlLimit => ({
  id: t.id, equipmentId: t.equipmentId, type, item: t.metric, unit: t.unit ?? '', lower: t.low, upper: t.high, updatedAt: t.updatedAt ?? null, updatedBy: t.updatedBy ?? null,
})
const eventOf = (e: DowntimeEventDto): HistoryEvent => ({
  id: String(e.eventId), equipmentId: e.equipmentId, state: e.status, code: e.reasonCode, detail: e.detail,
  start: e.startAt, end: e.endAt, memo: e.memo || null, memoBy: e.actionUserName, memoAt: e.actionAt,
  reportId: null, alarmLevel: null, notify: null,
})
// ── 제품 추적 (P-01·P-02 → 생산 조회 화면) ──
const STEPS: ProcessId[] = ['SLITTING', 'PRESS', 'WELDING', 'PAINTING', 'INSPECTION']
const productResult = (f: ProductDto['finalResult']): Product['result'] => (f === 'OK' ? 'ok' : f === 'NG' ? 'ng' : 'wip')
/** M-17 위치 → 지금 공정. 설비 안이면 그 공정, 공정 사이(pile)면 다음 공정으로 이동 중 */
function processAt(p: FlowPositionsDto['products'][number]): ProcessId {
  const eq = p.equipmentId ?? ''
  if (eq) return eq.endsWith('-SL') ? 'SLITTING' : eq.includes('-PR') ? 'PRESS' : eq.endsWith('-WD') ? 'WELDING' : eq.startsWith('PT') ? 'PAINTING' : 'INSPECTION'
  const pile = p.pile ?? ''
  return pile.endsWith('SL-PR') ? 'PRESS' : pile.endsWith('PR-WD') ? 'WELDING' : pile.endsWith('WD-PT') ? 'PAINTING' : 'INSPECTION'
}
/** P-01 한 줄의 공정별 결과. 불량은 그 공정이 ng·뒤는 no, 진행 중은 지금 공정(cur, 모르면 프레스 단 사이)이 now */
function stepsOf(r: ProductDto, cur: ProcessId | undefined): Product['steps'] {
  const ngAt = r.scrappedProcess ? STEPS.indexOf(r.scrappedProcess as ProcessId) : STEPS.length - 1
  const curAt = STEPS.indexOf(cur ?? 'PRESS')
  return STEPS.map((process, i) => ({
    process,
    result: r.finalResult === 'OK' ? 'ok'
      : r.finalResult === 'NG' ? (i < ngAt ? 'ok' : i === ngAt ? 'ng' : 'no')
        : (i < curAt ? 'ok' : i === curAt ? 'now' : 'no'),
  }))
}
const productOf = (r: ProductDto, cur?: ProcessId): Product => ({
  id: r.productId, lineId: r.lineId as LineId, inputAt: r.inputAt, doneAt: r.finishedAt,
  steps: stepsOf(r, cur), result: productResult(r.finalResult), ngProcess: (r.scrappedProcess as ProcessId | null) ?? null,
})
/** P-02 → 공정별 기록 5칸. 프레스 4단은 한 칸으로 (첫 단 시작 ~ 4단 끝, 한 단이라도 NG면 NG) */
function productDetailOf(d: ProductDetailDto): ProductDetail {
  const records: ProductDetail['records'] = STEPS.map((process) => {
    const ss = d.steps.filter((s) => s.process === process)
    if (!ss.length) return { process, equipment: null, from: null, to: null, judgement: null, reason: null }
    const last = ss[ss.length - 1]
    const ng = ss.find((s) => s.result === 'NG')
    const done = (s: typeof last) => !!(s.endedAt ?? s.result)
    const finished = process === 'PRESS' ? ss.length >= 4 && done(last) : done(last)
    const to = ng ? ng.endedAt ?? ng.at : finished ? last.endedAt ?? last.at : null
    return {
      process,
      equipment: (ng ?? last).equipmentId,
      from: ss[0].startedAt ?? ss[0].at,
      to,
      judgement: ng ? 'ng' : to ? 'ok' : null,
      reason: ng ? (process === 'INSPECTION' ? '비전 검사 불량' : ng.equipmentId + ' 관리값 이탈') : null,
    }
  })
  const steps: Product['steps'] = records.map((r) => ({ process: r.process, result: r.judgement === 'ng' ? 'ng' : r.to ? 'ok' : r.from ? 'now' : 'no' }))
  const inspected = records[records.length - 1]
  return {
    id: d.productId, lineId: d.lineId as LineId,
    inputAt: records[0].from ?? '', doneAt: d.finalResult === 'OK' ? inspected.to : null,
    steps, result: productResult(d.finalResult), ngProcess: (d.scrappedProcess as ProcessId | null) ?? null,
    records,
  }
}

/** R-02·R-03 → 계획수정 보고서 화면. 예전 보고서(계산 칸 없음)는 0·null로 채운다 */
const replanOf = (r: ReassignmentDetailDto): ReplanReport => ({
  id: String(r.reportId), createdAt: r.createdAt, equipmentId: r.equipmentId, code: r.code as DowntimeCode,
  createdBy: r.createdBy ?? '-', stateEventId: String(r.downtimeId), start: r.startedAt, detail: r.detail,
  kind: r.kind ?? 'line', baseAt: r.baseAt ?? r.createdAt, remainingSec: r.remainingSec ?? 0, ctSec: r.ctSec ?? 0,
  stoppedPlan: r.stoppedPlan ?? 0, stoppedDone: r.stoppedDone ?? 0, shortage: r.lossQty,
  allocations: r.details.map((d) => ({ target: d.targetLineId, remainingPlan: d.remainingPlan ?? 0, capacity: d.spareCapacity, share: d.share ?? 0, add: d.addQty })),
  unmet: r.unmetQty ?? 0, target: r.targetQty ?? null, documentNo: r.documentNo,
  ai: r.ai ? {
    title: r.ai.title, summary: r.ai.summary, actions: r.ai.actions ?? [], risks: r.ai.risks ?? [], model: r.ai.model, mock: r.ai.mock,
    fallbackReason: r.ai.fallbackReason ?? null, additionalRequest: r.ai.additionalRequest ?? null, interpretation: r.ai.requestInterpretation ?? null,
  } : null,
})
// ── 구역·비가동 공통 (11/20 화면 간 숫자 맞추기) ──
// 화면의 구역은 생산 라인 A~F와 도장(PT)·출고(VI). 백엔드는 라인만 lineId로 받으므로 PT·VI는 공정 조건으로 바꾼다
const isLine = (a?: string | null): a is string => !!a && a !== 'PT' && a !== 'VI'
const areaProcess = (a?: string | null): ProcessId | undefined => (a === 'PT' ? 'PAINTING' : a === 'VI' ? 'INSPECTION' : undefined)
type EventScope = { from: string; to: string; lineId?: string; process?: ProcessId; equipmentId?: string }
/** U-08 비가동을 전부 (알람 이력 탭과 같은 기준: 1분 미만도 포함). 100건씩 최대 20쪽 */
async function allEvents(q: EventScope) {
  const out: DowntimeEventDto[] = []
  for (let page = 1; page <= 20; page++) {
    const p = await api.U08({ ...q, minMinutes: 0, page, size: 100 })
    out.push(...p.items)
    if (!p.items.length || out.length >= p.total) break
  }
  return out
}
/** 비가동 사유별 시간·건수. 기간 [from, to] 안에 든 길이만 (진행 중은 지금까지) */
function downtimeOf(events: DowntimeEventDto[], from: string, to: string): OeeReport['downtime'] {
  const a = dayStartMs(from)
  const b = Math.min(dayStartMs(to) + 86_400_000, Date.now())
  const by = new Map<DowntimeCode, { sec: number; count: number }>()
  for (const e of events) {
    const s = Math.max(a, Date.parse(e.startAt))
    const t = Math.min(b, e.endAt ? Date.parse(e.endAt) : Date.now())
    const v = by.get(e.reasonCode as DowntimeCode) ?? { sec: 0, count: 0 }
    v.count += 1
    if (t > s) v.sec += Math.round((t - s) / 1000)
    by.set(e.reasonCode as DowntimeCode, v)
  }
  return [...by].map(([code, v]) => ({ code, state: stateOfCode(code), sec: v.sec, count: v.count })).sort((x, y) => y.sec - x.sec)
}
/** 라인 6개 각각의 M-07 (공정별 생산·불량은 라인을 줘야 나옴) */
const perLineCounts = (date?: string) => Promise.all(LINES.map((l) => api.M07({ date, lineId: l }).catch(() => null)))
/** 라인별 M-07을 합친 공정 하나의 생산·불량 */
function processSum(per: Awaited<ReturnType<typeof perLineCounts>>, process: ProcessId) {
  return per.reduce((a, c) => {
    const x = c?.byProcess?.find((p) => p.process === process)
    return { produced: a.produced + (x?.produced ?? 0), ng: a.ng + (x?.ng ?? 0) }
  }, { produced: 0, ng: 0 })
}
const STATE_RANK: Record<StateCode, number> = { D: 5, DC: 4, S: 3, I: 2, R: 1 }
type Seg = { state: StateCode; from: number; to: number }
/** 여러 설비의 상태 구간을 라인 대표 상태 하나로: 그 순간 가장 나쁜 상태 (D > DC > S > I > R, 판정 우선순위와 같음) */
function worstOf(lists: Seg[][], until: number): Seg[] {
  const cuts = [...new Set([0, until, ...lists.flat().flatMap((s) => [s.from, s.to])])].filter((x) => x >= 0 && x <= until).sort((x, y) => x - y)
  const out: Seg[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]
    const b = cuts[i + 1]
    let worst: StateCode | null = null
    for (const list of lists) {
      const s = list.find((x) => x.from <= a && x.to > a)
      if (s && (!worst || STATE_RANK[s.state] > STATE_RANK[worst])) worst = s.state
    }
    if (!worst) continue
    const last = out.at(-1)
    if (last && last.state === worst && last.to === a) last.to = b
    else out.push({ state: worst, from: a, to: b })
  }
  return out
}

/** 이력을 모든 페이지에 걸쳐 불러온다 (알람 이력 요약 · 손볼 건 거르기용, 백엔드에 해당 API 없음).
 *  아래 allEvents와 같은 기준: 1분 미만 포함(main 11/20), 100건씩 최대 20쪽 */
async function historyAll(q: Omit<HistoryQuery, 'page' | 'todo'>): Promise<HistoryEvent[]> {
  const out: HistoryEvent[] = []
  for (let page = 1; page <= 20; page++) {
    const p = await api.U08({
      from: q.from, to: q.to,
      lineId: q.lineId, process: q.process as ProcessId | undefined, status: q.states.length ? q.states.join(',') : undefined, reasonCode: q.code, inProgress: q.ongoing,
      minMinutes: q.minMinutes ?? 0, page, size: 100,
    })
    out.push(...p.items.map(eventOf))
    if (out.length >= p.total || !p.items.length) break
  }
  return out
}
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof ApiError ? e.message : String(e) })

/** 하루 시간대별 누적 양품 (G-01 unit=hour를 라인 합으로) + 계획선 (G-02 합을 24시간에 고르게) */
async function hourlyOf(date: string, lineId?: string) {
  const [rows, plans] = await Promise.all([api.G01H({ from: date, to: date, lineId }), api.G02({ from: date, to: date, lineId }).catch(() => [])])
  const target = plans.length ? plans.reduce((a, p) => a + p.planQty, 0) : null
  const byHour = new Map<number, { done: number; cumulative: number }>()
  for (const r of rows) {
    const hour = Number(r.period.slice(11, 13))
    const v = byHour.get(hour) ?? { done: 0, cumulative: 0 }
    v.done += r.good
    v.cumulative += r.cumulativeGood
    byHour.set(hour, v)
  }
  const hours = [...byHour].sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({ hour, ...v, planCumulative: target == null ? null : Math.round((target * (hour + 1)) / 24) }))
  return { date, target, hours }
}

/** 주기 조회로 구독을 흉내 낸다. 처음 한 번 바로 부른다. 앞 요청이 안 끝났으면 그 주기는 건너뛴다 (늦은 옛 응답이 새 값을 덮지 않게) */
function poll(ms: number, run: () => Promise<void>): Unsubscribe {
  let alive = true
  let busy = false
  const tick = () => {
    if (!alive || busy) return
    busy = true
    run().catch(() => { /* 다음 주기에 다시 */ }).finally(() => { busy = false })
  }
  tick()
  const t = setInterval(tick, ms)
  return () => { alive = false; clearInterval(t) }
}

export function createApiSource(): DataSource {
  const typeById = new Map<string, EquipmentTypeCode>()

  async function master(): Promise<MasterData> {
    const [lines, eqs, limits] = await Promise.all([api.C04(), api.C05(), api.M10()])
    const equipment = eqs.map(equipmentOf)
    for (const e of equipment) typeById.set(e.id, e.type)
    const lineList: Line[] = [
      ...lines.map((l, i): Line => ({ id: l.lineId as LineId, name: `${l.lineId}라인`, kind: 'production', order: i + 1, defaultPaintId: l.defaultPaintId, currentPaintId: l.currentPaintId })),
      { id: 'PT', name: '도장', kind: 'paint', order: 7, defaultPaintId: null, currentPaintId: null },
    ]
    return { lines: lineList, processes: PROCESSES, equipmentTypes: TYPES, equipment, downtimeCodes: CODES, controlLimits: limits.map((t) => limitOf(t, typeById.get(t.equipmentId) ?? 'press')) }
  }

  async function snapshot(): Promise<PlantSnapshot> {
    const [status, counts, coil] = await Promise.all([api.M01(), api.M07({ groupBy: 'line' }), api.M16()])
    return {
      at: isoLocal(Date.now()),
      equipment: status.map(liveOf),
      plant: { done: counts.ok },
      lines: counts.byGroup.map((g) => ({ lineId: g.key as LineId, done: g.good })),
      // M-16: 오늘 입고 롤 수, 재고는 롤(소수 1자리, 1롤 = 20개 → 74개면 3.7)
      inbound: { today: coil.receivedRolls, stock: coil.stockRolls },
    }
  }

  async function summary(): Promise<PlantSummary> {
    const today = dateOf(Date.now())
    const r = todayRange()
    const [u, counts, plans, byLine, perLine, wips] = await Promise.all([
      api.U01(r), api.M07({ groupBy: 'line' }), api.G02({ from: today, to: today }).catch(() => []), api.U04(r),
      perLineCounts(), Promise.all(LINES.map((l) => api.M13({ lineId: l }).catch(() => []))),
    ])
    // 공정별 불량은 라인을 줘야 나와서 라인 6개를 합친다 (11/20, 예전엔 공장 전체에서 비어 있었음)
    const ngOf = (c: (typeof perLine)[number]) => Object.fromEntries((c?.byProcess ?? []).filter((p) => p.process !== 'INSPECTION').map((p) => [p.process, p.ng]))
    const plantNg: Record<string, number> = {}
    for (const c of perLine) for (const [k, n] of Object.entries(ngOf(c))) plantNg[k] = (plantNg[k] ?? 0) + n
    const target = plans.length ? plans.reduce((a, p) => a + p.planQty, 0) : null
    const planOf = (l: string) => plans.find((p) => p.lineId === l)?.planQty ?? null
    return {
      at: isoLocal(Date.now()),
      plant: {
        target, done: counts.ok, rate: target ? Math.round((counts.ok / target) * 1000) / 10 : null,
        oee: { oee: u.oee, availability: u.availability, performance: u.performance, quality: u.quality },
        quality: {
          ngByProcess: plantNg,
          outbound: { inspected: counts.inspected, ok: counts.ok, ng: counts.ngVision, rate: counts.inspected ? Math.round((counts.ngVision / counts.inspected) * 1000) / 10 : null },
        },
      },
      lines: LINES.map((l, i) => {
        const done = counts.byGroup.find((g) => g.key === l)?.good ?? 0
        const plan = planOf(l)
        return {
          lineId: l, plan, done, rate: plan ? Math.round((done / plan) * 1000) / 10 : null,
          oee: byLine.find((x) => x.lineId === l)?.oee ?? null, ngByProcess: ngOf(perLine[i]),
          // 그 라인의 재공 (예전엔 모든 라인에 공장 전체 재공이 들어갔음)
          wip: wips[i].filter((w) => w.process !== 'COIL').map((w) => ({ from: w.process, to: w.nextProcess, qty: w.wipQty })),
        }
      }),
    }
  }

  async function todayEvents(q: { equipmentId?: string; lineId?: string; process?: ProcessId } = {}): Promise<StateEvent[]> {
    // 알람 이력 탭과 같은 기준: 1분 미만도 포함 (11/20). 최근순 100건
    const p = await api.U08({ ...todayRange(), ...q, minMinutes: 0, page: 1, size: 100 }) // 백엔드 size 최대 100
    return p.items.map(eventOf)
  }

  // 알람 발생·해제: 진행 중인 건만 (1분 미만도) 5초마다 받아 지난번과 비교한다. 구독이 여럿이어도 조회는 하나 (W-01·W-02로 바꿀 자리)
  const alarmListeners = new Set<(a: AlarmEvent) => void>()
  let stopAlarmPoll: Unsubscribe | null = null
  function startAlarmPoll(): Unsubscribe {
    let prev = new Map<string, StateEvent>()
    let first = true
    return poll(ALARM_MS, async () => {
      const p = await api.U08({ ...todayRange(), inProgress: true, minMinutes: 0, page: 1, size: 100 })
      const now = new Map(p.items.map(eventOf).map((e) => [e.id, e]))
      const emit = (a: AlarmEvent) => alarmListeners.forEach((cb) => cb(a))
      if (!first) {
        for (const [id, e] of now) if (!prev.has(id)) emit({ kind: 'raised', event: e })
        for (const [id, e] of prev) if (!now.has(id)) emit({ kind: 'cleared', event: { ...e, end: isoLocal(Date.now()) } })
      }
      prev = now
      first = false
    })
  }

  return {
    demo: false,
    live: {
      onSnapshot: (cb) => poll(SNAPSHOT_MS, async () => cb(await snapshot())),
      onSummary: (cb) => poll(SUMMARY_MS, async () => cb(await summary())),
      onProductMove: () => () => {},
      // 3D 물류: 제품 위치 M-17 + 코일 재공 M-16(stockQty, 제품 수) 1초마다 (11/19)
      // M-17 pile은 라인 안이면 라인 접두어가 없어서 3D 키(`A:SL-PR`)로 맞춘다. 도장 뒤(`PT1:PT-VI`)는 그대로
      onFlowPositions: (cb) => poll(SNAPSHOT_MS, async () => {
        const [pos, coil] = await Promise.all([api.M17(), api.M16()])
        const products: FlowPositions['products'] = pos.products.map((p) => ({
          productId: p.productId,
          lineId: p.lineId as ProductionLineId,
          location: p.equipmentId ? { eq: p.equipmentId } : { pile: p.pile!.includes(':') ? p.pile! : `${p.lineId}:${p.pile}` },
        }))
        cb({ at: pos.at, products, coilWip: coil.stockQty })
      }),
      onAlarm(cb) {
        alarmListeners.add(cb)
        stopAlarmPoll ??= startAlarmPoll()
        return () => {
          alarmListeners.delete(cb)
          if (!alarmListeners.size && stopAlarmPoll) { stopAlarmPoll(); stopAlarmPoll = null }
        }
      },
      onRiskChanged: () => () => {},
      onRisk: (cb) => { cb([]); return () => {} },
      onTelemetry(equipmentId, cb: (t: TelemetryTick) => void) {
        // after: 그 시각보다 뒤의 점만 (M-03, 11/19 백엔드 추가). 처음은 구독한 시각부터 (그 앞은 getTelemetry가 받음)
        let lastTs = isoLocal(Date.now())
        return poll(TELEMETRY_MS, async () => {
          const today = dateOf(Date.now())
          const m = await api.M03(equipmentId, { from: today, to: today, after: lastTs })
          const values = m.metrics.flatMap((x) => x.points.map((p) => ({ t: p.ts, item: x.metric, value: p.value, result: p.result })))
          for (const v of values) if (Date.parse(v.t) > Date.parse(lastTs)) lastTs = v.t
          if (values.length) cb({ equipmentId, values })
        })
      },
    },
    q: {
      getMaster: master,
      getTodayHourly: async (lineId) => ({ ...(await hourlyOf(dateOf(Date.now()), lineId)), lineId: lineId ?? null }),
      getTodayStateEvents: async (filter) => todayEvents(isLine(filter?.area) ? { lineId: filter.area } : { process: areaProcess(filter?.area) }),
      getTodayRiskEvents: async () => [],
      async getProcessToday(lineId, process) {
        const line = isLine(lineId) ? lineId : undefined
        const [eqs, counts, wip, byProcess, cycles, perLine] = await Promise.all([
          api.M12(process, { lineId: line }), api.M07({ lineId: line }), api.M13({ lineId: line }), api.U03({ ...todayRange(), lineId: line }),
          api.M15(process, { lineId: line }).catch(() => []), line ? Promise.resolve([]) : perLineCounts(),
        ])
        // 출고(비전)는 검사 수·비전 불량, 그 밖은 공정별 생산·불량 (라인을 안 주면 라인 6개 합, 11/20)
        const p = process === 'INSPECTION' ? { produced: counts.inspected, ng: counts.ngVision }
          : line ? counts.byProcess?.find((x) => x.process === process) : processSum(perLine, process)
        // 도장: 설비(PT1·PT2)마다 앞(용접→도장)·뒤(도장→검사) 재공 (M-13 paintId)
        const paintWip = process === 'PAINTING'
          ? new Map(await Promise.all(eqs.map(async (e) => [e.equipmentId, await api.M13({ paintId: e.equipmentId }).catch(() => [])] as const)))
          : null
        return {
          lineId, process, output: p?.produced ?? 0, good: (p?.produced ?? 0) - (p?.ng ?? 0),
          oee: byProcess.find((x) => x.process === process)?.oee ?? null,
          wip: { before: wip.find((w) => w.nextProcess === process)?.wipQty ?? null, after: wip.find((w) => w.process === process)?.wipQty ?? null },
          // M-15. 그날 행이 없는 설비는 0
          equipment: eqs.map((e) => { const c = cycles.find((x) => x.equipmentId === e.equipmentId); const w = paintWip?.get(e.equipmentId)
            return { id: e.equipmentId, cycles: c?.cycles ?? 0, avgCtMs: c?.avgCtMs ?? null, wip: w && { before: w.find((x) => x.nextProcess === 'PAINTING')?.wipQty ?? null, after: w.find((x) => x.process === 'PAINTING')?.wipQty ?? null } } }),
        }
      },
      async getTelemetry(equipmentId, range) {
        const to = Date.now()
        const from = range === 'today' ? dayStartMs(dateOf(to)) : to - (range === '1h' ? 3_600_000 : 8 * 3_600_000)
        const m = await api.M03(equipmentId, { from: dateOf(from), to: dateOf(to), interval: range === '1h' ? 'raw' : '5s' })
        return {
          equipmentId, range,
          items: m.metrics.map((x) => ({ item: x.metric, unit: x.unit, lower: x.limitLow, upper: x.limitHigh, points: x.points.map((p) => ({ t: p.ts, value: p.value, result: p.result })) })),
        }
      },
      getStateEvents: async ({ equipmentId }) => todayEvents({ equipmentId }),
      async getInspectionsToday(process, area) {
        const lineId = isLine(area) ? area : undefined
        const counts = await api.M07({ lineId })
        if (process === 'INSPECTION') {
          const ng = await api.M08({ ...todayRange(), lineId, result: 'NG', page: 1, size: 50 })
          return {
            lineId: lineId ?? null, process, inspected: counts.inspected, ng: counts.ngVision, rate: counts.inspected ? Math.round((counts.ngVision / counts.inspected) * 1000) / 10 : null,
            defects: ng.items.map((i) => ({ t: i.inspectedAt, productId: i.productId, equipmentId: 'VI', reason: '비전 검사 불량' })),
          }
        }
        // 라인을 안 주면 라인 6개 합. 불량 제품 목록은 P-03 (11/20)
        const [p, ngList] = await Promise.all([
          lineId ? Promise.resolve(counts.byProcess?.find((x) => x.process === process)) : perLineCounts().then((per) => processSum(per, process)),
          api.P03({ ...todayRange(), lineId, process, page: 1, size: 50 }).catch(() => null),
        ])
        return {
          lineId: lineId ?? null, process, inspected: p?.produced ?? 0, ng: p?.ng ?? 0, rate: p?.produced ? Math.round(((p.ng ?? 0) / p.produced) * 1000) / 10 : null,
          defects: (ngList?.items ?? []).map((x) => ({ t: x.at, productId: x.productId, equipmentId: x.equipmentId, reason: x.reason ?? (x.itemName ? `${x.itemName} 기준 이탈` : '공정 불량') })),
        }
      },
      getMicrostopsToday: async (equipmentId) => ({ equipmentId, count: 0, lossSec: 0, bands: [] }),
      async getInboundToday() {
        const coil = await api.M16()
        // 같은 시각에 들어온 롤은 한 줄로 묶어요 (예: 0초에 4롤 → 한 줄 "4"), 최근순
        const byTime = new Map<string, number>()
        for (const r of coil.receipts) byTime.set(r.receivedAt, (byTime.get(r.receivedAt) ?? 0) + 1)
        const receipts = [...byTime].map(([t, coils]) => ({ t, coils })).reverse()
        // 재고 추이(stockTrend)는 API가 없어서 비워 둬요
        return { today: coil.receivedRolls, stock: coil.stockRolls, input: coil.inputQty, receipts, stockTrend: [] }
      },
      async getOee(q) {
        const { first, last } = periodRange(q.period, q.date)
        const r = rangeOf(first, last)
        // 범위: 공장 · 라인(A~F) · 도장(PT)·출고(VI) 구역 · 공정 · 설비 (11/20: 예전엔 설비·구역을 무시하고 라인/공장 값을 줬음)
        const line = isLine(q.lineId) ? q.lineId : undefined
        const proc = (q.process as ProcessId | undefined) ?? areaProcess(q.lineId)
        const wantEq = !!q.equipmentId || (!!proc && !q.equipmentId)
        const [u, events, trend, byProc, byEq] = await Promise.all([
          q.equipmentId ? Promise.resolve(null) : api.U01({ ...r, lineId: line }),
          // 비가동: 알람 이력 탭과 같은 U-08 (1분 미만 포함)을 이 범위로 걸러 사유별로 합침
          allEvents({ ...r, lineId: line, process: proc, equipmentId: q.equipmentId }).catch(() => [] as DowntimeEventDto[]),
          q.period === 'day' || (q.lineId && !line) ? Promise.resolve([]) : api.U02({ ...r, unit: 'day', lineId: line }).catch(() => []),
          proc && !q.equipmentId ? api.U03({ ...r, lineId: line }).catch(() => []) : Promise.resolve([]),
          wantEq ? api.U05({ ...r, lineId: line, process: proc }).catch(() => []) : Promise.resolve([]),
        ])
        const eqOee = q.equipmentId ? byEq.find((x) => x.equipmentId === q.equipmentId)?.oee ?? null : null
        const procOee = proc ? byProc.find((x) => x.process === proc)?.oee ?? null : null
        const oee = q.equipmentId ? { oee: eqOee, availability: null, performance: null, quality: null }
          : proc ? { oee: procOee, availability: null, performance: null, quality: null }
            : { oee: u?.oee ?? null, availability: u?.availability ?? null, performance: u?.performance ?? null, quality: u?.quality ?? null }
        let bars: OeeReport['bars']
        if (!q.lineId) bars = (await api.U04(r)).map((x) => ({ key: x.lineId, label: `${x.lineId}라인`, oee: x.oee ?? null }))
        else if (!proc) bars = (await api.U03({ ...r, lineId: line })).map((x) => ({ key: x.process, label: PROCESSES.find((p) => p.id === x.process)?.name ?? x.process, oee: x.oee }))
        else bars = byEq.map((x) => ({ key: x.equipmentId, label: x.equipmentId, oee: x.oee ?? null }))
        return {
          query: q, from: r.from, to: r.to,
          oee,
          lineYield: proc || q.equipmentId ? null : (u?.lineYield ?? null),
          bars,
          downtime: downtimeOf(events, r.from, r.to),
          daily: trend.map((t) => ({ date: t.period, oee: t.oee ?? null })),
        }
      },
      async getStateTimeline(q) {
        const until = q.date === dateOf(Date.now()) ? Math.floor((Date.now() - dayStartMs(q.date)) / 1000) : 86_400
        const r = rangeOf(q.date, q.date)
        const sec = (iso: string) => Math.max(0, (Date.parse(iso) - dayStartMs(q.date)) / 1000)
        const segOf = async (id: string): Promise<Seg[]> => (await api.U12(id, r).catch(() => []))
          .map((s) => ({ state: s.status as StateCode, from: sec(s.startAt), to: s.endAt ? Math.min(until, sec(s.endAt)) : until }))
        const all = await api.C05()
        // 공장: 라인마다 설비 6대를 합친 대표 상태 (11/20, 예전엔 비어 있었음)
        if (!q.lineId) {
          const rows = await Promise.all(LINES.map(async (l) => ({
            key: l, label: `${l}라인`,
            segments: worstOf(await Promise.all(all.filter((e) => e.lineId === l).map((e) => segOf(e.equipmentId))), until),
          })))
          return { date: q.date, until, rows }
        }
        // 라인이면 그 라인 설비, 도장·출고면 그 공정 설비 (PT·VI는 lineId가 없어서 공정으로 찾음)
        const proc = areaProcess(q.lineId)
        const eqs = all.filter((e) => (proc ? e.process === proc : e.lineId === q.lineId) && (!q.process || e.process === q.process))
        const rows = await Promise.all(eqs.map(async (e) => ({ key: e.equipmentId, label: equipmentOf(e).shortName, segments: await segOf(e.equipmentId) })))
        return { date: q.date, until, rows }
      },
      async getHistory(q) {
        // 손볼 건 거르기는 백엔드 조건이 없다 → 다 불러 거른 뒤 50건씩 나눈다
        if (q.todo) {
          const all = (await historyAll(q)).filter(isTodo[q.todo])
          return { items: all.slice((q.page - 1) * 50, q.page * 50), total: all.length, page: q.page, size: 50 }
        }
        const p = await api.U08({
          from: q.from, to: q.to,
          lineId: q.lineId, process: q.process as ProcessId | undefined, status: q.states.length ? q.states.join(',') : undefined, reasonCode: q.code, inProgress: q.ongoing,
          minMinutes: q.minMinutes ?? 1, page: q.page, size: 50,
        })
        return { ...p, items: p.items.map(eventOf) }
      },
      getHistorySummary: async (q) => summarize(await historyAll({ ...q, states: ['D', 'I', 'S'] }), Date.now()),
      getRiskHistory: async (q) => ({ items: [], total: 0, page: q.page, size: 50 }),
      // 일일 생산 리포트 (11/19): 전용 API 없이 있는 API를 모아서 만든다
      //  목표 G-02 · 실적·불량 M-07(라인별, 공정별은 라인 6개 합) · OEE U-01 · 라인 OEE U-04 · 비가동 U-07 · 재공 M-13 + 코일 M-16(오늘만)
      async getDailyReport(date) {
        const r = { from: date, to: date }
        const isToday = date === dateOf(Date.now())
        const [counts, plans, util, byLine, down, wip, coil, perLine] = await Promise.all([
          api.M07({ date, groupBy: 'line' }),
          api.G02(r).catch(() => []),
          api.U01(r).catch(() => null),
          api.U04(r).catch(() => []),
          api.U07({ ...r, minMinutes: 1 }).catch(() => null),
          isToday ? api.M13().catch(() => []) : Promise.resolve([]),
          isToday ? api.M16({ date }).catch(() => null) : Promise.resolve(null),
          Promise.all(LINES.map((l) => api.M07({ date, lineId: l, groupBy: 'line' }).catch(() => null))),
        ])
        const round1 = (n: number) => Math.round(n * 10) / 10
        const target = plans.length ? plans.reduce((a, p) => a + p.planQty, 0) : null
        const lines = LINES.map((l) => {
          const plan = plans.find((p) => p.lineId === l)?.planQty ?? null
          const g = counts.byGroup.find((x) => x.key === l)
          const done = g?.good ?? 0
          return { lineId: l as LineId, plan, done, rate: plan ? round1((done / plan) * 100) : null, oee: byLine.find((x) => x.lineId === l)?.oee ?? null, ng: g ? g.ng : null }
        })
        const proc = (process: 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING') => perLine.reduce(
          (a, c) => {
            const x = c?.byProcess?.find((p) => p.process === process)
            return { output: a.output + (x?.produced ?? 0), ng: a.ng + (x?.ng ?? 0) }
          }, { output: 0, ng: 0 })
        const processes = [
          ...(['SLITTING', 'PRESS', 'WELDING', 'PAINTING'] as const).map((p) => ({ process: p, ...proc(p) })),
          { process: 'INSPECTION' as const, output: counts.inspected, ng: counts.ngVision },
        ]
        const stateOfCode = (c: string): StopState => CODES.find((x) => x.code === c)?.state ?? 'S'
        return {
          date, closed: !isToday,
          at: isToday ? isoLocal(Date.now()) : isoLocal(dayStartMs(date) + 86_400_000),
          target, done: counts.ok, rate: target ? round1((counts.ok / target) * 100) : null,
          oee: { oee: util?.oee ?? null, availability: util?.availability ?? null, performance: util?.performance ?? null, quality: util?.quality ?? null },
          ngTotal: counts.processNg + counts.ngVision,
          lines, processes,
          downtime: (down?.byReason ?? []).filter((x) => x.count > 0)
            .map((x) => ({ code: x.reasonCode as DowntimeCode, state: stateOfCode(x.reasonCode), sec: Math.round(x.minutes * 60), count: x.count }))
            .sort((a, b) => b.sec - a.sec),
          // 재공은 "지금" 값만 있어서 오늘만 (지난 날 마감 재공은 기록이 없음)
          wip: [
            ...(coil ? [{ from: 'COIL' as const, to: 'SLITTING' as const, qty: coil.stockRolls, unit: 'roll' as const }] : []),
            ...wip.filter((w) => w.process !== 'COIL').map((w) => ({ from: w.process as ProcessId, to: w.nextProcess as ProcessId, qty: w.wipQty, unit: 'ea' as const })),
          ],
        }
      },
      // 계획수정 보고서: R-01 목록 · R-02 내용 (11/19)
      async getReplanReports(from, to) {
        const p = await api.R01({ from, to, page: 1, size: 100 })
        return p.items.map((r) => ({ id: String(r.reportId), createdAt: r.createdAt, equipmentId: r.equipmentId, code: r.code as DowntimeCode, stateEventId: String(r.downtimeId) }))
      },
      async getReplanReport(id) {
        try {
          return replanOf(await api.R02(Number(id)))
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return null
          throw e
        }
      },
      getReplanPdf: async () => null,
      // 사용자 관리 C-02 (11/20)
      async getUsers() {
        const list = await api.C02({ page: 0, size: 100 })
        return list.map((u) => ({ loginId: u.loginId, name: u.userName, role: u.role, email: u.email ?? null, memo: u.memo ?? null, lastLoginAt: u.lastLoginAt ? `${u.lastLoginAt.slice(0, 19)}+09:00` : null }))
      },
      async getTargets(from, to) {
        // 목표 = 라인 계획 합(G-02), 실적 = 그날 출고 양품(G-01 unit=day, 오늘까지), 수정자 = 그날 마지막으로 저장한 사람 (11/20)
        const today = dateOf(Date.now())
        const [plans, actual] = await Promise.all([
          api.G02({ from, to }),
          from <= today ? api.G01({ from, to: to < today ? to : today, unit: 'day' }).catch(() => []) : Promise.resolve([]),
        ])
        const dates = [...new Set(plans.map((p) => p.date))].sort().reverse()
        return dates.map((d) => {
          const day = plans.filter((p) => p.date === d)
          const last = [...day].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]
          const rows = actual.filter((a) => a.period === d)
          return {
            date: d, quantity: day.reduce((a, p) => a + p.planQty, 0),
            done: d <= today ? rows.reduce((a, r) => a + r.actualQty, 0) : null,
            updatedBy: last?.updatedBy ?? null,
          }
        })
      },
      async getControlLimits(equipmentId) {
        const type = typeById.get(equipmentId) ?? 'press'
        return (await api.M10({ equipmentId })).map((t) => limitOf(t, type))
      },
      async getProductionSummary(q) {
        const { first, last } = periodRange(q.period, q.date)
        const r = rangeOf(first, last)
        const total = (result?: 'NG' | 'IN_PROGRESS') => api.P01({ ...r, lineId: q.lineId, result, page: 1, size: 1 }).then((p) => p.total).catch(() => null)
        const ngOf = (process: string) => api.P03({ ...r, lineId: q.lineId, process, page: 1, size: 1 }).then((p) => p.total).catch(() => 0)
        const [sum, counts, yieldTrend, hourly, input, wip, ng, ngProc] = await Promise.all([
          api.G01({ ...r, unit: 'day', lineId: q.lineId }).catch(() => []), api.M07({ date: q.date, lineId: q.lineId, groupBy: 'line' }), api.U11({ ...r, unit: 'day' }).catch(() => []),
          q.period === 'day' ? hourlyOf(q.date, q.lineId).catch(() => null) : Promise.resolve(null),
          total(), total('IN_PROGRESS'), total('NG'),
          Promise.all((['SLITTING', 'PRESS', 'WELDING', 'PAINTING'] as const).map(async (p) => [p, await ngOf(p)] as const)),
        ])
        // 공정별 불량 = P-03 건수, 출고 비전 불량 = 전체 불량(P-01 NG) - 공정 불량 (투입 시각 기준 기간, 11/19)
        const processNg = ngProc.reduce((a, [, n]) => a + n, 0)
        const ngByProcess: Partial<Record<ProcessId, number>> = Object.fromEntries(ngProc)
        ngByProcess.INSPECTION = Math.max(0, (ng ?? processNg) - processNg)
        const plan = sum.length ? sum.reduce((a, s) => a + s.planQty, 0) : null
        const done = sum.length ? sum.reduce((a, s) => a + s.actualQty, 0) : counts.ok
        return {
          from: r.from, to: r.to, plan, done, rate: plan ? Math.round((done / plan) * 1000) / 10 : null,
          input: input ?? counts.total, wip: wip ?? 0,
          ngByProcess,
          byLine: LINES.map((l) => ({ lineId: l, plan: sum.filter((s) => s.lineId === l).reduce((a, s) => a + s.planQty, 0) || null, done: sum.filter((s) => s.lineId === l).reduce((a, s) => a + s.actualQty, 0) })),
          // 일: G-01 unit=hour 시간대별 누적 (x = 그 시간이 끝난 시각). 주·월 일별 추이는 아직 비움
          trend: (hourly?.hours ?? []).map((h) => ({ x: h.hour + 1, label: `${pad(h.hour + 1)}시`, done: h.cumulative, plan: h.planCumulative })), trendKind: q.period === 'day' ? 'hourly' : 'daily',
          yieldRate: counts.yieldRate,
          yieldTrend: yieldTrend.map((y) => ({ date: y.period, label: `${Number(y.period.slice(5, 7))}/${Number(y.period.slice(8, 10))}`, total: y.total, good: y.good, rate: y.yieldRate })),
        }
      },
      // 생산 조회: P-01 목록 (진행 중은 M-17 위치로 지금 공정 표시), 제품 ID 검색·공정별 기록은 P-02 (11/19)
      async getProducts(q) {
        const page = q.page ?? 1
        if (q.q) {
          try {
            const d = productDetailOf(await api.P02(q.q))
            return { items: [d], total: 1, page: 1, size: 50 }
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) return { items: [], total: 0, page: 1, size: 50 }
            throw e
          }
        }
        const { first, last } = periodRange(q.period, q.date)
        const result = q.result === 'ok' ? 'OK' as const : q.result === 'ng' ? 'NG' as const : q.result === 'wip' ? 'IN_PROGRESS' as const : undefined
        const needPos = q.result !== 'ok' && q.result !== 'ng'
        const [p, pos] = await Promise.all([
          api.P01({ ...rangeOf(first, last), lineId: q.lineId, result, page, size: 50 }),
          needPos ? api.M17().catch(() => null) : Promise.resolve(null),
        ])
        const where = new Map((pos?.products ?? []).map((x) => [x.productId, processAt(x)]))
        return { ...p, items: p.items.map((r) => productOf(r, where.get(r.productId))) }
      },
      async getProduct(productId) {
        try {
          return productDetailOf(await api.P02(productId))
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return null
          throw e
        }
      },
      getRisks: async () => [],
      getPdmEta: async () => null,
    },
    cmd: {
      async login(userId, password) {
        try {
          const r = await api.C01({ loginId: userId, password })
          token.set(r.accessToken)
          return { ok: true, name: r.userName }
        } catch (e) {
          // 401(LOGIN_FAILED)만 아이디·비밀번호 오류. 서버가 꺼졌거나 다른 오류는 던져서 화면이 다른 문구를 보여 준다
          if (e instanceof ApiError && e.status === 401) return { ok: false }
          throw e
        }
      },
      logout: async () => { token.set(null) },
      async saveActionMemo(eventId, memo) {
        // 조치 담당자 번호(actionUserId)는 로그인 응답에 없어서 보내지 않는다 (백엔드 확인 필요)
        // U-09 응답은 바뀐 뒤의 비가동 1건 (U-08 items[]와 같은 모양, 11/19 백엔드 변경)
        return eventOf(await api.U09(Number(eventId), { memo: memo.trim() }))
      },
      // R-03: 고장 건(비가동 eventId = downtimeId)으로 AI 보고서 만들기. 누를 때마다 새 보고서 (추가 요청을 바꿔 다시 만들 수 있게)
      createReplanReport: async (stateEventId, additionalRequest) => replanOf(await api.R03(Number(stateEventId), additionalRequest?.trim() || undefined)),
      async createUser(u) {
        try {
          return { ok: true, value: await api.C03({ loginId: u.loginId, password: u.password, userName: u.name, role: u.role, email: u.email || undefined, memo: u.memo || undefined }) }
        } catch (e) { return fail(e) }
      },
      async saveTarget(date, quantity) {
        // 공장 목표 → 라인별 계획(G-03)으로 나눠 저장 (D-87: 라인 계획 = 목표 ÷ 6)
        // 몫을 모든 라인에, 나머지는 앞 라인부터 1개씩 → 합이 입력값과 같다 (1000 → 167·167·167·167·166·166)
        const each = Math.floor(quantity / LINES.length)
        const rest = quantity % LINES.length
        const results = await Promise.allSettled(LINES.map((l, i) => api.G03(date, { lineId: l, planQty: each + (i < rest ? 1 : 0) })))
        const failed = LINES.filter((_, i) => results[i].status === 'rejected')
        if (failed.length) return { ok: false, error: `${failed.map((l) => `${l}라인`).join(', ')} 계획을 저장하지 못했습니다` }
        return { ok: true, value: { date, quantity, done: null, updatedBy: null } }
      },
      async setPaintRoute(lineId, paintId, reason) {
        try { return { ok: true, value: await api.M09(lineId, { paintId, reason }) } } catch (e) { return fail(e) }
      },
      async saveControlLimits(equipmentId, rows) {
        try {
          const now = await api.M10({ equipmentId })
          for (const r of rows) {
            const t = now.find((x) => x.metric === r.item)
            if (t) await api.M11(t.id, { low: r.lower, high: r.upper })
          }
          const type = typeById.get(equipmentId) ?? 'press'
          return { ok: true, value: (await api.M10({ equipmentId })).map((t) => limitOf(t, type)) }
        } catch (e) { return fail(e) }
      },
    },
  }
}
