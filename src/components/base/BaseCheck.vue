<!-- 켜기·끄기 칩: 체크박스 하나 (예: 재고 추이에서 라인별 선 켜기). 켜면 먹색 테두리와 체크 표시 -->
<script setup lang="ts">
defineProps<{ label: string }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="check" :class="{ on: model }">
    <input v-model="model" type="checkbox" />
    <span class="box" aria-hidden="true"></span><slot>{{ label }}</slot>
  </label>
</template>

<style scoped>
.check {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: var(--control-h-sm);
  padding: 0 var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-label);
  cursor: pointer;
}

.check.on {
  border-color: var(--c-ink);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.box {
  width: var(--sp-3);
  height: var(--sp-3);
  border: var(--line-w-strong) solid var(--c-line-ink);
  border-radius: var(--r-1);
}

.on .box {
  border-color: var(--c-ink);
  background: var(--c-ink);
  box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-surface);
}

.check:has(input:focus-visible) {
  outline: var(--indicator-w) solid var(--c-accent);
  outline-offset: var(--line-w-strong);
}
</style>
