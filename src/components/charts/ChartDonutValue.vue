<!-- 값 도넛 (라인 상세 불량률): 조각 + 가운데 큰 값(슬롯). 비가동·생산 결과 도넛(슬롯)은 ChartDonut.
     전체 중 몫을 보여준다 (공정별 불량 비중). 가운데 숫자는 옆 게이지(OEE)와 같은 글자 크기로 쓰려고 슬롯 (11/22) -->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ parts: { value: number; color: string }[]; label: string; size?: number }>(), { size: 128 })
const R = 53
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
  <div class="donut" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 120 120" role="img" :aria-label="label">
      <circle class="track" cx="60" cy="60" :r="R" />
      <circle v-for="(a, i) in arcs" :key="i" cx="60" cy="60" :r="R" fill="none" :stroke="a.color" stroke-width="12" :stroke-dasharray="a.dash" :stroke-dashoffset="a.off" transform="rotate(-90 60 60)" />
    </svg>
    <div class="c"><slot /></div>
  </div>
</template>

<style scoped>
.donut {
  position: relative;
  flex: none;
}

svg {
  display: block;
}

.track {
  fill: none;
  stroke: var(--c-track);
  stroke-width: 12;
}

.c {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
}
</style>
