<!-- 24시간 상태 띠 (가동률 D-108): 가동은 옅은 초록, 대기·고장·통신 끊김만 상태 색, 계획정지는 회색 빗금(가동률에서 뺌).
     아주 짧은 이상 구간도 보이게 최소 폭(4분, 그리고 --seg-min-w)을 둔다. 지금도 이어지는 구간은 먹색 테두리 (깜빡이지 않음), 지금 이후는 가라앉은 면. 지금 선은 UtilLedger가 줄 전체에 하나로 긋는다 -->
<script setup lang="ts">
import type { StateSpanView } from '@/types/view'

const props = withDefaults(defineProps<{ spans: StateSpanView[]; until: number; span?: number }>(), { span: 86_400 })
/** 손실 구간 최소 폭 4분 */
const MIN_SEC = 240
const pos = (sec: number) => Math.max(0, Math.min(props.span, sec)) / props.span
const pct = (sec: number) => `${pos(sec) * 100}%`
const width = (s: StateSpanView) => `${(pos(s.state === 'R' ? s.to : Math.max(s.to, s.from + MIN_SEC)) - pos(s.from)) * 100}%`
const end = () => props.span
</script>

<template>
  <span class="band">
    <i v-if="until < end()" class="future" :style="{ left: pct(until), right: 0 }" title="아직 오지 않은 시간"></i>
    <i
      v-for="(s, i) in spans"
      :key="i"
      :class="[`s-${s.state}`, { ongoing: s.ongoing }]"
      :style="{ left: pct(s.from), width: width(s) }"
      :title="s.title"
    ></i>
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

.ongoing {
  z-index: 1;
  outline: var(--indicator-w) solid var(--c-ink);
  outline-offset: var(--line-w);
}

.future {
  border-radius: 0 var(--r-1) var(--r-1) 0;
  background: var(--c-surface-sunk);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line);
}

</style>
