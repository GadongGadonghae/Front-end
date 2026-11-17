// 가동률 화면 (API 명세 4.4, FN-004)
import type { DowntimeCode, StateCode } from '@/types/state'
import type { Oee } from '@/types/live'

export type Period = 'day' | 'week' | 'month'

/** 조회 조건 (화면정의서 SCR-003 1번) */
export interface OeeQuery {
  period: Period
  date: string
  lineId?: string
  process?: string
  equipmentId?: string
}

/** API-050 */
export interface OeeReport {
  query: OeeQuery
  /** 집계 구간 (예: 00:00~14:32 기준) */
  from: string
  to: string
  oee: Oee
  /** 라인 전체면 라인별, 라인을 고르면 공정별 막대 */
  bars: { key: string; label: string; oee: number | null }[]
  /** 비가동 코드별 시간(초)·건수 */
  downtime: { code: DowntimeCode; state: Exclude<StateCode, 'R'>; sec: number; count: number }[]
  /** 주·월이면 일별 OEE */
  daily: { date: string; oee: number | null }[]
}

/** API-051 상태 타임라인 (일) */
export interface StateTimeline {
  date: string
  /** 기록이 있는 끝 (00:00부터 초). 오늘이면 지금, 지난 날이면 86400 */
  until: number
  /** from·to는 00:00부터 초 */
  rows: { key: string; label: string; segments: { state: StateCode; from: number; to: number }[] }[]
}
