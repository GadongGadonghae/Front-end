// 데이터 층 계약 (FRONTEND.md 6장). 형식·주기는 docs/specs/API명세서.md가 기준이고, 함수는 API와 1:1로 맞춘다.
// 화면은 이 인터페이스만 안다. 지금 구현은 mock, 나중에 api가 같은 계약으로 들어온다.
// 조회·저장 함수는 화면을 만들 때 그 화면에 필요한 것만 추가한다.
import type { LineId, MasterData } from '@/types/plant'
import type { PlantSnapshot, PlantSummary, ProductMove } from '@/types/live'
import type { AlarmEvent, RiskEvent, StateEvent } from '@/types/events'
import type { HourlyOutput } from '@/types/production'

export type Unsubscribe = () => void

/** 실시간 웹소켓 채널, 주제 plant (API 명세 3장) */
export interface LiveChannel {
  /** snapshot 1초. 구독하자마자 최신 값을 한 번 준다 */
  onSnapshot(cb: (snapshot: PlantSnapshot) => void): Unsubscribe
  /** summary 10초. 구독하자마자 한 번 준다 */
  onSummary(cb: (summary: PlantSummary) => void): Unsubscribe
  /** product.move 이벤트 (물류 점, D-81) */
  onProductMove(cb: (move: ProductMove) => void): Unsubscribe
  /** alarm.raised / alarm.cleared 이벤트 */
  onAlarm(cb: (alarm: AlarmEvent) => void): Unsubscribe
  /** risk.changed 이벤트: 예지보전 위험(90%) 진입·해제 */
  onRiskChanged(cb: (risk: RiskEvent) => void): Unsubscribe
}

/** 조회 (REST) */
export interface Queries {
  /** API-010 기준정보 */
  getMaster(): Promise<MasterData>
  /** API-020 오늘 시간대별 생산. lineId 없으면 공장 */
  getTodayHourly(lineId?: LineId): Promise<HourlyOutput>
  /** API-022 오늘 상태 이력. area가 있으면 그 라인만 */
  getTodayStateEvents(filter?: { area?: string }): Promise<StateEvent[]>
  /** API-023 오늘 예지보전 위험 이력 */
  getTodayRiskEvents(filter?: { area?: string }): Promise<RiskEvent[]>
}

/** 저장 (REST) */
export interface Commands {
  /** API-001 로그인. 실패하면 ok=false */
  login(userId: string, password: string): Promise<{ ok: true; name: string } | { ok: false }>
  /** API-002 로그아웃 */
  logout(): Promise<void>
}

export interface DataSource {
  /** 데모 데이터인지. 화면에 "데모 데이터"를 표시할 때 쓴다 (CLAUDE.md) */
  readonly demo: boolean
  live: LiveChannel
  q: Queries
  cmd: Commands
}
