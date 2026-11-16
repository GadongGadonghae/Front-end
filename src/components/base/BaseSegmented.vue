<!-- 구간 버튼: 주소를 바꾸지 않는 한 가지 선택 (일/주/월, 1시간/8시간/오늘, 관리값 항목, 2D/3D) -->
<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{ options: { value: T; label: string }[]; label: string; size?: 'md' | 'sm' }>(), { size: 'md' })
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="seg" :class="size" role="group" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :class="{ on: o.value === model }"
      :aria-pressed="o.value === model"
      @click="model = o.value"
    >{{ o.label }}</button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
}

button {
  height: var(--control-h);
  padding: 0 var(--sp-3);
  border: 0;
  border-left: var(--line-w) solid var(--c-line);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-body);
  white-space: nowrap;
  cursor: pointer;
}

button:first-child {
  border-left: 0;
}

button:hover {
  background: var(--c-surface-sunk);
}

button.on {
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

.sm button {
  height: var(--control-h-sm);
  font-size: var(--fs-label);
}
</style>
