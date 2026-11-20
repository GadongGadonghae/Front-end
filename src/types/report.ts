// 리포트·설정 (SCR-007 일일 생산 리포트·계획수정 보고서, SCR-008 생산 목표). 데이터정의서 DT-016·017·019
import type { DowntimeCode, StopState } from '@/types/state'
import type { Oee } from '@/types/live'
import type { LineId, ProcessId } from '@/types/plant'

/** API-080 일일 생산 리포트: 하루 요약 (D-67) */
export interface DailyReport {
  date: string
  /** 지난 날은 마감 값, 오늘은 지금까지 */
  closed: boolean
  /** 기준 시각 (오늘이면 지금, 지난 날이면 그날 24:00) */
  at: string
  target: number | null
  done: number
  rate: number | null
  oee: Oee
  /** 공정 검사 + 출고 비전 불량 합 */
  ngTotal: number
  /** A~F + 도장. 도장의 불량 제외는 공정별 표에 있으므로 null */
  lines: { lineId: LineId; plan: number | null; done: number; rate: number | null; oee: number | null; ng: number | null }[]
  /** 공정별 생산(검사 받은 수)·불량 */
  processes: { process: Exclude<ProcessId, 'COIL'>; output: number; ng: number }[]
  downtime: { code: DowntimeCode; state: StopState; sec: number; count: number }[]
  /** 공정 사이 재공품. 입고 → 슬리팅은 코일(롤) */
  wip: { from: ProcessId; to: ProcessId; qty: number; unit: 'roll' | 'ea' }[]
}

/** 계획수정 보고서 목록 한 줄 (API-082) */
export interface ReplanSummary {
  id: string
  createdAt: string
  /** 추가 주문 배정(kind = order)은 빈 글 */
  equipmentId: string
  code: DowntimeCode
  /** order = 추가 주문 배정 (고장 건 없음) */
  kind?: 'line' | 'paint' | 'vision' | 'order' 
  /** 만든 고장 건 (상태 이력 ID = 비가동 번호). 데모 목록엔 없을 수 있음 */
  stateEventId?: string
}

/** 라인(또는 같은 공정 다른 설비)별 추가 배정 */
export interface ReplanAllocation {
  /** 라인 ID 또는 설비 ID (도장) */
  target: string
  remainingPlan: number
  capacity: number
  /** 남은 능력 비율 (%) */
  share: number
  add: number
}

/** API-083 계획수정 보고서 (FN-009). 제안만 하고 계획은 바꾸지 않는다 (D-70) */
export interface ReplanReport extends ReplanSummary {
  createdBy: string
  stateEventId: string
  /** 고장 시작 시각과 원인 */
  start: string
  detail: string | null
  /** line: 라인 안 설비 → 라인 전체 정지 · paint: 도장 1대 → 다른 1대 · vision: 대체 없음 */
  kind: 'line' | 'paint' | 'vision' | 'order'
  /** 계산 기준 시각 = 만든 시각 (지난 날 건은 그날 고장 시각) */
  baseAt: string
  /** 기준 시각부터 자정까지 (초) */
  remainingSec: number
  /** 계산에 쓴 CT (초) */
  ctSec: number
  /** 멈춘 쪽의 계획과 기준 시각까지 실적 */
  stoppedPlan: number
  stoppedDone: number
  /** 부족 수량 */
  shortage: number
  allocations: ReplanAllocation[]
  /** 목표 미달 예상 (0이면 달성 가능) */
  unmet: number
  target: number | null
  /** 표시용 문서번호 (실서버 AI-RPT-yyyyMMdd-NNN). 데모는 없음 */
  documentNo?: string
  /** AI 보고서 문장 (실서버 R-02). 없으면 화면에서 뺀다 */
  ai?: ReplanAi | null
  /** 원인 추적 (근거·원인 후보·근거 번호를 단 문장). 11/20 전에 만든 보고서는 없음 */
  causeTrace?: CauseTrace | null
  /** 추가 주문 배정 조건과 라인 가동 비교 (kind = order) */
  order?: ReplanOrder | null
  /** 승인·적용한 시각과 사람 (R-05, 추가 주문 배정만). 적용 전 null */
  appliedAt?: string | null
  appliedBy?: string | null
}

