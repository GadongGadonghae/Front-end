// 사용자 관리 (API 명세 C-02 목록 · C-03 등록, 11/20)

/** 역할(권한, 11/20): 공장장 · 생산관리팀장 · 라인 담당자 · 캠퍼스장. 백엔드 users.role과 같은 코드 (DB v0.3.15, MES 명세).
 *  할 수 있는 일은 lib/access.ts */
export type UserRole = AppRole

export const ROLE_LABEL: Record<UserRole, string> = {
  PLANT_HEAD: '공장장',
  PROD_LEAD: '생산관리팀장',
  LINE_WORKER: '라인 담당자',
  CAMPUS: '캠퍼스장',
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
  /** 라인 담당자의 담당 라인 (예: ['A','B'], v0.3.15) */
  lines?: string[]
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
