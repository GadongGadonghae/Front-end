<!-- SCR-007 일일 생산 보고서 — 생김새는 AI 리포트 담당 시안 docs/wireframes/후보/B-daily.html 그대로 (11/19, 예전 대시보드형 틀 폐기)
     왼쪽: 오늘 마감 카드 + 이전에 작성한 보고서(지난 날, 기간 검색)
     오른쪽: [AI 일일 리포트 생성] [.doc] [PDF] → A4 "일일 생산 마감 보고서" 1~6
     값은 getDailyReport(API-080) · 비가동 이력 · 계획수정 보고서 목록에서. 문장(종합·AI 마감 검토·품질 요약·인계사항)은 숫자로 만든 템플릿
     (일일 보고서 저장·LLM API는 아직 없음: 지난 날은 그날 마감 값으로 바로 보여 줌) -->
<script setup lang="ts">
import { now as clockNow } from '@/clock'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import { useMaster } from '@/composables/useMaster'
import { dateWithDay } from '@/composables/useReports'
import { source } from '@/data'
import { DOWNTIME_NAME, PROCESS_NAME } from '@/lib/status'
import { formatDuration, formatNumber, formatTime, secondsBetween, toDateStr } from '@/lib/format'
import { downloadDailyDoc, type DailyDocData } from '@/lib/dailyDoc'
import ReportApproval from '@/components/domain/ReportApproval.vue'
import ReportFold from '@/components/domain/ReportFold.vue'
import { useAuth } from '@/composables/useAuth'
import { useReportFlow, flowLine } from '@/composables/useReportFlow'
import type { DailyReport, ReplanSummary } from '@/types/report'
import type { HistoryEvent } from '@/types/events'

const TABS = [
  { key: 'daily', label: '일일 생산 리포트', to: '/reports/daily' },
  { key: 'replan', label: '계획수정 보고서', to: '/reports/replan' },
]
/** 이전 보고서 목록: 지난 30일 (그날 마감 값) */
const PAST_DAYS = 30
const DAY = 86_400_000
const SHIFT = '주간 (09:00~18:00)'
const AUTHOR = source.demo ? '윤은빈' : ''
const route = useRoute()
const { can } = useAuth()
const flow = useReportFlow()

const { equipmentName } = useMaster()
const today = toDateStr(clockNow())
const pastDays = Array.from({ length: PAST_DAYS }, (_, i) => toDateStr(Date.parse(today) - (i + 1) * DAY))

/** 고른 날짜. 오늘은 [AI 일일 리포트 생성]을 눌러야 보고서가 보임 */
/** 문서만 보기 (/doc/daily/:date, 임시 MES 틀 안, 11/21): 그날 보고서를 바로 */
const docOnly = computed(() => route.meta.docOnly === true)
const date = ref(docOnly.value && typeof route.params.date === 'string' ? route.params.date : today)
const isToday = computed(() => date.value === today)
/** 왼쪽 묶음 펼침 (11/22): 처음엔 오늘 보고서만 */
const nowOpen = ref(true)
const prevOpen = ref(false)
const generatedAt = ref<string | null>(null)
/** 오늘 보고서를 팀장이 이미 작성(결재 요청)했으면 다른 계정에서도 보이게 */
const todayFlow = computed(() => flow.flowOf(`daily:${today}`))
const madeAt = computed(() => generatedAt.value ?? todayFlow.value?.writtenAt ?? null)
const shown = computed(() => !isToday.value || madeAt.value !== null)

// ── 값 불러오기 ──
const report = shallowRef<DailyReport | null>(null)
const events = shallowRef<HistoryEvent[]>([])
const replans = shallowRef<ReplanSummary[]>([])
const error = ref('')
const loading = ref(false)
async function load() {
  const d = date.value
  loading.value = true
  error.value = ''
  report.value = null
  try {
    const [r, h, rp] = await Promise.all([
      source.q.getDailyReport(d),
      source.q.getHistory({ from: d, to: d, states: ['D', 'S'], minMinutes: 0, page: 1 }).then((p) => p.items).catch(() => [] as HistoryEvent[]),
      source.q.getReplanReports(d, d).catch(() => [] as ReplanSummary[]),
    ])
    if (date.value !== d) return
    report.value = r
    events.value = h
    replans.value = rp
  } catch (e) {
    if (date.value === d) error.value = e instanceof Error ? e.message : '일일 리포트 값을 불러오지 못했습니다'
  } finally {
    if (date.value === d) loading.value = false
  }
}
watch(date, load, { immediate: true })

