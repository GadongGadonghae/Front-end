<!-- 게이지: 0~100% 값 하나를 240° 호로 (대시보드 종합 가동률, D-118). 가운데에 큰 숫자(슬롯)
     막대 대신 쓰는 단일 지표 모양 (ui-ux-pro-max chart: 목표가 있는 단일 KPI → 게이지). 색은 먹색 하나 (OEE 다리와 같은 OEE 색) -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: number | null | undefined; label: string }>()

const CX = 60
const CY = 60
const R = 50
const START = 150
const SWEEP = 240
const pt = (deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`
}
const arc = (sweep: number) => `M ${pt(START)} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${pt(START + sweep)}`
const track = arc(SWEEP)
const fill = computed(() => {
  const v = props.value
  if (v == null || v <= 0) return null
  return arc(Math.min(SWEEP - 0.01, (SWEEP * Math.min(100, v)) / 100))
})
</script>

<template>
  <div class="gauge">
    <svg viewBox="0 0 120 100" role="img" :aria-label="label">
      <path :d="track" class="track" />
      <path v-if="fill" :d="fill" class="fill" />
    </svg>
    <div class="c"><slot /></div>
  </div>
</template>

<style scoped>
.gauge {
  position: relative;
  flex: none;
  width: var(--gauge-size);
}

svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

path {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}

.track { stroke: var(--c-track); }
.fill { stroke: var(--c-ink); }

/* 가운데 숫자: 호의 중심 (위에서 60%) */
.c {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  padding-top: 14%;
}
</style>
