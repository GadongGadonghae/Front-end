<!-- 임시 MES (11/20, 시연용): 캠퍼스장이 우리 시스템에서 "보고서 전송"된 AI 보고서를 받아 열람한다
     화면 틀은 일반적인 MES 메인(왼쪽 메뉴 + 상단 + 현황 대시보드). 메뉴 중 "수신 보고서"만 열리고 나머지는 잠김(시연 범위 밖)
     수신 보고서는 같은 앱·같은 브라우저 저장(localStorage)을 읽으므로 같은 주소·같은 브라우저에서만 보인다
     보고서 외 모든 숫자·목록은 더미 데이터 — 화면에 더미라고 밝힌다. 실제 MES 연동은 향후 과제 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import ChartDonut from '@/components/charts/ChartDonut.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import MesReportView from '@/components/domain/MesReportView.vue'
import { useAuth } from '@/composables/useAuth'
import { useReportFlow, flowLine } from '@/composables/useReportFlow'
import { downloadDailyDoc } from '@/lib/dailyDoc'
import { downloadReplanDoc } from '@/lib/replanDoc'

const router = useRouter()
const { userName, roleName, logout } = useAuth()
const flow = useReportFlow()

// ── 메뉴: 수신 보고서만 열린다 ──
type View = 'home' | 'reports'
const view = ref<View>('home')
const MENU: { name: string; open?: View }[] = [
  { name: '현황 대시보드', open: 'home' },
  { name: '생산 관리' },
  { name: '품질 관리' },
  { name: '설비 관리' },
  { name: '자재·재고 관리' },
  { name: '납기·출하 관리' },
  { name: '수신 보고서', open: 'reports' },
]

// ── 더미 데이터 (시연용, 실제 값 아님) ──
const PLAN_TOTAL = 42_900
const DONE_TOTAL = 41_280
const DONE_RATE = (DONE_TOTAL / PLAN_TOTAL) * 100
const OEE = { total: 84.1, avail: 94.0, perf: 93.5, qual: 95.7 }
const OEE_SLICES = [
  { key: 'oee', value: OEE.total, color: 'var(--c-accent)', title: `OEE ${OEE.total}%` },
  { key: 'rest', value: 100 - OEE.total, color: 'var(--c-track)', title: '손실' },
]
const PPM_TARGET = 2000
const PPM_DAYS = [
  { d: '11/14', v: 2300 }, { d: '11/15', v: 2150 }, { d: '11/16', v: 2100 }, { d: '11/17', v: 1950 },
  { d: '11/18', v: 1880 }, { d: '11/19', v: 1830 }, { d: '11/20', v: 1820 },
]
const SPARK = { w: 220, h: 64, min: 1600, max: 2400 }
const sparkY = (v: number) => SPARK.h - ((v - SPARK.min) / (SPARK.max - SPARK.min)) * SPARK.h
const sparkPoints = PPM_DAYS.map((x, i) => `${(i / (PPM_DAYS.length - 1)) * SPARK.w},${sparkY(x.v)}`).join(' ')
const DUE_TARGET = 98
const DUE_WEEKS = [
  { w: '1주', v: 97.8 }, { w: '2주', v: 98.9 }, { w: '3주', v: 98.7 },
]
// 막대 높이: 96~100% 구간을 0~100%로 확대 (차이가 보이도록)
const dueH = (v: number) => `${((v - 96) / 4) * 100}%`
const dueTargetBottom = `${((DUE_TARGET - 96) / 4) * 100}%`

const DELIVERIES = [
  { at: '08:00', to: '현대 울산', item: '사이드 아우터 패널', qty: 1200, state: '완료' },
  { at: '11:00', to: '현대 아산', item: '필러 리인포스', qty: 800, state: '완료' },
  { at: '14:00', to: '기아 광명', item: '루프 레일', qty: 650, state: '진행' },
  { at: '17:00', to: '현대 울산', item: '플로어 크로스멤버', qty: 900, state: '지연 위험' },
]
const DELIVERY_CLASS: Record<string, string> = { 완료: 'ok', 진행: 'wait', '지연 위험': 'late' }
const FACTORIES = [
  { name: '차체 캠퍼스 공장 1', plan: 9000, done: 8650, oee: 84.1, state: '정상' },
  { name: '차체 캠퍼스 공장 2', plan: 8200, done: 8010, oee: 88.6, state: '정상' },
  { name: '차체 캠퍼스 공장 3', plan: 7600, done: 6980, oee: 79.3, state: '주의' },
  { name: '차체 캠퍼스 공장 4', plan: 8800, done: 8560, oee: 90.2, state: '정상' },
]
const WEEK = [
  { d: '월', v: 38200 }, { d: '화', v: 40100 }, { d: '수', v: 39400 }, { d: '목', v: 42300 }, { d: '금', v: 41280 },
]
const WEEK_MAX = Math.max(...WEEK.map((w) => w.v))
const pct = (done: number, plan: number) => `${((done / plan) * 100).toFixed(1)}%`

