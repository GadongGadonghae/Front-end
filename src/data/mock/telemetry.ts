// 데모 관리값: 같은 시각이면 늘 같은 값이 나오는 함수로 만든다 → 처음 조회한 추이와 실시간 값이 이어진다
// 멈춘 동안(R이 아닌 구간)은 점이 없다. 값과 모양은 데모용 (CLAUDE.md)
import type { EquipmentLive } from '@/types/live'
import type { StateEvent } from '@/types/events'
import type { Equipment, EquipmentTypeCode } from '@/types/plant'
import type { InverterStatus, MicrostopToday, TelemetryItem, TelemetryRange, TelemetrySeries, TelemetryTick } from '@/types/process'
import { MASTER } from '@/data/mock/master'
import { INVERTER_LAST_TRIP, TELEMETRY_BASE, TELEMETRY_RAMPS } from '@/data/mock/scenario'
import { dayStart, hash, localDate, noise } from '@/data/mock/rand'

/** 수집 주기(초): 슬리터 1초, 도장 5초, 프레스·용접 사이클마다 = 표준CT 120초 [가정] (API 명세 3.1). 비전은 관리값 없음 (D-51) */
export const CADENCE_SEC: Record<EquipmentTypeCode, number> = { slitter: 1, painter: 5, press: 120, welder: 120, vision: 0 }
/** 한 번에 보내는 점 수 상한 (긴 구간은 성기게) */
const MAX_POINTS = 360
const RANGE_SEC: Record<Exclude<TelemetryRange, 'today'>, number> = { '1h': 3600, '8h': 8 * 3600 }
/** 슬리팅 미세정지 후보: 10분 창마다 30% 확률로 15~55초 출력 저하 (데모) */
const MS_WINDOW = 600

interface Ctx {
  now: () => number
  live: Map<string, EquipmentLive>
  events: () => StateEvent[]
}

type ItemDef = Omit<TelemetryItem, 'points'>

