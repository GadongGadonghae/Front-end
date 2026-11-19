// 표시 형식 순수 함수. 값이 없으면 "-" (D-78)
export const EMPTY = '-'

/** 천 단위 쉼표. null·NaN이면 "-" */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 지속시간: 1시간 미만 m:ss, 이상 h:mm:ss */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || totalSec < 0 || Number.isNaN(totalSec)) return EMPTY
  const s = Math.floor(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** 두 시각 사이 초 */
export function secondsBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 1000
}

const pad = (n: number) => String(n).padStart(2, '0')
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 시각 HH:mm:ss (현지 시간) */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return EMPTY
  const d = new Date(isoString)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 날짜 YYYY-MM-DD (요일) */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return EMPTY
  const d = new Date(isoString)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${WEEKDAY[d.getDay()]})`
}

/** 현지 날짜 문자열 YYYY-MM-DD (조회 조건용) */
export function toDateStr(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 시각 HH:mm */
export function formatHm(isoString: string | null | undefined): string {
  return isoString ? formatTime(isoString).slice(0, 5) : EMPTY
}

/** 사람이 읽는 길이: 3시간 12분 · 34분 · 4분 5초 · 40초 (가동률 손실, 걸린 시간) */
export function formatSpan(totalSec: number | null | undefined): string {
  if (totalSec == null || totalSec < 0 || Number.isNaN(totalSec)) return EMPTY
  const s = Math.round(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m ? `${h}시간 ${m}분` : `${h}시간`
  if (m >= 10) return `${m}분`
  if (m > 0) return s % 60 ? `${m}분 ${s % 60}초` : `${m}분`
  return `${s}초`
}
