<!-- 날짜 고르기: 이름표 + 브라우저 날짜 입력 (YYYY-MM-DD). max로 미래 날짜를 막는다 -->
<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; max?: string; min?: string }>()
const model = defineModel<string>({ required: true })
const id = useId()

/** 비우면 앞 값을 그대로 둔다 (조회 조건이 빈 날짜가 되지 않게) */
function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) model.value = v
}
</script>

<template>
  <span class="field">
    <label class="lab" :for="id">{{ label }}</label>
    <input :id="id" type="date" :value="model" :max="max" :min="min" @change="onInput" />
  </span>
</template>

<style scoped>
.field {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.lab {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
  white-space: nowrap;
}

input {
  height: var(--control-h);
  padding: 0 var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-body);
}
</style>
