// 데모 장면: 시안 B와 같은 상황을 "지금"을 기준으로 다시 만든다.
// 값은 데모용으로 지어낸 것이며 명세 수치가 아니다 (CLAUDE.md). 화면에 "데모 값"을 표시한다.
import type { DowntimeCode, PdmLevel, StopState } from '@/types/state'

/** 지금보다 몇 초 전에 시작했는지로 적는다 → 데모를 언제 열어도 지속시간이 맞게 흐른다 */
export interface ScenarioState {
  equipmentId: string
  state: StopState
  code: DowntimeCode
  detail: string | null
  agoSec: number
}

/** 지금 R이 아닌 설비 (나머지는 모두 R) */
export const CURRENT_STATES: ScenarioState[] = [
  { equipmentId: 'B-PR3', state: 'D', code: 'UP_ALARM', detail: 'Pressure 1 상한 초과 (356 / 350)', agoSec: 11 * 60 + 56 },
  { equipmentId: 'B-PR4', state: 'I', code: 'UP_SHORTAGE', detail: '앞 공정 정지', agoSec: 11 * 60 + 28 },
  { equipmentId: 'B-WD', state: 'I', code: 'UP_SHORTAGE', detail: '앞 공정 정지', agoSec: 11 * 60 + 3 },
  { equipmentId: 'D-SL', state: 'S', code: 'PL_SETUP', detail: '코일 교체', agoSec: 22 * 60 + 8 },
]

/** 지금 통신이 끊긴 설비 (DC). 상태 신호가 10초 넘게 안 와서 백엔드가 DC로 판정한 것 (데모). 사유·비가동 이력은 없다 */
export const CURRENT_DC = [{ equipmentId: 'F-PR3', agoSec: 2 * 60 + 40 }]

/** R 설비가 지금 상태로 이어진 시간 (모두 같게 둠) */
export const RUN_AGO_SEC = 4 * 3600 + 2 * 60 + 15

/** 예지보전 80% 이상인 설비 */
export const PDM: { equipmentId: string; level: PdmLevel; item: string; percent: number }[] = [
  // 용접 전류는 기준이 미정이라 위험도를 낼 수 없다 → 기준이 있는 통전시간으로 둔다
  { equipmentId: 'A-WD', level: 'warn', item: '통전시간', percent: 84 },
  { equipmentId: 'E-PR2', level: 'danger', item: 'Pressure 1', percent: 92 },
]

/** 오늘 끝난 상태 이력: 시작은 지금보다 agoSec 전, 길이 durSec */
export const PAST_STATES: (Omit<ScenarioState, 'agoSec'> & { agoSec: number; durSec: number; memo?: [string, string] })[] = [
  { equipmentId: 'F-WD', state: 'D', code: 'UP_SAFETY', detail: '비상정지 (BX)', agoSec: 2 * 3600 + 49 * 60 + 49, durSec: 6 * 60 + 12, memo: ['안전 펜스 센서 점검 후 복귀', '이민재'] },
  { equipmentId: 'PT2', state: 'D', code: 'UP_ALARM', detail: '건조로 온도 상한 초과', agoSec: 4 * 3600 + 17 * 60 + 5, durSec: 18 * 60 + 40, memo: ['버너 출력 조정', '김현수'] },
  { equipmentId: 'A-SL', state: 'I', code: 'UP_SHORTAGE', detail: '코일 공급 지연', agoSec: 5 * 3600 + 28 * 60 + 24, durSec: 4 * 60 + 5, memo: ['입고 대차 지연', '이민재'] },
  { equipmentId: 'C-PR1', state: 'S', code: 'PL_CHANGE', detail: '금형 교체', agoSec: 8 * 3600 + 48, durSec: 25 * 60 },
]

/** 라인별 오늘 실적 시작값 (출고 양품). 1초 틱마다 확률적으로 늘어난다 */
export const LINE_DONE: Record<string, number> = { A: 131, B: 108, C: 127, D: 119, E: 130, F: 127, PT: 751 }

