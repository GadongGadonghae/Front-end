// 설정 (SCR-008 생산 목표 API-090·091, SCR-009 관리값 기준 API-092·093)
import { now as clockNow } from '@/clock'
import { computed, reactive, ref, shallowReactive, shallowRef, watch } from 'vue'
import { source } from '@/data'
import type { ControlLimit, EquipmentTypeCode } from '@/types/plant'
import type { TargetRow } from '@/types/report'
import { useMaster } from '@/composables/useMaster'
import { formatNumber, formatTime, toDateStr } from '@/lib/format'

const DAY = 86_400_000
/** 목록: 지난 14일 + 앞으로 7일 중 목표가 있는 날 */
const PAST_DAYS = 14
const AHEAD_DAYS = 7
/** 가동 라인 수 (D-87) */
const LINES = 6

// ── 생산 목표 ──
export function useTargets() {
  const today = toDateStr(clockNow())
  const rows = shallowRef<TargetRow[]>([])
  const load = () => source.q.getTargets(toDateStr(Date.parse(today) - (PAST_DAYS - 1) * DAY), toDateStr(Date.parse(today) + AHEAD_DAYS * DAY))
    .then((r) => { rows.value = r.filter((x) => x.date <= today || x.quantity != null) })
  load()

  // 입력 칸: 날짜(오늘·미래만, D-71)와 수량. 날짜를 고르면 그날 저장된 값을 채운다
  const date = ref(today)
  const quantity = ref('')
  const saving = ref(false)
  const error = ref('')
  const saved = ref('')
  const fill = () => {
    const q = rows.value.find((r) => r.date === date.value)?.quantity
    quantity.value = q != null ? String(q) : ''
  }
  watch(rows, fill, { once: true })
  watch(date, () => { fill(); error.value = ''; saved.value = '' })

  const qty = computed(() => {
    const t = quantity.value.replace(/[,\s]/g, '')
    return /^\d+$/.test(t) ? Number(t) : null
  })
  // 🆕 11/20: 오늘 목표는 지금 계획정지 중인 라인을 빼고 나눈다 (꺼진 라인에 물량이 잡히지 않게, 저장도 같은 기준)
  const stopped = shallowRef<string[]>([])
  source.q.getPlannedStopLines().then((l) => { stopped.value = l }).catch(() => {})
  const running = computed(() => (date.value === today ? Math.max(1, LINES - stopped.value.length) : LINES))
  const planText = computed(() => {
    if (!qty.value) return '-'
    // 오늘 목표를 올리면: 라인 계획은 그대로, 늘어난 만큼 추가 주문 배정 대기 (G-04)
    const now = rows.value.find((r) => r.date === today)?.quantity ?? null
    if (date.value === today && now != null && now > 0 && qty.value !== now) {
      return qty.value > now
        ? `기존 ${formatNumber(now)} + 추가 ${formatNumber(qty.value - now)}개 (생산관리팀장 배정 보고서 → 결재 후 라인에 반영)`
        : `기존 ${formatNumber(now)} − 감소 ${formatNumber(now - qty.value)}개 (생산관리팀장 조정 보고서 → 결재 후 라인 정지·감산)`
    }
    const off = date.value === today && stopped.value.length ? ` (계획정지 ${stopped.value.join('·')}라인 제외)` : ''
    return `${formatNumber(qty.value)} ÷ 가동 라인 ${running.value} = ${formatNumber(Math.round(qty.value / running.value))}개${off}`
  })
  const exists = computed(() => rows.value.some((r) => r.date === date.value && r.quantity != null))

  async function save() {
    error.value = ''
    saved.value = ''
    if (date.value < today) { error.value = '지난 날짜의 목표는 바꿀 수 없습니다'; return }
    if (!qty.value) { error.value = '목표 수량을 1 이상의 정수로 입력하세요'; return }
    saving.value = true
    const r = await source.cmd.saveTarget(date.value, qty.value)
    saving.value = false
    if (!r.ok) { error.value = r.error; return }
    saved.value = r.value.pending
      ? `오늘 목표 ${formatNumber(r.value.before ?? 0)} → ${formatNumber(qty.value)}개. ${r.value.pending > 0 ? `늘어난 ${formatNumber(r.value.pending)}개는 추가 주문 배정 대기` : `줄어든 ${formatNumber(-r.value.pending)}개는 감소 대기`}예요 (생산관리팀장이 보고서를 올리고 결재하면 라인 계획에 반영돼요)`
      : `${date.value} 목표 ${formatNumber(qty.value)}개를 저장했습니다`
    await load()
  }
  /** 목록의 [수정]: 그 날짜를 입력 칸으로 */
  const edit = (d: string) => { date.value = d }

  const tableRows = computed(() => rows.value.map((r) => ({
    key: r.date,
    date: r.date,
    today: r.date === today,
    past: r.date < today,
    future: r.date > today,
    quantity: r.quantity,
    /** 오늘 목표를 올려서 아직 라인에 안 나눈 수량 (결재 대기, 11/21) */
    pending: r.pending ?? 0,
    plan: r.quantity != null ? Math.round(r.quantity / LINES) : null,
    done: r.done,
    rate: r.quantity && r.done != null ? Math.round((r.done / r.quantity) * 1000) / 10 : null,
    by: r.updatedBy,
    editing: r.date === date.value,
  })))

  return { today, date, quantity, qty, planText, exists, saving, error, saved, save, edit, tableRows }
}

