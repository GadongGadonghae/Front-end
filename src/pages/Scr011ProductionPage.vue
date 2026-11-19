<!-- SCR-011 생산 조회 (D-107 시안 G4 "시간표 중심"): 생산품(제품) 중심, 두 기능을 탭으로.
     [공정 중 추적] 공정별 지금 제품 수 + 제품 여정 시간표 (행 바탕 = 지금 상태)
     [이력 조회] 찾기 조건 + 왼쪽 결과 도넛 + 제품 표. 오른쪽 열은 두 탭 모두 고른 제품의 공정별 기록 -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseToggle from '@/components/base/BaseToggle.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BasePager from '@/components/base/BasePager.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ProcessSteps from '@/components/domain/ProcessSteps.vue'
import ProcessCounts from '@/components/domain/ProcessCounts.vue'
import ProductJourney from '@/components/domain/ProductJourney.vue'
import JourneyLegend from '@/components/domain/JourneyLegend.vue'
import ProductRecord from '@/components/domain/ProductRecord.vue'
import ProductionResult from '@/components/domain/ProductionResult.vue'
import { useProduction, type JourneyScale, type ResultFilter } from '@/composables/useProduction'
import { formatNumber } from '@/lib/format'
import type { Period } from '@/types/analysis'
import type { LineId } from '@/types/plant'

const route = useRoute()
// 공정 검사·출고 불량 목록에서 제품 ID를 눌러 들어오면 그 제품을 찾아 둔다 (D-88)
const p = useProduction(typeof route.query.q === 'string' ? route.query.q : '')
const { tab, lineId, period, date, result, q, page, scale } = p
watch(() => route.query.q, (v) => { if (typeof v === 'string' && v) p.findProduct(v) })

