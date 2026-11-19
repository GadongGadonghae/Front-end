// 생산 조회 (SCR-011, API-100·101·102, D-107 시안 G4): 생산품(제품) 중심, 두 기능을 탭으로.
//  · 공정 중 추적: 지금 공정 안 제품 → 공정별 수 + 제품 여정 시간표. 설비 고장으로 멈춘 제품은 1초 현재 상태로 가린다
//  · 이력 조회: 기간 · 라인 · 결과 · 제품 ID로 찾기 → 결과 도넛 + 제품 표 (50건씩)
// 두 탭 모두 오른쪽에 고른 제품의 공정별 기록. 진행 중 목록은 10초, 이력은 1분마다 다시 부른다 (API 명세 6장 [가정: 추적 10초])
import { computed, ref, watch } from 'vue'
import { source } from '@/data'
import type { Period } from '@/types/analysis'
import type { EquipmentLive } from '@/types/live'
import type { LineId, ProcessId } from '@/types/plant'
import type { Product, ProductDetail, ProductionQuery } from '@/types/production'
import type { JourneyRowView, ProcessCountView, ProductRecordView } from '@/types/view'
import { useMaster } from '@/composables/useMaster'
import { usePoll } from '@/composables/usePoll'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { useNow } from '@/composables/useNow'
import { DOWNTIME_NAME, PROCESS_NAME, lineName } from '@/lib/status'
import { josa } from '@/lib/josa'
import { formatHm, formatSpan, formatTime, toDateStr } from '@/lib/format'

const LIVE_MS = 10_000
const HIST_MS = 60_000
/** 제품 내역 보관 90일 (D-86) */
const KEEP_DAYS = 90
const STEPS: ProcessId[] = ['SLITTING', 'PRESS', 'WELDING', 'PAINTING', 'INSPECTION']

export type ProdTab = 'live' | 'hist'
export type ResultFilter = 'all' | 'ok' | 'ng' | 'wip'
/** 제품 여정 시간표가 보여 주는 길이: 지금부터 거슬러 1·2·4시간 (분 단위) */
export type JourneyScale = '60' | '120' | '240'

/** 진행 중 제품의 지금 자리: 처리 중인 공정, 아니면 다음 공정으로 이동 중 */
function placeOf(p: ProductDetail): { i: number; moving: boolean } {
  const at = p.records.findIndex((r) => r.from && !r.to)
  if (at >= 0) return { i: at, moving: false }
  return { i: Math.max(0, p.records.findIndex((r) => !r.from)), moving: true }
}

