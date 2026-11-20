// 설비 상태 센서 더미 (예지보전 SCR-004 상세 보기). 온도·진동·전류처럼 백엔드·DB·수집에 아직 없는 값을 프론트에서 만든다.
// 데모(mock)와 실제 백엔드(api) 모두 이 값을 쓰고, 화면에는 "더미"로 표시한다 (CLAUDE.md 데모 값 표시).
// 같은 설비·항목·시각이면 늘 같은 값 → 처음 조회한 추이와 실시간 값이 이어진다. 수집이 생기면 이 파일을 지운다
import type { EquipmentTypeCode } from '@/types/plant'
import type { EquipmentRisk, RiskItem } from '@/types/pdm'
import type { TelemetryItem } from '@/types/process'

/** lower가 null이면 0에서 상한까지 보는 항목(진동) */
export interface SensorDef { item: string; unit: string; lower: number | null; upper: number; center: number; amp: number }

/** 설비 종류별 센서와 임시 기준 (값과 기준은 더미, 팀 확정 전) */
export const SENSOR_DEFS: Partial<Record<EquipmentTypeCode, SensorDef[]>> = {
  slitter: [
    { item: 'motorTemp', unit: '℃', lower: 30, upper: 80, center: 52, amp: 1.5 },
    { item: 'vibration', unit: 'mm/s', lower: null, upper: 4.5, center: 1.4, amp: 0.12 },
  ],
  press: [
    { item: 'hydraulicTemp', unit: '℃', lower: 30, upper: 60, center: 44, amp: 0.8 },
    { item: 'hydraulicPressure', unit: 'bar', lower: 140, upper: 180, center: 160, amp: 1.6 },
    { item: 'motorCurrent', unit: 'A', lower: 10, upper: 25, center: 17.5, amp: 0.5 },
    { item: 'vibration', unit: 'mm/s', lower: null, upper: 4.5, center: 1.6, amp: 0.12 },
  ],
  welder: [
    { item: 'tipTemp', unit: '℃', lower: 30, upper: 90, center: 58, amp: 1.4 },
    { item: 'coolantTemp', unit: '℃', lower: 15, upper: 30, center: 22, amp: 0.35 },
    { item: 'coolantFlow', unit: 'L/min', lower: 4, upper: 8, center: 6, amp: 0.12 },
  ],
  painter: [
    { item: 'pumpCurrent', unit: 'A', lower: 5, upper: 12, center: 8.5, amp: 0.22 },
    { item: 'fanVibration', unit: 'mm/s', lower: null, upper: 4.5, center: 1.3, amp: 0.1 },
  ],
}

/** 한계 쪽으로 서서히 가는 장면: 지금으로부터 1시간 동안 percent 자리까지 간다 */
const DRIFTS: { equipmentId: string; item: string; percent: number }[] = [
  // 데모(mock) 장면 설비: E-PR2 위험, A-WD 주의
  { equipmentId: 'E-PR2', item: 'hydraulicTemp', percent: 84 },
  { equipmentId: 'E-PR2', item: 'vibration', percent: 72 },
  { equipmentId: 'A-WD', item: 'tipTemp', percent: 78 },
  // 리허설 장면 설비: B-PR2 공정 불량, C-PR3 장비고장
  { equipmentId: 'B-PR2', item: 'hydraulicTemp', percent: 82 },
  { equipmentId: 'C-PR3', item: 'vibration', percent: 91 },
  { equipmentId: 'C-PR3', item: 'motorCurrent', percent: 86 },
  { equipmentId: 'D-SL', item: 'vibration', percent: 83 },
]
const DRIFT_SEC = 3600
const WINDOW_SEC = 600
const SAMPLE_SEC = 20

