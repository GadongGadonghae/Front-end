// 데모 물류: 공장 안 제품 위치를 흉내 낸다 (3D 물류용, 백엔드 위치 API 없음)
// 처리 시간(초): 슬리팅 16 · 프레스 각 17 · 용접 17 · 도장 4 · 비전 2 (11/18 변경, seed.sql은 7초) [데모]
// 코일 1롤 = 제품 20개. 재공은 공정 사이에만 쌓는다 (프레스 4단 사이는 바로 넘김)
import type { EquipmentLive, FlowLocation, FlowPositions, ProductPosition } from '@/types/live'
import type { ProductionLineId } from '@/types/plant'

const LINES: ProductionLineId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const CT: Record<string, number> = { SL: 16, PR: 17, WD: 17, PT: 4, VI: 2 }
const NG_RATE = 0.006
const STEP = 0.25

interface Prod { id: string; line: ProductionLineId; loc: FlowLocation; enq: number; rolled: boolean }
interface Slot { id: string; kind: string; line: ProductionLineId | null; cur: Prod | null; t: number }

const kindOf = (id: string) => (id === 'VI' ? 'VI' : id.startsWith('PT') ? 'PT' : id.split('-')[1].replace(/\d/g, ''))

/** live: 지금 설비 상태, paintOf: 라인이 지금 쓰는 도장 설비 ID, dateTag: 제품 ID의 날짜 (YYYYMMDD) */
export function createFlow(live: () => Iterable<EquipmentLive>, paintOf: (l: ProductionLineId) => string, dateTag: string, at: () => string) {
  let t = 0
  let coil = 0
  const seq: Record<string, number> = {}
  const prods = new Map<string, Prod>()
  const piles = new Map<string, Prod[]>()
  const slots = new Map<string, Slot>()
  const pile = (k: string) => { let q = piles.get(k); if (!q) piles.set(k, (q = [])); return q }
  const ids = ['VI', 'PT1', 'PT2', ...LINES.flatMap((l) => ['WD', 'PR4', 'PR3', 'PR2', 'PR1', 'SL'].map((n) => `${l}-${n}`))]
  for (const id of ids) slots.set(id, { id, kind: kindOf(id), line: id.includes('-') ? (id[0] as ProductionLineId) : null, cur: null, t: 0 })

  const put = (p: Prod, loc: FlowLocation) => { p.loc = loc; p.enq = t; p.rolled = false }
  const take = (k: string) => pile(k).shift() ?? null
  const pull = (s: Slot): Prod | null => {
    if (s.kind === 'SL') {
      if (coil <= 0 || !s.line) return null
      coil -= 1
      seq[s.line] = (seq[s.line] ?? 0) + 1
      const p: Prod = { id: `${s.line}-${dateTag}-${String(seq[s.line]).padStart(4, '0')}`, line: s.line, loc: { eq: s.id }, enq: t, rolled: false }
      prods.set(p.id, p)
      return p
    }
    if (s.kind === 'PR') return s.id.endsWith('PR1') ? take(`${s.line}:SL-PR`) : null
    if (s.kind === 'WD') return take(`${s.line}:PR-WD`)
    if (s.kind === 'PT') {
      const qs = LINES.filter((l) => paintOf(l) === s.id).map((l) => pile(`${l}:WD-PT`)).filter((q) => q.length)
      qs.sort((a, b) => a[0].enq - b[0].enq)
      return qs[0]?.shift() ?? null
    }
    const qs = [pile('PT1:PT-VI'), pile('PT2:PT-VI')].filter((q) => q.length).sort((a, b) => a[0].enq - b[0].enq)
    return qs[0]?.shift() ?? null
  }

  const step = (blocked: Set<string>) => {
    t += STEP
    if (coil < 20) coil += 20
    for (const id of ids) {
      const s = slots.get(id)!
      if (blocked.has(id)) continue
      if (s.cur) {
        s.t -= STEP
        if (s.t <= 0) {
          const p = s.cur
          if (!p.rolled && (p.rolled = true) && Math.random() < NG_RATE) { prods.delete(p.id); s.cur = null }
          else if (s.kind === 'PR' && !s.id.endsWith('PR4')) {
            const next = slots.get(`${s.line}-PR${Number(s.id.slice(-1)) + 1}`)!
            if (!next.cur && !blocked.has(next.id)) { next.cur = p; next.t = CT.PR; put(p, { eq: next.id }); s.cur = null }
          } else if (s.kind === 'VI') { prods.delete(p.id); s.cur = null }
          else {
            const k = s.kind === 'SL' ? `${s.line}:SL-PR` : s.kind === 'PR' ? `${s.line}:PR-WD` : s.kind === 'WD' ? `${s.line}:WD-PT` : `${s.id}:PT-VI`
            pile(k).push(p); put(p, { pile: k }); s.cur = null
          }
        }
      }
      if (!s.cur) {
        const p = pull(s)
        if (p) { s.cur = p; s.t = CT[s.kind]; put(p, { eq: s.id }) }
      }
    }
  }

  /** sec초만큼 진행. 정지·고장·통신 끊김 설비와 원인 코드가 있는 대기 설비는 멈춘다 */
  const advance = (sec: number) => {
    const blocked = new Set<string>()
    for (const e of live()) if (e.state === 'D' || e.state === 'DC' || e.state === 'S' || (e.state === 'I' && e.code)) blocked.add(e.id)
    for (let i = 0; i < Math.round(sec / STEP); i++) step(blocked)
  }

  const positions = (): FlowPositions => {
    const products: ProductPosition[] = []
    for (const p of prods.values()) products.push({ productId: p.id, lineId: p.line, location: p.loc })
    return { at: at(), products, coilWip: coil }
  }

  return { advance, positions }
}
