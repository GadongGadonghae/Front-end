<!-- SCR-010 라인 상세 (화면정의서 3장 SCR-010, DESIGN.md Layout "라인 상세")
     위: 고장 알림 띠 + 요약 카드 3장(실적 도넛 · OEE · 불량 도넛). 아래 왼쪽: 라인 흐름(주인공), 아래 오른쪽: 오늘 알람 이력 · 비가동 누적 -->
<script setup lang="ts">
import { PROCESS_NAME, lineName } from '@/lib/status'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartDonutValue from '@/components/charts/ChartDonutValue.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import LineFlow from '@/components/domain/LineFlow.vue'
import AlertList from '@/components/domain/AlertList.vue'
import { useLineDetail } from '@/composables/useLineDetail'
import { useTodayAlerts } from '@/composables/useTodayAlerts'
import { useMaster } from '@/composables/useMaster'
import { equipmentPath, processPath } from '@/lib/routes'
import { formatNumber } from '@/lib/format'
import type { LineId, ProcessId } from '@/types/plant'
import type { AlertRowView } from '@/types/view'

const LINES: LineId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'PT']
const lineLabel = (id: LineId) => lineName(id)

const route = useRoute()
const router = useRouter()
// 라인 탭을 바꾸면 주소가 바뀌고 화면을 새로 만든다 (AppShell RouterView key)
const lineId = route.params.lineId as LineId
const name = lineLabel(lineId)

const { flow, now, oeeRows } = useLineDetail(lineId)
const { rows: alerts, ongoingCount } = useTodayAlerts({ area: lineId })
const { equipmentById } = useMaster()

// 전체 라인 비교 화면은 나중에 만든다 (칸만 둔다)
const tabs = [
  { key: 'ALL', label: '전체라인', to: '/lines', disabled: true },
  ...LINES.map((id) => ({ key: id, label: lineLabel(id), to: `/lines/${id}` })),
]

// 진행 중인 고장 (맨 위 알림 띠)
const fault = computed(() => alerts.value.find((r) => r.kind === 'D' && r.ongoing) ?? null)
const faultCount = computed(() => alerts.value.filter((r) => r.kind === 'D' && r.ongoing).length)

const NG_COLORS = ['var(--c-3d-route-alt)', 'var(--c-3d-route-2)', 'var(--c-3d-route)']
const ngParts = computed(() => now.value.ngRows.map((r, i) => ({ value: r.value, color: NG_COLORS[i % NG_COLORS.length], name: PROCESS_NAME[r.process] })))
const ngRate = computed(() => (now.value.ngTotal != null && now.value.done ? Math.round((now.value.ngTotal / now.value.done) * 1000) / 10 : null))
const behind = computed(() => (now.value.plan != null && now.value.done != null ? now.value.plan - now.value.done : null))

// 비가동 사유별 누적 (오늘 알림의 지속시간 합): 고장 D · 대기 I · 정지 S
const secOf = (d: string) => {
  const m = /(\d+):(\d+)(?::(\d+))?/.exec(d)
  if (!m) return 0
  return m[3] ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2]
}
const downtime = computed(() => {
  const rows = [
    { key: 'D', label: '고장', color: 'var(--c-down)' },
    { key: 'I', label: '대기', color: 'var(--c-idle)' },
    { key: 'S', label: '정지(계획)', color: 'var(--c-stop-solid)' },
  ].map((r) => ({ ...r, sec: alerts.value.filter((a) => a.kind === r.key).reduce((n, a) => n + secOf(a.duration), 0) }))
  const max = Math.max(1, ...rows.map((r) => r.sec))
  return { total: rows.reduce((n, r) => n + r.sec, 0), rows: rows.map((r) => ({ ...r, width: (r.sec / max) * 100 })) }
})
const minutes = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : `${Math.floor(sec / 60)}분`)

