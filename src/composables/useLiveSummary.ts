// 10초 오늘 요약 구독 (API 명세 3.3 summary). 여러 화면·부품이 써도 구독은 하나만 연다
// 쓰는 곳이 없어져도 30초는 두었다가 끊는다 (화면 전환 때 다시 열지 않게, sharedLive)
import { source } from '@/data'
import { sharedLive } from '@/composables/sharedLive'
import type { PlantSummary } from '@/types/live'

export const useLiveSummary = sharedLive<PlantSummary>((cb) => source.live.onSummary(cb))