function generate() {
  generatedAt.value = new Date(clockNow()).toISOString()
  load()
}
function printPdf() {
  window.print()
}

// ── 이전 보고서 기간 검색 (시안 initPeriodFilter) ──
const from = ref('')
const to = ref('')
const preset = ref<number | null>(0)
function pick(days: number) {
  preset.value = days
  if (days) {
    from.value = toDateStr(Date.parse(today) - (days - 1) * DAY)
    to.value = today
  } else {
    from.value = ''
    to.value = ''
  }
}
const periodInvalid = computed(() => !!from.value && !!to.value && from.value > to.value)
const listed = computed(() => (periodInvalid.value ? [] : pastDays.filter((d) => (!from.value || d >= from.value) && (!to.value || d <= to.value))))

// ── 문서 값 ──
const pct = (v: number | null | undefined) => (v == null ? '-' : `${formatNumber(v, 1)}%`)
const nowIso = () => new Date(clockNow()).toISOString()
const doc = computed(() => {
  const r = report.value
  if (!r || !shown.value) return null
  const lines = r.lines.filter((l) => l.lineId !== 'PT')
  const plan = r.target ?? lines.reduce((a, l) => a + (l.plan ?? 0), 0)
  const rate = plan ? (r.done / plan) * 100 : null
  const at = isToday.value && madeAt.value
    ? `${toDateStr(Date.parse(madeAt.value))} ${formatTime(madeAt.value)}`
    : `${r.date} 18:00`
  const processes = r.processes.map((p) => ({
    name: PROCESS_NAME[p.process],
    output: p.output, ng: p.ng, rate: p.output ? (p.ng / p.output) * 100 : null,
  }))
  const reportOf = (eventId: string) => replans.value.find((x) => x.stateEventId === eventId)
  const secOf = (e: HistoryEvent) => Math.max(0, secondsBetween(e.start, e.end ?? nowIso()))
  const sorted = events.value.slice().sort((a, b) => a.start.localeCompare(b.start))
  const down = sorted.map((e) => {
    const rp = reportOf(e.id)
    return {
      key: e.id,
      target: equipmentName(e.equipmentId),
      cause: [e.code ? DOWNTIME_NAME[e.code] : '통신 끊김', e.detail].filter(Boolean).join(' · '),
      time: `${formatTime(e.start).slice(0, 5)}~${e.end ? formatTime(e.end).slice(0, 5) : '진행 중'} (${formatDuration(secOf(e))})`,
      report: rp ? (/^\d+$/.test(rp.id) ? `AI-RPT-${toDateStr(Date.parse(rp.createdAt)).replaceAll('-', '')}-${rp.id.padStart(3, '0')}` : rp.id) : '-',
    }
  })
  const wip = r.wip.map((w) => ({ from: PROCESS_NAME[w.from], to: PROCESS_NAME[w.to], qty: `${formatNumber(w.qty)}${w.unit === 'roll' ? '롤' : '개'}` }))
  const worst = processes.filter((p) => p.ng > 0).sort((a, b) => b.ng - a.ng)[0]
  const faults = sorted.filter((e) => e.state === 'D')
  const longest = faults.length ? faults.reduce((a, e) => (secOf(e) > secOf(a) ? e : a)) : null
  const backlog = r.wip.filter((w) => w.from !== 'COIL').reduce((a, w) => a + w.qty, 0)
  return {
    no: `DAILY-${r.date.replaceAll('-', '')}-D`,
    at,
    date: dateWithDay(r.date),
    status: flowLine(flow.flowOf(`daily:${r.date}`)).label,
    plan,
    rate,
    summary: `${r.date} ${r.closed ? '' : `(${formatTime(r.at).slice(0, 5)} 기준) `}생산계획 ${formatNumber(plan)}개 대비 양품 ${formatNumber(r.done)}개를 생산하여 달성률 ${pct(rate)}로 ${r.closed ? '마감했습니다' : '진행 중입니다'}. 불량은 ${formatNumber(r.ngTotal)}개입니다.`,
    lines: lines.map((l) => ({ key: l.lineId, name: l.lineId, plan: l.plan, done: l.done, rate: l.rate, oee: l.oee, ng: l.ng })),
    totalNg: lines.reduce((a, l) => a + (l.ng ?? 0), 0),
    processes,
    down,
    wip,
    review: [
      `OEE ${pct(r.oee.oee)} (시간가동률 ${pct(r.oee.availability)} · 성능가동률 ${pct(r.oee.performance)} · 양품률 ${pct(r.oee.quality)}).`,
      longest ? `고장 ${faults.length}건, 가장 긴 정지는 ${equipmentName(longest.equipmentId)} ${formatDuration(secOf(longest))}입니다.` : '고장 정지는 없었습니다.',
      rate != null && rate < 100 ? `목표 대비 ${formatNumber(Math.max(0, plan - r.done))}개 부족합니다.` : '목표 수량을 달성했습니다.',
    ].join(' '),
    quality: worst ? `불량 ${formatNumber(r.ngTotal)}개 중 ${worst.name} 공정이 ${formatNumber(worst.ng)}개(불량률 ${pct(worst.rate)})로 가장 많습니다.` : '공정 불량이 없습니다.',
    handover: [
      ...faults.filter((e) => e.end === null).map((e) => `${equipmentName(e.equipmentId)} 고장 조치가 진행 중입니다. 복구 여부를 확인합니다.`),
      ...(worst ? [`${worst.name} 공정 불량 원인(관리값 이탈 항목)을 점검합니다.`] : []),
      backlog ? `공정 사이 재공 ${formatNumber(backlog)}개를 다음 근무조에서 먼저 처리합니다.` : '공정 사이 재공이 없습니다.',
      '생산 목표와 설비 상태를 근무 시작 전에 확인합니다.',
    ],
  }
})

