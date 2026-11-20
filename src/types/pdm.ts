// 예지보전 (SCR-004, FN-007). API-060 위험도 목록 · 웹소켓 risk 5초 · API-061 상한 도달 예상
import type { EquipmentTypeCode } from '@/types/plant'
import type { MetricSource } from '@/types/process'

/** 관리값 항목 하나의 위험도 */
export interface RiskItem {
  item: string
  unit: string
  /** 없으면 process */
  source?: MetricSource
  lower: number | null
  upper: number | null
  /** 최근 10분 평균 (D-58). 값이 없으면 null */
  avg10: number | null
  /** 평균이 범위 가운데에서 상한(또는 하한)까지 간 비율 %. 하한 없이 상한만 있는 항목(진동)은 0에서 상한까지 간 비율. 기준이 미정이면 null. 100을 넘으면 이미 벗어남 */
  percent: number | null
}

/** 설비 하나의 위험도 = 항목 중 가장 큰 값 (D-59) */
export interface EquipmentRisk {
  equipmentId: string
  type: EquipmentTypeCode
  /** 가장 큰 항목. 모든 항목의 기준이 미정이면 null */
  percent: number | null
  item: string | null
  items: RiskItem[]
}

/** API-061 상한(또는 하한) 도달 예상 [차순위] */
export interface PdmEta {
  equipmentId: string
  item: string
  /** 몇 초 뒤 도달. 다가가지 않으면 null */
  etaSec: number | null
  /** 기울기 (단위/시간). 상한 쪽이 +, 하한 쪽이 − */
  slopePerHour: number | null
  /** 어느 쪽 기준에 다가가는지 */
  toward: 'upper' | 'lower' | null
  /** 기울기를 잰 구간 (초) */
  basisSec: number
}
