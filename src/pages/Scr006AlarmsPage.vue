<!-- SCR-006 알람 이력 (화면정의서 SCR-006, D-109 시안 D4, D-117 고장·통신 끊김만)
     제목 줄: 제목. 위쪽 종류 버튼 [전체 · 고장 · 통신 끊김] 중 하나 (D-117)
     왼쪽 좁은 요약 열 (고장·통신 끊김 건수 → 아직 손볼 건 → 알람 코드, 누르면 표를 거름)
             + 오른쪽 패널 = 필터 줄 → 표 → 페이지 (50건씩, D-66). 표는 설비+라인, 상태·코드+상세를 합쳐 조치 메모 열을 넓게
     조치 메모 [쓰기]/[고치기] → 그 행 아래로 3줄 입력칸이 펼쳐짐. 지속 시간은 보통 글자 (D-109)
     조치 담당자는 메모 칸 둘째 줄 (1280 폭에서도 메모 열이 남게). 진행 중 고장 → 진행 중 통신 끊김 → 나머지 최근순 (D-111)
     진행 중 고장 행은 고장 바탕, 통신 끊김 행은 통신 끊김 바탕 (DESIGN.md). 메일은 고장(D)만 보내므로 (슬랙 없음, D-110) 다른 건은 "-" -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseCheck from '@/components/base/BaseCheck.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BasePager from '@/components/base/BasePager.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import SummaryColumn from '@/components/domain/SummaryColumn.vue'
import AlarmSummary from '@/components/domain/AlarmSummary.vue'
import NotifySent from '@/components/domain/NotifySent.vue'
import ActionMemoEditor from '@/components/domain/ActionMemoEditor.vue'
import { useInlineEdit } from '@/components/base/inlineEdit'
import { useAlarmHistory, MAX_DAYS, type AlarmRow } from '@/composables/useAlarmHistory'
import type { HistoryTodo } from '@/types/events'
import { isCommsEvent } from '@/data/historyTodo'
import type { DowntimeCode } from '@/types/state'

const route = useRoute()
const router = useRouter()
const h = useAlarmHistory()
const { tab, from, to, lineId, process, kind, code, ongoing, todo, page } = h

// 예지보전 위험 탭은 뺌 (11/20). 알람·비가동만 (예전 주소 ?tab=risk로 와도 알람·비가동)
tab.value = 'alarm'
// 대시보드 팝업 "조치 가기" (?eq=설비ID): 기준정보가 오면 그 설비 건으로 필터를 맞춘다
watch([() => route.query.eq, () => h.equipmentById.value.size], ([eq]) => { if (typeof eq === 'string') h.focusEquipment(eq) }, { immediate: true })

const multi = computed(() => from.value !== to.value)
const timeW = computed(() => (multi.value ? '9.5em' : '6.5em'))
const ALARM_COLS = computed<TableColumn[]>(() => [
  { key: 'start', label: '발생', width: timeW.value },
  { key: 'end', label: '해제', width: timeW.value },
  { key: 'equipment', label: '설비', width: '8em' },
  { key: 'code', label: '상태 · 코드 · 상세', width: '17em' },
  { key: 'duration', label: '지속', align: 'right', width: '5em' },
  { key: 'notify', label: '메일', width: '7.5em' },
  { key: 'memo', label: '조치 메모 · 담당자' },
  { key: 'report', label: '보고서', width: '6.5em' },
])

const tone = (r: AlarmRow) => (r.ongoing && r.state === 'D' ? 'down' : r.ongoing && r.state === 'DC' ? 'dc' : null)

// 조치 메모: 한 번에 한 건만, 그 행 아래로 펼친다. 열면 입력에 초점, 닫으면 연 버튼으로. 저장하면 그 행에 "저장됨"
const memo = useInlineEdit('alarm-memo')
const { draft } = memo
const savedId = ref<string | null>(null)
function openMemo(r: AlarmRow) {
  savedId.value = null
  if (memo.editing.value === r.id) memo.close()
  else memo.open(r.id, r.memo ?? '')
}
/** 저장: 끝나면 닫고 "저장됨", 실패하면 열어 둔 채 문구 (useInlineEdit.submit) */
const save = (id: string) => memo.submit(async () => {
  await h.saveMemo(id, draft.value)
  savedId.value = id
})
const subjectOf = (r: AlarmRow) => `${r.line === r.equipment ? r.equipment : `${r.line} ${r.equipment}`} · ${r.start} · ${r.code}`

