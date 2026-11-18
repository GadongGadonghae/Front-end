<!-- 버튼: 기본(흰 면) · 주요(먹색 면). 버튼 문구는 하는 일을 그대로 쓴다 -->
<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'default' | 'primary'; size?: 'md' | 'sm'; type?: 'button' | 'submit' }>(), {
  variant: 'default',
  size: 'md',
  type: 'button',
})
</script>

<template>
  <button class="btn" :class="[variant, size]" :type="type"><slot /></button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  height: var(--control-h);
  padding: 0 var(--sp-4);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  font-size: var(--fs-md);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.btn:hover {
  background: var(--c-surface-sunk);
}

.btn.sm {
  height: var(--control-h-sm);
  padding: 0 var(--sp-3);
  font-size: var(--fs-sm);
}

.btn.primary {
  border-color: var(--c-inverse);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

.btn.primary:hover {
  background: var(--c-ink-2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
