<!-- 숫자 덩어리: 이름표 → 큰 숫자 → 보조 설명 (요약 열·패널 첫머리). size: sm 보조 · md 요약 열 · lg 화면 핵심 숫자 -->
<script setup lang="ts">
import BaseNumber from '@/components/base/BaseNumber.vue'

withDefaults(defineProps<{
  /** 패널 제목·설명에 이미 같은 말이 있으면 생략 (대시보드 카드) */
  label?: string
  value: number | null | undefined
  digits?: number
  unit?: string
  /** 큰 숫자 뒤 작은 글 (예: "/ 200") */
  suffix?: string
  sub?: string
  size?: 'sm' | 'md' | 'lg'
  /** 숫자 대신 보일 글 (예: 지속시간 2:48). 있으면 value 대신 쓴다 */
  text?: string
}>(), { digits: 0, size: 'md' })
</script>

<template>
  <div class="fig" :class="size">
    <div v-if="label" class="label">{{ label }}</div>
    <div class="value"><template v-if="text != null">{{ text }}</template><BaseNumber v-else :value="value" :digits="digits" :unit="unit" :suffix="suffix" /></div>
    <div v-if="sub || $slots.sub" class="sub"><slot name="sub">{{ sub }}</slot></div>
  </div>
</template>

<style scoped>
.label {
  color: var(--c-ink-2);
  font-size: var(--fs-figure);
}

/* 값은 이름과 같은 크기, 굵기·진한 색으로만 구분한다 (sm·md) */
.value {
  font-size: var(--fs-figure);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

/* 화면·카드의 대표 숫자(lg)만 이름보다 한 단계 크게 (대시보드 기준, 모든 화면) */
.lg .value {
  font-size: var(--fs-lg);
}

.sub {
  margin-top: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}
</style>
