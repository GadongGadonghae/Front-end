// 실시간 채널로 오는 값 (데이터정의서 2장 ③ 현재 상태, 7장 실시간 push)
import type { DowntimeCode, PdmLevel, StateCode } from '@/types/state'
import type { LineId } from '@/types/plant'

/** 설비 1대의 현재 상태 (③, 저장 안 함) */
export interface EquipmentLive {
  id: string
  state: StateCode
  /** R이면 null */
  code: DowntimeCode | null
  /** 상세: 트립명·이탈 항목 등 (예: Pressure 1 상한 초과) */
  detail: string | null
  /** 지금 상태가 시작된 시각 (ISO) */
  since: string
  /** 예지보전: 위험도가 가장 높은 항목. 80% 미만이면 null */
  pdm: { level: PdmLevel; item: string; percent: number } | null
}

/** 라인별 오늘 실적 (라인 계획은 목표 ÷ 가동 라인 수로 계산, D-87) */
export interface LineOutput {
  lineId: LineId
  done: number
}

/** 1초마다 오는 공장 전체 스냅샷 (API 명세 3.3 snapshot) */
export interface PlantSnapshot {
  /** 이 스냅샷의 시각 (ISO) */
  at: string
  equipment: EquipmentLive[]
  /** 공장 오늘 실적 = 출고 양품 수 (D-47) */
  plant: { done: number }
  lines: LineOutput[]
  /** 코일입고: 오늘 입고 코일 수, 슬리팅 앞 재고 (D-48) */
  inbound: { today: number; stock: number }
}

/** OEE와 3요소 (%). 부하시간 0이면 null (FN-004) */
export interface Oee {
  oee: number | null
  availability: number | null
  performance: number | null
  quality: number | null
}

/** 공정 ID별 수량 (B 슬리팅 · C 프레스 · D 용접 · E 도장) */
export type ByProcess = Partial<Record<'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING', number>>

/** 라인 오늘 요약 */
export interface LineSummary {
  lineId: LineId
  /** 목표 ÷ 가동 라인 수 (D-87). 목표 없으면 null */
  plan: number | null
  done: number
  rate: number | null
  oee: number | null
  ngByProcess: ByProcess
  /** 공정 사이 재공 */
  wip: { from: string; to: string; qty: number }[]
}

/** 10초마다 오는 오늘 요약 (API 명세 3.3 summary) */
export interface PlantSummary {
  at: string
  plant: {
    /** 오늘 목표. 없으면 null → "목표 미설정" (D-72) */
    target: number | null
    done: number
    rate: number | null
    oee: Oee
    quality: {
      ngByProcess: ByProcess
      outbound: { inspected: number; ok: number; ng: number; rate: number | null }
    }
  }
  lines: LineSummary[]
}

/** 제품이 다음 설비로 넘어갈 때 (물류 점, D-81) */
export interface ProductMove {
  at: string
  productId: string
  from: string | null
  to: string | null
  /** 공정 검사 불량이면 그 자리에서 제외 (D-88) */
  rejected: boolean
}
