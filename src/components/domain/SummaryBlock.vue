<!-- 요약 열 덩어리: (이름표) → 큰 숫자 → 보조 설명·작은 목록. 덩어리마다 위에 가는 선 (첫 덩어리 제외) -->
<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <div class="block">
    <div v-if="label" class="label">{{ label }}</div>
    <slot />
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) 0;
  border-top: var(--line-w) solid var(--c-line);
}

.block:first-child {
  padding-top: 0;
  border-top: 0;
}

.block:last-child {
  padding-bottom: 0;
}

.label {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

@media (height <= 860px) {
  .block {
    padding: var(--sp-3) 0;
  }
}
</style>
