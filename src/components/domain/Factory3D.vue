<!-- SCR-005 3D 공장 (대시보드 배치도의 3D 보기). 설비 상태 색 · 이상 "!" · 도장 경로 · 제품 물류(데모)
     3D / 탑뷰 전환, 라인을 고르면 그 라인 흐름만 밝히고 오른쪽에 라인 카드. 설비를 누르면 팝업
     값은 props로 받고, 이동은 emit으로 페이지에 맡긴다 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createFactoryScene, type FactoryScene, type SceneColors, type ViewMode } from '@/components/domain/factory3d/scene'
import { STATE_NAME, PROCESS_NAME, DOWNTIME_NAME } from '@/lib/status'
import { formatDuration, formatNumber, formatTime } from '@/lib/format'
import type { Equipment, Line, LineId, ProductionLineId } from '@/types/plant'
import type { EquipmentLive, FlowPositions, LineSummary } from '@/types/live'
import type { StateCode } from '@/types/state'

const props = defineProps<{
  equipment: Equipment[]
  live: EquipmentLive[]
  lines: Line[]
  lineSummaries: LineSummary[]
  flow: FlowPositions | null
  /** 지금 시각 (ms). 지연 시간 계산용 */
  now: number
}>()
const emit = defineEmits<{
  'open-line': [id: LineId]
  'open-outbound': []
  'open-inbound': []
  'open-action': [equipmentId: string]
}>()

const host = ref<HTMLDivElement | null>(null)
const scene = shallowRef<FactoryScene | null>(null)
const view = ref<ViewMode>('3d')
const selLine = ref<ProductionLineId | null>(null)
const popId = ref<string | null>(null)
const popAt = ref({ x: 0, y: 0 })
/** 확인한 이상: 설비 ID@시작 시각. 같은 상태가 이어지는 동안 "!"를 숨긴다 */
const acked = ref(new Set<string>())

const liveById = computed(() => new Map(props.live.map((e) => [e.id, e])))
const eqById = computed(() => new Map(props.equipment.map((e) => [e.id, e])))
const ackKey = (e: EquipmentLive) => `${e.id}@${e.since}`
/** "!" 대상: 고장 · 통신 끊김 · 원인 코드가 있는 대기 */
const isIssue = (e: EquipmentLive) => e.state === 'D' || e.state === 'DC' || (e.state === 'I' && e.code != null)
const issues = computed(() => props.live.filter((e) => isIssue(e) && !acked.value.has(ackKey(e))))

function colors(): SceneColors {
  const css = getComputedStyle(host.value!)
  const v = (n: string) => css.getPropertyValue(n).trim()
  const state: Record<StateCode, string> = { R: v('--c-run'), S: v('--c-stop-solid'), I: v('--c-idle'), D: v('--c-down'), DC: v('--c-dc') }
  return {
    state, bg: v('--c-3d-bg'), floor: v('--c-3d-floor'), grid: v('--c-3d-grid'), yard: v('--c-3d-yard'), body: v('--c-3d-body'),
    frame: v('--c-3d-frame'), metal: v('--c-3d-metal'), dark: v('--c-3d-dark'), chrome: v('--c-3d-chrome'), glass: v('--c-3d-glass'), belt: v('--c-3d-belt'), route: v('--c-3d-route'), route2: v('--c-3d-route-2'),
    routeAlt: v('--c-3d-route-alt'), product: v('--c-3d-product'), cap: v('--c-3d-frame'),
  }
}

function pick(id: string) {
  popId.value = id
  const at = scene.value?.screenOf(id)
  const w = host.value?.clientWidth ?? 0
  const h = host.value?.clientHeight ?? 0
  if (at) popAt.value = { x: Math.min(Math.max(8, at.x + 18), w - 280), y: Math.min(Math.max(8, at.y - 40), h - 300) }
  const line = eqById.value.get(id)?.area
  if (line && line !== 'PT' && line !== 'VI') selectLine(line)
}
function selectLine(L: ProductionLineId | null) {
  selLine.value = L
  scene.value?.select(L)
}

onMounted(() => {
  const s = createFactoryScene(host.value!, colors(), {
    onPick: pick,
    onLine: (L) => selectLine(L),
    onZone: (z) => (z === 'inbound' ? emit('open-inbound') : z === 'paint' ? emit('open-line', 'PT') : emit('open-outbound')),
  })
  s.onModeChange((m) => { view.value = m })
  scene.value = s
  push()
})
onBeforeUnmount(() => scene.value?.dispose())

function push() {
  const s = scene.value
  if (!s) return
  s.setStates(props.live)
  s.setIssues(issues.value.map((e) => ({ equipmentId: e.id, state: e.state })))
  s.setRoutes(Object.fromEntries(props.lines.filter((l) => l.kind === 'production').map((l) => [l.id, l.currentPaintId])))
  s.setFlow(props.flow)
}
watch(() => [props.live, props.lines, props.flow, issues.value], push)

