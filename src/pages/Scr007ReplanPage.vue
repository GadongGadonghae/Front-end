<!-- SCR-007 AI 계획수정 보고서 — 생김새는 AI 리포트 담당 시안 docs/wireframes/후보/B-report.html 그대로 (11/19, 예전 틀 폐기)
     왼쪽: 현재 트러블 슈팅(오늘 고장 D 건, 깜빡이는 카드) + 이전에 작성한 보고서(기간 검색)
     오른쪽: [AI 보고서 생성] [.doc] [PDF] · AI 추가 요청 → A4 "생산계획 수정 검토 보고서"
     ?event=비가동ID 로 들어오면 그 고장 건을 고른 채로 연다 (예전 ?create= 도 같은 뜻). 제안만 하며 계획은 바꾸지 않는다 (D-70) -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import { useReplanReports } from '@/composables/useReports'
import { useMaster } from '@/composables/useMaster'
import { source } from '@/data'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDuration, formatNumber, formatTime, secondsBetween, toDateStr } from '@/lib/format'
import { downloadReplanDoc } from '@/lib/replanDoc'

const route = useRoute()
const router = useRouter()
const selectedId = computed(() => (typeof route.params.id === 'string' && route.params.id ? route.params.id : null))
const rp = useReplanReports(selectedId)
const { equipmentName } = useMaster()
const report = computed(() => rp.report.value)
const v = computed(() => rp.view.value)
const ai = computed(() => report.value?.ai ?? null)

const TABS = [
  { key: 'daily', label: '일일 생산 리포트', to: '/reports/daily' },
  { key: 'replan', label: '계획수정 보고서', to: '/reports/replan' },
]
const PRIORITY: Record<string, string> = { DUE_DATE: '납기 준수', SAFETY: '안전·품질', BALANCED: '잔여 생산능력' }

// ── 고장 건 고르기 ──
const queryEvent = computed(() => {
  const q = route.query.event ?? route.query.create
  return typeof q === 'string' && q ? q : null
})
/** 보고서를 만들 고장 건: 보고 있는 보고서의 고장 건, 아니면 고른 트러블 */
const eventId = computed(() => (selectedId.value ? report.value?.stateEventId ?? null : queryEvent.value))
const troubleRows = computed(() => (rp.troubles.value ?? []).map((e) => {
  const made = rp.reportsOf(e.id).length
  return {
    id: e.id,
    name: equipmentName(e.equipmentId),
    time: formatTime(e.start),
    text: [e.detail, e.code ? DOWNTIME_NAME[e.code] : '통신 끊김', e.end ? `${formatTime(e.end)} 복구` : '현재 조치 중'].filter(Boolean).join(' · '),
    ongoing: e.end === null,
    made,
  }
}))
const trouble = computed(() => rp.troubles.value?.find((e) => e.id === eventId.value) ?? null)

/** 트러블 카드: 만든 보고서가 있으면 가장 최근 것, 없으면 빈 보고서(생성 대기) */
function openTrouble(id: string, replace = false) {
  const latest = rp.reportsOf(id)[0]
  const to = latest ? `/reports/replan/${latest.id}` : { path: '/reports/replan', query: { event: id } }
  if (replace) router.replace(to)
  else router.push(to)
}

// 아무것도 고르지 않았으면: 진행 중 고장이 있으면 그 건, 없으면 가장 최근 보고서
watch([rp.list, rp.troubles], ([l, t]) => {
  if (selectedId.value || queryEvent.value || !l || !t) return
  const ongoing = t.find((e) => e.end === null)
  if (ongoing) openTrouble(ongoing.id, true)
  else if (l[0]) router.replace(`/reports/replan/${l[0].id}`)
})

// ── 이전 보고서 기간 검색 (시안 initPeriodFilter) ──
const from = ref('')
const to = ref('')
const preset = ref<number | null>(0)
const ymd = (d: Date) => toDateStr(d.getTime())
function pick(days: number) {
  preset.value = days
  if (days) {
    const today = new Date()
    const past = new Date(today)
    past.setDate(today.getDate() - (days - 1))
    from.value = ymd(past)
    to.value = ymd(today)
  } else {
    from.value = ''
    to.value = ''
  }
}
const periodInvalid = computed(() => !!from.value && !!to.value && from.value > to.value)
const groups = computed(() => (periodInvalid.value ? [] : rp.groups.value.filter((g) => (!from.value || g.date >= from.value) && (!to.value || g.date <= to.value))))
const shownCount = computed(() => groups.value.reduce((a, g) => a + g.items.length, 0))

