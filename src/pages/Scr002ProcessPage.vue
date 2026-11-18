<!-- SCR-002-2~5 공정 상세 (슬리팅·프레스·용접·도장). 공통 틀 하나에 공정별로 다른 칸만 바꾼다 (화면정의서 SCR-002, D-89)
     제목 줄: 이동 경로 + 공정 탭 + 오른쪽 요약 숫자. 본문 왼쪽: 설비 카드 → 관리값 그래프 (슬리팅은 속도, 도장은 라인별 입고 추가)
     오른쪽 열: 비가동 이력·조치 메모 → 공정 검사 → 미세정지 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { formatDuration, formatNumber } from '@/lib/format'
import type { LineId } from '@/types/plant'
import type { TelemetryRange } from '@/types/process'
import { metricLabel } from '@/lib/metrics'
import { usePaintRoute } from '@/composables/usePaintRoute'

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
const items = computed(() => (series.value?.items ?? []).map((i) => i.item).filter((n) => !SPEED_ITEMS.includes(n)))
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
const inspections = useInspections(process, paint ? undefined : lineId)
const INSPECT_META: Record<string, string> = { SLITTING: '슬리팅 끝', PRESS: '4단 뒤 1회', WELDING: '용접 끝', PAINTING: '도장 끝' }

// 관리값 지금 (슬리팅 시뮬레이터·용접): 항목별 마지막 값과 기준
const latest = computed(() => (series.value?.items ?? []).filter((i) => !SPEED_ITEMS.includes(i.item)).map((i) => {
  const v = i.points.at(-1)?.value ?? null
  const out = v != null && ((i.upper != null && v > i.upper) || (i.lower != null && v < i.lower))
  return { item: i.item, unit: i.unit, value: v, limit: i.lower == null && i.upper == null ? '기준 미정' : `${formatNumber(i.lower, 1)} ~ ${formatNumber(i.upper, 1)}`, out }
}))

// 도장: 라인별 입고 (SCR-002-5 3번)
const received = computed<BarRow[]>(() => (today.value?.receivedByLine ?? []).map((r) => ({ key: r.lineId, label: r.lineId, value: r.qty })))
const receivedTotal = computed(() => received.value.reduce((a, r) => a + (r.value ?? 0), 0))
const receivedOf = (lineId: string) => received.value.find((r) => r.key === lineId)?.value ?? 0
const receivedMax = computed(() => Math.max(0, ...received.value.map((r) => r.value ?? 0)))
const paintRoute = usePaintRoute()

