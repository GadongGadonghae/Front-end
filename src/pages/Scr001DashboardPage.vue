<!-- SCR-001 메인 대시보드 (화면정의서 3장 SCR-001)
     11/18 변경: 첫 화면은 3D 공장만 크게. 오늘 생산 · 종합 가동률 · 품질은 왼쪽 카드 열.
     알림 열(D-46)은 뺐다 (고장은 토스트·헤더 알림으로). 2D 전환은 없앰 (3D 탑뷰로 대신)
     D-118 왼쪽 카드 다시 설계: 핵심 숫자를 조금 크게(--fs-kpi). 생산 = 실적 / 목표 + 달성률 진행,
     종합 가동률 = 게이지 + 3요소 곱셈(시간 × 성능 × 양품), 품질 = 출고 불량률 + 공정 검사 불량 몫 막대(공정 순서, 공정 색)
     설비 대수는 배치도 범례에 함께 적는다. 화면은 조립만 하고 값은 composable이 만든다 -->
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseNumber from '@/components/base/BaseNumber.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartGauge from '@/components/charts/ChartGauge.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import ChartStackBar, { type StackPart } from '@/components/charts/ChartStackBar.vue'
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

// 종합 가동률 3요소 (OEE = 시간 × 성능 × 양품, D-21). 막대 대신 곱셈 식으로 (D-118)
const oeeParts = computed(() => {
  const o = plant.value?.oee
  return [
    { key: 'a', label: '시간가동률', value: o?.availability },
    { key: 'p', label: '성능가동률', value: o?.performance },
    { key: 'q', label: '양품률', value: o?.quality },
  ]
})

// 품질: 공정 검사 불량을 공정 순서로 (색 = 공정 색, 제품 여정과 같은 색). 몫 막대 + 숫자 4칸
const PROCS = [
  { key: 'SLITTING', name: '슬리팅', color: 'var(--c-proc-1)' },
  { key: 'PRESS', name: '프레스', color: 'var(--c-proc-2)' },
  { key: 'WELDING', name: '용접', color: 'var(--c-proc-3)' },
  { key: 'PAINTING', name: '도장', color: 'var(--c-proc-4)' },
] as const
const ng = computed(() => {
  const by = plant.value?.quality.ngByProcess ?? {}
  const rows = PROCS.map((p) => ({ ...p, value: by[p.key] ?? null }))
  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0)
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0))
  return {
    total,
    rows: rows.map((r) => ({ ...r, share: total && r.value != null ? (r.value / total) * 100 : null, top: !!max && r.value === max })),
    parts: rows.map((r): StackPart => ({ key: r.key, value: r.value ?? 0, color: r.color, title: `${r.name} ${formatNumber(r.value)}개` })),
  }
})
</script>

<template>
  <div class="dash">
    <h1 class="sr-only">대시보드</h1>
    <div class="cards">
      <BasePanel class="go" title="오늘 생산" meta="실적 = 출고 양품" @click="router.push('/production')">
        <div class="row">
          <p class="kpi"><BaseNumber :value="plant?.done" /><small v-if="plant?.target != null" class="of">/ {{ formatNumber(plant.target) }}</small></p>
          <p v-if="plant?.target != null" class="side-fig">
            <span class="lab">달성률</span>
            <b><BaseNumber :value="plant.rate" :digits="1" unit="%" /></b>
          </p>
        </div>
        <ChartProgress v-if="plant?.target != null" class="prog" :percent="plant.rate" :label="`달성률 ${formatNumber(plant.rate, 1)}%`" />
        <p v-if="plant && plant.target == null" class="unset">목표 미설정 <RouterLink to="/settings/target" @click.stop>목표 입력</RouterLink></p>
      </BasePanel>

      <BasePanel class="go" title="종합 가동률" meta="오늘 · OEE" @click="router.push('/utilization')">
        <div class="oee">
          <ChartGauge :value="plant?.oee.oee" :label="`OEE ${formatNumber(plant?.oee.oee, 1)}%`">
            <span class="kpi"><BaseNumber :value="plant?.oee.oee" :digits="1" unit="%" /></span>
            <span class="g-lab">OEE</span>
          </ChartGauge>
          <dl class="factors" aria-label="OEE = 시간가동률 × 성능가동률 × 양품률">
            <div v-for="(f, i) in oeeParts" :key="f.key">
              <dt><span class="op" aria-hidden="true">{{ i ? '×' : '' }}</span>{{ f.label }}</dt>
              <dd><BaseNumber :value="f.value" :digits="1" unit="%" /></dd>
            </div>
          </dl>
        </div>
      </BasePanel>

      <BasePanel class="go" title="품질" meta="오늘" @click="router.push('/outbound')">
        <div class="qual">
        <div class="row">
          <div>
            <p class="kpi"><BaseNumber :value="plant?.quality.outbound.rate" :digits="1" unit="%" /></p>
            <p class="cap">출고 불량률</p>
          </div>
          <dl v-if="plant" class="okng">
            <div><dt>양품</dt><dd>{{ formatNumber(plant.quality.outbound.ok) }}</dd></div>
            <div><dt>불량</dt><dd>{{ formatNumber(plant.quality.outbound.ng) }}</dd></div>
          </dl>
        </div>
        <section class="procs" aria-label="공정별 불량">
          <h3 class="h">공정 검사 불량 <b>{{ formatNumber(ng.total) }}</b>개</h3>
          <ChartStackBar v-if="ng.total" :parts="ng.parts" gaps :label="`공정 검사 불량 ${ng.total}개 공정별 몫`" />
          <ul class="ngs">
            <li v-for="r in ng.rows" :key="r.key" :class="{ top: r.top }">
              <span class="nm"><i :style="{ background: r.color }"></i>{{ r.name }}</span>
              <b>{{ formatNumber(r.value) }}</b>
              <small>{{ r.share != null ? `${formatNumber(r.share, 0)}%` : '-' }}</small>
            </li>
          </ul>
        </section>
        </div>
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

  /* 생산·종합 가동률은 내용만큼, 남는 높이는 품질 (공정 검사 덩어리를 바닥에) */
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.go {
  cursor: pointer;
}

