// REST 조회를 주기마다 다시 부른다 (API 명세 6장 화면별 갱신 주기). 화면을 떠나면 멈춘다.
// key가 바뀌면 (예: 선택 설비, 조회 조건) 값을 비우고 바로 다시 부른다. 늦게 온 옛 응답은 버린다
import { onScopeDispose, shallowRef, watch, type WatchSource } from 'vue'

export function usePoll<T>(load: () => Promise<T>, everyMs: number | null, key?: WatchSource) {
  const data = shallowRef<T | null>(null)
  const loading = shallowRef(false)
  let seq = 0
  let alive = true

  const run = () => {
    const n = ++seq
    loading.value = true
    load().then((v) => {
      if (!alive || n !== seq) return
      data.value = v
      loading.value = false
    }).catch(() => {
      // 실패하면 값은 그대로 두고 다음 주기에 다시 (계속 "불러오는 중"으로 남지 않게)
      if (alive && n === seq) loading.value = false
    })
  }

  run()
  const timer = everyMs ? setInterval(run, everyMs) : null
  if (key) watch(key, () => { data.value = null; run() }, { deep: true })
  onScopeDispose(() => { alive = false; if (timer) clearInterval(timer) })

  return { data, loading, reload: run }
}
