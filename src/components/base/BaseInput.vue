<!-- 글자 입력: 위에 이름표, 테두리 입력칸. 오류면 테두리를 고장 빨강으로 -->
<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ label: string; type?: 'text' | 'password'; autocomplete?: string; invalid?: boolean }>(), {
  type: 'text',
  invalid: false,
})
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input :id="id" v-model="model" :type="type" :autocomplete="autocomplete" :aria-invalid="invalid || undefined" :class="{ invalid }" />
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--sp-1);
}

label {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

input {
  height: var(--control-h-lg);
  padding: 0 var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

input:focus-visible {
  outline-offset: 0;
}

input.invalid {
  border-color: var(--c-down);
}
</style>
