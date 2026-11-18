// REST 호출: 기본 주소(VITE_API_BASE, 기본 /api) · JWT 헤더 · 오류 모양 통일 (docs/api-spec-v3.1.md 공통 규칙)
import type { ApiErrorBody } from '@/data/api/dto'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'
const TOKEN_KEY = 'sfaas.accessToken'
/** composables/useAuth의 로그인 기록 키 (data/는 Vue를 몰라서 키 이름만 같이 쓴다) */
const SESSION_KEY = 'sfaas.session'

/** 백엔드 공통 오류 { status, code, message } */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const token = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (v: string | null) => { try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY) } catch { /* 저장소를 못 쓰면 이번 탭에서만 */ } },
}

type Query = Record<string, string | number | boolean | null | undefined>

function url(path: string, query?: Query) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return `${BASE}${path}${s ? `?${s}` : ''}`
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(url(path, opts.query), { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  if (!res.ok) {
    let e: Partial<ApiErrorBody> = {}
    try { e = await res.json() } catch { /* 본문 없음 */ }
    // 토큰이 없거나 만료되면 토큰과 로그인 기록(useAuth의 sfaas.session)을 같이 지우고 로그인 화면으로.
    // 기록만 남으면 라우터가 로그인된 것으로 보고 로그인 화면을 안 띄운다. 로그인 실패(401)는 로그인 화면이 문구를 보여 준다
    if (res.status === 401 && path !== '/auth/login') {
      token.set(null)
      try { localStorage.removeItem(SESSION_KEY) } catch { /* 저장소를 못 쓰면 무시 */ }
      if (location.pathname !== '/login') location.assign(`/login?redirect=${encodeURIComponent(location.pathname)}`)
    }
    throw new ApiError(res.status, e.code ?? `HTTP_${res.status}`, e.message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
}
