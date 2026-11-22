<!-- OEE 다리 (D-108): 부하시간 100%를 OEE와 세 손실(시간 → 성능 → 품질)로 나눈 한 줄 + 3요소 값과 잃은 몫.
     OEE = 시간가동률 × 성능가동률 × 양품률 (D-21, D-92). 라인 수율은 OEE와 다른 지표라 따로 한 줄 -->
<script setup lang="ts">
import { computed } from 'vue'
import ChartStackBar from '@/components/charts/ChartStackBar.vue'
import { formatNumber } from '@/lib/format'
import type { Oee } from '@/types/live'

const props = defineProps<{ oee: Oee | null; lineYield: number | null }>()

const parts = computed(() => {
  const o = props.oee
  if (!o || o.availability == null || o.performance == null || o.quality == null) return null
  const a = o.availability / 100, p = o.performance / 100, q = o.quality / 100
  return {
    oee: a * p * q * 100,
    la: (1 - a) * 100,
    lp: a * (1 - p) * 100,
    lq: a * p * (1 - q) * 100,
  }
})
const lost = (v: number) => `−${formatNumber(v, 1)}`
</script>

<template>
  <div class="bridge">
    <template v-if="parts">
      <ChartStackBar
        :label="`부하시간 100% 중 OEE ${formatNumber(parts.oee, 1)}%`"
        :total="100"
        :parts="[
          { key: 'oee', value: parts.oee, color: 'var(--c-ink)', title: `OEE ${formatNumber(parts.oee, 1)}%` },
          { key: 'q', value: parts.lq, color: 'var(--c-loss-q)', title: `품질 손실 ${formatNumber(parts.lq, 1)}%` },
          { key: 'p', value: parts.lp, color: 'var(--c-loss-p)', title: `성능 손실 ${formatNumber(parts.lp, 1)}%` },
          { key: 'a', value: parts.la, color: 'var(--c-loss-a)', title: `시간 손실 ${formatNumber(parts.la, 1)}%` },
        ]"
      />
      <div class="scale"><span>OEE</span><span>부하시간 100%</span></div>
    </template>
    <dl>
      <i class="sw a"></i><dt>시간가동률</dt><dd>{{ formatNumber(oee?.availability, 1) }}%</dd><dd class="lost">{{ parts ? lost(parts.la) : '' }}</dd>
      <i class="sw p"></i><dt>성능가동률</dt><dd>{{ formatNumber(oee?.performance, 1) }}%</dd><dd class="lost">{{ parts ? lost(parts.lp) : '' }}</dd>
      <i class="sw q"></i><dt>양품률</dt><dd>{{ formatNumber(oee?.quality, 1) }}%</dd><dd class="lost">{{ parts ? lost(parts.lq) : '' }}</dd>
    </dl>
    <p v-if="lineYield != null" class="yield"><span>라인 수율</span><b>{{ formatNumber(lineYield, 1) }}%</b></p>
  </div>
</template>

<style scoped>
.bridge {
  display: flex;
  flex-direction: column;
}

.scale {
  display: flex;
  justify-content: space-between;
  margin-top: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

dl {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: var(--sp-2);
  align-items: center;
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-md);
}

dt {
  color: var(--c-ink-2);
}

dd {
  margin: 0;
  font-weight: var(--fw-strong);
  text-align: right;
}

dd.lost {
  min-width: 4em;
  color: var(--c-ink-3);
  font-weight: var(--fw-regular);
}

/* 범례 칸: 막대 조각 모양 (정사각형이면 빈 체크박스처럼 보여서) */
.sw {
  width: var(--sp-4);
  height: var(--sp-2);
  border-radius: var(--r-1);
}

.sw.a { background: var(--c-loss-a); }
.sw.p { background: var(--c-loss-p); }
.sw.q { background: var(--c-loss-q); }

.yield {
  display: flex;
  justify-content: space-between;
  margin-top: var(--sp-3);
  padding-top: var(--sp-2);
  border-top: var(--line-w) solid var(--c-line);
  color: var(--c-ink-3);
  font-size: var(--fs-md);
}

.yield b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}
</style>