/** 추가 주문 배정 승인·적용 결과 (R-05) */
export interface ReplanApplyResult {
  appliedAt: string
  /** 가동 명령을 보낸 새 라인 */
  startedLines: string[]
  /** 바꾼 오늘 라인 목표 */
  targets: { lineId: string; before: number; after: number }[]
  /** 라인 가동 명령이 설비(재생기) 쪽에 닿았는지 */
  lineCommandSent: boolean
  notes: string[]
}

/** 추가 주문 배정 (R-04): AI가 해석한 조건과, 지금 가동 라인만 / 새 라인까지 켤 때 비교 */
export interface ReplanOrder {
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

// ── 원인 추적 (설명 가능한 AI 보고서) ──

/** FAULT 고장 건 · ALARM 직전 알람 · TREND 직전 공정값 · QUALITY 직전 공정 불량 · STATE 직전 상태 변화 · HISTORY 과거 고장 */
export type EvidenceType = 'FAULT' | 'ALARM' | 'TREND' | 'QUALITY' | 'STATE' | 'HISTORY'

/** 근거 하나. 문장이 id(E1…)로 가리킨다 */
export interface CauseEvidence {
  id: string
  type: EvidenceType
  title: string
  detail: string
  at: string
  /** 원본 위치 (표 이름#행 번호 또는 조회 조건) */
  source: string
}

/** 근거 강도 점수 내역 한 줄: 직접 신호 40 · 시간 근접 20 · 과거 사례 30 · 데이터 완전성 10 */
export interface CauseScorePart {
  label: string
  points: number
  max: number
  note: string
}

/** HIGH 70점 이상 · MEDIUM 40~69 · LOW 40 미만. 확률이 아니라 규칙 점수 */
export type CauseGrade = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CauseCandidate {
  id: string
  label: string
  /** 관련 관리 항목 (예: pressureLeft). 항목과 무관한 후보면 null */
  item: string | null
  score: number
  grade: CauseGrade
  parts: CauseScorePart[]
  evidence: string[]
}

/** 보고서 문장. verified = 근거 번호가 있고 문장 속 숫자가 인용한 근거에 있음 (코드가 검증) */
export interface TraceSentence {
  text: string
  /** fact 사실 · inference 추정 · action 권장 점검 */
  kind: 'fact' | 'inference' | 'action'
  evidence: string[]
  verified: boolean
  issue: string | null
}

export interface CauseTrace {
  /** 근거를 본 구간 (고장 전 1시간 ~ 고장 시각) */
  windowFrom: string
  windowTo: string
  evidence: CauseEvidence[]
  causes: CauseCandidate[]
  sentences: TraceSentence[]
  verifiedCount: number
  model: string
  /** true면 템플릿 문장 (시연 모드·LLM 실패) */
  mock: boolean
  fallbackReason: string | null
}

/** AI 추가 요청 해석 결과 (제외·정지 라인, 우선 기준) */
export interface ReplanInterpretation {
  excludedLines: string[]
  stoppedLines: string[]
  /** BALANCED 잔여 능력 · DUE_DATE 납기 · SAFETY 안전·품질 */
  priority: string
  appliedRules: string[]
}

/** AI 보고서 문장. mock = 템플릿 문장, fallbackReason = LLM 호출이 실패해 템플릿으로 대신한 이유 */
export interface ReplanAi {
  title: string
  summary: string
  actions: string[]
  risks: string[]
  model: string
  mock: boolean
  fallbackReason: string | null
  /** 화면에서 넣은 AI 추가 요청 */
  additionalRequest: string | null
  interpretation: ReplanInterpretation | null
}

/** API-090 날짜별 목표 한 줄 */
export interface TargetRow {
  date: string
  /** 없으면 null → "목표 미설정" (D-72) */
  quantity: number | null
  /** 지난 날·오늘의 실적. 앞으로의 날은 null */
  done: number | null
  updatedBy: string | null
}
