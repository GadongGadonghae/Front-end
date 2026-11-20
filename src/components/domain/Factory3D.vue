<!-- SCR-005 3D 공장 (대시보드 배치도의 3D 보기, D-118). 설비 상태 색 · 이상 표시 · 도장 경로 · 제품 상자(데모)
     3D ↔ 탑뷰: 같은 원근 카메라가 부드럽게 날아간다. 탑뷰에 도착하면 바닥 상태 칸 + 설비 상태 칩 (예전 탑뷰 모양)
     설비를 누르면 카메라가 그 설비로 다가가고(화면 가운데) 왼쪽에 설비 팝업. 닫으면(× · Esc · 팝업 밖) 누르기 전 자리로
     라인 바닥에 마우스를 올리면 외곽선, 누르면 오른쪽 위에 간단한 라인 카드. 값은 props로 받고, 이동은 emit으로 페이지에 맡긴다 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createFactoryScene, type FactoryScene, type SceneColors, type ViewMode } from '@/components/domain/factory3d/scene'
import EquipPanel from '@/components/domain/factory3d/EquipPanel.vue'
import LinePanel from '@/components/domain/factory3d/LinePanel.vue'
import { formatDuration } from '@/lib/format'
import type { Equipment, Line, LineId, ProductionLineId } from '@/types/plant'
import type { EquipmentLive, FlowPositions, LineSummary } from '@/types/live'
import type { StateCode } from '@/types/state'

const props = defineProps<{
  equipment: Equipment[]
  live: EquipmentLive[]
  lines: Line[]
  lineSummaries: LineSummary[]
  flow: FlowPositions | null
  /** 지금 시각 (ms). 지속 시간 계산용 */
  now: number
  /** 오늘 승인·적용된 추가 주문 배정 수량 (라인별, 배정 칸 "+N 추가 배정"). 배정량은 lineSummaries.plan */
  additions?: Partial<Record<LineId, number>>
  /** 오늘 비전 검사 양품·불량 (비전 칸 · 출하 적재 상자, 11/21) */
  vision?: { ok: number; ng: number } | null
}>()
const emit = defineEmits<{
  'open-line': [id: LineId]
  'open-outbound': []
  'open-inbound': []
  'open-action': [equipmentId: string]
}>()

const host = ref<HTMLDivElement | null>(null)
const popEl = ref<HTMLElement | null>(null)
const scene = shallowRef<FactoryScene | null>(null)
const view = ref<ViewMode>('3d')
const selLine = ref<ProductionLineId | null>(null)
const popId = ref<string | null>(null)
/** 확인한 이상: 설비 ID@시작 시각. 같은 상태가 이어지는 동안 이상 표시를 숨긴다 */
const acked = ref(new Set<string>())

const liveById = computed(() => new Map(props.live.map((e) => [e.id, e])))
const eqById = computed(() => new Map(props.equipment.map((e) => [e.id, e])))
const ackKey = (e: EquipmentLive) => `${e.id}@${e.since}`
/** 이상 표시 대상: 고장 · 통신 끊김 · 원인 코드가 있는 대기 */
const isIssue = (e: EquipmentLive) => e.state === 'D' || e.state === 'DC' || (e.state === 'I' && e.code != null)
const issues = computed(() => props.live.filter((e) => isIssue(e) && !acked.value.has(ackKey(e))))
const secOf = (l: EquipmentLive) => Math.max(0, Math.floor((props.now - Date.parse(l.since)) / 1000))

function colors(): SceneColors {
  const css = getComputedStyle(host.value!)
  const v = (n: string) => css.getPropertyValue(n).trim()
  const state: Record<StateCode, string> = { R: v('--c-run'), S: v('--c-stop-solid'), I: v('--c-idle'), D: v('--c-down'), DC: v('--c-dc') }
  return {
    state, accent: v('--c-accent'), bg: v('--c-3d-bg'), floor: v('--c-3d-floor'), grid: v('--c-3d-grid'), yard: v('--c-3d-yard'), body: v('--c-3d-body'),
    frame: v('--c-3d-frame'), metal: v('--c-3d-metal'), dark: v('--c-3d-dark'), chrome: v('--c-3d-chrome'), glass: v('--c-3d-glass'), wood: v('--c-3d-wood'), carton: v('--c-3d-carton'), belt: v('--c-3d-belt'), route: v('--c-3d-route'), route2: v('--c-3d-route-2'),
    routeAlt: v('--c-3d-route-alt'), product: v('--c-3d-product'), cap: v('--c-3d-frame'),
  }
}

