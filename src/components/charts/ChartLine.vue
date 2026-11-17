<!-- 시간축 선 그래프 (SVG 직접). 주 계열은 강조 파랑 하나, 나머지는 중립 (DESIGN.md "파랑 하나").
     기준선: 목표(점선) · 상하한(점선+이름) · 예지보전 80%(노랑)·90%(빨강). 구간 띠(미세정지 후보 등), 지금 시각 선, 끝점, 이탈 점
     크기는 담긴 칸에 맞춰 다시 그린다 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatNumber } from '@/lib/format'

export interface LineSeries { key: string; points: [number, number][]; kind?: 'main' | 'thin' | 'ref' }
export interface RefLine { value: number; kind: 'target' | 'limit' | 'warn' | 'danger'; label?: string }

const props = withDefaults(defineProps<{
  label: string
  x: [number, number]
  y: [number, number]
  xTicks: { value: number; label: string }[]
  yTicks: number[]
  series: LineSeries[]
  refLines?: RefLine[]
  bands?: { from: number; to: number }[]
  now?: number
  endDot?: boolean
  /** 주 계열에서 이 값보다 큰 점을 빨강 점으로 */
  over?: number
  yDigits?: number
}>(), { refLines: () => [], bands: () => [], endDot: false, yDigits: 0 })

const box = ref<HTMLElement | null>(null)
const w = ref(0)
const h = ref(0)
const pad = ref({ l: 52, b: 28 })
let ro: ResizeObserver | null = null

onMounted(() => {
  const el = box.value!
  const css = getComputedStyle(el)
  pad.value = { l: parseFloat(css.getPropertyValue('--chart-label-w')) || 52, b: parseFloat(css.getPropertyValue('--chart-axis-h')) || 28 }
  ro = new ResizeObserver(([e]) => { w.value = e.contentRect.width; h.value = e.contentRect.height })
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

const hasRefLabels = computed(() => props.refLines.some((l) => l.label))
const P = computed(() => ({ l: pad.value.l, r: hasRefLabels.value ? 72 : 12, t: 10, b: pad.value.b }))
const X = (v: number) => P.value.l + ((v - props.x[0]) / (props.x[1] - props.x[0])) * (w.value - P.value.l - P.value.r)
const Y = (v: number) => P.value.t + (1 - (v - props.y[0]) / (props.y[1] - props.y[0])) * (h.value - P.value.t - P.value.b)

/** 높이가 낮으면 y 눈금을 처음·끝만 */
const yTicksShown = computed(() => {
  const step = (h.value - P.value.t - P.value.b) / Math.max(1, props.yTicks.length - 1)
  return step < 18 ? [props.yTicks[0], props.yTicks[props.yTicks.length - 1]] : props.yTicks
})
const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join('')
const main = computed(() => props.series.find((s) => (s.kind ?? 'main') === 'main'))
const last = computed(() => main.value?.points.at(-1) ?? null)
const overPts = computed(() => (props.over == null || !main.value ? [] : main.value.points.filter(([, v]) => v > props.over!)))
const ready = computed(() => w.value > 0 && h.value > 0)
</script>

<template>
  <div ref="box" class="chart">
    <svg v-if="ready" :width="w" :height="h" role="img" :aria-label="label">
      <rect v-for="(b, i) in bands" :key="`b${i}`" class="band" :x="X(b.from)" :y="P.t" :width="Math.max(X(b.to) - X(b.from), 2)" :height="h - P.t - P.b" />
      <g v-for="v in yTicksShown" :key="`y${v}`">
        <line class="grid" :x1="P.l" :x2="w - P.r" :y1="Y(v)" :y2="Y(v)" />
        <text class="tick" :x="P.l - 8" :y="Y(v) + 4" text-anchor="end">{{ formatNumber(v, yDigits) }}</text>
      </g>
      <text v-for="t in xTicks" :key="`x${t.value}`" class="tick" :x="X(t.value)" :y="h - 8" text-anchor="middle">{{ t.label }}</text>
      <g v-for="(l, i) in refLines" :key="`r${i}`">
        <line :class="['ref', l.kind]" :x1="P.l" :x2="w - P.r" :y1="Y(l.value)" :y2="Y(l.value)" />
        <text v-if="l.label" class="ref-label" :x="w - P.r + 6" :y="Y(l.value) + 4">{{ l.label }}</text>
      </g>
      <line v-if="now != null" class="now" :x1="X(now)" :x2="X(now)" :y1="P.t" :y2="h - P.b" />
      <path v-for="s in series" :key="s.key" :class="['s', s.kind ?? 'main']" :d="path(s.points)" />
      <circle v-for="(p, i) in overPts" :key="`o${i}`" class="over" :cx="X(p[0])" :cy="Y(p[1])" r="3.5" />
      <circle v-if="endDot && last" class="dot" :cx="X(last[0])" :cy="Y(last[1])" :r="4" />
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
  overflow: visible;
}

.grid { stroke: var(--c-line); }
.tick { fill: var(--c-ink-3); font-size: var(--fs-caption); }
.ref-label { fill: var(--c-ink-2); font-size: var(--fs-caption); }
.ref { fill: none; stroke-width: var(--line-w); }

.ref.target,
.ref.limit { stroke: var(--c-ink-3); stroke-dasharray: 4 4; }
.ref.warn { stroke: var(--c-idle-edge); stroke-opacity: 0.6; }
.ref.danger { stroke: var(--c-down); stroke-opacity: 0.5; }
.now { stroke: var(--c-line-strong); }
.band { fill: var(--c-idle-tint); }
.s { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.s.main { stroke: var(--c-accent); stroke-width: var(--chart-stroke); }
.s.thin { stroke: var(--c-ink-2); stroke-width: var(--chart-stroke-thin); }
.s.ref { stroke: var(--c-ink-3); stroke-width: var(--chart-stroke-thin); stroke-dasharray: 4 4; }
.dot { fill: var(--c-accent); }
.over { fill: var(--c-down); }
</style>
