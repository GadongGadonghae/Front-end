<!-- SCR-008 생산 목표 설정 (화면정의서 SCR-008, 시안 B-target)
     왼쪽: 하루 목표 입력 (날짜 · 수량 · 라인 계획 자동 안내, D-87). 오른쪽: 최근 목표 목록 (날짜 · 목표 · 라인 계획 · 실적 · 달성률)
     오늘과 앞으로의 날짜만, 지난 날짜는 잠김. 같은 날짜는 덮어씀 (D-71). 목표 없는 날은 "목표 미설정" (D-72) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { PERM_OWNER } from '@/lib/access'
import { settingsTabsFor } from '@/lib/permissions'
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

// 권한 있는 설정 탭만 (11/20, lib/permissions.ts)
const { role: myRole } = useAuth()
const TABS = computed(() => settingsTabsFor(myRole.value))
const COLS: TableColumn[] = [
  { key: 'date', label: '날짜' },
  { key: 'quantity', label: '목표', align: 'right' },
  { key: 'plan', label: '라인 계획', align: 'right' },
  { key: 'done', label: '실적', align: 'right' },
  { key: 'rate', label: '달성률', align: 'right' },
  { key: 'by', label: '수정자' },
  { key: 'act', label: '', align: 'right', width: '6em' },
]
const { can } = useAuth()
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">설정</h1>
      <BaseTabs :items="TABS" active="target" label="설정 종류" />
    </template>

    <div class="layout">
      <BasePanel title="하루 목표 입력" meta="공장 전체 · 하루 1건">
        <p v-if="!can('target')" class="perm-note" role="note">보기 전용 · {{ PERM_OWNER.target }}만 바꿀 수 있습니다</p>
        <form class="form" :inert="!can('target')" @submit.prevent="can('target') && t.save()">
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
        </form>
      </BasePanel>

      <BasePanel title="최근 목표" meta="지난 14일 · 앞으로 정해 둔 날">
        <BaseTable label="최근 목표" :columns="COLS" :rows="t.tableRows.value" :row-key="(r) => r.key">
          <template #cell-date="{ row }">
            <span :class="{ strong: row.today }">{{ dateWithDay(row.date) }}<template v-if="row.today"> · 오늘</template></span>
          </template>
          <template #cell-quantity="{ row }">
            <template v-if="row.quantity != null">
              <b class="n">{{ formatNumber(row.quantity) }}</b>
              <small v-if="row.pending" class="pending"> (배정 대기 {{ formatNumber(row.pending) }})</small>
            </template>
            <span v-else class="unset">목표 미설정</span>
          </template>
          <template #cell-plan="{ row }"><span class="n">{{ formatNumber(row.plan) }}</span></template>
          <template #cell-done="{ row }"><span class="n">{{ formatNumber(row.done) }}</span></template>
          <template #cell-rate="{ row }">
            <span class="n">{{ row.rate != null ? `${formatNumber(row.rate, 1)}%` : '-' }}</span><span v-if="row.today && row.rate != null" class="live"> 진행 중</span>
          </template>
          <template #cell-by="{ row }"><span class="by">{{ row.by ?? '-' }}</span></template>
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
/* 오늘 목표를 올려 아직 라인에 안 나눈 수량 (생산관리팀장 배정 보고서 → 결재 후 반영) */
.pending {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.perm-note {
  margin-bottom: var(--sp-3);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.title {
  font-size: var(--fs-page);
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
  font-size: var(--fs-sm);
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
  font-size: var(--fs-md);
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
  font-size: var(--fs-sm);
}

.msg.err {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.msg.ok {
  color: var(--c-ink-2);
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
  font-size: var(--fs-sm);
}
</style>