// ── 설비 팝업 (왼쪽) ──
function pick(id: string) {
  if (!eqById.value.has(id)) return
  popId.value = id
  scene.value?.focus(id)
  // 라인 상세가 열려 있으면 그 설비의 라인으로 따라간다
  const a = eqById.value.get(id)!.area
  if (selLine.value && a !== 'PT' && a !== 'VI' && a !== selLine.value) selectLine(a as ProductionLineId)
}
/** restore = 누르기 전 카메라 자리로 돌아간다 (보기 전환 버튼은 스스로 날아가므로 false) */
function closePop(restore = true) {
  if (!popId.value) return
  popId.value = null
  if (restore) scene.value?.unfocus()
}
function selectLine(L: ProductionLineId | null) {
  selLine.value = L
  scene.value?.select(L)
}
function setView(m: ViewMode) {
  closePop(false)
  scene.value?.setView(m)
}

// 팝업 밖을 누르면 닫는다. 3D 장면 안은 scene이 알려 준다 (설비 = 바꿔 열기, 빈 곳·라인 = 닫기)
function onDocClick(ev: MouseEvent) {
  const t = ev.target as Node | null
  if (!popId.value || !t) return
  if (popEl.value?.contains(t) || host.value?.contains(t)) return
  if ((t as Element).closest?.('[data-keep-pop]')) return
  closePop()
}
function onKey(ev: KeyboardEvent) {
  if (ev.key !== 'Escape') return
  if (popId.value) closePop()
  else if (selLine.value) selectLine(null)
}

onMounted(() => {
  const s = createFactoryScene(host.value!, colors(), {
    onPick: pick,
    onLine: (L) => {
      // 팝업이 열려 있으면 먼저 닫기만 한다 (팝업 밖 누름)
      if (popId.value) { closePop(); return }
      selectLine(L)
    },
    // 11/21 비전 검사는 출고 화면 대신 비전 설비 창 (양품·불량은 칸에 바로), 적재는 출고 화면
    onZone: (z) => (z === 'inbound' ? emit('open-inbound') : z === 'paint' ? emit('open-line', 'PT') : z === 'vision' ? pick('VI') : emit('open-outbound')),
    onEmpty: () => {
      if (popId.value) closePop()
      else if (selLine.value) selectLine(null)
    },
  })
  s.onModeChange((m) => { view.value = m })
  scene.value = s
  push()
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKey)
  scene.value?.dispose()
})

/** 탑뷰 설비 카드 둘째 줄: 가동이 아니면 지속 시간 */
function push() {
  const s = scene.value
  if (!s) return
  s.setStates(props.live.map((l) => ({ id: l.id, state: l.state, note: l.state === 'R' ? null : formatDuration(secOf(l)) })))
  s.setIssues(issues.value.map((e) => ({ equipmentId: e.id, state: e.state })))
  s.setRoutes(Object.fromEntries(props.lines.filter((l) => l.kind === 'production').map((l) => [l.id, l.currentPaintId])))
  s.setFlow(props.flow)
  // 출하 적재: 오늘 출고 양품 (비전 검사 양품 = 출고). 없으면 라인별 실적 합
  s.setShipped(props.vision?.ok ?? props.lineSummaries.filter((x) => x.lineId !== 'PT').reduce((a, x) => a + (x.done ?? 0), 0))
  s.setVision(props.vision ?? null)
  s.setAllocation(Object.fromEntries(props.lineSummaries.filter((x) => x.lineId !== 'PT')
    .map((x) => [x.lineId, { done: x.done, plan: x.plan, added: props.additions?.[x.lineId] ?? 0 }])))
}
watch(() => [props.live, props.lines, props.flow, issues.value, props.now, props.lineSummaries, props.additions, props.vision], push)

