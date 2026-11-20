// 사용자 관리 (API 명세 C-02 목록 · C-03 등록, 11/20)

/** 역할: ADMIN 관리자 · MANAGER 생산관리 · OPERATOR 작업자 */
export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR'

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
