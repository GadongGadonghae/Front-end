// 데이터 층 계약 (FRONTEND.md 6장, 데이터정의서 7장)
// 화면은 이 인터페이스만 안다. 지금 구현은 mock, 나중에 api가 같은 계약으로 들어온다.
// 조회·저장 함수는 화면을 만들 때 그 화면에 필요한 것만 추가한다.
import type { MasterData } from '@/types/plant'
import type { PlantSnapshot, ProductMove } from '@/types/live'
import type { AlarmEvent, StateEvent } from '@/types/events'

export type Unsubscribe = () => void

/** 실시간 push 1개 채널: 현재 상태 스냅샷(1초), 제품 이동, 알람 발생·해제 */
export interface LiveChannel {
  /** 구독하자마자 최신 스냅샷을 한 번 주고, 이후 1초마다 준다 */
  onSnapshot(cb: (snapshot: PlantSnapshot) => void): Unsubscribe
  onProductMove(cb: (move: ProductMove) => void): Unsubscribe
  onAlarm(cb: (alarm: AlarmEvent) => void): Unsubscribe
}

/** 조회 */
export interface Queries {
  /** 기준정보: 라인·공정·설비 39대·관리값 기준·비가동 코드 */
  getMaster(): Promise<MasterData>
  /** 오늘(00:00~지금) 상태 이력. 최근순 (SCR-001 알림 열, SCR-010) */
  getTodayStateEvents(filter?: { area?: string }): Promise<StateEvent[]>
}

/** 저장 */
export interface Commands {
  /** 로그인 (FN-016). 실패하면 ok=false */
  login(userId: string, password: string): Promise<{ ok: true; name: string } | { ok: false }>
  logout(): Promise<void>
}

export interface DataSource {
  /** 데모 데이터인지. 화면에 "데모 값"을 표시할 때 쓴다 (CLAUDE.md) */
  readonly demo: boolean
  live: LiveChannel
  q: Queries
  cmd: Commands
}
