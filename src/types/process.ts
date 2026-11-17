// 공정 상세에서 쓰는 값 (API 명세 4.3, 5.3~5.5)
import type { LineId, ProcessId } from '@/types/plant'

/** API-030 공정 오늘 요약 */
export interface ProcessToday {
  lineId: LineId
  process: ProcessId
  /** 공정 생산 = 끝낸 수 (불량 포함) */
  output: number
  good: number
  oee: number | null
  /** 앞·뒤 재공 */
  wip: { before: number | null; after: number | null }
  /** 설비별 오늘 사이클·평균 CT. 가장 느린 단 표시 */
  equipment: { id: string; cycles: number; avgCtMs: number | null; slowest?: boolean }[]
  /** 도장: 라인별로 받은 수 */
  receivedByLine?: { lineId: LineId; qty: number }[]
  /** 슬리팅 실설비: 인버터 상태 (D-43) */
  inverter?: InverterStatus
}

/** 실설비 슬리터 인버터 (LS iG5A, 데이터정의서 8장) */
export interface InverterStatus {
  running: boolean
  direction: 'forward' | 'reverse' | null
  commandHz: number
  outputHz: number
  rpm: number
  lastTrip: { name: string; at: string; recoveredAfterSec: number } | null
}

/** API-040 관리값 추이 한 항목 */
export interface TelemetryItem {
  item: string
  unit: string
  /** 미정이면 null → 기준선 없이 "기준 미정" */
  lower: number | null
  upper: number | null
  points: { t: string; value: number }[]
}

export interface TelemetrySeries {
  equipmentId: string
  range: TelemetryRange
  items: TelemetryItem[]
}

export type TelemetryRange = '1h' | '8h' | 'today'

/** 웹소켓 telemetry: 선택 설비의 새 값 */
export interface TelemetryTick {
  equipmentId: string
  values: { t: string; item: string; value: number }[]
}

/** API-043 공정 검사 */
export interface InspectionToday {
  lineId: LineId | null
  process: ProcessId
  inspected: number
  ng: number
  rate: number | null
  defects: { t: string; productId: string; equipmentId: string; reason: string }[]
}

/** API-044 미세정지 [차순위] */
export interface MicrostopToday {
  equipmentId: string
  count: number
  lossSec: number
  /** 미세정지 후보 구간 (슬리팅: 출력 < 지령) — 그래프 띠 */
  bands: { from: string; to: string }[]
}

/** API-045 코일입고 */
export interface InboundToday {
  today: number
  stock: number
  input: number
  receipts: { t: string; coils: number }[]
  /** 슬리팅 앞 재고 추이: 6개 라인 합과 라인별 */
  stockTrend: { t: string; total: number; byLine: Record<string, number> }[]
}
