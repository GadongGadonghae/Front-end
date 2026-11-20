<!-- 알람·비가동 이력 왼쪽 요약 (D-109 시안 D4, D-111). SummaryColumn 안에 덩어리 셋:
     ① 상태별 건수 한 줄 (고장 · 대기 · 정지). 표에서 빠진 상태는 흐리게, 누르면 표에도 보임
     ② 아직 손볼 건 (진행 중 고장 · 메일 실패) — 숫자를 크게 ③ 알람 코드 (고장 코드별 건수)
     ②③은 같은 모양의 거르기 버튼: 누르면 그 건만, 고른 것은 먹색 면, 다시 누르면 풀림 -->
<script setup lang="ts">
import SummaryBlock from '@/components/domain/SummaryBlock.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import type { StopState } from '@/types/state'

defineProps<{
  states: { state: StopState; label: string; count: number; hidden: boolean }[]
  alarms: { code: string; name: string; count: number }[]
  todo: { key: string; label: string; count: number }[]
  activeCode: string
  activeTodo: string
}>()
const emit = defineEmits<{ pickAlarm: [code: string]; pickTodo: [key: string]; showState: [state: StopState] }>()
</script>

<template>
  <SummaryBlock>
    <div class="states">
      <template v-for="s in states" :key="s.state">
        <button
          v-if="s.hidden"
          type="button"
          class="st muted"
          :title="`${s.label}은 표에 없음 · 누르면 표에 보이기`"
          @click="emit('showState', s.state)"
        ><StatusKey :state="s.state" size="sm" /><b>{{ s.count }}</b></button>
        <span v-else class="st" :title="s.label"><StatusKey :state="s.state" size="sm" /><b>{{ s.count }}</b></span>
      </template>
    </div>
  </SummaryBlock>

  <SummaryBlock>
    <h3 class="h">아직 손볼 건</h3>
    <ul class="picks">
      <li v-for="t in todo" :key="t.key">
        <button type="button" class="big" :class="{ on: activeTodo === t.key, zero: !t.count }" :aria-pressed="activeTodo === t.key" @click="emit('pickTodo', t.key)">
          <span>{{ t.label }}</span><b class="n">{{ t.count }}</b>
        </button>
      </li>
    </ul>
  </SummaryBlock>

  <SummaryBlock>
    <h3 class="h">알람 코드</h3>
    <ul class="picks">
      <li v-for="a in alarms" :key="a.code">
        <button type="button" :class="{ on: activeCode === a.code, zero: !a.count }" :aria-pressed="activeCode === a.code" @click="emit('pickAlarm', a.code)">
          <span>{{ a.name }}</span><span class="n">{{ a.count || '-' }}</span>
        </button>
      </li>
    </ul>
  </SummaryBlock>
</template>

<style scoped>
/* 상태별 건수 한 줄: 열쇠 칸 + 수 */
.states {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-2);
}

.st {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
}

.st b {
  font-weight: var(--fw-strong);
}

/* 표에서 빠진 상태: 흐리게, 누를 수 있음 */
.st.muted {
  color: var(--c-ink-3);
  cursor: pointer;
}

.st.muted b {
  font-weight: var(--fw-regular);
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.h {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.picks {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 거르기 버튼: 같은 모양 (테두리 상자 + 이름 + 오른쪽 수) */
.picks button {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  text-align: left;
  cursor: pointer;
}

.picks button:hover {
  background: var(--c-surface-sunk);
}

.picks .n {
  margin-left: auto;
  color: var(--c-ink-2);
  font-variant-numeric: tabular-nums;
}

/* 아직 손볼 건: 수를 크게 (할 일이라 위계가 높다) */
.picks .big .n {
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.picks button.zero,
.picks button.zero .n {
  color: var(--c-ink-3);
}

.picks button.on,
.picks button.on .n {
  border-color: var(--c-ink);
  background: var(--c-ink);
  color: var(--c-inverse-ink);
}
</style>