// ── 팝업 ──
const pop = computed(() => {
  const id = popId.value
  if (!id) return null
  const e = eqById.value.get(id)
  const l = liveById.value.get(id)
  if (!e || !l) return null
  const sec = Math.max(0, Math.floor((props.now - Date.parse(l.since)) / 1000))
  const line = e.area === 'PT' ? '도장 (공용)' : e.area === 'VI' ? '출고 (공용)' : `${e.area}라인`
  return { e, l, line, sec, issue: isIssue(l) && !acked.value.has(ackKey(l)) }
})
function ack() {
  const l = pop.value?.l
  if (l) acked.value = new Set(acked.value).add(ackKey(l))
  popId.value = null
}
function goLine() {
  const a = pop.value?.e.area
  if (a === 'VI') emit('open-outbound')
  else if (a) emit('open-line', a)
}

// ── 라인 카드 ──
const card = computed(() => {
  const L = selLine.value
  if (!L) return null
  const sum = props.lineSummaries.find((x) => x.lineId === L) ?? null
  const ids = props.equipment.filter((e) => e.area === L).map((e) => e.id)
  const cnt: Record<StateCode, number> = { R: 0, I: 0, S: 0, D: 0, DC: 0 }
  for (const id of ids) { const s = liveById.value.get(id)?.state; if (s) cnt[s] += 1 }
  const piles = (k: string) => props.flow?.products.filter((p) => 'pile' in p.location && p.location.pile === `${L}:${k}`).length ?? null
  const paint = props.lines.find((l) => l.id === L)
  return {
    L, sum, cnt,
    route: paint?.currentPaintId ?? null,
    switched: !!paint && paint.currentPaintId !== paint.defaultPaintId,
    wip: [['슬리팅→프레스', piles('SL-PR')], ['프레스→용접', piles('PR-WD')], ['용접→도장', piles('WD-PT')]] as const,
  }
})
const STATES: StateCode[] = ['R', 'I', 'S', 'D', 'DC']
const paintName = (id: string | null) => (id ? `도장 ${id.slice(2)}` : '-')
</script>

<template>
  <div class="f3d">
    <div ref="host" class="stage" />

    <div class="views" role="group" aria-label="3D 보기">
      <button type="button" :aria-pressed="view === '3d'" @click="scene?.setView('3d')">3D</button>
      <button type="button" :aria-pressed="view === 'top'" @click="scene?.setView('top')">탑뷰</button>
    </div>
    <p class="hint">왼쪽 끌기 이동 · 휠 확대 · 오른쪽 끌기 회전 · 제품 점은 데모 값</p>

    <section v-if="pop" class="pop" :data-state="pop.l.state" :style="{ left: `${popAt.x}px`, top: `${popAt.y}px` }" aria-label="설비 상태">
      <header>
        <span>{{ pop.l.state }} · {{ STATE_NAME[pop.l.state] }}</span>
        <button type="button" class="x" aria-label="닫기" @click="popId = null">×</button>
      </header>
      <dl>
        <dt>라인</dt><dd>{{ pop.line }}</dd>
        <dt>공정</dt><dd>{{ PROCESS_NAME[pop.e.process] }}</dd>
        <dt>설비 ID</dt><dd>{{ pop.e.id }}</dd>
        <dt>발생 시점</dt><dd>{{ formatTime(pop.l.since) }}</dd>
        <dt>지연 시간</dt><dd class="num">{{ formatDuration(pop.sec) }}</dd>
        <dt>원인 코드</dt><dd>{{ pop.l.code ? `${pop.l.code} · ${DOWNTIME_NAME[pop.l.code]}` : '-' }}</dd>
        <dt>내용</dt><dd>{{ pop.l.detail ?? '-' }}</dd>
      </dl>
      <footer>
        <button v-if="pop.issue" type="button" @click="ack">확인</button>
        <button type="button" @click="goLine">라인 가기</button>
        <button type="button" @click="emit('open-action', pop.e.id)">조치 가기</button>
      </footer>
    </section>

    <aside v-if="card" class="card" aria-label="라인 카드">
      <h3>
        <span>{{ card.L }}라인</span>
        <button type="button" class="x" aria-label="닫기" @click="selectLine(null)">×</button>
      </h3>
      <p class="mini">슬리팅 1 · 프레스 4 · 용접 1 → {{ paintName(card.route) }}<template v-if="card.switched"> (경로 전환)</template></p>
      <div class="kp">
        <div><small>생산</small><b class="num">{{ formatNumber(card.sum?.done) }}</b></div>
        <div><small>달성률</small><b class="num">{{ formatNumber(card.sum?.rate, 1) }}<template v-if="card.sum?.rate != null">%</template></b></div>
        <div><small>OEE</small><b class="num">{{ formatNumber(card.sum?.oee, 1) }}<template v-if="card.sum?.oee != null">%</template></b></div>
      </div>
      <div class="rs">
        <span v-for="k in STATES" :key="k" :data-state="k" :class="{ zero: !card.cnt[k] }">{{ k }} {{ card.cnt[k] }}</span>
      </div>
      <button type="button" class="go-line" @click="emit('open-line', card.L)">라인 상세 보기</button>
      <p class="mini">재공 (데모) · <template v-for="([n, q], i) in card.wip" :key="n">{{ i ? ' · ' : '' }}{{ n }} {{ formatNumber(q) }}</template></p>
    </aside>
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
  top: var(--sp-3);
  left: var(--sp-3);
  display: flex;
  overflow: hidden;
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.views button {
  padding: var(--sp-1) var(--sp-3);
  border: 0;
  background: none;
  color: var(--c-ink-2);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.views button[aria-pressed="true"] {
  background: var(--c-ink);
  color: var(--c-inverse-ink);
}

.hint {
  position: absolute;
  bottom: var(--sp-2);
  left: var(--sp-3);
  margin: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  pointer-events: none;
}

.x {
  border: 0;
  background: none;
  color: inherit;
  font-size: var(--fs-lg);
  line-height: 1;
  cursor: pointer;
}

/* 팝업: 머리 색 = 상태 색 */
.pop {
  position: absolute;
  z-index: 3;
  width: 268px;
  overflow: hidden;
  border: 2px solid var(--st);
  border-radius: var(--r-3);
  background: var(--c-surface);
  font-size: var(--fs-sm);
}

.pop header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--sp-1) var(--sp-3);
  background: var(--st);
  color: var(--st-ink);
  font-weight: 600;
}

