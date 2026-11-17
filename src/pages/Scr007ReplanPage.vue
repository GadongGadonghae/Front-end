<!-- SCR-007 계획수정 보고서 (화면정의서 SCR-007 2~4번, 시안 B-report)
     왼쪽: 날짜별 보고서 목록 (D-69). 오른쪽: 보고서 문서 = 발생 → 부족 수량 → 다른 라인 추가 배정 → 결과, [PDF 다운로드]
     ?create=상태이력ID 로 들어오면 그 고장 건으로 보고서를 만들고 연다 (D-68). 제안만 하며 계획은 바꾸지 않는다 (D-70) -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import { useReplanReports } from '@/composables/useReports'
import { source } from '@/data'
import { formatNumber } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const selectedId = computed(() => (typeof route.params.id === 'string' && route.params.id ? route.params.id : null))
const rp = useReplanReports(selectedId)
const v = computed(() => rp.view.value)

const TABS = [
  { key: 'daily', label: '일일 생산 리포트', to: '/reports/daily' },
  { key: 'replan', label: '계획수정 보고서', to: '/reports/replan' },
]
const COLS = computed<TableColumn[]>(() => [
  { key: 'target', label: rp.report.value?.kind === 'paint' ? '설비' : '라인' },
  { key: 'remainingPlan', label: '남은 계획', align: 'right' },
  { key: 'capacity', label: '남은 능력', align: 'right' },
  { key: 'share', label: '비율', align: 'right' },
  { key: 'add', label: '추가 배정', align: 'right' },
])

const creating = ref(false)
const createError = ref('')
onMounted(async () => {
  const ev = route.query.create
  if (typeof ev === 'string' && ev) {
    creating.value = true
    try {
      const id = await rp.create(ev)
      router.replace(`/reports/replan/${id}`)
    } catch (e) {
      createError.value = e instanceof Error ? e.message : '보고서를 만들지 못했습니다'
    } finally {
      creating.value = false
    }
    return
  }
})
// 고른 보고서가 없으면 가장 최근 것을 연다
watch(rp.list, (l) => {
  if (!selectedId.value && !route.query.create && l?.[0]) router.replace(`/reports/replan/${l[0].id}`)
})

