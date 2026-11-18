<!-- 상태별 대수: 상태 열쇠 칸 + 명칭 + 대수. grid = 2×2 (요약 열), row = 한 줄 (제목 줄). 0대는 흐리게 -->
<script setup lang="ts">
import StatusKey from '@/components/domain/StatusKey.vue'
import { STATE_NAME } from '@/lib/status'
import type { StateCode } from '@/types/state'

withDefaults(defineProps<{ counts: Record<StateCode, number>; layout?: 'grid' | 'row'; label?: string; big?: boolean }>(), { layout: 'grid', label: '상태별 대수', big: false })
const ORDER: StateCode[] = ['R', 'S', 'I', 'D', 'DC']
</script>

<template>
  <ul class="counts" :class="[`is-${layout}`, { big }]" :aria-label="label">
    <li v-for="s in ORDER" :key="s" :class="{ zero: !counts[s] }">
      <StatusKey :state="s" :size="layout === 'row' ? 'sm' : 'md'" :muted="!counts[s]" />
      <span class="name">{{ STATE_NAME[s] }}</span>
      <b>{{ counts[s] }}</b>
    </li>
  </ul>
</template>

<style scoped>
.counts {
  margin: 0;
  padding: 0;
  list-style: none;
}

.is-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3) var(--sp-5);
}

.is-row {
  display: flex;
  gap: var(--sp-4);
}

li {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.name {
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

b {
  margin-left: auto;
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.is-row b {
  margin-left: var(--sp-1);
  font-size: var(--fs-lg);
}

.big {
  gap: var(--sp-4) var(--sp-5);
}

.big b {
  font-size: var(--fs-xl);
  line-height: 1;
}

/* 한 줄: 명칭은 열쇠 칸 글자로 대신한다 (글자 R/S/I/D는 남는다) */
.is-row .name {
  display: none;
}

.zero .name,
.zero b {
  color: var(--c-ink-3);
  font-weight: var(--fw-regular);
}
</style>
