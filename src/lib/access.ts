// 계정별 권한 (11/20 확정, 프로젝트_현황.md "계정별 권한")
// ① 보기 = 모두 · ② 알람이력 조치 쓰기 = 팀장, 라인 담당자(본인 라인만) · ③ 생산 목표 = 공장장 · ④ 관리값 기준 = 팀장
// ⑤ 사용자 관리 = 공장장 · ⑥ AI 리포트 작성 = 팀장, 결재·전송 = 공장장 · 캠퍼스장 = 보기 + 임시 MES 열람
import type { AppRole } from '@/types/user'

export type Perm = 'action' | 'target' | 'limits' | 'users' | 'reportWrite' | 'reportApprove' | 'mes'

export const ROLE_NAME: Record<AppRole, string> = {
  PLANT_HEAD: '공장장',
  PROD_LEAD: '생산 관리 팀장',
  LINE_WORKER: '라인 담당자',
  CAMPUS: '캠퍼스장',
}

const GRANTS: Record<AppRole, Perm[]> = {
  PLANT_HEAD: ['target', 'users', 'reportApprove'],
  PROD_LEAD: ['action', 'limits', 'reportWrite'],
  LINE_WORKER: ['action'],
  CAMPUS: ['mes'],
}

/** 권한이 없을 때 화면에 쓰는 문구: "공장장만 할 수 있습니다" */
export const PERM_OWNER: Record<Perm, string> = {
  action: '생산 관리 팀장·라인 담당자(본인 라인)',
  target: '공장장',
  limits: '생산 관리 팀장',
  users: '공장장',
  reportWrite: '생산 관리 팀장',
  reportApprove: '공장장',
  mes: '캠퍼스장',
}

/** 설비 ID → 라인 ("A-PR1" → "A"). 도장·비전·출하 같은 공용 설비는 null */
export function lineOfEquipment(equipmentId: string): string | null {
  const m = /^([A-F])-/.exec(equipmentId)
  return m ? m[1] : null
}

/** 권한 확인. 조치 쓰기는 라인 담당자면 설비의 라인이 담당 라인이어야 한다 */
export function allowed(role: AppRole | null, lines: string[], perm: Perm, equipmentId?: string): boolean {
  if (!role || !GRANTS[role].includes(perm)) return false
  if (perm === 'action' && role === 'LINE_WORKER') {
    const line = equipmentId ? lineOfEquipment(equipmentId) : null
    return line !== null && lines.includes(line)
  }
  return true
}
