<!-- 링크 탭: 주소가 바뀌는 탭 (라인 L1~L6·도장, 공정, 리포트 종류). 선택 = 먹색 면 + 흰 글자 (DESIGN.md Components) -->
<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ items: { key: string; label: string; to: string }[]; active: string; label: string }>()
</script>

<template>
  <nav class="tabs" :aria-label="label">
    <RouterLink
      v-for="t in items"
      :key="t.key"
      :to="t.to"
      :class="{ on: t.key === active }"
      :aria-current="t.key === active ? 'page' : undefined"
    >{{ t.label }}</RouterLink>
  </nav>
</template>

<style scoped>
.tabs {
  display: inline-flex;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

a {
  display: flex;
  align-items: center;
  height: var(--control-h);
  padding: 0 var(--sp-4);
  border-left: var(--line-w) solid var(--c-line);
  color: var(--c-ink-2);
  font-size: var(--fs-body);
  text-decoration: none;
  white-space: nowrap;
}

a:first-child {
  border-left: 0;
}

a:hover {
  background: var(--c-surface-sunk);
}

a.on {
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
  font-weight: var(--fw-strong);
}
</style>
