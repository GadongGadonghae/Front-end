<!-- 가동률 상태 줄 (SCR-003, D-108 시안 G, D-113 다듬기): 줄 = 이름 · OEE와 기준 대비(한 열) · 손실 시간 · 근무 시간 띠(일) 또는 날짜 칸(주·월).
     지금 고장·대기·통신 끊김인 줄만 바탕에 그 상태 색을 은은하게 (계획정지는 정상 계획이라 글자만). 누를 수 있는 줄은 아래 단계(설비별)로.
     줄이 4개 이상이면 패널 높이를 채우고, 3개 이하(도장·비전 검사)면 한 줄이 너무 커지지 않게 높이를 묶는다 -->
<script setup lang="ts">
import { computed } from 'vue'
import ChartDiverge from '@/components/charts/ChartDiverge.vue'
import StateBand from '@/components/domain/StateBand.vue'
import { compareColor, OEE_SPAN } from '@/lib/compare'
import { formatNumber, formatSpan } from '@/lib/format'
import { SHIFT_END, SHIFT_START } from '@/lib/shift'
import type { LedgerRowView } from '@/types/view'

const props = defineProps<{
  rows: LedgerRowView[]
  mode: 'day' | 'period'
  /** 첫 열 머리 (라인 · 설비) */
  nameHead: string
  /** OEE 열 머리 (예: OEE · 공장 79.4% 대비) */
  oeeHead: string
  /** 일: 기록이 있는 끝 (00:00부터 초) */
  until: number
  /** 주·월: 날짜 머리 */
  dayHead: { label: string; today: boolean }[]
  /** 날짜 칸 비교 기준 이름 (공장 · 라인) */
  baseName: string
}>()
const emit = defineEmits<{ pick: [key: string] }>()

