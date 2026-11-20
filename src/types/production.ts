// 생산 집계 (데이터정의서 DT-018 시간대 생산, DT-021 제품, API 명세 5.2, 4.9)
import type { LineId, ProcessId } from '@/types/plant'
import type { Period } from '@/types/analysis'

/** 목록 응답 (API 명세 1장) */
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  size: number
}

/** 생산 조회 조건 (SCR-011 1번) */
export interface ProductionQuery {
  period: Period
  date: string
  lineId?: LineId
  result?: 'all' | 'ok' | 'ng' | 'wip'
  q?: string
  page?: number
}

/** API-100 생산 요약 */
export interface ProductionSummary {
  from: string
  to: string
  plan: number | null
  done: number
  rate: number | null
  input: number
  wip: number
  ngByProcess: Partial<Record<ProcessId, number>>
  byLine: { lineId: LineId; plan: number | null; done: number }[]
  /** 일: 시간대 누적, 주·월: 일별 */
  trend: { x: number; label: string; done: number; plan: number | null }[]
  trendKind: 'hourly' | 'daily'
  /** 기간 양품률 = 출고 양품 ÷ 생산 (생산 = 검사 + 공정 불량, 백엔드 M-07·U-11) */
  yieldRate: number | null
  /** 일별 양품률 (백엔드 U-11 unit=day). 일 조회면 그날까지 7일, 주·월이면 그 기간 */
  yieldTrend: { date: string; label: string; total: number; good: number; rate: number | null }[]
}

/** 제품이 공정을 지난 결과 */
export type StepResult = 'ok' | 'ng' | 'now' | 'no'

/** API-101 제품 한 줄 */
export interface Product {
  id: string
  lineId: LineId
  inputAt: string
  doneAt: string | null
  steps: { process: ProcessId; result: StepResult }[]
  result: 'ok' | 'ng' | 'wip'
  /** 불량이면 제외된 공정 */
  ngProcess: ProcessId | null
}

/** API-102 제품 공정별 기록 */
export interface ProductDetail extends Product {
  records: { process: ProcessId; equipment: string | null; from: string | null; to: string | null; judgement: 'ok' | 'ng' | null; reason: string | null }[]
}

/** 오늘 시간대별 생산 (API-020) */
export interface HourlyOutput {
  date: string
  /** null이면 공장 전체 */
  lineId: LineId | null
  /** 목표(공장) 또는 라인 계획. 없으면 null */
  target: number | null
  hours: {
    hour: number
    done: number
    cumulative: number
    /** 그 시각까지의 계획 누적. 목표 없으면 null */
    planCumulative: number | null
  }[]
}
