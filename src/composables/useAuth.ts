// 로그인 상태 (FN-016): 자동 로그아웃 없음, 브라우저를 닫아도 7일 유지 (D-75)
// 데모에서는 브라우저 저장소에 둔다. 실제 API가 생기면 백엔드 세션(쿠키)으로 바꾼다
import { computed, ref } from 'vue'
import { source } from '@/data'
import { allows, isRole, type Permission } from '@/lib/permissions'
import type { UserRole } from '@/types/user'

const KEY = 'sfaas.session'
const KEEP_MS = 7 * 24 * 3600 * 1000

/** role: 계정 권한 (11/20). 권한이 없는 예전 저장값은 다시 로그인하게 버려요 */
interface Session { name: string; role: UserRole; loginId: string; expiresAt: number }

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s.expiresAt > Date.now() && isRole(s.role) ? s : null
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
  const role = computed<UserRole | null>(() => session.value?.role ?? null)
  const loginId = computed(() => session.value?.loginId ?? '')
  /** 이 기능을 쓸 수 있는지 (lib/permissions.ts 표) */
  const can = (p: Permission) => allows(role.value, p)

  /** 성공하면 true. 실패 문구는 화면이 정한다 (FN-016) */
  async function login(userId: string, password: string): Promise<boolean> {
    const res = await source.cmd.login(userId, password)
    if (!res.ok) return false
    // 모르는 권한(예전 ADMIN·MANAGER 등)은 아무 기능도 못 쓰는 라인 담당자보다 더 막아야 해서 로그인 실패로 봐요
    if (!isRole(res.role)) throw new Error(`이 계정의 권한(${res.role})을 알 수 없어요. 관리자에게 권한 변경(DB v0.3.13)을 요청하세요`)
    session.value = { name: res.name, role: res.role, loginId: userId, expiresAt: Date.now() + KEEP_MS }
    write(session.value)
    return true
  }

  async function logout() {
    await source.cmd.logout()
    session.value = null
    write(null)
  }

  return { loggedIn, userName, role, loginId, can, login, logout }
}

/** 라우터 가드용: 지금 계정의 권한 */
export function currentRole(): UserRole | null {
  return session.value?.role ?? null
}

/** 라우터 가드용: 반응형 없이 지금 로그인했는지 */
export function isLoggedIn(): boolean {
  return session.value !== null
}
