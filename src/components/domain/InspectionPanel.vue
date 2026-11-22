<!-- 공정 검사 (SCR-002 7번, D-88): 오늘 검사 수 · 불량 수 · 불량률 + 불량 목록(시각, 제품 ID, 설비·사유). 제품 ID → 생산 조회 그 제품
     compact: 비전 검사처럼 숫자를 제목 줄에 따로 두는 화면에서는 목록만 -->
<script setup lang="ts">
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import type { DefectRowView } from '@/types/view'

const props = withDefaults(defineProps<{
  inspected: number | null
  ng: number | null
  rate: number | null
  rows: DefectRowView[]
  /** reason: 사유를 제품 ID 아래에, where: 라인·설비 열을 따로 */
  detail?: 'reason' | 'where'
  /** 사유 앞에 설비 이름 (설비가 여럿인데 사유에 설비가 안 나오는 공정, 예: 도장 #1·#2) */
  showWhere?: boolean
  compact?: boolean
}>(), { detail: 'reason', showWhere: false, compact: false })
defineEmits<{ openProduct: [id: string] }>()

const columns: TableColumn[] = props.detail === 'reason'
  ? [{ key: 'time', label: '시각', width: '6.5em' }, { key: 'productId', label: '제품 ID · 사유' }]
  : [{ key: 'time', label: '시각', width: '6.5em' }, { key: 'productId', label: '제품 ID' }, { key: 'where', label: '라인', width: '4em' }]
</script>

<template>
  <div class="insp">
    <div v-if="!compact" class="nums">
      <BaseFigure label="검사" :value="inspected" size="sm" />
      <BaseFigure label="불량" :value="ng" size="sm" />
      <BaseFigure label="불량률" :value="rate" :digits="1" unit="%" size="sm" />
    </div>
    <BaseTable :columns="columns" :rows="rows" :row-key="(r) => r.key" label="불량 목록" empty="오늘 불량 없음">
      <template #cell-productId="{ row }">
        <button class="id" type="button" @click="$emit('openProduct', row.productId)">{{ row.productId }}</button>
        <div v-if="detail === 'reason'" class="why">{{ showWhere ? `${row.where} · ` : '' }}{{ row.reason }}</div>
      </template>
    </BaseTable>
  </div>
</template>

<style scoped>
.insp {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--sp-3);
  min-height: 0;
}

.nums {
  display: flex;
  flex: none;
  gap: var(--sp-6);
}

.id {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.why {
  margin-top: var(--sp-1);
  overflow: hidden;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
