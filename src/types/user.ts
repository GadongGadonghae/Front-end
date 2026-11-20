// 사용자 관리 (API 명세 C-02 목록 · C-03 등록, 11/20)

/** 역할(권한, 11/20): 공장장 · 생산관리팀장 · 라인 담당자. 할 수 있는 일은 lib/permissions.ts */
export type UserRole = 'PLANT_MANAGER' | 'PRODUCTION_MANAGER' | 'LINE_MANAGER'

export const ROLE_LABEL: Record<UserRole, string> = {
  PLANT_MANAGER: '공장장',
  PRODUCTION_MANAGER: '생산관리팀장',
  LINE_MANAGER: '라인 담당자',
}

/** C-02 한 줄 */
export interface UserRow {
  loginId: string
  name: string
  role: string
  email: string | null
  memo: string | null
  /** 마지막 로그인. 한 번도 안 했으면 null */
  lastLoginAt: string | null
}

/** C-03 등록 입력 */
export interface NewUser {
  loginId: string
  password: string
  name: string
  role: UserRole
  email?: string
  memo?: string
}
