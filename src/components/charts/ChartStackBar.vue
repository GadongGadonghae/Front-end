<!-- 한 줄 쌓은 막대: 전체를 몫으로 나눈다 (OEE 다리 = 부하시간 100%, 투입 흐름, 대시보드 공정별 불량 몫). 조각마다 title
     gaps: 조각 사이 2px 틈 (범주 색끼리 붙지 않게, dataviz spacer) -->
<script setup lang="ts">
import { computed } from 'vue'

export interface StackPart { key: string; value: number; color: string; title: string }

const props = defineProps<{ parts: StackPart[]; label: string; total?: number; gaps?: boolean }>()
const sum = computed(() => props.total ?? props.parts.reduce((a, p) => a + p.value, 0))
const width = (v: number) => `${sum.value ? (Math.max(0, v) / sum.value) * 100 : 0}%`
</script>

<template>
  <div class="stack" :class="{ gaps }" role="img" :aria-label="label">
    <template v-for="p in parts" :key="p.key">
      <i v-if="!gaps || p.value > 0" :style="gaps ? { flexGrow: p.value, background: p.color } : { width: width(p.value), background: p.color }" :title="p.title"></i>
    </template>
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

/* 틈 있는 몫 막대: 폭은 값에 비례 (flex-grow), 바탕은 비움 */
.gaps {
  gap: var(--chart-gap);
  background: none;
}

.gaps i {
  flex: 0 1 0;
  min-width: var(--chart-gap);
}
</style>
