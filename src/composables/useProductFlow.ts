// 공장 안 제품 위치 구독 (3D 물류). 여러 곳이 써도 구독은 하나 (예전엔 쓰는 곳마다 따로 열었음)
// 쓰는 곳이 없어져도 30초는 두었다가 끊는다 (sharedLive)
import { source } from '@/data'
import { sharedLive } from '@/composables/sharedLive'
import type { FlowPositions } from '@/types/live'

/** 제품 위치. 처음 null, 구독 직후 채워지고 1초마다 바뀐다 */
export const useProductFlow = sharedLive<FlowPositions>((cb) => source.live.onFlowPositions(cb))
