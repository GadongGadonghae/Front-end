<!-- SCR-004 예지보전 (화면정의서 SCR-004, 시안 B-pdm)
     왼쪽: 등급별 대수 → 위험도 목록 (위험 → 주의 → 정상은 접어 둠, D-61). 지금 고장 난 설비는 따로
     오른쪽: 고른 설비 이름·등급·상태 → 항목 고르기 · 범례 · 구간 → 관리값 추이(상·하한 점선, 80%·90% 옅은 선) → 상한 도달 예상 [차순위] · 항목별 표
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
import { usePdm, DANGER, WARN, type Grade, type RiskRow } from '@/composables/usePdm'
import { STATE_NAME } from '@/lib/status'
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

const GRADE_WORD: Record<Grade, string> = { danger: '위험', warn: '주의', normal: '정상', unset: '기준 미정' }
const pct = (v: number | null) => (v == null ? '-' : `${v}%`)
const meter = (v: number | null) => `${Math.min(100, v ?? 0)}%`
const itemOptions = computed(() => (p.selected.value?.items ?? []).map((i) => ({ value: i.item, label: i.percent == null ? metricLabel(i.item) : `${metricLabel(i.item)} ${i.percent}%` })))
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

      <BasePanel class="detail">
        <template #head>
          <div v-if="sel" class="sel">
            <h2>{{ sel.name }}</h2>
            <span :class="['tag', sel.grade]">{{ sel.percent != null ? `${GRADE_WORD[sel.grade]} ${sel.percent}%` : GRADE_WORD[sel.grade] }}</span>
            <StatusKey :state="sel.state" size="sm" :label="`${STATE_NAME[sel.state]} 중`" />
            <span v-if="p.dangerSince.value" class="since">{{ p.dangerSince.value }}</span>
          </div>
          <h2 v-else>설비를 고르세요</h2>
        </template>

        <template v-if="p.selected.value">
          <div class="bar">
            <BaseSegmented v-if="itemOptions.length > 1" v-model="item" label="관리값 항목" size="sm" :options="itemOptions" />
            <div class="r">
              <ChartLegend :items="legend" />
              <BaseSegmented v-model="range" label="구간" size="sm" :options="RANGES" />
            </div>
          </div>
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

          <div class="under">
            <div class="eta">
              <div class="lab">상한 도달 예상 <span class="later">차순위</span></div>
              <b>{{ p.etaText.value?.main ?? '-' }}</b>
              <div class="sub">{{ p.etaText.value?.sub ?? '기준이 있는 항목만 계산' }}</div>
            </div>
            <table class="items" aria-label="항목별 위험도">
              <thead><tr><th scope="col">항목</th><th scope="col" class="num">최근 10분 평균</th><th scope="col" class="num">하한 ~ 상한</th><th scope="col" class="num">위험도</th></tr></thead>
              <tbody>
                <tr v-for="r in p.itemRows.value" :key="r.key" :class="{ on: r.item === item }" @click="item = r.item">
                  <td>{{ r.label }}</td>
                  <td class="num">{{ r.avg }}</td>
                  <td class="num">{{ r.limit }}</td>
                  <td class="num"><span v-if="r.grade === 'danger' || r.grade === 'warn'" :class="['tag', r.grade]">{{ GRADE_WORD[r.grade] }}</span><b>{{ pct(r.percent) }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <BaseEmpty v-else text="왼쪽 목록에서 설비를 고르세요" />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-lg);
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
.counts {
  display: flex;
  flex: none;
  gap: var(--sp-6);
  margin: 0 0 var(--sp-3);
}

.counts dt {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.counts dd {
  margin: 0;
  font-size: var(--fs-lg);
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
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.pc {
  font-size: var(--fs-md);
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

.bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.bar .r {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  margin-left: auto;
}

.chart {
  flex: 1;
  min-height: var(--chart-min-h);
}

.under {
  display: grid;
  flex: none;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
}

.eta .lab,
.eta .sub {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.eta b {
  display: block;
  margin: var(--sp-1) 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.later {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.items {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-md);
}

.items th {
  padding: var(--sp-1) var(--sp-3);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  text-align: left;
}

.items td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: var(--line-w) solid var(--c-line);
  font-variant-numeric: tabular-nums;
}

.items th:first-child,
.items td:first-child {
  padding-left: 0;
}

.items .num {
  text-align: right;
}

.items td .tag {
  margin-right: var(--sp-2);
}

.items tr {
  cursor: pointer;
}

.items tr.on td {
  background: var(--c-surface-sunk);
}
</style>
