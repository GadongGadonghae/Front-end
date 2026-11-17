<!-- 범례: 상태 열쇠 칸 + 명칭 (+ 대수), 예지보전 주의·위험 (+ 대수). 대시보드에서는 설비 대수를 겸한다 -->
<script setup lang="ts">
import StatusKey from '@/components/domain/StatusKey.vue'
import PdmMark from '@/components/domain/PdmMark.vue'
import { STATE_NAME } from '@/lib/status'
import type { StateCode } from '@/types/state'

defineProps<{
  /** 대수를 붙일 때만 */
  counts?: { state: Record<StateCode, number>; warn: number; danger: number }
  /** 예지보전 표시를 넣을지 */
  pdm?: boolean
}>()
const ORDER: StateCode[] = ['R', 'S', 'I', 'D']
</script>

<template>
  <ul class="legend" aria-label="범례">
    <li v-for="s in ORDER" :key="s"><StatusKey :state="s" size="sm" />{{ STATE_NAME[s] }}<b v-if="counts">{{ counts.state[s] }}</b></li>
    <template v-if="pdm">
      <li><PdmMark level="warn" variant="swatch" />주의<b v-if="counts">{{ counts.warn }}</b></li>
      <li><PdmMark level="danger" variant="swatch" />위험<b v-if="counts">{{ counts.danger }}</b></li>
    </template>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  margin: 0;
  padding: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
  list-style: none;
}

li {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

b {
  margin-left: var(--sp-1);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}
</style>
