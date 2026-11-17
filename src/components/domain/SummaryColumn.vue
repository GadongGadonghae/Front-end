<!-- 요약 열 (DESIGN.md Components "요약 열"): 왼쪽 세로 열 패널. 제목 → 덩어리들(SummaryBlock). 덩어리 사이는 가는 선 -->
<script setup lang="ts">
import BasePanel from '@/components/base/BasePanel.vue'

defineProps<{ title: string; meta?: string }>()
</script>

<template>
  <BasePanel class="sumcol" :title="title" :meta="meta">
    <div class="blocks"><slot /></div>
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
</style>
