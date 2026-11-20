// 백엔드 REST 엔드포인트 1:1 (docs/api-spec-v3.1.md, Base URL /api). 함수 이름 = 명세 ID, 주소·메서드·쿼리 이름을 명세 그대로 쓴다.
// 명세가 바뀌면 여기만 고친다. 화면 계약으로 바꾸는 일은 source.ts
import { http } from '@/data/api/http'
import type {
  AlarmDto, CoilTodayDto, FlowPositionsDto, CycleDto, HourlySummaryDto, DowntimeEventDto, DowntimeSummaryDto, EquipmentDto, EquipmentStatusDto, InspectionDto,
  LineDto, LineStatusSummaryDto, LoginDto, UserDto, MetricsDto, Page, PaintRouteDto, ProcessCode, ProductionCountsDto, ProductionPlanDto,
  ProductionSummaryDto, ProductDto, ProductDetailDto, ProcessNgDto, ReasonCode, ReassignmentDetailDto, ReassignmentSummaryDto, SlackSendDto, StatusHistoryDto, ThresholdDto, ThresholdUpdatedDto,
  UtilizationByEquipmentDto, UtilizationByLineDto, UtilizationByProcessDto, UtilizationSummaryDto, UtilizationTrendDto, WipDto, YieldTrendDto,
} from '@/data/api/dto'

type Unit = 'day' | 'week' | 'month'
interface Range { from: string; to: string }

