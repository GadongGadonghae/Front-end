// 이벤트 (데이터정의서 6장 DT-013 상태 이력, DT-020 예지보전 위험 이력)
import type { DowntimeCode, StopState } from '@/types/state'

/** DT-013 상태 이력: R이 아닌 구간 1건 (FN-006) */
export interface StateEvent {
  id: string
  equipmentId: string
  state: StopState
  code: DowntimeCode
  detail: string | null
  start: string
  /** 진행 중이면 null */
  end: string | null
  memo: string | null
  /** 조치 담당자 = 메모를 저장한 사용자 (D-84) */
  memoBy: string | null
  memoAt: string | null
  /** 계획수정 보고서 (D 건만). 없으면 null */
  reportId: string | null
}

/** DT-020 예지보전 위험 이력 (위험 90% 진입 ~ 해제) */
export interface RiskEvent {
  id: string
  equipmentId: string
  item: string
  start: string
  end: string | null
  maxPercent: number
}

/** 실시간 알람 이벤트: 상태 이력이 생기거나 끝날 때 (토스트·알림 열) */
export interface AlarmEvent {
  kind: 'raised' | 'cleared'
  event: StateEvent
}

/** DT-014 알림 발송 결과. 메일·슬랙은 고장(D)만 보낸다 (FN-005, D-63) */
export interface NotifyResult {
  email: boolean
  slack: boolean
}

/** API-070 이력 표 한 건: 상태 이력 + 발송 결과 (D가 아니면 null) */
export interface HistoryEvent extends StateEvent {
  notify: NotifyResult | null
}

/** API-070 조회 조건. 기간은 날짜(YYYY-MM-DD) 두 개, 최대 31일 (D-66) */
export interface HistoryQuery {
  from: string
  to: string
  lineId?: string
  process?: string
  states: StopState[]
  code?: DowntimeCode
  ongoing?: boolean
  page: number
}

/** API-071 예지보전 위험 탭 조회 조건 */
export interface RiskQuery {
  from: string
  to: string
  lineId?: string
  page: number
}
