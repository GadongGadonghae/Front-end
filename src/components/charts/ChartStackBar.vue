<!-- 한 줄 쌓은 막대: 전체를 몫으로 나눈다 (OEE 다리 = 부하시간 100%, 투입 흐름). 조각마다 title -->
<script setup lang="ts">
import { computed } from 'vue'

export interface StackPart { key: string; value: number; color: string; title: string }

const props = defineProps<{ parts: StackPart[]; label: string; total?: number }>()
const sum = computed(() => props.total ?? props.parts.reduce((a, p) => a + p.value, 0))
const width = (v: number) => `${sum.value ? (Math.max(0, v) / sum.value) * 100 : 0}%`
</script>

<template>
  <div class="stack" role="img" :aria-label="label">
    <i v-for="p in parts" :key="p.key" :style="{ width: width(p.value), background: p.color }" :title="p.title"></i>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  height: var(--bar-h-lg);
  overflow: hidden;
  border-radius: var(--r-1);
  background: var(--c-track);
}

i {
  flex: none;
  height: 100%;
}
</style>
