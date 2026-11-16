// 설비 상태와 비가동 코드 (D-09, D-13, 용어집 "비가동 코드 표")

/** 설비 상태 RSID: R 가동 · S 정지(계획) · I 대기 · D 고장·알람 */
export type StateCode = 'R' | 'S' | 'I' | 'D'

/** 비가동 코드 (DT-007). 화면 이름은 lib/labels에서 */
export type DowntimeCode =
  | 'planned'      // 계획정지 (S)
  | 'setup'        // 계획정지(셋업) (S)
  | 'starved'      // 재공부족 (I)
  | 'blocked'      // 작업지연 (I)
  | 'fault'        // 장비고장 (D)
  | 'fault-alarm'  // 장비고장(알람) (D)
  | 'safety'       // 안전문제 (D)

/** 예지보전 등급: 80% 이상 주의, 90% 이상 위험 (D-58, D-59) */
export type PdmLevel = 'warn' | 'danger'
