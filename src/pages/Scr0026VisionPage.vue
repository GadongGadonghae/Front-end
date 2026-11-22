<!-- SCR-002-6 비전 검사 상세 (화면정의서 SCR-002-6, 11/22 적재와 나눔). 라인·공정 탭 없음. 관리값 그래프·미세정지 없음 (D-51)
     제목 줄 오른쪽: 오늘 검사 · 합격 · 불량 · 불량률. 본문 왼쪽: 비전 카드 + 라인별 불량 → 불량 목록. 오른쪽 열: 비가동 이력 -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseFigureRow from '@/components/base/BaseFigureRow.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import EquipCard from '@/components/domain/EquipCard.vue'
import InspectionPanel from '@/components/domain/InspectionPanel.vue'
import DowntimeHistory from '@/components/domain/DowntimeHistory.vue'
import { useVision } from '@/composables/useEndpoints'
import { useEquipmentHistory } from '@/composables/useEquipmentHistory'

const router = useRouter()
const { card, inspections, byLine, equipmentId } = useVision()
const history = useEquipmentHistory(equipmentId)
const { can } = useAuth()
const d = inspections.data
const openProduct = (id: string) => router.push({ path: '/production', query: { q: id } })
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: '비전 검사' }]" />
    </template>
    <template #head-right>
      <BaseFigureRow>
        <BaseFigure label="오늘 검사" :value="d?.inspected" size="sm" />
        <BaseFigure label="합격" :value="d ? d.inspected - d.ng : null" size="sm" />
        <BaseFigure label="불량" :value="d?.ng" size="sm" />
        <BaseFigure label="불량률" :value="d?.rate" :digits="1" unit="%" size="sm" />
      </BaseFigureRow>
    </template>

    <div class="body">
      <div class="left">
        <div class="top">
          <EquipCard v-if="card" :card="card" selected />
          <BasePanel title="라인별 불량" meta="오늘">
            <ChartBarList label="라인별 비전 불량 수" :rows="byLine" />
          </BasePanel>
        </div>
        <BasePanel title="불량 목록" meta="오늘">
          <InspectionPanel :inspected="null" :ng="null" :rate="null" :rows="inspections.rows.value" detail="where" compact @open-product="openProduct" />
        </BasePanel>
      </div>
      <BasePanel title="비가동 이력" :meta="`${card?.name ?? '비전'} · 오늘`">
        <DowntimeHistory :rows="history.rows.value" :save="history.saveMemo" :readonly="!can('action', equipmentId ?? undefined)" />
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
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--sp-4);
  min-width: 0;
  min-height: 0;
}

.top {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-4);
}

</style>
