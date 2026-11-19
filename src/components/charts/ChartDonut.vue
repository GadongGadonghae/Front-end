<!-- 도넛: 전체 중 몫을 보여준다 (달성률 · 공정별 불량 비중). 가운데에 큰 값과 작은 이름 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ parts: { value: number; color: string }[]; center: string; sub?: string; label: string; size?: number }>(), { size: 112 })
const R = 42
const C = 2 * Math.PI * R
const arcs = computed(() => {
  const total = props.parts.reduce((a, p) => a + p.value, 0) || 1
  let off = 0
  return props.parts.map((p) => {
    const len = (C * p.value) / total
    const a = { color: p.color, dash: `${len} ${C - len}`, off: -off }
    off += len
    return a
  })
})
</script>

<template>
  <svg class="donut" :width="size" :height="size" viewBox="0 0 120 120" role="img" :aria-label="label">
    <circle v-for="(a, i) in arcs" :key="i" cx="60" cy="60" :r="R" fill="none" :stroke="a.color" stroke-width="16" :stroke-dasharray="a.dash" :stroke-dashoffset="a.off" transform="rotate(-90 60 60)" />
    <text x="60" y="62" text-anchor="middle" class="c">{{ center }}</text>
    <text v-if="sub" x="60" y="80" text-anchor="middle" class="s">{{ sub }}</text>
  </svg>
</template>

<style scoped>
.donut {
  flex: none;
}

.c {
  fill: var(--c-ink);
  font-size: 20px;
  font-weight: var(--fw-strong);
}

.s {
  fill: var(--c-ink-3);
  font-size: 11px;
}
</style>
