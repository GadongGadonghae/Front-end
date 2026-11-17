// 데모 제품 (DT-021): 하루·라인마다 제품을 만들고, 공정 생산·검사 불량·생산 조회를 모두 같은 제품에서 센다 → 화면끼리 수가 맞는다
// 오늘은 지금 라인 실적·재공(scenario)에 맞추고, 지난 날은 난수로 만든다. 값은 데모용 (CLAUDE.md)
import type { LineId, ProcessId } from '@/types/plant'
import type { Product, ProductDetail, StepResult } from '@/types/production'
import type { EquipmentLive } from '@/types/live'
import { LINE_DETAIL, NG_OVERRIDES, OUTBOUND_NG_BY_LINE, PAINT_NG_BY_LINE, PAST_LINE_DONE } from '@/data/mock/scenario'
import { between, dayStart, hash, localDate, rng } from '@/data/mock/rand'

export const PRODUCTION_LINES: LineId[] = ['A', 'B', 'C', 'D', 'E', 'F']
/** 제품이 지나는 공정 (입고 A는 제품 ID 발급 전) */
export const STEPS: ProcessId[] = ['SLITTING', 'PRESS', 'WELDING', 'PAINTING', 'INSPECTION']
/** 제품 내역은 90일까지 (D-86) */
export const KEEP_DAYS = 90

type NgProcess = 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING' | 'INSPECTION'
type WipProcess = 'PRESS' | 'WELDING' | 'PAINTING'

/** 하루·라인 수량 */
export interface DayCounts {
  done: number
  ng: Record<NgProcess, number>
  /** 그 공정에 와 있는(기다리거나 작업 중) 제품 */
  wip: Record<WipProcess, number>
}

/** 투입 뒤 공정마다 끝나는 시각(분) [데모]: 슬리팅 4 · 프레스 14 · 용접 22 · 도장 56 · 출고 62 */
const STEP_END_MIN: Record<ProcessId, number> = { COIL: 0, SLITTING: 4, PRESS: 14, WELDING: 22, PAINTING: 56, INSPECTION: 62 }
const STEP_START_MIN: Record<ProcessId, number> = { COIL: 0, SLITTING: 0, PRESS: 6, WELDING: 18, PAINTING: 26, INSPECTION: 60 }
const PRESS_ITEMS = ['압력(좌)', '압력(우)', '압력 합계', '프레스 시간']
const WELD_ITEMS = ['전류', '전압', '통전시간']

interface Ctx {
  now: () => number
  lineDone: Record<string, number>
  live: Map<string, EquipmentLive>
}

