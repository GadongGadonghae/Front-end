<!-- 3D 공장: 라인 카드 (D-118, 11/20 간소화). 라인 바닥을 누르면 3D 화면 오른쪽 위에 붙는다
     간단한 정보만: 생산 · 달성률 · OEE, 상태별 대수, 공정 사이 재공 한 줄, 라인 상세 화면으로 -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { formatNumber } from '@/lib/format'
import type { StateCode } from '@/types/state'
import type { LineSummary } from '@/types/live'
import type { ProductionLineId } from '@/types/plant'

defineProps<{
  line: ProductionLineId
  sum: LineSummary | null
  /** 상태별 설비 대수 */
  counts: Record<StateCode, number>
  /** 지금 보내는 도장 (예: 도장 1) */
  paint: string
  /** 기본과 다른 도장으로 바뀌었는지 */
  switched: boolean
  /** 공정 사이 재공 (데모) */
  wip: { label: string; qty: number | null }[]
}>()
const emit = defineEmits<{ close: []; openLine: [] }>()
const STATES: StateCode[] = ['R', 'I', 'S', 'D', 'DC']
</script>

<template>
  <aside class="panel" :aria-label="`${line}라인 카드`">
    <header class="head">
      <div>
        <h3 class="title">{{ line }}라인</h3>
        <p class="sub">슬리팅 1 · 프레스 4 · 용접 1 → {{ paint }}<template v-if="switched"> <b class="sw">경로 전환</b></template></p>
      </div>
      <button type="button" class="x" aria-label="닫기 (Esc)" title="닫기 (Esc)" @click="emit('close')"><BaseIcon name="x" /></button>
    </header>

    <div class="body">
      <dl class="kpi">
        <div>
          <dt>생산</dt>
          <dd class="num">{{ formatNumber(sum?.done) }}</dd>
          <dd v-if="sum?.plan != null" class="of num">/ {{ formatNumber(sum.plan) }}</dd>
        </div>
        <div>
          <dt>달성률</dt>
          <dd class="num">{{ formatNumber(sum?.rate, 1) }}<small v-if="sum?.rate != null">%</small></dd>
        </div>
        <div>
          <dt>OEE</dt>
          <dd class="num">{{ formatNumber(sum?.oee, 1) }}<small v-if="sum?.oee != null">%</small></dd>
        </div>
      </dl>
      <ChartProgress v-if="sum?.rate != null" class="prog" :percent="sum.rate" :label="`달성률 ${formatNumber(sum.rate, 1)}%`" />

      <ul class="states" aria-label="상태별 설비 대수">
        <li v-for="s in STATES" :key="s" :class="{ zero: !counts[s] }">
          <StatusKey :state="s" size="sm" :muted="!counts[s]" /><b class="num">{{ counts[s] }}</b>
        </li>
      </ul>

      <p class="wip">
        재공 (데모) ·
        <template v-for="(w, i) in wip" :key="w.label">{{ i ? ' · ' : '' }}{{ w.label }} <b class="num">{{ formatNumber(w.qty) }}</b></template>
      </p>
    </div>

    <footer class="foot">
      <button type="button" class="go" @click="emit('openLine')">{{ line }}라인 상세 화면으로 <BaseIcon name="chevron-right" :size="16" /></button>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-3);
  background: var(--c-surface);
  color: var(--c-ink);
  animation: panel-in var(--dur-enter) var(--ease-out);
}

@keyframes panel-in {
  from { opacity: 0; transform: translateX(var(--sp-3)); }
}

.head {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-3) var(--sp-3) var(--sp-4);
  border-bottom: var(--line-w) solid var(--c-line);
}

.title {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.sub {
  margin-top: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.sw {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.x {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--control-h-sm);
  height: var(--control-h-sm);
  border: 0;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink-2);
  cursor: pointer;
}

.x:hover { background: var(--c-surface-sunk); color: var(--c-ink); }

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
}

.kpi {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-3);
  margin: 0;
}

.kpi dt {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.kpi dd {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.kpi small {
  margin-left: 1px;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.kpi .of {
  margin-top: 2px;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.prog {
  margin-top: var(--sp-3);
}

/* 상태별 대수: 상태 글자 칸 + 수. 0대는 흐리게 */
.states {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-2);
  margin: var(--sp-4) 0 0;
  padding: var(--sp-3) 0 0;
  border-top: var(--line-w) solid var(--c-line);
  list-style: none;
}

.states li {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-row);
}

.states b { font-weight: var(--fw-strong); }

.states .zero b {
  color: var(--c-ink-3);
  font-weight: var(--fw-regular);
}

.wip {
  margin-top: var(--sp-3);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-body);
}

.wip .num {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.foot {
  flex: none;
  padding: var(--sp-3) var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
}

.go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  width: 100%;
  height: var(--control-h);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-accent);
  font: inherit;
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
  cursor: pointer;
}

.go:hover { background: var(--c-surface-sunk); }
</style>
