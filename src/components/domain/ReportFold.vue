<!-- AI 리포트 왼쪽 칸의 접고 펼치는 묶음 (11/22): 제목 줄을 누르면 펼쳐진다
     alert: 접혀 있어도 처리할 건이 있다는 것을 빨간 수로 알린다 -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'

defineProps<{ title: string; count?: number; alert?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <section class="rf" :class="{ open }">
    <h2>
      <button type="button" :aria-expanded="open" @click="open = !open">
        <BaseIcon class="arrow" name="chevron-right" :size="20" />
        <span class="t">{{ title }}</span>
        <span v-if="count" class="n" :class="{ alert }">{{ count }}</span>
      </button>
    </h2>
    <div v-show="open" class="in"><slot /></div>
  </section>
</template>

<style scoped>
.rf + .rf { border-top: var(--line-w) solid var(--c-line-strong); }

h2 {
  position: sticky;
  z-index: 1;
  top: 0;
  margin: 0;
}

button {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-4) var(--sp-5) var(--sp-4) var(--sp-4);
  border: 0;
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: 18px;
  font-weight: var(--fw-strong);
  text-align: left;
  cursor: pointer;
}

button:hover { background: var(--c-surface-sunk); }

.arrow {
  color: var(--c-ink-2);
  transition: transform var(--dur-fast) var(--ease-out);
}

.open .arrow { transform: rotate(90deg); }

.t { flex: 1; }

.n {
  min-width: 26px;
  padding: 2px var(--sp-2);
  border-radius: 999px;
  background: var(--c-track);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  text-align: center;
}

.n.alert {
  background: var(--c-down);
  color: var(--c-down-ink);
}

.in { padding-bottom: var(--sp-3); }
</style>
