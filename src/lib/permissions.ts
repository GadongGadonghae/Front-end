// 계정 권한 (11/20 팀 결정). 백엔드 auth/Roles.java와 같은 표 — 백엔드도 같은 기준으로 저장 요청을 403으로 막아요.
//   기능                       공장장  생산관리팀장  라인 담당자
//   기록 열람 (화면 조회 전부)    O        O           O
//   memo      알람 이력 조치 작성   -        O           O
//   target    생산 목표 설정        O        -           -
//   limits    관리값 기준 설정      -        O           -
//   users     사용자 관리           O        -           -
//   reportWrite   AI 리포트 작성    -        O           -
//   reportApprove AI 리포트 승인    O        -           -
//   캠퍼스장: 기록 열람만
// 권한이 없는 설정 탭은 메뉴에서 숨겨요 (11/20 결정)
import type { UserRole } from '@/types/user'

export type Permission = 'memo' | 'target' | 'limits' | 'users' | 'reportWrite' | 'reportApprove'

const GRANTS: Record<UserRole, readonly Permission[]> = {
  PLANT_MANAGER: ['target', 'users', 'reportApprove'],
  PRODUCTION_MANAGER: ['memo', 'limits', 'reportWrite'],
  LINE_MANAGER: ['memo'],
  // 캠퍼스장 (11/20): 보기 전용. /mes 새 프론트에서 보고서를 봐요
  CAMPUS_HEAD: [],
}

export const isRole = (r: unknown): r is UserRole => typeof r === 'string' && r in GRANTS

export function allows(role: UserRole | null | undefined, p: Permission): boolean {
  return !!role && GRANTS[role].includes(p)
}

/** 설정 탭: 권한 있는 것만 (순서 = 메뉴 순서) */
export const SETTINGS_TABS: { key: 'target' | 'limits' | 'users'; label: string; to: string }[] = [
  { key: 'target', label: '생산 목표', to: '/settings/target' },
  { key: 'limits', label: '관리값 기준', to: '/settings/limits' },
  { key: 'users', label: '사용자 관리', to: '/settings/users' },
]
export const settingsTabsFor = (role: UserRole | null | undefined) => SETTINGS_TABS.filter((t) => allows(role, t.key))
