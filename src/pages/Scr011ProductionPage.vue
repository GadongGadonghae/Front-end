<!-- SCR-011 생산 조회 (화면정의서 SCR-011, DESIGN.md Layout "분석 화면": 제품 내역 표가 가운데 가장 큰 칸, 라인별·시간대별은 오른쪽 열)
     제목 줄: 조회 조건. 왼쪽 열: 생산 요약. 가운데: 제품 내역(행을 누르면 공정별 기록). 오른쪽: 라인별 계획 대비 → 기간 추이 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BasePager from '@/components/base/BasePager.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartColumns from '@/components/charts/ChartColumns.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import SummaryColumn from '@/components/domain/SummaryColumn.vue'
import SummaryBlock from '@/components/domain/SummaryBlock.vue'
import ProcessSteps from '@/components/domain/ProcessSteps.vue'
import { useProduction, type ResultFilter } from '@/composables/useProduction'
import { niceTicks } from '@/lib/chart'
import { formatNumber } from '@/lib/format'
import type { Period } from '@/types/analysis'
import type { LineId } from '@/types/plant'

const route = useRoute()
// 공정 검사·출고 불량 목록에서 제품 ID를 눌러 들어오면 그 제품을 찾아 둔다 (D-88)
const p = useProduction(typeof route.query.q === 'string' ? route.query.q : '')
const { period, date, lineId, result, q, page } = p
const s = computed(() => p.summary.value)
// 이미 이 화면에 있을 때 다른 제품 링크로 오면 (주소 쿼리만 바뀜) 다시 찾는다
watch(() => route.query.q, (v) => { if (typeof v === 'string' && v) p.findProduct(v) })

const PERIODS: { value: Period; label: string }[] = [{ value: 'day', label: '일' }, { value: 'week', label: '주' }, { value: 'month', label: '월' }]
const LINES: { value: '' | LineId; label: string }[] = [{ value: '', label: '전체' }, ...(['A', 'B', 'C', 'D', 'E', 'F'] as LineId[]).map((l) => ({ value: l, label: `${l}라인` }))]
const RESULTS: { value: ResultFilter; label: string }[] = [{ value: 'all', label: '전체' }, { value: 'ok', label: '양품 출고' }, { value: 'ng', label: '불량 제외' }, { value: 'wip', label: '진행 중' }]

const columns = computed<TableColumn[]>(() => [
  { key: 'id', label: '제품 ID', width: '11.5em' },
  { key: 'lineId', label: '라인', width: '3.5em' },
  { key: 'inputAt', label: '투입', width: p.multiDay.value ? '8.5em' : '6.5em' },
  { key: 'doneAt', label: '완료', width: p.multiDay.value ? '8.5em' : '6.5em' },
  { key: 'steps', label: '거친 공정' },
  { key: 'result', label: '결과', width: '10em' },
])
const DETAIL_COLS: TableColumn[] = [
  { key: 'process', label: '공정', width: '5em' },
  { key: 'equipment', label: '설비', width: '9em' },
  { key: 'time', label: '통과 시각', width: '13em' },
  { key: 'judgement', label: '검사 판정', width: '6em' },
  { key: 'reason', label: '불량 사유' },
]

