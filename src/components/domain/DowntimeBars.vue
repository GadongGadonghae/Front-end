<!-- 비가동 코드별 (D-108): 가운데 뚫린 도넛 + 코드 목록. 고장 = 빨강 계열, 대기 = 노랑 계열, 계획정지 = 회색 빗금.
     같은 상태 안 두 번째 코드부터는 옅은 색. 목록에 상태 열쇠 칸(글자)을 같이 써서 색만으로 말하지 않는다 -->
<script setup lang="ts">
import { computed } from 'vue'
import ChartDonut, { type DonutSlice } from '@/components/charts/ChartDonut.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { formatSpan } from '@/lib/format'
import type { DowntimeSliceView } from '@/types/view'

const props = defineProps<{ rows: DowntimeSliceView[] }>()

const FILL: Record<DowntimeSliceView['state'], [string, string]> = {
  D: ['var(--c-down)', 'color-mix(in srgb, var(--c-down) 50%, var(--c-surface))'],
  I: ['var(--c-idle)', 'color-mix(in srgb, var(--c-idle) 50%, var(--c-surface))'],
  S: ['var(--c-stop-solid)', 'var(--c-stop-hatch)'],
}
const list = computed(() => {
  const seen: Record<string, number> = {}
  return props.rows.map((r) => {
    const k = (seen[r.state] = (seen[r.state] ?? -1) + 1)
    return { ...r, color: FILL[r.state][Math.min(k, 1)], hatch: r.state === 'S' }
  })
})
const total = computed(() => props.rows.reduce((a, r) => a + r.sec, 0))
const count = computed(() => props.rows.reduce((a, r) => a + r.count, 0))
/** 가운데 합계: 10시간이 넘으면 시간 단위만 (링 안에 들어가게) */
const centerText = computed(() => (total.value >= 36_000 ? `${Math.round(total.value / 3600)}시간` : formatSpan(total.value)))
const slices = computed<DonutSlice[]>(() => list.value.map((r) => ({ key: r.key, value: r.sec, color: r.color, hatch: r.hatch, title: `${r.label} ${formatSpan(r.sec)} · ${r.count}건` })))
</script>

<template>
  <div class="dd">
    <template v-if="total > 0">
      <ChartDonut :slices="slices" :label="`비가동 코드별 시간 비율, 합계 ${formatSpan(total)}`">
        <b class="sum" :title="formatSpan(total)">{{ centerText }}</b>
        <span class="cap">비가동 · {{ count }}건</span>
      </ChartDonut>
      <ul class="codes">
        <li v-for="r in list" :key="r.key">
          <i class="sw" :class="{ hatch: r.hatch }" :style="{ '--sw': r.color }"></i>
          <StatusKey :state="r.state" size="sm" />
          <span class="lb" :title="r.label">{{ r.label }}</span>
          <b>{{ formatSpan(r.sec) }} · {{ r.count }}건</b>
        </li>
      </ul>
    </template>
    <BaseEmpty v-else text="비가동 없음" />
  </div>
</template>

<style scoped>
.dd {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--sp-3);
  min-height: 0;
}

.sum {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.cap {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.codes {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: var(--sp-2);
  align-items: center;
  padding: var(--sp-2) 0;
  border-top: var(--line-w) solid var(--c-line);
  font-size: var(--fs-md);
}

li:first-child {
  border-top: 0;
}

.lb {
  min-width: 0;
  overflow: hidden;
  color: var(--c-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

b {
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.sw {
  width: var(--sp-3);
  height: var(--sp-3);
  border-radius: var(--r-1);
  background: var(--sw);
}

.sw.hatch {
  background: repeating-linear-gradient(135deg, var(--sw) 0 2px, var(--c-stop) 2px 4px);
}
</style>
