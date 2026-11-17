<!-- 이동 경로 (화면정의서 1장, D-82): 대시보드 > C > 프레스. 마지막 항목이 이 화면의 제목(h1) -->
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import BaseIcon from '@/components/base/BaseIcon.vue'

const props = defineProps<{ items: { label: string; to?: string }[] }>()
const trail = computed(() => props.items.slice(0, -1))
const current = computed(() => props.items.at(-1)?.label ?? '')
</script>

<template>
  <nav class="crumb" aria-label="이동 경로">
    <template v-for="c in trail" :key="c.label">
      <RouterLink v-if="c.to" :to="c.to">{{ c.label }}</RouterLink>
      <span v-else>{{ c.label }}</span>
      <BaseIcon name="chevron-right" :size="16" />
    </template>
    <h1 aria-current="page">{{ current }}</h1>
  </nav>
</template>

<style scoped>
.crumb {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-title);
  white-space: nowrap;
}

a {
  display: inline-flex;
  align-items: center;
  min-height: var(--sp-6);
  color: var(--c-ink-2);
  text-decoration: none;
}

a:hover {
  color: var(--c-ink);
  text-decoration: underline;
}

h1 {
  color: var(--c-ink);
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
}
</style>
