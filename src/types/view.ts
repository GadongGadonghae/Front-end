// 화면용 모양 (뷰 모델): composable이 만들고 domain 부품이 그린다.
// domain 부품은 데이터를 직접 부르지 않으므로, 그릴 것을 이 모양으로 받는다 (FRONTEND.md 2장)
import type { PdmLevel, StateCode } from '@/types/state'
import type { LineId, ProcessId } from '@/types/plant'

/** 설비 칸 하나 (배치도·라인 흐름) */
export interface EquipCellView {
  id: string
  /** 칸 안 이름 (예: 2단, 도장 #1) */
  name: string
  state: StateCode
  /** 고장(D)일 때만 지속시간 (화면정의서 SCR-001 1번) */
  duration: string | null
  /** 예지보전 80% 이상이면 표시 (예: 주의 84%) */
  pdm: { level: PdmLevel; text: string } | null
}

/** 공장 배치도 (SCR-001, D-81) */
export interface FactoryMapView {
  inbound: { today: number; stock: number }
  lines: { id: LineId; done: number | null; plan: number | null; cells: EquipCellView[] }[]
  paint: EquipCellView[]
  vision: EquipCellView | null
}

/** 알림 열 한 줄 (SCR-001 10번, SCR-010 5번) */
export interface AlertRowView {
  id: string
  /** 상태 이력이면 R/S/I/D, 예지보전 위험이면 'risk' */
  kind: StateCode | 'risk'
  /** 설비 이름 (예: L2 프레스 3단) */
  title: string
  /** 코드 · 상세 */
  message: string
  /** 시작 시각 (ISO, 정렬용) */
  start: string
  /** 시작 시각 HH:mm:ss */
  time: string
  /** 진행 중이면 경과, 해제면 "지속 m:ss" */
  duration: string
  ongoing: boolean
  /** 고장 건 보고서: 이미 있으면 view, 해제된 고장이면 create */
  report: 'view' | 'create' | null
  reportId: string | null
  equipmentId: string
}

/** 라인 흐름의 큰 설비 칸 (SCR-010 3번): 배치도 칸 + 사유 · 오늘 숫자 */
export interface FlowCellView extends EquipCellView {
  /** 큰 칸은 모든 상태에서 지속시간을 보인다 */
  duration: string
  /** R이 아니면 비가동 코드 명칭 · 상세 */
  reason: { code: string; detail: string | null } | null
  /** 예: 가장 느린 단 */
  note: string | null
  info: { label: string; value: string }[]
}

/** 라인 흐름 (SCR-010 3번) */
export interface LineFlowView {
  /** 앞·뒤 끝 표시 (예: 입고에서 → 도장으로) */
  from: string
  to: string
  groups: {
    process: ProcessId
    name: string
    cells: FlowCellView[]
    /** 오늘 공정 생산 · 공정 검사 불량 */
    output: number | null
    ng: number | null
    /** 예: 4단 뒤 검사 */
    note: string | null
  }[]
  /** 공정 사이 재공 (groups.length - 1개) */
  wip: (number | null)[]
}

/** 라인 요약 열 (SCR-010 2번) */
export interface LineNowView {
  state: StateCode
  counts: Record<StateCode, number>
  equipmentCount: number
  done: number | null
  plan: number | null
  rate: number | null
  oee: number | null
  ngTotal: number | null
  ngRows: { process: ProcessId; label: string; value: number }[]
}
