<!-- 고른 제품의 기록 (생산 조회 오른쪽 열, D-107): 상태 띠 · 제품 ID · 기본 정보 4칸 · 공정별 단계 기록(설비 · 들고 난 시각 · 판정 · 사유).
     상태 띠: 설비 고장으로 멈춤 = 옅은 빨강, 불량 제외 = 빗금, 양품·공정 중 = 옅은 파랑 -->
<script setup lang="ts">
import { formatSpan, formatTime } from '@/lib/format'
import type { ProductRecordView } from '@/types/view'

defineProps<{ view: ProductRecordView; from: string }>()
</script>

<template>
  <article class="rec">
    <header class="band" :class="view.state">
      <span>{{ from }}</span><b>{{ view.stateText }}</b>
    </header>
    <h3>{{ view.id }}</h3>
    <dl class="facts">
      <div><dt>라인</dt><dd>{{ view.lineLabel }}</dd></div>
      <div><dt>{{ view.whereLabel }}</dt><dd :class="{ down: view.state === 'stuck' }">{{ view.where }}</dd></div>
      <div><dt>투입</dt><dd>{{ formatTime(view.inputAt) }}</dd></div>
      <div><dt>{{ view.state === 'stuck' || view.state === 'wip' ? '투입 뒤' : '걸린 시간' }}</dt><dd>{{ formatSpan(view.leadSec) }}{{ view.state === 'stuck' || view.state === 'wip' ? '째' : '' }}</dd></div>
    </dl>
    <ol class="trail" aria-label="공정별 기록">
      <li v-for="s in view.steps" :key="s.key" :class="s.kind">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <p class="p">{{ s.label }}<small>{{ s.word }}</small></p>
          <p v-if="s.equipment" class="m">{{ s.equipment }}</p>
          <p v-if="s.time" class="m">{{ s.time }}</p>
          <p v-if="s.note" class="why">{{ s.note }}</p>
        </div>
      </li>
    </ol>
  </article>
</template>

<style scoped>
.rec {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.band {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: calc(var(--sp-3) * -1) calc(var(--sp-3) * -1) var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-3) var(--r-3) 0 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.band b {
  color: var(--c-ink);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.band.stuck { background: var(--c-down-tint); }
.band.stuck b { color: var(--c-down); }
.band.ng { background: repeating-linear-gradient(135deg, var(--c-ng-hatch) 0 2px, transparent 2px 9px), var(--c-surface-sunk); }

.band.ok,
.band.wip { background: var(--c-accent-tint); }

h3 {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: var(--sp-3) var(--sp-6);
  justify-content: start;
  margin: var(--sp-3) 0 var(--sp-4);
}

dt {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

dd {
  margin: 0;
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

dd.down {
  color: var(--c-down);
}

.trail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

li {
  position: relative;
  display: grid;
  grid-template-columns: var(--sp-4) minmax(0, 1fr);
  gap: 0 var(--sp-3);
  padding-bottom: var(--sp-4);
}

/* 단계 사이 세로 선 */
li:not(:last-child)::before {
  content: "";
  position: absolute;
  top: var(--sp-4);
  bottom: 0;
  left: calc(var(--sp-4) / 2 - 1px);
  border-left: 2px solid var(--c-line-strong);
}

.dot {
  width: var(--sp-4);
  height: var(--sp-4);
  margin-top: 2px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 2px var(--c-line-strong);
}

.ok .dot { box-shadow: inset 0 0 0 5px var(--c-ink-3); }
.ng .dot { background: var(--c-ink); box-shadow: none; }
.now .dot { box-shadow: inset 0 0 0 5px var(--c-accent); }
.stuck .dot { background: var(--c-down); box-shadow: none; }

.p {
  font-weight: var(--fw-strong);
}

.p small {
  margin-left: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.stuck .p small { color: var(--c-down); font-weight: var(--fw-strong); }

.m {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.why {
  margin-top: var(--sp-1);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-1);
  background: var(--c-surface-sunk);
  font-size: var(--fs-sm);
}

.todo {
  color: var(--c-ink-3);
}

.todo .p {
  font-weight: var(--fw-regular);
}
</style>
