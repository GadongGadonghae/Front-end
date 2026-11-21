<!-- 임시 MES의 보고서 열람: 우리 시스템에서 작성 때 찍어 둔 문서 값(.doc 양식 값)을 그대로 읽기 전용으로 보인다
     11/21: src가 있으면 우리 시스템 보고서 화면의 "문서만 보기"(/doc/…)를 그대로 띄운다 (같은 부품·같은 레이아웃).
     src가 없으면 [Google Docs(.doc)]와 같은 양식을 채워 보이고, 그것도 못 하면 아래 요약 화면 -->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { dailyDocHtml, type DailyDocData } from '@/lib/dailyDoc'
import { replanDocHtml, type ReplanDocData } from '@/lib/replanDoc'

const props = defineProps<{ daily?: DailyDocData; replan?: ReplanDocData; src?: string | null }>()

// ── 우리 화면 그대로 (/doc/…): 같은 주소라 로그인이 이어져요. 문서 길이가 바뀌면(불러오기 끝) 틀 높이도 따라가요 ──
const live = ref<HTMLIFrameElement | null>(null)
// 틀 안 화면은 불러온 뒤에 그려지고(보고서 값을 받아 옴) body 높이는 100%로 고정이라, 0.5초마다 문서 높이를 재서 맞춰요
let fitTimer: ReturnType<typeof setInterval> | null = null
function fitLive() {
  if (fitTimer) clearInterval(fitTimer)
  const set = () => {
    const d = live.value?.contentDocument
    if (!live.value || !d?.documentElement) return
    const h = `${d.documentElement.scrollHeight}px`
    if (live.value.style.height !== h) live.value.style.height = h
  }
  set()
  fitTimer = setInterval(set, 500)
}
onBeforeUnmount(() => { if (fitTimer) clearInterval(fitTimer) })

const html = ref<string | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
let seq = 0
watch(() => [props.daily, props.replan], async () => {
  const my = ++seq
  html.value = null
  try {
    const h = props.daily ? await dailyDocHtml(props.daily) : props.replan ? await replanDocHtml(props.replan) : null
    if (my === seq) html.value = h
  } catch {
    if (my === seq) html.value = null   // 요약 화면으로
  }
}, { immediate: true })

/** 문서 길이만큼 틀 높이를 맞춘다 (안쪽 스크롤 없이 바깥 목록에서 한 번에 내려 읽게) */
function fit() {
  const d = frame.value?.contentDocument
  if (!d) return
  void nextTick(() => {
    if (frame.value && d.documentElement) frame.value.style.height = `${d.documentElement.scrollHeight + 8}px`
  })
}

const DAILY_TABLES: { key: string; title: string; head: string[] }[] = [
  { key: 'LINES', title: '라인별 실적', head: ['라인', '계획', '실적', '달성률', 'OEE', '불량'] },
  { key: 'PROC', title: '공정별 생산·불량', head: ['공정', '생산', '불량', '불량률'] },
  { key: 'DOWN', title: '비가동', head: ['대상', '원인', '시간', '보고서'] },
  { key: 'WIP', title: '공정 사이 재공', head: ['앞 공정', '뒤 공정', '수량'] },
]
</script>

