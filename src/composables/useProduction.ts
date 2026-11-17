// 생산 조회 (SCR-011, API-100·101·102): 조회 조건 → 요약·라인별 계획 대비·기간 추이, 제품 내역 50건씩, 행을 누르면 공정별 기록
// 조건이 바뀌면 바로 다시 부르고, 그대로 두면 1분마다 갱신 (API 명세 6장)
import { computed, ref, shallowRef, watch } from 'vue'
import { source } from '@/data'
import type { Period } from '@/types/analysis'
import type { LineId, ProcessId } from '@/types/plant'
import type { Product, ProductDetail, ProductionQuery } from '@/types/production'
import type { BarRowView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { PROCESS_NAME } from '@/lib/status'
import { formatHm, formatNumber, formatTime, toDateStr } from '@/lib/format'

const POLL_MS = 60_000
/** 제품 내역 보관 90일 (D-86) */
const KEEP_DAYS = 90

export type ResultFilter = 'all' | 'ok' | 'ng' | 'wip'

export function useProduction(initialQ = '') {
  const { equipmentName } = useMaster()
  const today = toDateStr(Date.now())

  // 조회 조건 (SCR-011 1번). 기본 오늘·전체
  const period = ref<Period>('day')
  const date = ref(today)
  const lineId = ref<'' | LineId>('')
  const result = ref<ResultFilter>('all')
  const q = ref(initialQ)
  const page = ref(1)

  const base = computed<ProductionQuery>(() => ({ period: period.value, date: date.value, lineId: lineId.value || undefined }))
  const listQuery = computed<ProductionQuery>(() => ({ ...base.value, result: result.value, q: q.value.trim() || undefined, page: page.value }))
  // 조건이 바뀌면 첫 쪽으로
  watch([base, result, q], () => { page.value = 1 })

  const { data: summary } = usePoll(() => source.q.getProductionSummary(base.value), POLL_MS, base)
  const { data: list, loading } = usePoll(() => source.q.getProducts(listQuery.value), POLL_MS, listQuery)

  // 펼친 제품의 공정별 기록 (SCR-011 6번)
  const openId = ref<string | null>(null)
  const detail = shallowRef<ProductDetail | null>(null)
  watch(openId, (id) => {
    detail.value = null
    if (id) source.q.getProduct(id).then((d) => { if (openId.value === id) detail.value = d })
  })
  const toggle = (id: string) => { openId.value = openId.value === id ? null : id }

  /** 제품 ID로 찾기 (공정 검사 불량 목록에서 들어올 때): 그 제품을 만든 날로 옮기고 펼친다 */
  function findProduct(id: string) {
    const m = /^[A-F]-(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(id)
    q.value = id
    if (m) {
      period.value = 'day'
      date.value = `${m[1]}-${m[2]}-${m[3]}`
      lineId.value = ''
      result.value = 'all'
      openId.value = id
    }
  }
  if (initialQ) findProduct(initialQ)

  // ── 보이는 모양 ──
  const multiDay = computed(() => period.value !== 'day')
  const tooOld = computed(() => (Date.parse(today) - Date.parse(date.value)) / 86_400_000 > KEEP_DAYS)

  const rangeText = computed(() => {
    const s = summary.value
    if (!s) return ''
    if (!multiDay.value) return date.value === today ? `00:00 ~ ${formatHm(s.to)} 기준` : `${date.value} 하루`
    const last = toDateStr(Date.parse(s.to) - 1)
    return `${toDateStr(Date.parse(s.from))} ~ ${last.slice(5)}`
  })

  const ngRows = computed(() => {
    const ng = summary.value?.ngByProcess ?? {}
    return (['SLITTING', 'PRESS', 'WELDING', 'PAINTING', 'INSPECTION'] as ProcessId[]).map((p) => ({ process: p, label: p === 'INSPECTION' ? '출고 (비전)' : PROCESS_NAME[p], value: ng[p] ?? 0 }))
  })
  const ngTotal = computed(() => (summary.value ? ngRows.value.reduce((a, r) => a + r.value, 0) : null))

  const linePlan = computed(() => summary.value?.byLine[0]?.plan ?? null)
  const lineBars = computed<BarRowView[]>(() => (summary.value?.byLine ?? []).map((l) => ({
    key: l.lineId, label: l.lineId, value: l.done,
    display: `${formatNumber(l.done)} / ${formatNumber(l.plan)}`,
    strong: l.lineId === lineId.value,
  })))
  const pickLine = (key: string) => { lineId.value = lineId.value === key ? '' : (key as LineId) }

  const resultText = (p: Product) => (p.result === 'ok' ? '양품' : p.result === 'wip' ? '진행 중' : `${PROCESS_NAME[p.ngProcess ?? 'SLITTING']}에서 불량 제외`)
  const timeText = (iso: string | null) => (iso ? (multiDay.value ? `${iso.slice(5, 10)} ${formatHm(iso)}` : formatTime(iso)) : '-')

  const detailRows = computed(() => (detail.value?.records ?? []).map((r) => ({
    key: r.process,
    process: PROCESS_NAME[r.process],
    equipment: r.equipment ? equipmentName(r.equipment) : '-',
    time: r.from ? `${formatTime(r.from)} ~ ${r.to ? formatTime(r.to) : '진행 중'}` : '-',
    judgement: r.judgement === 'ok' ? '양품' : r.judgement === 'ng' ? '불량' : r.from ? '진행 중' : '-',
    reason: r.reason ?? '-',
    ng: r.judgement === 'ng',
  })))

  return {
    period, date, lineId, result, q, page, today,
    summary, list, loading, rangeText, ngRows, ngTotal, linePlan, lineBars, pickLine,
    openId, toggle, findProduct, detail, detailRows, resultText, timeText, multiDay, tooOld,
  }
}