/** .doc 양식 값. 내려받기와 결재 작성(MES로 보낼 내용)에 같이 쓴다 */
const docData = computed<DailyDocData | null>(() => {
  const r = report.value
  const d = doc.value
  if (!r || !d) return null
  return {
    fileName: `${d.no}.doc`,
    values: {
      DOC_NO: d.no, DOC_AT: d.at, PROD_DATE: d.date, SHIFT, STATUS: d.status,
      SUM_PLAN: `${formatNumber(d.plan)}개`, SUM_ACTUAL: `${formatNumber(r.done)}개`, SUM_RATE: pct(d.rate), SUM_DEFECT: `${formatNumber(r.ngTotal)}개`,
      SUMMARY_TEXT: d.summary,
      TOTAL_0: '합계', TOTAL_1: formatNumber(d.plan), TOTAL_2: formatNumber(r.done), TOTAL_3: pct(d.rate), TOTAL_5: formatNumber(d.totalNg),
      M0: pct(r.oee.oee), M1: pct(r.oee.availability), M2: pct(r.oee.performance), M3: pct(r.oee.quality),
      AI_REVIEW: d.review, QUALITY: d.quality,
    },
    tables: {
      LINES: d.lines.map((l) => [l.name, formatNumber(l.plan), formatNumber(l.done), pct(l.rate), pct(l.oee), formatNumber(l.ng)]),
      PROC: d.processes.map((p) => [p.name, formatNumber(p.output), formatNumber(p.ng), pct(p.rate)]),
      DOWN: d.down.length ? d.down.map((x) => [x.target, x.cause, x.time, x.report]) : [['-', '비가동 없음', '-', '-']],
      WIP: d.wip.map((w) => [w.from, w.to, w.qty]),
      HANDOVER: d.handover.map((h, i) => [`${i + 1}. ${h}`]),
    },
  }
})

