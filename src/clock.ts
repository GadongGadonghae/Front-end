// 시연용 가상 시계 (11/21). 화면의 "지금"은 모두 여기서 읽는다 (Date.now() 대신 now()).
// 실서버(api)에서는 백엔드 GET /api/sim/clock 을 몇 초마다 받아 맞춘다 (main.ts) → 재생기·백엔드·화면이 같은 가상 시각
// (예: 실제로는 밤 2시라도 화면은 근무 09:00~18:00, 배속 ×10). 가상 시계가 꺼져 있거나 데모 데이터면 실제 시계.
// 어느 층에서나 가져다 쓸 수 있게 src 바로 아래에 둔다 (Vue·데이터를 모르는 순수 TypeScript)

interface Base { virtual: number; real: number; speed: number }
let base: Base | null = null

/** 지금 시각 (ms). 가상 시계가 켜져 있으면 가상 시각 */
export function now(): number {
  return base ? base.virtual + (Date.now() - base.real) * base.speed : Date.now()
}

/** 배속 (가상 시계가 꺼져 있으면 1) */
export function clockSpeed(): number {
  return base?.speed ?? 1
}

/** 서버가 알려 준 가상 시각·배속으로 맞춤. active = false면 실제 시계로 */
export function setClock(virtualIso: string, speed: number, active: boolean) {
  base = active ? { virtual: Date.parse(virtualIso), real: Date.now(), speed } : null
}
