<!-- 링크 탭: 주소가 바뀌는 탭 (라인 A~F·도장, 공정, 리포트 종류). 선택 = 먹색 면 + 흰 글자 (DESIGN.md Components) -->
<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ items: { key: string; label: string; to: string; disabled?: boolean }[]; active: string; label: string }>()
</script>

<template>
  <nav class="tabs" :aria-label="label">
    <span v-for="t in items.filter((x) => x.disabled)" :key="t.key" class="off" aria-disabled="true" :title="`${t.label}는 준비 중`">{{ t.label }}</span>
    <RouterLink
      v-for="t in items.filter((x) => !x.disabled)"
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

/* 칸 사이 구분선은 앞 칸의 오른쪽 선으로 (준비 중 칸이 앞에 와도 같은 모양) */
a,
.off {
  display: flex;
  align-items: center;
  height: var(--control-h);
  padding: 0 var(--sp-4);
  border-right: var(--line-w) solid var(--c-line);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  text-decoration: none;
  white-space: nowrap;
}

.off {
  color: var(--c-ink-3);
  cursor: not-allowed;
}

a:last-child {
  border-right: 0;
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
