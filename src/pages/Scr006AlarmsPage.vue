<!-- SCR-006 알람·비가동 이력 (화면정의서 SCR-006, 시안 B-alarm)
     제목 줄: 제목 + 탭 [알람·비가동] / [예지보전 위험] (D-65). 본문: 패널 하나 = 필터 줄 → 표 → 페이지 (50건씩, D-66)
     진행 중 고장 행은 고장 바탕, 대기 행은 대기 바탕 (DESIGN.md). 메일·슬랙은 고장(D)만 보내므로 다른 건은 "-" -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseCheck from '@/components/base/BaseCheck.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BasePager from '@/components/base/BasePager.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { useInlineEdit } from '@/components/base/inlineEdit'
import { useAlarmHistory, MAX_DAYS, type AlarmRow, type HistoryTab, type RiskRow } from '@/composables/useAlarmHistory'

const route = useRoute()
const router = useRouter()
const h = useAlarmHistory()
const { tab, from, to, lineId, process, states, code, ongoing, page } = h

// 탭은 주소 쿼리 (?tab=risk). 같은 화면이라 필터는 그대로 둔다
const tabOf = (v: unknown): HistoryTab => (v === 'risk' ? 'risk' : 'alarm')
watch(() => route.query.tab, (v) => { tab.value = tabOf(v) }, { immediate: true })
const TABS = [
  { key: 'alarm', label: '알람·비가동', to: '/alarms' },
  { key: 'risk', label: '예지보전 위험', to: '/alarms?tab=risk' },
]

const multi = computed(() => from.value !== to.value)
const timeW = computed(() => (multi.value ? '9.5em' : '6.5em'))
const ALARM_COLS = computed<TableColumn[]>(() => [
  { key: 'start', label: '발생', width: timeW.value },
  { key: 'end', label: '해제', width: timeW.value },
  { key: 'line', label: '라인', width: '4.5em' },
  { key: 'equipment', label: '설비', width: '7em' },
  { key: 'code', label: '상태 · 코드', width: '11em' },
  { key: 'detail', label: '상세' },
  { key: 'duration', label: '지속', align: 'right', width: '5.5em' },
  { key: 'notify', label: '발송', width: '12.5em' },
  { key: 'memo', label: '조치 메모', width: '17em' },
  { key: 'memoBy', label: '조치 담당자', width: '10.5em' },
  { key: 'report', label: '보고서', width: '6.5em' },
])
const RISK_COLS = computed<TableColumn[]>(() => [
  { key: 'start', label: '발생', width: timeW.value },
  { key: 'end', label: '해제', width: timeW.value },
  { key: 'line', label: '라인', width: '4.5em' },
  { key: 'equipment', label: '설비', width: '8em' },
  { key: 'item', label: '항목' },
  { key: 'max', label: '최고 %', align: 'right', width: '6em' },
])

const tone = (r: AlarmRow) => (r.ongoing && r.state === 'D' ? 'down' : r.ongoing && r.state === 'I' ? 'idle' : null)
const riskTone = (r: RiskRow) => (r.ongoing ? 'down' : null)

// 조치 메모: 한 번에 한 건만 고친다. 열면 입력에 초점, 닫으면 연 버튼으로
const memo = useInlineEdit('alarm-memo')
const { draft } = memo
async function save(id: string) {
  await h.saveMemo(id, draft.value)
  memo.close()
}

