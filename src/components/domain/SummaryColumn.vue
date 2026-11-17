<!-- 요약 열 (DESIGN.md Components "요약 열"): 왼쪽 세로 열 패널. 제목 → 덩어리들(SummaryBlock). 덩어리 사이는 가는 선 -->
<script setup lang="ts">
import BasePanel from '@/components/base/BasePanel.vue'

/** spread: 덩어리 사이를 고르게 벌려 열 높이를 다 쓴다 (라인 상세) */
withDefaults(defineProps<{ title: string; meta?: string; spread?: boolean }>(), { spread: false })
</script>

<template>
  <BasePanel class="sumcol" :title="title" :meta="meta">
    <div class="blocks" :class="{ spread }"><slot /></div>
  </BasePanel>
</template>

<style scoped>
.blocks {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;

  /* 낮은 창에서는 덩어리가 아래로 넘치지 않게 열 안에서 스크롤 */
  overflow-y: auto;
}

.spread {
  justify-content: space-between;
}
</style>
