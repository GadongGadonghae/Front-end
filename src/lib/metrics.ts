// 관리값 항목 이름: 데이터는 백엔드 API v3.1 이름(DB 컬럼 camelCase), 화면은 한국어 이름 (docs/API-차이-v3.1.md 3.4)
// 같은 이름은 설비 종류가 달라도 뜻이 같다 (current = 전류)

const LABEL: Record<string, string> = {
  // 슬리터
  torque: '토크',
  // 프레스
  pressureLeft: '압력(좌)',
  pressureRight: '압력(우)',
  pressureTotal: '압력 합계',
  pressTime: '프레스 시간',
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
