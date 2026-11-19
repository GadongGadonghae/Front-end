// 실제 백엔드 어댑터: 화면 계약(contracts.ts)을 백엔드 엔드포인트(endpoints.ts, 명세 v3.1/v3.2)로 채운다.
// - 실시간은 STOMP 라이브러리 결정 전까지 REST 주기 조회로 대신한다 (상태 1초 M-01, 요약 10초, 알림 5초). 결정되면 W-01~04로 바꾼다
// - 백엔드에 아직 없는 기능(예지보전·제품 내역·시간대별 생산·리포트 등, docs/API-차이-v3.1.md)은 빈 값을 돌려준다 → 화면은 "데이터 없음"
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { ControlLimit, DowntimeCodeDef, Equipment, EquipmentType, EquipmentTypeCode, Line, LineId, MasterData, Process, ProcessId, ProductionLineId } from '@/types/plant'
import type { EquipmentLive, FlowPositions, PlantSnapshot, PlantSummary } from '@/types/live'
import type { AlarmEvent, HistoryEvent, StateEvent } from '@/types/events'
import type { TelemetryTick } from '@/types/process'
import type { DowntimeCode, StopState } from '@/types/state'
import type { OeeReport } from '@/types/analysis'
import type { DowntimeEventDto, EquipmentStatusDto, ThresholdDto } from '@/data/api/dto'
import { api } from '@/data/api/endpoints'
import { ApiError, token } from '@/data/api/http'