// ── 수신 보고서 ──
const pickedKey = ref<string | null>(null)
const picked = computed(() => flow.sent.value.find((f) => f.key === pickedKey.value) ?? flow.sent.value[0] ?? null)
const KIND = { daily: '일일 생산 마감', replan: '생산계획 수정 검토' }

async function download() {
  const f = picked.value
  if (f?.daily) await downloadDailyDoc(f.daily)
  else if (f?.replan) await downloadReplanDoc(f.replan)
}

async function onLogout() {
  await logout()
  router.push('/login')
}
</script>

<template>
  <div class="mes">
    <header class="top">
      <b class="brand">차체 캠퍼스 MES</b>
      <span class="tag">임시 구현 · 시연용</span>
      <span class="sp" />
      <RouterLink class="link" to="/">라인 가동 시스템 보기 ›</RouterLink>
      <span class="user">{{ userName }} · {{ roleName }}</span>
      <button class="out" type="button" @click="onLogout">로그아웃</button>
    </header>

    <div class="frame">
      <nav class="side" aria-label="MES 메뉴">
        <button
          v-for="m in MENU"
          :key="m.name"
          type="button"
          :class="['menu', { on: m.open && view === m.open }]"
          :disabled="!m.open"
          :title="m.open ? undefined : '시연 범위 밖 (임시 MES)'"
          @click="m.open && (view = m.open)"
        >
          <span>{{ m.name }}</span>
          <small v-if="m.open === 'reports' && flow.sent.value.length" class="badge">{{ flow.sent.value.length }}</small>
        </button>
      </nav>

      <main class="body">
        <!-- 현황 대시보드 (전부 더미) -->
        <template v-if="view === 'home'">
          <p class="dummy-note">이 화면의 숫자와 목록은 모두 <b>더미 데이터</b>입니다. 열리는 메뉴는 [수신 보고서] 하나뿐입니다.</p>

          <section class="kpis">
            <!-- 오늘 생산량: 계획 대비 진행 → 진행 막대 -->
            <div class="kpi">
              <span class="k-label">오늘 생산량</span>
              <b class="k-val">{{ DONE_TOTAL.toLocaleString() }}<span class="k-unit">개</span></b>
              <div class="k-chart prog">
                <ChartProgress :percent="DONE_RATE" :label="`계획 ${PLAN_TOTAL.toLocaleString()}개 대비 ${DONE_RATE.toFixed(1)}%`" />
                <span class="k-cap"><span>계획 {{ PLAN_TOTAL.toLocaleString() }}</span><span>{{ DONE_RATE.toFixed(1) }}%</span></span>
              </div>
            </div>

            <!-- 설비 종합효율(OEE): 전체 중 차지하는 비율 → 도넛 + 가동·성능·양품 -->
            <div class="kpi">
              <span class="k-label">설비 종합효율(OEE)</span>
              <b class="k-val">{{ OEE.total }}<span class="k-unit">%</span></b>
              <div class="k-chart oee">
                <ChartDonut :slices="OEE_SLICES" :label="`OEE ${OEE.total}%`" class="mini-donut" />
                <ul>
                  <li><span class="o-name">가동률</span><b>{{ OEE.avail }}%</b></li>
                  <li><span class="o-name">성능</span><b>{{ OEE.perf }}%</b></li>
                  <li><span class="o-name">양품률</span><b>{{ OEE.qual }}%</b></li>
                </ul>
              </div>
            </div>

            <!-- 불량 PPM: 시간에 따른 추이 + 목표선 → 선 그래프 -->
            <div class="kpi">
              <span class="k-label">불량 PPM</span>
              <b class="k-val">{{ PPM_DAYS[PPM_DAYS.length - 1].v.toLocaleString() }}</b>
              <div class="k-chart">
                <svg :viewBox="`0 0 ${SPARK.w} ${SPARK.h}`" preserveAspectRatio="none" role="img" aria-label="최근 7일 불량 PPM 추이, 목표 2,000 이하">
                  <line class="ref" x1="0" :y1="sparkY(PPM_TARGET)" :x2="SPARK.w" :y2="sparkY(PPM_TARGET)" />
                  <polyline class="spark" :points="sparkPoints" />
                </svg>
                <span class="k-cap"><span>최근 7일</span><span>점선 = 목표 {{ PPM_TARGET.toLocaleString() }}</span></span>
              </div>
            </div>

            <!-- 납기 준수율: 기간별 비교 + 목표 → 주차별 막대 -->
            <div class="kpi">
              <span class="k-label">납기 준수율(현대·기아)</span>
              <b class="k-val">98.5<span class="k-unit">%</span></b>
              <div class="k-chart">
                <ul class="cols" role="img" aria-label="이번 달 주차별 납기 준수율, 목표 98%">
                  <li v-for="w in DUE_WEEKS" :key="w.w" class="col">
                    <i :style="{ height: dueH(w.v) }"></i><span class="col-name">{{ w.w }}</span>
                  </li>
                  <li class="ref-line" :style="{ bottom: dueTargetBottom }"></li>
                </ul>
                <span class="k-cap"><span>이번 달 주차별</span><span>선 = 목표 {{ DUE_TARGET }}%</span></span>
              </div>
            </div>
          </section>

          <div class="grid2">
            <section class="panel">
              <h2>공장별 생산 현황 <small>오늘</small></h2>
              <table>
                <thead><tr><th>공장</th><th>계획</th><th>실적</th><th>달성률</th><th>OEE</th><th>상태</th></tr></thead>
                <tbody>
                  <tr v-for="f in FACTORIES" :key="f.name">
                    <td>{{ f.name }}</td>
                    <td>{{ f.plan.toLocaleString() }}</td>
                    <td>{{ f.done.toLocaleString() }}</td>
                    <td>{{ pct(f.done, f.plan) }}</td>
                    <td>{{ f.oee }}%</td>
                    <td>{{ f.state }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="panel">
              <h2>주간 생산 추이 <small>개/일</small></h2>
              <ul class="bars">
                <li v-for="w in WEEK" :key="w.d">
                  <span>{{ w.d }}</span>
                  <i :style="{ width: `${(w.v / WEEK_MAX) * 100}%` }"></i>
                  <b>{{ w.v.toLocaleString() }}</b>
                </li>
              </ul>
            </section>
          </div>

          <section class="panel">
            <h2>납입 일정 <small>고객사별 · 오늘</small></h2>
            <table>
              <thead><tr><th>시간</th><th>고객사</th><th>품목</th><th>수량</th><th>상태</th></tr></thead>
              <tbody>
                <tr v-for="d in DELIVERIES" :key="d.at">
                  <td>{{ d.at }}</td><td>{{ d.to }}</td><td>{{ d.item }}</td><td>{{ d.qty.toLocaleString() }}</td>
                  <td><span :class="['state', DELIVERY_CLASS[d.state]]">{{ d.state }}</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        </template>

        <!-- 수신 보고서: 실제 데이터 (우리 시스템에서 전송된 것) -->
        <div v-else class="reports">
          <section class="panel list">
            <h2>받은 공장 보고서 <small>{{ flow.sent.value.length }}건</small></h2>
            <ul v-if="flow.sent.value.length">
              <li v-for="f in flow.sent.value" :key="f.key">
                <button type="button" :class="['item', { on: picked?.key === f.key }]" @click="pickedKey = f.key">
                  <span class="from">공장 1 · {{ KIND[f.kind] }}</span>
                  <b>{{ f.title }}</b>
                  <span class="when">{{ flowLine(f).sent }} 전송</span>
                </button>
              </li>
            </ul>
            <p v-else class="empty">아직 전송된 보고서가 없습니다. 우리 시스템에서 공장장이 결재 후 [보고서 전송]을 누르면 여기에 들어옵니다.</p>
          </section>

          <section class="panel view">
            <template v-if="picked">
              <div class="vh">
                <div>
                  <h2>{{ picked.title }}</h2>
                  <p class="sign">작성 {{ flowLine(picked).written }} · 결재 {{ flowLine(picked).approved }} · 전송 {{ flowLine(picked).sent }}</p>
                </div>
                <BaseButton size="sm" @click="download">Word(.doc) 받기</BaseButton>
              </div>
              <MesReportView :daily="picked.daily" :replan="picked.replan" />
            </template>
            <p v-else class="empty">보고서를 고르면 내용이 보입니다.</p>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.mes {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100%;
  background: var(--c-canvas);
}

.top {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 76px;
  padding: 0 var(--page-gutter);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

.brand {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
}

.tag {
  padding: 2px var(--sp-2);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  font-size: var(--fs-row);
  font-weight: var(--fw-regular);
}

.sp {
  flex: 1;
}

.link {
  color: var(--c-inverse-ink);
  font-size: var(--fs-row);
}

.out {
  padding: var(--sp-1) var(--sp-3);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  background: none;
  color: var(--c-inverse-ink);
  font: inherit;
  font-size: var(--fs-row);
  cursor: pointer;
}

.user {
  color: var(--c-inverse-ink-2);
  font-size: var(--fs-row);
}

.frame {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 0;
}

.side {
  display: grid;
  align-content: start;
  gap: var(--sp-1);
  padding: var(--sp-4) var(--sp-3);
  border-right: var(--line-w) solid var(--c-line);
  background: var(--c-surface);
}

.menu {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-3);
  border: 0;
  border-radius: var(--r-1);
  background: none;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-lg);
  text-align: left;
  cursor: pointer;
}

