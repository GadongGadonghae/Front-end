// 데모 기준정보. 라인·설비 ID·공정 코드·비가동 사유 코드는 백엔드 API v3.1 형식 (라인 A~F + 도장, 공정 6, 설비 39, 관리값 기준)
// 미정인 관리값 기준(슬리터·용접 가압력·전류·도장)은 null로 둔다
import type { ControlLimit, DowntimeCodeDef, Equipment, EquipmentType, Line, MasterData, Process } from '@/types/plant'

const LINE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const PRESS_STAGES = ['1단', '2단', '3단', '4단'] as const

const lines: Line[] = [
  // 도장 경로 기본: A~C → 도장 #1, D~F → 도장 #2 (배치도 연결선과 같음, 데모)
  ...LINE_IDS.map((id, i): Line => ({ id, name: `${id}라인`, kind: 'production', order: i + 1, defaultPaintId: i < 3 ? 'PT1' : 'PT2', currentPaintId: i < 3 ? 'PT1' : 'PT2' })),
  { id: 'PT', name: '도장', kind: 'paint', order: 7, defaultPaintId: null, currentPaintId: null },
]

const processes: Process[] = [
  { id: 'COIL', name: '코일입고', order: 1 },
  { id: 'SLITTING', name: '슬리팅', order: 2 },
  { id: 'PRESS', name: '프레스', order: 3 },
  { id: 'WELDING', name: '용접', order: 4 },
  { id: 'PAINTING', name: '도장', order: 5 },
  { id: 'INSPECTION', name: '출고', order: 6 },
]

/** 제품 1개 처리 시간(초) — 백엔드 API v3.1 공통 규칙 (11/17 갱신). 라인 능력은 가장 느린 프레스·용접 17초 → 시간당 약 211개 */
const equipmentTypes: EquipmentType[] = [
  { code: 'slitter', name: '슬리터', standardCtSec: 16 },
  { code: 'press', name: '프레스', standardCtSec: 17 },
  { code: 'welder', name: '용접로봇', standardCtSec: 17 },
  { code: 'painter', name: '도장라인', standardCtSec: 4 },
  { code: 'vision', name: '비전검사기', standardCtSec: 7 },
]

const equipment: Equipment[] = [
  ...LINE_IDS.flatMap((line): Equipment[] => [
    { id: `${line}-SL`, area: line, process: 'SLITTING', order: 1, type: 'slitter', name: `${line}라인 슬리팅`, shortName: '슬리팅', real: line === 'A' },
    ...PRESS_STAGES.map((stage, i): Equipment => ({
      id: `${line}-PR${i + 1}`, area: line, process: 'PRESS', order: i + 1, type: 'press', name: `${line}라인 프레스 ${stage}`, shortName: stage, real: false,
    })),
    { id: `${line}-WD`, area: line, process: 'WELDING', order: 1, type: 'welder', name: `${line}라인 용접`, shortName: '용접', real: false },
  ]),
  { id: 'PT1', area: 'PT', process: 'PAINTING', order: 1, type: 'painter', name: '도장 #1', shortName: '도장 #1', real: false },
  { id: 'PT2', area: 'PT', process: 'PAINTING', order: 2, type: 'painter', name: '도장 #2', shortName: '도장 #2', real: false },
  { id: 'VI', area: 'VI', process: 'INSPECTION', order: 1, type: 'vision', name: '비전', shortName: '비전', real: false },
]

/** 설비 종류별 기본 기준 (백엔드 API v3.1 항목 이름). null = 미정
 *  프레스·용접 전압·통전시간은 데이터셋 설명서 정상 범위, 용접 전류는 백엔드 명세 예시(DB 초안) 값. 슬리터·도장은 데이터 확정 전이라 미정 */
const DEFAULT_LIMITS: [ControlLimit['type'], string, string, number | null, number | null][] = [
  ['slitter', 'torque', 'kgfm', null, null],
  ['slitter', 'current', 'A', null, null],
  ['slitter', 'voltage', 'V', null, null],
  ['press', 'pressureLeft', 'bar', 200, 350],
  ['press', 'pressureRight', 'bar', 200, 350],
  ['press', 'pressureTotal', 'bar', 400, 700],
  ['press', 'pressTime', '×0.01초', 50, 2000],
  ['welder', 'pressForce', 'bar', null, null],
  ['welder', 'current', 'kA', 14.52, 15.07],
  ['welder', 'voltage', 'V', 1.5, 3.5],
  ['welder', 'weldTime', 'ms', 30, 120],
  ['painter', 'ph', '', null, null],
  ['painter', 'temperature', '℃', null, null],
  ['painter', 'current', 'A', null, null],
  ['painter', 'voltage', 'V', null, null],
]

/** 관리값 기준 = 백엔드 M-10 기준치: 설비마다 한 벌 (비전은 없음) */
let limitSeq = 0
const controlLimits: ControlLimit[] = equipment.flatMap((e) => DEFAULT_LIMITS.filter(([t]) => t === e.type).map(([type, item, unit, lower, upper]): ControlLimit =>
  ({ id: ++limitSeq, equipmentId: e.id, type, item, unit, lower, upper, updatedAt: null, updatedBy: null })))

const downtimeCodes: DowntimeCodeDef[] = [
  { code: 'PL_SHIFT', name: '교대', state: 'S' },
  { code: 'PL_PM', name: '예방보전', state: 'S' },
  { code: 'PL_CHANGE', name: '모델 교체', state: 'S' },
  { code: 'PL_SETUP', name: '코일·나이프 교체', state: 'S' },
  { code: 'UP_SHORTAGE', name: '재공부족', state: 'I' },
  { code: 'UP_DELAY', name: '작업지연', state: 'I' },
  { code: 'UP_BREAKDOWN', name: '장비고장', state: 'D' },
  { code: 'UP_ALARM', name: '알람(관리값 이탈)', state: 'D' },
  { code: 'UP_SAFETY', name: '안전문제', state: 'D' },
  { code: 'UP_LABOR', name: '노사협의', state: 'D' },
  { code: 'UP_ETC', name: '기타', state: 'D' },
]

export const MASTER: MasterData = { lines, processes, equipmentTypes, equipment, controlLimits, downtimeCodes }
