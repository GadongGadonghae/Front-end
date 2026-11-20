<!-- 미니 선 그래프 (카드 안). 축·글자 없이 선 하나와 기준 점선만. 칸 폭에 맞춰 늘어난다 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  points: [number, number][]
  x: [number, number]
  y: [number, number]
  /** 기준 점선 (상·하한) */
  lines?: number[]
}>(), { lines: () => [] })

const clamp = (v: number) => Math.min(100, Math.max(0, v))
const X = (v: number) => clamp(((v - props.x[0]) / (props.x[1] - props.x[0] || 1)) * 100)
const Y = (v: number) => clamp((1 - (v - props.y[0]) / (props.y[1] - props.y[0] || 1)) * 100)
// 11/21: x 범위(지금 기준 1시간) 밖의 점은 그리지 않아요 → 선이 카드 밖으로 튀어나가지 않게 (다른 PC 시계가 조금 달라도)
const shown = computed(() => props.points.filter(([a]) => a >= props.x[0] && a <= props.x[1]))
const d = computed(() => shown.value.map(([a, b], i) => `${i ? 'L' : 'M'}${X(a).toFixed(2)},${Y(b).toFixed(2)}`).join(''))
</script>

<template>
  <svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <line v-for="v in lines" :key="v" class="ref" x1="0" x2="100" :y1="Y(v)" :y2="Y(v)" vector-effect="non-scaling-stroke" />
    <path v-if="shown.length" class="s" :d="d" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: var(--spark-h, calc(var(--sp-8) + var(--sp-2)));
  overflow: hidden;
}

.ref {
  stroke: var(--c-ink-3);
  stroke-width: var(--line-w);
  stroke-dasharray: 3 3;
}

.s {
  fill: none;
  stroke: var(--c-ink);
  stroke-width: var(--line-w-strong);
  stroke-linejoin: round;
}
</style>
