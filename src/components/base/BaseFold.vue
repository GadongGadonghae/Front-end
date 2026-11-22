<!-- 접힌 설명 (11/22): 단추만 보이다가 누르면 오른쪽으로 펼쳐진다 (3D 조작 방법 · 예지보전 · 제품 이력 설명) -->
<script setup lang="ts">
import { ref, useId } from 'vue'
import BaseIcon from '@/components/base/BaseIcon.vue'

defineProps<{ label: string; text: string }>()
const open = ref(false)
const id = useId()
</script>

<template>
  <div class="fold" :class="{ open }">
    <button type="button" :aria-expanded="open" :aria-controls="id" @click="open = !open">
      {{ label }}<BaseIcon :name="open ? 'chevron-left' : 'chevron-right'" :size="16" />
    </button>
    <div :id="id" class="body" :aria-hidden="!open">
      <p :title="text">{{ text }}</p>
    </div>
  </div>
</template>

<style scoped>
.fold {
  display: inline-grid;
  grid-template-columns: auto 0fr;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  font-size: var(--fs-sm);
  transition: grid-template-columns var(--dur-enter) var(--ease-out);
}

.fold.open { grid-template-columns: auto 1fr; }

button {
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--control-h-sm);
  padding: 0 var(--sp-1) 0 var(--sp-3);
  border: 0;
  background: none;
  color: var(--c-ink-2);
  font: inherit;
  font-weight: var(--fw-strong);
  white-space: nowrap;
  cursor: pointer;
}

button:hover { background: var(--c-surface-sunk); }

.body {
  min-width: 0;
  overflow: hidden;
  color: var(--c-ink-2);
  line-height: var(--control-h-sm);
}

.body p {
  margin: 0;
  padding: 0 var(--sp-3) 0 var(--sp-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 접혀 있을 때는 글이 읽히지 않게 (화면 낭독기·선택) */
.fold:not(.open) .body { visibility: hidden; }
</style>
