// 기준정보 (데이터정의서 3장, 6장 DT-001~007)
import type { DowntimeCode, StopState } from '@/types/state'

/** 생산 라인 A~F (백엔드 API v3.1 lineId) */
export type ProductionLineId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
/** 화면에서 라인처럼 다루는 구역: 생산 라인 A~F + 공용 도장 PT (라인 상세 도장 탭). 백엔드에서 도장은 라인이 없다 */
export type LineId = ProductionLineId | 'PT'
/** 설비가 놓인 구역: 라인 + 공용 검사(출고) VI. 프론트 묶음용이며 백엔드 lineId가 아니다 */
export type AreaId = LineId | 'VI'

/** 공정 코드 (백엔드 API v3.1): 코일입고 → 슬리팅 → 프레스 → 용접 → 도장 → 검사(출고) */
export type ProcessId = 'COIL' | 'SLITTING' | 'PRESS' | 'WELDING' | 'PAINTING' | 'INSPECTION'

/** 설비 종류 (DT-004) */
export type EquipmentTypeCode = 'slitter' | 'press' | 'welder' | 'painter' | 'vision'

/** DT-001 라인 */
export interface Line {
  id: LineId
  name: string
  kind: 'production' | 'paint'
  order: number
}

/** DT-002 공정 */
export interface Process {
  id: ProcessId
  name: string
  order: number
}

/** DT-003 설비. 설비 ID는 백엔드 형식 (A-SL · A-PR1 · A-WD · PT1 · VI) */
export interface Equipment {
  id: string
  area: AreaId
  process: ProcessId
  /** 같은 라인·공정 안 순서 (프레스 1~4단, 도장 #1·#2) */
  order: number
  type: EquipmentTypeCode
  /** 화면 표시 이름 (라인 + 공정 + 번호, 예: C라인 프레스 2단) */
  name: string
  /** 짧은 이름 (배치도 칸 안, 예: 2단) */
  shortName: string
  /** 실설비 여부 (A라인 슬리팅 = PLC 연동 인버터, D-43) */
  real: boolean
}

/** DT-004 설비 종류 */
export interface EquipmentType {
  code: EquipmentTypeCode
  name: string
  /** 표준 사이클타임(초) [가정] (데이터정의서 4.1) */
  standardCtSec: number
}

/** DT-005 관리값 기준 = 백엔드 M-10 기준치. 설비별이다. 하한·상한이 미정이면 null */
export interface ControlLimit {
  /** 백엔드 기준치 번호 (M-11 수정에 씀) */
  id: number
  equipmentId: string
  type: EquipmentTypeCode
  /** 항목 이름 (백엔드 metric, camelCase). 화면 이름은 lib/metrics */
  item: string
  unit: string
  lower: number | null
  upper: number | null
  updatedAt: string | null
  updatedBy: string | null
}

/** DT-007 비가동 코드 */
export interface DowntimeCodeDef {
  code: DowntimeCode
  name: string
  state: StopState
}

/** 기준정보 묶음 */
export interface MasterData {
  lines: Line[]
  processes: Process[]
  equipmentTypes: EquipmentType[]
  equipment: Equipment[]
  controlLimits: ControlLimit[]
  downtimeCodes: DowntimeCodeDef[]
}
