<!-- SCR-010 라인 상세 (화면정의서 3장 SCR-010, DESIGN.md Layout "라인 상세")
     왼쪽 열 전체: 라인 요약. 오른쪽 위: 라인 흐름(주인공). 아래 가운데: 시간대별 라인 생산, 아래 오른쪽: 라인 오늘 알림 -->
<script setup lang="ts">
import { PROCESS_NAME } from '@/lib/status'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import SummaryColumn from '@/components/domain/SummaryColumn.vue'
import SummaryBlock from '@/components/domain/SummaryBlock.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import StatusCounts from '@/components/domain/StatusCounts.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import LineFlow from '@/components/domain/LineFlow.vue'
import AlertList from '@/components/domain/AlertList.vue'
import { useLineDetail } from '@/composables/useLineDetail'
import { useTodayProduction } from '@/composables/useTodayProduction'
import { useTodayAlerts } from '@/composables/useTodayAlerts'
import { useMaster } from '@/composables/useMaster'
import { equipmentPath, processPath } from '@/lib/routes'
import { formatNumber } from '@/lib/format'
import type { LineId, ProcessId } from '@/types/plant'
import type { AlertRowView } from '@/types/view'

const LINES: LineId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'PT']
const lineLabel = (id: LineId) => (id === 'PT' ? '도장' : id)

const route = useRoute()
const router = useRouter()
// 라인 탭을 바꾸면 주소가 바뀌고 화면을 새로 만든다 (AppShell RouterView key)
const lineId = route.params.lineId as LineId
const name = lineLabel(lineId)

const { flow, now } = useLineDetail(lineId)
const production = useTodayProduction(lineId)
const { rows: alerts, ongoingCount } = useTodayAlerts({ area: lineId })
const { equipmentById } = useMaster()

const tabs = LINES.map((id) => ({ key: id, label: lineLabel(id), to: `/lines/${id}` }))

const yMax = computed(() => production.target.value ?? Math.max(10, ...production.actual.value.map((p) => p[1])))
const yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => Math.round((yMax.value * i) / 4)))
const xTicks = [0, 6, 12, 18, 24].map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}시` }))

function openEquipment(id: string) {
  const e = equipmentById.value.get(id)
  if (e) router.push(equipmentPath(e))
}
const openGroup = (p: ProcessId) => router.push(processPath(lineId, p))
const openAlert = (r: AlertRowView) => (r.kind === 'risk' ? router.push({ path: '/pdm', query: { eq: r.equipmentId } }) : openEquipment(r.equipmentId))
const openReport = (r: AlertRowView) => router.push(r.reportId ? `/reports/replan/${r.reportId}` : `/reports/replan?create=${r.id}`)
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: name }]" />
      <BaseTabs :items="tabs" :active="lineId" label="라인" />
    </template>

    <div class="layout">
      <SummaryColumn class="sum" :title="`${name} 지금`" :meta="`설비 ${now.equipmentCount}대 · 오늘 누적`" spread>
        <!-- 대표 상태 + 상태별 대수 (시안 B-line): 큰 열쇠 칸과 명칭, 오른쪽에 흐린 이름표. 아래 2×2 대수 -->
        <SummaryBlock class="now">
          <div class="rep">
            <StatusKey :state="now.state" size="xl" label />
            <span class="cap">라인 대표 상태</span>
          </div>
          <StatusCounts :counts="now.counts" big />
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="오늘 라인 실적 / 라인 계획" :value="now.done" :suffix="now.plan != null ? `/ ${formatNumber(now.plan)}` : undefined" size="lg" />
          <template v-if="now.plan != null">
            <ChartProgress :percent="now.rate" :label="`달성률 ${formatNumber(now.rate, 1)}%`" />
            <span class="sub">달성률 {{ formatNumber(now.rate, 1) }}%</span>
          </template>
          <span v-else class="unset">목표 미설정</span>
        </SummaryBlock>
        <SummaryBlock>
          <BaseFigure label="라인 OEE" :value="now.oee" :digits="1" unit="%" />
        </SummaryBlock>
        <SummaryBlock>
          <!-- 숫자 옆에 공정별 개수 (검사 위치 설명은 마우스를 올리면) -->
          <div class="ngrow">
            <BaseFigure label="오늘 불량 제외" :value="now.ngTotal" />
            <ul class="ng" aria-label="공정별 불량 제외">
              <li v-for="r in now.ngRows" :key="r.process" :title="r.label"><span>{{ PROCESS_NAME[r.process] }}</span><b>{{ r.value }}</b></li>
            </ul>
          </div>
        </SummaryBlock>
      </SummaryColumn>

      <BasePanel class="flowp" title="라인 흐름" meta="공정 이름이나 설비 칸을 누르면 공정 상세">
        <template #tools><StateLegend pdm /></template>
        <LineFlow v-if="flow" :view="flow" :line-name="name" @open-cell="openEquipment" @open-group="openGroup" />
        <BaseEmpty v-else />
      </BasePanel>

      <BasePanel class="chartp" title="시간대별 라인 생산" meta="00시~24시 누적">
        <template #tools>
          <ChartLegend :items="[{ label: '라인 실적', kind: 'main' }, { label: production.target.value != null ? `라인 계획 ${formatNumber(production.target.value)}` : '라인 계획', kind: 'ref' }]" />
        </template>
        <ChartLine
          v-if="production.loaded.value"
          :label="`${name} 시간대별 누적 실적과 라인 계획`"
          :x="[0, 24]"
          :y="[0, yMax]"
          :x-ticks="xTicks"
          :y-ticks="yTicks"
          :series="[{ key: 'actual', points: production.actual.value }, { key: 'plan', kind: 'ref', points: production.plan.value }]"
          :now="production.nowHour.value"
          end-dot
        />
        <BaseEmpty v-else />
      </BasePanel>

      <BasePanel class="alerts" :title="`${name} 오늘 알림`" :meta="`${alerts.length}건 · 진행 중 ${ongoingCount}`" flush>
        <AlertList :rows="alerts" @open="openAlert" @report="openReport" />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
/* 요약 열 | 가운데 | 오른쪽 열. 위 줄(라인 흐름)이 아래 줄보다 크다 */
.layout {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr) var(--col-side);
  grid-template-rows: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.sum {
  grid-row: 1 / 3;
  grid-column: 1;
}

.flowp {
  grid-row: 1;
  grid-column: 2 / 4;
}

.chartp {
  grid-row: 2;
  grid-column: 2;
}

.alerts {
  grid-row: 2;
  grid-column: 3;
}

.now {
  gap: var(--sp-5);
}

.rep {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.cap {
  margin-left: auto;
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.sub {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.unset {
  color: var(--c-caution-ink);
  font-size: var(--fs-body);
}

.ng {
  display: grid;
  flex: 1;
  gap: var(--sp-1);
  max-width: 10em;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
}

.ngrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-5);
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

/* 낮은 창 (1440×810, 1536×730 등): 요약 열 큰 숫자를 한 단계 줄여 열 안 스크롤이 생기지 않게. 라인 흐름 칸은 칸 안에서 줄인다 (EquipCell) */
@media (height <= 860px) {
  .sum :deep(.fig.lg .value) {
    font-size: var(--fs-figure);
  }
}
</style>