// ── AI 보고서 생성 ──
const request = ref('')
watch(report, (r) => { if (r) request.value = r.ai?.additionalRequest ?? '' })
watch(queryEvent, () => { if (!selectedId.value) request.value = '' })
const generating = ref(false)
const genError = ref('')
async function generate() {
  const ev = eventId.value
  if (!ev || generating.value) return
  generating.value = true
  genError.value = ''
  try {
    const id = await rp.create(ev, request.value)
    router.replace(`/reports/replan/${id}`)
  } catch (e) {
    genError.value = e instanceof Error ? e.message : '보고서를 만들지 못했습니다'
  } finally {
    generating.value = false
  }
}

// ── 슬랙 전송 (N-01): 고장 장비 정보 + 보고서 + LLM 요약. 요약에 20초 안팎 걸려 그동안 버튼을 막는다 ──
const slackBusy = ref(false)
const slackMsg = ref<{ ok: boolean; text: string } | null>(null)
watch(selectedId, () => { slackMsg.value = null })
async function sendSlack() {
  const id = selectedId.value
  if (!id || slackBusy.value) return
  slackBusy.value = true
  slackMsg.value = null
  try {
    const r = await source.cmd.sendReplanToSlack(id)
    const how = r.mock ? '슬랙 시험 모드 · 실제로 보내지 않음' : '슬랙 전송 완료'
    slackMsg.value = { ok: true, text: `${how} (${formatTime(r.sentAt)})${r.summaryFallback ? ` · AI 요약 실패로 템플릿 문장 사용` : ''}` }
  } catch (e) {
    slackMsg.value = { ok: false, text: e instanceof Error ? e.message : '슬랙으로 보내지 못했습니다' }
  } finally {
    slackBusy.value = false
  }
}

// ── 보고서 문서 값 ──
const title = computed(() => {
  const name = report.value ? equipmentName(report.value.equipmentId) : trouble.value ? equipmentName(trouble.value.equipmentId) : null
  return name ? `계획수정 보고서 · ${name}` : '계획수정 보고서'
})
const doc = computed(() => {
  const r = report.value
  const vv = v.value
  if (!r || !vv) return null
  const created = `${toDateStr(Date.parse(r.createdAt))} ${formatTime(r.createdAt)}`
  const stopSec = Math.max(0, secondsBetween(r.start, r.baseAt))
  const it = r.ai?.interpretation
  const label = (key: string) => (key.length === 1 ? key : equipmentName(key))
  // 재배정 표: 시안처럼 멈춘 라인(설비)도 회색 줄로 넣고, 요청으로 뺀 라인은 노란 줄
  const rows = vv.rows.map((x) => {
    const stopped = it?.stoppedLines.includes(x.key) ?? false
    const excluded = !stopped && (it?.excludedLines.includes(x.key) ?? false)
    return { ...x, label: label(x.key) + (stopped ? ' (요청 정지)' : excluded ? ' (제외)' : ''), cls: stopped ? 'stopped' : excluded ? 'excluded' : '' }
  })
  const stoppedKey = r.kind === 'line' ? r.equipmentId.split('-')[0] : r.kind === 'paint' ? r.equipmentId : null
  if (stoppedKey) {
    rows.push({ key: stoppedKey, target: '', label: `${label(stoppedKey)} (고장)`, remainingPlan: Math.max(0, r.stoppedPlan - r.stoppedDone), capacity: 0, share: 0, add: 0, cls: 'stopped' })
    rows.sort((a, b) => a.key.localeCompare(b.key))
  }
  return {
    documentNo: r.documentNo ?? r.id,
    created,
    targetLine: vv.line ?? (r.kind === 'paint' ? '도장' : '출고'),
    model: r.ai ? (r.ai.mock ? '템플릿 초안' : 'AI 분석 보고서') : '데모 계산',
    author: r.createdBy,
    status: '검토 대기',
    stopSec,
    stop: formatDuration(stopSec),
    rows,
    totalPlan: rows.reduce((a, x) => a + x.remainingPlan, 0),
    grade: vv.ok ? '목표 달성 가능' : `목표 미달 예상 ${formatNumber(vv.unmet)}개`,
    resultText: ai.value?.summary ? `${vv.result} ${ai.value.summary}` : vv.result,
    actions: r.ai?.actions ?? [],
    risks: [...(r.ai?.risks ?? []), '본 보고서는 생산계획을 자동 변경하지 않습니다.'],
  }
})

