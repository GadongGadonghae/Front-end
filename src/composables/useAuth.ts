// 로그인 상태 (FN-016): 자동 로그아웃 없음, 브라우저를 닫아도 7일 유지 (D-75)
// 데모에서는 브라우저 저장소에 둔다. 실제 API가 생기면 백엔드 세션(쿠키)으로 바꾼다
import { computed, ref } from 'vue'
import { source } from '@/data'

const KEY = 'sfaas.session'
const KEEP_MS = 7 * 24 * 3600 * 1000

interface Session { name: string; expiresAt: number }

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s.expiresAt > Date.now() ? s : null
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

  /** 성공하면 true. 실패 문구는 화면이 정한다 (FN-016) */
  async function login(userId: string, password: string): Promise<boolean> {
    const res = await source.cmd.login(userId, password)
    if (!res.ok) return false
    session.value = { name: res.name, expiresAt: Date.now() + KEEP_MS }
    write(session.value)
    return true
  }

  async function logout() {
    await source.cmd.logout()
    session.value = null
    write(null)
  }

  return { loggedIn, userName, login, logout }
}

/** 라우터 가드용: 반응형 없이 지금 로그인했는지 */
export function isLoggedIn(): boolean {
  return session.value !== null
}
