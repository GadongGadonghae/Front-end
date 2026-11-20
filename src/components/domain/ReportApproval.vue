<!-- AI 리포트 결재 줄 (11/20): 작성 → 결재 완료 → 전송 완료 단계를 모두에게 보이고,
     버튼은 권한 있는 계정에만 보인다. 작성 = 생산 관리 팀장 · 결재·보고서 전송 = 공장장 (전송은 결재 완료 후에만 켜짐) -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps<{
  /** 아직 작성 전이면 null */
  status: 'WRITTEN' | 'APPROVED' | 'SENT' | null
  /** "김현수 · 11/20 14:02" 같은 글. 없으면 null */
  written: string | null
  approved: string | null
  sent: string | null
  /** 문서가 화면에 있어 작성할 수 있는지 */
  ready: boolean
  canWrite: boolean
  canApprove: boolean
}>()
const emit = defineEmits<{ write: []; approve: []; send: [] }>()

const steps = computed(() => {
  const order = { WRITTEN: 1, APPROVED: 2, SENT: 3 }
  const at = props.status ? order[props.status] : 0
  return [
    { name: '작성', who: '생산 관리 팀장', done: at >= 1, info: props.written },
    { name: '결재 완료', who: '공장장', done: at >= 2, info: props.approved },
    { name: '전송 완료', who: 'MES로 전송', done: at >= 3, info: props.sent },
  ]
})
</script>

<template>
  <div class="flow" aria-label="보고서 결재 상태">
    <ol class="steps">
      <li v-for="s in steps" :key="s.name" :class="{ done: s.done }">
        <b>{{ s.done ? '✓ ' : '' }}{{ s.name }}</b>
        <span>{{ s.info ?? s.who }}</span>
      </li>
    </ol>
    <div class="acts">
      <BaseButton v-if="canWrite && status !== 'SENT'" size="sm" :disabled="!ready" @click="emit('write')">{{ status ? '다시 작성(재결재)' : '작성 완료 · 결재 요청' }}</BaseButton>
      <BaseButton v-if="canApprove" size="sm" variant="primary" :disabled="status !== 'WRITTEN'" @click="emit('approve')">결재</BaseButton>
      <BaseButton v-if="canApprove" size="sm" variant="primary" :disabled="status !== 'APPROVED'" @click="emit('send')">보고서 전송</BaseButton>
      <span v-if="!canWrite && !canApprove" class="note">보기 전용 · 작성은 생산 관리 팀장, 결재·전송은 공장장</span>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.steps {
  display: flex;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: grid;
  gap: 2px;
  min-width: 128px;
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.steps li b {
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.steps li.done {
  border-color: var(--c-accent);
  background: var(--c-accent-tint);
  color: var(--c-ink);
}

.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}
</style>
