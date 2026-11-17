// 데이터 층 계약 (FRONTEND.md 6장). 형식·주기는 docs/specs/API명세서.md가 기준이고, 함수는 API와 1:1로 맞춘다.
// 화면은 이 인터페이스만 안다. 지금 구현은 mock, 나중에 api가 같은 계약으로 들어온다.
// 조회·저장 함수는 화면을 만들 때 그 화면에 필요한 것만 추가한다.
import type { LineId, MasterData } from '@/types/plant'
import type { PlantSnapshot, PlantSummary, ProductMove } from '@/types/live'
import type { AlarmEvent, RiskEvent, StateEvent } from '@/types/events'
import type { HourlyOutput, Paged, Product, ProductDetail, ProductionQuery, ProductionSummary } from '@/types/production'
import type { InboundToday, InspectionToday, MicrostopToday, ProcessToday, TelemetryRange, TelemetrySeries, TelemetryTick } from '@/types/process'
import type { OeeQuery, OeeReport, StateTimeline } from '@/types/analysis'
import type { ProcessId } from '@/types/plant'

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
  /** 주제 telemetry:{설비}: 선택 설비의 새 관리값. 슬리터 1초·도장 5초·프레스·용접 사이클마다 */
  onTelemetry(equipmentId: string, cb: (tick: TelemetryTick) => void): Unsubscribe
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
  /** API-030 공정 오늘 요약 */
  getProcessToday(lineId: LineId, process: ProcessId): Promise<ProcessToday>
  /** API-040 관리값 추이 */
  getTelemetry(equipmentId: string, range: TelemetryRange): Promise<TelemetrySeries>
  /** API-041·070 상태 이력 (지금은 설비 하나의 오늘 이력) */
  getStateEvents(filter: { equipmentId: string }): Promise<StateEvent[]>
  /** API-043 오늘 공정 검사. 출고는 process F, lineId 없음 */
  getInspectionsToday(process: ProcessId, lineId?: LineId): Promise<InspectionToday>
  /** API-044 오늘 미세정지 [차순위] */
  getMicrostopsToday(equipmentId: string): Promise<MicrostopToday>
  /** API-045 코일입고 */
  getInboundToday(): Promise<InboundToday>
  /** API-050 가동률 */
  getOee(query: OeeQuery): Promise<OeeReport>
  /** API-051 상태 타임라인 (일) */
  getStateTimeline(query: OeeQuery): Promise<StateTimeline>
  /** API-100 생산 요약 */
  getProductionSummary(query: ProductionQuery): Promise<ProductionSummary>
  /** API-101 제품 내역 (50건씩) */
  getProducts(query: ProductionQuery): Promise<Paged<Product>>
  /** API-102 제품 공정별 기록 */
  getProduct(productId: string): Promise<ProductDetail | null>
}

/** 저장 (REST) */
export interface Commands {
  /** API-001 로그인. 실패하면 ok=false */
  login(userId: string, password: string): Promise<{ ok: true; name: string } | { ok: false }>
  /** API-002 로그아웃 */
  logout(): Promise<void>
  /** API-042 조치 메모 저장. 빈 글이면 삭제. 담당자는 로그인 사용자 (D-84) */
  saveActionMemo(eventId: string, memo: string): Promise<StateEvent>
}

export interface DataSource {
  /** 데모 데이터인지. 화면에 "데모 데이터"를 표시할 때 쓴다 (CLAUDE.md) */
  readonly demo: boolean
  live: LiveChannel
  q: Queries
  cmd: Commands
}
