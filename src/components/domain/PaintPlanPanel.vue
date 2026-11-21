<!-- 도장 운영 (11/21): 가동 라인 수에 맞춰 도장 몇 대를, 어느 경로로 쓸지. 판단은 서버(PaintPlanner), 여기는 보여 주고 적용만
     도장마다 [지금] / [제안] 부하 막대 + 상한 표시. 제안이 지금과 다르면 [제안대로 적용]. 경로 직접 바꾸기는 접어 둠 -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import type { PaintBooth, PaintPlan } from '@/types/paint'

const props = defineProps<{
  plan: PaintPlan | null
  canApply: boolean
  busy: boolean
  message: string
  error: string
  /** 라인별 지금 경로 (경로 직접 바꾸기) */
  rows: { lineId: string; name: string; current: string }[]
  painters: { value: string; label: string }[]
}>()
const emit = defineEmits<{ apply: []; route: [lineId: string, paintId: string] }>()
const plan = computed(() => props.plan)

const pct = (v: number) => `${Math.round(v * 100)}%`
/** 막대 폭: 120%까지 그려요 (넘치면 끝까지) */
const w = (v: number) => `${Math.min(100, (v / 1.2) * 100)}%`
const rhoAt = computed(() => (plan.value ? w(plan.value.rho) : '0%'))
const tone = computed(() => (!plan.value ? null : plan.value.noBooth || plan.value.overloaded ? 'down' : plan.value.changeNeeded ? 'idle' : null))
const fit = computed(() => (plan.value ? Math.floor(plan.value.rho / Math.max(plan.value.lineLoad, 1e-9) + 1e-9) : 0))
const same = (b: PaintBooth) => b.nowLines.join() === b.planLines.join() && b.parked === !b.planOn
const boothLabel = (b: PaintBooth) => (b.paintId === 'PT1' ? '도장 1호기' : b.paintId === 'PT2' ? '도장 2호기' : b.paintId)
const saved = computed(() => {
  const m = plan.value?.savedMinutes
  return m ? `근무 끝까지 도장 가동 약 ${Math.floor(m / 60)}시간 ${m % 60}분 절약` : null
})
</script>

