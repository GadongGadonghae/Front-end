// 데모 기준정보. 라인·설비 ID·공정 코드·비가동 사유 코드는 백엔드 API v3.1 형식 (라인 A~F + 도장, 공정 6, 설비 39, 관리값 기준)
// 미정인 관리값 기준(슬리터·용접 가압력·전류·도장)은 null로 둔다
import type { ControlLimit, DowntimeCodeDef, Equipment, EquipmentType, Line, MasterData, Process } from '@/types/plant'

const LINE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const PRESS_STAGES = ['1단', '2단', '3단', '4단'] as const

const lines: Line[] = [
  ...LINE_IDS.map((id, i): Line => ({ id, name: `${id}라인`, kind: 'production', order: i + 1 })),
  { id: 'PT', name: '도장', kind: 'paint', order: 7 },
]

const processes: Process[] = [
  { id: 'COIL', name: '코일입고', order: 1 },
  { id: 'SLITTING', name: '슬리팅', order: 2 },
  { id: 'PRESS', name: '프레스', order: 3 },
  { id: 'WELDING', name: '용접', order: 4 },
  { id: 'PAINTING', name: '도장', order: 5 },
  { id: 'INSPECTION', name: '출고', order: 6 },
]

/** 표준CT [가정] (데이터정의서 4.1) */
const equipmentTypes: EquipmentType[] = [
  { code: 'slitter', name: '슬리터', standardCtSec: 120 },
  { code: 'press', name: '프레스', standardCtSec: 120 },
  { code: 'welder', name: '용접로봇', standardCtSec: 120 },
  { code: 'painter', name: '도장라인', standardCtSec: 40 },
  { code: 'vision', name: '비전검사기', standardCtSec: 20 },
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

const limit = (type: ControlLimit['type'], item: string, unit: string, lower: number | null, upper: number | null): ControlLimit =>
  ({ type, item, unit, lower, upper, updatedAt: null, updatedBy: null })

/** 관리값 기준 (데이터정의서 3.1). null = 미정 */
const controlLimits: ControlLimit[] = [
  limit('slitter', '출력 전류', 'A', null, null),
  limit('slitter', '출력 토크', 'kgfm', null, null),
  limit('slitter', 'DC Link 전압', 'V', null, null),
  limit('press', 'Pressure 1', '', 200, 350),
  limit('press', 'Pressure 2', '', 200, 350),
  limit('press', 'Pressure 5 (합계)', '', 400, 700),
  limit('press', 'Press time', 'ms', 50, 2000),
  limit('welder', '가압력', 'bar', null, null),
  limit('welder', '전류', 'kA', null, null),
  limit('welder', '전압', 'V', 1.5, 3.5),
  limit('welder', '통전시간', 'ms', 30, 120),
  limit('painter', 'pH', '', null, null),
  limit('painter', '온도', '℃', null, null),
  limit('painter', '전류', 'A', null, null),
  limit('painter', '전압', 'V', null, null),
  limit('painter', '건조로 온도', '℃', null, null),
]

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
