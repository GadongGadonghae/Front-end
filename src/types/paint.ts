// 도장 운영 판단 (11/21, 백엔드 PT-01·PT-02): 가동 라인 수에 맞춰 도장 몇 대를, 어느 경로로 쓸지
import type { StateCode } from '@/types/state'

export interface PaintBooth {
  paintId: string
  /** 지금 상태 (R·S·I·D·DC) */
  state: StateCode
  /** 물량 적음 운휴(계획정지) 중 */
  parked: boolean
  /** 쓸 수 있음 (고장·통신 끊김 아님) */
  usable: boolean
  nowLines: string[]
  /** 0~1 (도장 1대를 다 쓰면 1) */
  nowLoad: number
  planLines: string[]
  planLoad: number
  planOn: boolean
}

export interface PaintPlan {
  at: string
  paintCt: number
  lineCt: number
  /** 라인 1개의 도장 부하 (도장 CT ÷ 라인 박자) */
  lineLoad: number
  /** 도장 1대 부하 상한 · 합칠 때 상한 */
  rho: number
  rhoMerge: number
  running: string[]
  booths: PaintBooth[]
  changes: { lineId: string; from: string; to: string }[]
  turnOn: string[]
  turnOff: string[]
  overloaded: boolean
  noBooth: boolean
  changeNeeded: boolean
  verdict: string
  reasons: string[]
  /** 운휴로 아끼는 도장 가동 분 (근무 끝까지) */
  savedMinutes: number | null
}