const SNAPSHOT_MS = 1000
const SUMMARY_MS = 10_000
const ALARM_MS = 5000
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
  { code: 'PL_SETUP', name: '코일·나이프 교체', state: 'S' }, { code: 'UP_SHORTAGE', name: '재공부족', state: 'I' }, { code: 'UP_DELAY', name: '작업지연', state: 'I' },
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
    const [u, counts, plans, byLine, wip] = await Promise.all([
      api.U01(r), api.M07({ groupBy: 'line' }), api.G02({ from: today, to: today }).catch(() => []), api.U04(r), api.M13(),
    ])
    const target = plans.length ? plans.reduce((a, p) => a + p.planQty, 0) : null
    const planOf = (l: string) => plans.find((p) => p.lineId === l)?.planQty ?? null
    return {
      at: isoLocal(Date.now()),
      plant: {
        target, done: counts.ok, rate: target ? Math.round((counts.ok / target) * 1000) / 10 : null,
        oee: { oee: u.oee, availability: u.availability, performance: u.performance, quality: u.quality },
        quality: {
          ngByProcess: Object.fromEntries((counts.byProcess ?? []).filter((p) => p.process !== 'INSPECTION').map((p) => [p.process, p.ng])),
          outbound: { inspected: counts.inspected, ok: counts.ok, ng: counts.ngVision, rate: counts.inspected ? Math.round((counts.ngVision / counts.inspected) * 1000) / 10 : null },
        },
      },
      lines: LINES.map((l) => {
        const done = counts.byGroup.find((g) => g.key === l)?.good ?? 0
        const plan = planOf(l)
        return {
          lineId: l, plan, done, rate: plan ? Math.round((done / plan) * 1000) / 10 : null,
          oee: byLine.find((x) => x.lineId === l)?.oee ?? null, ngByProcess: {},
          wip: wip.filter((w) => w.process !== 'COIL').map((w) => ({ from: w.process, to: w.nextProcess, qty: w.wipQty })),
        }
      }),
    }
  }

  async function todayEvents(q: { equipmentId?: string; lineId?: string } = {}): Promise<StateEvent[]> {
    const p = await api.U08({ ...todayRange(), ...q, minMinutes: 1, page: 1, size: 100 }) // 백엔드 size 최대 100
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
      getTodayStateEvents: async (filter) => todayEvents(filter?.area && filter.area !== 'PT' && filter.area !== 'VI' ? { lineId: filter.area } : {}),
      getTodayRiskEvents: async () => [],
      async getProcessToday(lineId, process) {
        const line = lineId === 'PT' ? undefined : lineId
        const [eqs, counts, wip, byProcess, cycles] = await Promise.all([api.M12(process, { lineId: line }), api.M07({ lineId: line }), api.M13({ lineId: line }), api.U03({ ...todayRange(), lineId: line }), api.M15(process, { lineId: line }).catch(() => [])])
        const p = counts.byProcess?.find((x) => x.process === process)
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
      async getInspectionsToday(process, lineId) {
        const counts = await api.M07({ lineId })
        if (process === 'INSPECTION') {
          const ng = await api.M08({ ...todayRange(), lineId, result: 'NG', page: 1, size: 50 })
          return {
            lineId: lineId ?? null, process, inspected: counts.inspected, ng: counts.ngVision, rate: counts.inspected ? Math.round((counts.ngVision / counts.inspected) * 1000) / 10 : null,
            defects: ng.items.map((i) => ({ t: i.inspectedAt, productId: i.productId, equipmentId: 'VI', reason: '비전 검사 불량' })),
          }
        }
        const p = counts.byProcess?.find((x) => x.process === process)
        // 공정 불량 제품 목록(제품 ID·사유): API 없음 (요청 중)
        return { lineId: lineId ?? null, process, inspected: p?.produced ?? 0, ng: p?.ng ?? 0, rate: p?.produced ? Math.round(((p.ng ?? 0) / p.produced) * 1000) / 10 : null, defects: [] }
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
        const line = q.lineId && q.lineId !== 'PT' && q.lineId !== 'VI' ? q.lineId : undefined
        const [u, down, trend] = await Promise.all([
          api.U01({ ...r, lineId: line }), api.U07({ ...r, minMinutes: 1 }),
          q.period === 'day' ? Promise.resolve([]) : api.U02({ ...r, unit: 'day', lineId: line }),
        ])
        let bars: OeeReport['bars']
        if (!q.lineId) bars = (await api.U04(r)).map((x) => ({ key: x.lineId, label: `${x.lineId}라인`, oee: x.oee ?? null }))
        else if (!q.process) bars = (await api.U03({ ...r, lineId: line })).map((x) => ({ key: x.process, label: PROCESSES.find((p) => p.id === x.process)?.name ?? x.process, oee: x.oee }))
        else bars = (await api.U05({ ...r, lineId: line, process: q.process as ProcessId }).catch(() => [])).map((x) => ({ key: x.equipmentId, label: x.equipmentId, oee: x.oee ?? null }))
        return {
          query: q, from: r.from, to: r.to,
          oee: { oee: u.oee, availability: u.availability, performance: u.performance, quality: u.quality },
          lineYield: q.process || q.equipmentId ? null : (u.lineYield ?? null),
          bars,
          downtime: down.byReason.map((d) => ({ code: d.reasonCode, state: stateOfCode(d.reasonCode), sec: d.minutes * 60, count: d.count })),
          daily: trend.map((t) => ({ date: t.period, oee: t.oee ?? null })),
        }
      },
      async getStateTimeline(q) {
        const until = q.date === dateOf(Date.now()) ? Math.floor((Date.now() - dayStartMs(q.date)) / 1000) : 86_400
        // 라인 대표 상태로 합친 타임라인 API는 없음 (요청 중) → 라인을 골랐을 때만 설비별로
        if (!q.lineId) return { date: q.date, until, rows: [] }
        const eqs = (await api.C05({ lineId: q.lineId })).filter((e) => !q.process || e.process === q.process)
        const r = rangeOf(q.date, q.date)
        const rows = await Promise.all(eqs.map(async (e) => {
          const h = await api.U12(e.equipmentId, r).catch(() => [])
          const sec = (iso: string) => Math.max(0, (Date.parse(iso) - dayStartMs(q.date)) / 1000)
          return { key: e.equipmentId, label: equipmentOf(e).shortName, segments: h.map((s) => ({ state: s.status, from: sec(s.startAt), to: s.endAt ? Math.min(until, sec(s.endAt)) : until })) }
        }))
        return { date: q.date, until, rows }
      },
      async getHistory(q) {
        const p = await api.U08({
          from: q.from, to: q.to,
          lineId: q.lineId, process: q.process as ProcessId | undefined, status: q.states.join(','), reasonCode: q.code, inProgress: q.ongoing,
          minMinutes: q.minMinutes ?? 1, page: q.page, size: 50,
        })
        return { ...p, items: p.items.map(eventOf) }
      },
      getRiskHistory: async (q) => ({ items: [], total: 0, page: q.page, size: 50 }),
      // 차순위 (리포트·예지보전·제품 내역): 백엔드 없음
      getDailyReport: async () => { throw new Error('일일 생산 리포트는 차순위: 백엔드 API 없음') },
      getReplanReports: async () => [],
      getReplanReport: async () => null,
      getReplanPdf: async () => null,
      async getTargets(from, to) {
        const plans = await api.G02({ from, to })
        const dates = [...new Set(plans.map((p) => p.date))].sort().reverse()
        return dates.map((d) => ({ date: d, quantity: plans.filter((p) => p.date === d).reduce((a, p) => a + p.planQty, 0), done: null, updatedBy: null }))
      },
      async getControlLimits(equipmentId) {
        const type = typeById.get(equipmentId) ?? 'press'
        return (await api.M10({ equipmentId })).map((t) => limitOf(t, type))
      },
      async getProductionSummary(q) {
        const { first, last } = periodRange(q.period, q.date)
        const r = rangeOf(first, last)
        const [sum, counts, yieldTrend, hourly] = await Promise.all([
          api.G01({ ...r, unit: 'day', lineId: q.lineId }).catch(() => []), api.M07({ date: q.date, lineId: q.lineId, groupBy: 'line' }), api.U11({ ...r, unit: 'day' }).catch(() => []),
          q.period === 'day' ? hourlyOf(q.date, q.lineId).catch(() => null) : Promise.resolve(null),
        ])
        const plan = sum.length ? sum.reduce((a, s) => a + s.planQty, 0) : null
        const done = sum.length ? sum.reduce((a, s) => a + s.actualQty, 0) : counts.ok
        return {
          from: r.from, to: r.to, plan, done, rate: plan ? Math.round((done / plan) * 1000) / 10 : null,
          input: counts.total, wip: 0,
          ngByProcess: Object.fromEntries((counts.byProcess ?? []).map((p) => [p.process, p.ng])),
          byLine: LINES.map((l) => ({ lineId: l, plan: sum.filter((s) => s.lineId === l).reduce((a, s) => a + s.planQty, 0) || null, done: sum.filter((s) => s.lineId === l).reduce((a, s) => a + s.actualQty, 0) })),
          // 일: G-01 unit=hour 시간대별 누적 (x = 그 시간이 끝난 시각). 주·월 일별 추이는 아직 비움
          trend: (hourly?.hours ?? []).map((h) => ({ x: h.hour + 1, label: `${pad(h.hour + 1)}시`, done: h.cumulative, plan: h.planCumulative })), trendKind: q.period === 'day' ? 'hourly' : 'daily',
          yieldRate: counts.yieldRate,
          yieldTrend: yieldTrend.map((y) => ({ date: y.period, label: `${Number(y.period.slice(5, 7))}/${Number(y.period.slice(8, 10))}`, total: y.total, good: y.good, rate: y.yieldRate })),
        }
      },
      getProducts: async (q) => ({ items: [], total: 0, page: q.page ?? 1, size: 50 }),
      getProduct: async () => null,
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
      createReplanReport: async () => { throw new Error('계획수정 보고서는 백엔드가 자동으로 만든다 (R-01)') },
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
