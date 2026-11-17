// 데모 값을 만드는 결정적 난수와 날짜 계산. 같은 입력이면 늘 같은 값 → 다시 조회해도 그래프가 바뀌지 않는다
/** FNV-1a 32비트 */
export function hash(...parts: (string | number)[]): number {
  let h = 0x811c9dc5
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: 0 이상 1 미만 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 0 이상 1 미만 한 개 */
export const noise = (...parts: (string | number)[]) => rng(hash(...parts))()

/** 정수 구간 [lo, hi] */
export const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

const pad = (n: number) => String(n).padStart(2, '0')

/** 현지 날짜 YYYY-MM-DD */
export const localDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD → 그날 00:00(현지) ms */
export const dayStart = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** 날짜에 일수 더하기 */
export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + n).getTime())
}

/** 기간(일·주·월)의 첫날과 마지막 날. 주는 월요일부터 */
export function periodRange(period: 'day' | 'week' | 'month', date: string): { first: string; last: string } {
  if (period === 'day') return { first: date, last: date }
  const [y, m, d] = date.split('-').map(Number)
  if (period === 'week') {
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7
    const first = addDays(date, -wd)
    return { first, last: addDays(first, 6) }
  }
  return { first: localDate(new Date(y, m - 1, 1).getTime()), last: localDate(new Date(y, m, 0).getTime()) }
}

/** first~last 사이 날짜 목록 */
export function daysOf(first: string, last: string): string[] {
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) out.push(d)
  return out
}
