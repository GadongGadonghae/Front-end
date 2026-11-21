/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 데이터 소스: mock(기본) | api (FRONTEND.md 6장) */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
  /** api 모드에서 REST 기본 주소. 기본 /api (개발 서버가 백엔드로 넘김) */
  readonly VITE_API_BASE?: string
  /** api 모드에서 WebSocket(STOMP) 주소. 기본 /ws */
  readonly VITE_WS_URL?: string
  /** 성능 측정용: 데모 데이터 조회(q.*)를 이만큼(ms) 늦게 돌려준다. 기본 0 (docs/10_성능검토.md, scripts/perf) */
  readonly VITE_MOCK_DELAY_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
