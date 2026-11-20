<!-- 고르기: 이름표를 왼쪽에 붙인 기본 select (제목 줄 필터). 고를 것이 하나뿐이면 비활성 -->
<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{ label: string; options: { value: T; label: string }[]; disabled?: boolean }>(), { disabled: false })
const model = defineModel<T>({ required: true })
</script>

<template>
  <label class="field">
    <span class="lab">{{ label }}</span>
    <span class="box">
      <select v-model="model" :disabled="disabled || options.length < 2">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </span>
  </label>
</template>

<style scoped>
.field {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.lab {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  white-space: nowrap;
}

.box {
  position: relative;
  display: inline-flex;
}

/* 펼침 화살표: 글자색 테두리로 그린 꺾쇠 */
.box::after {
  content: '';
  position: absolute;
  top: 50%;
  right: var(--sp-3);
  width: var(--sp-2);
  height: var(--sp-2);
  border-right: var(--line-w-strong) solid var(--c-ink-2);
  border-bottom: var(--line-w-strong) solid var(--c-ink-2);
  transform: translateY(-75%) rotate(45deg);
  pointer-events: none;
}

select {
  height: var(--control-h);
  min-width: 6em;
  padding: 0 var(--sp-8) 0 var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-md);
  appearance: none;
  cursor: pointer;
}

select:disabled {
  background: var(--c-surface-sunk);
  color: var(--c-ink-3);
  cursor: default;
}
</style>
