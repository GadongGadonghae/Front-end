<!-- 결과 도넛 (생산 조회 이력, D-107): 투입 = 양품 출고 + 불량 제외 + 진행 중. 가운데 = 투입 수.
     양품 = 강조 파랑, 불량 = 먹색, 진행 중 = 옅은 파랑. 옆에 값 목록 (색만으로 말하지 않게) -->
<script setup lang="ts">
import { computed } from 'vue'
import ChartDonut from '@/components/charts/ChartDonut.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import { formatNumber } from '@/lib/format'

const props = defineProps<{ input: number | null; ok: number | null; ng: number | null; wip: number | null }>()

const items = computed(() => [
  { key: 'ok', label: '양품 출고', value: props.ok ?? 0, color: 'color-mix(in srgb, var(--c-accent) 80%, transparent)' },
  { key: 'ng', label: '불량 제외', value: props.ng ?? 0, color: 'var(--c-ink)' },
  { key: 'wip', label: '진행 중', value: props.wip ?? 0, color: 'color-mix(in srgb, var(--c-accent) 30%, transparent)' },
])
const share = (v: number) => (props.input ? `${formatNumber((v / props.input) * 100, 1)}%` : '-')
</script>

<template>
  <div class="res">
    <template v-if="input">
      <ChartDonut
        :label="`투입 ${formatNumber(input)} 중 양품 ${formatNumber(ok)}, 불량 ${formatNumber(ng)}, 진행 중 ${formatNumber(wip)}`"
        :slices="items.map((i) => ({ key: i.key, value: i.value, color: i.color, title: `${i.label} ${formatNumber(i.value)}` }))"
      >
        <b class="sum">{{ formatNumber(input) }}</b>
        <span class="cap">투입</span>
      </ChartDonut>
      <ul>
        <li v-for="i in items" :key="i.key">
          <i :style="{ background: i.color }"></i>
          <span class="lb">{{ i.label }}</span>
          <b>{{ formatNumber(i.value) }}</b>
          <span class="pc">{{ share(i.value) }}</span>
        </li>
      </ul>
    </template>
    <BaseEmpty v-else />
  </div>
</template>

<style scoped>
.res {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
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

ul {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: auto 1fr auto 4em;
  gap: var(--sp-2);
  align-items: center;
  font-size: var(--fs-md);
}

i {
  width: var(--sp-3);
  height: var(--sp-3);
  border-radius: var(--r-1);
}

.lb {
  color: var(--c-ink-2);
}

b {
  font-weight: var(--fw-strong);
}

.pc {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  text-align: right;
}
</style>
