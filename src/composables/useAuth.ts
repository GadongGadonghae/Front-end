// 로그인 상태 (FN-016): 자동 로그아웃 없음, 브라우저를 닫아도 7일 유지 (D-75)
// 계정별 권한 (11/20): 공장장·생산관리 팀장·라인 담당자·캠퍼스장. 권한 표는 lib/access.ts
//   실서버: 로그인 응답(C-01)의 role·lines (백엔드 users.role·lines, DB v0.3.15)
//   데모 데이터: 프론트 데모 계정표(data/accounts)의 4종 (plant·lead·lineA·campus, 비밀번호 1234)
import { computed, ref } from 'vue'
import { source } from '@/data'
import { DEMO_ACCOUNTS, findAccount } from '@/data/accounts'
import { ROLE_NAME, allowed, type Perm } from '@/lib/access'
import { isRole } from '@/lib/permissions'
import type { AppRole } from '@/types/user'

const KEY = 'sfaas.session'
const KEEP_MS = 7 * 24 * 3600 * 1000

interface Session { loginId: string; name: string; role: AppRole; lines: string[]; expiresAt: number }

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    // 권한이 없거나 예전 이름(PLANT_HEAD 등)인 저장값은 다시 로그인
    return s.expiresAt > Date.now() && isRole(s.role) ? { ...s, lines: s.lines ?? [] } : null
  } catch {
    return null
  }
}

function write(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 창 등): 이번 창 동안만 로그인 유지
  }
}

const session = ref<Session | null>(read())

export function useAuth() {
  const loggedIn = computed(() => session.value !== null)
  const userName = computed(() => session.value?.name ?? '')
  const role = computed<AppRole | null>(() => session.value?.role ?? null)
  const roleName = computed(() => (session.value ? ROLE_NAME[session.value.role] : ''))
  const lines = computed(() => session.value?.lines ?? [])
  const loginId = computed(() => session.value?.loginId ?? '')

  /** 성공하면 true. 실패 문구는 화면이 정한다 (FN-016). 권한을 모르는 계정은 Error(문구에 '권한') */
  async function login(userId: string, password: string): Promise<boolean> {
    if (source.demo) {
      // 데모 데이터: 데모 계정 4종만 들어간다 (비밀번호 1234)
      const acc = findAccount(userId)
      if (!acc || acc.password !== password) return false
      const res = await source.cmd.login(userId, password)
      if (!res.ok) return false
      session.value = { loginId: acc.loginId, name: acc.name, role: acc.role, lines: acc.lines, expiresAt: Date.now() + KEEP_MS }
    } else {
      const res = await source.cmd.login(userId, password)
      if (!res.ok) return false
      // 모르는 권한(예전 ADMIN·PLANT_HEAD 등)은 기능을 잘못 열지 않게 로그인을 막아요
      if (!isRole(res.role)) throw new Error(`이 계정의 권한(${res.role})을 알 수 없어요. 관리자에게 권한 변경(DB v0.3.15)을 요청하세요`)
      session.value = { loginId: userId, name: res.name, role: res.role, lines: res.lines ?? [], expiresAt: Date.now() + KEEP_MS }
    }
    write(session.value)
    return true
  }

  async function logout() {
    await source.cmd.logout()
    session.value = null
    write(null)
  }

  /** 권한 확인. 조치 쓰기는 설비 ID를 넘기면 담당 라인까지 본다 */
  const can = (perm: Perm, equipmentId?: string) => allowed(role.value, lines.value, perm, equipmentId)

  return { loggedIn, userName, role, roleName, lines, loginId, can, login, logout }
}

/** 라우터 가드용: 반응형 없이 지금 로그인했는지 */
export function isLoggedIn(): boolean {
  return session.value !== null
}

/** 라우터 가드용: 지금 계정의 권한 */
export function currentRole(): AppRole | null {
  return session.value?.role ?? null
}

/** 라우터 가드용: 이 권한이 있는지 */
export function hasPerm(perm: Perm): boolean {
  const s = session.value
  return !!s && allowed(s.role, s.lines, perm)
}

/** 로그인 화면의 데모 계정 목록 */
export const DEMO_LOGINS = DEMO_ACCOUNTS.map((a) => ({ ...a, roleName: ROLE_NAME[a.role] }))

/** 로그인 후 첫 화면: 캠퍼스장은 임시 MES, 나머지는 대시보드 */
export function homePath(): string {
  return session.value?.role === 'CAMPUS' ? '/mes' : '/'
}