.pop dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
  padding: var(--sp-3);
}

.pop dt { color: var(--c-ink-3); }
.pop dd { margin: 0; color: var(--c-ink); }

.pop footer {
  display: flex;
  gap: var(--sp-2);
  padding: 0 var(--sp-3) var(--sp-3);
}

.pop footer button,
.card .x {
  flex: 1;
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  cursor: pointer;
}

.card .x { flex: 0; border: 0; }

.f3d :deep([data-state="R"]) { --st: var(--c-run); --st-ink: var(--c-run-ink); }
.f3d :deep([data-state="S"]) { --st: var(--c-stop-solid); --st-ink: var(--c-inverse-ink); }
.f3d :deep([data-state="I"]) { --st: var(--c-idle); --st-ink: var(--c-idle-ink); }
.f3d :deep([data-state="D"]) { --st: var(--c-down); --st-ink: var(--c-down-ink); }
.f3d :deep([data-state="DC"]) { --st: var(--c-dc); --st-ink: var(--c-dc-ink); }

/* 라인 카드: 오른쪽 위 */
.card {
  position: absolute;
  z-index: 2;
  top: var(--sp-3);
  right: var(--sp-3);
  width: 260px;
  padding: var(--sp-3);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-3);
  background: var(--c-surface);
  font-size: var(--fs-sm);
}

.card h3 {
  display: flex;
  justify-content: space-between;
  margin: 0;
  font-size: var(--fs-lg);
}

.mini { margin: var(--sp-1) 0 0; color: var(--c-ink-2); }

.kp {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}

.kp small { display: block; color: var(--c-ink-3); }
.kp b { font-size: var(--fs-lg); }

.rs {
  display: flex;
  gap: var(--sp-1);
  margin-top: var(--sp-3);
}

.rs span {
  flex: 1;
  padding: 2px 0;
  border-radius: var(--r-1);
  background: var(--st);
  color: var(--st-ink);
  font-weight: 600;
  text-align: center;
}

.rs span.zero { opacity: 0.35; }

.go-line {
  width: 100%;
  margin-top: var(--sp-3);
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-accent);
  font: inherit;
  cursor: pointer;
}

/* 장면 위 이름표 (scene.ts가 만든 DOM이라 :deep) */
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
}

.stage :deep(.f3d-zone) { color: var(--c-ink-3); }

.stage :deep(.f3d-go) {
  color: var(--c-accent);
  text-decoration: underline;
  pointer-events: auto;
  cursor: pointer;
}

.stage :deep(.f3d-line) {
  padding: 2px var(--sp-2);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font-weight: 600;
  pointer-events: auto;
  cursor: pointer;
}

.stage :deep(.f3d-line.on) {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.stage :deep(.f3d-cnt) {
  padding: 0 var(--sp-1);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
}

.stage :deep(.f3d-pid) {
  color: var(--c-ink-2);
  font-size: 11px;
}

.stage :deep(.f3d-chip) {
  display: inline-block;
  padding: 0 var(--sp-1);
  border-radius: var(--r-1);
  background: var(--st);
  color: var(--st-ink);
  font-size: 11px;
  font-weight: 600;
}

.stage :deep(.f3d-bang) {
  width: 22px;
  height: 22px;
  border: 2px solid var(--c-surface);
  border-radius: 50%;
  background: var(--st);
  color: var(--st-ink);
  font-weight: 700;
  pointer-events: auto;
  cursor: pointer;
}

.stage :deep(.f3d-edge) {
  position: absolute;
  padding: var(--sp-1) var(--sp-2);
  border: 0;
  border-radius: var(--r-2);
  background: var(--c-down);
  color: var(--c-down-ink);
  font: inherit;
  font-size: var(--fs-sm);
  pointer-events: auto;
  cursor: pointer;
}
</style>