const pop = computed(() => {
  const id = popId.value
  if (!id) return null
  const e = eqById.value.get(id)
  const l = liveById.value.get(id)
  if (!e || !l) return null
  const line = e.area === 'PT' ? '도장 (공용)' : e.area === 'VI' ? '출고 (공용)' : `${e.area}라인`
  return { e, l, line, sec: secOf(l), abnormal: isIssue(l), issue: isIssue(l) && !acked.value.has(ackKey(l)) }
})
function ack() {
  const l = pop.value?.l
  if (l) acked.value = new Set(acked.value).add(ackKey(l))
  closePop()
}
/** 생산 라인은 3D에서 그 라인으로 다가간 뒤 라인 상세로 (D-119). 도장·출고는 바로 */
function openLine(id: LineId) {
  const s = scene.value
  if (!s || id === 'PT' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { emit('open-line', id); return }
  closePop(false)
  s.dive(id as ProductionLineId, () => emit('open-line', id))
}
function goLine() {
  const a = pop.value?.e.area
  if (a === 'VI') emit('open-outbound')
  else if (a) openLine(a)
}

// ── 라인 카드 (오른쪽 위, 간소화) ──
const paintName = (id: string | null) => (id ? `도장 ${id.slice(2)}` : '-')
const panel = computed(() => {
  const L = selLine.value
  if (!L) return null
  const sum = props.lineSummaries.find((x) => x.lineId === L) ?? null
  const counts: Record<StateCode, number> = { R: 0, I: 0, S: 0, D: 0, DC: 0 }
  for (const e of props.equipment) if (e.area === L) { const st = liveById.value.get(e.id)?.state; if (st) counts[st] += 1 }
  const pile = (k: string) => props.flow?.products.filter((p) => 'pile' in p.location && p.location.pile === `${L}:${k}`).length ?? null
  const line = props.lines.find((l) => l.id === L)
  return {
    line: L, sum, counts,
    paint: paintName(line?.currentPaintId ?? null),
    switched: !!line && line.currentPaintId !== line.defaultPaintId,
    wip: [{ label: '슬리팅→프레스', qty: pile('SL-PR') }, { label: '프레스→용접', qty: pile('PR-WD') }, { label: '용접→도장', qty: pile('WD-PT') }],
  }
})
</script>

<template>
  <div class="f3d">
    <div ref="host" class="stage" />

    <div class="views" role="group" aria-label="3D 보기" data-keep-pop>
      <button type="button" :aria-pressed="view === '3d'" @click="setView('3d')">3D</button>
      <button type="button" :aria-pressed="view === 'top'" @click="setView('top')">탑뷰</button>
    </div>
    <p class="hint">라인 바닥을 누르면 라인 상세 · 설비를 누르면 가까이 · 왼쪽 끌기 이동 · 휠 확대 · 오른쪽 끌기 회전 · 제품 상자는 데모 값</p>

    <div v-if="pop" ref="popEl" class="dock left">
      <EquipPanel
        :e="pop.e"
        :l="pop.l"
        :sec="pop.sec"
        :line-name="pop.line"
        :abnormal="pop.abnormal"
        :issue="pop.issue"
        @close="closePop()"
        @ack="ack"
        @go-line="goLine"
        @go-action="emit('open-action', pop.e.id)"
      />
    </div>

    <div v-if="panel" class="dock right" data-keep-pop>
      <LinePanel
        v-bind="panel"
        @close="selectLine(null)"
        @open-line="openLine(panel.line)"
      />
    </div>
  </div>
</template>

<style scoped>
.f3d {
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  border-radius: var(--r-2);
  background: var(--c-3d-bg);
  font-variant-numeric: tabular-nums;
}

.stage {
  position: absolute;
  inset: 0;
}

.views {
  position: absolute;
  z-index: 4;
  top: var(--sp-3);
  left: var(--sp-3);
  display: flex;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.views button {
  min-width: 56px;
  height: var(--control-h-sm);
  padding: 0 var(--sp-3);
  border: 0;
  background: none;
  color: var(--c-ink-2);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
  cursor: pointer;
}

.views button:hover { background: var(--c-surface-sunk); }

.views button[aria-pressed="true"] {
  background: var(--c-ink);
  color: var(--c-inverse-ink);
}

.hint {
  position: absolute;
  bottom: var(--sp-3);
  left: var(--sp-3);
  max-width: calc(100% - var(--sp-6));
  margin: 0;
  padding: 2px var(--sp-2);
  overflow: hidden;
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

/* 붙는 자리: 설비 팝업 = 왼쪽 (보기 버튼 아래), 라인 카드 = 오른쪽 위 (내용만큼) */
.dock {
  position: absolute;
  z-index: 5;
  width: var(--f3d-dock-w);
}

.dock.left {
  top: calc(var(--sp-3) + var(--control-h-sm) + var(--sp-2));
  left: var(--sp-3);
  max-height: calc(100% - var(--control-h-sm) - var(--sp-3) * 2 - var(--sp-2));
  overflow-y: auto;
}

.dock.right {
  top: var(--sp-3);
  right: var(--sp-3);
  max-height: calc(100% - var(--sp-3) * 2);
  overflow-y: auto;
}

/* ── 장면 위 이름표 (scene.ts가 만든 DOM이라 :deep) ── */
.stage :deep(.f3d-layer) {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.stage :deep(.f3d-tag) {
  position: absolute;
  top: 0;
  left: 0;
  white-space: nowrap;
  font-size: var(--fs-sm);
  line-height: var(--lh-tight);
}

.stage :deep(.f3d-svg) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.stage :deep(.f3d-svg polygon) {
  fill: none;
  stroke: var(--c-accent);
  stroke-linejoin: round;
}

.stage :deep(.f3d-svg .sel) { stroke-width: 3px; }

.stage :deep(.f3d-svg .hov) {
  fill: var(--c-accent-tint);
  stroke-width: 2px;
}

.stage :deep(.f3d-ico) {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 공정 머리글: 먹색 표지판 (장면 위에서 가장 잘 읽히게) */
.stage :deep(.f3d-zone) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px var(--sp-2);
  border: 0;
  border-radius: var(--r-1);
  background: var(--c-ink);
  color: var(--c-inverse-ink);
  font: inherit;
  font-weight: var(--fw-strong);
}

/* 눌러서 상세 화면으로 가는 구역: 흰 표지판 + 파랑 글자 + 화살표 */
.stage :deep(.f3d-zone.go) {
  padding-right: var(--sp-1);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
  background: var(--c-surface);
  color: var(--c-accent);
  pointer-events: auto;
  cursor: pointer;
}

.stage :deep(.f3d-zone.go:hover) { background: var(--c-surface-sunk); }

/* 라인 이름: 라인 바닥 왼쪽 끝. 단추가 아니라 이름표 (바닥을 눌러 고른다) */
.stage :deep(.f3d-line) {
  padding: 3px var(--sp-2);
  border-radius: var(--r-1);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
  background: var(--c-surface);
  color: var(--c-ink);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.stage :deep(.f3d-line.hov) {
  box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-accent);
  color: var(--c-accent);
}

.stage :deep(.f3d-line.on) {
  box-shadow: none;
  background: var(--c-ink);
  color: var(--c-inverse-ink);
}

/* 배정 칸 (코일 입고 왼쪽): 라인별 생산 / 배정 + 진행 막대. 추가 배정 받은 라인은 강조색 테두리 */
.stage :deep(.f3d-alloc-head small) {
  display: block;
  font-size: var(--fs-sm);
  text-align: center;
}

.stage :deep(.f3d-alloc) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: calc(var(--sp-8) * 3);
  padding: 2px var(--sp-2) var(--sp-1);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stage :deep(.f3d-alloc.more) {
  border: var(--line-w-strong) solid var(--c-accent);
}

.stage :deep(.f3d-alloc .top) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}

.stage :deep(.f3d-alloc .n) {
  color: var(--c-ink-3);
}

.stage :deep(.f3d-alloc .n b) {
  color: var(--c-ink);
}

.stage :deep(.f3d-alloc .bar) {
  display: block;
  height: var(--sp-1);
  border-radius: 2px;
  background: var(--c-track);
}

.stage :deep(.f3d-alloc .bar i) {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--c-ink-3);
}

.stage :deep(.f3d-alloc .add) {
  color: var(--c-accent);
  font-weight: var(--fw-strong);
}

/* 비전 검사 칸: 양품·불량 (11/21) */
.stage :deep(.f3d-vi) {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  padding: 2px var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stage :deep(.f3d-vi .ng) {
  color: var(--c-ink-2);
}

/* 재공 수 (상자 아이콘 + 수) · 코일 재고 */
.stage :deep(.f3d-cnt) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--r-1);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
  background: var(--c-surface);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.stage :deep(.f3d-pid) {
  padding: 1px var(--sp-1);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink-2);
}

/* 상태 글자 칸 (상태 색 면은 state.css의 .st-*) */
.stage :deep(.f3d-key) {
  display: inline-grid;
  flex: none;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  border-radius: 3px;
  font-size: var(--fs-sm);
  font-weight: var(--fw-code);
  line-height: 1;
}

/* 3D 보기의 이상 표시: 흰 알약 + 상태 테두리 + 상태 글자 칸 + 명칭 */
.stage :deep(.f3d-bang) {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 2px var(--sp-2) 2px 3px;
  border: var(--indicator-w) solid var(--st);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-weight: var(--fw-strong);
  pointer-events: auto;
  cursor: pointer;
}

.stage :deep(.f3d-bang:hover) { background: var(--c-surface-sunk); }

/* 탑뷰 설비 칩: 상태 색 면(.st-*) + 설비 번호, 이상 상태는 상태 글자를 붙인다 (11/20 사용자: 예전 탑뷰 모양으로) */
.stage :deep(.f3d-chip) {
  display: inline-block;
  padding: 1px var(--sp-1);
  border: 0;
  border-radius: var(--r-1);
  font: inherit;
  font-size: var(--fs-3d-dense);
  font-weight: var(--fw-strong);
  pointer-events: auto;
  cursor: pointer;
}

/* 화면 밖 고장 단추 */
.stage :deep(.f3d-edge) {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2);
  border: 0;
  border-radius: var(--r-2);
  background: var(--c-down);
  color: var(--c-down-ink);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
  pointer-events: auto;
  cursor: pointer;
}

.f3d :deep([data-state="R"]) { --st: var(--c-run); }
.f3d :deep([data-state="S"]) { --st: var(--c-line-ink); }
.f3d :deep([data-state="I"]) { --st: var(--c-idle-edge); }
.f3d :deep([data-state="D"]) { --st: var(--c-down); }
.f3d :deep([data-state="DC"]) { --st: var(--c-dc); }
</style>
