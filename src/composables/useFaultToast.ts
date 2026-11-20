// 고장 토스트 (FN-005, 기능명세서 0.5): 설비가 고장(D)이 되면 화면 우하단에 띄운다.
// 사용자가 닫거나 [보기]를 누를 때까지 남는다. 여러 건이면 가장 최근 것 하나만 보여 준다
import { onScopeDispose, ref } from 'vue'
import { source } from '@/data'
import type { StateEvent } from '@/types/events'

export function useFaultToast() {
  const current = ref<StateEvent | null>(null)

  const off = source.live.onAlarm(({ kind, event }) => {
    if (kind === 'raised' && event.state === 'D') current.value = event
    if (kind === 'cleared' && current.value?.id === event.id) current.value = null
  })
  onScopeDispose(off)

  const dismiss = () => { current.value = null }
  return { current, dismiss }
}
