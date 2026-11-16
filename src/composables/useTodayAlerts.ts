// 오늘 알림 (상태 이력 DT-013): 처음에 조회하고, 실시간 알람 이벤트로 이어 붙인다 (데이터정의서 7장 공통 헤더)
// 진행 중 위, 해제된 것은 아래, 각각 최근순 (화면정의서 SCR-001 알림 열)
import { computed, onScopeDispose, ref } from 'vue'
import { source } from '@/data'
import type { StateEvent } from '@/types/events'

export function useTodayAlerts(filter?: { area?: string }) {
  const events = ref<StateEvent[]>([])
  const loaded = ref(false)

  source.q.getTodayStateEvents(filter).then((list) => {
    events.value = list
    loaded.value = true
  })

  const off = source.live.onAlarm(({ event }) => {
    const i = events.value.findIndex((e) => e.id === event.id)
    if (i >= 0) events.value.splice(i, 1, event)
    else events.value.unshift(event)
  })
  onScopeDispose(off)

  const sorted = computed(() => {
    const byRecent = (a: StateEvent, b: StateEvent) => b.start.localeCompare(a.start)
    const live = events.value.filter((e) => e.end === null).sort(byRecent)
    const done = events.value.filter((e) => e.end !== null).sort(byRecent)
    return [...live, ...done]
  })
  const inProgressCount = computed(() => events.value.filter((e) => e.end === null).length)

  return { alerts: sorted, inProgressCount, loaded }
}