const NOW_NAME = { S: '계획정지 중', I: '대기 중', D: '고장 중', DC: '통신 끊김' } as const
const DAY = 86_400
/** 띠 왼쪽 끝 = 근무 시작 09:00, 오른쪽 끝 = 18:00. 오늘 18시를 넘겨 돌고 있으면(잔업) 지금 시각까지 늘린다 (11/22, 예전 00~24시) */
const start = SHIFT_START
const end = computed(() => (props.until < DAY ? Math.max(SHIFT_END, Math.ceil(props.until / 3600) * 3600) : SHIFT_END))
const span = computed(() => end.value - start)
/** 눈금 간격: 근무 시간만이면 1시간, 길면 3시간 */
const step = computed(() => (span.value <= 12 * 3600 ? 3600 : 10_800))
const showNow = computed(() => props.until > start && props.until < end.value)
const hm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`
/** 시간 눈금 (띠 범위 안). StateBand의 눈금선과 같은 자리 */
const ticks = () => {
  const out: { at: number; label: string; end: boolean; begin: boolean }[] = []
  for (let t = start; t <= end.value; t += step.value) {
    // 지금 표시와 겹치는 눈금은 뺀다
    if (showNow.value && Math.abs(t - props.until) < span.value / 18) continue
    const h = t / 3600
    out.push({ at: t, label: `${String(h).padStart(2, '0')}시`, end: t === end.value, begin: t === start })
  }
  return out
}
const at = (sec: number) => `${((sec - start) / span.value) * 100}%`
const diffText = (d: number) => `${d > 0 ? '+' : ''}${formatNumber(d, 1)}`
const cell = (c: LedgerRowView['days'][number]) => {
  if (c.future || c.oee == null) return null
  const d = c.base == null ? 0 : c.oee - c.base
  // 가장 진해도 50%까지: 먹색 글자가 어느 칸에서나 AA(4.5:1)를 넘게 (흰 글자는 쓰지 않음, 먹색 50% 칸에서 약 4.9:1)
  return { bg: compareColor(d, OEE_SPAN, 10, 50), title: `${c.date} OEE ${formatNumber(c.oee, 1)}%${c.base != null ? ` (${props.baseName} 대비 ${diffText(d)})` : ''}` }
}
</script>

<template>
  <div class="ledger">
    <div class="cols head">
      <span>{{ nameHead }}</span>
      <span>{{ oeeHead }}</span>
      <span class="r">손실</span>
      <span v-if="mode === 'day'">상태</span>
      <span v-else class="days dayhead" :style="{ gridTemplateColumns: `repeat(${dayHead.length}, minmax(0, 1fr))` }">
        <span v-for="(d, i) in dayHead" :key="i" :class="{ today: d.today }">{{ d.label }}</span>
      </span>
    </div>

    <div class="rows" :class="{ few: rows.length <= 3 }" :style="rows.length <= 3 ? { height: `calc(${rows.length} * var(--ledger-row-max))` } : undefined">
      <component
        :is="r.clickable ? 'button' : 'div'"
        v-for="r in rows"
        :key="r.key"
        :type="r.clickable ? 'button' : undefined"
        class="cols row"
        :class="[r.now && mode === 'day' ? `cur-${r.now}` : '', { click: r.clickable }]"
        :title="r.clickable ? `누르면 ${r.label} 설비별로` : undefined"
        @click="r.clickable && emit('pick', r.key)"
      >
        <span class="nm"><span class="nmt">{{ r.label }}</span><small v-if="r.now && mode === 'day'" class="now-tag">{{ NOW_NAME[r.now] }}</small></span>
        <span class="oee">
          <span class="top">
            <span class="num">{{ formatNumber(r.oee, 1) }}<small v-if="r.oee != null">%</small></span>
            <span v-if="r.base != null && r.oee != null" class="d" :class="r.oee - r.base < 0 ? 'neg' : 'pos'">{{ diffText(r.oee - r.base) }}</span>
          </span>
          <ChartDiverge
            v-if="r.base != null"
            :diff="r.oee == null ? null : r.oee - r.base"
            :span="OEE_SPAN"
            :label="r.oee == null ? '값 없음' : `기준 ${formatNumber(r.base, 1)}% 대비 ${diffText(r.oee - r.base)}%p`"
          />
        </span>
        <span class="loss">{{ r.lossSec ? formatSpan(r.lossSec) : '-' }}</span>
        <StateBand v-if="mode === 'day'" :spans="r.spans" :until="until" :from="start" :to="end" :step="step" />
        <span v-else class="days" :style="{ gridTemplateColumns: `repeat(${r.days.length}, minmax(0, 1fr))` }">
          <template v-for="c in r.days" :key="c.date">
            <span v-if="cell(c)" class="c" :class="{ today: c.today }" :style="{ background: cell(c)!.bg }" :title="cell(c)!.title">{{ r.days.length <= 7 ? formatNumber(c.oee, 1) : '' }}</span>
            <span v-else class="c future" title="아직 오지 않은 날"></span>
          </template>
        </span>
      </component>
      <!-- 지금 선: 줄마다 끊기지 않게 상태 줄 전체를 지나는 회색 점선 하나 (파랑은 "앞섬" 뜻이라 쓰지 않음, D-113) -->
      <div v-if="mode === 'day' && showNow" class="cols nowlayer" aria-hidden="true">
        <span></span><span></span><span></span>
        <span class="nowcell"><i :style="{ left: at(until) }"></i></span>
      </div>
    </div>

    <div class="cols foot" aria-hidden="true">
      <span></span><span></span><span></span>
      <span v-if="mode === 'day'" class="axis">
        <b v-for="t in ticks()" :key="t.at" :class="{ end: t.end, begin: t.begin }" :style="{ left: at(t.at) }">{{ t.label }}</b>
        <b v-if="showNow" class="now" :style="{ left: at(until) }">지금 {{ hm(until) }}</b>
      </span>
      <span v-else class="note"><i class="sw up"></i>{{ baseName }}보다 높음 <i class="sw down"></i>낮음 · 테두리 = 오늘</span>
    </div>
  </div>
</template>

<style scoped>
.ledger {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.cols {
  display: grid;
  grid-template-columns: var(--ledger-name-w) var(--ledger-oee-w) var(--ledger-loss-w) minmax(0, 1fr);
  gap: 0 var(--sp-4);
  align-items: center;
}

/* 머리·발 줄도 행과 같은 폭 (행 바탕이 머리 구분선과 같은 끝에서 끝나게) */
.head,
.foot {
  margin: 0 calc(var(--sp-2) * -1);
  padding-right: var(--sp-2);
  padding-left: var(--sp-2);
}

.head {
  padding-bottom: var(--sp-2);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.r {
  text-align: right;
}

/* 줄이 4개 이상이면 패널 높이를 채운다. 3개 이하(.few, 높이는 줄 수 × 최대 줄 높이)면 위에 붙인다 */
.rows {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.rows.few {
  flex: 0 1 auto;
}

.row {
  flex: 1;
  min-height: var(--ledger-row-min);
  margin: 0 calc(var(--sp-2) * -1);
  padding: 0 var(--sp-2);
  border: 0;
  border-bottom: var(--line-w) solid var(--c-line);
  border-radius: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}

.row.click {
  cursor: pointer;
}

/* hover: 그 줄 바탕을 한 단계 진하게. 상태 바탕이 있는 줄은 그 색으로 (회색으로 덮지 않음) */
.row.click:hover {
  background: var(--row-hover, var(--c-surface-sunk));
}

/* 지금 상태를 행 바탕에 은은하게: 고장·대기·통신 끊김만. 계획정지는 정상 계획이라 바탕 없이 "계획정지 중" 글자만 */
.cur-D {
  --row-hover: color-mix(in srgb, var(--c-down) 16%, var(--c-surface));

  background: var(--c-down-tint);
}

.cur-I {
  --row-hover: color-mix(in srgb, var(--c-idle) 40%, var(--c-surface));

  background: var(--c-idle-tint);
}

.cur-DC {
  --row-hover: color-mix(in srgb, var(--c-dc) 16%, var(--c-surface));

  background: var(--c-dc-tint);
}


.nm {
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.row.click:hover .nmt {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.now-tag {
  display: block;
  margin-top: var(--sp-1);
  font-size: var(--fs-sm);
  white-space: nowrap;
}

.cur-D .now-tag { color: var(--c-down); }
.cur-I .now-tag { color: var(--c-caution-ink); }
.cur-S .now-tag { color: var(--c-ink-2); }
.cur-DC .now-tag { color: var(--c-dc); }

.oee {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.top {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.num {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.num small {
  font-size: var(--fs-sm);
}

/* 기준 대비 차이: 앞섬·뒤처짐 같은 굵기, 색으로만 나눈다 */
.d {
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.d.pos { color: var(--c-accent); }
.d.neg { color: var(--c-ink); }

/* 손실 시간: 이름과 같은 급 (시안 G). 숫자 열로 읽히게 고정폭 숫자 */
.loss {
  color: var(--c-ink);
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.days {
  display: grid;
  gap: var(--sp-1);
}

.row .days {
  height: var(--track-h-lg);
}

.c {
  display: grid;
  place-items: center;
  border-radius: var(--r-1);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.c.today {
  outline: var(--line-w-strong) solid var(--c-ink);
  outline-offset: 1px;
}

.c.future {
  background: var(--c-surface-sunk);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line);
}

.dayhead {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  text-align: center;
  white-space: nowrap;
}

.dayhead .today {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.nowlayer {
  position: absolute;
  inset: 0;
  z-index: 2;
  align-items: stretch;
  pointer-events: none;
}

.nowcell {
  position: relative;
}

.nowcell i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: var(--line-w-strong) dashed var(--c-ink-3);
  transform: translateX(-50%);
}

.foot {
  padding-top: var(--sp-2);
}

.axis {
  position: relative;
  height: var(--sp-5);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.axis b {
  position: absolute;
  font-weight: var(--fw-regular);
  white-space: nowrap;
  transform: translateX(-50%);
}

.axis b.begin {
  transform: none;
}

.axis b.end {
  transform: translateX(-100%);
}

.axis b.now {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.note {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.sw {
  display: inline-block;
  width: var(--sp-4);
  height: var(--sp-3);
  border-radius: var(--r-1);
}

.sw.up { background: color-mix(in srgb, var(--c-accent) 50%, transparent); }
.sw.down { background: color-mix(in srgb, var(--c-ink) 50%, transparent); }
</style>