const iso = (sec: number) => new Date(sec * 1000).toISOString()
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function createTelemetry(ctx: Ctx) {
  const eqOf = (id: string) => MASTER.equipment.find((e) => e.id === id)

  function itemsOf(e: Equipment): ItemDef[] {
    const defs = MASTER.controlLimits.filter((l) => l.type === e.type).map((l): ItemDef => ({ item: l.item, unit: l.unit, lower: l.lower, upper: l.upper }))
    // 슬리팅 속도 그래프 (SCR-002-2 3번)
    if (e.type === 'slitter') defs.push({ item: '지령 주파수', unit: 'Hz', lower: null, upper: null }, { item: '출력 주파수', unit: 'Hz', lower: null, upper: null })
    return defs
  }

  /** 그 시각에 멈춰 있었는지 */
  function stopped(e: Equipment, t: number): boolean {
    const l = ctx.live.get(e.id)
    if (l && l.state !== 'R' && t * 1000 >= Date.parse(l.since)) return true
    return ctx.events().some((ev) => ev.equipmentId === e.id && ev.end && t * 1000 >= Date.parse(ev.start) && t * 1000 < Date.parse(ev.end))
  }

  /** 슬리팅 미세정지 후보 구간 [from, to) (초) */
  function bandsBetween(e: Equipment, from: number, to: number): [number, number][] {
    const out: [number, number][] = []
    for (let w = Math.floor(from / MS_WINDOW); w * MS_WINDOW < to; w++) {
      if (noise('ms', e.id, w) >= 0.3) continue
      const s = w * MS_WINDOW + Math.floor(noise('ms-at', e.id, w) * 540)
      const band: [number, number] = [s, s + 15 + Math.floor(noise('ms-len', e.id, w) * 40)]
      if (band[1] > from && band[0] < to && !stopped(e, band[0])) out.push(band)
    }
    return out
  }

  function valueAt(e: Equipment, def: ItemDef, t: number): number {
    const base = TELEMETRY_BASE[def.item]
      ?? (def.lower != null && def.upper != null ? { center: (def.lower + def.upper) / 2, amp: (def.upper - def.lower) * 0.05 } : { center: 50, amp: 1 })
    if (def.item === '지령 주파수') return base.center
    const k = hash(e.id, def.item)
    const slow = Math.sin((t / 1800) * Math.PI * 2 + (k % 628) / 100) * 0.5 + Math.sin(t / 420 + (k % 97)) * 0.25
    let v = base.center + base.amp * (slow + (noise(k, Math.floor(t)) - 0.5) * 0.6)

    if (def.item === '출력 주파수' && bandsBetween(e, t, t + 1).length) v = 60 - 4 - noise('dip', k, Math.floor(t)) * 4

    // 예지보전 주의·위험 항목: 최근 40분 동안 상한 쪽으로 오른다
    const pdm = ctx.live.get(e.id)?.pdm
    if (pdm && pdm.item === def.item) {
      const top = (def.upper ?? base.center + base.amp * 6) - base.center
      v += top * (pdm.percent / 100) * 0.8 * clamp01((t - (ctx.now() / 1000 - 2400)) / 2400)
    }
    // 지금 고장과 이어진 이탈: 고장 시각에 to가 된다
    const ramp = TELEMETRY_RAMPS.find((r) => r.equipmentId === e.id && r.item === def.item)
    const l = ctx.live.get(e.id)
    if (ramp && l && l.state === 'D') {
      const end = Date.parse(l.since) / 1000
      v += (ramp.to - base.center) * clamp01((t - (end - ramp.rampSec)) / ramp.rampSec) ** 2
    }
    const digits = Math.abs(base.center) < 10 ? 100 : 10
    return Math.round(v * digits) / digits
  }

  function series(equipmentId: string, range: TelemetryRange): TelemetrySeries {
    const e = eqOf(equipmentId)
    const cad = e ? CADENCE_SEC[e.type] : 0
    if (!e || !cad) return { equipmentId, range, items: [] }
    const end = Math.floor(ctx.now() / 1000)
    const start = range === 'today' ? dayStart(localDate(ctx.now())) / 1000 : end - RANGE_SEC[range]
    const step = Math.max(cad, Math.ceil((end - start) / MAX_POINTS / cad) * cad)
    const ts: number[] = []
    for (let t = Math.ceil(start / step) * step; t <= end; t += step) if (!stopped(e, t)) ts.push(t)
    // 고장으로 멈춘 설비: 멈추기 직전 마지막 사이클 값(이탈 값)을 넣는다
    const l = ctx.live.get(e.id)
    const last = l && l.state !== 'R' ? Math.floor(Date.parse(l.since) / 1000) - 1 : null
    if (last != null && last >= start && !ts.includes(last)) ts.push(last)
    return {
      equipmentId, range,
      items: itemsOf(e).map((def) => ({ ...def, points: ts.map((t) => ({ t: iso(t), value: valueAt(e, def, t) })) })),
    }
  }

  /** 실시간 새 값 1개. 멈춰 있으면 null */
  function tick(equipmentId: string): TelemetryTick | null {
    const e = eqOf(equipmentId)
    const t = Math.floor(ctx.now() / 1000)
    if (!e || !CADENCE_SEC[e.type] || stopped(e, t)) return null
    return { equipmentId, values: itemsOf(e).map((def) => ({ t: iso(t), item: def.item, value: valueAt(e, def, t) })) }
  }

  /** 미세정지 [차순위]: 슬리팅은 출력 저하 구간, 나머지는 데모 횟수 */
  function microstops(equipmentId: string): MicrostopToday {
    const e = eqOf(equipmentId)
    if (!e || e.type === 'vision') return { equipmentId, count: 0, lossSec: 0, bands: [] }
    const now = ctx.now() / 1000
    const from = dayStart(localDate(ctx.now())) / 1000
    if (e.type === 'slitter') {
      const bands = bandsBetween(e, from, now)
      return {
        equipmentId, count: bands.length, lossSec: bands.reduce((a, [s, t]) => a + (t - s), 0),
        bands: bands.map(([s, t]) => ({ from: iso(s), to: iso(t) })),
      }
    }
    const elapsed = (now - from) / 86400
    const count = Math.round((10 + noise('ms-n', e.id) * 18) * elapsed)
    return { equipmentId, count, lossSec: count * (8 + Math.floor(noise('ms-s', e.id) * 9)), bands: [] }
  }

  /** 실설비 슬리터 인버터 (D-43) */
  function inverter(equipmentId: string): InverterStatus | null {
    const e = eqOf(equipmentId)
    if (!e?.real) return null
    const running = ctx.live.get(e.id)?.state === 'R'
    const out = running ? valueAt(e, { item: '출력 주파수', unit: 'Hz', lower: null, upper: null }, Math.floor(ctx.now() / 1000)) : 0
    return {
      running, direction: running ? 'forward' : null, commandHz: running ? 60 : 0, outputHz: out, rpm: Math.round(out * 30),
      lastTrip: { name: INVERTER_LAST_TRIP.name, at: new Date(ctx.now() - INVERTER_LAST_TRIP.agoSec * 1000).toISOString(), recoveredAfterSec: INVERTER_LAST_TRIP.recoveredAfterSec },
    }
  }

  return { series, tick, microstops, inverter, cadenceOf: (id: string) => { const e = eqOf(id); return e ? CADENCE_SEC[e.type] : 0 } }
}
