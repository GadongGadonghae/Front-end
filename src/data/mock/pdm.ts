// 데모 예지보전 위험도 (FN-007, API-060·061): 관리값 그래프와 같은 값(telemetry.valueOf)에서 최근 10분 평균을 내 비율을 셈한다.
// 위험도 % = |평균 − 기준 가운데| ÷ (기준 폭의 절반) × 100 (D-58). 설비 위험도 = 항목 중 최댓값 (D-59). 기준이 미정인 항목은 null
import type { EquipmentLive } from '@/types/live'
import type { EquipmentRisk, PdmEta, RiskItem } from '@/types/pdm'
import { MASTER } from '@/data/mock/master'
import { riskPercentOf } from '@/data/dummy/sensors'

interface Ctx {
  now: () => number
  live: Map<string, EquipmentLive>
  valueOf: (equipmentId: string, item: string, t: number) => number | null
  itemsOf: (equipmentId: string) => { item: string; unit: string; lower: number | null; upper: number | null; source?: RiskItem['source'] }[]
}

/** 관리값이 있는 설비 (비전 제외 38대, D-61) */
const TARGETS = MASTER.equipment.filter((e) => e.type !== 'vision')
const WINDOW_SEC = 600
const SAMPLE_SEC = 20
/** 상한 도달 예상에 쓰는 기울기 구간 */
const ETA_BASIS_SEC = 3600
/** 슬리팅 속도 그래프용 항목은 위험도 대상이 아니다 */
const NOT_LIMIT = new Set(['commandHz', 'outputHz'])

export function createPdm(ctx: Ctx) {
  /** 최근 10분 평균. 지금 멈춰 있으면 멈추기 전 10분 */
  function avg10(equipmentId: string, item: string): number | null {
    const l = ctx.live.get(equipmentId)
    const end = Math.floor((l && l.state !== 'R' ? Date.parse(l.since) - 1000 : ctx.now()) / 1000)
    const vs: number[] = []
    for (let t = end - WINDOW_SEC; t <= end; t += SAMPLE_SEC) {
      const v = ctx.valueOf(equipmentId, item, t)
      if (v != null) vs.push(v)
    }
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }

  // 하한 없이 상한만 있는 센서(진동)는 0에서 상한까지 간 비율
  const pctOf = riskPercentOf

  function risks(): EquipmentRisk[] {
    return TARGETS.map((e) => {
      const pdm = ctx.live.get(e.id)?.pdm
      const items: RiskItem[] = ctx.itemsOf(e.id).filter((d) => !NOT_LIMIT.has(d.item)).map((d) => {
        // 데모 장면의 주의·위험 항목은 대시보드와 같은 비율로 맞추고, 평균도 그 비율 자리 값으로 보인다
        const scene = pdm && pdm.item === d.item && d.lower != null && d.upper != null
        const a = scene ? (d.lower! + d.upper!) / 2 + ((d.upper! - d.lower!) / 2) * (pdm!.percent / 100) : avg10(e.id, d.item)
        const percent = scene ? pdm!.percent : pctOf(a, d.lower, d.upper)
        return { ...d, avg10: a == null ? null : Math.round(a * 100) / 100, percent }
      })
      const top = items.filter((i) => i.percent != null).sort((x, y) => y.percent! - x.percent!)[0]
      return { equipmentId: e.id, type: e.type, percent: top?.percent ?? null, item: top?.item ?? null, items }
    })
  }

  /** 가장 높은 항목이 이 기울기대로 가면 언제 기준에 닿는지 (최근 1시간 직선 맞춤) [차순위] */
  function eta(equipmentId: string): PdmEta | null {
    const r = risks().find((x) => x.equipmentId === equipmentId)
    const it = r?.items.find((i) => i.item === r.item)
    if (!r || !it || it.lower == null || it.upper == null || it.avg10 == null) return null
    const end = Math.floor(ctx.now() / 1000)
    const pts: [number, number][] = []
    for (let t = end - ETA_BASIS_SEC; t <= end; t += 60) {
      const v = ctx.valueOf(equipmentId, it.item, t)
      if (v != null) pts.push([(t - end) / 3600, v])
    }
    if (pts.length < 10) return { equipmentId, item: it.item, etaSec: null, slopePerHour: null, toward: null, basisSec: ETA_BASIS_SEC }
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
    const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)
    const toward = it.avg10 >= (it.lower + it.upper) / 2 ? 'upper' : 'lower'
    const gap = toward === 'upper' ? it.upper - it.avg10 : it.avg10 - it.lower
    const speed = toward === 'upper' ? slope : -slope
    // 이미 벗어났거나 멀어지는 중이면 예상 없음
    const etaSec = gap > 0 && speed > 0 ? Math.round((gap / speed) * 3600) : null
    return { equipmentId, item: it.item, etaSec, slopePerHour: Math.round(slope * 100) / 100, toward, basisSec: ETA_BASIS_SEC }
  }

  return { risks, eta }
}