function openEquipment(id: string) {
  const e = equipmentById.value.get(id)
  if (e) router.push(equipmentPath(e))
}
const openGroup = (p: ProcessId) => router.push(processPath(lineId, p))
const openAlert = (r: AlertRowView) => (r.kind === 'risk' ? router.push({ path: '/pdm', query: { eq: r.equipmentId } }) : openEquipment(r.equipmentId))
const openReport = (r: AlertRowView) => router.push(r.reportId ? `/reports/replan/${r.reportId}` : `/reports/replan?event=${r.id}`)
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: name }]" />
      <BaseTabs :items="tabs" :active="lineId" label="라인" />
    </template>
    <!-- 진행 중 고장이 있을 때만: 제목 줄 오른쪽에 한 줄로 (본문 위에 끼우면 알람이 생길 때마다 아래 내용이 밀린다) -->
    <template v-if="fault" #head-right>
      <div class="fault" role="alert">
        <StatusKey state="D" size="sm" />
        <b>{{ fault.title }} 고장<template v-if="faultCount > 1"> 외 {{ faultCount - 1 }}건</template></b>
        <span class="why">{{ fault.message }} · 지속 {{ fault.duration }}</span>
        <BaseButton size="sm" @click="openAlert(fault)">조치 가기 ›</BaseButton>
      </div>
    </template>

    <div class="layout">
      <div class="cards">
        <BasePanel title="오늘 라인 실적 / 계획">
          <div class="donutrow">
            <ChartDonutValue
              :parts="[{ value: now.rate ?? 0, color: 'var(--c-accent)' }, { value: Math.max(0, 100 - (now.rate ?? 0)), color: 'var(--c-track)' }]"
              :center="now.rate != null ? `${formatNumber(now.rate, 1)}%` : '-'"
              sub="달성률"
              :label="`달성률 ${formatNumber(now.rate, 1)}%`"
            />
            <div>
              <BaseFigure class="big" label="" :value="now.done" :suffix="now.plan != null ? `/ ${formatNumber(now.plan)}` : undefined" size="lg" />
              <span v-if="behind != null && behind > 0" class="late">목표 대비 -{{ formatNumber(behind) }}개</span>
              <span v-else-if="now.plan == null" class="unset">목표 미설정</span>
            </div>
          </div>
        </BasePanel>

        <BasePanel title="라인 OEE">
          <div class="oeerow">
            <BaseFigure class="big" label="" :value="now.oee" :digits="1" unit="%" size="lg" />
            <div class="oee-parts"><ChartBarList label="OEE 3요소" :rows="oeeRows" :max="100" /></div>
          </div>
        </BasePanel>

        <BasePanel :title="`오늘 불량 ${formatNumber(now.ngTotal)}개 · 공정별`">
          <div class="donutrow">
            <ChartDonutValue :parts="ngParts" :center="ngRate != null ? `${formatNumber(ngRate, 1)}%` : '-'" sub="불량률" :label="`불량률 ${formatNumber(ngRate, 1)}%`" />
            <ul class="ng" aria-label="공정별 불량 제외">
              <li v-for="r in ngParts" :key="r.name"><i :style="{ background: r.color }"></i><span>{{ r.name }}</span><b>{{ r.value }}</b></li>
            </ul>
          </div>
        </BasePanel>
      </div>

      <BasePanel class="flowp" title="라인 흐름" meta="공정 이름이나 설비 칸을 누르면 공정 상세">
        <template #tools><StateLegend pdm /></template>
        <LineFlow v-if="flow" :view="flow" :line-name="name" @open-cell="openEquipment" @open-group="openGroup" />
        <BaseEmpty v-else />
      </BasePanel>

      <div class="side">
        <BasePanel class="alerts" title="오늘 알람 이력" :meta="`${alerts.length}건 · 진행 중 ${ongoingCount}`" flush>
          <AlertList :rows="alerts" @open="openAlert" @report="openReport" />
        </BasePanel>
        <BasePanel class="down" title="비가동 사유별 누적">
          <p class="total">오늘 비가동 합계 <b>{{ minutes(downtime.total) }}</b></p>
          <ul class="bars">
            <li v-for="r in downtime.rows" :key="r.key">
              <span>{{ r.label }}</span>
              <div class="bar"><i :style="{ width: `${r.width}%`, background: r.color }"></i></div>
              <b>{{ minutes(r.sec) }}</b>
            </li>
          </ul>
        </BasePanel>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
/* 요약 카드의 대표 숫자(라인 실적·라인 OEE)는 카드 안에서 가장 크게 */
.big :deep(.value) {
  font-size: var(--fs-xl);
}

/* 라인 OEE: 숫자는 왼쪽, 3요소 막대는 오른쪽 */
.oeerow {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--sp-5);
  min-height: 0;
}

.oee-parts {
  display: flex;
  flex: 1;
  align-self: stretch;
  min-width: 0;
  padding-left: var(--sp-5);
  border-left: var(--line-w) solid var(--c-line);
}

/* 위: 고장 띠 → 카드 3장. 아래: 라인 흐름(남는 폭) | 오른쪽 열(알람 이력 · 비가동 누적) */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--col-side);
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.fault {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-3);
  border: var(--line-w) solid var(--c-down);
  border-radius: var(--r-2);
  background: var(--c-down-tint);
  font-size: var(--fs-md);
  white-space: nowrap;
}

/* 좁으면 원인·지속 글을 줄인다 (전체는 조치 가기 → 알람 이력) */
.fault .why {
  overflow: hidden;
  min-width: 0;
  color: var(--c-ink-2);
  text-overflow: ellipsis;
}

.cards {
  display: grid;
  grid-column: 1 / 3;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: var(--sp-4);
}

.donutrow {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
}

.late {
  color: var(--c-down);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.unset {
  color: var(--c-caution-ink);
  font-size: var(--fs-md);
}

.flowp {
  grid-row: 2;
  grid-column: 1;
}

.side {
  display: flex;
  grid-row: 2;
  grid-column: 2;
  flex-direction: column;
  gap: var(--sp-4);
  min-height: 0;
}

.alerts {
  flex: 1;
}

.down {
  flex: none;
}

/* 합계는 아래 막대 숫자와 같은 줄 크기로 (칸을 낮춰 위 알람 이력에 자리를 준다) */
.total {
  margin: 0 0 var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.total b {
  margin-left: var(--sp-2);
  color: var(--c-ink);
  font-size: var(--fs-figure);
  font-weight: var(--fw-strong);
}

.bars,
.ng {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.ng {
  flex: 1;
}

.ng li {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.ng i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.ng b {
  margin-left: auto;
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.bars {
  gap: var(--sp-1);
}

.bars li {
  display: grid;
  grid-template-columns: 6em minmax(0, 1fr) 4.5em;
  align-items: center;
  gap: var(--sp-3);
}

.bars b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  text-align: right;
}

.bar {
  height: var(--bar-h);
  overflow: hidden;
  border-radius: var(--r-1);
  background: var(--c-track);
}

.bar i {
  display: block;
  height: 100%;
}
</style>
