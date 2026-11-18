<!-- 세로 막대 + 기준 점선 (SCR-011 4번 주·월: 일별 실적 막대 vs 계획선). 막대는 중립, 마지막(오늘) 막대만 강조 파랑 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatNumber } from '@/lib/format'

const props = withDefaults(defineProps<{
  label: string
  /** 칸 수 (기간 일수). values는 앞에서부터 채운다 */
  count: number
  values: (number | null)[]
  labels: string[]
  yTicks: number[]
  refValue?: number | null
  refLabel?: string
  /** 몇 칸마다 아래 글자를 쓸지 */
  every?: number
  highlightLast?: boolean
}>(), { refValue: null, every: 1, highlightLast: true })

const box = ref<HTMLElement | null>(null)
const w = ref(0)
const h = ref(0)
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => { w.value = e.contentRect.width; h.value = e.contentRect.height })
  ro.observe(box.value!)
})
onBeforeUnmount(() => ro?.disconnect())

const P = { l: 44, r: 12, t: 10, b: 24 }
const top = computed(() => props.yTicks.at(-1) ?? 1)
const slot = computed(() => (w.value - P.l - P.r) / Math.max(1, props.count))
const Y = (v: number) => P.t + (1 - v / top.value) * (h.value - P.t - P.b)
const lastIdx = computed(() => props.values.reduce<number>((a, v, i) => (v != null ? i : a), -1))
</script>

<template>
  <div ref="box" class="chart">
    <svg v-if="w && h" :width="w" :height="h" role="img" :aria-label="label">
      <g v-for="v in yTicks" :key="v">
        <line class="grid" :x1="P.l" :x2="w - P.r" :y1="Y(v)" :y2="Y(v)" />
        <text class="tick" :x="P.l - 8" :y="Y(v) + 4" text-anchor="end">{{ formatNumber(v) }}</text>
      </g>
      <rect
        v-for="(v, i) in values"
        v-show="v != null"
        :key="i"
        :class="['col', { last: highlightLast && i === lastIdx }]"
        :x="P.l + i * slot + slot * 0.2"
        :y="Y(v ?? 0)"
        :width="Math.max(2, slot * 0.6)"
        :height="Math.max(0, Y(0) - Y(v ?? 0))"
      ><title>{{ labels[i] }} {{ formatNumber(v) }}</title></rect>
      <template v-for="(l, i) in labels" :key="`x${i}`">
        <text v-if="i % every === 0" class="tick" :x="P.l + i * slot + slot / 2" :y="h - 6" text-anchor="middle">{{ l }}</text>
      </template>
      <line v-if="refValue != null" class="ref" :x1="P.l" :x2="w - P.r" :y1="Y(refValue)" :y2="Y(refValue)" />
    </svg>
  </div>
</template>

<style scoped>
.chart {
  flex: 1;
  min-width: 0;
  min-height: var(--chart-min-h);
}

svg {
  display: block;
}

.grid { stroke: var(--c-line); }
.tick { fill: var(--c-ink-3); font-size: var(--fs-sm); }
.col { fill: var(--c-ink-3); }
.col.last { fill: var(--c-accent); }
.ref { stroke: var(--c-ink-2); stroke-width: var(--line-w-strong); stroke-dasharray: 4 4; }
</style>
