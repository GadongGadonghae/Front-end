<!-- SCR-004 예지보전 (화면정의서 SCR-004, 시안 B-pdm)
     왼쪽: 등급별 대수 → 위험도 목록 (위험 → 주의 → 정상은 접어 둠, D-61). 지금 고장 난 설비는 따로
     오른쪽: 설비 고르기(구역 → 설비) → 고른 설비 이름·등급·상태 + 센서 카드(지금 값·위험도·1시간 미니 그래프)
            → 고른 센서 추이(상·하한 점선, 80%·90% 옅은 선) · 센서별 오늘 이력. 온도·진동·전류 등 설비 센서는 더미 (data/dummy/sensors.ts)
     예지보전 표시는 칸 바깥 테두리 (DESIGN.md): 주의 = 노랑 실선, 위험 = 빨강 점선, 항상 "주의"·"위험" 글자와 함께 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartLegend from '@/components/charts/ChartLegend.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import SensorTile from '@/components/domain/SensorTile.vue'
import SensorLanes from '@/components/domain/SensorLanes.vue'
import { usePdmSensors } from '@/composables/usePdmSensors'
import { useMaster } from '@/composables/useMaster'
import { usePdm, DANGER, WARN, type Grade, type RiskRow } from '@/composables/usePdm'
import { metricLabel } from '@/lib/metrics'

const route = useRoute()
const router = useRouter()
// 고른 설비는 주소 ?eq= 로 (알림에서 바로 들어올 수 있게)
const selectedId = ref<string | null>(typeof route.query.eq === 'string' ? route.query.eq : null)
watch(() => route.query.eq, (v) => { if (typeof v === 'string' && v) selectedId.value = v })
watch(selectedId, (id) => { if (id && route.query.eq !== id) router.replace({ query: { ...route.query, eq: id } }) })

const p = usePdm(selectedId)
const { range, item } = p
const g = computed(() => p.groups.value)
const sel = computed(() => p.selectedRow.value)
// 고른 설비의 센서 카드 · 센서별 오늘 이력 (온도·진동·전류 등 설비 센서는 더미)
const sn = usePdmSensors(selectedId, computed(() => sel.value?.state ?? 'R'), p.now)

const GRADE_WORD: Record<Grade, string> = { danger: '위험', warn: '주의', normal: '정상', unset: '기준 미정' }

// 설비 고르기: 구역(A~F라인 · 도장) → 그 구역 설비. 왼쪽 위험도 목록과 같은 선택(?eq=)을 쓴다
const { master } = useMaster()
const area = ref('A')
const areaOptions = computed(() => (master.value?.lines ?? []).map((l) => ({ value: l.id as string, label: l.kind === 'paint' ? '도장' : l.name })))
const procOrder = (id: string) => master.value?.processes.find((x) => x.id === id)?.order ?? 9
const equipOf = (a: string) => (master.value?.equipment ?? []).filter((e) => e.area === a && e.type !== 'vision')
  .sort((x, y) => procOrder(x.process) - procOrder(y.process) || x.order - y.order)