export function useProduction(initialQ = '') {
  const { equipmentName, master } = useMaster()
  const snap = useLiveSnapshot()
  const now = useNow()
  const today = toDateStr(Date.now())

  const tab = ref<ProdTab>(initialQ ? 'hist' : 'live')
  const lineId = ref<'' | LineId>('')
  const selected = ref<string | null>(null)
  const scale = ref<JourneyScale>('60')

  // ── 이력 조회 조건 ──
  const period = ref<Period>('day')
  const date = ref(today)
  const result = ref<ResultFilter>('all')
  const q = ref(initialQ)
  const page = ref(1)
  const base = computed<ProductionQuery>(() => ({ period: period.value, date: date.value, lineId: lineId.value || undefined }))
  const listQuery = computed<ProductionQuery>(() => ({ ...base.value, result: result.value, q: q.value.trim() || undefined, page: page.value }))
  watch([base, result, q], () => { page.value = 1 })

  // ── 불러오기 ──
  const liveKey = computed(() => `${tab.value}|${lineId.value}`)
  const { data: wip } = usePoll(async () => {
    if (tab.value !== 'live') return null
    const list = await source.q.getProducts({ period: 'day', date: today, lineId: lineId.value || undefined, result: 'wip', page: 1 })
    const details = await Promise.all(list.items.map((p) => source.q.getProduct(p.id)))
    return { total: list.total, items: details.filter((d): d is ProductDetail => d != null) }
  }, LIVE_MS, liveKey)
  const histKey = computed(() => `${tab.value}|${JSON.stringify(listQuery.value)}`)
  const { data: summary } = usePoll(() => source.q.getProductionSummary(base.value), HIST_MS, base)
  const { data: list } = usePoll(
    () => (tab.value === 'hist' ? source.q.getProducts(listQuery.value) : Promise.resolve(null)),
    HIST_MS, histKey,
  )
  // 고른 제품이 진행 중 목록에 없으면 따로 부른다
  const { data: picked } = usePoll(
    () => (selected.value && !wip.value?.items.some((p) => p.id === selected.value) ? source.q.getProduct(selected.value) : Promise.resolve(null)),
    HIST_MS, selected,
  )

  // ── 공정 중 추적 ──
  const liveById = computed(() => new Map<string, EquipmentLive>((snap.value?.equipment ?? []).map((e) => [e.id, e])))
  /** 지금 있는 공정이 설비 고장으로 멈췄으면 그 설비 상태: 처리 중인 설비, 또는 같은 라인·같은 공정의 설비 (프레스 4단은 한 줄로 이어져 한 단이 서면 모두 선다) */
  const faultOf = (p: ProductDetail): EquipmentLive | null => {
    const at = placeOf(p)
    if (at.moving) return null
    const rec = p.records[at.i]
    const ids = [rec.equipment, ...(master.value?.equipment ?? []).filter((e) => e.area === p.lineId && e.process === rec.process).map((e) => e.id)]
    for (const id of ids) {
      const live = id ? liveById.value.get(id) : undefined
      if (live?.state === 'D') return live
    }
    return null
  }
  const whereText = (p: ProductDetail) => {
    const at = placeOf(p)
    const name = PROCESS_NAME[STEPS[at.i]]
    if (at.moving) return `${josa(name, '으로/로')} 이동 중`
    return faultOf(p) ? `${name} · 설비 고장으로 멈춤` : name
  }

  const counts = computed<ProcessCountView[]>(() => STEPS.map((s, i) => {
    const here = (wip.value?.items ?? []).filter((p) => placeOf(p).i === i)
    return { key: s, label: PROCESS_NAME[s], count: here.length, stuck: here.filter((p) => faultOf(p)).length }
  }))

  // 먼저 들어간 제품이 위에 (투입 오래된 순)
  const journey = computed<JourneyRowView[]>(() => [...(wip.value?.items ?? [])].sort((a, b) => a.inputAt.localeCompare(b.inputAt)).map((p) => {
    const stuck = faultOf(p) != null
    return {
      id: p.id,
      where: whereText(p),
      state: stuck ? 'stuck' : '',
      lanes: p.records.flatMap((r, i) => {
        if (!r.from) return []
        const to = r.to ? Date.parse(r.to) : now.value
        const kind = r.to ? (r.judgement === 'ng' ? 'ng' : 'done') : stuck ? 'stuck' : 'now'
        return [{ step: i, label: `${PROCESS_NAME[r.process]} ${formatTime(r.from)}~${r.to ? formatTime(r.to) : '지금'}`, from: Date.parse(r.from), to, kind } as const]
      }),
    }
  }))
  /** 시간표 범위: 지금부터 고른 길이만큼 거슬러 (그보다 오래 머문 칸은 왼쪽 끝에서 잘린다) ~ 지금 조금 뒤 */
  const span = computed(() => {
    const from = Math.floor((now.value - Number(scale.value) * 60_000) / 60_000) * 60_000
    return { from, to: now.value + (now.value - from) * 0.04, now: now.value }
  })

  // ── 이력 조회 ──
  const multiDay = computed(() => period.value !== 'day')
  const tooOld = computed(() => (Date.parse(today) - Date.parse(date.value)) / 86_400_000 > KEEP_DAYS)
  const ngTotal = computed(() => (summary.value ? Object.values(summary.value.ngByProcess).reduce((a, n) => a + (n ?? 0), 0) : null))
  const rangeText = computed(() => {
    const s = summary.value
    if (!s) return ''
    if (!multiDay.value) return date.value === today ? `00:00 ~ ${formatHm(s.to)} 기준` : `${date.value} 하루`
    return `${toDateStr(Date.parse(s.from))} ~ ${toDateStr(Date.parse(s.to) - 1).slice(5)}`
  })
  const timeText = (iso: string | null) => (iso ? (multiDay.value ? `${iso.slice(5, 10)} ${formatHm(iso)}` : formatTime(iso)) : '-')
  const leadText = (p: Product) => (p.doneAt ? formatSpan((Date.parse(p.doneAt) - Date.parse(p.inputAt)) / 1000) : '-')
  const resultText = (p: Product) => (p.result === 'ok' ? '양품 출고' : p.result === 'wip' ? '진행 중' : `불량 제외 · ${PROCESS_NAME[p.ngProcess ?? 'SLITTING']}`)

  /** 제품 ID로 찾기 (공정 검사 불량 목록에서 들어올 때): 그 제품을 만든 날로 옮기고 고른다 (D-88) */
  function findProduct(id: string) {
    const m = /^[A-F]-(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(id)
    tab.value = 'hist'
    q.value = id
    if (m) {
      period.value = 'day'
      date.value = `${m[1]}-${m[2]}-${m[3]}`
      lineId.value = ''
      result.value = 'all'
      selected.value = id
    }
  }
  if (initialQ) findProduct(initialQ)

  // 탭을 바꾸면 고른 제품을 비우고, 그 탭 첫 제품(추적이면 멈춘 제품 먼저)을 고른다
  watch(tab, () => { selected.value = null })
  watch([wip, list, tab], () => {
    if (selected.value) return
    if (tab.value === 'live') selected.value = (wip.value?.items.find((p) => faultOf(p)) ?? wip.value?.items[0])?.id ?? null
    else selected.value = list.value?.items[0]?.id ?? null
  })

  // ── 고른 제품 기록 ──
  const detail = computed<ProductDetail | null>(() => {
    const id = selected.value
    if (!id) return null
    return wip.value?.items.find((p) => p.id === id) ?? (picked.value?.id === id ? picked.value : null)
  })
  const record = computed<ProductRecordView | null>(() => {
    const p = detail.value
    if (!p) return null
    const fault = p.result === 'wip' ? faultOf(p) : null
    const state = fault ? 'stuck' : p.result
    const endMs = p.doneAt ? Date.parse(p.doneAt) : now.value
    return {
      id: p.id,
      lineLabel: lineName(p.lineId),
      state,
      stateText: { stuck: '설비 고장으로 멈춤', wip: '공정 중', ok: '양품 출고', ng: '불량 제외' }[state],
      whereLabel: p.result === 'wip' ? '지금 위치' : '결과',
      where: p.result === 'wip' ? whereText(p) : resultText(p),
      inputAt: p.inputAt,
      leadSec: (endMs - Date.parse(p.inputAt)) / 1000,
      steps: p.records.map((r) => {
        const running = !!r.from && !r.to
        const kind = r.judgement === 'ok' ? 'ok' : r.judgement === 'ng' ? 'ng' : running ? (fault ? 'stuck' : 'now') : 'todo'
        const word = { ok: '합격', ng: '불량 제외', now: '처리 중', stuck: '멈춤', todo: '가지 않음' }[kind]
        const time = r.from
          ? `${formatTime(r.from)} → ${r.to ? `${formatTime(r.to)} · ${formatSpan((Date.parse(r.to) - Date.parse(r.from)) / 1000)}` : `${formatSpan((now.value - Date.parse(r.from)) / 1000)}째`}`
          : null
        const note = kind === 'stuck' && fault
          ? `${equipmentName(fault.id)} 고장 (${formatHm(fault.since)}부터) · ${fault.code ? DOWNTIME_NAME[fault.code] : '고장'}`
          : r.reason
        return { key: r.process, label: PROCESS_NAME[r.process], kind, word, equipment: r.equipment ? equipmentName(r.equipment) : null, time, note }
      }),
    }
  })

  return {
    tab, lineId, selected, today,
    // 추적
    wip, counts, journey, span, scale,
    // 이력
    period, date, result, q, page, summary, list, ngTotal, rangeText, multiDay, tooOld, timeText, leadText, resultText, findProduct,
    // 기록
    record,
  }
}