export function createProducts(ctx: Ctx) {
  const past = new Map<string, ProductDetail[]>()
  const today = () => localDate(ctx.now())

  function counts(date: string, lineId: LineId): DayCounts | null {
    if (date > today()) return null
    if (date === today()) {
      const d = LINE_DETAIL[lineId]
      const paintWip = LINE_DETAIL.PT.wip[0]
      return {
        done: ctx.lineDone[lineId],
        ng: { SLITTING: d.ng.SLITTING ?? 0, PRESS: d.ng.PRESS ?? 0, WELDING: d.ng.WELDING ?? 0, PAINTING: PAINT_NG_BY_LINE[lineId] ?? 0, INSPECTION: OUTBOUND_NG_BY_LINE[lineId] ?? 0 },
        wip: { PRESS: d.wip[0], WELDING: d.wip[1], PAINTING: PRODUCTION_LINES.indexOf(lineId) < paintWip ? 1 : 0 },
      }
    }
    const r = rng(hash('day', date, lineId))
    return {
      done: between(r, PAST_LINE_DONE.min, PAST_LINE_DONE.max),
      ng: { SLITTING: between(r, 2, 10), PRESS: between(r, 6, 22), WELDING: between(r, 3, 15), PAINTING: between(r, 1, 6), INSPECTION: between(r, 3, 12) },
      wip: { PRESS: 0, WELDING: 0, PAINTING: 0 },
    }
  }

  function build(date: string, lineId: LineId): ProductDetail[] {
    const c = counts(date, lineId)
    if (!c) return []
    const r = rng(hash('products', date, lineId))
    // 끝난 제품(양품·불량)을 섞고, 재공은 가장 최근 투입으로 뒤에 둔다 (도장 → 용접 → 프레스 순으로 최근)
    const finished: (NgProcess | 'ok')[] = [...Array<'ok'>(c.done).fill('ok')]
    for (const p of Object.keys(c.ng) as NgProcess[]) for (let i = 0; i < c.ng[p]; i++) finished.push(p)
    for (let i = finished.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[finished[i], finished[j]] = [finished[j], finished[i]]
    }
    const override = date === today() ? NG_OVERRIDES.find((o) => o.lineId === lineId) : undefined
    if (override) {
      // 고장과 이어진 불량을 끝난 제품 맨 뒤(가장 최근)로
      const i = finished.lastIndexOf(override.process as NgProcess)
      if (i >= 0) finished.push(...finished.splice(i, 1))
    }
    const kinds: (NgProcess | 'ok' | `wip-${WipProcess}`)[] = [
      ...finished,
      ...Array<'wip-PAINTING'>(c.wip.PAINTING).fill('wip-PAINTING'), ...Array<'wip-WELDING'>(c.wip.WELDING).fill('wip-WELDING'), ...Array<'wip-PRESS'>(c.wip.PRESS).fill('wip-PRESS'),
    ]

    const start = dayStart(date)
    const isToday = date === today()
    const end = isToday ? ctx.now() : start + 86_400_000
    // 끝난 제품은 지금보다 한 사이클(출고까지 62분) 앞까지 고르게, 재공은 그 뒤 지금까지 고르게 투입
    const finishedEnd = isToday ? Math.max(start + 60_000, end - (STEP_END_MIN.INSPECTION + 1) * 60_000) : end
    const nFinished = finished.length
    const nWip = kinds.length - nFinished
    const inputOf = (i: number) => (i < nFinished
      ? start + ((i + 0.5) / Math.max(1, nFinished)) * (finishedEnd - start)
      : finishedEnd + ((i - nFinished + 0.5) / Math.max(1, nWip)) * (end - finishedEnd))
    const stamp = date.replaceAll('-', '')

    return kinds.map((kind, i): ProductDetail => {
      const inputMs = inputOf(i)
      const at = (p: ProcessId, edge: 'start' | 'end') => {
        const ms = inputMs + (edge === 'start' ? STEP_START_MIN[p] : STEP_END_MIN[p]) * 60_000
        return new Date(Math.min(ms, end - 1000)).toISOString()
      }
      const ngAt: NgProcess | null = kind === 'ok' || kind.startsWith('wip') ? null : (kind as NgProcess)
      const nowAt: WipProcess | null = kind.startsWith('wip') ? (kind.slice(4) as WipProcess) : null
      const stop = ngAt ?? nowAt
      const stepResult = (p: ProcessId): StepResult => {
        if (!stop) return 'ok'
        const si = STEPS.indexOf(stop), pi = STEPS.indexOf(p)
        if (pi < si) return 'ok'
        if (pi > si) return 'no'
        return ngAt ? 'ng' : 'now'
      }
      const stage = 1 + Math.floor(r() * 4)
      const ngReason = (p: NgProcess): string => {
        const side = r() < 0.6 ? '상한' : '하한'
        if (p === 'PRESS') return `${stage}단 · ${PRESS_ITEMS[Math.floor(r() * PRESS_ITEMS.length)]} ${side} 이탈`
        if (p === 'WELDING') return `${WELD_ITEMS[Math.floor(r() * WELD_ITEMS.length)]} ${side} 이탈`
        return { SLITTING: '슬리팅 끝 검사 불량', PAINTING: '도장 끝 검사 불량', INSPECTION: '비전 검사 불량' }[p]
      }
      const equipmentOf = (p: ProcessId) => ({
        COIL: null, SLITTING: `${lineId}-SL`, PRESS: `${lineId}-PR${p === ngAt ? stage : 4}`, WELDING: `${lineId}-WD`, PAINTING: `PT${(i % 2) + 1}`, INSPECTION: 'VI',
      })[p]

      const isOverride = override && i === finished.length - 1 && ngAt === override.process
      const records = STEPS.map((p) => {
        const res = stepResult(p)
        if (res === 'no') return { process: p, equipment: null, from: null, to: null, judgement: null, reason: null }
        if (isOverride && p === ngAt) {
          const fault = ctx.live.get(override.equipmentId)
          const to = fault ? new Date(Date.parse(fault.since) - override.beforeFaultSec * 1000).toISOString() : at(p, 'end')
          return { process: p, equipment: override.equipmentId, from: new Date(Date.parse(to) - 40_000).toISOString(), to, judgement: 'ng' as const, reason: override.reason }
        }
        return {
          process: p, equipment: equipmentOf(p), from: at(p, 'start'), to: res === 'now' ? null : at(p, 'end'),
          judgement: res === 'now' ? null : res, reason: res === 'ng' ? ngReason(p as NgProcess) : null,
        }
      })
      const last = [...records].reverse().find((x) => x.to)
      return {
        id: `${lineId}-${stamp}-${String(i + 1).padStart(4, '0')}`,
        lineId, inputAt: new Date(inputMs).toISOString(),
        doneAt: kind === 'ok' || ngAt ? (last?.to ?? null) : null,
        steps: STEPS.map((p) => ({ process: p, result: stepResult(p) })),
        result: kind === 'ok' ? 'ok' : ngAt ? 'ng' : 'wip',
        ngProcess: ngAt,
        records,
      }
    })
  }

  /** 하루·라인 제품. 90일 넘은 날은 빈 목록 (D-86) */
  function day(date: string, lineId: LineId): ProductDetail[] {
    if (date === today()) return build(date, lineId)
    if (dayStart(today()) - dayStart(date) > KEEP_DAYS * 86_400_000) return []
    const key = `${date}|${lineId}`
    if (!past.has(key)) past.set(key, build(date, lineId))
    return past.get(key)!
  }

  /** 제품 ID로 찾기: B-20261116-0118 */
  function find(id: string): ProductDetail | null {
    const m = /^([A-F])-(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(id)
    if (!m) return null
    return day(`${m[2]}-${m[3]}-${m[4]}`, m[1] as LineId).find((p) => p.id === id) ?? null
  }

  const strip = (d: ProductDetail): Product => {
    const { records, ...p } = d
    void records
    return p
  }

  return { counts, day, find, strip }
}
