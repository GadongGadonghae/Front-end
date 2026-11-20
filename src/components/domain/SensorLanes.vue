<!-- 예지보전 센서별 오늘 이력: 센서마다 한 줄 띠 (정상 회색 · 주의 노랑 · 위험 빨강 점선 · 고장 빨강 · 값 없음 비움)
     아래에 등급이 바뀐 시각 (최근 순) -->
<script setup lang="ts">
type LaneGrade = 'normal' | 'warn' | 'danger' | 'down' | 'none'

defineProps<{
  rows: { key: string; label: string; percentText: string; segs: { grade: LaneGrade; left: number; width: number }[] }[]
  axis: string[]
  events: { key: string; time: string; grade: LaneGrade; text: string }[]
  selected: string
}>()
defineEmits<{ select: [key: string] }>()

const WORD: Record<LaneGrade, string> = { normal: '정상', warn: '주의', danger: '위험', down: '고장', none: '-' }
</script>

<template>
  <div class="lanes">
    <button v-for="r in rows" :key="r.key" type="button" :class="['row', { on: r.key === selected }]" :aria-pressed="r.key === selected" @click="$emit('select', r.key)">
      <span class="nm">{{ r.label }}</span>
      <span class="band" role="img" :aria-label="`${r.label} 오늘 이력: ${r.segs.filter((s) => s.grade !== 'none').map((s) => WORD[s.grade]).join(', ')}`">
        <i v-for="(s, i) in r.segs" :key="i" :class="s.grade" :style="{ left: `${s.left}%`, width: `${s.width}%` }"></i>
      </span>
      <span class="pc">{{ r.percentText }}</span>
    </button>
    <div class="axis"><span></span><span class="ticks"><span v-for="a in axis" :key="a">{{ a }}</span></span><span></span></div>
    <ul class="key">
      <li><i class="normal"></i>정상</li>
      <li><i class="warn"></i>주의</li>
      <li><i class="danger"></i>위험</li>
      <li><i class="down"></i>고장</li>
    </ul>
    <ul v-if="events.length" class="ev" aria-label="바뀐 시각">
      <li v-for="e in events" :key="e.key"><time>{{ e.time }}</time><span :class="['tag', e.grade]">{{ WORD[e.grade] }}</span>{{ e.text }}</li>
    </ul>
  </div>
</template>

<style scoped>
.lanes {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.row,
.axis {
  display: grid;
  grid-template-columns: calc(var(--sp-8) * 3) minmax(0, 1fr) calc(var(--sp-8) + var(--sp-4));
  gap: var(--sp-3);
  align-items: center;
}

.row {
  padding: var(--sp-1) var(--sp-2);
  border: 0;
  border-bottom: var(--line-w) solid var(--c-line);
  background: none;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  text-align: left;
  cursor: pointer;
}

.row:hover { background: var(--c-surface-sunk); }
.row.on { background: var(--c-surface-sunk); font-weight: var(--fw-strong); }

.nm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.band {
  position: relative;
  height: var(--sp-4);
  overflow: hidden;
  border-radius: var(--r-1);
}

.band i {
  position: absolute;
  top: 0;
  bottom: 0;
  box-sizing: border-box;
}

.normal { background: var(--c-track); }
.warn { background: var(--c-idle); }
.danger { border: var(--line-w-strong) dashed var(--c-down); background: var(--c-down-tint); }
.down { background: var(--c-down); }
.none { background: none; }

.axis {
  padding: var(--sp-1) var(--sp-2) 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.ticks {
  display: flex;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}

.key,
.ev {
  margin: 0;
  padding: 0;
  list-style: none;
}

.key {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-2) var(--sp-2) 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.key li {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

.key i {
  display: inline-block;
  box-sizing: border-box;
  width: var(--sp-4);
  height: var(--sp-3);
  border-radius: 2px;
}

.ev {
  margin-top: var(--sp-3);
  font-size: var(--fs-sm);
}

.ev li {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border-bottom: var(--line-w) solid var(--c-line);
}

.ev time {
  color: var(--c-ink-2);
  font-variant-numeric: tabular-nums;
}

.tag {
  padding: 0 var(--sp-1);
  border: var(--line-w-strong) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  font-weight: var(--fw-strong);
}

.tag.warn { border-color: var(--c-idle-edge); color: var(--c-caution-ink); }
.tag.danger { border-style: dashed; border-color: var(--c-down); color: var(--c-down); }
.tag.down { border-color: var(--c-down); background: var(--c-down); color: var(--c-down-ink); }
</style>
