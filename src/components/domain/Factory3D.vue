<!-- SCR-005 3D 공장 (대시보드 배치도의 3D 보기, D-118). 설비 상태 색 · 이상 표시 · 도장 경로 · 제품 상자(데모)
     3D ↔ 탑뷰: 같은 원근 카메라가 부드럽게 날아간다. 탑뷰에 도착하면 바닥 상태 칸 + 설비 상태 칩 (예전 탑뷰 모양)
     설비를 누르면 왼쪽에 설비 팝업 (카메라는 그대로, 11/22 줌인 뺌). 닫기: × · Esc · 팝업 밖
     라인 바닥에 마우스를 올리면 외곽선, 누르면 오른쪽 위에 간단한 라인 카드. 값은 props로 받고, 이동은 emit으로 페이지에 맡긴다 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createFactoryScene, type FactoryScene, type SceneColors, type ViewMode } from '@/components/domain/factory3d/scene'
import BaseIcon from '@/components/base/BaseIcon.vue'
import EquipPanel from '@/components/domain/factory3d/EquipPanel.vue'
import LinePanel from '@/components/domain/factory3d/LinePanel.vue'
import { formatDuration } from '@/lib/format'
import { showsSince } from '@/lib/status'
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
  /** 오늘 비전 검사 양품·불량 (비전 창 · 적재 상자, 11/21) */
  vision?: { ok: number; ng: number } | null
}>()
const emit = defineEmits<{
  'open-line': [id: LineId]
  'open-vision': []
  'open-loading': []
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
/** 조작 방법 펼침 (왼쪽 아래, 처음엔 접힘) */
const helpOpen = ref(false)

const liveById = computed(() => new Map(props.live.map((e) => [e.id, e])))
const eqById = computed(() => new Map(props.equipment.map((e) => [e.id, e])))
const ackKey = (e: EquipmentLive) => `${e.id}@${e.since}`
/** 이상 표시 대상: 고장 · 통신 끊김 · 원인 코드가 있는 대기 */
const isIssue = (e: EquipmentLive) => e.state === 'D' || e.state === 'DC' || (e.state === 'I' && e.code != null)
const issues = computed(() => props.live.filter((e) => isIssue(e) && !acked.value.has(ackKey(e))))
const secOf = (l: EquipmentLive) => Math.max(0, Math.floor((props.now - Date.parse(l.since)) / 1000))

// ── 왼쪽 패널 (11/21): 라인별 생산 / 배정. 3D·탑뷰 모두 같은 자리 ──
/** 라인 상태: 설비 하나라도 고장이면 down(깜빡임), 설비가 모두 정지(S)면 stop(회색) */
function lineState(L: string): 'down' | 'stop' | null {
  const ls = props.equipment.filter((e) => e.area === L).map((e) => liveById.value.get(e.id)?.state)
  if (ls.some((x) => x === 'D')) return 'down'
  if (ls.length && ls.every((x) => x === 'S')) return 'stop'
  return null
}
const allocRows = computed(() => props.lineSummaries.filter((x) => x.lineId !== 'PT').map((x) => ({
  id: x.lineId,
  done: x.done,
  plan: x.plan,
  added: props.additions?.[x.lineId] ?? 0,
  pct: x.done != null && x.plan ? Math.min(100, Math.round((x.done / x.plan) * 100)) : 0,
  st: lineState(x.lineId),
})))
const num = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('ko-KR'))

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
/** 11/21 이상 설비(고장 · 통신 끊김 · 원인 있는 대기)만 창을 열어요. 정상 설비는 눌러도 그대로 (볼 게 상태 색뿐이라)
 *  force = 비전 검사 칸처럼 구역 단추로 부를 때는 상태와 상관없이 열어요 */
