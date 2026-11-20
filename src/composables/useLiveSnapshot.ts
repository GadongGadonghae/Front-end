// 1초 현재 상태 스냅샷 구독. 여러 화면·부품이 써도 구독은 하나만 연다 (데이터정의서 7장)
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import { source } from '@/data'
import type { Unsubscribe } from '@/data/contracts'
import type { PlantSnapshot } from '@/types/live'

const snapshot = shallowRef<PlantSnapshot | null>(null)
let users = 0
let off: Unsubscribe | null = null

/** 현재 상태 스냅샷. 처음 null, 구독 직후 채워지고 1초마다 바뀐다. 쓰는 곳이 없어지면 구독을 끊는다 */
export function useLiveSnapshot(): Readonly<ShallowRef<PlantSnapshot | null>> {
  users += 1
  if (!off) off = source.live.onSnapshot((s) => { snapshot.value = s })
  onScopeDispose(() => {
    users -= 1
    if (users === 0 && off) { off(); off = null }
  })
  return snapshot
}