.menu:disabled {
  color: var(--c-ink-3);
  cursor: not-allowed;
}

.menu.on {
  background: var(--c-accent-tint);
  font-weight: var(--fw-strong);
}

.badge {
  min-width: 20px;
  padding: 0 var(--sp-2);
  border-radius: var(--r-3);
  background: var(--c-accent);
  color: var(--c-inverse-ink);
  font-size: var(--fs-row);
  text-align: center;
}

.body {
  display: grid;
  align-content: start;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--page-gutter);
}

.dummy-note {
  color: var(--c-ink-3);
  font-size: var(--fs-row);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-3);
}

.kpi {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.k-label {
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.k-val {
  font-size: var(--fs-xl);
  font-variant-numeric: tabular-nums;
  font-weight: var(--fw-strong);
}

.k-chart {
  display: grid;
  gap: var(--sp-1);
  min-height: 84px;
  margin-top: var(--sp-2);
}

.k-cap {
  display: flex;
  justify-content: space-between;
  color: var(--c-ink-3);
  font-size: var(--fs-row);
}

.prog {
  align-content: end;
}

.oee {
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--sp-4);
}

.oee ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  font-size: var(--fs-row);
  list-style: none;
}

.oee li {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  font-variant-numeric: tabular-nums;
}

.oee .o-name {
  color: var(--c-ink-3);
}