// ── 관리값 기준 ──
export const LIMIT_TYPES: { value: EquipmentTypeCode; label: string }[] = [
  { value: 'slitter', label: '슬리터' }, { value: 'press', label: '프레스' }, { value: 'welder', label: '용접로봇' }, { value: 'painter', label: '도장라인' },
]

interface Draft { lower: string; upper: string }

/** 관리값 기준 (백엔드 M-10·M-11): 설비 종류 → 설비를 고르고 그 설비의 항목별 하한·상한을 고친다 */
export function useControlLimits() {
  const { master, reload, equipmentName } = useMaster()
  const type = ref<EquipmentTypeCode>('press')
  const equipmentId = ref('')
  /** 설비마다 불러온(저장된) 값 */
  const loaded = shallowReactive<Record<string, ControlLimit[]>>({})
  const limits = computed(() => loaded[equipmentId.value] ?? [])
  /** 설비마다 고치는 중인 값 (설비·종류를 바꿔도 남는다) */
  const drafts = reactive<Record<string, Record<string, Draft>>>({})
  const error = ref('')
  const saved = ref('')
  const saving = ref(false)

  const toText = (n: number | null) => (n == null ? '' : String(n))
  const draftOf = (l: ControlLimit[]) => Object.fromEntries(l.map((x) => [x.item, { lower: toText(x.lower), upper: toText(x.upper) }]))
  function load(id: string) {
    if (!id) return
    source.q.getControlLimits(id).then((l) => {
      loaded[id] = l
      if (!drafts[id]) drafts[id] = draftOf(l)
    })
  }

  const ofType = (t: EquipmentTypeCode) => (master.value?.equipment ?? []).filter((e) => e.type === t)
  // 종류를 바꾸면 그 종류의 첫 설비
  watch([type, master], () => {
    if (!ofType(type.value).some((e) => e.id === equipmentId.value)) equipmentId.value = ofType(type.value)[0]?.id ?? ''
  }, { immediate: true })
  watch(equipmentId, (id) => { error.value = ''; saved.value = ''; load(id) }, { immediate: true })

  /** 빈 칸 = 미정(null). 숫자가 아니면 NaN */
  const parse = (s: string) => { const t = s.replace(/[,\s]/g, ''); return t === '' ? null : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN }
  /** 설비마다 저장하지 않은 항목 수 */
  const dirtyOf = (id: string) => (loaded[id] ?? []).filter((l) => {
    const d = drafts[id]?.[l.item]
    return d && (parse(d.lower) !== l.lower || parse(d.upper) !== l.upper)
  }).length
  const dirtyIds = computed(() => Object.keys(loaded).filter((id) => dirtyOf(id)))

  const typeOptions = computed(() => LIMIT_TYPES.map((t) => {
    const n = dirtyIds.value.filter((id) => ofType(t.value).some((e) => e.id === id)).length
    return { ...t, label: `${t.label} ${ofType(t.value).length}대` + (n ? ` · 바뀜 ${n}` : '') }
  }))
  const equipmentOptions = computed(() => ofType(type.value).map((e) => {
    const n = dirtyOf(e.id)
    return { value: e.id, label: equipmentName(e.id) + (n ? ` · 바뀜 ${n}` : '') }
  }))
  /** 지금 보지 않는 설비에 저장하지 않은 값 (저장은 지금 설비만 한다) */
  const otherDirty = computed(() => dirtyIds.value.filter((id) => id !== equipmentId.value).map((id) => `${equipmentName(id)} ${dirtyOf(id)}개`).join(', '))

  const rows = computed(() => limits.value.map((l) => {
    const d = drafts[equipmentId.value]?.[l.item] ?? { lower: '', upper: '' }
    const lower = parse(d.lower)
    const upper = parse(d.upper)
    const invalid = Number.isNaN(lower) || Number.isNaN(upper)
      ? '숫자로 입력하세요'
      : lower != null && upper != null && lower > upper ? '하한이 상한보다 큽니다' : ''
    return {
      key: l.item, item: l.item, unit: l.unit || '-', draft: d, lower, upper, invalid,
      dirty: lower !== l.lower || upper !== l.upper,
      modified: l.updatedAt ? `${toDateStr(Date.parse(l.updatedAt))} ${formatTime(l.updatedAt).slice(0, 5)}` : null,
      modifiedBy: l.updatedBy,
    }
  }))
  const dirtyCount = computed(() => rows.value.filter((r) => r.dirty).length)
  const invalidCount = computed(() => rows.value.filter((r) => r.invalid).length)

  function revert() {
    drafts[equipmentId.value] = draftOf(limits.value)
    error.value = ''
  }

  async function save() {
    error.value = ''
    saved.value = ''
    if (invalidCount.value) { error.value = `${invalidCount.value}개 항목을 고친 뒤 저장하세요. 저장되지 않았습니다`; return }
    saving.value = true
    const id = equipmentId.value
    const r = await source.cmd.saveControlLimits(id, rows.value.filter((x) => x.dirty).map((x) => ({ item: x.item, lower: x.lower as number | null, upper: x.upper as number | null })))
    saving.value = false
    if (!r.ok) { error.value = `${r.error}. 저장되지 않았습니다`; return }
    loaded[id] = r.value
    drafts[id] = draftOf(r.value)
    saved.value = `${equipmentName(id)} 기준을 저장했습니다. 상태 판정과 예지보전 위험도에 바로 반영됩니다`
    // 관리값 그래프의 상·하한선이 새 값을 쓰도록 기준정보를 다시 부른다
    reload()
  }

  return { type, equipmentId, typeOptions, equipmentOptions, rows, dirtyCount, invalidCount, otherDirty, error, saved, saving, save, revert }
}
