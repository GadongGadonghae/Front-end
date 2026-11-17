// 상태 관련 순수 함수 (기능명세서 3.1)
import type { DowntimeCode, StateCode } from '@/types/state'
import type { ProcessId } from '@/types/plant'

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

/** 공정 이름 (D-02) */
export const PROCESS_NAME: Record<ProcessId, string> = { A: '코일입고', B: '슬리팅', C: '프레스', D: '용접', E: '도장', F: '출고' }

/** 프레스 단별 작업 (화면정의서 SCR-002-3, D-80). 큰 칸·카드에서 "1단 성형"처럼 붙인다 */
export const PRESS_STAGE_WORK: Record<number, string> = { 1: '성형', 2: '트림', 3: '피어싱', 4: '플랜지' }

/** 큰 칸·카드용 설비 이름: 프레스는 단 + 작업 */
export function longShortName(e: { process: ProcessId; order: number; shortName: string }): string {
  return e.process === 'C' ? `${e.shortName} ${PRESS_STAGE_WORK[e.order] ?? ''}`.trim() : e.shortName
}
