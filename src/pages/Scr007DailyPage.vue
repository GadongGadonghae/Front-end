<!-- SCR-007 일일 생산 리포트 (화면정의서 SCR-007 1번, 시안 B-daily, DESIGN.md Layout "분석 화면")
     제목 줄: 탭 · 날짜. 왼쪽 열: 하루 요약 (실적/목표 · OEE · 불량 제외). 오른쪽 위: 라인별 실적 | 공정별 생산량·불량. 오른쪽 아래: 비가동 코드별 | 재공품
     화면만, PDF 없음 (D-67). 제품별 상세는 생산 조회 (D-85) -->
<script setup lang="ts">
import { computed } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import SummaryColumn from '@/components/domain/SummaryColumn.vue'
import SummaryBlock from '@/components/domain/SummaryBlock.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { useDailyReport } from '@/composables/useReports'
import { formatNumber } from '@/lib/format'
import type { StopState } from '@/types/state'
import { lineName } from '@/lib/status'

const d = useDailyReport()
const { date } = d
const r = computed(() => d.report.value)

const TABS = [
  { key: 'daily', label: '일일 생산 리포트', to: '/reports/daily' },
  { key: 'replan', label: '계획수정 보고서', to: '/reports/replan' },
]

const LINE_COLS: TableColumn[] = [
  { key: 'lineId', label: '라인' },
  { key: 'plan', label: '계획', align: 'right' },
  { key: 'done', label: '실적', align: 'right' },
  { key: 'rate', label: '달성률', align: 'right' },
  { key: 'oee', label: 'OEE', align: 'right' },
  { key: 'ng', label: '불량 제외', align: 'right' },
]
const PROC_COLS: TableColumn[] = [
  { key: 'label', label: '공정' },
  { key: 'output', label: '생산', align: 'right' },
  { key: 'ng', label: '불량', align: 'right' },
  { key: 'rate', label: '불량률', align: 'right' },
  { key: 'wip', label: '앞 재공', align: 'right' },
]
const lineRows = computed(() => (r.value?.lines ?? []).map((l) => ({ ...l, key: l.lineId, name: lineName(l.lineId) })))
const pct = (v: number | null | undefined) => (v == null ? '-' : `${formatNumber(v, 1)}%`)
const stateOf = (key: string): StopState => d.downtime.value.find((x) => x.key === key)?.state ?? 'S'
const ngSum = computed(() => d.processRows.value.reduce((a, p) => a + p.ng, 0))
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">리포트</h1>
      <BaseTabs :items="TABS" active="daily" label="리포트 종류" />
      <BaseDateField v-model="date" label="날짜" :max="d.today" />
      <span class="note">{{ r?.closed ? '하루 마감 값' : '오늘은 지금까지 값' }} · 제품별 상세는 <RouterLink to="/production">생산 조회</RouterLink>에서</span>
    </template>

    <div class="layout">
      <SummaryColumn title="하루 요약" :meta="d.stamp.value">
        <SummaryBlock>
          <BaseFigure label="실적 (출고 양품) / 목표" :value="r?.done" :suffix="r?.target != null ? `/ ${formatNumber(r.target)}` : undefined" size="lg" />
          <template v-if="r?.target != null">
            <ChartProgress :percent="r.rate" :label="`달성률 ${formatNumber(r.rate, 1)}%`" />
            <span class="sub">달성률 {{ formatNumber(r.rate, 1) }}%</span>
          </template>
          <span v-else-if="r" class="sub">목표 미설정</span>
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="OEE" :value="r?.oee.oee" :digits="1" unit="%" />
          <ul class="mini">
            <li><span>시간가동률</span><b>{{ formatNumber(r?.oee.availability, 1) }}</b></li>
            <li><span>성능가동률</span><b>{{ formatNumber(r?.oee.performance, 1) }}</b></li>
            <li><span>양품률</span><b>{{ formatNumber(r?.oee.quality, 1) }}</b></li>
          </ul>
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="불량 제외 합계" :value="r?.ngTotal" sub="공정 검사 + 출고 비전" />
        </SummaryBlock>
      </SummaryColumn>

      <div class="main">
        <div class="row">
          <BasePanel title="라인별 실적" meta="라인 계획 = 목표 ÷ 6">
            <BaseTable label="라인별 실적" :columns="LINE_COLS" :rows="lineRows" :row-key="(x) => x.key">
              <template #cell-lineId="{ row }"><span :class="{ paint: row.lineId === 'PT' }">{{ row.name }}</span></template>
              <template #cell-plan="{ row }"><span class="n">{{ formatNumber(row.plan) }}</span></template>
              <template #cell-done="{ row }"><b class="n">{{ formatNumber(row.done) }}</b></template>
              <template #cell-rate="{ row }"><span class="n">{{ pct(row.rate) }}</span></template>
              <template #cell-oee="{ row }"><span class="n">{{ pct(row.oee) }}</span></template>
              <template #cell-ng="{ row }"><span class="n">{{ formatNumber(row.ng) }}</span></template>
            </BaseTable>
          </BasePanel>
          <BasePanel title="공정별 생산량 · 불량 · 재공" :meta="r?.closed ? '공정 검사 기준 · 재공은 24:00 마감 시점' : '공정 검사 기준 · 재공은 지금'">
            <div class="scroll">
              <BaseTable label="공정별 생산량과 불량" :columns="PROC_COLS" :rows="d.processRows.value" :row-key="(x) => x.key">
                <template #cell-output="{ row }"><span class="n">{{ formatNumber(row.output) }}</span></template>
                <template #cell-ng="{ row }"><b class="n">{{ formatNumber(row.ng) }}</b></template>
                <template #cell-rate="{ row }"><span class="n">{{ pct(row.rate) }}</span></template>
                <template #cell-wip="{ row }"><span class="n">{{ formatNumber(row.wip) }}</span><small class="unit">{{ row.wipUnit }}</small></template>
              </BaseTable>
              <div v-if="d.processRows.value.length" class="total"><span>불량 합계</span><b class="n">{{ formatNumber(ngSum) }}</b></div>
            </div>
          </BasePanel>
        </div>
        <!-- 아래 줄 전체 폭: 코드가 7개까지라 두 열로 (낮은 창에서도 한 칸에 들어간다) -->
        <BasePanel title="비가동 코드별 시간 · 건수" meta="39대 합계 · 계획정지는 회색 · 시간 많은 순">
          <ChartBarList v-if="d.downtime.value.length" label="비가동 코드별 시간" :rows="d.downtime.value" :columns="2">
            <template #lead="{ row }"><StatusKey :state="stateOf(row.key)" size="sm" /></template>
          </ChartBarList>
          <BaseEmpty v-else />
        </BasePanel>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  white-space: nowrap;
}

.note a {
  color: var(--c-accent);
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

  /* 위 줄은 표 높이만큼 (라인 7줄), 남는 높이는 아래 줄 */
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.sub {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.mini {
  margin: var(--sp-2) 0 0;
  padding: 0;
  list-style: none;
}

.mini li,
.total {
  display: flex;
  justify-content: space-between;
  padding: var(--sp-1) 0;
  font-size: var(--fs-label);
}

.mini span,
.total span {
  color: var(--c-ink-2);
}

.n {
  font-variant-numeric: tabular-nums;
}

b.n {
  font-weight: var(--fw-strong);
}

.paint {
  color: var(--c-ink-2);
}

.unit {
  margin-left: 2px;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}

.scroll {
  min-height: 0;
  overflow-y: auto;
}

.total {
  flex: none;
  padding: var(--sp-2) 0 0;
  font-size: var(--fs-body);
}

</style>
