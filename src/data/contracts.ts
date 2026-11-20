// 데이터 층 계약 (FRONTEND.md 6장). 화면이 아는 유일한 인터페이스. 백엔드 엔드포인트(docs/api-spec-v3.1.md)는 data/api/endpoints.ts에 1:1로 두고, 이 계약으로 바꾸는 일은 data/api/source.ts가 한다.
// 화면은 이 인터페이스만 안다. 지금 구현은 mock, 나중에 api가 같은 계약으로 들어온다.
// 조회·저장 함수는 화면을 만들 때 그 화면에 필요한 것만 추가한다.
import type { LineId, MasterData } from '@/types/plant'
import type { PlantSnapshot, PlantSummary, ProductMove, FlowPositions } from '@/types/live'
import type { AlarmEvent, HistoryEvent, HistoryQuery, HistorySummary, HistorySummaryQuery, RiskEvent, RiskQuery, StateEvent } from '@/types/events'
import type { HourlyOutput, Paged, Product, ProductDetail, ProductionQuery, ProductionSummary } from '@/types/production'
import type { InboundToday, InspectionToday, MicrostopToday, ProcessToday, TelemetryRange, TelemetrySeries, TelemetryTick } from '@/types/process'
import type { OeeQuery, OeeReport, StateTimeline } from '@/types/analysis'
import type { ControlLimit, ProcessId } from '@/types/plant'
import type { EquipmentRisk, PdmEta } from '@/types/pdm'
import type { DailyReport, ReplanReport, ReplanSummary, TargetRow } from '@/types/report'
import type { NewUser, UserRow } from '@/types/user'

export type Unsubscribe = () => void

/** 저장 결과. 실패하면 사람이 읽을 이유 (API 409·422) */
export type SaveResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** 실시간 웹소켓 채널, 주제 plant (API 명세 3장) */
export interface LiveChannel {
  /** snapshot 1초. 구독하자마자 최신 값을 한 번 준다 */
  onSnapshot(cb: (snapshot: PlantSnapshot) => void): Unsubscribe
  /** summary 10초. 구독하자마자 한 번 준다 */
  onSummary(cb: (summary: PlantSummary) => void): Unsubscribe
  /** product.move 이벤트 (물류 점, D-81) */
  onProductMove(cb: (move: ProductMove) => void): Unsubscribe
  /** 백엔드 없음 (제안: GET /production/flow/positions): 공장 안 제품 위치, 1초. 구독하자마자 한 번 준다 (3D 물류) */
  onFlowPositions(cb: (flow: FlowPositions) => void): Unsubscribe
  /** alarm.raised / alarm.cleared 이벤트 */
  onAlarm(cb: (alarm: AlarmEvent) => void): Unsubscribe
  /** risk.changed 이벤트: 예지보전 위험(90%) 진입·해제 */
  onRiskChanged(cb: (risk: RiskEvent) => void): Unsubscribe
  /** 주제 risk: 관리값 있는 설비 38대의 항목별 위험도, 5초마다. 구독하자마자 한 번 준다 (예지보전 화면을 연 동안) */
  onRisk(cb: (risks: EquipmentRisk[]) => void): Unsubscribe
  /** 주제 telemetry:{설비}: 선택 설비의 새 관리값. 슬리터 1초·도장 5초·프레스·용접 사이클마다 */
  onTelemetry(equipmentId: string, cb: (tick: TelemetryTick) => void): Unsubscribe
}

