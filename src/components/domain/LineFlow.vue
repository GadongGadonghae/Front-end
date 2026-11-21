<!-- 라인 흐름 (SCR-010 3번): 입고에서 → 슬리팅 → 프레스 1~4단 → 용접 → 도장으로. 도장 라인은 도장 #1 · #2
     공정 묶음 위에 공정 이름(누르면 공정 상세), 공정 사이에 재공, 묶음 아래에 오늘 생산·불량. 모눈 바탕은 배치도와 같다 -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import EquipCell from '@/components/domain/EquipCell.vue'
import { formatNumber } from '@/lib/format'
import { STATE_NAME } from '@/lib/status'
import type { ProcessId } from '@/types/plant'
import type { FlowCellView, LineFlowView } from '@/types/view'

const props = defineProps<{ view: LineFlowView; lineName: string }>()
const emit = defineEmits<{ openCell: [id: string]; openGroup: [process: ProcessId] }>()

/** 끝 | 묶음 | 재공 | 묶음 | … | 끝. 묶음 폭 = 설비 수 비율 */
const columns = computed(() => {
  const parts = [props.view.feeds ? 'calc(var(--flow-end-w) * 2)' : 'var(--flow-end-w)']
  props.view.groups.forEach((g, i) => {
    if (i) parts.push('var(--flow-link-w)')
    parts.push(`minmax(0, ${g.stack ? 1 : g.cells.length}fr)`)
  })
  parts.push('var(--flow-end-w)')
  return parts.join(' ')
})
/** 도장 경로 선: 라인 i(왼쪽, 세로 위치) → 지금 붙은 도장 칸의 세로 위치 (%, 0~100). 붙은 곳이 없으면 null */
const feedLines = computed(() => {
  const feeds = props.view.feeds ?? []
  const cells = props.view.groups[0]?.cells ?? []
  return feeds.map((f, i) => {
    const k = cells.findIndex((c) => c.id === f.to)
    return { label: f.label, from: ((i + 0.5) / feeds.length) * 100, to: k < 0 ? null : ((k + 0.5) / cells.length) * 100, name: cells[k]?.name ?? '연결 없음' }
  })
})
/** 묶음 i가 놓이는 격자 열 (1부터) */
const col = (i: number) => 2 + i * 2
/** 병목 의심: 재공이 쌓이는데 바로 뒤 공정에 고장·대기 설비가 있을 때 */
const bottleneck = (i: number) => (props.view.wip[i] ?? 0) > 0 && props.view.groups[i + 1]?.cells.some((c) => c.state === 'D' || c.state === 'I')

function cellLabel(c: FlowCellView, group: string) {
  const why = c.reason ? `, ${c.reason.code}${c.reason.detail ? ` ${c.reason.detail}` : ''}` : ''
  const pdm = c.pdm ? `, 예지보전 ${c.pdm.text}` : ''
  return `${props.lineName} ${group} ${c.name}, ${STATE_NAME[c.state]} ${c.duration}${why}${pdm}. 공정 상세로`
}
function onKey(e: KeyboardEvent, go: () => void) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() }
}
</script>

