// 화면용 모양 (뷰 모델): composable이 만들고 domain 부품이 그린다.
// domain 부품은 데이터를 직접 부르지 않으므로, 그릴 것을 이 모양으로 받는다 (FRONTEND.md 2장)
import type { PdmLevel, StateCode } from '@/types/state'
import type { LineId } from '@/types/plant'

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