const docBusy = ref(false)
async function downloadDoc() {
  const r = report.value
  const vv = v.value
  const d = doc.value
  if (!r || !vv || !d || docBusy.value) return
  docBusy.value = true
  try {
    await downloadReplanDoc({
      documentNo: d.documentNo, generatedAt: d.created, targetLine: d.targetLine,
      plan: r.stoppedPlan, actual: r.stoppedDone, shortage: r.shortage, stopSec: d.stopSec,
      factLine: d.targetLine, factEquipment: vv.name, factStart: vv.start, factCause: `${vv.code} · ${vv.detail}`,
      remainingSec: r.remainingSec, modelName: d.model, docStatus: d.status, author: d.author,
      allocationText: vv.allocText,
      rows: d.rows.map((x) => [x.label, formatNumber(x.remainingPlan), formatNumber(x.capacity), `${formatNumber(x.share, 1)}%`, formatNumber(x.add)]),
      totalPlan: formatNumber(d.totalPlan), totalCapacity: formatNumber(vv.sums.capacity), totalAllocation: formatNumber(vv.sums.add),
      resultGrade: d.grade, resultText: d.resultText, actions: d.actions, risks: d.risks,
    })
  } catch (e) {
    genError.value = e instanceof Error ? e.message : '.doc 파일을 만들지 못했습니다'
  } finally {
    docBusy.value = false
  }
}