export const INBOUND = { today: 24, stock: 37 }

/** 오늘 공장 목표 (DT-016). 라인 계획 = 목표 ÷ 가동 라인 6 = 200 (D-87) */
export const TARGET = 1200

/** 오늘 OEE (데모). 3요소 곱 ≈ OEE */
export const PLANT_OEE = { oee: 78.4, availability: 89.1, performance: 92.0, quality: 95.6 }

/** 라인별 OEE·공정별 불량 제외·공정 사이 재공 (데모) */
export const LINE_DETAIL: Record<string, { oee: number; ng: { SLITTING?: number; PRESS?: number; WELDING?: number; PAINTING?: number }; wip: [number, number] }> = {
  A: { oee: 81.2, ng: { SLITTING: 1, PRESS: 1, WELDING: 1 }, wip: [5, 2] },
  B: { oee: 68.9, ng: { SLITTING: 1, PRESS: 3, WELDING: 3 }, wip: [6, 0] },
  C: { oee: 80.4, ng: { SLITTING: 1, PRESS: 2, WELDING: 1 }, wip: [4, 1] },
  D: { oee: 76.0, ng: { SLITTING: 0, PRESS: 2, WELDING: 0 }, wip: [0, 2] },
  E: { oee: 79.3, ng: { SLITTING: 1, PRESS: 2, WELDING: 0 }, wip: [5, 1] },
  F: { oee: 82.1, ng: { SLITTING: 0, PRESS: 1, WELDING: 1 }, wip: [3, 1] },
  PT: { oee: 84.0, ng: { PAINTING: 3 }, wip: [5, 0] },
}

/** 출고 비전 불량 수 (데모) */
export const OUTBOUND_NG = 9

/** 시간대별 생산 비율 (데모). 지난 시간에 실적을 이 비율로 나눠 그린다 */
export const HOURLY_WEIGHT = [48, 50, 51, 47, 52, 50, 49, 53, 51, 46, 52, 50, 54, 51, 49, 52, 50, 48, 51, 50, 49, 52, 50, 51]

/** 오늘 예지보전 위험(90%) 이력: 지금 진행 중 */
export const RISK_EVENTS = [{ equipmentId: 'E-PR2', item: 'Pressure 1', agoSec: 29 * 60 + 37, maxPercent: 92 }]

/** 지금 고장 난 설비의 관리값 이탈: 고장 전 rampSec 동안 값이 올라 고장 시각에 to가 된다 (데모) */
export const TELEMETRY_RAMPS = [{ equipmentId: 'B-PR3', item: 'Pressure 1', to: 356, rampSec: 15 * 60 }]

/** 지금 고장과 이어진 공정 검사 불량 (데모): 고장 직전 마지막 검사에서 걸린 제품 */
export const NG_OVERRIDES = [{ lineId: 'B', process: 'PRESS', equipmentId: 'B-PR3', reason: '3단 · Pressure 1 상한 이탈', beforeFaultSec: 14 }]

/** 관리값 기준이 미정인 항목의 데모 중심값·흔들림 (기준선 없이 그린다) */
export const TELEMETRY_BASE: Record<string, { center: number; amp: number }> = {
  '출력 전류': { center: 18.4, amp: 0.9 },
  '출력 토크': { center: 6.2, amp: 0.35 },
  'DC Link 전압': { center: 311, amp: 2.5 },
  '지령 주파수': { center: 60, amp: 0 },
  '출력 주파수': { center: 59.92, amp: 0.05 },
  '가압력': { center: 3.1, amp: 0.12 },
  '전류': { center: 9.6, amp: 0.4 },
  'pH': { center: 6.8, amp: 0.08 },
  '온도': { center: 28.5, amp: 0.6 },
  '건조로 온도': { center: 182, amp: 2.4 },
  // 기준은 있지만 기준 가운데보다 실제 운전값이 치우친 항목
  'Pressure 1': { center: 288, amp: 6 },
  'Pressure 2': { center: 281, amp: 6 },
  'Pressure 5 (합계)': { center: 569, amp: 10 },
  'Press time': { center: 560, amp: 14 },
  '전압': { center: 2.6, amp: 0.08 },
  '통전시간': { center: 78, amp: 2.5 },
}

