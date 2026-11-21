<!-- SCR-002-2~5 공정 상세 (슬리팅·프레스·용접·도장). 공통 틀 하나에 공정별로 다른 칸만 바꾼다 (화면정의서 SCR-002, D-89)
     제목 줄: 이동 경로 + 공정 탭 + 오른쪽 요약 숫자. 본문 왼쪽: 설비 카드 → 관리값 그래프 (슬리팅은 속도, 도장은 라인별 입고 추가)
     오른쪽 열: 비가동 이력·조치 메모 → 불량률 (도장은 비가동 이력 → 오늘 요약). 미세정지는 뺌 (11/20 검토) -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseFigureRow from '@/components/base/BaseFigureRow.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import type { BarRow } from '@/components/charts/ChartBarList.vue'
import StatusCounts from '@/components/domain/StatusCounts.vue'
import EquipCard from '@/components/domain/EquipCard.vue'
import DowntimeHistory from '@/components/domain/DowntimeHistory.vue'
import InspectionPanel from '@/components/domain/InspectionPanel.vue'
import InverterStatus from '@/components/domain/InverterStatus.vue'
import { useProcessDetail } from '@/composables/useProcessDetail'
import { telemetryChart, useTelemetry } from '@/composables/useTelemetry'
import { useEquipmentHistory } from '@/composables/useEquipmentHistory'
import { useInspections, useMicrostops } from '@/composables/useInspections'
import { useNow } from '@/composables/useNow'
import { SEGMENT_PROCESS } from '@/lib/routes'
import { PROCESS_NAME, lineName as lineNameOf } from '@/lib/status'
import { formatNumber } from '@/lib/format'
import type { LineId } from '@/types/plant'
import type { TelemetryRange } from '@/types/process'
import { metricHelp, metricLabel, NOT_MEASURED } from '@/lib/metrics'
import { usePaintRoute } from '@/composables/usePaintRoute'
import PaintPlanPanel from '@/components/domain/PaintPlanPanel.vue'
import { usePaintPlan } from '@/composables/usePaintPlan'

const route = useRoute()
const router = useRouter()
const now = useNow()

// 주소: /lines/B/press 또는 /lines/PT/paint (경로가 바뀌면 화면을 새로 만든다)
const paint = route.path === '/lines/PT/paint'
const lineId = (paint ? 'PT' : route.params.lineId) as LineId
const process = paint ? 'PAINTING' : SEGMENT_PROCESS[route.params.process as string]
const lineName = paint ? '도장' : lineNameOf(lineId)
const processName = PROCESS_NAME[process]

const { equipment, cards, head, today } = useProcessDetail(lineId, process)

// 고른 설비: 주소 ?eq= (알림·설비 칸에서 들어오면 그 설비), 없으면 첫 설비 (D-52)
const selectedId = computed(() => {
  const q = route.query.eq
  return equipment.value.find((e) => e.id === q)?.id ?? equipment.value[0]?.id ?? null
})
const selected = computed(() => cards.value.find((c) => c.id === selectedId.value) ?? null)
const select = (id: string) => router.replace({ query: { ...route.query, eq: id } })

// 관리값 그래프
const range = ref<TelemetryRange>('1h')
const series = useTelemetry(selectedId, range)
const SPEED_ITEMS = ['commandHz', 'outputHz']
// 설비 상태 센서(더미)는 예지보전 화면에서만 본다
// 11/21 이 공정에서 재지 않는 항목(슬리팅 토크)은 고르기에서 빼고 "측정 안 함"으로 따로 알려요
const notMeasured = NOT_MEASURED[process] ?? {}
const items = computed(() => (series.value?.items ?? []).filter((i) => i.source !== 'sensor').map((i) => i.item)
  .filter((n) => !SPEED_ITEMS.includes(n) && !(n in notMeasured)))
