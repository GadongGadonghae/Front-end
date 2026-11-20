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
  equipmentId: string
  code: DowntimeCode
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
  kind: 'line' | 'paint' | 'vision'
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

/** N-01 계획수정 보고서 슬랙 전송 결과 (보낸 기록은 서버에 남지 않음) */
export interface SlackSendResult {
  sentAt: string
  /** true = 서버가 slack.mock 이라 실제로 보내지 않고 로그에만 남김 (또는 데모 데이터) */
  mock: boolean
  /** 메시지에 넣은 요약 문장 */
  summary: string[]
  /** LLM 요약이 실패해 템플릿 문장으로 대신한 이유. 대신하지 않았으면 null */
  summaryFallback: string | null
}
