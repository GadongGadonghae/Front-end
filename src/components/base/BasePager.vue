<!-- 페이지 넘김 (50건씩): "802건 중 1~50" + 이전 · 쪽 번호(앞뒤 몇 개) · 다음 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ total: number; size: number }>()
const page = defineModel<number>({ required: true })

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
/** 1 … 4 5 [6] 7 8 … 17 */
const shown = computed<(number | '…')[]>(() => {
  const n = pages.value
  const p = page.value
  const set = new Set([1, n, p - 2, p - 1, p, p + 1, p + 2].filter((x) => x >= 1 && x <= n))
  const list = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  list.forEach((x, i) => {
    if (i && x - list[i - 1] > 1) out.push('…')
    out.push(x)
  })
  return out
})
const from = computed(() => (props.total ? (page.value - 1) * props.size + 1 : 0))
const to = computed(() => Math.min(props.total, page.value * props.size))
</script>

<template>
  <nav class="pager" aria-label="페이지">
    <span class="info">{{ total.toLocaleString('ko-KR') }}건 중 {{ from }}~{{ to }}</span>
    <button type="button" :disabled="page <= 1" @click="page -= 1">이전</button>
    <template v-for="(x, i) in shown" :key="i">
      <span v-if="x === '…'" class="gap">…</span>
      <button v-else type="button" :class="{ on: x === page }" :aria-current="x === page ? 'page' : undefined" @click="page = x">{{ x }}</button>
    </template>
    <button type="button" :disabled="page >= pages" @click="page += 1">다음</button>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-1);
  padding-top: var(--sp-3);
  border-top: var(--line-w) solid var(--c-line);
}

.info {
  margin-right: auto;
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

button {
  min-width: var(--control-h-sm);
  height: var(--control-h-sm);
  padding: 0 var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font: inherit;
  font-size: var(--fs-label);
  cursor: pointer;
}

button:disabled {
  color: var(--c-ink-3);
  cursor: default;
}

button:hover:not(:disabled) {
  background: var(--c-surface-sunk);
}

button.on {
  border-color: var(--c-inverse);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
  font-weight: var(--fw-strong);
}

.gap {
  padding: 0 var(--sp-1);
  color: var(--c-ink-3);
}
</style>
