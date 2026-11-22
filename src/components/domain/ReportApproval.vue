<!-- AI 리포트 결재 줄 (11/20): 작성 → 결재 완료 → 전송 완료 단계를 모두에게 보이고,
     버튼은 권한 있는 계정에만 보인다. 작성·회수 = 생산관리 팀장 · 결재·보고서 전송 = 공장장 (전송은 결재 완료 후에만 켜짐)
     🆕 11/20: 작성 중(만들기만) → [작성 완료 · 결재 요청] → (결재 전) [회수]로 작성 중. 지난 단계는 연두색, 다 끝나면(전송 완료) 줄 전체가 연두색 -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps<{
  /** 아직 기록이 없으면 null. DRAFT = 작성 중(결재 요청 전) */
  status: 'DRAFT' | 'WRITTEN' | 'APPROVED' | 'SENT' | null
  /** "김현수 · 11/20 14:02" 같은 글. 없으면 null */
  written: string | null
  approved: string | null
  sent: string | null
  /** 문서가 화면에 있어 작성할 수 있는지 */
  ready: boolean
  canWrite: boolean
  canApprove: boolean
  /** 서버에 기록하는 중 (버튼 잠금) */
  busy?: boolean
}>()
const emit = defineEmits<{ write: []; recall: []; approve: []; send: [] }>()

const at = computed(() => ({ DRAFT: 0, WRITTEN: 1, APPROVED: 2, SENT: 3 })[props.status ?? 'DRAFT'] ?? 0)
// 칸 이름은 지금 상태대로: 끝난 단계만 "완료", 지금 차례는 "중·대기", 아직 안 온 단계는 이름만 (11/20: 처음부터 "결재 완료·전송 완료"로 읽히던 문제)
const steps = computed(() => [
  {
    name: at.value >= 1 ? '작성 완료' : props.status === 'DRAFT' ? '작성 중' : '작성',
    who: at.value >= 1 ? props.written : props.status === 'DRAFT' ? '결재 요청 전' : '생산관리 팀장',
    done: at.value >= 1, now: at.value === 0,
  },
  {
    name: at.value >= 2 ? '결재 완료' : at.value === 1 ? '결재 대기' : '결재',
    who: at.value >= 2 ? props.approved : '공장장',
    done: at.value >= 2, now: at.value === 1,
  },
  {
    name: at.value >= 3 ? 'MES 전송 완료' : at.value === 2 ? '전송 대기' : 'MES 전송',
    who: at.value >= 3 ? props.sent : '공장장',
    done: at.value >= 3, now: at.value === 2,
  },
])
const complete = computed(() => props.status === 'SENT')
</script>

<template>
  <div :class="['flow', { complete }]" aria-label="보고서 결재 상태">
    <ol class="steps">
      <li v-for="s in steps" :key="s.name" :class="{ done: s.done, now: s.now }" :aria-current="s.now ? 'step' : undefined">
        <b>{{ s.done ? '✓ ' : '' }}{{ s.name }}</b>
        <span>{{ s.who ?? '' }}</span>
      </li>
    </ol>
    <div class="acts">
      <template v-if="canWrite">
        <BaseButton v-if="!status || status === 'DRAFT'" size="sm" variant="primary" :disabled="!ready || busy" @click="emit('write')">작성 완료 · 결재 요청</BaseButton>
        <BaseButton v-else-if="status === 'WRITTEN'" size="sm" :disabled="busy" @click="emit('recall')">회수</BaseButton>
      </template>
      <template v-if="canApprove">
        <BaseButton size="sm" variant="primary" :disabled="status !== 'WRITTEN' || busy" @click="emit('approve')">결재</BaseButton>
        <BaseButton size="sm" variant="primary" :disabled="status !== 'APPROVED' || busy" @click="emit('send')">보고서 전송</BaseButton>
      </template>
      <span v-if="canApprove && (!status || status === 'DRAFT')" class="note">생산관리 팀장이 결재 요청하면 결재할 수 있어요</span>
      <span v-if="!canWrite && !canApprove" class="note">보기 전용 · 작성은 생산관리 팀장, 결재·전송은 공장장</span>
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

/* 지금 할 단계: 진한 테두리 */
.steps li.now {
  border-color: var(--c-line-strong);
  color: var(--c-ink-2);
}

/* 지난 단계: 연두색 (가동 초록을 아주 옅게, 상태색 R과 같은 뜻 "잘 되고 있음") */
.steps li.done {
  border-color: var(--c-done-line);
  background: var(--c-done-bg);
  color: var(--c-ink);
}

/* 전송까지 끝: 줄 전체가 연두색 */
.flow.complete {
  border-color: var(--c-done-line);
  background: var(--c-done-bg);
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
