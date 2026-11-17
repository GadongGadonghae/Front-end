// 지금 쓸 데이터 구현을 고른다 (FRONTEND.md 6장). VITE_DATA_SOURCE=mock|api, 기본 mock
import type { DataSource } from '@/data/contracts'
import { createMockSource } from '@/data/mock/source'
import { createApiSource } from '@/data/api/source'

function pick(): DataSource {
  const kind = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  if (kind === 'api') return createApiSource()
  return createMockSource()
}

/** 앱 전체가 함께 쓰는 데이터 소스 하나 */
export const source: DataSource = pick()
export type { DataSource } from '@/data/contracts'
