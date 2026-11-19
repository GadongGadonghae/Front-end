<!-- 표 (DESIGN.md Components "표"): 머리줄은 흐린 작은 글자이고 스크롤해도 위에 붙는다. 행 사이는 가는 선, 숫자 열은 오른쪽 정렬
     누를 수 있는 행은 hover에 가라앉은 표면. 칸 모양은 #cell-열키 slot, 펼침 행은 #expand slot (expandedKey와 같은 행 아래)
     rowTone: 진행 중 고장·대기 행 바탕 (DESIGN.md "이상 행 바탕"). 쓰면 글자가 색 면 가장자리에 붙지 않게 양끝 칸에도 안쪽 여백 -->
<script setup lang="ts" generic="T extends object">
import BaseEmpty from '@/components/base/BaseEmpty.vue'

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  /** CSS 폭 (예: 7em). 없으면 남는 폭 */
  width?: string
}

const props = withDefaults(defineProps<{
  columns: TableColumn[]
  rows: T[]
  rowKey: (row: T) => string
  label: string
  /** 행을 누를 수 있는지 (행 전체가 버튼처럼 Enter·Space로도 동작) */
  clickable?: boolean
  expandedKey?: string | null
  /** hatch = 옅은 빗금 (빠진·제외된 행) */
  rowTone?: (row: T) => 'down' | 'idle' | 'hatch' | null
  empty?: string
}>(), { clickable: false, expandedKey: null, rowTone: undefined, empty: '데이터 없음' })
const emit = defineEmits<{ rowClick: [row: T] }>()

defineSlots<Record<string, (props: { row: T }) => unknown>>()

const cellOf = (row: T, key: string) => (row as Record<string, unknown>)[key] as string | number | null | undefined
function onKey(e: KeyboardEvent, row: T) {
  if (!props.clickable) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('rowClick', row) }
}
</script>

<template>
  <div class="wrap">
    <table v-if="rows.length" :aria-label="label" :class="{ inset: rowTone }">
      <colgroup><col v-for="c in columns" :key="c.key" :style="{ width: c.width }" /></colgroup>
      <thead>
        <tr><th v-for="c in columns" :key="c.key" :class="c.align" scope="col">{{ c.label }}</th></tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="rowKey(row)">
          <tr
            :class="[{ click: clickable, open: expandedKey === rowKey(row) }, rowTone?.(row) ? `t-${rowTone(row)}` : '']"
            :tabindex="clickable ? 0 : undefined"
            :aria-expanded="clickable && $slots.expand ? expandedKey === rowKey(row) : undefined"
            @click="clickable && emit('rowClick', row)"
            @keydown="onKey($event, row)"
          >
            <td v-for="c in columns" :key="c.key" :class="c.align">
              <slot :name="`cell-${c.key}`" :row="row">{{ cellOf(row, c.key) ?? '-' }}</slot>
            </td>
          </tr>
          <tr v-if="$slots.expand && expandedKey === rowKey(row)" class="expand">
            <td :colspan="columns.length"><slot name="expand" :row="row" /></td>
          </tr>
        </template>
      </tbody>
    </table>
    <BaseEmpty v-else :text="empty" />
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--fs-md);
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  background: var(--c-surface);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  text-align: left;
  white-space: nowrap;
}

td {
  padding: var(--sp-2) var(--sp-3);
  overflow: hidden;
  border-bottom: var(--line-w) solid var(--c-line);
  text-overflow: ellipsis;
  vertical-align: top;
}

th:first-child,
td:first-child {
  padding-left: 0;
}

th:last-child,
td:last-child {
  padding-right: 0;
}

.right {
  text-align: right;
}

.expand td {
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-surface-sunk);
}

tr.open td {
  background: var(--c-surface-sunk);
}

tr.t-down td { background: var(--c-down-tint); }
tr.t-idle td { background: var(--c-idle-tint); }
tr.t-hatch td { background: repeating-linear-gradient(135deg, var(--c-ng-hatch) 0 2px, transparent 2px 9px); }

.inset th:first-child,
.inset td:first-child {
  padding-left: var(--sp-3);
}

.inset th:last-child,
.inset td:last-child {
  padding-right: var(--sp-3);
}

tr.click {
  cursor: pointer;
}

tr.click:hover td {
  background: var(--c-surface-sunk);
}

tr.click:focus-visible {
  outline-offset: calc(var(--indicator-w) * -1);
}
</style>
