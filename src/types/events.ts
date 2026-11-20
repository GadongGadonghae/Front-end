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
  /** 관리값 이탈 알람(UP_ALARM)의 등급 (백엔드 alarm.level). 그 밖의 건은 null */
  alarmLevel?: AlarmLevel | null
}

/** 알람 등급 (백엔드 M-04·W-02). 등급 기준은 백엔드 미정 */
export type AlarmLevel = 'WARNING' | 'CRITICAL'

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

/** DT-014 알림 발송 결과. 고장(D)만 메일로 보낸다 (FN-005, D-63). 슬랙은 쓰지 않음 (D-110) */
export interface NotifyResult {
  email: boolean
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
  /** 이 길이(분) 이상만 (백엔드 minMinutes, 기본 1) */
  minMinutes?: number
  /** 아직 손볼 건만 (D-109). 백엔드 조건 없음 → 화면 쪽에서 거른다 */
  todo?: HistoryTodo
  page: number
}

/** 왼쪽 열 "아직 손볼 건" (D-111): 진행 중 고장 · 메일 발송 실패 */
export type HistoryTodo = 'ongoingFault' | 'notifyFail'

/** SCR-006 왼쪽 요약 열 (D-109): 고른 기간 · 라인 · 공정의 비가동 건을 코드별로 센 것과 손볼 건 수.
 *  백엔드 API 없음 (요청 필요) → 지금은 이력을 모두 불러 센다 */
export interface HistorySummary {
  byCode: { code: DowntimeCode; state: StopState; count: number; sec: number }[]
  todo: Record<HistoryTodo, number>
}

/** 요약 조회 조건: 상태 · 코드 · 진행 중 · 손볼 건은 요약 안에서 나누므로 받지 않는다. minMinutes는 표와 같은 값을 준다 */
export type HistorySummaryQuery = Pick<HistoryQuery, 'from' | 'to' | 'lineId' | 'process' | 'minMinutes'>

/** API-071 예지보전 위험 탭 조회 조건 */
export interface RiskQuery {
  from: string
  to: string
  lineId?: string
  page: number
}
