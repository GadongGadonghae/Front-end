// 근무 시간 09:00~18:00 (하루 0시부터 초). 가동률 띠 범위 · 시간대별 적재 · "09:00 ~ 지금 기준" 글이 같이 쓴다 (11/22)
export const SHIFT_START = 9 * 3600
export const SHIFT_END = 18 * 3600

/** 오늘 값의 기준 시간 글: 근무 시작 ~ 지금 */
export function shiftBasis(nowMs: number): string {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  if (d.getHours() * 3600 < SHIFT_START) return '근무 시작(09:00) 전'
  return `09:00 ~ ${p(d.getHours())}:${p(d.getMinutes())} 기준`
}
