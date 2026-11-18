<!-- 제품이 거친 공정 (SCR-011 5번): 슬리팅 ✓ 프레스 ✓ 용접 ✗ 도장 · 출고 ·
     통과 ✓ · 불량 ✗(빨강 글자) · 진행 중 (굵게 + 밑줄) · 안 거침 흐리게. 모양과 글자를 같이 써서 색만으로 말하지 않는다 -->
<script setup lang="ts">
import { PROCESS_NAME } from '@/lib/status'
import type { ProcessId } from '@/types/plant'
import type { StepResult } from '@/types/production'

defineProps<{ steps: { process: ProcessId; result: StepResult }[] }>()
const MARK: Record<StepResult, string> = { ok: '✓', ng: '✗', now: '', no: '' }
const WORD: Record<StepResult, string> = { ok: '통과', ng: '불량', now: '진행 중', no: '안 거침' }
</script>

<template>
  <span class="steps" :aria-label="steps.map((s) => `${PROCESS_NAME[s.process]} ${WORD[s.result]}`).join(', ')">
    <span v-for="s in steps" :key="s.process" :class="['st', s.result]" aria-hidden="true">{{ PROCESS_NAME[s.process] }}<b v-if="MARK[s.result]">{{ MARK[s.result] }}</b></span>
  </span>
</template>

<style scoped>
/* 칸이 좁으면 공정 단위로 다음 줄로 (잘리지 않게) */
.steps {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 var(--sp-2);
}

.st {
  white-space: nowrap;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.st b {
  margin-left: 1px;
  font-weight: var(--fw-strong);
}

.ng {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}

.now {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.no {
  color: var(--c-ink-3);
}
</style>
