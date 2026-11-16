<!-- 숫자 표시: 천 단위 쉼표, 단위는 작게, 값이 없으면 "-" (D-78). tabular-nums는 전역 -->
<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/lib/format'

const props = withDefaults(defineProps<{ value: number | null | undefined; digits?: number; unit?: string; suffix?: string }>(), { digits: 0 })
const text = computed(() => formatNumber(props.value, props.digits))
const empty = computed(() => props.value == null || Number.isNaN(props.value))
</script>

<template>
  <span class="num">{{ text }}<small v-if="unit && !empty" class="unit">{{ unit }}</small><small v-if="suffix" class="suffix">{{ suffix }}</small></span>
</template>

<style scoped>
.num {
  white-space: nowrap;
}

.unit,
.suffix {
  margin-left: 0.15em;
  color: var(--c-ink-2);
  font-size: 0.5em;
  font-weight: var(--fw-regular);
  letter-spacing: 0;
}

.suffix {
  margin-left: 0.3em;
}
</style>
