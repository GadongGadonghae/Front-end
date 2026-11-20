// 백엔드 응답·요청 모양 (docs/api-spec-v3.1.md 그대로, v3.2 합의분 포함). 이름·필드를 바꾸지 않는다.
// 화면이 쓰는 타입(src/types)으로 바꾸는 일은 source.ts가 한다.

export type StatusCode = 'R' | 'S' | 'I' | 'D' | 'DC'
export type ProcessCode = 'COIL' | 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING' | 'INSPECTION'
export type ReasonCode =
  | 'PL_SHIFT' | 'PL_PM' | 'PL_CHANGE' | 'PL_SETUP'
  | 'UP_BREAKDOWN' | 'UP_ALARM' | 'UP_DELAY' | 'UP_SHORTAGE' | 'UP_BLOCKED' | 'UP_LABOR' | 'UP_SAFETY' | 'UP_ETC'

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
  /** 그날 이 설비에서 공정 판정 NG(폐기)된 수. 프레스는 NG가 난 단 (11/20) */
  ng?: number
}

/** M-13 */
export interface WipDto {
  process: ProcessCode
  nextProcess: ProcessCode
  wipQty: number
}

/** M-17 공장 안 제품 위치 (3D 물류, 11/19 추가). equipmentId(설비 안)와 pile(공정 사이) 중 하나만 값이 있다 */
export interface FlowPositionsDto {
  at: string
  products: {
    productId: string
    lineId: string
    equipmentId: string | null
    /** SL-PR · PR-WD · WD-PT (라인 안, 라인 접두어 없음) · PT1:PT-VI · PT2:PT-VI */
    pile: string | null
  }[]
}

/** M-16 코일 입고 현황 (1롤 = 제품 20개, 11/18 추가) */
export interface CoilTodayDto {
  date: string
  receivedRolls: number
  receivedQty: number
  /** 슬리팅 앞 코일 재고 (제품 수) */
  stockQty: number
  /** 코일 재고 (롤, 소수 1자리. 예: 74개 → 3.7) */
  stockRolls: number
  inputQty: number
  receipts: { materialId: string; receivedAt: string; productQty: number }[]
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
  /** 마지막으로 저장한 시각·사람 이름 (11/20 추가) */
  updatedAt?: string | null
  updatedBy?: string | null
}

// ── 제품 추적 (P) ──

/** P-01 제품 목록 한 줄. finalResult = OK(비전 OK) / NG(공정 NG 또는 비전 NG) / IN_PROGRESS */
export interface ProductDto {
  productId: string
  lineId: string
  inputAt: string
  finalResult: 'OK' | 'NG' | 'IN_PROGRESS'
  scrappedProcess: string | null
  scrappedEquipmentId: string | null
  finishedAt: string | null
}

/** P-02 제품 이력. 프레스는 PR1~PR4가 단계 4개. 처리 중이면 endedAt·result가 null */
export interface ProductDetailDto {
  productId: string
  lineId: string
  finalResult: 'OK' | 'NG' | 'IN_PROGRESS'
  scrappedProcess: string | null
  scrappedEquipmentId: string | null
  steps: { process: string; equipmentId: string; at: string | null; startedAt: string | null; endedAt: string | null; values: Record<string, unknown>; result: 'OK' | 'NG' | null }[]
}

/** P-03 공정 불량 제품 한 줄 */
export interface ProcessNgDto {
  productId: string
  lineId: string
  process: string
  equipmentId: string
  at: string
  itemName: string | null
  reason: string | null
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
  /** 고장 사유 코드 (11/19 추가). 추가 주문 배정은 null */
  code: ReasonCode | null
  /** line · paint · vision · order (order = 추가 주문 배정, 고장 건 없음 → downtimeId 0, equipmentId null) (11/20 추가) */
  kind: 'line' | 'paint' | 'vision' | 'order' | null
  /** 공장장 승인(결재) 여부 (R-04 · 추가 주문은 R-06 승인·적용, 11/20) */
  approved?: boolean
}

