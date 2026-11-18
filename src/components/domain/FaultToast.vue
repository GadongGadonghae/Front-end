<!-- 고장 토스트: 고장(D) 발생 때 화면 우하단. 먹색 바탕, 화면에서 그림자를 쓰는 유일한 요소 (DESIGN.md Components) -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'
import StatusKey from '@/components/domain/StatusKey.vue'

defineProps<{ equipmentName: string; codeName: string; detail: string | null; time: string }>()
const emit = defineEmits<{ view: []; dismiss: [] }>()
</script>

<template>
  <div class="toast" role="alert">
    <StatusKey state="D" size="sm" />
    <div class="text">
      <b>{{ equipmentName }} · {{ codeName }}</b>
      <p>{{ detail ? `${detail} · ` : '' }}{{ time }}</p>
    </div>
    <button class="view" type="button" @click="emit('view')">보기</button>
    <button class="close" type="button" aria-label="닫기" @click="emit('dismiss')"><BaseIcon name="x" :size="16" /></button>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  right: var(--sp-8);
  bottom: var(--sp-8);
  z-index: 20;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--sp-3);
  width: var(--toast-w);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-3);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
  box-shadow: var(--shadow-float);
  animation: enter var(--dur-enter) var(--ease-out);
}

b {
  font-weight: var(--fw-strong);
}

p {
  color: var(--c-inverse-ink-2);
  font-size: var(--fs-md);
}

.view {
  height: var(--control-h-sm);
  padding: 0 var(--sp-3);
  border: 0;
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  cursor: pointer;
}

.close {
  display: grid;
  place-items: center;
  border: 0;
  background: none;
  color: var(--c-inverse-ink-2);
  cursor: pointer;
}

@keyframes enter {
  from { opacity: 0; transform: translateY(var(--sp-2)); }
}
</style>
