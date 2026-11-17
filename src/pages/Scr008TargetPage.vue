<!-- SCR-008 생산 목표 설정 (화면정의서 SCR-008, 시안 B-target)
     왼쪽: 하루 목표 입력 (날짜 · 수량 · 라인 계획 자동 안내, D-87). 오른쪽: 최근 목표 목록 (날짜 · 목표 · 라인 계획 · 실적 · 달성률)
     오늘과 앞으로의 날짜만, 지난 날짜는 잠김. 같은 날짜는 덮어씀 (D-71). 목표 없는 날은 "목표 미설정" (D-72) -->
<script setup lang="ts">
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import { useTargets } from '@/composables/useSettings'
import { dateWithDay } from '@/composables/useReports'
import { formatNumber } from '@/lib/format'

const t = useTargets()
const { date, quantity } = t

const TABS = [
  { key: 'target', label: '생산 목표', to: '/settings/target' },
  { key: 'limits', label: '관리값 기준', to: '/settings/limits' },
]
const COLS: TableColumn[] = [
  { key: 'date', label: '날짜' },
  { key: 'quantity', label: '목표', align: 'right' },
  { key: 'plan', label: '라인 계획', align: 'right' },
  { key: 'done', label: '실적', align: 'right' },
  { key: 'rate', label: '달성률', align: 'right' },
  { key: 'act', label: '', align: 'right', width: '6em' },
]
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">설정</h1>
      <BaseTabs :items="TABS" active="target" label="설정 종류" />
    </template>

    <div class="layout">
      <BasePanel title="하루 목표 입력" meta="공장 전체 · 하루 1건">
        <form class="form" @submit.prevent="t.save">
          <BaseDateField v-model="date" label="날짜" :min="t.today" />
          <div class="qty">
            <BaseInput v-model="quantity" label="목표 수량" size="md" :invalid="!!t.error.value" inputmode="numeric" />
            <span class="unit">개</span>
          </div>
          <div class="plan">
            <span class="lab">라인 계획 (자동)</span>
            <b class="n">{{ t.planText.value }}</b>
          </div>
          <div class="actions">
            <BaseButton type="submit" variant="primary" :disabled="t.saving.value">{{ t.exists.value ? '덮어쓰기' : '저장' }}</BaseButton>
            <p v-if="t.error.value" class="msg err" role="alert">{{ t.error.value }}</p>
            <p v-else-if="t.saved.value" class="msg ok" role="status">{{ t.saved.value }}</p>
          </div>
          <ul class="rules">
            <li>오늘과 앞으로의 날짜만 입력할 수 있음. 지난 날짜는 잠김</li>
            <li>같은 날짜에 다시 저장하면 덮어씀</li>
            <li>저장하면 대시보드 달성률에 바로 반영</li>
          </ul>
        </form>
      </BasePanel>

      <BasePanel title="최근 목표" meta="지난 14일 · 앞으로 정해 둔 날">
        <BaseTable label="최근 목표" :columns="COLS" :rows="t.tableRows.value" :row-key="(r) => r.key">
          <template #cell-date="{ row }">
            <span :class="{ strong: row.today }">{{ dateWithDay(row.date) }}<template v-if="row.today"> · 오늘</template></span>
          </template>
          <template #cell-quantity="{ row }">
            <b v-if="row.quantity != null" class="n">{{ formatNumber(row.quantity) }}</b>
            <span v-else class="unset">목표 미설정</span>
          </template>
          <template #cell-plan="{ row }"><span class="n">{{ formatNumber(row.plan) }}</span></template>
          <template #cell-done="{ row }"><span class="n">{{ formatNumber(row.done) }}</span></template>
          <template #cell-rate="{ row }">
            <span class="n">{{ row.rate != null ? `${formatNumber(row.rate, 1)}%` : '-' }}</span><span v-if="row.today && row.rate != null" class="live"> 진행 중</span>
          </template>
          <template #cell-act="{ row }">
            <span v-if="row.past" class="locked">잠김</span>
            <span v-else-if="row.editing" class="locked">입력 중</span>
            <BaseButton v-else size="sm" @click="t.edit(row.date)">수정</BaseButton>
          </template>
        </BaseTable>
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
  grid-template-columns: var(--col-form) minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: start;
  height: 100%;
  min-height: 0;
}

.layout > :last-child {
  max-height: 100%;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.qty {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-2);
}

.unit,
.lab {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.unit {
  padding-bottom: var(--sp-2);
}

.plan {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-3);
  border-radius: var(--r-2);
  background: var(--c-surface-sunk);
}

.plan b {
  font-size: var(--fs-title);
  font-weight: var(--fw-strong);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
}

.msg {
  margin: 0;
  font-size: var(--fs-label);
}

.msg.err {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.msg.ok {
  color: var(--c-ink-2);
}

.rules {
  margin: 0;
  padding: var(--sp-3) 0 0 var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  line-height: 1.7;
}

.n {
  font-variant-numeric: tabular-nums;
}

b.n,
.strong {
  font-weight: var(--fw-strong);
}

.unset {
  color: var(--c-ink-3);
}

.live,
.locked {
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}
</style>
