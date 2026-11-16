// 기준정보 (데이터정의서 3장, 6장 DT-001~007)
import type { DowntimeCode, StateCode } from '@/types/state'

/** 라인 ID: 생산 라인 L1~L6, 도장 라인 PT. 입고·출고는 라인이 아닌 공용 구역 CM (D-79) */
export type LineId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'PT'
export type AreaId = LineId | 'CM'

/** 공정 A~F: 코일입고 → 슬리팅 → 프레스 → 용접 → 도장 → 출고 (D-02) */
export type ProcessId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

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

/** DT-003 설비. 설비 ID 형식 예: L3-PRS-2 (데이터정의서 4.3) */
export interface Equipment {
  id: string
  area: AreaId
  process: ProcessId
  /** 같은 라인·공정 안 순서 (프레스 1~4단, 도장 #1·#2) */
  order: number
  type: EquipmentTypeCode
  /** 화면 표시 이름 (라인 + 공정 + 번호, 예: L3 프레스 2단) */
  name: string
  /** 짧은 이름 (배치도 칸 안, 예: 2단) */
  shortName: string
  /** 실설비 여부 (L1 슬리팅 = iG5A 인버터, D-43) */
  real: boolean
}

/** DT-004 설비 종류 */
export interface EquipmentType {
  code: EquipmentTypeCode
  name: string
  /** 표준 사이클타임(초) [가정] (데이터정의서 4.1) */
  standardCtSec: number
}

/** DT-005 관리값 기준. 하한·상한이 미정이면 null */
export interface ControlLimit {
  type: EquipmentTypeCode
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
  state: Exclude<StateCode, 'R'>
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
