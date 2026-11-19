<!-- 기준 대비 막대: 가운데 눈금 = 기준, 오른쪽 = 높음(강조 파랑), 왼쪽 = 낮음(먹색), 차이가 클수록 길고 진하게 (lib/compare) -->
<script setup lang="ts">
import { computed } from 'vue'
import { compareColor, strength } from '@/lib/compare'

const props = defineProps<{ diff: number | null; span: number; label: string }>()
const bar = computed(() => {
  if (props.diff == null) return null
  return { side: props.diff < 0 ? 'down' : 'up', width: `${strength(props.diff, props.span) * 50}%`, color: compareColor(props.diff, props.span) }
})
</script>

<template>
  <span class="dv" role="img" :aria-label="label">
    <span class="base"></span>
    <i v-if="bar" :class="bar.side" :style="{ width: bar.width, background: bar.color }"></i>
  </span>
</template>

<style scoped>
.dv {
  position: relative;
  display: block;
  height: var(--bar-h-lg);
  border-radius: var(--r-1);
  background: var(--c-track);
}

.base {
  position: absolute;
  top: calc(var(--sp-1) * -1);
  bottom: calc(var(--sp-1) * -1);
  left: 50%;
  z-index: 1;
  border-left: var(--indicator-w) solid var(--c-ink-2);
}

i {
  position: absolute;
  top: 0;
  bottom: 0;
}

.down {
  right: 50%;
  border-radius: var(--r-1) 0 0 var(--r-1);
}

.up {
  left: 50%;
  border-radius: 0 var(--r-1) var(--r-1) 0;
}
</style>
