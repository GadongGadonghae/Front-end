// 설비 상태와 비가동 코드 (D-09, D-13, 용어집 "비가동 코드 표")

/** 설비 상태: R 가동 · S 정지(계획) · I 대기 · D 고장·알람 · DC 통신 끊김 (백엔드 API v3.1)
 *  DC는 가동률에서 R로 세고 비가동 이력이 생기지 않는다 */
export type StateCode = 'R' | 'S' | 'I' | 'D' | 'DC'

/** 비가동 이력이 생기는 상태 (DC는 R로 세서 이력이 없다) */
export type StopState = 'S' | 'I' | 'D'

/** 비가동 사유 코드 (백엔드 API v3.1 reasonCode). 화면 이름은 lib/status DOWNTIME_NAME */
export type DowntimeCode =
  | 'PL_SHIFT'      // 교대 (S)
  | 'PL_PM'         // 예방보전 (S)
  | 'PL_CHANGE'     // 모델 교체 (S)
  | 'PL_SETUP'      // 코일·나이프 교체 (S)
  | 'PL_STANDBY'    // 물량 적음 운휴 (S)
  | 'UP_SHORTAGE'   // 재공부족 (I, 자동)
  | 'UP_BLOCKED'    // 후공정 정지 대기 (I, 자동: 프레스 1~3단이 끝낸 제품을 들고 뒤 단을 기다림, 11/20)
  | 'UP_DELAY'      // 작업지연 (I, 사람이 고침)
  | 'UP_BREAKDOWN'  // 장비고장 (D)
  | 'UP_ALARM'      // 알람·관리값 이탈 (D)
  | 'UP_SAFETY'     // 안전문제 (D)
  | 'UP_LABOR'      // 노사협의 (D) ❓ 백엔드 미정
  | 'UP_ETC'        // 기타 (D)

/** 예지보전 등급: 80% 이상 주의, 90% 이상 위험 (D-58, D-59) */
export type PdmLevel = 'warn' | 'danger'