const tabs = paint ? [] : (['slit', 'press', 'weld'] as const).map((seg) => ({ key: seg, label: PROCESS_NAME[SEGMENT_PROCESS[seg]], to: `/lines/${lineId}/${seg}` }))
const openProduct = (id: string) => router.push({ path: '/production', query: { q: id } })
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: lineName, to: `/lines/${lineId}` }, { label: processName }]" />
      <BaseTabs v-if="tabs.length" :items="tabs" :active="route.params.process as string" label="공정" />
    </template>
    <template #head-right>
      <BaseFigureRow>
        <div class="hfig">
          <div class="hl">설비 {{ head.total }}대 상태</div>
          <StatusCounts :counts="head.counts" layout="row" :label="`설비 ${head.total}대 상태`" />
        </div>
        <BaseFigure :label="process === 'SLITTING' ? '오늘 생산 · 양품 (환산)' : '오늘 생산 · 양품'" :value="head.output" :suffix="`/ ${formatNumber(head.good)}`" size="sm" />
        <BaseFigure label="공정 OEE" :value="head.oee" :digits="1" unit="%" size="sm" />
        <BaseFigure label="재공 · 앞 / 뒤" :value="head.wip.before" :suffix="`/ ${formatNumber(head.wip.after)}`" size="sm" />
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
          </BasePanel>
        </div>

        <BasePanel class="chartp" :title="`관리값 · ${selected?.name ?? '-'}`">
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

        <!-- 라인별 입고 + 도장 경로 (백엔드 C-04·M-09, P1): 라인마다 보낼 도장 설비를 바로 바꾼다 -->
        <BasePanel v-if="process === 'PAINTING'" title="라인별 입고 · 도장 경로" :meta="`오늘 입고 합계 ${formatNumber(receivedTotal)} · 경로를 바꾸면 그 라인 제품이 고른 도장 설비로 감`">
          <ul class="route">
            <li v-for="r in paintRoute.rows.value" :key="r.lineId">
              <span class="rname">{{ r.name }}</span>
              <span class="rbar"><i :style="{ width: `${receivedMax ? ((receivedOf(r.lineId) / receivedMax) * 100) : 0}%` }"></i></span>
              <b class="rval">{{ formatNumber(receivedOf(r.lineId)) }}</b>
              <BaseSegmented
                :model-value="r.current"
                :label="`${r.name} 도장 경로`"
                size="sm"
                :options="paintRoute.painters.value"
                @update:model-value="(v) => paintRoute.change(r.lineId, v)"
              />
              <span class="rnote">{{ r.changed ? `기본 ${r.defaultName}에서 바꿈` : '기본 경로' }}</span>
            </li>
          </ul>
          <p v-if="paintRoute.error.value" class="rmsg err" role="alert">{{ paintRoute.error.value }}</p>
          <p v-else-if="paintRoute.message.value" class="rmsg" role="status">{{ paintRoute.message.value }}</p>
        </BasePanel>
      </div>

      <div class="right">
        <BasePanel title="비가동 이력" :meta="`${selected?.name ?? '-'} · 오늘`">
          <DowntimeHistory :rows="history.rows.value" @save="history.saveMemo" />
        </BasePanel>
        <BasePanel title="공정 검사" :meta="`${INSPECT_META[process]} · 오늘`">
          <InspectionPanel
            :inspected="inspections.data.value?.inspected ?? null"
            :ng="inspections.data.value?.ng ?? null"
            :rate="inspections.data.value?.rate ?? null"
            :rows="inspections.rows.value"
            :show-where="process === 'PAINTING'"
            @open-product="openProduct"
          />
        </BasePanel>
        <!-- 미세정지 [차순위]: 제목과 숫자를 한 줄로 (높이를 검사·이력에 준다) -->
        <BasePanel class="micro">
          <div class="micro-row">
            <div>
              <h2>미세정지</h2>
              <span class="meta">오늘 · {{ selected?.name ?? '-' }} · 차순위</span>
            </div>
            <BaseFigure label="횟수" :value="microstops?.count" unit="회" size="sm" />
            <BaseFigure label="손실 시간" :value="null" :text="formatDuration(microstops?.lossSec)" size="sm" />
          </div>
        </BasePanel>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
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

.left.p-B {
  grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
}

.left.p-E {
  grid-template-rows: auto minmax(0, 1fr) auto;
}

/* 낮은 창: 슬리팅 그래프 둘을 위아래로 쌓으면 납작해지므로 나란히 놓는다 */
@media (height <= 860px) {
  .left.p-B {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .left.p-B > .cards {
    grid-column: 1 / -1;
  }

  /* 반 폭 그래프 칸: 항목·구간 버튼이 잘리지 않게 제목 줄을 두 줄로 */
  .left.p-B > .chartp :deep(.ph) {
    flex-wrap: wrap;
  }

  .left.p-B > .chartp :deep(.tools) {
    flex-wrap: wrap;
    margin-left: 0;
  }

  /* 도장: 라인별 입고를 그래프 아래가 아니라 옆에 */
  .left.p-E {
    grid-template-columns: minmax(0, 1fr) var(--col-summary);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .left.p-E > .cards {
    grid-column: 1 / -1;
  }
}

.right {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto;
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

.micro {
  padding-block: var(--sp-4);
}

.micro-row {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
}

.micro-row > div:first-child {
  margin-right: auto;
}

.micro h2 {
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.micro .meta {
  display: block;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
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
