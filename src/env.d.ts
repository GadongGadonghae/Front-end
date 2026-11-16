/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 데이터 소스: mock(기본) | api (FRONTEND.md 6장) */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
