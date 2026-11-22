// 관리값 항목 이름: 데이터는 백엔드 API v3.1 이름(DB 컬럼 camelCase), 화면은 한국어 이름 (docs/API-차이-v3.1.md 3.4)
// 같은 이름은 설비 종류가 달라도 뜻이 같다 (current = 전류)

const LABEL: Record<string, string> = {
  // 슬리터
  torque: '토크',
  // 프레스
  // 11/21 DB 관리값 기준(threshold.item_label)과 같은 이름으로. 3단 압력 차가 빠져 영어로 보이던 것
  pressureLeft: '좌 압력',
  pressureRight: '우 압력',
  pressureDiff: '압력 차 (좌−우)',
  pressureTotal: '압력 합계',
  pressTime: '가압 시간',
  // 용접
  pressForce: '가압력',
  weldTime: '통전시간',
  // 도장
  ph: 'pH',
  temperature: '온도',
  // 공통
  current: '전류',
  voltage: '전압',
  // 설비 상태 센서 (예지보전 SCR-004, 지금은 프론트 더미 · data/dummy/sensors.ts)
  motorTemp: '모터 온도',
  vibration: '진동',
  hydraulicTemp: '유압 온도',
  hydraulicPressure: '유압 압력',
  motorCurrent: '모터 전류',
  tipTemp: '팁 온도',
  coolantTemp: '냉각수 온도',
  coolantFlow: '냉각수 유량',
  pumpCurrent: '펌프 전류',
  fanVibration: '배기팬 진동',
  // 실설비 슬리터 인버터 (D-43, 백엔드 항목 아님)
  commandHz: '지령 주파수',
  outputHz: '출력 주파수',
}

/** 화면에 보일 항목 이름. 모르는 이름은 그대로 */
export const metricLabel = (metric: string): string => LABEL[metric] ?? metric

/** 11/21 항목 설명 한 줄 (그래프 제목 옆): 무엇을 재는 값인지 */
const HELP: Record<string, string> = {
  pressureLeft: '프레스 1단이 재는 값 · 금형 왼쪽 실린더 압력',
  pressureRight: '프레스 2단이 재는 값 · 금형 오른쪽 실린더 압력',
  pressureDiff: '프레스 3단이 재는 값 · 좌우 압력 차 (한쪽으로 쏠리면 커져요)',
  pressTime: '프레스 4단이 재는 값 · 눌러 주는 시간 (단위 0.01초)',
  pressForce: '용접 팁이 누르는 힘',
  weldTime: '전류를 흘리는 시간',
  current: '설비에 흐르는 전류',
  voltage: '설비에 걸린 전압',
  ph: '도료 산성도',
  temperature: '도료 온도',
}
export const metricHelp = (metric: string): string | null => HELP[metric] ?? null

/** 11/21 공정별로 재지 않는 항목 (기준표에는 있지만 값이 오지 않음): 0 대신 "측정 안 함" */
export const NOT_MEASURED: Partial<Record<string, Record<string, string>>> = {
  SLITTING: { torque: '토크는 교육장 인버터(LS SV-iG5A)가 주지 않는 값이라 측정하지 않아요' },
}
