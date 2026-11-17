// 생산 집계 (데이터정의서 DT-018 시간대 생산, API 명세 5.2)
import type { LineId } from '@/types/plant'

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
