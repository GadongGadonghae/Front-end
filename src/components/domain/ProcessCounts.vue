<!-- 공정별 지금 제품 수 한 줄 (생산 조회 공정 중 추적, D-107 시안 G4): 슬리팅 › 프레스 › 용접 › 도장 › 비전 검사.
     설비 고장으로 멈춘 제품이 있는 공정은 옅은 빨강 바탕 + 빨간 숫자 + "멈춤 N" 글자 -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'
import type { ProcessCountView } from '@/types/view'

defineProps<{ items: ProcessCountView[] }>()
</script>

<template>
  <ol class="counts" aria-label="공정별 지금 제품 수">
    <li v-for="(c, i) in items" :key="c.key" :class="{ stuck: c.stuck }">
      <BaseIcon v-if="i" class="arr" name="chevron-right" :size="16" />
      <span class="nm"><span class="pn"><i class="sw" :style="{ background: `color-mix(in srgb, var(--c-proc-${i + 1}) 50%, var(--c-surface))` }"></i>{{ c.label }}</span><small v-if="c.stuck">고장으로 멈춤 {{ c.stuck }}</small></span>
      <b>{{ c.count }}</b>
    </li>
  </ol>
</template>

<style scoped>
.counts {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: var(--sp-4);
  margin: 0 0 var(--sp-4);
  padding: 0;
  list-style: none;
}

li {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-2);
  background: var(--c-surface-sunk);
}

/* 공정 사이 흐름 표시: 칸 사이 틈 가운데 */
.arr {
  position: absolute;
  top: 50%;
  left: calc(var(--sp-4) / -2);
  color: var(--c-ink-3);
  transform: translate(-50%, -50%);
}

.pn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.sw {
  width: var(--sp-3);
  height: var(--sp-3);
  border-radius: var(--r-1);
}

.nm {
  display: flex;
  flex-direction: column;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

small {
  color: var(--c-down);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

b {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.stuck {
  background: var(--c-down-tint);
  box-shadow: inset 0 0 0 var(--line-w) color-mix(in srgb, var(--c-down) 30%, transparent);
}

.stuck b {
  color: var(--c-down);
}
</style>
