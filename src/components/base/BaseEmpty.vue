<!-- 빈 그래프·목록: "데이터 없음" (D-78) -->
<script setup lang="ts">
withDefaults(defineProps<{ text?: string }>(), { text: '데이터 없음' })
</script>

<template>
  <div class="empty">{{ text }}</div>
</template>

<style scoped>
.empty {
  display: grid;
  flex: 1;
  place-items: center;
  min-height: var(--control-h-lg);
  color: var(--c-ink-3);
  font-size: var(--fs-body);
}
</style>
