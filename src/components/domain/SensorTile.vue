<!-- 예지보전 센서 카드: 이름 · 출처 → 지금 값 · 위험도 → 1시간 미니 그래프 → 기준 · 1시간 변화
     주의 = 노랑 실선 테두리, 위험 = 빨강 점선 테두리 + 고장 바탕 (DESIGN.md 예지보전 표시). 글자로 "주의"·"위험"을 같이 쓴다 -->
<script setup lang="ts">
import ChartSpark from '@/components/charts/ChartSpark.vue'

export interface SensorTileView {
  key: string
  label: string
  sourceLabel: string
  value: string
  unit: string
  grade: 'danger' | 'warn' | 'normal' | 'unset'
  percentText: string
  rangeText: string
  changeText: string
  spark: { points: [number, number][]; x: [number, number]; y: [number, number]; lines: number[] }
}

defineProps<{ tile: SensorTileView; selected: boolean }>()
defineEmits<{ select: [key: string] }>()
</script>

<template>
  <button type="button" :class="['tile', tile.grade, { on: selected }]" :aria-pressed="selected" @click="$emit('select', tile.key)">
    <span class="t1"><span class="nm">{{ tile.label }}</span><span class="src">{{ tile.sourceLabel }}</span></span>
    <span class="t2">
      <b class="v">{{ tile.value }}</b><span class="u">{{ tile.unit }}</span>
      <span :class="['pc', tile.grade]">{{ tile.percentText }}</span>
    </span>
    <ChartSpark :points="tile.spark.points" :x="tile.spark.x" :y="tile.spark.y" :lines="tile.spark.lines" />
    <span class="t3"><span>{{ tile.rangeText }}</span><span>{{ tile.changeText }}</span></span>
  </button>
</template>

<style scoped>
/* 작은 카드: 미니 그래프 낮게 */
.tile {
  --spark-h: var(--sp-6);

  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--sp-1) var(--sp-2);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tile:hover { background: var(--c-surface-sunk); }

.tile.warn { border: var(--line-w-strong) solid var(--c-idle-edge); }

.tile.danger {
  border: var(--line-w-strong) dashed var(--c-down);
  background: var(--c-down-tint);
}

.tile.on { outline: var(--line-w-strong) solid var(--c-accent); outline-offset: var(--sp-1); }

.t1,
.t3 {
  display: flex;
  gap: var(--sp-2);
  justify-content: space-between;
  min-width: 0;
}

.nm {
  overflow: hidden;
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.src,
.t3 {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  white-space: nowrap;
}

.t2 {
  display: flex;
  align-items: baseline;
  gap: var(--sp-1);
  font-variant-numeric: tabular-nums;
}

.v {
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

.u {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.pc {
  margin-left: auto;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.pc.warn { color: var(--c-caution-ink); }
.pc.danger { color: var(--c-down); }
</style>
