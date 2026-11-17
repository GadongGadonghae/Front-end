// 설비 → 그 설비를 보는 화면 경로 (FRONTEND.md 5장 라우트 표). 순수 함수
import type { Equipment, LineId } from '@/types/plant'

const PROCESS_SEGMENT: Record<string, string> = { B: 'slit', C: 'press', D: 'weld' }

/** 설비의 공정 상세 경로. 쿼리 eq로 처음 선택할 설비를 넘긴다 (화면정의서 SCR-002 3번) */
export function equipmentPath(e: Equipment): string {
  if (e.process === 'A') return '/inbound'
  if (e.process === 'F') return `/outbound?eq=${e.id}`
  if (e.process === 'E') return `/lines/PT/paint?eq=${e.id}`
  return `/lines/${e.area}/${PROCESS_SEGMENT[e.process]}?eq=${e.id}`
}

/** 라인 상세 경로 */
export function linePath(id: LineId): string {
  return `/lines/${id}`
}