function pick(id: string, force = false) {
  if (!eqById.value.has(id)) return
  const l = liveById.value.get(id)
  if (!force && !(l && isIssue(l))) return
  popId.value = id
  scene.value?.mark(id)
  // 라인 상세가 열려 있으면 그 설비의 라인으로 따라간다
  const a = eqById.value.get(id)!.area
  if (selLine.value && a !== 'PT' && a !== 'VI' && a !== selLine.value) selectLine(a as ProductionLineId)
}
function closePop() {
  if (!popId.value) return
  popId.value = null
  scene.value?.mark(null)
}
function selectLine(L: ProductionLineId | null) {
  selLine.value = L
  scene.value?.select(L)
}
function setView(m: ViewMode) {
  closePop()
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
    // 11/21 비전 검사는 비전 설비 창 (합격·불량 + 상세 보기), 적재는 적재 화면
    onZone: (z) => (z === 'inbound' ? emit('open-inbound') : z === 'paint' ? emit('open-line', 'PT') : z === 'vision' ? pick('VI', true) : emit('open-loading')),
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

/** 탑뷰 설비 카드 둘째 줄: 고장(D)·통신 끊김(DC)만 지속 시간 (11/22) */
function push() {
  const s = scene.value
  if (!s) return
  s.setStates(props.live.map((l) => ({ id: l.id, state: l.state, note: showsSince(l.state) ? formatDuration(secOf(l)) : null })))
  s.setIssues(issues.value.map((e) => ({ equipmentId: e.id, state: e.state })))
  s.setRoutes(Object.fromEntries(props.lines.filter((l) => l.kind === 'production').map((l) => [l.id, l.currentPaintId])))
  s.setFlow(props.flow)
  // 적재: 오늘 비전 검사 합격 수 (합격 = 적재). 없으면 라인별 실적 합
  s.setShipped(props.vision?.ok ?? props.lineSummaries.filter((x) => x.lineId !== 'PT').reduce((a, x) => a + (x.done ?? 0), 0))
}
watch(() => [props.live, props.lines, props.flow, issues.value, props.now, props.lineSummaries, props.additions, props.vision], push)

const pop = computed(() => {
  const id = popId.value
  if (!id) return null
  const e = eqById.value.get(id)
  const l = liveById.value.get(id)
  if (!e || !l) return null
  const line = e.area === 'PT' ? '도장 (공용)' : e.area === 'VI' ? '공용' : `${e.area}라인`
  return { e, l, line, sec: secOf(l), abnormal: isIssue(l), issue: isIssue(l) && !acked.value.has(ackKey(l)) }
})
function ack() {
  const l = pop.value?.l
  if (l) acked.value = new Set(acked.value).add(ackKey(l))
  closePop()
}
/** 생산 라인은 3D에서 그 라인으로 다가간 뒤 라인 상세로 (D-119). 도장·비전 검사는 바로 */
function openLine(id: LineId) {
  const s = scene.value
  if (!s || id === 'PT' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { emit('open-line', id); return }
  closePop()
  s.dive(id as ProductionLineId, () => emit('open-line', id))
}
function goLine() {
  const a = pop.value?.e.area
  if (a === 'VI') emit('open-vision')
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
    <!-- 11/22 조작 방법: 접혀 있다가 누르면 오른쪽으로 펼쳐진다 -->
    <div class="help" :class="{ open: helpOpen }" data-keep-pop>
      <button type="button" class="help-btn" :aria-expanded="helpOpen" aria-controls="f3d-help" @click="helpOpen = !helpOpen">
        조작 방법<BaseIcon :name="helpOpen ? 'chevron-left' : 'chevron-right'" :size="16" />
      </button>
      <div id="f3d-help" class="help-body" :aria-hidden="!helpOpen">
        <p>라인 바닥을 누르면 라인 상세 · 고장·대기 설비를 누르면 상태 창 · 왼쪽 끌기 이동 · 휠 확대 · 오른쪽 끌기 회전</p>
      </div>
    </div>

    <aside v-if="!pop" class="side" aria-label="라인별 생산 / 배정" data-keep-pop>
      <section>
        <h3>배정 <small>생산 / 배정</small></h3>
        <ul class="alloc">
          <li v-for="r in allocRows" :key="r.id" :class="[{ more: r.added > 0 }, r.st]" :title="r.st === 'down' ? '고장 설비 있음' : r.st === 'stop' ? '라인 정지' : undefined">
            <!-- 11/21 두 줄 정돈: 윗줄 = 라인 · 생산 / 배정 (+추가) · 달성률, 아랫줄 = 막대 (모든 줄이 같은 자리·같은 길이) -->
            <b class="id">{{ r.id }}</b>
            <span class="n"><b>{{ num(r.done) }}</b> / {{ num(r.plan) }}<span v-if="r.added" class="add">+{{ num(r.added) }}</span></span>
            <span class="pct">{{ r.plan ? `${r.pct}%` : '-' }}</span>
            <span class="bar"><i :style="{ width: `${r.pct}%` }" /></span>
          </li>
        </ul>
      </section>
    </aside>

    <div v-if="pop" ref="popEl" class="dock left">
      <EquipPanel
        :e="pop.e"
        :l="pop.l"
        :sec="pop.sec"
        :line-name="pop.line"
        :abnormal="pop.abnormal"
        :issue="pop.issue"
        :vision="pop.e.area === 'VI' ? vision : null"
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

/* 조작 방법 (11/22): 단추만 보이다가 누르면 옆으로 펼쳐짐 */
.help {
  position: absolute;
  z-index: 4;
  bottom: var(--sp-3);
  left: var(--sp-3);
  display: grid;
  grid-template-columns: auto 0fr;
  max-width: calc(100% - var(--sp-6));
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  font-size: var(--fs-sm);
  transition: grid-template-columns var(--dur-enter) var(--ease-out);
}

.help.open { grid-template-columns: auto 1fr; }

.help-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--control-h-sm);
  padding: 0 var(--sp-1) 0 var(--sp-3);
  border: 0;
  background: none;
  color: var(--c-ink-2);
  font: inherit;
  font-weight: var(--fw-strong);
  white-space: nowrap;
  cursor: pointer;
}

.help-btn:hover { background: var(--c-surface-sunk); }

.help-body {
  min-width: 0;
  overflow: hidden;
  color: var(--c-ink-2);
  line-height: var(--control-h-sm);
}

.help-body p {
  margin: 0;
  padding: 0 var(--sp-3) 0 var(--sp-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 접혀 있을 때는 글이 읽히지 않게 (화면 낭독기·선택) */
.help:not(.open) .help-body { visibility: hidden; }

/* 왼쪽 패널 (11/21): 보기 버튼 아래. 설비 팝업이 열리면 그 자리를 팝업이 씀 */
.side {
  position: absolute;
  z-index: 3;
  top: calc(var(--sp-3) + var(--control-h-sm) + var(--sp-2));
  left: var(--sp-3);
  display: grid;
  gap: var(--sp-2);
  width: 216px;
  max-height: calc(100% - var(--control-h-sm) * 2 - var(--sp-3) * 4);
  overflow-y: auto;
}

.side section {
  padding: var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.side h3 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.side h3 small {
  margin-left: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.side ul {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.alloc li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 3.2em;
  grid-template-rows: auto auto;
  gap: 3px var(--sp-2);
  align-items: baseline;
  margin: 0 calc(var(--sp-1) * -1);
  padding: 2px var(--sp-1) 4px;
  border-radius: var(--r-1);
  font-size: var(--fs-md);
  font-variant-numeric: tabular-nums;
  line-height: var(--lh-tight);
}

.alloc .id {
  grid-row: 1 / 3;
  align-self: center;
  font-weight: var(--fw-strong);
}

.alloc .n b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.alloc .n {
  overflow: hidden;
  color: var(--c-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alloc .pct {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  text-align: right;
}

.alloc .bar {
  grid-column: 2 / 4;
  height: 6px;
  border-radius: 2px;
  background: var(--c-track);
}

.alloc .bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--c-ink-2);
}

.alloc .add {
  margin-left: var(--sp-1);
  color: var(--c-accent);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.alloc li.more .bar i {
  background: var(--c-accent);
}

/* 고장 설비가 있는 라인: 빨간 바탕이 깜빡임 (11/21) */
.alloc li.down {
  animation: line-down 1.1s ease-in-out infinite;
}

.alloc li.down .id {
  color: var(--c-down);
}

@keyframes line-down {
  0%, 100% { background: transparent; }
  50% { background: color-mix(in srgb, var(--c-down) 22%, transparent); }
}

@media (prefers-reduced-motion: reduce) {
  .alloc li.down {
    animation: none;
    background: color-mix(in srgb, var(--c-down) 16%, transparent);
  }
}

/* 정지한 라인: 회색 */
.alloc li.stop,
.alloc li.stop .n,
.alloc li.stop .n b,
.alloc li.stop .pct {
  color: var(--c-ink-3);
}

.alloc li.stop .bar i {
  background: var(--c-ink-3);
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
  transition: opacity 0.25s ease, visibility 0s;
  font-size: var(--fs-sm);
  line-height: var(--lh-tight);
}

/* 지금 보기(3D·탑뷰)에 안 쓰는 이름표: 서서히 사라진 뒤 숨김 (눌리지도 않음, 11/21) */
.stage :deep(.f3d-tag.f3d-off) {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.25s ease, visibility 0s linear 0.25s;
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

/* 비전 검사: 누를 수 있지만 모양은 설비 이름표와 같은 까만 칸 (11/21) */
.stage :deep(.f3d-zone.go.dark) {
  box-shadow: none;
  background: var(--c-ink);
  color: var(--c-inverse-ink);
}

.stage :deep(.f3d-zone.go.dark:hover) { background: var(--c-ink-2); }

/* 적재 단추 안 적재 수 (11/21) */
.stage :deep(.f3d-zone.go small) {
  margin-left: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  font-variant-numeric: tabular-nums;
}

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
  padding: 2px;
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
