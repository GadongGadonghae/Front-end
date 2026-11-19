// 백엔드 응답·요청 모양 (docs/api-spec-v3.1.md 그대로, v3.2 합의분 포함). 이름·필드를 바꾸지 않는다.
// 화면이 쓰는 타입(src/types)으로 바꾸는 일은 source.ts가 한다.

export type StatusCode = 'R' | 'S' | 'I' | 'D' | 'DC'
export type ProcessCode = 'COIL' | 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING' | 'INSPECTION'
export type ReasonCode =
  | 'PL_SHIFT' | 'PL_PM' | 'PL_CHANGE' | 'PL_SETUP'
  | 'UP_BREAKDOWN' | 'UP_ALARM' | 'UP_DELAY' | 'UP_SHORTAGE' | 'UP_LABOR' | 'UP_SAFETY' | 'UP_ETC'

/** 목록 (v3.2 합의: { items, total, page, size }, page는 1부터) */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

/** 공통 오류 */
export interface ApiErrorBody {
  status: number
  code: string
  message: string
  timestamp: string
}

// ── 모니터링 (M) ──

/** M-01 · M-12 · W-01 설비 상태 공통 */
export interface EquipmentStatusDto {
  equipmentId: string
  lineId: string | null
  process: ProcessCode
  status: StatusCode
  since: string
  reasonCode: ReasonCode | null
  lastValues: Record<string, number>
}

/** M-02 */
export interface LineStatusSummaryDto {
  lineId: string
  R: number
  S: number
  I: number
  D: number
  DC: number
  worstStatus: StatusCode
}

/** M-03 */
export interface MetricsDto {
  equipmentId: string
  metrics: {
    metric: string
    unit: string
    limitLow: number | null
    limitHigh: number | null
    points: { ts: string; value: number; result?: 'OK' | 'NG' }[]
  }[]
}

/** M-04 · M-05 */
export interface AlarmDto {
  alarmId: number
  equipmentId: string
  itemName: string
  measuredValue: number
  lowerLimit: number | null
  upperLimit: number | null
  level: 'WARNING' | 'CRITICAL'
  message: string
  occurredAt: string
  clearedAt: string | null
  ackedAt?: string | null
}

/** M-07 */
export interface ProductionCountsDto {
  date: string
  total: number
  processNg: number
  inspected: number
  ngVision: number
  ok: number
  yieldRate: number
  byGroup: { key: string; total: number; good: number; ng: number }[]
  byProcess?: { process: ProcessCode; produced: number; ng: number }[]
}

/** M-08 */
export interface InspectionDto {
  inspectionId: number
  productId: string
  lineId: string
  paintId: string
  result: 'OK' | 'NG'
  inspectedAt: string
}

/** M-09 응답 */
export interface PaintRouteDto {
  lineId: string
  currentPaintId: string
  changedAt: string
}

/** M-10 */
export interface ThresholdDto {
  id: number
  equipmentId: string
  process: ProcessCode
  metric: string
  low: number | null
  high: number | null
  /** 명세 예시에는 없음 (M-11 응답에만). 오면 쓴다 */
  unit?: string
  updatedAt?: string | null
  updatedBy?: string | null
}

/** M-11 응답 */
export interface ThresholdUpdatedDto {
  id: number
  low: number | null
  high: number | null
  updatedAt: string
}

/** G-01 unit=hour: 시간 구간 × 라인. good = 비전 OK, cumulativeGood = from부터 라인별 누적 */
export interface HourlySummaryDto {
  period: string
  lineId: string
  inspected: number
  good: number
  processNg: number
  cumulativeGood: number
}

/** M-15 설비별 사이클 수·평균 CT. 프레스 CT는 라인 제품 간격(네 단이 같음) */
export interface CycleDto {
  equipmentId: string
  cycles: number
  avgCtMs: number | null
}

