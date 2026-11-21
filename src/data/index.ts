// 지금 쓸 데이터 구현을 고른다 (FRONTEND.md 6장). VITE_DATA_SOURCE=mock|api, 기본 mock
import type { DataSource } from '@/data/contracts'
import { createMockSource } from '@/data/mock/source'
import { createApiSource } from '@/data/api/source'

function pick(): DataSource {
  const kind = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  if (kind === 'api') return createApiSource()
  return withDelay(createMockSource(), Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 0))
}

/** 성능 측정용: 데모 조회를 일부러 늦춰 "다시 들어간 화면이 비어 있는 시간"을 잴 수 있게 한다. 0이면 그대로 */
function withDelay(s: DataSource, ms: number): DataSource {
  if (!(ms > 0)) return s
  const wait = () => new Promise((r) => setTimeout(r, ms))
  const q = Object.fromEntries(Object.entries(s.q).map(([k, f]) => [k, async (...a: unknown[]) => { await wait(); return (f as (...x: unknown[]) => unknown)(...a) }]))
  return { ...s, q: q as unknown as DataSource['q'] }
}

/** 앱 전체가 함께 쓰는 데이터 소스 하나 */
export const source: DataSource = pick()
export type { DataSource } from '@/data/contracts'