<template>
  <div v-if="plan" class="pp" :class="tone && `t-${tone}`">
    <p class="verdict">{{ plan.verdict }}</p>
    <p class="basis">
      라인 1개 = 도장 부하 <b class="num">{{ pct(plan.lineLoad) }}</b>
      (도장 {{ plan.paintCt }}초 ÷ 라인 박자 {{ plan.lineCt }}초) · 도장 1대 상한 {{ pct(plan.rho) }} → 라인 {{ fit }}개까지
    </p>

    <div class="booths">
      <section v-for="b in plan.booths" :key="b.paintId" class="booth" :class="{ off: !b.planOn, changed: !same(b) }">
        <header class="bh">
          <StatusKey :state="b.state" size="sm" :label="true" />
          <b>{{ boothLabel(b) }}</b>
          <span v-if="b.parked" class="tag">운휴 중</span>
          <span v-if="!b.usable" class="tag bad">배정 제외</span>
        </header>
        <dl class="rows">
          <div class="row">
            <dt>지금</dt>
            <dd class="lines">{{ b.nowLines.length ? b.nowLines.join('·') : '없음' }}</dd>
            <dd class="bar" :aria-label="`지금 부하 ${pct(b.nowLoad)}`"><i :style="{ width: w(b.nowLoad) }" :class="{ over: b.nowLoad > plan.rho }" /><s :style="{ left: rhoAt }" /></dd>
            <dd class="v num">{{ pct(b.nowLoad) }}</dd>
          </div>
          <div class="row plan">
            <dt>제안</dt>
            <dd class="lines">{{ b.planOn ? b.planLines.join('·') : '운휴 (계획정지)' }}</dd>
            <dd class="bar" :aria-label="`제안 부하 ${pct(b.planLoad)}`"><i :style="{ width: w(b.planLoad) }" :class="{ over: b.planLoad > plan.rho }" /><s :style="{ left: rhoAt }" /></dd>
            <dd class="v num">{{ b.planOn ? pct(b.planLoad) : '-' }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <ul v-if="plan.changes.length || plan.turnOff.length || plan.turnOn.length" class="todo">
      <li v-for="c in plan.changes" :key="c.lineId">{{ c.lineId }}라인 경로 {{ c.from }} → {{ c.to }}</li>
      <li v-for="p in plan.turnOn" :key="`on-${p}`">{{ p }} 다시 가동</li>
      <li v-for="p in plan.turnOff" :key="`off-${p}`">{{ p }} 물량 적음 운휴 (계획정지, 손실 아님)</li>
      <li v-if="saved" class="note">{{ saved }}</li>
    </ul>

    <div class="acts">
      <BaseButton v-if="plan.changeNeeded && props.canApply" variant="primary" :disabled="busy" @click="emit('apply')">{{ busy ? '적용 중…' : '제안대로 적용' }}</BaseButton>
      <span v-else-if="plan.changeNeeded" class="hint">적용은 공장장·생산 관리 팀장만 할 수 있습니다</span>
      <span v-if="message" class="ok" role="status">{{ message }}</span>
      <span v-if="error" class="err" role="alert">{{ error }}</span>
    </div>

    <details class="more">
      <summary>판단 근거</summary>
      <ul class="reasons">
        <li v-for="(r, i) in plan.reasons" :key="i">{{ r }}</li>
        <li>고르는 순서: 넘치는 부하가 적은 안 → 켜는 도장이 적은 안 → 경로를 덜 바꾸는 안 → 기본 경로에 가까운 안 → 두 도장이 고른 안 (모든 경우를 다 따져 봄)</li>
      </ul>
    </details>

    <details v-if="props.canApply" class="more">
      <summary>경로 직접 바꾸기</summary>
      <ul class="manual">
        <li v-for="r in rows" :key="r.lineId">
          <span class="mname">{{ r.name }}</span>
          <span class="mstate">{{ plan.running.includes(r.lineId) ? '가동' : '쉬는 라인' }}</span>
          <span class="mbtns">
            <button
              v-for="p in painters"
              :key="p.value"
              type="button"
              class="mb"
              :class="{ on: r.current === p.value }"
              :aria-pressed="r.current === p.value"
              :disabled="busy || r.current === p.value"
              @click="emit('route', r.lineId, p.value)"
            >{{ p.label }}</button>
          </span>
        </li>
      </ul>
      <p class="hint">운휴 중인 도장으로 보내면 그 도장을 다시 켭니다. 바꾼 뒤 판단은 10초 안에 다시 계산됩니다.</p>
    </details>
  </div>
  <BaseEmpty v-else text="도장 운영 판단을 불러오는 중 (서버 연결 필요)" />
</template>

<style scoped>
.pp {
  display: grid;
  gap: var(--sp-3);
}

.verdict {
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

.t-idle .verdict { background: var(--c-idle-tint); }
.t-down .verdict { background: var(--c-down-tint); }

.basis,
.hint {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.booths {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}

.booth {
  padding: var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
}

.booth.changed {
  border-color: var(--c-line-strong);
  background: var(--c-surface-sunk);
}

.bh {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.tag {
  padding: 0 var(--sp-1);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.tag.bad {
  border-color: var(--c-down);
  color: var(--c-down-ink);
}

.rows {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
}

.row {
  display: grid;
  grid-template-columns: 2.4em minmax(4.5em, max-content) minmax(0, 1fr) 3em;
  align-items: center;
  gap: var(--sp-2);
}

.row dt {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.row dd {
  margin: 0;
}

.row.plan .lines {
  font-weight: var(--fw-strong);
}

.bar {
  position: relative;
  height: 10px;
  border-radius: var(--r-1);
  background: var(--c-track);
}

.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--r-1);
  background: var(--c-ink-2);
}

.bar i.over { background: var(--c-down); }

/* 도장 1대 상한 표시 */
.bar s {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: var(--line-w);
  background: var(--c-ink);
}

.v {
  text-align: right;
}

.num {
  font-variant-numeric: tabular-nums;
}

.todo,
.reasons {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
  padding-left: var(--sp-5);
  font-size: var(--fs-md);
}

.todo .note {
  color: var(--c-ink-2);
}

.reasons {
  margin-top: var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
}

.ok { color: var(--c-run-ink); font-size: var(--fs-sm); }
.err { color: var(--c-down-ink); font-size: var(--fs-sm); }

.more summary {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.manual {
  display: grid;
  grid-template-columns: max-content max-content max-content;
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
  margin: var(--sp-2) 0;
  padding: 0;
  list-style: none;
}

.manual li {
  display: contents;
}

.mstate {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.mbtns {
  display: inline-flex;
  gap: var(--sp-1);
}

.mb {
  padding: var(--sp-1) var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.mb.on {
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
  cursor: default;
}

.mb:disabled:not(.on) {
  opacity: 0.5;
  cursor: default;
}
</style>
