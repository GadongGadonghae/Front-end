// 1초마다 바뀌는 지금 시각 (헤더 시계, 지속시간 계산). 타이머는 앱 전체에 하나
import { onScopeDispose, readonly, ref } from 'vue'

const now = ref(Date.now())
let users = 0
let timer: ReturnType<typeof setInterval> | null = null

export function useNow() {
  users += 1
  if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
  onScopeDispose(() => {
    users -= 1
    if (users === 0 && timer) { clearInterval(timer); timer = null }
  })
  return readonly(now)
}
