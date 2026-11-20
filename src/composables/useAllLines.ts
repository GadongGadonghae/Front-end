// 전체 라인 (대시보드 > 전체라인 탭): A~F + 도장 7칸. 라인마다 오늘 실적/계획 · 라인 OEE · 라인 불량 · 오늘 알람 이력 건수
// 1초 snapshot(실적) + 10초 summary(계획·OEE·불량). 계산은 라인 상세(useLineDetail)와 같다
import { computed } from 'vue'
import type { LineId } from '@/types/plant'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useMaster } from '@/composables/useMaster'
import { useTodayAlarms } from '@/composables/useTodayAlarms'
import { lineName } from '@/lib/status'
import { LINE_IDS } from '@/lib/routes'

export interface LineColumnView {
  id: LineId
  name: string
  done: number | null
  plan: number | null
  rate: number | null
  oee: number | null
  ng: number | null
  ngRate: number | null
  /** 오늘 알람 이력 건수 (라인 상세 '오늘 알람 이력'과 같은 목록) */
  alarms: { total: number; ongoing: number }
}

const pct = (a: number | null, b: number | null) => (a != null && b ? Math.round((a / b) * 1000) / 10 : null)

export function useAllLines() {
  const snapshot = useLiveSnapshot()
  const summary = useLiveSummary()
  const { equipmentById } = useMaster()
  // 공장 전체 알람(고장 + 통신 끊김, 알람 이력 탭과 같은 기준) 하나만 구독하고 설비의 구역(라인)으로 나눈다
  const { rows: alerts } = useTodayAlarms()
  const alarmsByLine = computed(() => {
    const m = new Map<string, { total: number; ongoing: number }>()
    for (const r of alerts.value) {
      const area = equipmentById.value.get(r.equipmentId)?.area
      if (!area) continue
      const c = m.get(area) ?? { total: 0, ongoing: 0 }
      c.total += 1
      if (r.ongoing) c.ongoing += 1
      m.set(area, c)
    }
    return m
  })

  const columns = computed<LineColumnView[]>(() => LINE_IDS.map((id) => {
    const ls = summary.value?.lines.find((x) => x.lineId === id)
    const done = snapshot.value?.lines.find((x) => x.lineId === id)?.done ?? ls?.done ?? null
    const plan = ls?.plan ?? null
    const ng = ls ? Object.values(ls.ngByProcess).reduce((a: number, v) => a + (v ?? 0), 0) : null
    return { id, name: lineName(id), done, plan, rate: pct(done, plan), oee: ls?.oee ?? null, ng, ngRate: pct(ng, done), alarms: alarmsByLine.value.get(id) ?? { total: 0, ongoing: 0 } }
  }))

  return { columns }
}
