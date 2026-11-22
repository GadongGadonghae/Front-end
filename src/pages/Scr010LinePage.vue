<!-- SCR-010 라인 상세 (화면정의서 3장 SCR-010, DESIGN.md Layout "라인 상세")
     위: 고장 알림 띠 + 요약 카드 3장(실적 도넛 · OEE · 불량 도넛). 아래 왼쪽: 라인 흐름(주인공), 아래 오른쪽: 알람 이력 · 비가동 누적 -->
<script setup lang="ts">
import { PROCESS_NAME, lineName } from '@/lib/status'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartDonutValue from '@/components/charts/ChartDonutValue.vue'
import ChartGauge from '@/components/charts/ChartGauge.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import BaseNumber from '@/components/base/BaseNumber.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import StateLegend from '@/components/domain/StateLegend.vue'
import LineFlow from '@/components/domain/LineFlow.vue'
import AlertList from '@/components/domain/AlertList.vue'
import { useLineDetail } from '@/composables/useLineDetail'
import { useTodayAlerts } from '@/composables/useTodayAlerts'
import { useMaster } from '@/composables/useMaster'
import { equipmentPath, lineTabs, processPath } from '@/lib/routes'
import { formatNumber } from '@/lib/format'
import type { LineId, ProcessId } from '@/types/plant'
import type { AlertRowView } from '@/types/view'

const lineLabel = (id: LineId) => lineName(id)

const route = useRoute()
const router = useRouter()
// 라인 탭을 바꾸면 주소가 바뀌고 화면을 새로 만든다 (AppShell RouterView key)
const lineId = route.params.lineId as LineId
const name = lineLabel(lineId)

const { flow, now, oeeRows, alarms } = useLineDetail(lineId)
const alarmOngoing = computed(() => alarms.value.filter((r) => r.ongoing).length)
/** 오늘 알람 이력 → 알람 이력 탭 (이 라인으로 거름, 11/20) */
const openAlarms = () => router.push({ path: '/alarms', query: { line: lineId } })
const { rows: alerts } = useTodayAlerts({ area: lineId }) // 고장 띠·비가동 누적용 (대기·정지 포함)
const { equipmentById } = useMaster()

const tabs = lineTabs(lineLabel)

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
        <BaseButton size="sm" @click="router.push({ path: '/alarms', query: { eq: fault.equipmentId } })">조치 가기 ›</BaseButton>
      </div>
    </template>

    <div class="layout">
      <div class="cards">
        <!-- 11/21 대시보드 "오늘 생산"·"종합 가동률" 카드와 같은 모양 (실적 / 계획 + 달성률 막대, OEE 게이지 + 3요소 곱셈) -->
        <BasePanel title="라인 실적 / 계획">
          <div class="row">
            <p class="kpi"><BaseNumber :value="now.done" /><small v-if="now.plan != null" class="of">/ {{ formatNumber(now.plan) }}</small></p>
            <p v-if="now.plan != null" class="side-fig">
              <span class="lab">달성률</span>
              <b><BaseNumber :value="now.rate" :digits="1" unit="%" /></b>
            </p>
          </div>
          <ChartProgress v-if="now.plan != null" class="prog" :percent="now.rate" :label="`달성률 ${formatNumber(now.rate, 1)}%`" />
          <p v-if="behind != null && behind > 0" class="late">목표 대비 -{{ formatNumber(behind) }}개</p>
          <p v-else-if="now.plan == null" class="unset">목표 미설정</p>
        </BasePanel>

        <BasePanel title="라인 OEE">
          <div class="oee">
            <ChartGauge :value="now.oee" :label="`OEE ${formatNumber(now.oee, 1)}%`">
              <span class="kpi"><BaseNumber :value="now.oee" :digits="1" unit="%" /></span>
              <span class="g-lab">OEE</span>
            </ChartGauge>
            <dl class="factors" aria-label="OEE = 시간가동률 × 성능가동률 × 양품률">
              <div v-for="(f, i) in oeeRows" :key="f.key">
                <dt><span class="op" aria-hidden="true">{{ i ? '×' : '' }}</span>{{ f.label }}</dt>
                <dd><BaseNumber :value="f.value" :digits="1" unit="%" /></dd>
              </div>
            </dl>
          </div>
        </BasePanel>

        <BasePanel :title="`불량 ${formatNumber(now.ngTotal)}개 · 공정별`">
          <div class="donutrow">
            <ChartDonutValue :parts="ngParts" :label="`불량률 ${formatNumber(ngRate, 1)}%`">
              <span class="kpi"><BaseNumber :value="ngRate" :digits="1" unit="%" /></span>
              <span class="g-lab">불량률</span>
            </ChartDonutValue>
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
        <BasePanel class="alerts" title="알람 이력" :meta="`고장·통신 끊김 ${alarms.length}건 · 진행 중 ${alarmOngoing}`" flush>
          <template #tools><button class="to-alarms" type="button" @click="openAlarms">알람 이력 ›</button></template>
          <AlertList :rows="alarms" @open="openAlert" @report="openReport" />
        </BasePanel>
        <BasePanel class="down" title="비가동 사유별 누적">
          <p class="total">비가동 합계 <b>{{ minutes(downtime.total) }}</b></p>
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
/* 11/21 요약 카드 2장(실적 · OEE)은 대시보드 카드와 같은 글자·배치 (Scr001DashboardPage 스타일과 맞춤) */
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
.g-lab {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.prog {
  margin-top: var(--sp-3);
}

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
  margin-top: var(--sp-2);
  color: var(--c-down);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.unset {
  margin-top: var(--sp-2);
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

/* 오늘 알람 이력 → 알람 이력 탭 (11/20) */
.to-alarms {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.to-alarms:hover {
  text-decoration: underline;
}
</style>