export const api = {
  // ── 모니터링 (M) ──
  /** M-01 전체 설비 현재 상태 */
  M01: (q: { lineId?: string } = {}) => http.get<EquipmentStatusDto[]>('/monitoring/status', q),
  /** M-02 라인별 상태 요약 */
  M02: () => http.get<LineStatusSummaryDto[]>('/monitoring/lines/summary'),
  /** M-03 설비 공정 값 추이 (상·하한 포함) */
  M03: (equipmentId: string, q: Range & { metric?: string; interval?: 'raw' | '5s'; after?: string }) => http.get<MetricsDto>(`/equipments/${encodeURIComponent(equipmentId)}/metrics`, { ...q }),
  /** M-04 현재 활성 알람 */
  M04: (q: { lineId?: string } = {}) => http.get<AlarmDto[]>('/alarms/active', q),
  /** M-05 알람 이력 */
  M05: (q: Range & { equipmentId?: string; page: number; size: number }) => http.get<Page<AlarmDto>>('/alarms', { ...q }),
  /** M-06 알람 확인 처리 (P2) */
  M06: (alarmId: number, ackUserId: number) => http.patch<{ alarmId: number; ackUserId: number; ackedAt: string }>(`/alarms/${alarmId}/ack`, { ackUserId }),
  /** M-07 출고 양품/불량 카운트 */
  M07: (q: { date?: string; lineId?: string; groupBy?: 'line' | 'paint' } = {}) => http.get<ProductionCountsDto>('/production/counts', q),
  /** M-08 비전 검사 결과 목록 */
  M08: (q: Range & { lineId?: string; result?: 'OK' | 'NG'; paintId?: string; page: number; size: number }) => http.get<Page<InspectionDto>>('/inspections', { ...q }),
  /** M-09 도장 경로 전환 */
  M09: (lineId: string, body: { paintId: string; reason: string }) => http.put<PaintRouteDto>(`/lines/${encodeURIComponent(lineId)}/paint-route`, body),
  /** M-10 알람 기준치 조회 */
  M10: (q: { process?: ProcessCode; equipmentId?: string } = {}) => http.get<ThresholdDto[]>('/alarms/thresholds', q),
  /** M-11 알람 기준치 수정 */
  M11: (id: number, body: { low: number | null; high: number | null }) => http.put<ThresholdUpdatedDto>(`/alarms/thresholds/${id}`, body),
  /** M-12 공정별 설비 목록·상태·원인 */
  M12: (process: ProcessCode, q: { lineId?: string } = {}) => http.get<EquipmentStatusDto[]>(`/monitoring/processes/${process}/equipments`, q),
  /** M-13 공정별 재공품 수량 */
  M13: (q: { lineId?: string; paintId?: string } = {}) => http.get<WipDto[]>('/production/wip', q),
  /** M-15 설비별 사이클 수·평균 CT (date 생략 시 오늘) */
  M15: (process: ProcessCode, q: { lineId?: string; date?: string } = {}) => http.get<CycleDto[]>(`/monitoring/processes/${process}/cycles`, q),
  /** M-16 코일 입고 현황: 오늘 입고 롤·개수, 재고(롤·개수), 슬리팅 투입, 입고 목록 (date 생략 시 오늘) */
  M16: (q: { date?: string } = {}) => http.get<CoilTodayDto>('/coil/today', q),
  /** M-17 공장 안 제품 위치 (3D 물류): 설비 안이면 equipmentId, 공정 사이면 pile */
  M17: () => http.get<FlowPositionsDto>('/production/flow/positions'),

  // ── 가동률 (U) ──
  /** U-01 가동률 요약 (목표/실적, OEE, lineYield) */
  U01: (q: Range & { lineId?: string }) => http.get<UtilizationSummaryDto>('/utilization/summary', { ...q }),
  /** U-02 가동률 추이 */
  U02: (q: Range & { unit: Unit; lineId?: string }) => http.get<UtilizationTrendDto[]>('/utilization/trend', { ...q }),
  /** U-03 공정별 가동률 */
  U03: (q: Range & { lineId?: string }) => http.get<UtilizationByProcessDto[]>('/utilization/by-process', { ...q }),
  /** U-04 라인별 가동률 */
  U04: (q: Range) => http.get<UtilizationByLineDto[]>('/utilization/by-line', { ...q }),
  /** U-05 설비별 가동률 순위 (P2). lineId는 프론트 요청 1(v3.2)로 추가 요청한 것 */
  U05: (q: Range & { process?: ProcessCode; lineId?: string; limit?: number }) => http.get<UtilizationByEquipmentDto[]>('/utilization/by-equipment', { ...q }),
  /** U-07 비가동 사유별 집계. minMinutes는 명세 본문(1분 이상만 셈) 기준 */
  U07: (q: Range & { groupBy?: 'line' | 'process'; minMinutes?: number }) => http.get<DowntimeSummaryDto>('/downtime/summary', { ...q }),
  /** U-08 알람·비가동 이력 목록 */
  U08: (q: Range & {
    lineId?: string; process?: ProcessCode; status?: string; reasonCode?: ReasonCode; inProgress?: boolean
    actionUserId?: number; equipmentId?: string; minMinutes?: number; page: number; size: number
  }) => http.get<Page<DowntimeEventDto>>('/downtime/events', { ...q }),
  /** U-09 비가동 사유·조치 담당자·메모 (P2) */
  U09: (eventId: number, body: { reasonCode?: ReasonCode; memo?: string; actionUserId?: number | null }) => http.patch<DowntimeEventDto>(`/downtime/events/${eventId}`, body),
  /** U-11 양품률 추이 */
  U11: (q: Range & { unit: 'day'; groupBy?: 'line' | 'paint' }) => http.get<YieldTrendDto[]>('/production/yield', { ...q }),
  /** U-12 설비 상태 타임라인 (P2) */
  U12: (equipmentId: string, q: Range) => http.get<StatusHistoryDto[]>(`/equipments/${encodeURIComponent(equipmentId)}/status-history`, { ...q }),

  // ── 생산 (G) ──
  /** G-01 생산량 조회 (P2) */
  G01: (q: Range & { unit: Unit; lineId?: string }) => http.get<ProductionSummaryDto[]>('/production/summary', { ...q }),
  /** G-02 일 생산 계획 조회 (P2) */
  /** G-01 unit=hour 시간대별 생산 (빈 시간 0, 오늘은 지금 시간까지) */
  G01H: (q: Range & { lineId?: string }) => http.get<HourlySummaryDto[]>('/production/summary', { ...q, unit: 'hour' }),
  G02: (q: Range & { lineId?: string }) => http.get<ProductionPlanDto[]>('/production/plans', { ...q }),
  /** G-03 일 생산 계획 설정 (P2) */
  G03: (date: string, body: { lineId: string; planQty: number }) => http.put<ProductionPlanDto>(`/production/plans/${date}`, body),

  // ── 제품 추적 (P) ──
  /** P-01 제품 목록 (투입 시각 기준 기간, result = OK·NG·IN_PROGRESS) */
  P01: (q: Range & { lineId?: string; result?: 'OK' | 'NG' | 'IN_PROGRESS'; page: number; size: number }) => http.get<Page<ProductDto>>('/products', { ...q }),
  /** P-02 제품 이력 (공정별 단계) */
  P02: (productId: string) => http.get<ProductDetailDto>(`/products/${encodeURIComponent(productId)}`),
  /** P-03 공정 불량 제품 목록 (process = SLITTING·PRESS·WELDING·PAINTING) */
  P03: (q: Range & { lineId?: string; process?: string; page: number; size: number }) => http.get<Page<ProcessNgDto>>('/production/process-ng', { ...q }),

  // ── 재배정 (R) ──
  /** R-01 재배정 보고서 목록 */
  R01: (q: Range & { page: number; size: number }) => http.get<Page<ReassignmentSummaryDto>>('/reassignments', { ...q }),
  /** R-02 재배정 보고서 상세 */
  R02: (reportId: number) => http.get<ReassignmentDetailDto>(`/reassignments/${reportId}`),
  /** R-03 AI 계획수정 보고서 만들기 (고장 건으로, 누를 때마다 새 보고서). additionalRequest = AI 추가 요청 */
  R03: (downtimeId: number, additionalRequest?: string) => http.post<ReassignmentDetailDto>('/reassignments', { downtimeId, additionalRequest }),
  /** N-01 계획수정 보고서를 슬랙으로 보내기 (고장 장비 + 보고서 + LLM 요약). 웹훅 없음 503, 슬랙 실패 502 */
  N01: (reportId: number) => http.post<SlackSendDto>(`/reassignments/${reportId}/slack`),

  // ── 관리·공통 (C) ──
  /** C-01 로그인 */
  C01: (body: { loginId: string; password: string }) => http.post<LoginDto>('/auth/login', body),
  /** C-02 사용자 목록 (page는 0부터) */
  C02: (q: { page: number; size: number }) => http.get<UserDto[]>('/users', q),
  /** C-03 사용자 등록 */
  C03: (body: { loginId: string; password: string; userName: string; role: string; email?: string; memo?: string }) => http.post<{ loginId: string }>('/users', body),
  /** C-04 라인 목록 */
  C04: () => http.get<LineDto[]>('/lines'),
  /** C-05 설비 목록 */
  C05: (q: { lineId?: string; process?: ProcessCode } = {}) => http.get<EquipmentDto[]>('/equipments', q),
}

/** WebSocket(STOMP) 구독 주소 (W-01~04) */
export const topics = {
  W01: '/topic/status',
  W02: '/topic/alarms',
  W03: '/topic/production',
  W04: (equipmentId: string) => `/topic/metrics/${equipmentId}`,
}