/** 스위치: 켜면 현재 상황 (공정 중 추적) */
const live = computed({ get: () => tab.value === 'live', set: (v: boolean) => { tab.value = v ? 'live' : 'hist' } })
const SCALES: { value: JourneyScale; label: string }[] = [{ value: '60', label: '1시간' }, { value: '120', label: '2시간' }, { value: '240', label: '4시간' }]
const PERIODS: { value: Period; label: string }[] = [{ value: 'day', label: '일' }, { value: 'week', label: '주' }, { value: 'month', label: '월' }]
const LINES: { value: '' | LineId; label: string }[] = [{ value: '', label: '전체' }, ...(['A', 'B', 'C', 'D', 'E', 'F'] as LineId[]).map((l) => ({ value: l, label: `${l}라인` }))]
const RESULTS = computed<{ value: ResultFilter; label: string }[]>(() => [
  { value: 'all', label: '전체' },
  { value: 'ok', label: `양품 출고 ${formatNumber(p.summary.value?.done)}` },
  { value: 'ng', label: `불량 제외 ${formatNumber(p.ngTotal.value)}` },
  { value: 'wip', label: `진행 중 ${formatNumber(p.summary.value?.wip)}` },
])
const columns = computed<TableColumn[]>(() => [
  { key: 'id', label: '제품 ID', width: '11.5em' },
  { key: 'inputAt', label: '투입', width: p.multiDay.value ? '7.5em' : '6em' },
  { key: 'doneAt', label: '끝남', width: p.multiDay.value ? '7.5em' : '6em' },
  { key: 'lead', label: '걸린 시간', width: '6.5em' },
  { key: 'steps', label: '거친 공정' },
  { key: 'result', label: '결과', width: '9em' },
])
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">생산 조회</h1>
      <BaseSelect v-model="lineId" label="라인" :options="LINES" />
    </template>
    <template #head-right>
      <span class="basis">{{ tab === 'live' ? '지금 공정 안에 있는 제품 · 10초마다 갱신' : p.rangeText.value }}</span>
    </template>

    <div class="layout">
      <BasePanel class="main">
        <template #head>
          <h2>{{ tab === 'live' ? '현재 상황 · 공정 중인 제품' : '제품 이력' }}</h2>
          <span class="meta">{{ tab === 'live' ? '줄을 누르면 오른쪽에 공정별 기록' : '기간 · 결과 · 제품 ID로 찾기 · 빗금 줄 = 불량 제외' }}</span>
        </template>
        <template #tools>
          <BaseToggle v-model="live" label="현재 상황">현재 상황<b v-if="p.wip.value" class="cnt">{{ p.wip.value.total }}</b></BaseToggle>
        </template>

        <template v-if="tab === 'live'">
          <ProcessCounts :items="p.counts.value" />
          <div class="jbar">
            <JourneyLegend />
            <span class="scale"><span class="lab">시간표 길이</span><BaseSegmented v-model="scale" label="시간표 길이" size="sm" :options="SCALES" /></span>
          </div>
          <ProductJourney
            v-if="p.journey.value.length"
            :rows="p.journey.value"
            :selected="p.selected.value"
            :from="p.span.value.from"
            :to="p.span.value.to"
            :now="p.span.value.now"
            @pick="(id) => (p.selected.value = id)"
          />
          <BaseEmpty v-else :text="p.wip.value ? '지금 공정 안에 있는 제품이 없습니다' : '불러오는 중'" />
        </template>

        <template v-else>
          <div class="find">
            <span class="search"><BaseInput v-model="q" label="제품 ID" hide-label type="search" size="md" placeholder="제품 ID 검색 (예: C-20261116-0412)" /></span>
            <BaseSegmented v-model="period" label="기간" :options="PERIODS" />
            <BaseDateField v-model="date" label="날짜" :max="p.today" />
            <BaseSegmented v-model="result" label="결과" :options="RESULTS" />
          </div>
          <div class="hist">
            <section class="sum" aria-label="결과">
              <h3>결과 <span>{{ p.rangeText.value }}</span></h3>
              <ProductionResult :input="p.summary.value?.input ?? null" :ok="p.summary.value?.done ?? null" :ng="p.ngTotal.value" :wip="p.summary.value?.wip ?? null" />
            </section>
            <div class="tbl">
              <BaseTable
                :columns="columns"
                :rows="p.list.value?.items ?? []"
                :row-key="(r) => r.id"
                label="제품 이력"
                clickable
                :expanded-key="p.selected.value"
                :row-tone="(r) => (r.result === 'ng' ? 'hatch' : null)"
                :empty="p.tooOld.value ? '90일이 지난 기간은 제품 내역이 없습니다' : p.list.value ? '데이터 없음' : '불러오는 중'"
                @row-click="(r) => (p.selected.value = r.id)"
              >
                <template #cell-id="{ row }"><span class="pid">{{ row.id }}</span></template>
                <template #cell-inputAt="{ row }">{{ p.timeText(row.inputAt) }}</template>
                <template #cell-doneAt="{ row }">{{ p.timeText(row.doneAt) }}</template>
                <template #cell-lead="{ row }">{{ p.leadText(row) }}</template>
                <template #cell-steps="{ row }"><ProcessSteps :steps="row.steps" /></template>
                <template #cell-result="{ row }"><span :class="['res', row.result]">{{ p.resultText(row) }}</span></template>
              </BaseTable>
              <BasePager v-if="p.list.value && p.list.value.total > 0" v-model="page" :total="p.list.value.total" :size="p.list.value.size" />
            </div>
          </div>
        </template>
      </BasePanel>

      <BasePanel class="detail">
        <ProductRecord v-if="p.record.value" :view="p.record.value" :from="tab === 'live' ? '공정 중에서 고름' : '이력에서 고름'" />
        <BaseEmpty v-else :text="p.selected.value ? '불러오는 중' : '제품을 고르면 공정별 기록이 나옵니다'" />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.basis {
  color: var(--c-ink-3);
  font-size: var(--fs-md);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--col-detail);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.main :deep(.ph) {
  gap: var(--sp-4);
}

.main h2 {
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.cnt {
  margin-left: var(--sp-2);
  font-weight: var(--fw-strong);
}

.meta {
  overflow: hidden;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 시간표 위 줄: 왼쪽 범례, 오른쪽 시간표 길이 */
.jbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  margin-bottom: var(--sp-3);
}

.scale {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.lab {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.find {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.search :deep(input) {
  width: 22em;
}

.hist {
  display: grid;
  flex: 1;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-6);
  min-height: 0;
}

.sum h3 {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.sum h3 span {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.tbl {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.pid {
  font-weight: var(--fw-strong);
}

.res {
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.res.ng {
  text-decoration: underline 2px var(--c-ink-3);
  text-underline-offset: 3px;
}

.res.wip {
  color: var(--c-ink-2);
  font-weight: var(--fw-regular);
}

/* 좁은 창: 결과 칸을 줄여 표(거친 공정)가 접히지 않게 */
@media (width <= 1600px) {
  .hist {
    --donut-size: 128px;

    grid-template-columns: clamp(200px, 15vw, 240px) minmax(0, 1fr);
    gap: var(--sp-4);
  }
}
</style>
