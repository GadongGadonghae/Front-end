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

/** 화면 권한용 계정 종류 (11/20 확정, 프론트 데모): 공장장 · 생산 관리 팀장 · 라인 담당자 · 캠퍼스장(보기 전용 + 임시 MES) */
export type AppRole = 'PLANT_HEAD' | 'PROD_LEAD' | 'LINE_WORKER' | 'CAMPUS'

/** 데모 로그인 계정 */
export interface DemoAccount {
  loginId: string
  password: string
  name: string
  role: AppRole
  /** 라인 담당자의 담당 라인 (조치 쓰기 범위). 나머지 계정은 빈 배열 */
  lines: string[]
}
