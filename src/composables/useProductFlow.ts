// 공장 안 제품 위치 구독 (3D 물류). 백엔드 위치 API가 없어 지금은 데모 값만 온다
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import { source } from '@/data'
import type { FlowPositions } from '@/types/live'

/** 제품 위치. 처음 null, 구독 직후 채워지고 1초마다 바뀐다 */
export function useProductFlow(): Readonly<ShallowRef<FlowPositions | null>> {
  const flow = shallowRef<FlowPositions | null>(null)
  const off = source.live.onFlowPositions((f) => { flow.value = f })
  onScopeDispose(off)
  return flow
}
