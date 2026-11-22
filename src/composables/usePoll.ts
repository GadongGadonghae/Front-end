// REST 조회를 주기마다 다시 부른다 (API 명세 6장 화면별 갱신 주기). 화면을 떠나면 멈춘다.
// key가 바뀌면 (예: 선택 설비, 조회 조건) 값을 비우고 바로 다시 부른다. 늦게 온 옛 응답은 버린다
// cacheName을 주면 마지막 값을 기억해 두고, 같은 조회로 다시 들어오면 그 값을 먼저 보인 뒤 새로 받는다
// (성능 개선 4 · D-120, docs/10_성능검토.md: 다시 들어간 화면이 응답 올 때까지 비어 있지 않게)
import { getCurrentInstance, onActivated, onDeactivated, onScopeDispose, shallowRef, toValue, watch, type WatchSource } from 'vue'

/** 기억해 둘 조회 결과 수 (오래된 것부터 버림) */
const CACHE_MAX = 60
const cache = new Map<string, unknown>()
function remember(id: string, v: unknown) {
  cache.delete(id)
  cache.set(id, v)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
}

/**
 * @param cacheName 이 조회의 이름 (예: `line-today:B`). 조회에 쓰는 값 중 key에 없는 것(라인 ID 등)은 이름에 넣는다.
 *   key의 값이 함께 붙어 같은 조건끼리만 기억을 나눈다
 */
export function usePoll<T>(load: () => Promise<T>, everyMs: number | null, key?: WatchSource, cacheName?: string) {
  const idOf = () => (cacheName ? `${cacheName}|${JSON.stringify(key ? toValue(key) : null)}` : null)
  const cached = () => { const id = idOf(); return id && cache.has(id) ? (cache.get(id) as T) : null }
  const data = shallowRef<T | null>(cached())
  const loading = shallowRef(false)
  let seq = 0
  let alive = true

  const run = () => {
    const n = ++seq
    const id = idOf()
    loading.value = true
    load().then((v) => {
      if (!alive || n !== seq) return
      data.value = v
      loading.value = false
      if (id) remember(id, v)
    }).catch(() => {
      // 실패하면 값은 그대로 두고 다음 주기에 다시 (계속 "불러오는 중"으로 남지 않게)
      if (alive && n === seq) loading.value = false
    })
  }

  run()
  let timer = everyMs ? setInterval(run, everyMs) : null
  if (key) watch(key, () => { data.value = cached(); run() }, { deep: true })
  // 보관된 화면(KeepAlive, 대시보드)은 떠나 있는 동안 주기 조회를 멈추고, 돌아오면 바로 한 번 부른 뒤 다시 주기대로
  if (getCurrentInstance() && everyMs) {
    let away = false
    onDeactivated(() => { away = true; if (timer) { clearInterval(timer); timer = null } })
    onActivated(() => { if (!away) return; away = false; run(); timer = setInterval(run, everyMs) })
  }
  onScopeDispose(() => { alive = false; if (timer) clearInterval(timer) })

  return { data, loading, reload: run }
}
