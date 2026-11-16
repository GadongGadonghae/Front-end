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