<template>
  <div class="wrap">
    <div class="flow" :style="{ gridTemplateColumns: columns }">
      <template v-for="(g, i) in view.groups" :key="g.process">
        <button class="head" type="button" :style="{ gridColumn: col(i) }" @click="emit('openGroup', g.process)">
          {{ g.name }}<BaseIcon name="chevron-right" :size="16" />
        </button>
        <div class="grp" :class="{ stack: g.stack }" :style="{ gridColumn: col(i) }">
          <!-- 대각선 배치에서 둘째 칸부터: 라인에서 오는 선을 빈 왼쪽 칸을 가로질러 칸 왼쪽 끝까지 잇는다 -->
          <template v-if="g.stack"><i v-for="k in g.cells.length - 1" :key="k" class="hop" :style="{ gridRow: k + 1, gridColumn: `1 / ${k + 1}` }" /></template>
          <div
            v-for="(c, k) in g.cells"
            :key="c.id"
            class="hit"
            :style="g.stack ? { gridRow: k + 1, gridColumn: k + 1 } : undefined"
            role="button"
            tabindex="0"
            :aria-label="cellLabel(c, g.name)"
            @click="emit('openCell', c.id)"
            @keydown="onKey($event, () => emit('openCell', c.id))"
          ><EquipCell :cell="c" /></div>
        </div>
        <p class="foot" :style="{ gridColumn: col(i) }">
          생산 <b>{{ formatNumber(g.output) }}</b> · 불량 {{ formatNumber(g.ng) }}<span v-if="g.note" class="note"> ({{ g.note }})</span>
        </p>
        <div v-if="i < view.groups.length - 1" class="link" :style="{ gridColumn: col(i) + 1 }">
          <span :class="{ warn: bottleneck(i) }">재공 <b>{{ formatNumber(view.wip[i]) }}</b><em v-if="bottleneck(i)">⚠ 병목 의심</em></span>
        </div>
      </template>
      <div v-if="view.feeds" class="feeds" role="list" aria-label="라인별 도장 경로">
        <svg class="route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <template v-for="l in feedLines" :key="l.label"><path v-if="l.to != null" :d="`M45 ${l.from} L100 ${l.to}`" /></template>
        </svg>
        <span v-for="l in feedLines" :key="l.label" class="feed" role="listitem" :aria-label="`${l.label} → ${l.name}`">{{ l.label }}</span>
      </div>
      <div v-else class="end start"><span>{{ view.from }}<template v-if="view.endWip"><br>재공 <b>{{ formatNumber(view.endWip[0]) }}</b></template></span></div>
      <div class="end finish" :style="{ gridColumn: col(view.groups.length - 1) + 1 }"><span>{{ view.to }}<template v-if="view.endWip"><br>재공 <b>{{ formatNumber(view.endWip[1]) }}</b></template></span></div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: var(--sp-4) var(--sp-5);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background-color: var(--c-surface);
  background-image:
    linear-gradient(var(--c-line) var(--line-w), transparent var(--line-w)),
    linear-gradient(90deg, var(--c-line) var(--line-w), transparent var(--line-w));
  background-position: calc(var(--line-w) * -1) calc(var(--line-w) * -1);
  background-size: var(--map-grid) var(--map-grid);
}

/* 공정 이름 줄 | 설비 칸 줄 | 생산·불량 줄 */
.flow {
  display: grid;
  flex: 1;
  grid-template-rows: auto minmax(var(--flow-cell-min), var(--flow-cell-max)) auto;
  align-content: center;
  row-gap: var(--sp-2);
  min-height: 0;
}

.head {
  display: inline-flex;
  grid-row: 1;
  align-items: center;
  justify-self: start;
  gap: var(--sp-1);
  min-height: var(--sp-6);
  padding: 0 var(--sp-1);
  border: 0;
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
  cursor: pointer;
}

.head:hover {
  text-decoration: underline;
}

.grp {
  position: relative;
  display: grid;
  grid-row: 2;
  grid-auto-columns: minmax(0, var(--flow-cell-max-w));
  grid-auto-flow: column;
  justify-content: center;
  gap: var(--sp-3);
}

/* 같은 공정 안 설비 사이를 지나는 물류 선 */
.grp::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  border-top: var(--line-w-strong) solid var(--c-line-ink);
}

/* 도장 #1·#2 병렬: 대각선 (#1 왼쪽 위, #2 오른쪽 아래). 왼쪽에 붙여 라인에서 오는 선이 칸 왼쪽 끝에 닿게 */
.grp.stack {
  grid-auto-rows: minmax(0, 1fr);
  justify-content: start;
}

.hop {
  position: relative;
}

