// 지금 쓸 데이터 구현을 고른다 (FRONTEND.md 6장). VITE_DATA_SOURCE=mock|api, 기본 mock
import type { DataSource } from '@/data/contracts'
import { createMockSource } from '@/data/mock/source'

function pick(): DataSource {
  const kind = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  if (kind === 'mock') return createMockSource()
  throw new Error(`VITE_DATA_SOURCE=${kind}: 실제 API 구현(data/api)은 아직 없다`)
}

/** 앱 전체가 함께 쓰는 데이터 소스 하나 */
export const source: DataSource = pick()
export type { DataSource } from '@/data/contracts'
