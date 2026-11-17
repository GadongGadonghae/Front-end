<!-- 비가동 이력 + 조치 메모 (SCR-002 5·6번): 상태 열쇠 칸 · 코드와 사유 · 시각 범위와 지속시간
     진행 중 고장·대기는 이상 행 바탕. 메모는 선택 입력이고, 저장하면 담당자는 로그인한 사람 (D-33, D-84) -->
<script setup lang="ts">
import { useInlineEdit } from '@/components/base/inlineEdit'
import StatusKey from '@/components/domain/StatusKey.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import type { HistoryRowView } from '@/types/view'

defineProps<{ rows: HistoryRowView[] }>()
const emit = defineEmits<{ save: [id: string, memo: string] }>()

/** 메모를 쓰고 있는 행과 그 글. 열면 입력에 초점, 닫으면 연 버튼으로 */
const memo = useInlineEdit('downtime-memo')
const { draft } = memo
function save(id: string) {
  emit('save', id, draft.value)
  memo.close()
}
const tint = (r: HistoryRowView) => (r.ongoing && r.state === 'D' ? 't-down' : r.ongoing && r.state === 'I' ? 't-idle' : '')
</script>

<template>
  <ul v-if="rows.length" class="hist">
    <li v-for="r in rows" :key="r.id" :class="tint(r)">
      <StatusKey :state="r.state" :muted="!r.ongoing" />
      <div class="what">
        <b>{{ r.code }}</b>
        <span v-if="r.detail" class="detail">{{ r.detail }}</span>
      </div>
      <div class="when">{{ r.range }}<b>{{ r.duration }}</b></div>

      <form v-if="memo.editing.value === r.id" class="memo" :data-edit="memo.attr(r.id, 'form')" @submit.prevent="save(r.id)" @keydown.esc.prevent="memo.close()">
        <BaseInput v-model="draft" label="조치 메모" hide-label size="md" placeholder="조치 메모 (선택)" />
        <BaseButton type="submit" variant="primary">저장</BaseButton>
        <BaseButton @click="memo.close()">취소</BaseButton>
        <p class="note">저장하면 조치 담당자는 로그인한 사람으로 기록</p>
      </form>
      <div v-else class="memo-line">
        <span v-if="r.memo" class="memo-text">{{ r.memo.text }} <span class="by">· {{ r.memo.by ?? '-' }} {{ r.memo.at }}</span></span>
        <span v-else class="memo-none">조치 메모 없음</span>
        <button class="link" type="button" :data-edit="memo.attr(r.id, 'open')" @click="memo.open(r.id, r.memo?.text ?? '')">{{ r.memo ? '메모 고치기' : '메모 쓰기' }}</button>
      </div>
    </li>
  </ul>
  <BaseEmpty v-else />
</template>

<style scoped>
.hist {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--sp-1) var(--sp-3);
  padding: var(--sp-3) 0;
  border-top: var(--line-w) solid var(--c-line);
}

li:first-child {
  padding-top: 0;
  border-top: 0;
}

/* 이상 행 바탕: 글자가 색 면 가장자리에 붙지 않게 안쪽 여백 */
li.t-down,
li.t-idle {
  padding: var(--sp-3);
  border-top-color: transparent;
  border-radius: var(--r-2);
}

li.t-down { background: var(--c-down-tint); }
li.t-idle { background: var(--c-idle-tint); }

li.t-down + li,
li.t-idle + li {
  border-top-color: transparent;
}

.what {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.what b {
  font-size: var(--fs-body);
  font-weight: var(--fw-strong);
}

.detail {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.when {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
  white-space: nowrap;
}

.when b {
  color: var(--c-ink);
  font-size: var(--fs-body);
  font-weight: var(--fw-strong);
}

.memo,
.memo-line {
  grid-column: 2 / -1;
}

.memo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
}

.note {
  grid-column: 1 / -1;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}

.memo-line {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  font-size: var(--fs-label);
}

.memo-text {
  min-width: 0;
  color: var(--c-ink-2);
}

.by,
.memo-none {
  color: var(--c-ink-3);
}

.link {
  flex: none;
  margin-left: auto;
  min-height: var(--sp-6);
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
