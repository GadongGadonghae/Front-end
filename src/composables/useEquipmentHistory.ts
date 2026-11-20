// 선택 설비의 오늘 비가동 이력 + 조치 메모 (SCR-002 5·6번, API-041·042). 알람 이벤트가 오면 이어 붙인다
import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { source } from '@/data'
import { asStateEvent } from '@/data/historyTodo'
import type { StateEvent } from '@/types/events'
import type { HistoryRowView } from '@/types/view'
import { useNow } from '@/composables/useNow'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDuration, formatTime } from '@/lib/format'

export function useEquipmentHistory(equipmentId: Ref<string | null>) {
  const events = ref<StateEvent[]>([])
  const loaded = ref(false)
  const now = useNow()
  let seq = 0

  watch(equipmentId, (id) => {
    events.value = []
    loaded.value = false
    if (!id) return
    const n = ++seq
    source.q.getStateEvents({ equipmentId: id }).then((list) => {
      if (n !== seq) return
      events.value = list
      loaded.value = true
    })
  }, { immediate: true })

  const off = source.live.onAlarm(({ event }) => {
    if (event.equipmentId !== equipmentId.value) return
    const i = events.value.findIndex((e) => e.id === event.id)
    if (i >= 0) events.value.splice(i, 1, event)
    else events.value.unshift(event)
  })
  onScopeDispose(off)

  // 11/21: 대기(I)는 빼요 (알람 이력과 같게, 짧은 대기가 목록을 덮지 않게). 고장·통신 끊김·계획정지만
  const rows = computed<HistoryRowView[]>(() => events.value.filter((e) => e.state !== 'I')
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((e) => ({
      id: e.id,
      state: e.state,
      code: DOWNTIME_NAME[e.code],
      detail: e.detail,
      range: `${formatTime(e.start)} ~ ${e.end ? formatTime(e.end) : '진행 중'}`,
      duration: formatDuration(((e.end ? Date.parse(e.end) : now.value) - Date.parse(e.start)) / 1000),
      ongoing: e.end === null,
      memo: e.memo ? { text: e.memo, by: e.memoBy, at: e.memoAt ? formatTime(e.memoAt).slice(0, 5) : '' } : null,
    })))

  /** 조치 메모 저장. 빈 글이면 지운다. 담당자는 로그인 사용자 (D-84) */
  async function saveMemo(eventId: string, memo: string) {
    const saved = asStateEvent(await source.cmd.saveActionMemo(eventId, memo))
    const i = events.value.findIndex((e) => e.id === eventId)
    if (i >= 0 && saved) events.value.splice(i, 1, saved)
  }

  return { rows, loaded, saveMemo }
}