const openReport = (r: AlarmRow) => router.push(r.reportId ? `/reports/replan/${r.reportId}` : `/reports/replan?create=${r.id}`)
const noState = computed(() => !states.value.D && !states.value.I && !states.value.S)
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">알람·비가동 이력</h1>
      <BaseTabs :items="TABS" :active="tab" label="이력 종류" />
    </template>

    <BasePanel class="list">
      <template #head>
        <h2 class="sr-only">{{ tab === 'alarm' ? '알람·비가동 이력 표' : '예지보전 위험 이력 표' }}</h2>
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
            <span class="field" role="group" aria-label="상태">
              <span class="lab">상태</span>
              <BaseCheck v-model="states.D" label="고장"><StatusKey state="D" size="sm" label="고장" /></BaseCheck>
              <BaseCheck v-model="states.I" label="대기"><StatusKey state="I" size="sm" label="대기" /></BaseCheck>
              <BaseCheck v-model="states.S" label="정지"><StatusKey state="S" size="sm" label="정지" /></BaseCheck>
            </span>
            <BaseSelect v-model="code" label="코드" :options="h.codeOptions.value" />
            <BaseCheck v-model="ongoing" label="진행 중만" />
          </template>
        </div>
      </template>

      <BaseTable
        v-if="tab === 'alarm'"
        label="알람·비가동 이력"
        :columns="ALARM_COLS"
        :rows="h.alarmRows.value"
        :row-key="(r) => r.id"
        :row-tone="tone"
        :empty="noState ? '상태를 하나 이상 고르세요' : '데이터 없음'"
      >
        <template #cell-start="{ row }"><span class="t">{{ row.start }}</span></template>
        <template #cell-end="{ row }">
          <span v-if="row.ongoing" class="live">진행 중</span>
          <span v-else class="t">{{ row.end }}</span>
        </template>
        <template #cell-code="{ row }">
          <StatusKey :state="row.state" size="sm" :label="row.code" />
          <span v-if="row.level" :class="['level', { critical: row.critical }]">{{ row.level }}</span>
        </template>
        <template #cell-detail="{ row }"><span class="wrap-text">{{ row.detail }}</span></template>
        <template #cell-duration="{ row }"><b class="num">{{ row.duration }}</b></template>
        <template #cell-notify="{ row }">
          <span v-if="row.notify" class="sent">
            <span :class="{ fail: !row.notify.email }"><BaseIcon :name="row.notify.email ? 'check' : 'x'" :size="14" />메일<template v-if="!row.notify.email"> 실패</template></span>
            <span :class="{ fail: !row.notify.slack }"><BaseIcon :name="row.notify.slack ? 'check' : 'x'" :size="14" />슬랙<template v-if="!row.notify.slack"> 실패</template></span>
          </span>
          <span v-else class="none">-</span>
        </template>
        <template #cell-memo="{ row }">
          <form v-if="memo.editing.value === row.id" class="memo-edit" :data-edit="memo.attr(row.id, 'form')" @submit.prevent="save(row.id)" @keydown.esc.prevent="memo.close()">
            <BaseInput v-model="draft" label="조치 메모" hide-label size="md" placeholder="조치 메모 (선택)" />
            <BaseButton type="submit" variant="primary">저장</BaseButton>
            <BaseButton @click="memo.close()">취소</BaseButton>
          </form>
          <span v-else class="memo">
            <span class="memo-text" :class="{ none: !row.memo }">{{ row.memo ?? '-' }}</span>
            <button class="link" type="button" :data-edit="memo.attr(row.id, 'open')" @click="memo.open(row.id, row.memo ?? '')">{{ row.memo ? '고치기' : '쓰기' }}</button>
          </span>
        </template>
        <template #cell-memoBy="{ row }">
          <span v-if="row.memoBy" class="who">{{ row.memoBy }}<small>{{ row.memoAt }} 저장</small></span>
          <span v-else class="none">-</span>
        </template>
        <template #cell-report="{ row }">
          <BaseButton v-if="row.report" size="sm" @click="openReport(row)">{{ row.report === 'view' ? '보기' : '만들기' }}</BaseButton>
          <span v-else class="none">-</span>
        </template>
      </BaseTable>

      <BaseTable
        v-else
        label="예지보전 위험 이력"
        :columns="RISK_COLS"
        :rows="h.riskRows.value"
        :row-key="(r) => r.id"
        :row-tone="riskTone"
      >
        <template #cell-start="{ row }"><span class="t">{{ row.start }}</span></template>
        <template #cell-end="{ row }">
          <span v-if="row.ongoing" class="live">진행 중</span>
          <span v-else class="t">{{ row.end }}</span>
        </template>
        <template #cell-max="{ row }"><b class="num">{{ row.max }}</b></template>
      </BaseTable>

      <BasePager v-model="page" :total="h.total.value" :size="h.size.value" />
    </BasePanel>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.list {
  height: 100%;
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
  font-size: var(--fs-label);
}

.hint {
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
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
  font-size: var(--fs-caption);
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

.wrap-text {
  white-space: normal;
}

.none {
  color: var(--c-ink-3);
}

.sent {
  display: inline-flex;
  gap: var(--sp-3);
  color: var(--c-ink-2);
  white-space: nowrap;
}

.sent > span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* 실패는 고장 빨강 글자 + ✗ (색만으로 말하지 않게 "실패"를 같이 쓴다) */
.sent .fail {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.memo {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
}

.memo-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 칸 폭이 좁아 입력과 버튼이 한 줄에 들어가지 않는다 → 입력 한 줄, 버튼은 그 아래 오른쪽 */
.memo-edit {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-1);
}

.memo-edit > .field {
  flex: 1 0 100%;
  min-width: 0;
}

.link {
  flex: none;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  font-size: var(--fs-label);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.who {
  display: flex;
  flex-direction: column;
}

.who small {
  color: var(--c-ink-3);
  white-space: nowrap;
  font-size: var(--fs-caption);
}
</style>