watch([selectedId, master], ([id]) => { const e = master.value?.equipment.find((x) => x.id === id); if (e) area.value = e.area }, { immediate: true })
const pickArea = computed({
  get: () => area.value,
  set: (a: string) => { area.value = a; const first = equipOf(a)[0]; if (first) selectedId.value = first.id },
})
const pickEquip = computed({ get: () => selectedId.value ?? '', set: (id: string) => { selectedId.value = id } })
const equipOptions = computed(() => equipOf(area.value).map((e) => {
  const r = p.rows.value.find((x) => x.id === e.id)
  const mark = r?.state === 'D' ? ' · 고장' : r?.grade === 'danger' ? ' · 위험' : r?.grade === 'warn' ? ' · 주의' : ''
  return { value: e.id, label: `${e.shortName}${mark}` }
}))
const pct = (v: number | null) => (v == null ? '-' : `${v}%`)
const meter = (v: number | null) => `${Math.min(100, v ?? 0)}%`
const RANGES = [{ value: '1h' as const, label: '1시간' }, { value: '8h' as const, label: '8시간' }, { value: 'today' as const, label: '오늘' }]
const legend = computed(() => [
  { label: `측정값${p.chart.value.unit ? ` (${p.chart.value.unit.trim()})` : ''}`, kind: 'main' as const },
  { label: p.chart.value.hasLimits ? '상·하한' : '기준 미정', kind: 'ref' as const },
  ...(p.chart.value.bands ? [{ label: '90%', kind: 'danger' as const }, { label: '80%', kind: 'warn' as const }] : []),
])
const pick = (r: RiskRow) => { selectedId.value = r.id }
/** 펼쳐 보이는 묶음: 지금 고장 → 위험 → 주의. 정상·기준 미정은 접어 둔다 (D-61) */
const topGroups = computed(() => [
  { key: 'down', title: '지금 고장 · 멈추기 전 10분 평균', rows: g.value.down },
  { key: 'danger', title: `위험 · ${DANGER}% 이상`, rows: g.value.danger },
  { key: 'warn', title: `주의 · ${WARN}% 이상`, rows: g.value.warn },
])
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">예지보전</h1>
      <span class="note">관리값이 있는 설비 38대 · 위험도 = 최근 10분 평균이 기준 가운데에서 상·하한까지 간 정도(%) 중 가장 큰 값 · {{ WARN }}% 주의 · {{ DANGER }}% 위험</span>
    </template>

    <div class="layout">
      <BasePanel title="설비 위험도" meta="위험 순">
        <dl class="counts">
          <div class="danger"><dt>위험</dt><dd>{{ p.counts.value.danger }}</dd></div>
          <div class="warn"><dt>주의</dt><dd>{{ p.counts.value.warn }}</dd></div>
          <div><dt>정상</dt><dd>{{ p.counts.value.normal }}</dd></div>
          <div v-if="p.counts.value.unset"><dt>기준 미정</dt><dd>{{ p.counts.value.unset }}</dd></div>
        </dl>

        <div v-if="p.rows.value.length" class="list">
          <template v-for="grp in topGroups" :key="grp.key">
            <template v-if="grp.rows.length">
              <div class="grp">{{ grp.title }}</div>
              <button
                v-for="r in grp.rows"
                :key="r.id"
                type="button"
                :class="['it', r.grade, { on: r.id === p.selected.value?.equipmentId }]"
                :aria-pressed="r.id === p.selected.value?.equipmentId"
                @click="pick(r)"
              >
                <span class="nm">{{ r.name }}<span v-if="r.grade === 'danger' || r.grade === 'warn'" :class="['tag', r.grade]">{{ GRADE_WORD[r.grade] }}</span><StatusKey v-if="r.state === 'D'" state="D" size="sm" /></span>
                <b class="pc">{{ pct(r.percent) }}</b>
                <span class="itm">{{ r.item ?? '기준 미정' }}</span>
                <span :class="['meter', r.grade]"><i :style="{ width: meter(r.percent) }"></i></span>
              </button>
            </template>
          </template>

          <details class="normal">
            <summary><BaseIcon name="chevron-right" :size="16" />정상 {{ g.normal.length }}대<template v-if="g.unset.length"> · 기준 미정 {{ g.unset.length }}대</template><span class="r">높은 순</span></summary>
            <button
              v-for="r in [...g.normal, ...g.unset]"
              :key="r.id"
              type="button"
              :class="['it', r.grade, { on: r.id === p.selected.value?.equipmentId }]"
              :aria-pressed="r.id === p.selected.value?.equipmentId"
              @click="pick(r)"
            >
              <span class="nm">{{ r.name }}</span>
              <b class="pc">{{ pct(r.percent) }}</b>
              <span class="itm">{{ r.item ?? '기준 미정 (관리값 기준 설정에서 입력)' }}</span>
              <span :class="['meter', r.grade]"><i :style="{ width: meter(r.percent) }"></i></span>
            </button>
          </details>
        </div>
        <BaseEmpty v-else text="불러오는 중" />
      </BasePanel>

      <div class="right">
        <div class="pick" aria-label="설비">
          <span class="lab">설비</span>
          <BaseSegmented v-if="areaOptions.length" v-model="pickArea" label="구역" size="sm" :options="areaOptions" />
          <BaseSegmented v-if="equipOptions.length" v-model="pickEquip" label="설비" size="sm" :options="equipOptions" />
        </div>

        <BasePanel class="sensors">
          <template #head>
            <div v-if="sel" class="sel">
              <h2>{{ sel.name }}</h2>
              <StatusKey :state="sel.state" size="sm" />
              <span :class="['tag', sel.grade]">{{ GRADE_WORD[sel.grade] }}</span>
              <span v-if="p.dangerSince.value" class="since">{{ p.dangerSince.value }}</span>
              <span class="meta">센서 {{ sn.tiles.value.length }}개 · 최근 1시간 · 온도·진동·전류 등 설비 센서는 더미 값</span>
            </div>
            <h2 v-else>설비를 고르세요</h2>
          </template>
          <div v-if="sn.tiles.value.length" class="tiles">
            <SensorTile v-for="t in sn.tiles.value" :key="t.key" :tile="t" :selected="t.key === item" @select="item = $event" />
          </div>
          <BaseEmpty v-else :text="sel ? '데이터 없음' : '왼쪽 목록에서 설비를 고르세요'" />
        </BasePanel>

        <div class="lower">
          <BasePanel class="trend">
            <template #head><h2>{{ item ? `${metricLabel(item)} 추이` : '추이' }}</h2></template>
            <template #tools>
              <ChartLegend :items="legend" />
              <BaseSegmented v-model="range" label="구간" size="sm" :options="RANGES" />
            </template>
            <ChartLine
              v-if="p.chart.value.points.length"
              class="chart"
              :label="`${sel?.name} ${metricLabel(item)} 추이`"
              :x="p.chart.value.x"
              :y="p.chart.value.y"
              :x-ticks="p.chart.value.xTicks"
              :y-ticks="p.chart.value.yTicks"
              :y-digits="p.chart.value.yDigits"
              :series="[{ key: 'v', points: p.chart.value.points }]"
              :ref-lines="p.chart.value.refLines"
              :marks="p.chart.value.ngPoints"
              :now="p.now.value"
              end-dot
            />
            <BaseEmpty v-else class="chart" />
          </BasePanel>

          <BasePanel title="센서별 오늘 이력" :meta="sn.lanes.value.rows.length ? `${sn.axis.value[0]} ~ 지금` : undefined">
            <SensorLanes
              v-if="sn.lanes.value.rows.length"
              :rows="sn.lanes.value.rows"
              :axis="sn.axis.value"
              :events="sn.lanes.value.events"
              :selected="item"
              @select="item = $event"
            />
            <BaseEmpty v-else />
          </BasePanel>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
