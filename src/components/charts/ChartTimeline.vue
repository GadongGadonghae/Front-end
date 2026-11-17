<!-- 00~24시 구간 색 띠 (SCR-003 6번). 줄마다 이름 | 띠. until 뒤는 "아직 안 온 시간"(가라앉은 면)
     색만으로 말하지 않게, 넓은 구간에는 글자(letter)를 띠 안에 쓰고 모든 구간에 title을 단다 -->
<script setup lang="ts">
export interface TimelineSegment { from: number; to: number; tone: 'run' | 'stop' | 'idle' | 'down'; letter: string; title: string }

const props = defineProps<{
  label: string
  rows: { key: string; label: string; segments: TimelineSegment[] }[]
  /** 축 끝 (예: 86400초) */
  span: number
  /** 기록이 있는 끝. 이 뒤는 아직 안 온 시간 */
  until: number
  ticks: { value: number; label: string }[]
}>()

const pct = (v: number) => `${(Math.max(0, Math.min(props.span, v)) / props.span) * 100}%`
const wide = (s: TimelineSegment) => (s.to - s.from) / props.span > 0.025
</script>

<template>
  <div class="tl" role="img" :aria-label="label">
    <div v-for="r in rows" :key="r.key" class="row">
      <span class="name">{{ r.label }}</span>
      <span class="track">
        <i
          v-for="(s, i) in r.segments"
          :key="i"
          :class="`t-${s.tone}`"
          :style="{ left: pct(s.from), width: pct(s.to - s.from) }"
          :title="s.title"
        >{{ wide(s) ? s.letter : '' }}</i>
        <i v-if="until < span" class="future" :style="{ left: pct(until), width: pct(span - until) }"></i>
      </span>
    </div>
    <div class="row axis" aria-hidden="true">
      <span></span>
      <span class="track">
        <b v-for="t in ticks" :key="t.value" :style="{ left: pct(t.value) }">{{ t.label }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.tl {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-around;
  gap: var(--sp-2);
  min-height: 0;
}

.row {
  display: grid;
  grid-template-columns: var(--chart-label-w) minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
}

.name {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
  white-space: nowrap;
}

.track {
  position: relative;
  height: var(--key-md);
  overflow: hidden;
  border-radius: var(--r-1);
  background: var(--c-track);
}

.track i {
  position: absolute;
  top: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: var(--fs-caption);
  font-style: normal;
  font-weight: var(--fw-code);
}

.t-run { background: var(--c-run); color: var(--c-run-ink); }
.t-stop { background: var(--c-stop); color: var(--c-stop-ink); box-shadow: inset 0 0 0 var(--line-w) var(--c-stop-solid); }
.t-idle { background: var(--c-idle); color: var(--c-idle-ink); }
.t-down { background: var(--c-down); color: var(--c-down-ink); }

.future {
  background: var(--c-surface-sunk);
  box-shadow: inset var(--line-w) 0 0 var(--c-line-strong);
}

.axis .track {
  height: auto;
  min-height: var(--sp-5);
  overflow: visible;
  background: none;
}

.axis b {
  position: absolute;
  top: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
  font-weight: var(--fw-regular);
  white-space: nowrap;
  transform: translateX(-50%);
}

.axis b:first-child {
  transform: none;
}

.axis b:last-child {
  transform: translateX(-100%);
}
</style>
