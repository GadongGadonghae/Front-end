// 설비 → 그 설비를 보는 화면 경로 (FRONTEND.md 5장 라우트 표). 순수 함수
import type { Equipment, LineId, ProcessId } from '@/types/plant'

const PROCESS_SEGMENT: Record<string, string> = { SLITTING: 'slit', PRESS: 'press', WELDING: 'weld' }

/** 설비의 공정 상세 경로. 쿼리 eq로 처음 선택할 설비를 넘긴다 (화면정의서 SCR-002 3번) */
export function equipmentPath(e: Equipment): string {
  if (e.process === 'COIL') return '/inbound'
  if (e.process === 'INSPECTION') return `/outbound?eq=${e.id}`
  if (e.process === 'PAINTING') return `/lines/PT/paint?eq=${e.id}`
  return `/lines/${e.area}/${PROCESS_SEGMENT[e.process]}?eq=${e.id}`
}

/** 라인 상세 경로 */
export function linePath(id: LineId): string {
  return `/lines/${id}`
}

/** 라인 안 공정 상세 경로 (이벤트: 라인 흐름의 공정 이름 클릭, SCR-010) */
export function processPath(lineId: LineId, process: ProcessId): string {
  if (process === 'PAINTING') return '/lines/PT/paint'
  return `/lines/${lineId}/${PROCESS_SEGMENT[process]}`
}

/** 주소의 공정 이름 → 공정 ID */
export const SEGMENT_PROCESS: Record<string, ProcessId> = { slit: 'SLITTING', press: 'PRESS', weld: 'WELDING', paint: 'PAINTING' }