.hop::before {
  content: '';
  position: absolute;
  top: 50%;
  right: calc(var(--sp-3) * -1);
  left: 0;
  border-top: var(--line-w-strong) dashed var(--c-line-ink);
}

.grp.stack::before {
  display: none;
}

/* 쌓으면 칸이 낮아 맨 아래 상태 줄(R/S/I/D·지속시간)이 잘린다: 설비번호(도장 #1 = PT1)는 빼고 상태 줄을 칸 아래에 붙인다 */
.grp.stack :deep(.eid) {
  display: none;
}

.grp.stack :deep(.lg) {
  justify-content: space-between;
  gap: var(--sp-1);
}

/* 11/21 쌓은 칸(도장)은 높이가 절반: 숫자(사이클·불량·평균 CT)는 다른 칸과 같은 자리에 한 줄로,
   사유는 아래쪽에 한 줄(코드 + 내용, 넘치면 …). 그래도 넘치면 칸 안에서 자름 */
.grp.stack :deep(.cell) {
  overflow: hidden;
}

.grp.stack :deep(.why) {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  min-width: 0;
  white-space: nowrap;
}

.grp.stack :deep(.why b) {
  display: inline;
  flex: none;
}

.grp.stack :deep(.why span) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.grp.stack :deep(.info) {
  grid-template-columns: repeat(3, auto auto);
  justify-content: start;
}

.grp.stack :deep(.note) {
  display: none;
}

/* 도장 라인 앞 끝: A~F 라인 이름 (세로로 고르게) + 지금 보내는 도장으로 가는 흐린 선 */
.feeds {
  position: relative;
  display: grid;
  grid-row: 2;
  grid-column: 1;
  grid-auto-rows: minmax(0, 1fr);
}

.feed {
  position: relative;
  place-self: center start;
  padding: 0 var(--sp-1);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.route {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.route path {
  fill: none;
  stroke: var(--c-line-ink);
  stroke-dasharray: 4 3;
  stroke-width: var(--line-w-strong);
  vector-effect: non-scaling-stroke;
}

.hit {
  position: relative;
  min-width: 0;

  /* 칸이 내용 때문에 줄보다 길어져 아래 '생산 · 불량' 글자를 덮지 않게: 줄 높이에 맞추고 넘치면 칸 안에서 자른다 */
  min-height: 0;
  overflow: hidden;
  border-radius: var(--r-2);
  cursor: pointer;
}

.foot {
  grid-row: 3;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.foot b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

/* 공정 사이·양 끝: 가운데 물류 선 + 글자 */
.link,
.end {
  position: relative;
  display: grid;
  grid-row: 2;
  place-items: center;
}

.link::before,
.end::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  border-top: var(--line-w-strong) solid var(--c-line-ink);
}

.start {
  grid-column: 1;
}

.start::before {
  left: 50%;
}

.finish::before {
  right: 50%;
}

.link span,
.end span {
  position: relative;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  text-align: center;
}

.link b {
  display: block;
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

/* 병목 의심: 재공 칸 폭 안에 들어가게 (넘치면 옆 설비 칸을 덮는다) */
.link .warn {
  max-width: calc(100% - var(--sp-3));
  padding: 2px var(--sp-1);
  font-size: var(--fs-sm);
  border: var(--line-w) solid var(--c-idle-edge);
  background: var(--c-idle-tint);
}

.link em {
  display: block;
  color: var(--c-caution-ink);
  font-size: var(--fs-sm);
  font-style: normal;
  line-height: var(--lh-tight);
  word-break: keep-all;
}

.warn b {
  font-size: var(--fs-figure);
}

.end b {
  display: block;
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

@media (height <= 860px) {
  /* 낮은 창: 쌓인 칸의 오늘 생산은 숨긴다 (아래 '생산 · 불량' 합계와 도장 상세에 있다) */
  .grp.stack :deep(.info) {
    display: none;
  }

  .wrap {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>