/** 다른 날·주·월 생산의 데모 범위 (하루 라인별 출고 양품) */
export const PAST_LINE_DONE = { min: 182, max: 201 }

/** 출고 불량을 라인에 나눈 수 (합 = OUTBOUND_NG) */
export const OUTBOUND_NG_BY_LINE: Record<string, number> = { A: 2, B: 1, C: 2, D: 1, E: 2, F: 1 }

/** 도장 불량을 라인에 나눈 수 (합 = 도장 E 불량 3) */
export const PAINT_NG_BY_LINE: Record<string, number> = { A: 1, C: 1, E: 1 }

/** 실설비 슬리터(A) 최근 트립 (데모): 지금보다 며칠 전 */
export const INVERTER_LAST_TRIP = { name: 'OCT 과전류', agoSec: 2 * 86400 + 22 * 3600 + 31 * 60, recoveredAfterSec: 180 }

/** 오늘 고장 건 중 슬랙 발송이 실패한 설비 (데모, D-63 "실패 표시"를 보이려고) */
export const SLACK_FAIL_TODAY = ['F-WD']

/** 지난 날 이력의 상세 문구 (데모). 장비고장(알람)은 그 설비 관리값 항목으로 "○○ 상한 초과"를 만든다 */
export const PAST_DETAIL: Record<DowntimeCode, string[]> = {
  PL_SHIFT: ['교대 인수인계'],
  PL_PM: ['정기 점검', '윤활 점검'],
  PL_CHANGE: ['금형 교체', '규격 변경'],
  PL_SETUP: ['코일 교체', '나이프 교체'],
  UP_SHORTAGE: ['앞 공정 정지', '코일 공급 지연'],
  UP_DELAY: ['뒤 공정 정지', '적재 대차 부족'],
  UP_BREAKDOWN: ['모터 과부하', '센서 이상'],
  UP_ALARM: ['인버터 트립'],
  UP_SAFETY: ['비상정지 (BX)', '안전 펜스 열림'],
  UP_LABOR: ['노사협의'],
  UP_ETC: ['기타'],
}

/** 지난 날 조치 메모와 담당자 (데모). 이력의 절반쯤에 붙인다 */
export const PAST_MEMOS: Partial<Record<DowntimeCode, [string, string][]>> = {
  UP_SHORTAGE: [['입고 대차 지연', '이민재'], ['앞 공정 복구 후 재개', '박서연']],
  UP_DELAY: [['대차 추가 투입', '박서연']],
  UP_BREAKDOWN: [['모터 교체', '김현수'], ['센서 청소 후 복귀', '이민재']],
  UP_ALARM: [['기준값 재확인 후 재가동', '김현수'], ['설비 점검 후 복귀', '박서연']],
  UP_SAFETY: [['안전 펜스 센서 점검 후 복귀', '이민재']],
  PL_PM: [['정기 점검 완료', '박서연']],
}

/** 생산 목표를 넣어 둔 지난 날 수 (데모). 그보다 오래된 날은 TARGET으로 본다 */
export const TARGET_SEED_DAYS = 40

/** 지난 날 목표 (데모): 대부분 1,200, 가끔 1,100, 6일 전은 미설정(D-72 "목표 미설정"을 보이려고) */
export function PAST_TARGET(date: string, agoDays: number): number | null {
  const day = Number(date.slice(8))
  if (agoDays === 6) return null
  return day % 5 === 0 ? 1100 : TARGET
}
