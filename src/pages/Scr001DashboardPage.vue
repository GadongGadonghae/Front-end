<!-- SCR-001 메인 대시보드 (화면정의서 3장 SCR-001, DESIGN.md Layout "대시보드")
     왼쪽: 공장 배치도(가장 큼) → 오늘 생산 · 종합 가동률 · 품질 3칸. 오른쪽 세로 열 전체: 알림 (D-46)
     설비 대수는 배치도 범례에 함께 적는다. 화면은 조립만 하고 값은 composable이 만든다 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import ChartBarList, { type BarRow } from '@/components/charts/ChartBarList.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import FactoryMap from '@/components/domain/FactoryMap.vue'
import AlertList from '@/components/domain/AlertList.vue'
import { useFactoryMap } from '@/composables/useFactoryMap'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { useTodayProduction } from '@/composables/useTodayProduction'
import { useTodayAlerts } from '@/composables/useTodayAlerts'
import { useMaster } from '@/composables/useMaster'
import { equipmentPath, linePath } from '@/lib/routes'
import { formatNumber } from '@/lib/format'
import type { AlertRowView } from '@/types/view'

const router = useRouter()
const { view: map, counts } = useFactoryMap()
const summary = useLiveSummary()
const production = useTodayProduction()
const { rows: alerts, ongoingCount } = useTodayAlerts()
const { equipmentById } = useMaster()

const mode = ref<'2d' | '3d'>('2d')
const plant = computed(() => summary.value?.plant ?? null)

