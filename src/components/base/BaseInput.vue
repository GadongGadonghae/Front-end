<!-- 글자 입력: 위에 이름표, 테두리 입력칸. 오류면 테두리를 고장 빨강으로
     hideLabel: 이름표를 화면에서 숨기고 읽기 프로그램에만 (조치 메모처럼 자리가 좁을 때). size sm = 버튼 높이 -->
<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  label: string
  type?: 'text' | 'password' | 'search'
  autocomplete?: string
  invalid?: boolean
  hideLabel?: boolean
  placeholder?: string
  size?: 'md' | 'lg'
  inputmode?: 'text' | 'numeric' | 'decimal'
}>(), { type: 'text', invalid: false, hideLabel: false, size: 'lg' })
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :aria-invalid="invalid || undefined"
      :class="[size, { invalid }]"
    />
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

input.md {
  height: var(--control-h);
}

input::placeholder {
  color: var(--c-ink-3);
}

input:focus-visible {
  outline-offset: 0;
}

input.invalid {
  border-color: var(--c-down);
}
</style>