/** PDF: 서버가 주면 내려받고, 없으면 브라우저 인쇄로 PDF 저장 */
async function downloadPdf() {
  const id = selectedId.value
  if (!id) return
  const blob = await source.q.getReplanPdf(id)
  if (!blob) { window.print(); return }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `계획수정보고서_${id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">AI 리포트</h1>
      <BaseTabs :items="TABS" active="replan" label="리포트 종류" />
    </template>

    <div class="body">
      <section class="panel side">
        <div class="ph"><h2>계획수정 보고서</h2><span class="meta">현재·이력</span></div>
        <div class="list">
          <h3 class="list-section">현재 트러블 슈팅</h3>
          <div
            v-for="t in troubleRows"
            :key="t.id"
            :class="['trouble-card', { alert: t.ongoing, on: t.id === eventId }]"
            role="button"
            tabindex="0"
            @click="openTrouble(t.id)"
            @keydown.enter.prevent="openTrouble(t.id)"
            @keydown.space.prevent="openTrouble(t.id)"
          >
            <div class="trouble-top"><b>{{ t.name }}</b><time>{{ t.time }} 발생</time></div>
            <p>{{ t.text }}</p>
            <span :class="['trouble-badge', { created: t.made }]">{{ t.made ? `보고서 작성 완료${t.made > 1 ? ` · ${t.made}건` : ''}` : '보고서 미작성' }}</span>
          </div>
          <p v-if="rp.troubles.value && !troubleRows.length" class="period-empty">오늘 고장 건이 없습니다.</p>

          <div class="previous-reports">
            <h3 class="list-section">이전에 작성한 보고서</h3>
            <form class="period-filter" role="search" aria-label="이전 보고서 기간 검색" @submit.prevent>
              <label><span>시작일</span><input v-model="from" type="date" @input="preset = null"></label>
              <span class="sep" aria-hidden="true">~</span>
              <label><span>종료일</span><input v-model="to" type="date" :aria-invalid="periodInvalid" @input="preset = null"></label>
              <div class="period-bar">
                <div class="seg" role="group" aria-label="기간 빠른 선택">
                  <button type="button" :class="{ on: preset === 7 }" :aria-pressed="preset === 7" @click="pick(7)">최근 7일</button>
                  <button type="button" :class="{ on: preset === 30 }" :aria-pressed="preset === 30" @click="pick(30)">최근 30일</button>
                  <button type="button" :class="{ on: preset === 0 }" :aria-pressed="preset === 0" @click="pick(0)">전체</button>
                </div>
                <p :class="['period-msg', { err: periodInvalid }]" role="status" aria-live="polite">{{ periodInvalid ? '시작일이 종료일보다 늦습니다' : `${shownCount}건` }}</p>
              </div>
            </form>
            <template v-for="g in groups" :key="g.date">
              <div class="d">{{ g.label }}</div>
              <RouterLink
                v-for="it in g.items"
                :key="it.id"
                :to="`/reports/replan/${it.id}`"
                :class="{ on: it.id === selectedId }"
                :aria-current="it.id === selectedId ? 'page' : undefined"
              >
                <b>{{ it.name }}</b><time>{{ it.time }}</time><span>AI 계획수정 보고서</span>
              </RouterLink>
            </template>
            <p v-if="rp.list.value && !periodInvalid && !shownCount" class="period-empty">선택한 기간에 작성한 보고서가 없습니다.</p>
          </div>
        </div>
      </section>

      <section class="panel doc">
        <div class="doc-head">
          <div><h2>{{ title }}</h2><p>현재 공정·설비 조건을 기준으로 작성된 의사결정 지원 보고서</p></div>
          <button class="btn primary" type="button" :disabled="!eventId || generating" @click="generate">{{ generating ? 'AI 보고서 작성 중…' : 'AI 보고서 생성' }}</button>
          <button class="btn" type="button" :disabled="!doc || docBusy" @click="downloadDoc">Google Docs(.doc)</button>
          <button class="btn" type="button" :disabled="!doc" @click="downloadPdf">PDF 다운로드</button>
          <button class="btn" type="button" :disabled="!doc || !selectedId || slackBusy || generating" @click="sendSlack">{{ slackBusy ? '슬랙 전송 중…' : '슬랙 전송' }}</button>
        </div>

        <div class="report-tools">
          <div class="request-box">
            <label for="additionalRequest">AI 추가 요청</label>
            <textarea
              id="additionalRequest"
              v-model="request"
              maxlength="500"
              :disabled="!eventId || generating"
              placeholder="예: A라인은 긴급 주문 생산 중이므로 재배정 대상에서 제외하고 납기 준수를 우선해줘."
            />
          </div>
          <div class="tool-actions">
            <span v-if="ai" :class="['ai-state', { warn: ai.mock }]">{{ ai.mock ? `AI 생성 실패 · 템플릿 문장${ai.fallbackReason ? ` (${ai.fallbackReason})` : ''}` : `AI 생성 · ${ai.model}` }}</span>
          </div>
          <p v-if="genError" class="gen-error">{{ genError }}</p>
          <p v-if="slackMsg" :class="slackMsg.ok ? 'slack-msg' : 'gen-error'" role="status" aria-live="polite">{{ slackMsg.text }}</p>
          <div v-if="ai?.additionalRequest && ai.interpretation" class="info-panel">
            <h4>AI 추가 요청 반영 결과</h4>
            <div class="info-grid">
              <div><b>정지·제외 라인</b>{{ ai.interpretation.excludedLines.length ? ai.interpretation.excludedLines.join(', ') : '없음' }}</div>
              <div><b>우선 기준</b>{{ PRIORITY[ai.interpretation.priority] ?? ai.interpretation.priority }}</div>
              <div><b>적용 규칙</b>{{ ai.interpretation.appliedRules.join(' · ') }}</div>
            </div>
          </div>
        </div>

        <div v-if="generating" class="report-empty"><b>AI가 보고서를 작성하고 있습니다</b><span>최대 30초 정도 걸려요.</span></div>
        <div v-else-if="rp.missing.value" class="report-empty"><b>보고서를 찾을 수 없습니다</b></div>
        <div v-else-if="selectedId && !doc" class="report-empty"><b>불러오는 중</b></div>
        <div v-else-if="!doc" class="report-empty">
          <b>생성된 AI 보고서가 없습니다</b>
          <span>{{ eventId ? '추가 요청을 입력한 뒤 ‘AI 보고서 생성’을 눌러주세요.' : '왼쪽에서 고장 건이나 이전 보고서를 고르세요.' }}</span>
        </div>

        <article v-else-if="v" class="report-paper">
          <header class="formal-head">
            <h1>생산계획 수정 검토 보고서</h1>
            <p class="document-class">PRODUCTION PLAN REVISION REPORT</p>
            <table class="doc-info">
              <tbody>
                <tr><th>문서번호</th><td>{{ doc.documentNo }}</td><th>작성일시</th><td>{{ doc.created }}</td></tr>
                <tr><th>대상 라인</th><td>{{ doc.targetLine }}</td><th>작성 구분</th><td>{{ doc.model }}</td></tr>
                <tr><th>작성자</th><td>{{ doc.author }}</td><th>문서 상태</th><td>{{ doc.status }}</td></tr>
              </tbody>
            </table>
            <div class="summary-grid">
              <div class="summary-item"><span>생산 계획</span><b>{{ formatNumber(report?.stoppedPlan) }}</b><small>개</small></div>
              <div class="summary-item"><span>현재 실적</span><b>{{ formatNumber(report?.stoppedDone) }}</b><small>개</small></div>
              <div class="summary-item"><span>예상 부족</span><b>{{ formatNumber(report?.shortage) }}<small>개</small></b></div>
              <div class="summary-item"><span>정지 지속</span><b>{{ doc.stop }}</b></div>
            </div>
          </header>

          <section>
            <h3>1. 발생 현황</h3>
            <div>
              <p>{{ v.occurred }}</p>
              <dl class="facts"><dt>라인</dt><dd>{{ doc.targetLine }}</dd><dt>설비</dt><dd>{{ v.name }}</dd><dt>발생</dt><dd>{{ v.start }}</dd><dt>원인</dt><dd>{{ v.code }} · {{ v.detail }}</dd></dl>
            </div>
          </section>

          <section>
            <h3>2. 생산 영향</h3>
            <div>
              <p>{{ v.shortageText }}</p>
              <div class="calc">
                <div><div class="st-l">남은 시간</div><div class="st-v">{{ v.remaining }}</div><div class="st-sub">{{ v.remainingRange }}</div></div>
                <div><div class="st-l">{{ v.stoppedLabel }}</div><div class="st-v">{{ formatNumber(report?.shortage) }}<small>개</small></div><div class="st-sub">{{ v.stoppedSub }}</div></div>
              </div>
            </div>
          </section>

          <section>
            <h3>3. 생산 재배정안</h3>
            <div>
              <p>{{ v.allocText }}</p>
              <table v-if="doc.rows.length" class="tbl">
                <thead><tr><th>{{ report?.kind === 'paint' ? '설비' : '라인' }}</th><th class="num">남은 라인 계획</th><th class="num">남은 능력</th><th class="num">비율</th><th class="num">추가 배정</th></tr></thead>
                <tbody>
                  <tr v-for="x in doc.rows" :key="x.key" :class="x.cls">
                    <td>{{ x.label }}</td>
                    <td class="num">{{ formatNumber(x.remainingPlan) }}</td>
                    <td class="num">{{ formatNumber(x.capacity) }}</td>
                    <td class="num">{{ formatNumber(x.share, 1) }}%</td>
                    <td class="num add">{{ formatNumber(x.add) }}</td>
                  </tr>
                </tbody>
                <tfoot><tr><td>합계</td><td class="num">{{ formatNumber(doc.totalPlan) }}</td><td class="num">{{ formatNumber(v.sums.capacity) }}</td><td class="num">100%</td><td class="num">{{ formatNumber(v.sums.add) }}</td></tr></tfoot>
              </table>
            </div>
          </section>

          <section>
            <h3>4. 종합 검토</h3>
            <div class="result"><span :class="['grade', v.ok ? 'ok' : 'ng']">{{ doc.grade }}</span><p>{{ doc.resultText }}</p></div>
          </section>

          <section>
            <h3>5. 권장 조치</h3>
            <ol v-if="doc.actions.length" class="report-list"><li v-for="(a, i) in doc.actions" :key="i">{{ a }}</li></ol>
            <p v-else>AI 보고서 생성 시 작성됩니다.</p>
          </section>

          <section>
            <h3>6. 위험 및 확인사항</h3>
            <ul class="report-list"><li v-for="(r, i) in doc.risks" :key="i">{{ r }}</li></ul>
          </section>

          <div class="approval">
            <table><thead><tr><th>작성</th><th>생산관리 팀장</th></tr></thead><tbody><tr><td>{{ doc.author }}</td><td /></tr></tbody></table>
          </div>
          <p class="note2">※ 본 문서는 AI 기반 의사결정 지원 초안이며, 담당자 검토 및 승인 후 생산계획에 반영합니다.</p>
        </article>
      </section>
    </div>
  </PageLayout>
</template>

<!-- 값·간격·색은 시안 B-report.html / b.css 그대로 (시안 변수 → 앱 토큰). 보고서 종이는 인쇄용이라 검은 글씨·맑은 고딕 고정 -->
<style scoped>
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
  margin: 0 -20px;
  padding: 0;
  overflow: auto;
}

.list .d {
  padding: 12px 20px 4px;
  border-top: 1px solid var(--c-line-strong);
  color: var(--c-ink-3);
  font-size: 13px;
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

.list a:hover {
  background: var(--c-surface-sunk);
}

.list a.on {
  border-left-color: var(--c-ink);
  background: var(--c-surface-sunk);
}

.list a b {
  font-weight: 600;
}

.list a span {
  grid-column: 1 / -1;
  color: var(--c-ink-2);
  font-size: 14px;
}

.list a time {
  color: var(--c-ink-3);
  font-size: 14px;
}

.list-section {
  margin: 0;
  padding: 10px 20px 7px;
  border-top: 1px solid var(--c-line-strong);
  color: var(--c-ink-2);
  font-size: 12px;
  font-weight: 700;
}

.list > .list-section:first-child {
  border-top: 0;
}

.trouble-card {
  margin: 0 12px 10px;
  padding: 11px 12px;
  border: 1px solid #d6d9de;
  border-radius: 7px;
  background: var(--c-surface);
  cursor: pointer;
}

/* 진행 중 고장: 시안처럼 빨갛게 깜빡임 */
.trouble-card.alert {
  border-color: #e5b8b8;
  background: #fff8f8;
  animation: trouble-alert 1.25s ease-in-out infinite;
}

.trouble-card.on {
  box-shadow: 0 0 0 2px var(--c-ink);
}

@keyframes trouble-alert {
  0%, 100% { border-color: #e5b8b8; background: #fff8f8; box-shadow: 0 0 0 0 rgb(220 38 38 / 0%); }
  50% { border-color: #dc2626; background: #fee2e2; box-shadow: 0 0 0 3px rgb(220 38 38 / 12%); }
}

@media (prefers-reduced-motion: reduce) {
  .trouble-card.alert { animation: none; }
}

.trouble-card:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}

.trouble-top {
  display: flex;
  align-items: center;
  gap: 7px;
}

.trouble-card b {
  font-size: 13px;
}

.trouble-card time {
  margin-left: auto;
  color: var(--c-ink-3);
  font-size: 11px;
}

.trouble-card p {
  margin: 5px 0 7px;
  color: var(--c-ink-2);
  font-size: 11px;
  line-height: 1.35;
}

.trouble-badge {
  display: inline-flex;
  padding: 3px 7px;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 10px;
  font-weight: 700;
}

.trouble-badge.created {
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
.doc {
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

.doc-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.doc-head p {
  margin: 4px 0 0;
  color: var(--c-ink-3);
  font-size: 14px;
}

.btn {
  display: inline-flex;
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

.doc-head .btn {
  margin-left: auto;
}

.doc-head .btn + .btn {
  margin-left: 0;
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

.report-tools {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 10px;
  align-items: end;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--c-line-strong);
  border-radius: 8px;
  background: var(--c-surface);
}

.request-box label {
  display: block;
  margin-bottom: 4px;
  color: var(--c-ink-2);
  font-size: 13px;
  font-weight: 600;
}

.request-box textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--c-line-strong);
  border-radius: 6px;
  background: #fff;
  color: var(--c-ink);
  font: inherit;
  resize: vertical;
}

.tool-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: flex-end;
  gap: 6px;
}

.ai-state {
  color: var(--c-ink-3);
  font-size: 13px;
}

.ai-state.warn,
.gen-error {
  color: #b42318;
}

.gen-error,
.slack-msg {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
}

.slack-msg {
  color: var(--c-ink-3);
}

.info-panel {
  grid-column: 1 / -1;
  padding: 10px 12px;
  border-top: 1px solid var(--c-line-strong);
  background: #fff;
  font-size: 12px;
}

.info-panel h4 {
  margin: 0 0 7px;
  font-size: 13px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.info-grid div {
  padding: 7px 9px;
  border: 1px solid var(--c-line-strong);
  border-radius: 5px;
}

.info-grid b {
  display: block;
  margin-bottom: 2px;
}

.report-empty {
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

.report-empty b {
  color: var(--c-ink);
  font-size: 15px;
}

/* A4 한 장 (794 × 1123px). 내용이 길면 아래로 늘어남 */
.report-paper {
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

.report-paper * {
  color: #000;
}

.formal-head {
  box-sizing: border-box;
  min-height: 165px;
  padding: 0;
  text-align: left;
}

.formal-head h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.45;
  text-align: center;
}

.formal-head .document-class {
  margin: 0 0 5px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.25;
  text-align: center;
}

.doc-info {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}

.doc-info th,
.doc-info td {
  box-sizing: border-box;
  height: 27px;
  padding: 2px 4px;
  border: 1px solid #000;
  line-height: 1.2;
  text-align: left;
  vertical-align: middle;
}

.doc-info th {
  width: 70px;
  background: #eee;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.summary-grid {
  display: table;
  width: 100%;
  margin: 0;
  border: 1px solid #000;
  border-top: 0;
  table-layout: fixed;
}

.summary-item {
  display: table-cell;
  box-sizing: border-box;
  width: 25%;
  height: 42px;
  padding: 4px;
  border-left: 1px solid #000;
  vertical-align: middle;
}

.summary-item:first-child {
  border-left: 0;
}

.summary-item span {
  display: block;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
}

.summary-item b {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
}

.summary-item small {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
}

.report-paper section {
  display: block;
  box-sizing: border-box;
  margin: 7px 0 0;
  padding: 0 0 8px;
  break-inside: avoid;
}

.report-paper section:nth-of-type(1) { min-height: 110px; }
.report-paper section:nth-of-type(2) { min-height: 100px; }
.report-paper section:nth-of-type(3) { min-height: 244px; }
.report-paper section:nth-of-type(4) { min-height: 92px; }
.report-paper section:nth-of-type(5) { min-height: 116px; }
.report-paper section:nth-of-type(6) { min-height: 116px; }

.report-paper h3 {
  display: block;
  margin: 0 0 6px;
  padding: 3px 4px;
  border-left: 3px solid #000;
  background: #eee;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.report-paper p {
  margin: 0 0 5px;
  font-size: 12px;
  line-height: 1.35;
}

.report-paper p,
.report-paper li,
.report-paper td,
.report-paper th {
  word-break: keep-all;
  overflow-wrap: break-word;
}

.facts {
  display: block;
  margin: 2px 0 0;
}

.facts dt,
.facts dd {
  display: inline-block;
  margin: 0 6px 0 0;
  font-size: 12px;
}

.facts dt {
  font-weight: 700;
}

.facts dd {
  font-weight: 400;
}

.calc {
  display: block;
  margin: 0;
  white-space: nowrap;
}

.calc > div {
  display: inline-block;
  width: 46%;
  vertical-align: top;
}

.st-l,
.st-sub,
.st-v {
  font-size: 12px;
}

.st-v {
  line-height: 1.35;
}

.tbl {
  width: 100%;
  margin-top: 2px;
  border-collapse: collapse;
}

.tbl th,
.tbl td {
  height: 24px;
  padding: 2px 4px;
  border: 1px solid #000;
  background: #fff;
  font-size: 12px;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}

.tbl th {
  background: #eee;
  font-weight: 600;
}

.tbl .num {
  text-align: right;
}

.tbl tr.stopped td {
  background: #f3f3f3;
  color: #777;
}

.tbl tr.excluded td {
  background: #fff6e5;
}

.tbl tfoot td,
.tbl td.add {
  font-weight: 600;
}

.result {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.result p {
  margin: 0;
}

/* 판정 표시등: 작은 사각 + 글자 (시안 b.css .grade) */
.grade {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 28px;
  font-weight: 600;
  white-space: nowrap;
}

.grade::before {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 2px #000;
  content: '';
}

.grade.ng::before {
  background: #000;
}

.report-list {
  margin: 0;
  padding-left: 16px;
}

.report-list li {
  margin: 0 0 3px;
  font-size: 11px;
  line-height: 1.3;
}

.approval {
  box-sizing: border-box;
  height: 63px;
  margin-top: 8px;
}

.approval table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.approval th,
.approval td {
  height: 22px;
  padding: 2px 4px;
  border: 1px solid #000;
  font-size: 10px;
  text-align: center;
}

.approval th {
  background: #eee;
}

.approval td {
  height: 30px;
}

.note2 {
  margin: 5px 0 0;
  font-size: 10px;
}

@media print {
  @page { size: A4; margin: 12mm; }

  .side,
  .doc-head,
  .report-tools {
    display: none !important;
  }

  .body,
  .doc {
    display: block;
    padding: 0;
    overflow: visible;
    border: 0;
    background: #fff;
  }

  .report-paper {
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    box-shadow: none;
  }
}
</style>
