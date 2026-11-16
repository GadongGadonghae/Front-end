// 상태 관련 순수 함수 (기능명세서 3.1)
import type { DowntimeCode, StateCode } from '@/types/state'

/** 상태 명칭 (D-09) */
export const STATE_NAME: Record<StateCode, string> = { R: '가동', S: '정지', I: '대기', D: '고장' }

/** 비가동 코드 명칭 (D-13) */
export const DOWNTIME_NAME: Record<DowntimeCode, string> = {
  planned: '계획정지',
  setup: '계획정지(셋업)',
  starved: '재공부족',
  blocked: '작업지연',
  fault: '장비고장',
  'fault-alarm': '장비고장(알람)',
  safety: '안전문제',
}

/** 대표 상태: 가장 나쁜 상태, D > I > S > R (기능명세서 3.1) */
const SEVERITY: StateCode[] = ['D', 'I', 'S', 'R']
export function worstState(states: Iterable<StateCode>): StateCode {
  const set = new Set(states)
  return SEVERITY.find((s) => set.has(s)) ?? 'R'
}

/** 상태별 대수 */
export function countByState(states: Iterable<StateCode>): Record<StateCode, number> {
  const out: Record<StateCode, number> = { R: 0, S: 0, I: 0, D: 0 }
  for (const s of states) out[s] += 1
  return out
}