.go:hover {
  border-color: var(--c-line-strong);
}

/* 핵심 숫자 (실적 · OEE · 불량률): 화면 제목보다 조금 크게 */
.kpi {
  font-size: var(--fs-kpi);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
  font-variant-numeric: tabular-nums;
}

.row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-4);
}

.of {
  margin-left: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-row);
  font-weight: var(--fw-regular);
}

.side-fig {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.side-fig b {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.lab,
.cap,
.g-lab {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.cap { margin-top: var(--sp-1); }

.prog {
  margin-top: var(--sp-3);
}

.unset {
  margin-top: var(--sp-2);
  color: var(--c-caution-ink);
  font-size: var(--fs-md);
}

/* 종합 가동률: 게이지 | 3요소 곱셈 */
.oee {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
}

.g-lab { margin-top: 2px; }

.factors {
  display: grid;
  flex: 1;
  gap: var(--sp-2);
  min-width: 0;
  margin: 0;
}

.factors div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}

.factors dt {
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  white-space: nowrap;
}

.op {
  display: inline-block;
  width: 1.1em;
  color: var(--c-ink-3);
}

.factors dd {
  margin: 0;
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

/* 품질: 위 = 출고 검사(불량률 · 양품·불량), 아래 = 공정 검사 불량 몫. 둘은 다른 검사라 카드가 길면 아래 덩어리를 바닥에 붙인다 */
.qual {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--sp-4);
}

/* 품질: 출고 양품·불량 */
.okng {
  display: grid;
  gap: 2px;
  margin: 0 0 2px;
}

.okng div {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  font-size: var(--fs-md);
}

.okng dt { color: var(--c-ink-2); }

.okng dd {
  min-width: 4.5em;
  margin: 0;
  font-weight: var(--fw-strong);
  text-align: right;
}

.procs {
  margin-top: auto;
  padding-top: var(--sp-3);
  border-top: var(--line-w) solid var(--c-line);
}

.h {
  margin-bottom: var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-regular);
}

.h b {
  margin-left: var(--sp-1);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

/* 공정 4칸: 색 칸 + 이름 / 수 / 몫. 가장 많은 공정만 진하게 (StateLegend의 .legend와 이름이 겹치지 않게 .ngs) */
.ngs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-2);
  margin: var(--sp-3) 0 0;
  padding: 0;
  list-style: none;
}

.ngs li {
  display: grid;
  gap: 2px;
  color: var(--c-ink-2);
}

.nm {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  white-space: nowrap;
}

.nm i {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.ngs b {
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-regular);
  line-height: var(--lh-tight);
}

.ngs .top b { font-weight: var(--fw-strong); }

.ngs small {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

/* 높은 화면(1920×1080 사무실 PC): 공정을 한 줄씩 (이름 · 수 · 몫), 칸 사이 가는 선 */
@media (height >= 860px) {
  .ngs {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .ngs li {
    grid-template-columns: minmax(0, 1fr) auto 3.2em;
    align-items: baseline;
    gap: var(--sp-3);
    padding: var(--sp-2) 0;
    border-top: var(--line-w) solid var(--c-line);
  }

  .ngs li:first-child { border-top: 0; }

  .nm { font-size: var(--fs-md); }

  .ngs small {
    font-size: var(--fs-md);
    text-align: right;
  }
}
</style>
