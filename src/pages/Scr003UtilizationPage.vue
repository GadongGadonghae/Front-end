<!-- SCR-003 가동률 (화면정의서 SCR-003, DESIGN.md Layout "분석 화면")
     제목 줄: 조회 조건. 왼쪽 열: OEE + 3요소. 오른쪽 위: 라인·공정·설비별 OEE | 비가동 코드별 시간·건수. 오른쪽 아래: 상태 타임라인(일) 또는 일별 OEE 추이(주·월) -->
<script setup lang="ts">
import { computed } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartTimeline from '@/components/charts/ChartTimeline.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import SummaryColumn from '@/components/domain/SummaryColumn.vue'
import SummaryBlock from '@/components/domain/SummaryBlock.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import { useUtilization } from '@/composables/useUtilization'
import { niceTicks } from '@/lib/chart'
import type { Period } from '@/types/analysis'
import type { StopState } from '@/types/state'

const u = useUtilization()
const { period, date, lineId, process, equipmentId } = u
const oee = computed(() => u.report.value?.oee ?? null)

const PERIODS: { value: Period; label: string }[] = [{ value: 'day', label: '일' }, { value: 'week', label: '주' }, { value: 'month', label: '월' }]
const HOUR_TICKS = [0, 6, 12, 18, 24].map((h) => ({ value: h * 3600, label: `${String(h).padStart(2, '0')}시` }))
const dailyY = computed(() => niceTicks(Math.min(60, ...u.daily.value.points.map((p) => p[1])), 100, 4))
/** 비가동 코드 행 → 그 코드의 상태 (S·I·D) */
const stateOf = (key: string): StopState => u.downtime.value.find((d) => d.key === key)?.state ?? 'S'
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">가동률</h1>
      <div class="filters">
        <span class="field"><span class="lab">기간</span><BaseSegmented v-model="period" label="기간" :options="PERIODS" /></span>
        <BaseDateField v-model="date" label="날짜" :max="u.today" />
        <BaseSelect v-model="lineId" label="라인" :options="u.lineOptions" />
        <BaseSelect v-model="process" label="공정" :options="u.processOptions.value" />
        <BaseSelect v-model="equipmentId" label="설비" :options="u.equipmentOptions.value" />
      </div>
    </template>

    <div class="layout">
      <SummaryColumn title="종합 가동률" :meta="u.rangeText.value">
        <SummaryBlock>
          <BaseFigure label="OEE" :value="oee?.oee" :digits="1" unit="%" size="lg" sub="시간가동률 × 성능가동률 × 양품률" />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="시간가동률" :value="oee?.availability" :digits="1" unit="%" sub="(부하시간 − I·D 시간) ÷ 부하시간" />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="성능가동률" :value="oee?.performance" :digits="1" unit="%" sub="표준CT × 생산수량 ÷ 가동시간" />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="양품률" :value="oee?.quality" :digits="1" unit="%" sub="공정 양품 ÷ 공정 처리 수" />
        </SummaryBlock>
        <!-- 라인 수율 (D-92): OEE와 다른 지표. 공장·라인 단위일 때만 -->
        <SummaryBlock v-if="u.report.value?.lineYield != null">
          <BaseFigure label="라인 수율" :value="u.report.value.lineYield" :digits="1" unit="%" sub="출고 양품 ÷ 슬리팅 투입 (OEE와 별도)" />
        </SummaryBlock>
        <!-- FN-004 예외, D-55 -->
        <p class="note">부하시간이 0이면 "-" · 코일입고는 설비가 없어 제외</p>
      </SummaryColumn>

      <div class="main">
        <div class="mid">
          <BasePanel :title="u.barTitle.value" meta="막대를 누르면 그 조건으로">
            <ChartBarList v-if="u.bars.value.length" :label="u.barTitle.value" :rows="u.bars.value" :max="100" clickable @pick="(r) => u.pickBar(r.key)" />
            <BaseEmpty v-else />
          </BasePanel>
          <BasePanel title="비가동 코드별 시간 · 건수" meta="계획정지는 회색, 손실(I·D)만 색">
            <ChartBarList v-if="u.downtime.value.length" label="비가동 코드별 시간" :rows="u.downtime.value">
              <template #lead="{ row }"><StatusKey :state="stateOf(row.key)" size="sm" /></template>
            </ChartBarList>
            <BaseEmpty v-else />
          </BasePanel>
        </div>

        <BasePanel v-if="period === 'day'" title="상태 타임라인" :meta="lineId ? '설비별' : '라인 대표 상태 (D > DC > S > I > R)'">
          <template #tools>
            <StateLegend />
            <span class="future-key"><i></i>아직 안 온 시간</span>
          </template>
          <ChartTimeline
            v-if="u.timelineRows.value.length"
            label="00시~24시 상태 타임라인"
            :rows="u.timelineRows.value"
            :span="86400"
            :until="u.timeline.value?.until ?? 0"
            :ticks="HOUR_TICKS"
          />
          <BaseEmpty v-else />
        </BasePanel>
        <BasePanel v-else title="일별 OEE 추이" :meta="period === 'week' ? '이번 주' : '이번 달'">
          <ChartLine
            v-if="u.daily.value.points.length"
            label="일별 OEE 추이"
            :x="[0, Math.max(1, u.daily.value.n - 1)]"
            :y="dailyY.domain"
            :x-ticks="u.daily.value.ticks"
            :y-ticks="dailyY.ticks"
            :series="[{ key: 'oee', points: u.daily.value.points }]"
            end-dot
          />
          <BaseEmpty v-else />
        </BasePanel>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-5);
}

.field {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.lab {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.layout {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.main {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-width: 0;
  min-height: 0;
}

.mid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.note {
  margin-top: auto;
  padding-top: var(--sp-4);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.future-key {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

/* 낮은 창: 막대 8줄·타임라인 8줄이 칸에 들어가도록 줄 간격과 띠 두께를 줄인다 */
@media (height <= 860px) {
  .main :deep(.panel) {
    padding: var(--sp-4);
  }

  .main :deep(.ph) {
    margin-bottom: var(--sp-2);
  }

  .main :deep(.bars) {
    gap: var(--sp-1) var(--sp-3);
  }

  .main :deep(.bars li) {
    font-size: var(--fs-sm);
  }

  .main :deep(.tl) {
    gap: var(--sp-1);
  }

  .main :deep(.tl .row:not(.axis) .track) {
    height: var(--sp-4);
  }
}

.future-key i {
  width: var(--key-sm);
  height: var(--key-sm);
  border-radius: var(--r-1);
  background: var(--c-surface-sunk);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
}
</style>
