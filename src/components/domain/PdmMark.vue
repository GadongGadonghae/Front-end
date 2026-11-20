<!-- 예지보전 표시 (D-77): 칸 바깥 테두리와 같은 말. 주의 = 노랑 실선, 위험 = 빨강 점선
     tile: 알림 열에서 테두리 칸 안에 "위험"/"주의" · swatch: 범례의 빈 테두리 칸 -->
<script setup lang="ts">
import type { PdmLevel } from '@/types/state'

withDefaults(defineProps<{ level: PdmLevel; variant?: 'tile' | 'swatch'; muted?: boolean }>(), { variant: 'tile', muted: false })
</script>

<template>
  <span v-if="variant === 'tile'" class="tile" :class="[level, { muted }]">{{ level === 'danger' ? '위험' : '주의' }}</span>
  <span v-else class="swatch" :class="level" aria-hidden="true"></span>
</template>

<style scoped>
.tile {
  display: inline-grid;
  place-items: center;
  height: var(--key-md);
  padding: 0 var(--sp-2);
  border-radius: var(--r-1);
  font-size: var(--fs-sm);
  font-weight: var(--fw-code);
  white-space: nowrap;
}

.tile.danger {
  box-shadow: inset 0 0 0 var(--indicator-w) var(--c-down);
  color: var(--c-down);
}

.tile.warn {
  box-shadow: inset 0 0 0 var(--indicator-w) var(--c-idle-edge);
  color: var(--c-caution-ink);
}

/* 해제됨: 테두리는 남기고 글자만 흐린 먹 (불투명도로 흐리게 하지 않음, 대비 4.5:1 이상) */
.tile.muted {
  color: var(--c-ink-3);
}

.swatch {
  display: inline-block;
  flex: none;
  width: var(--sp-4);
  height: var(--sp-4);
  border-radius: var(--r-1);
}

.swatch.warn {
  border: var(--indicator-w) solid var(--c-idle-edge);
}

.swatch.danger {
  border: var(--indicator-w) dashed var(--c-down);
}
</style>