/** R-02 · R-03. 앞 5칸은 처음 명세, 나머지는 11/19 계획수정 보고서 화면용 (예전 보고서는 null일 수 있음) */
export interface ReassignmentDetailDto {
  reportId: number
  downtimeId: number
  sourceLineId: string | null
  /** 부족 수량 */
  lossQty: number
  /** targetLineId: 라인 ID, 도장 보고서면 설비 ID(PT1·PT2). share: 남은 능력 비율(%) */
  details: { targetLineId: string; spareCapacity: number; addQty: number; remainingPlan: number | null; share: number }[]
  /** 표시용 문서번호 AI-RPT-yyyyMMdd-NNN */
  documentNo: string
  equipmentId: string
  code: ReasonCode
  detail: string | null
  startedAt: string
  createdAt: string
  createdBy: string | null
  kind: 'line' | 'paint' | 'vision' | 'order' | null
  baseAt: string | null
  remainingSec: number | null
  ctSec: number | null
  stoppedPlan: number | null
  stoppedDone: number | null
  targetQty: number | null
  unmetQty: number | null
  /** 공장장 승인(결재) (11/20, R-04) */
  approved?: boolean
  approvedBy?: string | null
  approvedAt?: string | null
  /** AI 문장. mock = 템플릿 문장, fallbackReason = LLM 호출이 실패해 템플릿으로 대신한 이유 */
  ai: {
    title: string; summary: string; actions: string[]; risks: string[]; markdown: string | null; model: string; mock: boolean; fallbackReason: string | null
    /** AI 추가 요청과 그 해석 (제외·정지 라인, 우선 기준 BALANCED·DUE_DATE·SAFETY) */
    additionalRequest: string | null
    requestInterpretation: { excludedLines: string[]; stoppedLines: string[]; priority: string; appliedRules: string[] } | null
    /** 원인 추적 (11/20 추가). 예전 보고서는 없음 */
    causeTrace?: CauseTraceDto | null
    /** 추가 주문 배정 조건과 라인 가동 비교 (kind = order, 11/20 추가) */
    order?: OrderInfoDto | null
  } | null
}

/** R-06 추가 주문 배정 승인·적용 결과 */
export interface ApplyResponseDto {
  reportId: number
  appliedAt: string
  /** 가동 명령을 보낸 새 라인 */
  startedLines: string[]
  /** 끝낸 계획정지 번호 */
  endedStops: number[]
  /** 바꾼 오늘 라인 목표 */
  targets: { lineId: string; before: number; after: number }[]
  /** 라인 가동 명령(MQTT)이 브로커에 닿았는지 */
  lineCommandSent: boolean
  notes: string[]
}

/** R-02 ai.order: 추가 주문 해석 조건 · 지금 라인만(current) / 새 라인까지(withNew) 비교 */
export interface OrderInfoDto {
  request: string | null
  addQty: number
  /** HH:mm (24:00 = 오늘 안) */
  dueAt: string
  setupMinutes: number
  runningLines: string[]
  newLines: string[]
  /** 새 라인을 요청에서 정하지 않아 계산으로 고름 */
  recommended: boolean
  idleLines: string[]
  excludedLines: string[]
  /** "AI · 모델" 또는 "규칙" */
  parsedBy: string
  notes: string[]
  current: { lines: string[]; capacity: number; unmet: number }
  withNew: { lines: string[]; capacity: number; unmet: number }
}

/** R-02 ai.causeTrace: 근거(E1…) · 원인 후보와 근거 강도(규칙 점수) · 근거 번호를 단 문장과 검증 결과 */
export interface CauseTraceDto {
  windowFrom: string
  windowTo: string
  evidence: { id: string; type: 'FAULT' | 'ALARM' | 'TREND' | 'QUALITY' | 'STATE' | 'HISTORY'; title: string; detail: string; at: string; source: string }[]
  causes: {
    id: string; label: string; item: string | null; score: number; grade: 'HIGH' | 'MEDIUM' | 'LOW'
    parts: { label: string; points: number; max: number; note: string }[]
    evidence: string[]
  }[]
  sentences: { text: string; kind: 'fact' | 'inference' | 'action'; evidence: string[]; verified: boolean; issue: string | null }[]
  verifiedCount: number
  model: string
  mock: boolean
  fallbackReason: string | null
}

// ── 관리·공통 (C) ──

/** C-02 (lastLoginAt은 시간대 없는 KST) */
export interface UserDto {
  loginId: string
  userName: string
  role: string
  email: string | null
  memo: string | null
  lastLoginAt: string | null
}

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
