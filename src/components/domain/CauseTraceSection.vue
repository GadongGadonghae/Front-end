<!-- 계획수정 보고서 "원인 추적" (설명 가능한 AI 보고서). 보고서 종이(A4) 안에 들어간다
     ① 원인 후보와 근거 강도(규칙 점수, 확률 아님) ② 근거 번호를 단 분석 문장과 검증 결과 ③ 근거 목록(E1…)
     문장·후보의 [E2]를 누르면 근거 목록에서 그 줄을 짚는다. 검증 못 한 문장은 "근거 확인 안 됨"과 이유를 같이 쓴다 -->
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { CauseTrace } from '@/types/report'

const props = defineProps<{ trace: CauseTrace }>()

const GRADE = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' } as const
const KIND = { fact: '사실', inference: '추정', action: '점검' } as const
const TYPE = { FAULT: '고장', ALARM: '알람', TREND: '공정값', QUALITY: '불량', STATE: '상태', HISTORY: '과거 이력' } as const

const total = computed(() => props.trace.sentences.length)
const writer = computed(() => (props.trace.mock
  ? `템플릿 문장${props.trace.fallbackReason ? ` (AI 생성 실패: ${props.trace.fallbackReason})` : ''}`
  : `AI 작성 · ${props.trace.model}`))
const time = (iso: string) => new Date(iso).toTimeString().slice(0, 5)

const active = ref<string | null>(null)
const rows = ref<Record<string, HTMLElement | null>>({})
async function show(id: string) {
  if (!id.startsWith('E')) return
  active.value = active.value === id ? null : id
  await nextTick()
  rows.value[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
const isCause = (id: string) => id.startsWith('C')
</script>

<template>
  <div class="trace">
    <p class="meta">
      고장 전 1시간({{ time(trace.windowFrom) }}~{{ time(trace.windowTo) }}) 근거 {{ trace.evidence.length }}건 ·
      문장 검증 <b>{{ trace.verifiedCount }}/{{ total }}</b> 통과 · {{ writer }}
    </p>

    <h4>원인 후보와 근거 강도</h4>
    <table class="tbl causes">
      <thead><tr><th class="no">번호</th><th>원인 후보</th><th class="gr">근거 강도</th><th>점수 내역 (100점)</th><th class="ev">근거</th></tr></thead>
      <tbody>
        <tr v-for="c in trace.causes" :key="c.id">
          <td class="no">{{ c.id }}</td>
          <td class="lb">{{ c.label }}</td>
          <td class="gr">
            <b>{{ GRADE[c.grade] }}</b> {{ c.score }}점
            <span class="bar" aria-hidden="true"><i :style="{ width: `${Math.min(100, c.score)}%` }" /></span>
          </td>
          <td>
            <ul class="parts">
              <li v-for="p in c.parts" :key="p.label"><span>{{ p.label }} {{ p.points }}/{{ p.max }}</span> {{ p.note }}</li>
            </ul>
          </td>
          <td class="ev">
            <button v-for="id in c.evidence" :key="id" type="button" :class="['chip', { on: active === id }]" @click="show(id)">{{ id }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note">근거 강도는 직접 신호 40 · 시간 근접 20 · 과거 사례 30 · 데이터 완전성 10점을 더한 규칙 점수이며 확률이 아닙니다. 70점 이상 높음, 40점 이상 보통.</p>

    <h4>분석 문장</h4>
    <ol class="sents">
      <li v-for="(s, i) in trace.sentences" :key="i" :class="{ bad: !s.verified }">
        <span :class="['kind', s.kind]">{{ KIND[s.kind] }}</span>
        <span class="tx">{{ s.text }}</span>
        <span class="cites">
          <template v-for="id in s.evidence" :key="id">
            <span v-if="isCause(id)" class="chip cause">{{ id }}</span>
            <button v-else type="button" :class="['chip', { on: active === id }]" @click="show(id)">{{ id }}</button>
          </template>
        </span>
        <span v-if="!s.verified" class="issue">근거 확인 안 됨 · {{ s.issue }}</span>
      </li>
    </ol>

    <h4>근거 목록</h4>
    <table class="tbl evidence">
      <thead><tr><th class="no">번호</th><th class="ty">종류</th><th>내용</th><th class="src">출처</th></tr></thead>
      <tbody>
        <tr v-for="e in trace.evidence" :key="e.id" :ref="(el) => { rows[e.id] = el as HTMLElement | null }" :class="{ on: active === e.id }">
          <td class="no">{{ e.id }}</td>
          <td class="ty">{{ TYPE[e.type] }}</td>
          <td class="wrap"><b>{{ e.title }}</b> · {{ e.detail }}</td>
          <td class="src">{{ e.source }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* 보고서 종이 위: 흰 종이 · 검정 글·선 (종이 토큰). 글 크기는 종이를 따른다 */
.trace {
  color: var(--c-paper-ink);
  font-variant-numeric: tabular-nums;
}

.meta {
  margin: 0 0 6px;
}

h4 {
  margin: 8px 0 3px;
  font-size: inherit;
  font-weight: var(--fw-strong);
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl th,
.tbl td {
  padding: 2px 4px;
  border: 1px solid var(--c-paper-ink);
  background: var(--c-paper);
  line-height: 1.25;
  text-align: left;
  vertical-align: top;
}

.tbl th {
  background: var(--c-paper-head);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.tbl .no { width: 36px; text-align: center; }
.tbl .gr { width: 92px; white-space: nowrap; }
.tbl .ev { width: 92px; }
.tbl .ty { width: 56px; white-space: nowrap; }
.tbl .src { width: 150px; color: var(--c-paper-ink-2); word-break: break-all; }

.tbl .wrap,
.tbl .lb { white-space: normal; }
.tbl tr.on td { background: var(--c-paper-mark); }

.bar {
  display: block;
  height: 4px;
  margin-top: 3px;
  background: var(--c-paper-head);
}

.bar i {
  display: block;
  height: 100%;
  background: var(--c-paper-ink);
}

.parts {
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-paper-ink-2);
}

.parts span {
  color: var(--c-paper-ink);
  font-weight: var(--fw-strong);
}

.note {
  margin: 3px 0 0;
  color: var(--c-paper-ink-2);
}

.sents {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sents li {
  padding: 2px 4px;
  border: 1px solid transparent;
}

/* 검증 못 한 문장: 점선 테두리 + 이유 (글로도 표시) */
.sents li.bad {
  border: 1px dashed var(--c-paper-ink);
  background: var(--c-paper-mark);
}

.kind {
  display: inline-block;
  min-width: 30px;
  margin-right: 4px;
  padding: 0 3px;
  border: 1px solid var(--c-paper-ink);
  font-weight: var(--fw-strong);
  text-align: center;
}

/* 추정은 사실과 구분: 점선 칸 */
.kind.inference { border-style: dashed; }
.kind.action { background: var(--c-paper-head); }

.cites { margin-left: 4px; }

.chip {
  display: inline-block;
  margin: 0 2px 2px 0;
  padding: 0 3px;
  border: 1px solid var(--c-paper-ink);
  border-radius: var(--r-1);
  background: var(--c-paper);
  color: var(--c-paper-ink);
  font: inherit;
  line-height: 1.3;
  cursor: pointer;
}

.chip:hover,
.chip.on { background: var(--c-paper-mark); }

.chip.cause {
  border-style: dashed;
  cursor: default;
}

.issue {
  display: block;
  margin-top: 2px;
  font-weight: var(--fw-strong);
}

@media print {
  .chip { cursor: default; }
}
</style>
