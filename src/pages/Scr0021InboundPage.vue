<!-- SCR-002-1 코일입고 상세 (화면정의서 SCR-002-1). 라인·공정 탭 없음, 설비 없음 (D-10)
     제목 줄 오른쪽: 오늘 입고 · 슬리팅 앞 재고 · 오늘 투입. 본문: 왼쪽 입고 기록, 오른쪽 재고 추이(주인공) -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseFigureRow from '@/components/base/BaseFigureRow.vue'
import BaseCheck from '@/components/base/BaseCheck.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import InboundLog from '@/components/domain/InboundLog.vue'
import { useInbound } from '@/composables/useEndpoints'
import { useNow } from '@/composables/useNow'
import { niceTicks, timeTicks } from '@/lib/chart'

const LINES = ['A', 'B', 'C', 'D', 'E', 'F']
const { data, figures } = useInbound()
const now = useNow()

/** 라인별 선 켜기/끄기 [가정]. 처음엔 합계만 */
const shown = ref<Record<string, boolean>>(Object.fromEntries(LINES.map((l) => [l, false])))

const chart = computed(() => {
  const trend = data.value?.stockTrend ?? []
  const from = new Date(new Date(now.value).setHours(0, 0, 0, 0)).getTime()
  const total: [number, number][] = trend.map((p) => [Date.parse(p.t), p.total])
  const lines = LINES.filter((l) => shown.value[l]).map((l) => ({ key: l, kind: 'thin' as const, points: trend.map((p): [number, number] => [Date.parse(p.t), p.byLine[l] ?? 0]) }))
  const y = niceTicks(0, Math.max(10, ...total.map((p) => p[1])) * 1.1, 4)
  return { x: [from, now.value] as [number, number], xTicks: timeTicks(from, now.value, 180), y, series: [{ key: 'total', points: total }, ...lines], empty: !trend.length }
})
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: '코일입고' }]" />
    </template>
    <template #head-right>
      <BaseFigureRow>
        <BaseFigure label="오늘 입고" :value="figures.today" unit="코일" size="sm" />
        <BaseFigure label="슬리팅 앞 재고 (6개 라인 합)" :value="figures.stock" unit="롤" size="sm" />
        <BaseFigure label="오늘 투입 (제품 ID 발급)" :value="figures.input" size="sm" />
      </BaseFigureRow>
    </template>

    <div class="body">
      <BasePanel title="오늘 입고 기록" meta="최근순">
        <InboundLog :receipts="data?.receipts ?? []" />
      </BasePanel>

      <BasePanel title="슬리팅 앞 재고 추이" meta="00시~지금 · 롤">
        <template #tools>
          <ChartLegend :items="[{ label: '6개 라인 합', kind: 'main' }, { label: '고른 라인', kind: 'thin' }]" />
          <div class="toggles" role="group" aria-label="라인별 선 켜기">
            <BaseCheck v-for="l in LINES" :key="l" v-model="shown[l]" :label="l" />
          </div>
        </template>
        <ChartLine
          v-if="!chart.empty"
          label="슬리팅 앞 재고 추이"
          :x="chart.x"
          :y="chart.y.domain"
          :x-ticks="chart.xTicks"
          :y-ticks="chart.y.ticks"
          :series="chart.series"
          :now="now"
          end-dot
        />
        <BaseEmpty v-else />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: var(--col-side) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.toggles {
  display: flex;
  gap: var(--sp-1);
}
</style>