// 오늘 생산: 계획선 기준 y 눈금
const yMax = computed(() => production.target.value ?? Math.max(10, ...production.actual.value.map((p) => p[1])))
const yTicks = computed(() => [0, 1, 2, 3].map((i) => Math.round((yMax.value * i) / 3)))
const xTicks = [0, 6, 12, 18, 24].map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}시` }))

// 종합 가동률 3요소 (OEE = 시간 × 성능 × 양품, D-21)
const oeeRows = computed<BarRow[]>(() => {
  const o = plant.value?.oee
  const row = (key: string, label: string, v: number | null | undefined): BarRow => ({ key, label, value: v ?? null, display: v == null ? '-' : v.toFixed(1) })
  return [row('a', '시간가동률', o?.availability), row('p', '성능가동률', o?.performance), row('q', '양품률', o?.quality)]
})

// 품질: 공정별 불량 수 (공정 검사), 많은 순
const PROCESS_NAME: Record<string, string> = { SLITTING: '슬리팅', PRESS: '프레스', WELDING: '용접', PAINTING: '도장' }
const ngRows = computed<BarRow[]>(() =>
  Object.entries(plant.value?.quality.ngByProcess ?? {})
    .map(([p, n]): BarRow => ({ key: p, label: PROCESS_NAME[p], value: n ?? 0 }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
)

function openAlert(r: AlertRowView) {
  // 예지보전 위험 건은 예지보전 화면에서 그 설비를 골라 연다
  if (r.kind === 'risk') { router.push({ path: '/pdm', query: { eq: r.equipmentId } }); return }
  const e = equipmentById.value.get(r.equipmentId)
  if (e) router.push(equipmentPath(e))
}
function openReport(r: AlertRowView) {
  router.push(r.reportId ? `/reports/replan/${r.reportId}` : `/reports/replan?create=${r.id}`)
}
</script>

<template>
  <div class="dash">
    <h1 class="sr-only">대시보드</h1>
    <div class="main">
      <BasePanel title="공장 배치도" meta="설비 39대">
        <template #tools>
          <StateLegend :counts="counts" pdm />
          <BaseSegmented v-model="mode" label="보기" size="sm" :options="[{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }]" />
        </template>
        <FactoryMap
          v-if="mode === '2d' && map"
          :view="map"
          @open-line="(id) => router.push(linePath(id))"
          @open-inbound="router.push('/inbound')"
          @open-outbound="router.push('/outbound')"
        />
        <BaseEmpty v-else-if="mode === '3d'" text="3D 공장은 나중에 설계합니다 (D-62)" />
        <BaseEmpty v-else />
      </BasePanel>

      <div class="lower">
        <BasePanel class="go" @click="router.push('/production')">
          <!-- 패널 전체는 마우스로, 제목 링크는 키보드로 생산 조회에 간다 -->
          <template #head>
            <h2><RouterLink class="title-link" to="/production" @click.stop>오늘 생산</RouterLink></h2>
            <span class="meta">실적 = 출고 양품</span>
          </template>
          <template #tools><ChartLegend :items="[{ label: '실적', kind: 'main' }, { label: '목표', kind: 'ref' }]" /></template>
          <!-- 숫자는 왼쪽 세로 열, 그래프는 오른쪽: 그래프가 칸 높이를 거의 다 쓴다 (숫자 아래 쌓으면 낮은 창에서 납작해짐) -->
          <div class="prod">
            <div class="figs">
              <BaseFigure label="실적" :value="plant?.done" size="lg" />
              <div v-if="plant && plant.target != null" class="figs-sub">
                <BaseFigure label="목표" :value="plant.target" size="sm" />
                <BaseFigure label="달성률" :value="plant.rate" :digits="1" unit="%" size="sm" />
              </div>
              <p v-else-if="plant" class="unset">목표 미설정 <RouterLink to="/settings/target" @click.stop>목표 입력</RouterLink></p>
            </div>
            <ChartLine
              label="오늘 시간대별 누적 실적과 목표선"
              :x="[0, 24]"
              :y="[0, yMax]"
              :x-ticks="xTicks"
              :y-ticks="yTicks"
              :series="[{ key: 'actual', points: production.actual.value }, { key: 'plan', kind: 'ref', points: production.plan.value }]"
              :now="production.nowHour.value"
              end-dot
            />
          </div>
        </BasePanel>

        <BasePanel title="종합 가동률" meta="오늘 · OEE">
          <BaseFigure label="OEE" :value="plant?.oee.oee" :digits="1" unit="%" size="lg" />
          <div class="parts"><ChartBarList label="OEE 3요소" :rows="oeeRows" :max="100" /></div>
        </BasePanel>

        <BasePanel title="품질" meta="오늘 · 출고 불량률">
          <!-- 양품·불량은 큰 숫자 옆에 붙여 한 줄을 아낀다 -->
          <div class="lead">
            <BaseFigure label="출고 불량률" :value="plant?.quality.outbound.rate" :digits="1" unit="%" size="lg" />
            <span v-if="plant" class="lead-sub">양품 {{ formatNumber(plant.quality.outbound.ok) }}<br>불량 {{ formatNumber(plant.quality.outbound.ng) }}</span>
          </div>
          <div class="parts"><ChartBarList label="공정별 불량 수" :rows="ngRows" /></div>
        </BasePanel>
      </div>
    </div>

    <BasePanel class="alerts" title="알림" :meta="`오늘 ${alerts.length}건 · 진행 중 ${ongoingCount}`" flush>
      <AlertList :rows="alerts" @open="openAlert" @report="openReport" />
    </BasePanel>
  </div>
</template>

<style scoped>
.dash {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--col-side);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

/* 배치도 : 아래 3칸 = 1.75 : 1. 아래 칸은 낮아져도 들어가도록 칸 안 배치를 옆으로 놓는다 */
.main {
  display: grid;
  grid-template-rows: minmax(0, 1.75fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-width: 0;
  min-height: 0;
}

.lower {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.go {
  cursor: pointer;
}

.go h2 {
  font-size: var(--fs-title);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.go .meta {
  color: var(--c-ink-3);
  font-size: var(--fs-body);
  white-space: nowrap;
}

/* 누르는 높이 24px 이상 (WCAG 2.5.8) */
.title-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--sp-6);
  text-decoration: none;
}

.title-link:hover {
  text-decoration: underline;
}

/* 오늘 생산: 왼쪽 숫자 열 | 오른쪽 그래프 */
.prod {
  display: grid;
  flex: 1;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--sp-6);
  min-height: 0;
}

.figs {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--sp-3);
}

.figs-sub {
  display: flex;
  gap: var(--sp-5);
}

.prod :deep(.chart) {
  min-height: 0;
}

/* 품질: 큰 숫자 + 옆에 양품·불량 */
.lead {
  display: flex;
  flex: none;
  align-items: flex-end;
  gap: var(--sp-4);
}

.lead-sub {
  padding-bottom: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  line-height: var(--lh-body);
}

.unset {
  color: var(--c-caution-ink);
  font-size: var(--fs-body);
}

/* 큰 숫자 아래 구분선 + 세 요소·공정별 막대를 남은 높이에 펼침 */
.parts {
  display: flex;
  flex: 1;
  min-height: 0;
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: var(--line-w) solid var(--c-line);
}

/* 낮은 창(1440×810 등): 아래 3칸이 낮아지므로 큰 숫자와 간격을 한 단계 줄인다 */
@media (height <= 860px) {
  .lower :deep(.fig.lg .value) {
    font-size: var(--fs-figure);
  }

  .parts {
    margin-top: var(--sp-2);
    padding-top: var(--sp-2);
  }

  .parts :deep(.bars) {
    gap: 0 var(--sp-3);
  }
}
</style>
