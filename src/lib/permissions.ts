// 계정 권한 — 기준은 lib/access.ts (MES 명세와 같은 표, 백엔드 auth/Roles.java). 여기는 설정 탭 같은 편의 함수만 (11/20)
//   보기 = 모두 · 조치 쓰기(action) = 팀장, 라인 담당자(본인 라인) · 생산 목표(target)·사용자 관리(users)·결재(reportApprove) = 공장장
//   관리값(limits)·AI 리포트 작성(reportWrite) = 팀장 · 임시 MES(mes) = 캠퍼스장
// 권한이 없는 설정 탭은 메뉴에서 숨겨요 (11/20 결정)
import { allowed, ROLE_NAME, type Perm } from '@/lib/access'
import type { AppRole } from '@/types/user'

export type Permission = Perm

export const isRole = (r: unknown): r is AppRole => typeof r === 'string' && r in ROLE_NAME

/** 설비와 상관없는 권한 확인 (설정 탭 등) */
export const allows = (role: AppRole | null | undefined, p: Permission) => allowed(role ?? null, [], p)

/** 설정 탭: 권한 있는 것만 (순서 = 메뉴 순서) */
export const SETTINGS_TABS: { key: 'target' | 'limits' | 'users'; label: string; to: string }[] = [
  { key: 'target', label: '생산 목표', to: '/settings/target' },
  { key: 'limits', label: '관리값 기준', to: '/settings/limits' },
  { key: 'users', label: '사용자 관리', to: '/settings/users' },
]
export const settingsTabsFor = (role: AppRole | null | undefined) => SETTINGS_TABS.filter((t) => allows(role, t.key))