/** M-13 */
export interface WipDto {
  process: ProcessCode
  nextProcess: ProcessCode
  wipQty: number
}

// ── 가동률 (U) ──

/** U-01 (v3.2: lineYield 추가) */
export interface UtilizationSummaryDto {
  target: number
  actual: number
  oee: number | null
  availability: number | null
  performance: number | null
  quality: number | null
  plannedMin: number
  unplannedStopMin: number
  lossQty: number
  lineYield?: number | null
}

/** U-02 (v3.2: oee 추가) */
export interface UtilizationTrendDto {
  period: string
  target: number
  actual: number
  oee?: number | null
}

/** U-03 */
export interface UtilizationByProcessDto {
  process: ProcessCode
  actual: number
  oee: number | null
  unplannedStopMin: number
}

/** U-04 (v3.2: oee 추가) */
export interface UtilizationByLineDto {
  lineId: string
  actual: number
  stopCount: number
  oee?: number | null
}

/** U-05 (v3.2: oee 추가) */
export interface UtilizationByEquipmentDto {
  equipmentId: string
  actual: number
  oee?: number | null
}

/** U-07 */
export interface DowntimeSummaryDto {
  from: string
  to: string
  totalMin: number
  byReason: { reasonCode: ReasonCode; minutes: number; count: number; ratio: number }[]
  byGroup: ({ key: string; totalMin: number } & Partial<Record<ReasonCode, number>>)[]
}

/** U-08 items[] · U-09 응답 (11/19부터 바뀐 뒤의 1건 전체) */
export interface DowntimeEventDto {
  eventId: number
  lineId: string | null
  equipmentId: string
  process: ProcessCode
  status: 'S' | 'I' | 'D'
  reasonCode: ReasonCode
  startAt: string
  endAt: string | null
  minutes: number
  inProgress: boolean
  detail: string | null
  actionUserId: number | null
  actionUserName: string | null
  actionAt: string | null
  memo: string
}

/** U-11 */
export interface YieldTrendDto {
  period: string
  total: number
  good: number
  yieldRate: number
}

/** U-12 */
export interface StatusHistoryDto {
  status: StatusCode
  startAt: string
  endAt: string | null
  reasonCode?: ReasonCode
}

// ── 생산 (G) ──

/** G-01 */
export interface ProductionSummaryDto {
  period: string
  lineId: string
  planQty: number
  actualQty: number
  achievementRate: number
}

/** G-02 · G-03 */
export interface ProductionPlanDto {
  date: string
  lineId: string
  planQty: number
}

// ── 재배정 (R) ──

/** R-01 */
export interface ReassignmentSummaryDto {
  reportId: number
  downtimeId: number
  sourceLineId: string
  equipmentId: string
  stopMin: number
  lossQty: number
  createdAt: string
}

/** R-02 */
export interface ReassignmentDetailDto {
  reportId: number
  downtimeId: number
  sourceLineId: string
  lossQty: number
  details: { targetLineId: string; spareCapacity: number; addQty: number }[]
}

// ── 관리·공통 (C) ──

/** C-01 */
export interface LoginDto {
  accessToken: string
  userName: string
  role: string
}

/** C-04 */
export interface LineDto {
  lineId: string
  defaultPaintId: string
  currentPaintId: string
}

/** C-05 */
export interface EquipmentDto {
  equipmentId: string
  name: string
  lineId: string | null
  process: ProcessCode
}

// ── WebSocket (STOMP) ──

/** W-02 */
export interface AlarmEventDto {
  alarmId: number
  type: 'RAISED' | 'CLEARED' | 'ACKED'
  equipmentId: string
  level: 'WARNING' | 'CRITICAL'
  message: string
  occurredAt: string
}

/** W-03 */
export interface ProductionEventDto {
  last: { lineId: string; paintId: string; result: 'OK' | 'NG' }
  today: { total: number; processNg: number; inspected: number; ngVision: number; ok: number; yieldRate: number }
}
