// 데모 장면: 시안 B와 같은 상황을 "지금"을 기준으로 다시 만든다.
// 값은 데모용으로 지어낸 것이며 명세 수치가 아니다 (CLAUDE.md). 화면에 "데모 값"을 표시한다.
import type { DowntimeCode, PdmLevel, StateCode } from '@/types/state'

/** 지금보다 몇 초 전에 시작했는지로 적는다 → 데모를 언제 열어도 지속시간이 맞게 흐른다 */
export interface ScenarioState {
  equipmentId: string
  state: Exclude<StateCode, 'R'>
  code: DowntimeCode
  detail: string | null
  agoSec: number
}

/** 지금 R이 아닌 설비 (나머지는 모두 R) */
export const CURRENT_STATES: ScenarioState[] = [
  { equipmentId: 'L2-PRS-3', state: 'D', code: 'fault-alarm', detail: 'Pressure 1 상한 초과 (356 / 350)', agoSec: 11 * 60 + 56 },
  { equipmentId: 'L2-PRS-4', state: 'I', code: 'starved', detail: '앞 공정 정지', agoSec: 11 * 60 + 28 },
  { equipmentId: 'L2-WLD', state: 'I', code: 'starved', detail: '앞 공정 정지', agoSec: 11 * 60 + 3 },
  { equipmentId: 'L4-SLT', state: 'S', code: 'setup', detail: '코일 교체', agoSec: 22 * 60 + 8 },
]

/** R 설비가 지금 상태로 이어진 시간 (모두 같게 둠) */
export const RUN_AGO_SEC = 4 * 3600 + 2 * 60 + 15

/** 예지보전 80% 이상인 설비 */
export const PDM: { equipmentId: string; level: PdmLevel; item: string; percent: number }[] = [
  { equipmentId: 'L1-WLD', level: 'warn', item: '전류', percent: 84 },
  { equipmentId: 'L5-PRS-2', level: 'danger', item: 'Pressure 1', percent: 92 },
]

/** 오늘 끝난 상태 이력: 시작은 지금보다 agoSec 전, 길이 durSec */
export const PAST_STATES: (Omit<ScenarioState, 'agoSec'> & { agoSec: number; durSec: number; memo?: [string, string] })[] = [
  { equipmentId: 'L6-WLD', state: 'D', code: 'safety', detail: '비상정지 (BX)', agoSec: 2 * 3600 + 49 * 60 + 49, durSec: 6 * 60 + 12, memo: ['안전 펜스 센서 점검 후 복귀', '이민재'] },
  { equipmentId: 'PT-PNT-2', state: 'D', code: 'fault-alarm', detail: '건조로 온도 상한 초과', agoSec: 4 * 3600 + 17 * 60 + 5, durSec: 18 * 60 + 40, memo: ['버너 출력 조정', '김현수'] },
  { equipmentId: 'L1-SLT', state: 'I', code: 'starved', detail: '코일 공급 지연', agoSec: 5 * 3600 + 28 * 60 + 24, durSec: 4 * 60 + 5, memo: ['입고 대차 지연', '이민재'] },
  { equipmentId: 'L3-PRS-1', state: 'S', code: 'planned', detail: '금형 교체', agoSec: 8 * 3600 + 48, durSec: 25 * 60 },
]

/** 라인별 오늘 실적 시작값 (출고 양품). 1초 틱마다 확률적으로 늘어난다 */
export const LINE_DONE: Record<string, number> = { L1: 131, L2: 108, L3: 127, L4: 119, L5: 130, L6: 127, PT: 751 }

export const INBOUND = { today: 24, stock: 37 }

/** 오늘 공장 목표 (DT-016). 라인 계획 = 목표 ÷ 가동 라인 6 = 200 (D-87) */
export const TARGET = 1200

/** 오늘 OEE (데모). 3요소 곱 ≈ OEE */
export const PLANT_OEE = { oee: 78.4, availability: 89.1, performance: 92.0, quality: 95.6 }

/** 라인별 OEE·공정별 불량 제외·공정 사이 재공 (데모) */
export const LINE_DETAIL: Record<string, { oee: number; ng: { B?: number; C?: number; D?: number; E?: number }; wip: [number, number] }> = {
  L1: { oee: 81.2, ng: { B: 1, C: 1, D: 1 }, wip: [5, 2] },
  L2: { oee: 68.9, ng: { B: 1, C: 3, D: 3 }, wip: [6, 0] },
  L3: { oee: 80.4, ng: { B: 1, C: 2, D: 1 }, wip: [4, 1] },
  L4: { oee: 76.0, ng: { B: 0, C: 2, D: 0 }, wip: [0, 2] },
  L5: { oee: 79.3, ng: { B: 1, C: 2, D: 0 }, wip: [5, 1] },
  L6: { oee: 82.1, ng: { B: 0, C: 1, D: 1 }, wip: [3, 1] },
  PT: { oee: 84.0, ng: { E: 3 }, wip: [5, 0] },
}

/** 출고 비전 불량 수 (데모) */
export const OUTBOUND_NG = 9

/** 시간대별 생산 비율 (데모). 지난 시간에 실적을 이 비율로 나눠 그린다 */
export const HOURLY_WEIGHT = [48, 50, 51, 47, 52, 50, 49, 53, 51, 46, 52, 50, 54, 51, 49, 52, 50, 48, 51, 50, 49, 52, 50, 51]

/** 오늘 예지보전 위험(90%) 이력: 지금 진행 중 */
export const RISK_EVENTS = [{ equipmentId: 'L5-PRS-2', item: 'Pressure 1', agoSec: 29 * 60 + 37, maxPercent: 92 }]