const docBusy = ref(false)
async function downloadDoc() {
  const dd = docData.value
  if (!dd || docBusy.value) return
  docBusy.value = true
  try {
    await downloadDailyDoc(dd)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '.doc 파일을 만들지 못했습니다'
  } finally {
    docBusy.value = false
  }
}

// ── 결재·전송 (11/20): 작성 = 생산관리 팀장, 결재·전송 = 공장장 ──
const flowKey = computed(() => `daily:${date.value}`)
const flowView = computed(() => flowLine(flow.flowOf(flowKey.value)))
function writeFlow() {
  const dd = docData.value
  if (dd) flow.write(flowKey.value, 'daily', `일일 생산 보고서 · ${date.value}`, dd)
}
</script>

<template>
  <PageLayout :class="{ 'doc-only': docOnly }">
    <template #head>
      <h1 class="title">AI 리포트</h1>
      <BaseTabs :items="TABS" active="daily" label="리포트 종류" />
    </template>

    <div class="body">
      <section class="panel side">
        <div class="list">
          <ReportFold v-model:open="nowOpen" title="일일 생산 보고서" :count="madeAt ? 0 : 1" alert>
          <div
            :class="['today-card', { on: isToday }]"
            role="button"
            tabindex="0"
            @click="date = today"
            @keydown.enter.prevent="date = today"
            @keydown.space.prevent="date = today"
          >
            <div><b>{{ today }}</b><time>{{ madeAt ? `${formatTime(madeAt).slice(0, 5)} 작성` : '마감 대기' }}</time></div>
            <span :class="['draft-badge', { created: madeAt }]">{{ madeAt ? '보고서 작성 완료' : '보고서 미작성' }}</span>
          </div>
          </ReportFold>

          <ReportFold v-model:open="prevOpen" title="이전에 작성한 보고서" :count="listed.length">
            <form class="period-filter" role="search" aria-label="이전 보고서 기간 검색" @submit.prevent>
              <label><span>시작일</span><input v-model="from" type="date" :max="today" @input="preset = null"></label>
              <span class="sep" aria-hidden="true">~</span>
              <label><span>종료일</span><input v-model="to" type="date" :max="today" :aria-invalid="periodInvalid" @input="preset = null"></label>
              <div class="period-bar">
                <div class="seg" role="group" aria-label="기간 빠른 선택">
                  <button type="button" :class="{ on: preset === 7 }" :aria-pressed="preset === 7" @click="pick(7)">최근 7일</button>
                  <button type="button" :class="{ on: preset === 30 }" :aria-pressed="preset === 30" @click="pick(30)">최근 30일</button>
                  <button type="button" :class="{ on: preset === 0 }" :aria-pressed="preset === 0" @click="pick(0)">전체</button>
                </div>
                <p :class="['period-msg', { err: periodInvalid }]" role="status" aria-live="polite">{{ periodInvalid ? '시작일이 종료일보다 늦습니다' : `${listed.length}건` }}</p>
              </div>
            </form>
            <template v-for="d in listed" :key="d">
              <div class="date-label">{{ dateWithDay(d) }}</div>
              <a href="#" :class="{ on: d === date }" :aria-current="d === date ? 'page' : undefined" @click.prevent="date = d">
                <b>일일 생산 마감</b><time>18:00</time>
              </a>
            </template>
            <p v-if="!periodInvalid && !listed.length" class="period-empty">선택한 기간에 작성한 보고서가 없습니다.</p>
          </ReportFold>
        </div>
      </section>

      <section class="panel daily-doc">
        <div class="doc-head">
          <div>
            <h2>{{ doc ? `일일 생산 보고서 · ${date}` : '일일 생산 보고서' }}</h2>
          </div>
          <button v-if="can('reportWrite')" class="btn primary" type="button" :disabled="!isToday || loading || flowView.status === 'SENT'" @click="generate">{{ isToday && madeAt ? '다시 생성' : 'AI 일일 리포트 생성' }}</button>
          <button class="btn" type="button" :disabled="!doc || docBusy" @click="downloadDoc">Google Docs(.doc)</button>
          <button class="btn" type="button" :disabled="!doc" @click="printPdf">PDF 다운로드</button>
        </div>
        <ReportApproval
          class="no-print"
          :status="flowView.status"
          :written="flowView.written"
          :approved="flowView.approved"
          :sent="flowView.sent"
          :ready="!!docData"
          :can-write="can('reportWrite')"
          :can-approve="can('reportApprove')"
          @write="writeFlow"
          @recall="flow.recall(flowKey)"
          @approve="flow.approve(flowKey)"
          @send="flow.send(flowKey)"
        />

        <div v-if="error" class="daily-empty"><b>일일 리포트를 만들 수 없습니다</b><span>{{ error }}</span></div>
        <div v-else-if="loading && shown" class="daily-empty"><b>불러오는 중</b></div>
        <div v-else-if="!doc" class="daily-empty">
          <b>생성된 일일 보고서가 없습니다</b>
          <span>오늘 생산을 마감할 때 ‘AI 일일 리포트 생성’을 눌러주세요.</span>
        </div>

        <article v-else class="daily-paper">
          <header class="formal-title">
            <h1>일일 생산 마감 보고서</h1>
            <p>DAILY PRODUCTION CLOSING REPORT</p>
            <table class="doc-info">
              <tbody>
                <tr><th>문서번호</th><td>{{ doc.no }}</td><th>작성일시</th><td>{{ doc.at }}</td></tr>
                <tr><th>생산일자</th><td>{{ doc.date }}</td><th>근무조</th><td>{{ SHIFT }}</td></tr>
                <tr><th>작성자</th><td>{{ AUTHOR }}</td><th>문서 상태</th><td>{{ doc.status }}</td></tr>
              </tbody>
            </table>
            <div class="summary-cards">
              <div><span>생산계획</span><b>{{ formatNumber(doc.plan) }}개</b></div>
              <div><span>양품 실적</span><b>{{ formatNumber(report?.done) }}개</b></div>
              <div><span>달성률</span><b>{{ pct(doc.rate) }}</b></div>
              <div><span>불량 수량</span><b>{{ formatNumber(report?.ngTotal) }}개</b></div>
            </div>
          </header>

          <section><h3>1. 생산 종합 현황</h3><div class="review-box">{{ doc.summary }}</div></section>

          <section>
            <h3>2. 라인별 생산 실적</h3>
            <table class="report-table">
              <thead><tr><th>라인</th><th class="num">계획</th><th class="num">실적</th><th class="num">달성률</th><th class="num">OEE</th><th class="num">불량</th></tr></thead>
              <tbody>
                <tr v-for="l in doc.lines" :key="l.key">
                  <td>{{ l.name }}</td><td class="num">{{ formatNumber(l.plan) }}</td><td class="num">{{ formatNumber(l.done) }}</td>
                  <td class="num">{{ pct(l.rate) }}</td><td class="num">{{ pct(l.oee) }}</td><td class="num">{{ formatNumber(l.ng) }}</td>
                </tr>
              </tbody>
              <tfoot><tr><th>합계</th><th class="num">{{ formatNumber(doc.plan) }}</th><th class="num">{{ formatNumber(report?.done) }}</th><th class="num">{{ pct(doc.rate) }}</th><th /><th class="num">{{ formatNumber(doc.totalNg) }}</th></tr></tfoot>
            </table>
          </section>

          <section>
            <h3>3. 가동률 및 품질 현황</h3>
            <div class="detail-grid">
              <div>
                <b class="mini-title">설비 종합 지표</b>
                <div class="metric-grid">
                  <div><span>OEE</span><b>{{ pct(report?.oee.oee) }}</b></div>
                  <div><span>시간가동률</span><b>{{ pct(report?.oee.availability) }}</b></div>
                  <div><span>성능가동률</span><b>{{ pct(report?.oee.performance) }}</b></div>
                  <div><span>양품률</span><b>{{ pct(report?.oee.quality) }}</b></div>
                </div>
              </div>
              <div>
                <b class="mini-title">공정별 생산·불량</b>
                <table class="compact-table">
                  <thead><tr><th>공정</th><th>생산</th><th>NG</th><th>불량률</th></tr></thead>
                  <tbody><tr v-for="p in doc.processes" :key="p.name"><td>{{ p.name }}</td><td>{{ formatNumber(p.output) }}</td><td>{{ formatNumber(p.ng) }}</td><td>{{ pct(p.rate) }}</td></tr></tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h3>4. 설비 비가동 및 계획수정 내역</h3>
            <table class="report-table">
              <thead><tr><th>대상</th><th>원인</th><th>비가동</th><th>연결 보고서</th></tr></thead>
              <tbody>
                <tr v-for="x in doc.down" :key="x.key"><td>{{ x.target }}</td><td>{{ x.cause }}</td><td>{{ x.time }}</td><td>{{ x.report }}</td></tr>
                <tr v-if="!doc.down.length"><td>-</td><td>비가동 없음</td><td>-</td><td>-</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>5. 공정 재공품 및 AI 종합 분석</h3>
            <div class="wip-grid">
              <div>
                <b class="mini-title">마감 재공품(WIP)</b>
                <table class="compact-table">
                  <thead><tr><th>현재 공정</th><th>다음 공정</th><th>수량</th></tr></thead>
                  <tbody><tr v-for="w in doc.wip" :key="w.from + w.to"><td>{{ w.from }}</td><td>{{ w.to }}</td><td>{{ w.qty }}</td></tr></tbody>
                </table>
              </div>
              <div>
                <b class="mini-title">AI 마감 검토</b>
                <div>{{ doc.review }}</div>
                <b class="mini-title quality-title">품질 요약</b>
                <div>{{ doc.quality }}</div>
              </div>
            </div>
          </section>

          <section><h3>6. 다음 근무조 인계사항</h3><ol class="report-list"><li v-for="(h, i) in doc.handover" :key="i">{{ h }}</li></ol></section>

          <table class="approval">
            <thead><tr><th>작성 · 생산관리 팀장</th><th>결재 · 공장장</th></tr></thead>
            <tbody><tr><td>{{ flowView.writer ?? AUTHOR }}</td><td>{{ flowView.approver ?? '' }}</td></tr></tbody>
          </table>
          <p class="note2">※ 본 문서는 생산 마감 기록이며, 생성 이후 원천 데이터 변경과 관계없이 작성 이력으로 보존합니다. AI 검토 문장은 마감 숫자로 만든 초안입니다.</p>
        </article>
      </section>
    </div>
  </PageLayout>