/** PDF: 서버가 주면 내려받고, 없으면(데모) 브라우저 인쇄로 PDF 저장 */
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
      <h1 class="title">리포트</h1>
      <BaseTabs :items="TABS" active="replan" label="리포트 종류" />
    </template>

    <div class="layout print-flow">
      <BasePanel class="no-print" title="보고서 목록" meta="최근 31일 · 날짜별">
        <div v-if="rp.groups.value.length" class="list">
          <template v-for="g in rp.groups.value" :key="g.date">
            <div class="day">{{ g.label }}</div>
            <RouterLink
              v-for="it in g.items"
              :key="it.id"
              :to="`/reports/replan/${it.id}`"
              :class="['item', { on: it.id === selectedId }]"
              :aria-current="it.id === selectedId ? 'page' : undefined"
            >
              <b>{{ it.name }}</b><time>{{ it.time }}</time>
              <span>{{ it.codeName }}</span>
            </RouterLink>
          </template>
        </div>
        <BaseEmpty v-else :text="rp.list.value ? '보고서 없음 · 고장 건의 [보고서 만들기]로 만듭니다' : '불러오는 중'" />
      </BasePanel>

      <BasePanel class="doc print-flow">
        <BaseEmpty v-if="creating" text="보고서를 만드는 중" />
        <BaseEmpty v-else-if="createError" :text="createError" />
        <BaseEmpty v-else-if="rp.missing.value" text="보고서를 찾을 수 없습니다" />
        <BaseEmpty v-else-if="!v" :text="selectedId ? '불러오는 중' : '왼쪽 목록에서 보고서를 고르세요'" />
        <article v-else class="paper">
          <header class="doc-head">
            <div>
              <h2>{{ v.title }}</h2>
              <p>{{ v.created }} · 제안만 하며 목표와 설비 계획은 바꾸지 않음</p>
            </div>
            <BaseButton class="no-print" @click="downloadPdf">PDF 다운로드</BaseButton>
          </header>

          <section>
            <h3>발생</h3>
            <div>
              <p class="text">{{ v.occurred }}</p>
              <dl class="facts">
                <div><dt>라인</dt><dd>{{ v.line ?? (rp.report.value?.kind === 'paint' ? '도장' : '출고') }}</dd></div>
                <div><dt>설비</dt><dd>{{ v.name }}</dd></div>
                <div><dt>발생</dt><dd class="n">{{ v.start }}</dd></div>
                <div><dt>원인</dt><dd>{{ v.code }} · {{ v.detail }}</dd></div>
              </dl>
            </div>
          </section>

          <section>
            <h3>부족 수량</h3>
            <div>
              <p class="text">{{ v.shortageText }}</p>
              <div class="calc">
                <BaseFigure label="남은 시간" :value="null" :text="v.remaining" :sub="v.remainingRange" />
                <BaseFigure :label="v.stoppedLabel" :value="rp.report.value?.shortage" unit="개" :sub="v.stoppedSub" />
              </div>
            </div>
          </section>

          <section>
            <h3>{{ rp.report.value?.kind === 'paint' ? '다른 설비 추가 배정' : '다른 라인 추가 배정' }}</h3>
            <div>
              <p class="text">{{ v.allocText }}</p>
              <template v-if="v.rows.length">
                <BaseTable class="alloc" label="추가 배정" :columns="COLS" :rows="v.rows" :row-key="(x) => x.key">
                  <template #cell-remainingPlan="{ row }"><span class="n">{{ formatNumber(row.remainingPlan) }}</span></template>
                  <template #cell-capacity="{ row }"><span class="n">{{ formatNumber(row.capacity) }}</span></template>
                  <template #cell-share="{ row }"><span class="n">{{ formatNumber(row.share, 1) }}%</span></template>
                  <template #cell-add="{ row }"><b class="n">+{{ formatNumber(row.add) }}</b></template>
                </BaseTable>
                <div class="sum">
                  <span>합계</span>
                  <span class="n">{{ formatNumber(v.sums.remainingPlan) }}</span>
                  <span class="n">{{ formatNumber(v.sums.capacity) }}</span>
                  <span class="n">100%</span>
                  <b class="n">+{{ formatNumber(v.sums.add) }}</b>
                </div>
              </template>
            </div>
          </section>

          <section>
            <h3>결과</h3>
            <div class="result">
              <span :class="['grade', v.ok ? 'ok' : 'ng']">{{ v.ok ? '목표 달성 가능' : `목표 미달 예상 ${formatNumber(v.unmet)}개` }}</span>
              <p class="text">{{ v.result }}</p>
            </div>
          </section>

          <p class="demo">값은 데모 데이터로 계산한 것</p>
        </article>
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.layout {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.day {
  padding: var(--sp-3) 0 var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.day:first-child {
  padding-top: 0;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-2);
  color: var(--c-ink);
  text-decoration: none;
}

.item:hover {
  background: var(--c-surface-sunk);
}

.item.on {
  background: var(--c-surface-sunk);
  box-shadow: inset var(--indicator-w) 0 0 var(--c-inverse);
}

.item b {
  font-weight: var(--fw-strong);
}

.item time {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  font-variant-numeric: tabular-nums;
}

.item span {
  grid-column: 1 / -1;
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.doc {
  overflow-y: auto;
}

.paper {
  max-width: 920px;
}

.doc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  padding-bottom: var(--sp-4);
  border-bottom: var(--line-w) solid var(--c-line-strong);
}

.doc-head h2 {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
}

.doc-head p {
  margin: var(--sp-1) 0 0;
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

section {
  display: grid;
  grid-template-columns: 9em minmax(0, 1fr);
  gap: var(--sp-4);
  padding: var(--sp-5) 0;
  border-bottom: var(--line-w) solid var(--c-line);
}

h3 {
  font-size: var(--fs-title);
  font-weight: var(--fw-strong);
}

section .text {
  margin: 0 0 var(--sp-3);
  line-height: 1.6;
}

.facts {
  display: grid;
  grid-template-columns: auto auto auto minmax(0, 1fr);
  gap: var(--sp-5);
  margin: 0;
}

.facts dt {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.facts dd {
  margin: 2px 0 0;
  font-weight: var(--fw-strong);
}

.calc {
  display: flex;
  gap: var(--sp-8);
}

.n {
  font-variant-numeric: tabular-nums;
}

b.n {
  font-weight: var(--fw-strong);
}

.alloc {
  flex: none;
}

/* 합계 줄: 표와 같은 다섯 칸 */
.sum {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: var(--sp-2) 0;
  border-top: var(--line-w) solid var(--c-line-strong);
  font-weight: var(--fw-strong);
}

.sum > :not(:first-child) {
  text-align: right;
}

.sum > :not(:first-child, :last-child) {
  padding-right: var(--sp-3);
}

.result {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}

.result .text {
  margin: 0;
}

.grade {
  flex: none;
  padding: 2px var(--sp-2);
  border: var(--line-w) solid;
  border-radius: var(--r-1);
  font-size: var(--fs-label);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.grade.ok {
  border-color: var(--c-line-strong);
  color: var(--c-ink);
}

.grade.ng {
  border-color: var(--c-down);
  color: var(--c-down);
}

.demo {
  margin: var(--sp-4) 0 0;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}
</style>
