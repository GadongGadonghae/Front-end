<!-- 3D 공장: 라인 상세 (D-118). 라인 바닥을 누르면 3D 화면 오른쪽에 붙는다
     위: 생산 · 달성률 · OEE 숫자 세 칸 + 달성률 막대. 가운데: 설비 흐름 (슬리팅 → 재공 → 프레스 1~4 → 재공 → 용접 → 재공 → 도장)
     설비 줄을 누르면 그 설비로 다가가고 왼쪽에 팝업. 아래: 공정 불량 · 라인 상세 화면으로 -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { formatNumber } from '@/lib/format'
import type { StateCode } from '@/types/state'
import type { LineSummary } from '@/types/live'
import type { ProductionLineId } from '@/types/plant'

export interface LineFlowRow {
  /** 설비 줄 */
  kind: 'eq'
  id: string
  /** 짧은 번호 (SL · PR1 · WD) */
  no: string
  /** 공정 이름 (슬리팅 · 프레스 1단 · 용접) */
  name: string
  state: StateCode
  /** 이상 상태면 "고장 12:07"처럼 */
  note: string | null
}
export interface LineWipRow {
  /** 공정 사이 재공 줄 */
  kind: 'wip'
  key: string
  label: string
  qty: number | null
}

defineProps<{
  line: ProductionLineId
  sum: LineSummary | null
  flow: (LineFlowRow | LineWipRow)[]
  /** 지금 보내는 도장 (예: 도장 1) */
  paint: string
  /** 기본과 다른 도장으로 바뀌었는지 */
  switched: boolean
  /** 이상 대수 (가동·정지 아닌 것) */
  abnormal: number
  ng: { label: string; value: number | null }[]
  /** 지금 다가가 있는 설비 */
  focusId: string | null
}>()
const emit = defineEmits<{ close: []; pick: [id: string]; openLine: [] }>()
</script>

<template>
  <aside class="panel" :aria-label="`${line}라인 상세`">
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

      <section class="sec">
        <h4 class="h">
          설비 흐름
          <span class="meta" :class="{ warn: abnormal }">{{ abnormal ? `이상 ${abnormal}대` : '모두 정상' }}</span>
        </h4>
        <ol class="flow">
          <li v-for="r in flow" :key="r.kind === 'eq' ? r.id : r.key" :class="r.kind">
            <button
              v-if="r.kind === 'eq'"
              type="button"
              class="eq"
              :class="{ on: focusId === r.id, ab: r.state !== 'R' && r.state !== 'S' }"
              :aria-pressed="focusId === r.id"
              @click="emit('pick', r.id)"
            >
              <StatusKey :state="r.state" size="sm" />
              <b class="no">{{ r.no }}</b>
              <span class="name">{{ r.name }}</span>
              <span v-if="r.note" class="note num">{{ r.note }}</span>
            </button>
            <span v-else class="wip">
              <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 14 4.8v6.4L8 14.2 2 11.2V4.8zM2 4.8l6 3 6-3M8 7.8v6.4" /></svg>
              {{ r.label }} <b class="num">{{ formatNumber(r.qty) }}</b>
            </span>
          </li>
          <li class="end">→ {{ paint }}</li>
        </ol>
        <p class="demo">재공 수는 데모 값</p>
      </section>

      <section class="sec">
        <h4 class="h">공정 불량 <span class="meta">오늘 · 공정 검사</span></h4>
        <dl class="ng">
          <div v-for="n in ng" :key="n.label"><dt>{{ n.label }}</dt><dd class="num">{{ formatNumber(n.value) }}</dd></div>
        </dl>
      </section>
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

.sec {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
}

.h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--sp-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.meta {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.meta.warn {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.flow {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 설비 줄: 고른 줄은 가라앉은 면 + 네 변 테두리 (CLAUDE.md 모양 규칙) */
.eq {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: var(--control-h-sm);
  padding: 3px var(--sp-2);
  border: var(--line-w) solid transparent;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-md);
  text-align: left;
  cursor: pointer;
}

.eq:hover { background: var(--c-surface-sunk); }

.eq.on {
  border-color: var(--c-line-strong);
  background: var(--c-surface-sunk);
}

.no {
  min-width: 3.2em;
  font-weight: var(--fw-strong);
}

.name {
  color: var(--c-ink-2);
}

.note {
  margin-left: auto;
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

/* 공정 사이 재공: 설비 줄 사이의 가는 연결 줄 */
.wip {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin-left: calc(var(--sp-2) + var(--key-sm) / 2);
  padding: 3px 0 3px var(--sp-3);
  border-left: var(--line-w-strong) dashed var(--c-line-ink);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.wip b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.ico {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.4;
  stroke-linejoin: round;
}

.end {
  padding: var(--sp-1) var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.demo {
  margin-top: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.ng {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
  margin: 0;
}

.ng dt {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.ng dd {
  margin: 2px 0 0;
  font-size: var(--fs-row);
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
