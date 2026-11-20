// 오늘 생산 그래프 (SCR-001 7번, SCR-010 4번): 시간대별 누적 실적 vs 계획선.
// 시간대별 값은 API-020을 열 때와 매시 정각에 부르고, 지금 시간대의 끝점은 1초 snapshot 실적으로 이어 그린다 (API 명세 6장)
import { now as clockNow } from '@/clock'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { source } from '@/data'
import type { LineId } from '@/types/plant'
import type { HourlyOutput } from '@/types/production'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useNow } from '@/composables/useNow'

export function useTodayProduction(lineId?: LineId) {
  const hourly = shallowRef<HourlyOutput | null>(null)
  const snapshot = useLiveSnapshot()
  const now = useNow()

  const load = () => source.q.getTodayHourly(lineId).then((h) => { hourly.value = h })
  let timer: ReturnType<typeof setTimeout> | null = null
  const scheduleNextHour = () => {
    const d = new Date(clockNow())
    const ms = (60 - d.getMinutes()) * 60_000 - d.getSeconds() * 1000 + 500
    timer = setTimeout(() => { load(); scheduleNextHour() }, ms)
  }
  load()
  scheduleNextHour()
  onScopeDispose(() => { if (timer) clearTimeout(timer) })

  /** 지금 시각 (0~24 시간 단위) */
  const nowHour = computed(() => { const d = new Date(now.value); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 })

  /** 지금 실적 (snapshot, 1초) */
  const liveDone = computed(() => {
    const s = snapshot.value
    if (!s) return null
    if (!lineId) return s.plant.done
    return s.lines.find((l) => l.lineId === lineId)?.done ?? null
  })

  /** 누적 실적 선: 지난 시간은 시간대별, 끝점은 지금 실적 */
  const actual = computed<[number, number][]>(() => {
    const h = hourly.value
    if (!h) return []
    const pts: [number, number][] = [[0, 0]]
    for (const x of h.hours.slice(0, -1)) pts.push([x.hour + 1, x.cumulative])
    const last = liveDone.value ?? h.hours.at(-1)?.cumulative ?? 0
    pts.push([nowHour.value, last])
    return pts
  })

  const target = computed(() => hourly.value?.target ?? null)
  /** 계획선: 0시 0 → 24시 목표 (목표 × 지난 부하시간 비율 [가정], FN-003) */
  const plan = computed<[number, number][]>(() => (target.value == null ? [] : [[0, 0], [24, target.value]]))

  return { actual, plan, target, nowHour, liveDone, loaded: computed(() => hourly.value !== null) }
}