/** 그래프 제목 옆 설명: 무엇을 재는 값인지 + 기준 */
const itemMeta = computed(() => {
  const s = series.value?.items.find((i) => i.item === item.value)
  const limit = !s ? '' : s.lower == null && s.upper == null ? '기준 미정' : `기준 ${formatNumber(s.lower, 1)} ~ ${formatNumber(s.upper, 1)}${s.unit ? ` ${s.unit.trim()}` : ''}`
  return [metricHelp(item.value), limit].filter(Boolean).join(' · ')
})
const item = ref('')
watch(items, (list) => { if (!list.includes(item.value)) item.value = list[0] ?? '' }, { immediate: true })
const chart = computed(() => telemetryChart(series.value, item.value, range.value, now.value))

// 슬리팅 속도: 지령 vs 출력 + 미세정지 후보 띠 (SCR-002-2 3번)
const microstops = useMicrostops(selectedId)
const speed = computed(() => {
  if (process !== 'SLITTING') return null
  const cmd = telemetryChart(series.value, 'commandHz', range.value, now.value)
  const out = telemetryChart(series.value, 'outputHz', range.value, now.value)
  const [from, to] = out.x
  const bands = (microstops.value?.bands ?? []).map((b) => ({ from: Date.parse(b.from), to: Date.parse(b.to) })).filter((b) => b.to >= from && b.from <= to)
  return { ...out, cmd: cmd.points, bands }
})

// 비가동 이력·조치 메모, 공정 검사
const history = useEquipmentHistory(selectedId)
const { can } = useAuth()
const inspections = useInspections(process, paint ? undefined : lineId)
const INSPECT_META: Record<string, string> = { SLITTING: '슬리팅 끝', PRESS: '4단 뒤 1회', WELDING: '용접 끝', PAINTING: '도장 끝' }

// 관리값 지금 (슬리팅 시뮬레이터·용접): 항목별 마지막 값과 기준
const latest = computed(() => (series.value?.items ?? []).filter((i) => i.source !== 'sensor' && !SPEED_ITEMS.includes(i.item) && !(i.item in notMeasured)).map((i) => {
  const v = i.points.at(-1)?.value ?? null
  const out = v != null && ((i.upper != null && v > i.upper) || (i.lower != null && v < i.lower))
  return { item: i.item, unit: i.unit, value: v, limit: i.lower == null && i.upper == null ? '기준 미정' : `${formatNumber(i.lower, 1)} ~ ${formatNumber(i.upper, 1)}`, out }
}))

// 도장: 라인별 입고 (SCR-002-5 3번)
const received = computed<BarRow[]>(() => (today.value?.receivedByLine ?? []).map((r) => ({ key: r.lineId, label: r.lineId, value: r.qty })))
const receivedOf = (lineId: string) => received.value.find((r) => r.key === lineId)?.value ?? 0
const receivedMax = computed(() => Math.max(0, ...received.value.map((r) => r.value ?? 0)))
const paintRoute = usePaintRoute()
// 11/21 도장 운영 판단 (도장 상세에서만 10초마다)
const paintPlan = usePaintPlan(paint)
/** 도장 상세: 고른 도장 설비로 오는 라인만 (경로 바꾸기는 도장 운영 패널, 11/21) */
const routeRows = computed(() => paintRoute.rows.value.filter((r) => r.current === selectedId.value))
const routeTotal = computed(() => routeRows.value.reduce((a, r) => a + receivedOf(r.lineId), 0))
const painterName = (id: string) => paintRoute.painters.value.find((p) => p.value === id)?.label ?? id

