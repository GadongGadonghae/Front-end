// 1초 현재 상태 스냅샷 구독. 여러 화면·부품이 써도 구독은 하나만 연다 (데이터정의서 7장)
// 쓰는 곳이 없어져도 30초는 두었다가 끊는다 (화면 전환 때 다시 열지 않게, sharedLive)
import { source } from '@/data'
import { sharedLive } from '@/composables/sharedLive'
import type { PlantSnapshot } from '@/types/live'

/** 현재 상태 스냅샷. 처음 null, 구독 직후 채워지고 1초마다 바뀐다 */
export const useLiveSnapshot = sharedLive<PlantSnapshot>((cb) => source.live.onSnapshot(cb))
