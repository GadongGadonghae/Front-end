<!-- 상태 열쇠 칸: 색 칸 안에 코드 글자(R/S/I/D), 옆에 명칭이나 글 (DESIGN.md Components "상태 열쇠 칸")
     색만으로 상태를 말하지 않는다 → 칸 안 글자는 항상 표시 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { StateCode } from '@/types/state'
import { STATE_NAME } from '@/lib/status'

const props = withDefaults(defineProps<{
  state: StateCode
  /** sm: 표 안 · md: 목록·범례 · lg: 대표 상태 */
  size?: 'sm' | 'md' | 'lg'
  /** true면 상태 명칭(가동·정지…), 문자열이면 그 글, 없으면 칸만 */
  label?: boolean | string
  /** 해제된 항목: 흐리게 */
  muted?: boolean
}>(), { size: 'md', label: false, muted: false })

const text = computed(() => (props.label === true ? STATE_NAME[props.state] : props.label || ''))
</script>

<template>
  <span class="status" :class="[size, { muted }]">
    <span class="key" :class="`st-${state}`" :aria-label="text ? undefined : STATE_NAME[state]">{{ state }}</span>
    <span v-if="text" class="text">{{ text }}</span>
  </span>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

.key {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: var(--key-md);
  height: var(--key-md);
  border-radius: var(--r-1);
  font-size: var(--fs-body);
  font-weight: var(--fw-code);
  line-height: 1;
}

.sm .key {
  width: var(--key-sm);
  height: var(--key-sm);
  font-size: var(--fs-caption);
}

.lg .key {
  width: var(--key-lg);
  height: var(--key-lg);
  border-radius: var(--r-2);
  font-size: var(--fs-heading);
}

.lg .text {
  font-size: var(--fs-figure-sm);
  font-weight: var(--fw-strong);
}

/* 해제됨: 색을 빼고 상태 색 테두리 + 흐린 먹 글자. 글자 대비 4.5:1 이상 유지 (WCAG 1.4.3, 불투명도로 흐리게 하지 않음) */
.muted .key {
  background: transparent;
  color: var(--c-ink-3);
  box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-line-ink);
}

.muted .key.st-R { box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-run); }
.muted .key.st-I { box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-idle-edge); }
.muted .key.st-D { box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-down); }

.muted .text {
  color: var(--c-ink-3);
}
</style>
