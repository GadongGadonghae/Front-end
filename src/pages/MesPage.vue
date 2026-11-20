<!-- 임시 MES (11/20, 시연용): 캠퍼스장이 우리 시스템에서 "보고서 전송"된 AI 보고서를 받아 열람한다
     화면 틀은 일반적인 MES 메인(왼쪽 메뉴 + 상단 + 현황 대시보드). 메뉴 중 "수신 보고서"만 열리고 나머지는 잠김(시연 범위 밖)
     수신 보고서는 같은 앱·같은 브라우저 저장(localStorage)을 읽으므로 같은 주소·같은 브라우저에서만 보인다
     보고서 외 모든 숫자·목록은 더미 데이터 — 화면에 더미라고 밝힌다. 실제 MES 연동은 향후 과제 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
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
const KPIS = [
  { label: '오늘 생산량', value: '41,280', unit: '개', sub: '계획 대비 96.2%' },
  { label: '설비 가동률', value: '87.4', unit: '%', sub: '전일 대비 +1.3%p' },
  { label: '불량률', value: '1.8', unit: '%', sub: '목표 2.0% 이내' },
  { label: '납기 준수율', value: '98.5', unit: '%', sub: '이번 달 누적' },
]
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
const NOTICES = [
  { at: '11/20 08:10', text: '공장 3 용접 라인 정기 점검 일정 안내 (11/24)' },
  { at: '11/19 17:40', text: '신규 부품 코일 입고 계획 변경 (납기 조정)' },
  { at: '11/19 09:05', text: '11월 협력사 종합평가 자료 제출 안내' },
]
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
            <div v-for="k in KPIS" :key="k.label" class="kpi">
              <span class="k-label">{{ k.label }}</span>
              <b class="k-val">{{ k.value }}<span class="k-unit">{{ k.unit }}</span></b>
              <span class="k-sub">{{ k.sub }}</span>
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
            <h2>공지 · 알림</h2>
            <ul class="notices">
              <li v-for="n in NOTICES" :key="n.at"><time>{{ n.at }}</time>{{ n.text }}</li>
            </ul>
            <button type="button" class="to-reports" @click="view = 'reports'">
              공장 1에서 받은 보고서 {{ flow.sent.value.length }}건 확인하기 ›
            </button>
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
  padding: var(--sp-3) var(--page-gutter);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

.brand {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.tag {
  padding: 2px var(--sp-2);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.sp {
  flex: 1;
}

.link {
  color: var(--c-inverse-ink);
}

.out {
  padding: var(--sp-1) var(--sp-3);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  background: none;
  color: var(--c-inverse-ink);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.user {
  color: var(--c-inverse-ink-2);
  font-size: var(--fs-sm);
}

.frame {
  display: grid;
  grid-template-columns: 220px 1fr;
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
  padding: var(--sp-3);
  border: 0;
  border-radius: var(--r-1);
  background: none;
  color: var(--c-ink);
  font: inherit;
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
  font-size: var(--fs-sm);
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
  font-size: var(--fs-sm);
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

.k-label,
.k-sub {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.k-val {
  font-size: var(--fs-2xl);
  font-variant-numeric: tabular-nums;
  font-weight: var(--fw-strong);
}

.k-unit {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-md);
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
  font-size: var(--fs-sm);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: var(--sp-2);
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

.notices {
  display: grid;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-3);
  padding: 0;
  list-style: none;
}

.notices time {
  margin-right: var(--sp-3);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.to-reports {
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-accent);
  border-radius: var(--r-1);
  background: var(--c-accent-tint);
  color: var(--c-ink);
  font: inherit;
  cursor: pointer;
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
  font-size: var(--fs-sm);
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