// 왼쪽 요약 열: 기간 이름 (오늘이면 "오늘")
const periodLabel = computed(() => (from.value === to.value ? (from.value === h.today ? '오늘' : from.value) : `${from.value.slice(5)} ~ ${to.value.slice(5)}`))
const pickAlarm = (c: string) => h.pickAlarm(c as DowntimeCode)
const pickTodo = (k: string) => h.pickTodo(k as HistoryTodo)
/** 표 위 "거름" 표시: 왼쪽 열에서 고른 코드 · 거르기 */
const picked = computed(() => [
  ...(code.value ? [{ key: 'code', label: h.codeLabel(code.value), clear: () => { code.value = '' } }] : []),
  ...(todo.value ? [{ key: 'todo', label: h.todoLabel(todo.value), clear: () => { todo.value = '' } }] : []),
])

const openReport = (r: AlarmRow) => router.push(r.reportId ? `/reports/replan/${r.reportId}` : `/reports/replan?event=${r.id}`)
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">알람 이력</h1>
    </template>

    <div class="body" :class="{ split: tab === 'alarm' }">
      <SummaryColumn v-if="tab === 'alarm'" title="요약" :meta="periodLabel">
        <AlarmSummary
          v-if="h.summaryView.value"
          v-bind="h.summaryView.value"
          :active-code="code"
          :active-todo="todo"
          @pick-alarm="pickAlarm"
          @pick-todo="pickTodo"
          @show-state="h.showState"
        />
      </SummaryColumn>

      <BasePanel class="list">
        <template #head>
          <h2 class="sr-only">알람 이력 표</h2>
          <div class="filters">
            <span class="field range">
              <BaseDateField v-model="from" label="기간" :max="h.today" />
              <span class="tilde" aria-hidden="true">~</span>
              <BaseDateField v-model="to" label="기간 끝" hide-label :max="h.today" />
              <span class="hint">최대 {{ MAX_DAYS }}일</span>
            </span>
            <BaseSelect v-model="lineId" label="라인" :options="h.lineOptions" />
            <template v-if="tab === 'alarm'">
              <BaseSelect v-model="process" label="공정" :options="h.processOptions.value" />
              <span class="field">
                <span class="lab">종류</span>
                <BaseSegmented v-model="kind" label="종류" :options="h.kindOptions.value" />
              </span>
              <BaseSelect v-if="kind !== 'DC'" v-model="code" label="고장 코드" :options="h.codeOptions.value" />
              <BaseCheck v-model="ongoing" label="진행 중만" />
            </template>
          </div>
        </template>

        <template v-if="tab === 'alarm'">
          <p v-if="picked.length" class="picked">
            거름
            <span v-for="p in picked" :key="p.key" class="chip">
              <b>{{ p.label }}</b>
              <button class="link inline" type="button" :aria-label="`${p.label} 거름 풀기`" @click="p.clear()">풀기</button>
            </span>
          </p>
          <BaseTable
            label="알람·비가동 이력"
            :columns="ALARM_COLS"
            :rows="h.alarmRows.value"
            :row-key="(r) => r.id"
            :row-tone="tone"
            :expanded-key="memo.editing.value"
            empty="데이터 없음"
          >
            <template #cell-start="{ row }"><span class="t">{{ row.start }}</span></template>
            <template #cell-end="{ row }">
              <span v-if="row.ongoing" class="live">진행 중</span>
              <span v-else class="t">{{ row.end }}</span>
            </template>
            <template #cell-equipment="{ row }">
              <b class="eq">{{ row.equipment }}</b>
              <small v-if="row.line !== row.equipment" class="sub">{{ row.line }}</small>
            </template>
            <template #cell-code="{ row }">
              <StatusKey :state="row.state" size="sm" :label="row.code" />
              <span v-if="row.level" :class="['level', { critical: row.critical }]">{{ row.level }}</span>
              <small class="sub detail">{{ row.detail }}</small>
            </template>
            <template #cell-duration="{ row }"><span class="dur">{{ row.duration }}</span></template>
            <template #cell-notify="{ row }"><NotifySent :notify="row.notify" /></template>
            <template #cell-memo="{ row }">
              <span class="memo">
                <span class="memo-text" :class="{ none: !row.memo }">{{ row.memo ?? '-' }}</span>
                <button
                  v-if="!isCommsEvent(row.id)"
                  class="link inline"
                  type="button"
                  :data-edit="memo.attr(row.id, 'open')"
                  :aria-expanded="memo.editing.value === row.id"
                  @click="openMemo(row)"
                >{{ row.memo ? '고치기' : '쓰기' }}</button>
                <span v-if="savedId === row.id" class="saved" role="status">저장됨</span>
              </span>
              <small v-if="row.memoBy" class="sub">{{ row.memoBy }} · {{ row.memoAt }} 저장</small>
            </template>
            <template #cell-report="{ row }">
              <BaseButton v-if="row.report" size="sm" @click="openReport(row)">{{ row.report === 'view' ? '보기' : '만들기' }}</BaseButton>
              <span v-else class="none">-</span>
            </template>
            <template #expand="{ row }">
              <ActionMemoEditor
                v-model="draft"
                :data-edit="memo.attr(row.id, 'form')"
                :subject="subjectOf(row)"
                :detail="row.detail"
                :duration="row.duration"
                :ongoing="row.ongoing"
                :notify="row.notify"
                :last-saved="row.memoBy ? `${row.memoBy} · ${row.memoAt}` : null"
                :saving="memo.busy.value"
                :error="memo.error.value"
                @save="save(row.id)"
                @cancel="memo.close()"
              />
            </template>
          </BaseTable>
        </template>


        <BasePager v-model="page" :total="h.total.value" :size="h.size.value" />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.body {
  display: grid;
  height: 100%;
  min-height: 0;
}

