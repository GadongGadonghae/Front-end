// 10초 오늘 요약 구독 (API 명세 3.3 summary). 여러 화면·부품이 써도 구독은 하나만 연다
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import { source } from '@/data'
import type { Unsubscribe } from '@/data/contracts'
import type { PlantSummary } from '@/types/live'

const summary = shallowRef<PlantSummary | null>(null)
let users = 0
let off: Unsubscribe | null = null

export function useLiveSummary(): Readonly<ShallowRef<PlantSummary | null>> {
  users += 1
  if (!off) off = source.live.onSummary((s) => { summary.value = s })
  onScopeDispose(() => {
    users -= 1
    if (users === 0 && off) { off(); off = null }
  })
  return summary
}
