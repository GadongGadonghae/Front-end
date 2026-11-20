<!-- 여러 줄 글자 입력: 위에 이름표(+ 보조 글), 테두리 입력칸. 높이는 rows 줄, 세로로만 늘릴 수 있다 -->
<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  label: string
  /** 이름표 옆 흐린 글 (무엇에 대한 입력인지) */
  hint?: string
  rows?: number
  placeholder?: string
}>(), { hint: '', rows: 3, placeholder: '' })
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}<span v-if="hint" class="hint">{{ hint }}</span></label>
    <textarea :id="id" v-model="model" :rows="rows" :placeholder="placeholder" />
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--sp-1);
}

label {
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.hint {
  margin-left: var(--sp-2);
  color: var(--c-ink-3);
  font-weight: var(--fw-regular);
}

textarea {
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-md);
  line-height: var(--lh-body);
  resize: vertical;
}

textarea::placeholder {
  color: var(--c-ink-3);
}

textarea:focus-visible {
  outline-offset: 0;
}
</style>