/* 알람 탭: 왼쪽 좁은 요약 열 + 표 (D-109) */
.body.split {
  grid-template-columns: var(--col-summary-sm) minmax(0, 1fr);
  gap: var(--sp-4);
}

.list {
  min-height: 0;
}

.picked {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.picked b {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.chip {
  display: inline-flex;
  align-items: baseline;
  gap: var(--sp-1);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-6);
}

.field {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.lab,
.tilde {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.hint {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.num {
  font-weight: var(--fw-strong);
  font-variant-numeric: tabular-nums;
}

.live {
  font-weight: var(--fw-strong);
}

/* 알람 등급: 글자 칸 (심각은 고장 빨강 글자). 색만으로 말하지 않게 글자를 쓴다 */
.level {
  display: inline-block;
  margin: 2px 0 0 calc(var(--key-sm) + var(--sp-2));
  padding: 0 var(--sp-1);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.level.critical {
  border-color: var(--c-down);
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.t {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.eq {
  font-weight: var(--fw-strong);
}

.sub {
  display: block;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  white-space: normal;
}

.sub.detail {
  padding-left: calc(var(--key-sm) + var(--sp-2));
}

/* 지속: 보통 글자 · 보조 색 (D-109, 강조하지 않음) */
.dur {
  color: var(--c-ink-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.wrap-text {
  white-space: normal;
}

.none {
  color: var(--c-ink-3);
}

.memo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-1) var(--sp-2);
  min-width: 0;
}

/* 메모 열이 넓어 전문이 보인다 → 줄바꿈 (D-109) */
.memo-text {
  min-width: 0;
  white-space: normal;
  word-break: keep-all;
}

.saved {
  flex: none;
  color: var(--c-accent);
  font-size: var(--fs-sm);
}


.link {
  flex: none;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  font-size: var(--fs-sm);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}


.link.inline {
  margin-left: 0;
}
</style>
