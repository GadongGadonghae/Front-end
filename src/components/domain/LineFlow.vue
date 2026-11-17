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
  const parts = ['var(--flow-end-w)']
  props.view.groups.forEach((g, i) => {
    if (i) parts.push('var(--flow-link-w)')
    parts.push(`minmax(0, ${g.cells.length}fr)`)
  })
  parts.push('var(--flow-end-w)')
  return parts.join(' ')
})
/** 묶음 i가 놓이는 격자 열 (1부터) */
const col = (i: number) => 2 + i * 2

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
        <div class="grp" :style="{ gridColumn: col(i) }">
          <div
            v-for="c in g.cells"
            :key="c.id"
            class="hit"
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
          <span>재공 <b>{{ formatNumber(view.wip[i]) }}</b></span>
        </div>
      </template>
      <div class="end start"><span>{{ view.from }}</span></div>
      <div class="end finish" :style="{ gridColumn: col(view.groups.length - 1) + 1 }"><span>{{ view.to }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: var(--sp-4) var(--panel-pad);
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
  font-size: var(--fs-title);
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

.hit {
  position: relative;
  min-width: 0;
  border-radius: var(--r-2);
  cursor: pointer;
}

.foot {
  grid-row: 3;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
}

.foot b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
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
  font-size: var(--fs-label);
  text-align: center;
}

.link b {
  display: block;
  color: var(--c-ink);
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

@media (height <= 860px) {
  .wrap {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>