/** 조회 (REST) */
export interface Queries {
  /** C-04·C-05·M-10 기준정보 */
  getMaster(): Promise<MasterData>
  /** 백엔드 없음 (요청 중): 오늘 시간대별 생산. lineId 없으면 공장 */
  getTodayHourly(lineId?: LineId): Promise<HourlyOutput>
  /** U-08 오늘 상태 이력. area가 있으면 그 라인만 */
  getTodayStateEvents(filter?: { area?: string }): Promise<StateEvent[]>
  /** 백엔드 없음 [차순위] 오늘 예지보전 위험 이력 */
  getTodayRiskEvents(filter?: { area?: string }): Promise<RiskEvent[]>
  /** 백엔드 없음 [차순위] 예지보전 위험도 처음 목록 */
  getRisks(): Promise<EquipmentRisk[]>
  /** 백엔드 없음 상한 도달 예상 [차순위] */
  getPdmEta(equipmentId: string): Promise<PdmEta | null>
  /** M-12·M-07·M-13·U-03 공정 오늘 요약 */
  getProcessToday(lineId: LineId, process: ProcessId): Promise<ProcessToday>
  /** M-03 관리값 추이 */
  getTelemetry(equipmentId: string, range: TelemetryRange): Promise<TelemetrySeries>
  /** U-08 상태 이력 (지금은 설비 하나의 오늘 이력) */
  getStateEvents(filter: { equipmentId: string }): Promise<StateEvent[]>
  /** M-07·M-08 오늘 공정 검사. 출고는 process INSPECTION, lineId 없음 */
  getInspectionsToday(process: ProcessId, lineId?: LineId): Promise<InspectionToday>
  /** 백엔드 없음 오늘 미세정지 [차순위] */
  getMicrostopsToday(equipmentId: string): Promise<MicrostopToday>
  /** M-13 (오늘 입고 수는 백엔드 없음) 코일입고 */
  getInboundToday(): Promise<InboundToday>
  /** U-01~05·U-07·U-02 가동률 */
  getOee(query: OeeQuery): Promise<OeeReport>
  /** U-12 상태 타임라인 (일) */
  getStateTimeline(query: OeeQuery): Promise<StateTimeline>
  /** U-08 알람·비가동 이력 (50건씩, 발생 최근순) */
  getHistory(query: HistoryQuery): Promise<Paged<HistoryEvent>>
  /** 백엔드 없음 (요청 필요) 이력 요약: 코드별 건수·시간, 손볼 건 수 (D-109) */
  getHistorySummary(query: HistorySummaryQuery): Promise<HistorySummary>
  /** 백엔드 없음 [차순위] 예지보전 위험 이력 (50건씩, 발생 최근순) */
  getRiskHistory(query: RiskQuery): Promise<Paged<RiskEvent>>
  /** 백엔드 없음 [차순위] 일일 생산 리포트 */
  getDailyReport(date: string): Promise<DailyReport>
  /** R-01 (백엔드 자동 생성) [차순위] 계획수정 보고서 목록 (날짜 범위, 만든 시각 최근순) */
  getReplanReports(from: string, to: string): Promise<ReplanSummary[]>
  /** R-02 [차순위] 계획수정 보고서 내용 */
  getReplanReport(id: string): Promise<ReplanReport | null>
  /** 백엔드 없음 [차순위] PDF. 만들 수 없으면 null (데모는 브라우저 인쇄로 대신) */
  getReplanPdf(id: string): Promise<Blob | null>
  /** G-02 (라인별 계획 합) 날짜별 목표·실적 */
  getTargets(from: string, to: string): Promise<TargetRow[]>
  /** C-02 사용자 목록 (최대 100명) */
  getUsers(): Promise<UserRow[]>
  /** 백엔드 M-10 설비별 관리값 기준치 */
  getControlLimits(equipmentId: string): Promise<ControlLimit[]>
  /** G-01·M-07·U-11 생산 요약 */
  getProductionSummary(query: ProductionQuery): Promise<ProductionSummary>
  /** 백엔드 없음 (요청 중) 제품 내역 (50건씩) */
  getProducts(query: ProductionQuery): Promise<Paged<Product>>
  /** 백엔드 없음 (요청 중) 제품 공정별 기록 */
  getProduct(productId: string): Promise<ProductDetail | null>
}

/** 저장 (REST) */
export interface Commands {
  /** C-01 로그인. 아이디·비밀번호가 틀리면 ok=false, 서버에 닿지 못하면 오류를 던진다 */
  /** role: 계정 권한 (11/20, lib/permissions.ts) */
  login(userId: string, password: string): Promise<{ ok: true; name: string; role: string } | { ok: false }>
  /** 토큰 삭제 (백엔드 호출 없음) 로그아웃 */
  logout(): Promise<void>
  /** U-09 조치 메모 저장. 빈 글이면 삭제. 담당자는 로그인 사용자 (D-84) */
  saveActionMemo(eventId: string, memo: string): Promise<HistoryEvent>
  /** 백엔드 없음 (자동 생성) [차순위] 계획수정 보고서 만들기 (고장 D 건만, D-68). 이미 있으면 그 보고서 */
  createReplanReport(stateEventId: string, additionalRequest?: string): Promise<ReplanReport>
  /** 보고서 승인(결재). 공장장만 (11/20) */
  approveReplanReport(reportId: string): Promise<ReplanReport>
  /** G-03 (6라인에 나눠 저장) 하루 목표 저장 (같은 날 덮어씀). 지난 날짜면 실패 (409, D-71) */
  saveTarget(date: string, quantity: number): Promise<SaveResult<TargetRow>>
  /** C-03 사용자 등록. 같은 아이디가 있으면 실패 */
  createUser(user: NewUser): Promise<SaveResult<{ loginId: string }>>
  /** 백엔드 M-09 도장 경로 전환: 그 라인 제품을 이 도장 설비로 보낸다 (MQTT Q-03이 Node-RED로 나감) */
  setPaintRoute(lineId: string, paintId: string, reason: string): Promise<SaveResult<{ lineId: string; currentPaintId: string; changedAt: string }>>
  /** 백엔드 M-11 기준치 수정 (항목마다 1건씩, 바뀐 것만). 하한 > 상한이면 실패 */
  saveControlLimits(equipmentId: string, rows: { item: string; lower: number | null; upper: number | null }[]): Promise<SaveResult<ControlLimit[]>>
}

export interface DataSource {
  /** 데모 데이터인지. 화면에 "데모 데이터"를 표시할 때 쓴다 (CLAUDE.md) */
  readonly demo: boolean
  live: LiveChannel
  q: Queries
  cmd: Commands
}
