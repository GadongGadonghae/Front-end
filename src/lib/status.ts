// 상태 관련 순수 함수 (기능명세서 3.1)
import type { DowntimeCode, StateCode } from '@/types/state'
import type { ProcessId } from '@/types/plant'

/** 상태 명칭 (D-09) */
export const STATE_NAME: Record<StateCode, string> = { R: '가동', S: '정지', I: '대기', D: '고장', DC: '통신 끊김' }

/** 비가동 사유 명칭 (백엔드 API v3.1 reasonCode) */
export const DOWNTIME_NAME: Record<DowntimeCode, string> = {
  PL_SHIFT: '교대',
  PL_PM: '예방보전',
  PL_CHANGE: '모델 교체',
  PL_SETUP: '코일·나이프 교체',
  UP_SHORTAGE: '재공부족',
  UP_DELAY: '작업지연',
  UP_BREAKDOWN: '장비고장',
  UP_ALARM: '알람(관리값 이탈)',
  UP_SAFETY: '안전문제',
  UP_LABOR: '노사협의',
  UP_ETC: '기타',
}

/** 대표 상태: 가장 나쁜 상태, D > DC > S > I > R (백엔드 API v3.1) */
const SEVERITY: StateCode[] = ['D', 'DC', 'S', 'I', 'R']
export function worstState(states: Iterable<StateCode>): StateCode {
  const set = new Set(states)
  return SEVERITY.find((s) => set.has(s)) ?? 'R'
}

/** 상태별 대수 */
export function countByState(states: Iterable<StateCode>): Record<StateCode, number> {
  const out: Record<StateCode, number> = { R: 0, S: 0, I: 0, D: 0, DC: 0 }
  for (const s of states) out[s] += 1
  return out
}

/** 공정 이름 (D-02). 검사(INSPECTION)는 화면에서 "출고" */
export const PROCESS_NAME: Record<ProcessId, string> = { COIL: '코일입고', SLITTING: '슬리팅', PRESS: '프레스', WELDING: '용접', PAINTING: '도장', INSPECTION: '출고' }

/** 알람 등급 이름 (백엔드 WARNING·CRITICAL). 등급 기준은 백엔드 미정 */
export const ALARM_LEVEL_NAME = { WARNING: '경고', CRITICAL: '심각' } as const

/** 공정 흐름 순서 (정렬용) */
export const PROCESS_ORDER: Record<ProcessId, number> = { COIL: 1, SLITTING: 2, PRESS: 3, WELDING: 4, PAINTING: 5, INSPECTION: 6 }
export const byProcess = (a: ProcessId, b: ProcessId) => PROCESS_ORDER[a] - PROCESS_ORDER[b]

/** 라인 이름: A~F는 "A라인", 도장 구역은 "도장" */
export function lineName(id: string): string {
  return id === 'PT' ? '도장' : id === 'VI' ? '출고' : `${id}라인`
}

/** 프레스 단별 작업 (화면정의서 SCR-002-3, D-80). 큰 칸·카드에서 "1단 성형"처럼 붙인다 */
export const PRESS_STAGE_WORK: Record<number, string> = { 1: '성형', 2: '트림', 3: '피어싱', 4: '플랜지' }

/** 큰 칸·카드용 설비 이름: 프레스는 단 + 작업 */
export function longShortName(e: { process: ProcessId; order: number; shortName: string }): string {
  return e.process === 'PRESS' ? `${e.shortName} ${PRESS_STAGE_WORK[e.order] ?? ''}`.trim() : e.shortName
}