// 기간 추이: 일 = 시간대별 누적 실적 vs 계획선, 주·월 = 일별 실적 막대 vs 계획선
const trend = computed(() => {
  const t = s.value?.trend ?? []
  if (s.value?.trendKind === 'daily') {
    const days = period.value === 'week' ? 7 : new Date(Number(date.value.slice(0, 4)), Number(date.value.slice(5, 7)), 0).getDate()
    const first = Date.parse(s.value.from)
    const labels = Array.from({ length: days }, (_, i) => { const d = new Date(first + i * 86_400_000); return `${d.getMonth() + 1}/${d.getDate()}` })
    const plan = t[0]?.plan ?? null
    const y = niceTicks(0, Math.max(plan ?? 0, ...t.map((x) => x.done)) * 1.1, 4)
    return { kind: 'daily' as const, days, labels, values: t.map((x) => x.done), plan, y }
  }
  const actual = t.map((x): [number, number] => [x.x, x.done])
  const planPts = t.length && t[0].plan != null ? [[0, 0], [24, (s.value?.plan ?? 0)]] as [number, number][] : []
  const y = niceTicks(0, Math.max(s.value?.plan ?? 0, ...actual.map((a) => a[1]), 10), 4)
  return { kind: 'hourly' as const, actual, planPts, y }
})
// 추이 패널: 실적(계획 대비) / 양품률 (백엔드 U-11)
const VIEWS = [{ value: 'done' as const, label: '실적' }, { value: 'yield' as const, label: '양품률' }]
const view = ref<'done' | 'yield'>('done')
const yieldChart = computed(() => {
  const t = (s.value?.yieldTrend ?? []).filter((x) => x.rate != null)
  const points = t.map((x, i): [number, number] => [i, x.rate!])
  const every = t.length > 10 ? 5 : 1
  return {
    points,
    x: [0, Math.max(1, t.length - 1)] as [number, number],
    xTicks: t.map((x, i) => ({ value: i, label: x.label })).filter((_, i) => i % every === 0),
    y: niceTicks(Math.min(90, ...points.map((p) => p[1])), 100, 4),
  }
})
const xHours = [0, 6, 12, 18, 24].map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}시` }))
const nowHour = computed(() => (date.value === p.today ? s.value?.trend.at(-1)?.x : undefined))
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">생산 조회</h1>
      <div class="filters">
        <span class="field"><span class="lab">기간</span><BaseSegmented v-model="period" label="기간" :options="PERIODS" /></span>
        <BaseDateField v-model="date" label="날짜" :max="p.today" />
        <BaseSelect v-model="lineId" label="라인" :options="LINES" />
        <BaseSelect v-model="result" label="결과" :options="RESULTS" />
        <span class="field search">
          <BaseInput v-model="q" label="제품 ID" type="search" size="md" placeholder="예: C-20261116-0412" />
        </span>
      </div>
    </template>

    <div class="layout">
      <SummaryColumn title="생산 요약" :meta="p.rangeText.value">
        <SummaryBlock>
          <BaseFigure label="실적 (출고 양품) / 계획" :value="s?.done" :suffix="s?.plan != null ? `/ ${formatNumber(s.plan)}` : undefined" size="lg" />
          <template v-if="s?.plan != null">
            <ChartProgress :percent="s.rate" :label="`달성률 ${formatNumber(s.rate, 1)}%`" />
            <span class="sub">달성률 {{ formatNumber(s.rate, 1) }}%</span>
          </template>
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="투입" :value="s?.input" :sub="s ? `진행 중 ${formatNumber(s.wip)}` : undefined" />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="양품률" :value="s?.yieldRate" :digits="1" unit="%" sub="출고 양품 ÷ 생산 (생산 = 양품 + 불량)" />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="불량 제외" :value="p.ngTotal.value" />
          <ul class="ng">
            <li v-for="r in p.ngRows.value" :key="r.process"><span>{{ r.label }}</span><b>{{ r.value }}</b></li>
          </ul>
        </SummaryBlock>
      </SummaryColumn>

      <BasePanel class="products" title="제품 내역" meta="투입 최근순 · 행을 누르면 공정별 기록">
        <BaseTable
          :columns="columns"
          :rows="p.list.value?.items ?? []"
          :row-key="(r) => r.id"
          label="제품 내역"
          clickable
          :expanded-key="p.openId.value"
          :empty="p.tooOld.value ? '90일이 지난 기간은 제품 내역이 없습니다' : p.list.value ? '데이터 없음' : '불러오는 중'"
          @row-click="(r) => p.toggle(r.id)"
        >
          <template #cell-id="{ row }"><span class="pid">{{ row.id }}</span></template>
          <template #cell-inputAt="{ row }">{{ p.timeText(row.inputAt) }}</template>
          <template #cell-doneAt="{ row }">{{ p.timeText(row.doneAt) }}</template>
          <template #cell-steps="{ row }"><ProcessSteps :steps="row.steps" /></template>
          <template #cell-result="{ row }"><span :class="['res', row.result]">{{ p.resultText(row) }}</span></template>
          <template #expand>
            <BaseTable v-if="p.detail.value" class="detail" :columns="DETAIL_COLS" :rows="p.detailRows.value" :row-key="(r) => r.key" label="공정별 기록">
              <template #cell-judgement="{ row }"><span :class="{ bad: row.ng }">{{ row.judgement }}</span></template>
            </BaseTable>
            <BaseEmpty v-else text="불러오는 중" />
          </template>
        </BaseTable>
        <BasePager v-if="p.list.value && p.list.value.total > 0" v-model="page" :total="p.list.value.total" :size="p.list.value.size" />
      </BasePanel>

      <div class="side">
        <BasePanel title="라인별 계획 대비" :meta="p.linePlan.value != null ? `세로선 = 라인 계획 ${formatNumber(p.linePlan.value)}` : '라인 계획 없음'">
          <ChartBarList
            v-if="p.lineBars.value.length"
            label="라인별 실적과 라인 계획"
            :rows="p.lineBars.value"
            :marker="p.linePlan.value ?? undefined"
            :max="Math.max(p.linePlan.value ?? 0, ...p.lineBars.value.map((b) => b.value ?? 0)) * 1.08"
            clickable
            @pick="(r) => p.pickLine(r.key)"
          />
          <BaseEmpty v-else />
        </BasePanel>

        <BasePanel :title="view === 'yield' ? '일별 양품률' : trend.kind === 'daily' ? '일별 실적' : '시간대별 누적 실적'" :meta="view === 'yield' ? (period === 'day' ? '그날까지 7일' : period === 'week' ? '이번 주' : '이번 달') : trend.kind === 'daily' ? (period === 'week' ? '이번 주' : '이번 달') : '00시~24시'">
          <template #tools>
            <BaseSegmented v-model="view" label="추이 종류" size="sm" :options="VIEWS" />
          </template>
          <ChartLegend v-if="view === 'done'" class="legend" :items="[{ label: '실적', kind: 'main' }, { label: '계획', kind: 'ref' }]" />
          <template v-if="view === 'yield'">
            <ChartLine
              v-if="yieldChart.points.length"
              label="일별 양품률"
              :x="yieldChart.x"
              :y="yieldChart.y.domain"
              :x-ticks="yieldChart.xTicks"
              :y-ticks="yieldChart.y.ticks"
              :y-digits="1"
              :series="[{ key: 'yield', points: yieldChart.points }]"
              end-dot
            />
            <BaseEmpty v-else />
          </template>
          <template v-else-if="trend.kind === 'daily'">
            <ChartColumns
              v-if="trend.values.length"
              label="일별 실적과 하루 계획"
              :count="trend.days"
              :values="trend.values"
              :labels="trend.labels"
              :y-ticks="trend.y.ticks"
              :ref-value="trend.plan"
              :every="trend.days > 10 ? 5 : 1"
            />
            <BaseEmpty v-else />
          </template>
          <template v-else>
            <ChartLine
              v-if="trend.actual.length"
              label="시간대별 누적 실적과 계획선"
              :x="[0, 24]"
              :y="trend.y.domain"
              :x-ticks="xHours"
              :y-ticks="trend.y.ticks"
              :series="[{ key: 'actual', points: trend.actual }, { key: 'plan', kind: 'ref', points: trend.planPts }]"
              :now="nowHour"
              end-dot
            />
            <BaseEmpty v-else />
          </template>
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
  font-size: var(--fs-label);
}

/* 검색: 이름표를 왼쪽에 (다른 필터와 같은 모양) */
.search :deep(.field) {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.search :deep(input) {
  width: 16em;
}

/* 요약 열 | 제품 내역(가장 큼) | 오른쪽 열 */
.layout {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr) var(--col-side);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.products {
  min-width: 0;
}

.side {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.sub {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.ng {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
}

.ng li {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
}

.ng b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.pid {
  font-weight: var(--fw-strong);
}

.res.ng {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.res.wip {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.detail {
  max-height: none;
}

.detail :deep(th) {
  position: static;
  background: transparent;
}

.bad {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.legend {
  flex: none;
  margin-bottom: var(--sp-2);
}
</style>
