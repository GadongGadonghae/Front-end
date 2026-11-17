<!-- 오늘 입고 기록 (SCR-002-1 2번, D-53): 시각 · 코일 수, 최근순 -->
<script setup lang="ts">
import BaseTable from '@/components/base/BaseTable.vue'
import { formatTime } from '@/lib/format'

defineProps<{ receipts: { t: string; coils: number }[] }>()
</script>

<template>
  <BaseTable
    :columns="[{ key: 't', label: '시각' }, { key: 'coils', label: '코일', align: 'right', width: '5em' }]"
    :rows="receipts"
    :row-key="(r) => r.t"
    label="오늘 입고 기록"
    empty="오늘 입고 없음"
  >
    <template #cell-t="{ row }">{{ formatTime(row.t) }}</template>
  </BaseTable>
</template>
