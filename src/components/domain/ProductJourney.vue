<!-- 제품 여정 시간표 (생산 조회 공정 중 추적, D-107 시안 G4): 제품마다 한 줄, 가로 = 시각.
     공정마다 머문 구간을 굵은 칸으로 (칸 색 = 공정), 공정 사이 이동·대기는 가는 선.
     지금 처리 중 = 강조 파랑 테두리, 설비 고장으로 멈춤 = 빨강 칸 + 행 바탕 옅은 빨강, 불량 제외 = 먹색 칸.
     지금 이후는 옅은 면. 1초마다 지금 칸이 자라지만 깜빡이지 않는다 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { JourneyRowView } from '@/types/view'

const props = defineProps<{
  rows: JourneyRowView[]
  selected: string | null
  /** 보이는 시각 범위와 지금 (epoch ms) */
  from: number
  to: number
  now: number
}>()
const emit = defineEmits<{ pick: [id: string] }>()

const x = (ms: number) => `${(Math.max(0, Math.min(1, (ms - props.from) / (props.to - props.from))) * 100).toFixed(3)}%`
const w = (a: number, b: number) => `${(Math.max(0, (Math.min(b, props.to) - Math.max(a, props.from)) / (props.to - props.from)) * 100).toFixed(3)}%`

/** 눈금: 10개 안쪽이 되게 1분 ~ 2시간 중에서 */
const ticks = computed(() => {
  const span = (props.to - props.from) / 60_000
  const step = [1, 2, 5, 10, 15, 30, 60, 120].find((s) => span / s <= 10) ?? 120
  const out: { at: number; label: string }[] = []
  const first = Math.ceil(props.from / (step * 60_000)) * step * 60_000
  for (let t = first; t <= props.to; t += step * 60_000) {
    const d = new Date(t)
    out.push({ at: t, label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
  }
  return out
})
const gaps = (r: JourneyRowView) => r.lanes.slice(1).map((l, i) => ({ a: r.lanes[i].to, b: l.from })).filter((g) => g.b > g.a)
</script>

<template>
  <div class="journey">
    <div class="grid head">
      <span>제품 ID</span>
      <span>지금 위치</span>
      <span class="ticks">
        <b v-for="t in ticks" :key="t.at" :style="{ left: x(t.at) }">{{ t.label }}</b>
      </span>
    </div>
    <div class="rows">
      <button
        v-for="r in rows"
        :key="r.id"
        type="button"
        class="grid row"
        :class="[r.state ? `st-${r.state}` : '', { sel: r.id === selected }]"
        :aria-pressed="r.id === selected"
        @click="emit('pick', r.id)"
      >
        <span class="id">{{ r.id }}</span>
        <span class="wh">{{ r.where }}</span>
        <span class="lane">
          <i class="future" :style="{ left: x(now), right: 0 }"></i>
          <span v-for="(g, i) in gaps(r)" :key="`g${i}`" class="gap" :style="{ left: x(g.a), width: w(g.a, g.b) }"></span>
          <i
            v-for="l in r.lanes"
            :key="l.step"
            :class="[`p${l.step}`, l.kind]"
            :style="{ left: x(l.from), width: w(l.from, l.to) }"
            :title="l.label"
          ></i>
          <span class="nowl" :style="{ left: x(now) }"></span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.journey {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.grid {
  display: grid;
  grid-template-columns: var(--journey-id-w) var(--journey-where-w) minmax(0, 1fr);
  gap: 0 var(--sp-4);
  align-items: center;
}

.head {
  padding-bottom: var(--sp-2);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.ticks {
  position: relative;
  height: 1.2em;
}

.ticks b {
  position: absolute;
  font-weight: var(--fw-regular);
  white-space: nowrap;
  transform: translateX(-50%);
}

.rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.row {
  flex: none;
  min-height: calc(var(--track-h-lg) + var(--sp-3));
  padding: 0 var(--sp-2);
  border: 0;
  border-bottom: var(--line-w) solid var(--c-line);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.row:hover {
  background-color: var(--c-surface-sunk);
}

/* 고른 줄: 가라앉은 면 + 네 변 가는 테두리 (CLAUDE.md, 왼쪽 띠 없음) */
.row.sel {
  border-radius: var(--r-2);
  background-color: var(--c-surface-sunk);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-ink-3);
}

/* 행 바탕 = 그 제품의 지금 상태 */
.st-stuck { background: var(--c-down-tint); }
.st-stuck.sel { background: var(--c-down-tint); }

.id {
  font-weight: var(--fw-strong);
}

.wh {
  overflow: hidden;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-stuck .wh {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.lane {
  position: relative;
  height: var(--track-h-lg);
}

.lane i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: var(--r-1);
}

.lane .future {
  top: calc(var(--sp-1) * -1);
  bottom: calc(var(--sp-1) * -1);
  border-radius: 0;
  background: var(--c-surface-sunk);
}

/* 칸 색 = 어느 공정인지 (머문 시간은 칸 길이) */
.p0 { --proc: var(--c-proc-1); }
.p1 { --proc: var(--c-proc-2); }
.p2 { --proc: var(--c-proc-3); }
.p3 { --proc: var(--c-proc-4); }
.p4 { --proc: var(--c-proc-5); }

.lane i.done { background: color-mix(in srgb, var(--proc) 50%, var(--c-surface)); }

/* 지금 처리 중: 그 공정 색을 옅게 + 파란 테두리 */
.lane .now {
  background: color-mix(in srgb, var(--proc) 18%, var(--c-surface));
  box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-accent);
}

.lane .stuck { background: var(--c-down); }
.lane .ng { background: var(--c-ink); }

.gap {
  position: absolute;
  top: calc(50% - 1px);
  height: 2px;
  background: var(--c-line-strong);
}

/* 지금 선: 줄 사이 틈까지 그어 한 줄처럼 이어지게 (실선). 첫 줄 위·끝 줄 아래로는 나가지 않는다 */
.nowl {
  position: absolute;
  top: calc(var(--sp-3) * -1);
  bottom: calc(var(--sp-3) * -1);
  z-index: 1;
  border-left: var(--indicator-w) solid var(--c-accent);
  transform: translateX(-50%);
}

.row:first-child .nowl {
  top: 0;
}

.row:last-child .nowl {
  bottom: 0;
}
</style>
