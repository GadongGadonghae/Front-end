// 데모 데이터 공급기: contracts.ts의 DataSource를 프론트 안에서 흉내 낸다.
// Vue를 모르는 순수 TypeScript (FRONTEND.md 2장). 1초 타이머는 구독자가 있을 때만 돈다.
import type { DataSource, Unsubscribe } from '@/data/contracts'
import type { EquipmentLive, PlantSnapshot, ProductMove } from '@/types/live'
import type { AlarmEvent, StateEvent } from '@/types/events'
import { MASTER } from '@/data/mock/master'
import { CURRENT_STATES, INBOUND, LINE_DONE, PAST_STATES, PDM, RUN_AGO_SEC } from '@/data/mock/scenario'

const TICK_MS = 1000
/** 라인 CT 120초 [가정] → 1초에 1/120 확률로 라인 실적 +1 (데모) */
const LINE_DONE_PER_SEC = 1 / 120

const iso = (ms: number) => new Date(ms).toISOString()

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
  const lineDone = { ...LINE_DONE }
  const inbound = { ...INBOUND }

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

  // ── 구독 ──
  const snapshotSubs = new Set<(s: PlantSnapshot) => void>()
  const moveSubs = new Set<(m: ProductMove) => void>()
  const alarmSubs = new Set<(a: AlarmEvent) => void>()
  let timer: ReturnType<typeof setInterval> | null = null

  const snapshot = (): PlantSnapshot => ({
    at: iso(now()),
    equipment: [...live.values()].map((e) => ({ ...e, pdm: e.pdm && { ...e.pdm } })),
    lines: Object.entries(lineDone).map(([lineId, done]) => ({ lineId: lineId as PlantSnapshot['lines'][number]['lineId'], done })),
    inbound: { ...inbound },
  })

  const tick = () => {
    for (const lineId of Object.keys(lineDone)) {
      const rate = lineId === 'PT' ? LINE_DONE_PER_SEC * 6 : LINE_DONE_PER_SEC
      // 고장 라인(L2)은 멈춰 있다
      if (lineId !== 'L2' && Math.random() < rate) lineDone[lineId] += 1
    }
    const s = snapshot()
    snapshotSubs.forEach((cb) => cb(s))
  }

  const ensureTimer = () => {
    const anyone = snapshotSubs.size + moveSubs.size + alarmSubs.size > 0
    if (anyone && !timer) timer = setInterval(tick, TICK_MS)
    if (!anyone && timer) { clearInterval(timer); timer = null }
  }

  const subscribe = <T>(set: Set<T>, cb: T): Unsubscribe => {
    set.add(cb)
    ensureTimer()
    return () => { set.delete(cb); ensureTimer() }
  }

  return {
    demo: true,
    live: {
      onSnapshot(cb) {
        const off = subscribe(snapshotSubs, cb)
        cb(snapshot())
        return off
      },
      onProductMove: (cb) => subscribe(moveSubs, cb),
      onAlarm: (cb) => subscribe(alarmSubs, cb),
    },
    q: {
      getMaster: async () => MASTER,
      getTodayStateEvents: async (filter) => {
        const area = filter?.area
        const inArea = (id: string) => !area || MASTER.equipment.find((e) => e.id === id)?.area === area
        return events.filter((e) => inArea(e.equipmentId)).map((e) => ({ ...e }))
      },
    },
    cmd: {
      // 데모 계정: 아이디·비밀번호 아무거나 비어 있지 않으면 통과 (실제 계정은 백엔드, DT-008)
      login: async (userId, password) => (userId && password ? { ok: true, name: '김현수' } : { ok: false }),
      logout: async () => {},
    },
  }
}