<template>
  <iframe
    v-if="src"
    :key="src"
    ref="live"
    class="doc live"
    :src="src"
    :title="daily ? '일일 생산 보고서' : '생산계획 수정 보고서'"
    @load="fitLive"
  />
  <!-- 스크립트는 막고(sandbox), 높이를 재려고 같은 출처만 허용. 내용은 우리 양식 + 글자 이스케이프한 값 -->
  <iframe
    v-else-if="html"
    ref="frame"
    class="doc"
    :srcdoc="html"
    sandbox="allow-same-origin"
    :title="daily ? '일일 생산 보고서' : '생산계획 수정 보고서'"
    @load="fit"
  />
  <article v-else-if="daily" class="rep">
    <dl class="meta">
      <dt>문서번호</dt><dd>{{ daily.values.DOC_NO }}</dd>
      <dt>생산일</dt><dd>{{ daily.values.PROD_DATE }}</dd>
      <dt>작성 시각</dt><dd>{{ daily.values.DOC_AT }}</dd>
      <dt>문서 상태</dt><dd>{{ daily.values.STATUS }}</dd>
    </dl>
    <dl class="sum">
      <div><dt>계획</dt><dd>{{ daily.values.SUM_PLAN }}</dd></div>
      <div><dt>실적</dt><dd>{{ daily.values.SUM_ACTUAL }}</dd></div>
      <div><dt>달성률</dt><dd>{{ daily.values.SUM_RATE }}</dd></div>
      <div><dt>불량</dt><dd>{{ daily.values.SUM_DEFECT }}</dd></div>
      <div><dt>OEE</dt><dd>{{ daily.values.M0 }}</dd></div>
    </dl>
    <section><h3>종합</h3><p>{{ daily.values.SUMMARY_TEXT }}</p></section>
    <section><h3>AI 마감 검토</h3><p>{{ daily.values.AI_REVIEW }}</p></section>
    <section><h3>품질 요약</h3><p>{{ daily.values.QUALITY }}</p></section>
    <section v-for="t in DAILY_TABLES" :key="t.key">
      <h3>{{ t.title }}</h3>
      <table>
        <thead><tr><th v-for="h in t.head" :key="h">{{ h }}</th></tr></thead>
        <tbody><tr v-for="(r, i) in daily.tables[t.key] ?? []" :key="i"><td v-for="(c, j) in r" :key="j">{{ c }}</td></tr></tbody>
      </table>
    </section>
    <section><h3>다음 근무조 인계사항</h3><ul><li v-for="(h, i) in daily.tables.HANDOVER ?? []" :key="i">{{ h[0] }}</li></ul></section>
  </article>

  <article v-else-if="replan" class="rep">
    <dl class="meta">
      <dt>문서번호</dt><dd>{{ replan.documentNo }}</dd>
      <dt>작성 시각</dt><dd>{{ replan.generatedAt }}</dd>
      <dt>대상</dt><dd>{{ replan.targetLine }} · {{ replan.factEquipment }}</dd>
      <dt>문서 상태</dt><dd>{{ replan.docStatus }}</dd>
    </dl>
    <dl class="sum">
      <div><dt>계획</dt><dd>{{ replan.plan }}개</dd></div>
      <div><dt>실적</dt><dd>{{ replan.actual }}개</dd></div>
      <div><dt>부족</dt><dd>{{ replan.shortage }}개</dd></div>
      <div><dt>판단</dt><dd>{{ replan.resultGrade }}</dd></div>
    </dl>
    <section><h3>고장 내용</h3><p>{{ replan.factStart }} · {{ replan.factCause }}</p></section>
    <section><h3>재배정 제안</h3><p>{{ replan.allocationText }}</p>
      <table>
        <thead><tr><th>라인(설비)</th><th>남은 계획</th><th>남은 능력</th><th>비율</th><th>추가 배정</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in replan.rows" :key="i"><td v-for="(c, j) in r" :key="j">{{ c }}</td></tr>
          <tr><td>합계</td><td>{{ replan.totalPlan }}</td><td>{{ replan.totalCapacity }}</td><td /><td>{{ replan.totalAllocation }}</td></tr>
        </tbody>
      </table>
    </section>
    <section><h3>결과</h3><p>{{ replan.resultText }}</p></section>
    <section v-if="replan.actions.length"><h3>권장 조치</h3><ul><li v-for="(a, i) in replan.actions" :key="i">{{ a }}</li></ul></section>
    <section><h3>위험 및 확인사항</h3><ul><li v-for="(r, i) in replan.risks" :key="i">{{ r }}</li></ul></section>
  </article>
</template>

<style scoped>
/* 양식 문서: 종이(A4)처럼 흰 바탕 */
.doc {
  display: block;
  width: 100%;
  min-height: 480px;
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  background: var(--c-paper);
}

.rep {
  display: grid;
  gap: var(--sp-4);
  font-size: var(--fs-md);
}

.meta {
  display: grid;
  grid-template-columns: max-content 1fr max-content 1fr;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
}

dt {
  color: var(--c-ink-3);
}

dd {
  margin: 0;
}

.sum {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin: 0;
}

.sum div {
  min-width: 110px;
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
}

.sum dd {
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
  font-weight: var(--fw-strong);
}

h3 {
  margin-bottom: var(--sp-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: var(--sp-1) var(--sp-2);
  border: var(--line-w) solid var(--c-line);
  text-align: left;
}

th {
  background: var(--c-surface-sunk);
  color: var(--c-ink-2);
}

ul {
  margin: 0;
  padding-left: var(--sp-5);
}
</style>