.mini-donut {
  --donut-size: 80px;

  margin: 0;
}

svg {
  width: 100%;
  height: 64px;
  overflow: visible;
}

.spark {
  fill: none;
  stroke: var(--c-accent);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.ref {
  stroke: var(--c-line-strong);
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
}

.cols {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: var(--sp-3);
  height: 64px;
  margin: 0;
  padding: 0 0 24px;
  list-style: none;
}

.col {
  position: relative;
  display: flex;
  flex: 1;
  align-items: flex-end;
  height: 100%;
}

.cols i {
  display: block;
  width: 100%;
  border-radius: var(--r-1) var(--r-1) 0 0;
  background: var(--c-accent);
}

.col .col-name {
  position: absolute;
  bottom: -24px;
  left: 0;
  width: 100%;
  color: var(--c-ink-3);
  font-size: var(--fs-row);
  text-align: center;
}

.ref-line {
  position: absolute;
  right: 0;
  left: 0;
  margin-bottom: 24px;
  border-top: var(--line-w) dashed var(--c-line-strong);
}

.state {
  padding: 2px var(--sp-2);
  border-radius: var(--r-3);
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

.state.ok {
  background: var(--c-run);
  color: var(--c-run-ink);
}

.state.wait {
  background: var(--c-idle);
  color: var(--c-idle-ink);
}

.state.late {
  background: var(--c-down);
  color: var(--c-down-ink);
}

.k-unit {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-lg);
}

.grid2 {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: var(--sp-4);
}

.panel {
  padding: var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

h2 {
  margin-bottom: var(--sp-3);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

h2 small {
  color: var(--c-ink-3);
  font-size: var(--fs-row);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: var(--sp-2);
  font-size: var(--fs-row);
  border-bottom: var(--line-w) solid var(--c-line);
  text-align: left;
}

th {
  color: var(--c-ink-2);
}

.bars {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: grid;
  font-size: var(--fs-row);
  grid-template-columns: 24px 1fr 64px;
  align-items: center;
  gap: var(--sp-2);
  font-variant-numeric: tabular-nums;
}

.bars i {
  height: 14px;
  border-radius: var(--r-1);
  background: var(--c-proc-1);
}

.reports {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--sp-4);
  align-items: start;
}

.list ul {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item.on {
  border-color: var(--c-accent);
  background: var(--c-accent-tint);
}

.from,
.when,
.sign {
  color: var(--c-ink-3);
  font-size: var(--fs-row);
}

.vh {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.empty {
  color: var(--c-ink-3);
}
</style>
