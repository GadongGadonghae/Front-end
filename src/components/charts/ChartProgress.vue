<!-- 진행 막대: 목표 하나에 대한 진행 (달성률). 강조 파랑 (DESIGN.md "파랑 하나" — 실적·달성률) -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ percent: number | null; label: string }>()
const width = computed(() => `${Math.max(0, Math.min(100, props.percent ?? 0))}%`)
</script>

<template>
  <div class="track" role="img" :aria-label="label"><i :style="{ width }"></i></div>
</template>

<style scoped>
.track {
  height: var(--bar-h);
  overflow: hidden;
  border-radius: var(--r-1);
  background: var(--c-track);
}

i {
  display: block;
  height: 100%;
  background: var(--c-accent);
}
</style>
