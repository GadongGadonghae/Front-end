// 설정 (SCR-008 생산 목표 API-090·091, SCR-009 관리값 기준 API-092·093)
import { computed, reactive, ref, shallowRef, watch } from 'vue'
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
  const today = toDateStr(Date.now())
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
  const planText = computed(() => (qty.value ? `${formatNumber(qty.value)} ÷ 가동 라인 ${LINES} = ${formatNumber(Math.round(qty.value / LINES))}개` : '-'))
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
    saved.value = `${date.value} 목표 ${formatNumber(qty.value)}개를 저장했습니다`
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
    plan: r.quantity != null ? Math.round(r.quantity / LINES) : null,
    done: r.done,
    rate: r.quantity && r.done != null ? Math.round((r.done / r.quantity) * 1000) / 10 : null,
    editing: r.date === date.value,
  })))

  return { today, date, quantity, qty, planText, exists, saving, error, saved, save, edit, tableRows }
}

// ── 관리값 기준 ──
export const LIMIT_TYPES: { value: EquipmentTypeCode; label: string }[] = [
  { value: 'slitter', label: '슬리터' }, { value: 'press', label: '프레스' }, { value: 'welder', label: '용접로봇' }, { value: 'painter', label: '도장라인' },
]

interface Draft { lower: string; upper: string }

export function useControlLimits() {
  const { master, reload } = useMaster()
  const type = ref<EquipmentTypeCode>('press')
  const limits = shallowRef<ControlLimit[]>([])
  /** 종류마다 고치는 중인 값 (종류를 바꿔도 남는다) */
  const drafts = reactive<Partial<Record<EquipmentTypeCode, Record<string, Draft>>>>({})
  const error = ref('')
  const saved = ref('')
  const saving = ref(false)

  const toText = (n: number | null) => (n == null ? '' : String(n))
  function load(t: EquipmentTypeCode) {
    return source.q.getControlLimits(t).then((l) => {
      if (type.value !== t) return
      limits.value = l
      if (!drafts[t]) drafts[t] = Object.fromEntries(l.map((x) => [x.item, { lower: toText(x.lower), upper: toText(x.upper) }]))
    })
  }
  watch(type, (t) => { error.value = ''; saved.value = ''; load(t) }, { immediate: true })

  const counts = computed(() => {
    const c: Partial<Record<EquipmentTypeCode, number>> = {}
    for (const e of master.value?.equipment ?? []) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  })
  const typeOptions = computed(() => LIMIT_TYPES.map((t) => ({ ...t, label: `${t.label} ${counts.value[t.value] ?? ''}대`.replace(' 대', '') })))

  /** 빈 칸 = 미정(null). 숫자가 아니면 NaN */
  const parse = (s: string) => { const t = s.replace(/[,\s]/g, ''); return t === '' ? null : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN }
  const rows = computed(() => limits.value.map((l) => {
    const d = drafts[type.value]?.[l.item] ?? { lower: '', upper: '' }
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
    drafts[type.value] = Object.fromEntries(limits.value.map((x) => [x.item, { lower: toText(x.lower), upper: toText(x.upper) }]))
    error.value = ''
  }

  async function save() {
    error.value = ''
    saved.value = ''
    if (invalidCount.value) { error.value = `${invalidCount.value}개 항목을 고친 뒤 저장하세요. 저장되지 않았습니다`; return }
    saving.value = true
    const t = type.value
    const r = await source.cmd.saveControlLimits(t, rows.value.map((x) => ({ item: x.item, lower: x.lower as number | null, upper: x.upper as number | null })))
    saving.value = false
    if (!r.ok) { error.value = `${r.error}. 저장되지 않았습니다`; return }
    limits.value = r.value
    drafts[t] = Object.fromEntries(r.value.map((x) => [x.item, { lower: toText(x.lower), upper: toText(x.upper) }]))
    saved.value = '저장했습니다. 상태 판정과 예지보전 위험도에 바로 반영됩니다'
    // 관리값 그래프의 상·하한선이 새 값을 쓰도록 기준정보를 다시 부른다
    reload()
  }

  return { type, typeOptions, rows, dirtyCount, invalidCount, error, saved, saving, save, revert }
}
