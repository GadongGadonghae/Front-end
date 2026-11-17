<!-- 가로 막대 목록: 이름 · 막대 · 값 (· 보조). 비교용. 한 계열 안에서 색을 바꾸지 않고, 강조 행만 진하게.
     tone은 의미가 있을 때만 (비가동 코드별 시간 = 상태 색). marker: 세로 기준선 (예: 라인 계획) -->
<script setup lang="ts">
import { computed } from 'vue'

export interface BarRow {
  key: string
  label: string
  value: number | null
  /** 오른쪽에 보일 값 글 (없으면 숫자 그대로) */
  display?: string
  /** 맨 오른쪽 흐린 보조 (예: 2건) */
  sub?: string
  /** 강조 행 (예: 가장 낮음) */
  strong?: boolean
  /** 0건 등 흐리게 */
  muted?: boolean
  tone?: 'ink' | 'run' | 'stop' | 'idle' | 'down'
}

const props = withDefaults(defineProps<{
  rows: BarRow[]
  max?: number
  marker?: number
  label: string
  thick?: boolean
  /** 행을 누를 수 있게 (예: 라인 막대를 누르면 그 라인으로 거르기) */
  clickable?: boolean
  /** 2: 넓은 칸에서 목록을 두 열로 (위에서 아래로 읽고 오른쪽 열로 이어짐). 높이가 모자랄 때 */
  columns?: 1 | 2
}>(), { thick: false, clickable: false, columns: 1 })

const emit = defineEmits<{ pick: [row: BarRow] }>()
function onKey(e: KeyboardEvent, r: BarRow) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('pick', r) }
}

const top = computed(() => props.max ?? Math.max(1, ...props.rows.map((r) => r.value ?? 0), props.marker ?? 0))
const pct = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / top.value) * 100))}%`
const hasSub = computed(() => props.rows.some((r) => r.sub))
/** 두 열일 때 행의 자리: 앞 절반은 왼쪽 열, 나머지는 오른쪽 열 */
const half = computed(() => Math.ceil(props.rows.length / 2))
const place = (i: number) => {
  if (props.columns !== 2) return undefined
  const n = hasSub.value ? 4 : 3
  return { gridRow: String((i % half.value) + 1), gridColumn: `${i < half.value ? 1 : n + 2} / span ${n}` }
}
</script>

<template>
  <ul class="bars" :class="{ thick, 'has-sub': hasSub, two: columns === 2 }" :aria-label="label">
    <li
      v-for="(r, i) in rows"
      :key="r.key"
      :class="{ strong: r.strong, muted: r.muted, click: clickable }"
      :style="place(i)"
      :role="clickable ? 'button' : undefined"
      :tabindex="clickable ? 0 : undefined"
      @click="clickable && emit('pick', r)"
      @keydown="clickable && onKey($event, r)"
    >
      <span class="name"><slot name="lead" :row="r" />{{ r.label }}</span>
      <span class="track">
        <i :class="`t-${r.tone ?? 'ink'}`" :style="{ width: pct(r.value) }"></i>
        <b v-if="marker != null" class="marker" :style="{ left: pct(marker) }"></b>
      </span>
      <span class="val">{{ r.display ?? (r.value ?? '-') }}</span>
      <span v-if="hasSub" class="sub">{{ r.sub }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* 목록 전체가 한 격자: 이름 길이가 달라도 막대 시작·값 열이 모든 행에서 맞는다 (행은 subgrid) */
.bars {
  display: grid;
  flex: 1;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  align-content: space-around;
  gap: var(--sp-2) var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars.has-sub {
  grid-template-columns: max-content minmax(0, 1fr) max-content max-content;
}

/* 두 열: 같은 칸 구성을 옆에 한 번 더, 사이에 빈 칸 하나 (두 열을 떼어 놓는다) */
.bars.two {
  grid-template-columns: max-content minmax(0, 1fr) max-content var(--sp-5) max-content minmax(0, 1fr) max-content;
}

.bars.two.has-sub {
  grid-template-columns: max-content minmax(0, 1fr) max-content max-content var(--sp-5) max-content minmax(0, 1fr) max-content max-content;
}

li {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
}

.name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

.track {
  position: relative;
  height: var(--bar-h);
  border-radius: var(--r-1);
  background: var(--c-track);
}

.thick .track {
  height: var(--bar-h-lg);
}

.track i {
  display: block;
  height: 100%;
  border-radius: var(--r-1);
}

.t-ink { background: var(--c-ink-2); }
.t-run { background: var(--c-run); }
.t-stop { background: var(--c-stop-solid); }
.t-idle { background: var(--c-idle); }
.t-down { background: var(--c-down); }

.marker {
  position: absolute;
  top: calc(var(--sp-1) * -1);
  bottom: calc(var(--sp-1) * -1);
  border-left: var(--indicator-w) solid var(--c-ink);
}

.val {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  text-align: right;
  white-space: nowrap;
}

.sub {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  text-align: right;
}

.strong .t-ink {
  background: var(--c-ink);
}

.strong .name {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.muted,
.muted .val {
  color: var(--c-ink-3);
}

li.click {
  border-radius: var(--r-1);
  cursor: pointer;
}

li.click:hover .name {
  color: var(--c-ink);
  text-decoration: underline;
}
</style>