</template>

<!-- 값·간격·색은 시안 B-daily.html / b.css 그대로 (시안 변수 → 앱 토큰). 보고서 종이는 인쇄용이라 검은 글씨·맑은 고딕 고정 -->
<style scoped>
.flow {
  margin-top: 12px;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  white-space: nowrap;
}

.body {
  display: grid;
  grid-template-columns: clamp(300px, 22vw, 380px) minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.body > * {
  min-width: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 20px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-surface);
}

.ph {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ph h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.ph .meta {
  color: var(--c-ink-3);
  font-size: 14px;
}

/* ── 목록 ── */
.list {
  overflow: auto;
  border-radius: inherit;
}

.side { padding: 0; }

.date-label {
  padding: 12px 20px 4px;
  border-top: 1px solid var(--c-line-strong);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.list a {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 12px;
  padding: 12px 20px;
  border-left: 2px solid transparent;
  color: var(--c-ink);
  text-decoration: none;
}

.list a:hover,
.list a.on {
  background: var(--c-surface-sunk);
}

.list a.on {
  border-left-color: var(--c-ink);
}

.list a b {
  font-size: var(--fs-row);
  font-weight: 600;
}

.list a span {
  grid-column: 1 / -1;
  color: var(--c-ink-2);
  font-size: 14px;
}

.list a time {
  color: var(--c-ink-2);
  font-size: 14px;
}

.today-card {
  margin: 0 16px 10px;
  padding: 14px 16px;
  border: 1px solid #b9c9df;
  border-radius: 7px;
  background: #f6f9fd;
  cursor: pointer;
}

.today-card:hover {
  border-color: #7f9fc6;
  background: #eef5fc;
}

.today-card.on {
  box-shadow: 0 0 0 2px var(--c-ink);
}

.today-card > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.today-card b {
  font-size: var(--fs-row);
}

.today-card time {
  margin-left: auto;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.draft-badge {
  display: inline-flex;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #374151;
  font-size: var(--fs-sm);
  font-weight: 700;
}

.draft-badge.created {
  background: #dcfce7;
  color: #166534;
}

.period-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 6px 8px;
  align-items: end;
  margin: 0 20px 8px;
}

.period-filter label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.period-filter label > span {
  color: var(--c-ink-3);
  font-size: 12px;
}

.period-filter input[type='date'] {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--c-line-strong);
  border-radius: 6px;
  background: var(--c-surface);
  font: inherit;
  font-size: 13px;
}

.period-filter input[aria-invalid='true'] {
  border-color: #b42318;
}

.period-filter .sep {
  display: flex;
  align-items: center;
  height: 32px;
  color: var(--c-ink-3);
}

.period-bar {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 8px;
}

.seg {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--c-line-strong);
  border-radius: 6px;
}