// 공정 탭: 슬리팅·프레스·용접 + 이 라인 제품이 가는 도장 설비 (11/20)
const linePaint = computed(() => (paint ? null : paintRoute.rows.value.find((r) => r.lineId === lineId)?.current ?? null))
const tabs = computed(() => (paint ? [] : [
  ...(['slit', 'press', 'weld'] as const).map((seg) => ({ key: seg, label: PROCESS_NAME[SEGMENT_PROCESS[seg]], to: `/lines/${lineId}/${seg}` })),
  ...(linePaint.value ? [{ key: 'paint', label: `${PROCESS_NAME.PAINTING} (${painterName(linePaint.value)})`, to: `/lines/PT/paint?eq=${linePaint.value}` }] : []),
]))
const openProduct = (id: string) => router.push({ path: '/production', query: { q: id } })
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: lineName, to: `/lines/${lineId}` }, { label: paint ? '도장 상세' : processName }]" />
      <BaseTabs v-if="tabs.length" :items="tabs" :active="route.params.process as string" label="공정" />
    </template>
    <template #head-right>
      <BaseFigureRow>
        <div class="hfig">
          <div class="hl">설비 {{ head.total }}대 상태</div>
          <StatusCounts :counts="head.counts" layout="row" :label="`설비 ${head.total}대 상태`" />
        </div>
        <template v-if="!paint">
          <BaseFigure :label="process === 'SLITTING' ? '오늘 생산 · 양품 (환산)' : '오늘 생산 · 양품'" :value="head.output" :suffix="`/ ${formatNumber(head.good)}`" size="sm" />
          <BaseFigure label="공정 OEE" :value="head.oee" :digits="1" unit="%" size="sm" />
          <BaseFigure label="재공 · 앞 / 뒤" :value="head.wip.before" :suffix="`/ ${formatNumber(head.wip.after)}`" size="sm" />
        </template>
      </BaseFigureRow>
    </template>

    <div class="body">
      <div class="left" :class="`p-${process}`">
        <!-- 설비 카드: 프레스는 1~4단을 순서대로 가로로, 단 사이 화살표 (D-80) -->
        <div v-if="process === 'PRESS'" class="cards stages">
          <template v-for="(c, i) in cards" :key="c.id">
            <BaseIcon v-if="i" class="arrow" name="chevron-right" :size="20" />
            <EquipCard :card="c" :selected="c.id === selectedId" @select="select" />
          </template>
        </div>
        <div v-else-if="process === 'PAINTING'" class="cards pair">
          <EquipCard v-for="c in cards" :key="c.id" :card="c" :selected="c.id === selectedId" @select="select" />
        </div>
        <div v-else class="cards one">
          <EquipCard v-for="c in cards" :key="c.id" :card="c" selected @select="select" />
          <BasePanel v-if="today?.inverter" title="인버터 상태" meta="실설비만 · 1초마다">
            <InverterStatus :status="today.inverter" />
          </BasePanel>
          <BasePanel v-else title="관리값 지금" meta="마지막 수집 값">
            <table v-if="latest.length" class="now-tbl">
              <thead><tr><th>항목</th><th class="r">값</th><th class="r">하한 ~ 상한</th></tr></thead>
              <tbody>
                <tr v-for="l in latest" :key="l.item" :class="{ out: l.out }">
                  <td>{{ metricLabel(l.item) }}</td>
                  <td class="r">{{ formatNumber(l.value, 2) }}<small v-if="l.unit">{{ l.unit }}</small></td>
                  <td class="r">{{ l.limit }}</td>
                </tr>
              </tbody>
            </table>
            <BaseEmpty v-else />
            <p v-for="(why, k) in notMeasured" :key="k" class="nm">{{ metricLabel(k) }}: 측정 안 함 · {{ why }}</p>
          </BasePanel>
        </div>

        <BasePanel class="chartp" :title="`관리값 · ${selected?.name ?? '-'} · ${item ? metricLabel(item) : '-'}`" :meta="itemMeta">
          <template #tools>
            <BaseSegmented v-if="items.length > 1" v-model="item" label="관리값 항목" size="sm" :options="items.map((i) => ({ value: i, label: metricLabel(i) }))" />
            <ChartLegend :items="[{ label: `측정값${chart.unit ? ` (${chart.unit.trim()})` : ''}`, kind: 'main' }, { label: chart.hasLimits ? '상·하한' : '기준 미정', kind: 'ref' }]" />
            <BaseSegmented v-model="range" label="구간" size="sm" :options="[{ value: '1h', label: '1시간' }, { value: '8h', label: '8시간' }, { value: 'today', label: '오늘' }]" />
          </template>
          <ChartLine
            v-if="chart.points.length"
            :label="`${selected?.name} ${metricLabel(item)} 추이`"
            :x="chart.x"
            :y="chart.y"
            :x-ticks="chart.xTicks"
            :y-ticks="chart.yTicks"
            :y-digits="chart.yDigits"
            :series="[{ key: 'v', points: chart.points }]"
            :ref-lines="chart.refLines"
            :marks="chart.ngPoints"
            :now="now"
          />
          <BaseEmpty v-else :text="series ? '데이터 없음 (설비가 멈춘 동안은 값이 없습니다)' : '불러오는 중'" />
          <p v-for="(why, k) in notMeasured" :key="k" class="nm">{{ metricLabel(k) }}: 측정 안 함 · {{ why }}</p>
        </BasePanel>

        <BasePanel v-if="speed" class="chartp" title="속도" meta="출력이 지령보다 낮은 구간 = 미세정지 후보 · 오늘 생산은 운전시간 × 속도로 환산한 값">
          <template #tools>
            <ChartLegend :items="[{ label: '지령 주파수', kind: 'ref' }, { label: '출력 주파수', kind: 'main' }, { label: '미세정지 후보', kind: 'band' }]" />
          </template>
          <ChartLine
            v-if="speed.points.length"
            :label="`${selected?.name} 지령 주파수와 출력 주파수`"
            :x="speed.x"
            :y="[50, 62]"
            :x-ticks="speed.xTicks"
            :y-ticks="[50, 54, 58, 62]"
            :series="[{ key: 'cmd', kind: 'ref', points: speed.cmd }, { key: 'out', points: speed.points }]"
            :bands="speed.bands"
            :now="now"
          />
          <BaseEmpty v-else />
        </BasePanel>

        <!-- 11/21 도장 아래 줄: 도장 운영(판단·적용·경로 직접 바꾸기) | 라인별 입고. 그래프 아래에 나란히 -->
        <div v-if="process === 'PAINTING'" class="ops">
        <BasePanel title="도장 운영" meta="가동 라인 기준 · 10초마다 다시 계산">
          <PaintPlanPanel
            :plan="paintPlan.plan.value"
            :can-apply="can('paint')"
            :busy="paintPlan.busy.value"
            :message="paintPlan.message.value"
            :error="paintPlan.error.value"
            :rows="paintRoute.rows.value"
            :painters="paintRoute.painters.value"
            @apply="paintPlan.apply"
            @route="paintPlan.route"
          />
        </BasePanel>
        <!-- 라인별 입고 · 도장 경로: 고른 도장 설비로 오는 라인만 (바꾸기는 위 도장 운영에서) -->
        <BasePanel title="라인별 입고 · 도장 경로" :meta="`${selected?.name ?? '-'}로 오는 라인 · 오늘 입고 ${formatNumber(routeTotal)}`">
          <ul v-if="routeRows.length" class="route">
            <li v-for="r in routeRows" :key="r.lineId">
              <span class="rname">{{ r.name }}</span>
              <span class="rbar"><i :style="{ width: `${receivedMax ? ((receivedOf(r.lineId) / receivedMax) * 100) : 0}%` }"></i></span>
              <b class="rval">{{ formatNumber(receivedOf(r.lineId)) }}</b>
              <span class="rto">→ {{ painterName(r.current) }}</span>
              <span class="rnote">{{ r.changed ? `기본 ${r.defaultName}에서 바뀜` : '기본 경로' }}</span>
            </li>
          </ul>
          <BaseEmpty v-else text="이 도장 설비로 오는 라인이 없습니다" />
        </BasePanel>
        </div>
      </div>

      <div :class="['right', { paint }]">
        <BasePanel title="비가동 이력" :meta="`${selected?.name ?? '-'} · 오늘`">
          <DowntimeHistory :rows="history.rows.value" :save="history.saveMemo" :readonly="!can('action', selectedId ?? undefined)" />
        </BasePanel>
        <BasePanel v-if="paint" title="오늘 요약" meta="도장 공정">
          <div class="sum-figs">
            <BaseFigure label="오늘 생산 · 양품" :value="head.output" :suffix="`/ ${formatNumber(head.good)}`" size="sm" />
            <BaseFigure label="공정 OEE" :value="head.oee" :digits="1" unit="%" size="sm" />
            <BaseFigure label="재공 · 앞 / 뒤" :value="head.wip.before" :suffix="`/ ${formatNumber(head.wip.after)}`" size="sm" />
          </div>
        </BasePanel>
        <BasePanel v-else title="불량률" :meta="`${INSPECT_META[process]} · 오늘`">
          <InspectionPanel
            :inspected="inspections.data.value?.inspected ?? null"
            :ng="inspections.data.value?.ng ?? null"
            :rate="inspections.data.value?.rate ?? null"
            :rows="inspections.rows.value"
            :show-where="process === 'PAINTING'"
            @open-product="openProduct"
          />
        </BasePanel>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
