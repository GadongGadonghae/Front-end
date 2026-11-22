<!-- SCR-002-7 적재 상세 (11/22 비전 검사와 나눔). 라인·공정 탭 없음, 설비 없음
     제목 줄 오른쪽: 오늘 적재 · 계획 · 달성률 · 상자. 본문 왼쪽: 라인별 적재 / 계획 → 시간대별 적재. 오른쪽 열: 최근 적재 제품
     비전 검사에 합격하면 바로 적재로 센다 (적재 시각 = 검사 시각) -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseFigureRow from '@/components/base/BaseFigureRow.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartColumns from '@/components/charts/ChartColumns.vue'
import { useLoading } from '@/composables/useEndpoints'

const router = useRouter()
const { figures, byLine, hours, rows } = useLoading()
const columns: TableColumn[] = [{ key: 'time', label: '적재 시각', width: '6.5em' }, { key: 'productId', label: '제품 ID' }, { key: 'where', label: '라인', width: '4em' }]
const openProduct = (id: string) => router.push({ path: '/production', query: { q: id } })
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: '적재' }]" />
    </template>
    <template #head-right>
      <BaseFigureRow>
        <BaseFigure label="오늘 적재" :value="figures.done" unit="개" size="sm" />
        <BaseFigure label="계획" :value="figures.plan" unit="개" size="sm" />
        <BaseFigure label="달성률" :value="figures.rate" :digits="1" unit="%" size="sm" />
        <BaseFigure label="상자" :value="figures.boxes" size="sm" />
      </BaseFigureRow>
    </template>

    <div class="body">
      <div class="left">
        <BasePanel title="라인별 적재 / 계획" meta="오늘">
          <ChartBarList label="라인별 적재 달성률" :rows="byLine" :max="100" thick />
        </BasePanel>
        <BasePanel title="시간대별 적재" meta="오늘">
          <ChartColumns v-if="!hours.empty" label="시간대별 적재 수" :count="hours.values.length" :values="hours.values" :labels="hours.labels" :y-ticks="hours.yTicks" />
          <BaseEmpty v-else />
        </BasePanel>
      </div>
      <BasePanel title="최근 적재 제품" meta="오늘">
        <BaseTable :columns="columns" :rows="rows" :row-key="(r) => r.key" label="최근 적재 제품" empty="오늘 적재 없음">
          <template #cell-productId="{ row }">
            <button class="id" type="button" @click="openProduct(row.productId)">{{ row.productId }}</button>
          </template>
        </BaseTable>
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--col-side);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.left {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-width: 0;
  min-height: 0;
}

.id {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
