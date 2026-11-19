<!-- SCR-001 메인 대시보드 (화면정의서 3장 SCR-001)
     11/18 변경: 첫 화면은 3D 공장만 크게. 오늘 생산 · 종합 가동률 · 품질은 왼쪽 카드 열.
     알림 열(D-46)은 뺐다 (고장은 토스트·헤더 알림으로). 2D 전환은 없앰 (3D 탑뷰로 대신)
     설비 대수는 배치도 범례에 함께 적는다. 화면은 조립만 하고 값은 composable이 만든다 -->
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartBarList, { type BarRow } from '@/components/charts/ChartBarList.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import { useFactoryMap } from '@/composables/useFactoryMap'
import { useFactory3d } from '@/composables/useFactory3d'
import { useLiveSummary } from '@/composables/useLiveSummary'
import { linePath } from '@/lib/routes'
import { formatNumber } from '@/lib/format'

const router = useRouter()
const { counts } = useFactoryMap()
const summary = useLiveSummary()
const f3d = useFactory3d()
// 3D(three.js)는 무거워서 3D를 고를 때만 받는다
const Factory3D = defineAsyncComponent(() => import('@/components/domain/Factory3D.vue'))

const plant = computed(() => summary.value?.plant ?? null)

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

</script>

<template>
  <div class="dash">
    <h1 class="sr-only">대시보드</h1>
    <div class="cards">
      <BasePanel class="go" title="오늘 생산" meta="실적 = 출고 양품" @click="router.push('/production')">
        <div class="lead">
          <BaseFigure label="실적" :value="plant?.done" size="lg" />
          <div v-if="plant && plant.target != null" class="figs-sub">
          <BaseFigure label="목표" :value="plant.target" size="sm" />
          <BaseFigure label="달성률" :value="plant.rate" :digits="1" unit="%" size="sm" />
          </div>
        </div>
        <p v-if="plant && plant.target == null" class="unset">목표 미설정 <RouterLink to="/settings/target" @click.stop>목표 입력</RouterLink></p>
      </BasePanel>

      <BasePanel class="go" title="종합 가동률" meta="오늘 · OEE" @click="router.push('/utilization')">
        <BaseFigure :value="plant?.oee.oee" :digits="1" unit="%" size="lg" />
        <div class="parts"><ChartBarList label="OEE 3요소" :rows="oeeRows" :max="100" /></div>
      </BasePanel>

      <BasePanel class="go" title="품질" meta="오늘 · 출고 불량률" @click="router.push('/outbound')">
        <div class="lead">
          <BaseFigure :value="plant?.quality.outbound.rate" :digits="1" unit="%" size="lg" />
          <span v-if="plant" class="lead-sub">양품 {{ formatNumber(plant.quality.outbound.ok) }}<br>불량 {{ formatNumber(plant.quality.outbound.ng) }}</span>
        </div>
        <div class="parts"><ChartBarList label="공정별 불량 수" :rows="ngRows" /></div>
      </BasePanel>
    </div>

    <BasePanel title="공장 배치도" meta="설비 39대">
      <template #tools>
        <StateLegend :counts="counts" pdm />
      </template>
      <Factory3D
        v-if="f3d.view.value"
        v-bind="f3d.view.value"
        :flow="f3d.flow.value"
        :now="f3d.now.value"
        @open-line="(id) => router.push(linePath(id))"
        @open-outbound="router.push('/outbound')"
        @open-inbound="router.push('/inbound')"
        @open-action="(id) => router.push({ path: '/alarms', query: { eq: id } })"
      />
      <BaseEmpty v-else />
    </BasePanel>
  </div>
</template>

<style scoped>
/* 왼쪽 카드 열(고정) | 공장 배치도(3D) */
.dash {
  display: grid;
  grid-template-columns: var(--col-side) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.cards {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.go {
  cursor: pointer;
}

/* 큰 숫자 오른쪽에 보조 숫자를 둔다: 세로로 쌓지 않아 좁은 화면(1536×730)에서도 스크롤이 생기지 않게 */
.figs-sub {
  display: flex;
  gap: var(--sp-5);
  padding-bottom: var(--sp-1);
}

.lead {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-4) var(--sp-6);
}

.lead-sub {
  padding-bottom: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  line-height: var(--lh-body);
}

.unset {
  color: var(--c-caution-ink);
  font-size: var(--fs-md);
}

.parts {
  display: flex;
  flex: 1;
  min-height: 0;
  margin-top: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: var(--line-w) solid var(--c-line);
}

</style>