.seg button {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-left: 1px solid var(--c-line);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.seg button:first-child {
  border-left: 0;
}

.seg button.on {
  background: var(--c-ink);
  color: var(--c-surface);
}

.period-msg {
  margin: 0 0 0 auto;
  color: var(--c-ink-3);
  font-size: 12px;
  text-align: right;
}

.period-msg.err {
  color: #b42318;
}

.period-empty {
  margin: 8px 20px;
  padding: 12px;
  border: 1px dashed var(--c-line-strong);
  border-radius: 6px;
  color: var(--c-ink-3);
  font-size: 13px;
  text-align: center;
}

/* ── 보고서 ── */
.daily-doc {
  overflow: auto;
  padding: 16px;
  background: #e4e6e9;
}

.doc-head {
  display: flex;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 16px;
  min-height: 52px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--c-line-strong);
}

.doc-head > div {
  min-width: 0;
}

.doc-head h2 {
  margin: 0;
  font-size: 22px;
}

.doc-head p {
  margin: 0 0 5px;
  color: var(--c-ink-3);
  font-size: 12px;
  line-height: 1.35;
}

.btn {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--c-line-strong);
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.btn:hover {
  background: var(--c-surface-sunk);
}

.doc-head .primary {
  margin-left: auto;
}

.btn.primary {
  border-color: var(--c-ink);
  background: var(--c-ink);
  color: var(--c-surface);
}

.btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.daily-empty {
  display: flex;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 794px;
  height: 420px;
  margin: 16px auto 0;
  border: 1px dashed #b8bdc5;
  border-radius: 8px;
  background: rgb(255 255 255 / 55%);
  color: var(--c-ink-2);
  text-align: center;
}

.daily-empty b {
  color: var(--c-ink);
  font-size: 15px;
}

/* A4 한 장 (794 × 1123px). 내용이 길면 아래로 늘어남 */
.daily-paper {
  box-sizing: border-box;
  flex: none;
  width: 794px;
  min-height: 1123px;
  margin: 16px auto 0;
  padding: 16px 21px;
  border: 1px solid #cfd2d6;
  background: #fff;
  box-shadow: 0 3px 14px rgb(0 0 0 / 9%);
  color: #000;
  font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
  font-size: 12px;
  line-height: 1.35;
}

.daily-paper * {
  color: #000;
}

.formal-title {
  box-sizing: border-box;
  min-height: 165px;
  padding: 0;
  text-align: left;
}

.formal-title h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.45;
  text-align: center;
}

.formal-title p {
  margin: 0 0 5px;
  font-size: 12px;
  line-height: 1.25;
  text-align: center;
}

.doc-info,
.report-table,
.approval {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.doc-info th,
.doc-info td {
  box-sizing: border-box;
  height: 27px;
  padding: 2px 4px;
  border: 1px solid #000;
  line-height: 1.2;
  vertical-align: middle;
}

.doc-info th {
  width: 70px;
  background: #eee;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.daily-paper section {
  box-sizing: border-box;
  margin: 7px 0 0;
}

.daily-paper section h3 {
  display: block;
  margin: 0 0 6px;
  padding: 3px 4px;
  border-left: 3px solid #000;
  background: #eee;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.summary-cards {
  display: table;
  width: 100%;
  margin: 0;
  border: 1px solid #000;
  border-top: 0;
  table-layout: fixed;
}

.summary-cards div {
  display: table-cell;
  box-sizing: border-box;
  width: 25%;
  max-width: 0;
  height: 42px;
  padding: 3px 5px;
  border-left: 1px solid #000;
  overflow: hidden;
  text-align: center;
  vertical-align: middle;
}

.summary-cards div:first-child {
  border-left: 0;
}

.summary-cards span {
  display: block;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.summary-cards b {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.report-table {
  font-size: 12px;
}

.report-table .num {
  text-align: right;
}

.report-table th,
.report-table td {
  box-sizing: border-box;
  height: 24px;
  padding: 2px 4px;
  border: 1px solid #000;
  background: #fff;
  line-height: 1.2;
  overflow-wrap: break-word;
}

.report-table th {
  background: #eee;
  font-weight: 600;
}

.review-box {
  min-height: 38px;
  padding: 5px 7px;
  border: 1px solid #000;
  font-size: 12px;
  line-height: 1.35;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  border: 1px solid #000;
}

.detail-grid > div,
.wip-grid > div {
  min-width: 0;
  padding: 7px 8px;
}

.detail-grid > div + div,
.wip-grid > div + div {
  border-left: 1px solid #000;
}

.mini-title {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 700;
}

.quality-title {
  margin-top: 7px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.metric-grid div {
  padding: 5px 6px;
  border: 1px solid #999;
  text-align: center;
}

.metric-grid span {
  display: block;
  font-size: 10px;
}

.metric-grid b {
  display: block;
  margin-top: 2px;
  font-size: 15px;
}

.compact-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 11px;
}

.compact-table th,
.compact-table td {
  height: 20px;
  padding: 1px 3px;
  border: 1px solid #777;
  text-align: right;
}

.compact-table th:first-child,
.compact-table td:first-child {
  text-align: left;
}

.compact-table th {
  background: #eee;
}

.wip-grid {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  border: 1px solid #000;
}

.report-list {
  margin: 0;
  padding: 5px 6px 5px 24px;
  border: 1px solid #000;
  line-height: 1.5;
}

.approval {
  box-sizing: border-box;
  height: 63px;
  margin-top: 8px;
  text-align: center;
}

.approval th,
.approval td {
  height: 22px;
  padding: 2px 4px;
  border: 1px solid #000;
  font-size: 10px;
}

.approval th {
  background: #eee;
}

.approval td {
  height: 30px;
}

.note2 {
  margin: 5px 0 0;
  padding: 0;
  font-size: 10px;
}

/* 11/21 문서만 보기 (/doc/…, 임시 MES 틀 안): 목록·버튼·요청 칸·결재 단추를 빼고 A4 문서만. 인쇄 모양과 같음 */
.doc-only {
  display: block;
  height: auto;
  padding: var(--sp-4);
  background: var(--c-paper);
}

.doc-only :deep(.no-print),
.doc-only .side,
.doc-only .doc-head,
.doc-only .report-tools {
  display: none !important;
}

.doc-only .body,
.doc-only .doc,
.doc-only .daily-doc {
  display: block;
  padding: 0;
  overflow: visible;
  border: 0;
  background: var(--c-paper);
}

@media print {
  @page { size: A4; margin: 12mm; }

  .side,
  .doc-head {
    display: none !important;
  }

  .body,
  .daily-doc {
    display: block;
    padding: 0;
    overflow: visible;
    border: 0;
    background: #fff;
  }

  .daily-paper {
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    box-shadow: none;
  }
}
</style>
