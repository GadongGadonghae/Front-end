<!-- 임시 MES의 보고서 열람: 우리 시스템에서 작성 때 찍어 둔 문서 값(.doc 양식 값)을 그대로 읽기 전용으로 보인다 -->
<script setup lang="ts">
import type { DailyDocData } from '@/lib/dailyDoc'
import type { ReplanDocData } from '@/lib/replanDoc'

defineProps<{ daily?: DailyDocData; replan?: ReplanDocData }>()

const DAILY_TABLES: { key: string; title: string; head: string[] }[] = [
  { key: 'LINES', title: '라인별 실적', head: ['라인', '계획', '실적', '달성률', 'OEE', '불량'] },
  { key: 'PROC', title: '공정별 생산·불량', head: ['공정', '생산', '불량', '불량률'] },
  { key: 'DOWN', title: '비가동', head: ['대상', '원인', '시간', '보고서'] },
  { key: 'WIP', title: '공정 사이 재공', head: ['앞 공정', '뒤 공정', '수량'] },
]
</script>

<template>
  <article v-if="daily" class="rep">
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