/* 11/21 재지 않는 항목 안내 (슬리팅 토크) */
.nm {
  margin-top: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.hfig .hl {
  margin-bottom: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

/* 본문: 왼쪽(카드·그래프) | 오른쪽 열(이력·검사·미세정지) */
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

.left.p-SLITTING {
  grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
}

.left.p-PAINTING {
  grid-template-rows: auto minmax(240px, 1fr) auto;
  overflow-y: auto;   /* 낮은 창에서는 겹치지 않고 스크롤 */
}

/* 11/21 도장 아래 줄: 도장 운영 | 라인별 입고 */
.ops {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  align-items: start;
  gap: var(--sp-4);
}

/* 낮은 창: 슬리팅 그래프 둘을 위아래로 쌓으면 납작해지므로 나란히 놓는다 */
@media (height <= 860px) {
  .left.p-SLITTING {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .left.p-SLITTING > .cards {
    grid-column: 1 / -1;
  }

  /* 반 폭 그래프 칸: 항목·구간 버튼이 잘리지 않게 제목 줄을 두 줄로 */
  .left.p-SLITTING > .chartp :deep(.ph) {
    flex-wrap: wrap;
  }

  .left.p-SLITTING > .chartp :deep(.tools) {
    flex-wrap: wrap;
    margin-left: 0;
  }

}

.right {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-4);
  min-height: 0;
}

.cards {
  display: grid;
  gap: var(--sp-4);
}

.stages {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-2);
}

.stages > .card {
  align-self: stretch;
}

.arrow {
  color: var(--c-ink-3);
}

.pair {
  grid-template-columns: 1fr 1fr;
}

/* 설비 1대 공정: 카드 + 옆 정보 (인버터 또는 관리값 지금) */
.one {
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
}

.now-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-md);
}

.now-tbl th {
  padding: 0 0 var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  text-align: left;
}

.now-tbl td {
  padding: var(--sp-1) 0;
  border-top: var(--line-w) solid var(--c-line);
}

.now-tbl .r {
  text-align: right;
}

.now-tbl small {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
}

.now-tbl tr.out td {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

/* 도장: 비가동 이력 + 오늘 요약 (요약은 내용만큼) */
.right.paint {
  grid-template-rows: minmax(0, 1fr) auto;
}

.sum-figs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4) var(--sp-6);
}

.rto {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.route {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content max-content max-content;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.route li {
  display: contents;
}

.rname {
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.rbar {
  height: var(--sp-2);
  border-radius: 2px;
  background: var(--c-track);
}

.rbar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--c-ink-3);
}

.rval {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.rnote {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.rmsg {
  margin: var(--sp-3) 0 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.rmsg.err {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}
</style>