/* 이 화면 글씨 크기 4단계
   24 --fs-page 화면 제목
   20 --fs-lg   패널 제목 · 고른 설비 이름
   16 --fs-row  주인공 값: 설비 이름 · 위험도 % · 등급별 대수 · 센서 이름 · 센서 값
   13 --fs-sm   나머지 보조 글: 설명 · 항목 이름 · 등급 글자 · 단위 · 기준 · 축 · 범례 · 이력 */
.layout :deep(.meta),
.layout :deep(.empty) {
  font-size: var(--fs-sm);
}

.title {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.note {
  overflow: hidden;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout {
  display: grid;
  grid-template-columns: var(--col-side) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

/* ── 왼쪽 목록 ── */

/* 등급별 대수: 위험 · 주의 · 정상 세 칸, 글자·숫자 가운데 */
.counts {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 0 var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
}

.counts > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-1);
  text-align: center;
}

.counts > div + div {
  border-left: var(--line-w) solid var(--c-line-strong);
}

.counts dt {
  color: var(--c-ink-2);
  font-size: var(--fs-row);
}

.counts dd {
  margin: 0;
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
  font-variant-numeric: tabular-nums;
}

.counts .danger dd { color: var(--c-down); }
.counts .warn dd { color: var(--c-caution-ink); }

.list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.grp {
  padding: var(--sp-3) 0 var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.it {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px var(--sp-3);
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: 0;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.it:hover {
  background: var(--c-surface-sunk);
}

.it.on {
  background: var(--c-surface-sunk);

  /* 고른 칸: 가라앉은 면 + 네 변 가는 테두리 (hover는 면만) */
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
}

.nm {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.pc {
  font-size: var(--fs-row);
  font-variant-numeric: tabular-nums;
}

.itm {
  grid-column: 1 / -1;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.meter {
  grid-column: 1 / -1;
  height: var(--sp-1);
  margin-top: var(--sp-1);
  border-radius: 2px;
  background: var(--c-track);
}

.meter i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--c-ink-3);
}

.meter.danger i { background: var(--c-down); }
.meter.warn i { background: var(--c-idle-edge); }

/* 등급 글자 칸: 칸 바깥 테두리와 같은 말 (주의 = 노랑 실선, 위험 = 빨강 점선) */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--sp-1);
  border: var(--line-w-strong) solid var(--c-line-strong);
  border-radius: var(--r-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
  line-height: 1.5;
}

.tag.warn {
  border-color: var(--c-idle-edge);
  color: var(--c-caution-ink);
}

.tag.danger {
  border-style: dashed;
  border-color: var(--c-down);
  color: var(--c-down);
}

.normal summary {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-3) 0 var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  cursor: pointer;
  list-style: none;
}

.normal summary::-webkit-details-marker {
  display: none;
}

.normal[open] summary :deep(svg) {
  transform: rotate(90deg);
}

.normal .r {
  margin-left: auto;
  color: var(--c-ink-3);
}

/* ── 오른쪽 ── */
.sel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
}

.sel h2 {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.sel .tag {
  font-size: var(--fs-sm);
}

.since {
  margin-left: auto;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
}

.right {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  min-height: 0;
}

.pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-3);
  background: var(--c-surface);
}

.pick .lab {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.sel .meta {
  margin-left: auto;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.since + .meta {
  margin-left: 0;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--sp-8) * 5), 1fr));
  gap: var(--sp-2);
}

.lower {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 5fr) minmax(0, 2fr);
  gap: var(--sp-4);
  min-height: 0;
}

.trend :deep(.tools) {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
}

.chart {
  flex: 1;
  min-height: var(--chart-min-h);
}
</style>
