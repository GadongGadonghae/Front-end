// 알람·비가동 이력의 "아직 손볼 건"과 요약 (D-109). 백엔드에 없는 조건·집계라 mock·api가 같이 쓴다
import type { HistoryEvent, HistorySummary, HistoryTodo } from '@/types/events'
import type { DowntimeCode, StopState } from '@/types/state'

/** 아직 손볼 건 조건: 진행 중 고장 · 메일 발송 실패 */
export const isTodo: Record<HistoryTodo, (e: HistoryEvent) => boolean> = {
  ongoingFault: (e) => e.state === 'D' && e.end == null,
  notifyFail: (e) => !!e.notify && !e.notify.email,
}

/** 이력 전체로 요약을 센다. 진행 중 건은 지금(nowMs)까지 길이 */
export function summarize(events: HistoryEvent[], nowMs: number): HistorySummary {
  const byCode = new Map<DowntimeCode, { code: DowntimeCode; state: StopState; count: number; sec: number }>()
  for (const e of events) {
    const v = byCode.get(e.code) ?? { code: e.code, state: e.state, count: 0, sec: 0 }
    v.count += 1
    v.sec += Math.max(0, ((e.end ? Date.parse(e.end) : nowMs) - Date.parse(e.start)) / 1000)
    byCode.set(e.code, v)
  }
  const todo = { ongoingFault: 0, notifyFail: 0 }
  for (const k of Object.keys(todo) as HistoryTodo[]) todo[k] = events.filter(isTodo[k]).length
  return { byCode: [...byCode.values()], todo }
}
