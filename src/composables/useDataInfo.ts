// 데이터 소스 정보. 데모 데이터면 화면에 "데모 데이터"를 표시한다 (CLAUDE.md: 데모 값은 그렇다고 밝힌다)
import { source } from '@/data'

export function useDataInfo() {
  return { demo: source.demo }
}
