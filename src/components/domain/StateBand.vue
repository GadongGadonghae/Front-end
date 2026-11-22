<!-- 근무 시간 상태 띠 (가동률 D-108, D-113): 가동은 조금 옅은 초록, 대기·고장·통신 끊김만 상태 색, 계획정지는 회색 빗금(가동률에서 뺌).
     아주 짧은 이상 구간도 보이게 최소 폭(4분, 그리고 --seg-min-w)을 둔다. 지금 이후는 가라앉은 면.
     시간 눈금(step)마다 가는 눈금선을 띠 위에 긋는다 (축 글자와 같은 자리). 지금 선은 UtilLedger가 줄 전체에 하나로 긋는다 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { StateSpanView } from '@/types/view'

/** from·to = 띠의 왼쪽·오른쪽 끝 (하루 0시부터 초) */
const props = defineProps<{ spans: StateSpanView[]; until: number; from: number; to: number; step: number }>()
/** 손실 구간 최소 폭 4분 */
const MIN_SEC = 240
const pos = (sec: number) => (Math.max(props.from, Math.min(props.to, sec)) - props.from) / (props.to - props.from)
/** 띠 범위와 겹치는 구간만 (밖의 구간이 끝에 조각으로 남지 않게) */
const shown = computed(() => props.spans.filter((s) => s.to > props.from && s.from < props.to))
const pct = (sec: number) => `${pos(sec) * 100}%`
const width = (s: StateSpanView) => `${(pos(s.state === 'R' ? s.to : Math.max(s.to, s.from + MIN_SEC)) - pos(s.from)) * 100}%`
const cells = computed(() => (props.to - props.from) / props.step)
</script>

<template>
  <span class="band">
    <i v-if="until < to" class="future" :style="{ left: pct(until), right: 0 }" title="아직 오지 않은 시간"></i>
    <i
      v-for="(s, i) in shown"
      :key="i"
      :class="[`s-${s.state}`, { ongoing: s.ongoing }]"
      :style="{ left: pct(s.from), width: width(s) }"
      :title="s.title"
    ></i>
    <i class="grid" :style="{ '--cells': cells }" aria-hidden="true"></i>
  </span>
</template>

<style scoped>
.band {
  position: relative;
  display: block;
  height: var(--track-h-lg);
  border-radius: var(--r-1);
  background: var(--c-surface-sunk);
}

i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: var(--r-1);
}

.s-R { background: var(--c-run-quiet); }

/* 이상 구간(계획정지·대기·고장·통신 끊김)은 아무리 짧아도 최소 폭만큼은 보이게 */
.s-S,
.s-I,
.s-D,
.s-DC {
  z-index: 1;
  min-width: var(--seg-min-w);
}

.s-S { background: repeating-linear-gradient(135deg, var(--c-stop) 0 3px, var(--c-stop-hatch) 3px 5px); }
.s-I { background: var(--c-idle); box-shadow: inset 0 0 0 var(--line-w) var(--c-idle-edge); }
.s-D { background: var(--c-down); }
.s-DC { background: var(--c-dc); }

/* 시간 눈금: 띠 위에 표면색 가는 선 (칠한 면을 끊어 시각을 짚게). 띠 양 끝은 긋지 않는다 */
.grid {
  inset: 0;
  z-index: 2;
  border-radius: 0;
  background: repeating-linear-gradient(90deg, transparent 0 calc(100% / var(--cells) - 1px), color-mix(in srgb, var(--c-surface) 70%, transparent) calc(100% / var(--cells) - 1px) calc(100% / var(--cells)));
  pointer-events: none;
}

.future {
  border-radius: 0 var(--r-1) var(--r-1) 0;
  background: var(--c-surface-sunk);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line);
}

</style>
