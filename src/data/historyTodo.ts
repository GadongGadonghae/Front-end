// 알람·비가동 이력의 "아직 손볼 건"과 요약 (D-109). 백엔드에 없는 조건·집계라 mock·api가 같이 쓴다
import type { HistoryEvent, HistorySummary, HistoryTodo, StateEvent } from '@/types/events'
import type { DowntimeCode, StopState } from '@/types/state'

/** 아직 손볼 건 조건: 진행 중 고장 · 메일 발송 실패 */
export const isTodo: Record<HistoryTodo, (e: HistoryEvent) => boolean> = {
  ongoingFault: (e) => e.state === 'D' && e.end == null,
  notifyFail: (e) => !!e.notify && !e.notify.email,
}

/** 이력 한 건을 비가동 이력(StateEvent)으로: 통신 끊김(DC, 코드 없음)이면 null. 보고서·설비 이력처럼 S·I·D만 다루는 곳에서 쓴다 */
export function asStateEvent(e: HistoryEvent | null): (StateEvent & Pick<HistoryEvent, 'notify'>) | null {
  if (!e || e.state === 'DC' || !e.code) return null
  return { ...e, state: e.state, code: e.code }
}

/** 이력 전체로 요약을 센다. 진행 중 건은 지금(nowMs)까지 길이 */
export function summarize(events: HistoryEvent[], nowMs: number): HistorySummary {
  const byCode = new Map<DowntimeCode, { code: DowntimeCode; state: StopState; count: number; sec: number }>()
  const comms = { count: 0, sec: 0 }
  for (const e of events) {
    const sec = Math.max(0, ((e.end ? Date.parse(e.end) : nowMs) - Date.parse(e.start)) / 1000)
    // 통신 끊김: 비가동 코드가 없어 따로 센다
    if (e.state === 'DC' || !e.code) { comms.count += 1; comms.sec += sec; continue }
    const v = byCode.get(e.code) ?? { code: e.code, state: e.state, count: 0, sec: 0 }
    v.count += 1
    v.sec += sec
    byCode.set(e.code, v)
  }
  const todo = { ongoingFault: 0, notifyFail: 0 }
  for (const k of Object.keys(todo) as HistoryTodo[]) todo[k] = events.filter(isTodo[k]).length
  return { byCode: [...byCode.values()], comms, todo }
}

/** 실서버 U-08의 통신 끊김 항목: eventId가 음수 (상태 이력 번호, 비가동 번호와 겹치지 않게). 메모 저장(U-09)이 안 돼요 (11/20).
 *  데모 데이터의 통신 끊김은 양수라 메모를 쓸 수 있어요 */
export const isCommsEvent = (id: string) => id.startsWith('-')
