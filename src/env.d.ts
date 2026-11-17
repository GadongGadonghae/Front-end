/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 데이터 소스: mock(기본) | api (FRONTEND.md 6장) */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
  /** api 모드에서 REST 기본 주소. 기본 /api (개발 서버가 백엔드로 넘김) */
  readonly VITE_API_BASE?: string
  /** api 모드에서 WebSocket(STOMP) 주소. 기본 /ws */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