function hash(...parts: (string | number)[]): number {
  let h = 0x811c9dc5
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
/** 0 이상 1 미만 */
const noise = (...parts: (string | number)[]) => {
  let t = (hash(...parts) + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** 설비 ID로 종류 (A-SL · A-PR1 · A-WD · PT1 · VI) */
export function typeOfId(id: string): EquipmentTypeCode {
  if (/^PT\d$/.test(id)) return 'painter'
  if (id === 'VI') return 'vision'
  if (/-SL$/.test(id)) return 'slitter'
  if (/-PR\d$/.test(id)) return 'press'
  return 'welder'
}

export const sensorDefsOf = (equipmentId: string) => SENSOR_DEFS[typeOfId(equipmentId)] ?? []

/** 위험도 % 자리의 값 */
const valueAtPercent = (d: SensorDef, pct: number) => (d.lower == null ? (d.upper * pct) / 100 : (d.lower + d.upper) / 2 + ((d.upper - d.lower) / 2) * (pct / 100))

/** 위험도 %: 가운데에서 한계까지 간 비율 (하한 없는 항목은 0에서 상한까지) */
export function riskPercentOf(avg: number | null, lower: number | null, upper: number | null): number | null {
  if (avg == null || upper == null) return null
  if (lower == null) return upper > 0 ? Math.round((avg / upper) * 100) : null
  if (upper <= lower) return null
  return Math.round((Math.abs(avg - (lower + upper) / 2) / ((upper - lower) / 2)) * 100)
}

/** 센서 값 하나 (t, nowSec: 초) */
export function sensorValue(equipmentId: string, d: SensorDef, t: number, nowSec: number): number {
  const k = hash(equipmentId, d.item)
  const slow = Math.sin((t / 1500) * Math.PI * 2 + (k % 628) / 100) * 0.5 + Math.sin(t / 360 + (k % 97)) * 0.25
  let v = d.center + d.amp * (slow + (noise(k, Math.floor(t)) - 0.5) * 0.8)
  const drift = DRIFTS.find((x) => x.equipmentId === equipmentId && x.item === d.item)
  if (drift) v += (valueAtPercent(d, drift.percent) - d.center) * clamp01((t - (nowSec - DRIFT_SEC)) / DRIFT_SEC) ** 1.4
  const digits = Math.abs(d.center) < 10 ? 100 : 10
  return Math.round(v * digits) / digits
}

/** 공정 관리값과 같은 시각들에 센서 값을 붙인다 (멈춘 동안은 공정 값도 없으니 센서도 없음) */
export function sensorItemsAt(equipmentId: string, times: string[], nowSec: number): TelemetryItem[] {
  return sensorDefsOf(equipmentId).map((d) => ({
    item: d.item, unit: d.unit, lower: d.lower, upper: d.upper, source: 'sensor',
    points: times.map((t) => ({ t, value: sensorValue(equipmentId, d, Date.parse(t) / 1000, nowSec) })),
  }))
}

/** 받은 공정 관리값 목록 뒤에 센서 항목을 붙인다. 시각은 점이 가장 많은 항목을 따른다 */
export function withSensors(equipmentId: string, items: TelemetryItem[], nowSec: number): TelemetryItem[] {
  const base = [...items].sort((a, b) => b.points.length - a.points.length)[0]
  // 공정 값이 없으면(재생 전·통신 끊김) 센서도 점 없이 항목만 → 카드는 "-"
  return [...items, ...sensorItemsAt(equipmentId, base?.points.map((p) => p.t) ?? [], nowSec)]
}

/** 실시간 새 값에 센서 값을 붙인다 */
export function sensorTickValues(equipmentId: string, times: string[], nowSec: number) {
  const uniq = [...new Set(times)]
  return sensorDefsOf(equipmentId).flatMap((d) => uniq.map((t) => ({ t, item: d.item, value: sensorValue(equipmentId, d, Date.parse(t) / 1000, nowSec) })))
}

/** 센서 항목의 위험도 (최근 10분 평균) */
export function sensorRiskItems(equipmentId: string, nowSec: number): RiskItem[] {
  return sensorDefsOf(equipmentId).map((d) => {
    const vs: number[] = []
    for (let t = nowSec - WINDOW_SEC; t <= nowSec; t += SAMPLE_SEC) vs.push(sensorValue(equipmentId, d, t, nowSec))
    const avg = vs.reduce((a, b) => a + b, 0) / vs.length
    return { item: d.item, unit: d.unit, source: 'sensor', lower: d.lower, upper: d.upper, avg10: Math.round(avg * 100) / 100, percent: riskPercentOf(avg, d.lower, d.upper) }
  })
}

/** 백엔드에 위험도 API가 없을 때: 센서 더미만으로 설비 위험도 목록 */
export function sensorRisks(equipment: { id: string; type: EquipmentTypeCode }[], nowSec: number): EquipmentRisk[] {
  return equipment.filter((e) => e.type !== 'vision').map((e) => {
    const items = sensorRiskItems(e.id, nowSec)
    const top = items.filter((i) => i.percent != null).sort((a, b) => b.percent! - a.percent!)[0]
    return { equipmentId: e.id, type: e.type, percent: top?.percent ?? null, item: top?.item ?? null, items }
  })
}
