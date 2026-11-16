<!-- 가로 막대 목록: 이름 · 막대 · 값 (· 보조). 비교용. 한 계열 안에서 색을 바꾸지 않고, 강조 행만 진하게.
     tone은 의미가 있을 때만 (비가동 코드별 시간 = 상태 색). marker: 세로 기준선 (예: 라인 계획) -->
<script setup lang="ts">
import { computed } from 'vue'

export interface BarRow {
  key: string
  label: string
  value: number | null
  /** 오른쪽에 보일 값 글 (없으면 숫자 그대로) */
  display?: string
  /** 맨 오른쪽 흐린 보조 (예: 2건) */
  sub?: string
  /** 강조 행 (예: 가장 낮음) */
  strong?: boolean
  /** 0건 등 흐리게 */
  muted?: boolean
  tone?: 'ink' | 'run' | 'stop' | 'idle' | 'down'
}

const props = withDefaults(defineProps<{ rows: BarRow[]; max?: number; marker?: number; label: string; thick?: boolean }>(), { thick: false })

const top = computed(() => props.max ?? Math.max(1, ...props.rows.map((r) => r.value ?? 0), props.marker ?? 0))
const pct = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / top.value) * 100))}%`
const hasSub = computed(() => props.rows.some((r) => r.sub))
</script>

<template>
  <ul class="bars" :class="{ thick, 'has-sub': hasSub }" :aria-label="label">
    <li v-for="r in rows" :key="r.key" :class="{ strong: r.strong, muted: r.muted }">
      <span class="name"><slot name="lead" :row="r" />{{ r.label }}</span>
      <span class="track">
        <i :class="`t-${r.tone ?? 'ink'}`" :style="{ width: pct(r.value) }"></i>
        <b v-if="marker != null" class="marker" :style="{ left: pct(marker) }"></b>
      </span>
      <span class="val">{{ r.display ?? (r.value ?? '-') }}</span>
      <span v-if="hasSub" class="sub">{{ r.sub }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* 목록 전체가 한 격자: 이름 길이가 달라도 막대 시작·값 열이 모든 행에서 맞는다 (행은 subgrid) */
.bars {
  display: grid;
  flex: 1;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  align-content: space-around;
  gap: var(--sp-2) var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars.has-sub {
  grid-template-columns: max-content minmax(0, 1fr) max-content max-content;
}

li {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
}

.name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

.track {
  position: relative;
  height: var(--bar-h);
  border-radius: var(--r-1);
  background: var(--c-track);
}

.thick .track {
  height: var(--bar-h-lg);
}

.track i {
  display: block;
  height: 100%;
  border-radius: var(--r-1);
}

.t-ink { background: var(--c-ink-2); }
.t-run { background: var(--c-run); }
.t-stop { background: var(--c-stop-solid); }
.t-idle { background: var(--c-idle); }
.t-down { background: var(--c-down); }

.marker {
  position: absolute;
  top: calc(var(--sp-1) * -1);
  bottom: calc(var(--sp-1) * -1);
  border-left: var(--indicator-w) solid var(--c-ink);
}

.val {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  text-align: right;
  white-space: nowrap;
}

.sub {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  text-align: right;
}

.strong .t-ink {
  background: var(--c-ink);
}

.strong .name {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.muted,
.muted .val {
  color: var(--c-ink-3);
}
</style>
