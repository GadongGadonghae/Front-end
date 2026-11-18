<!-- 공정 상세 설비 카드 (SCR-002 2번): 위 = 상태 색 띠(코드 · 명칭 · 지속시간), 아래 = 이름 · 오늘 숫자. 누르면 그 설비를 고른다
     고른 카드는 먹색 테두리. 예지보전은 카드 바깥 테두리 + 글자 -->
<script setup lang="ts">
import { STATE_NAME } from '@/lib/status'
import type { EquipCardView } from '@/types/view'

defineProps<{ card: EquipCardView; selected?: boolean }>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <button
    class="card"
    :class="[{ on: selected }, card.pdm ? `pdm-${card.pdm.level}` : '']"
    type="button"
    :aria-pressed="selected"
    @click="$emit('select', card.id)"
  >
    <span class="band" :class="`st-${card.state}`">
      <b class="code">{{ card.state }}</b>
      <span class="word">{{ STATE_NAME[card.state] }}</span>
      <span class="dur">{{ card.duration }}</span>
    </span>
    <span class="body">
      <span class="name">{{ card.name }}<span v-if="card.tag" class="tag">{{ card.tag }}</span></span>
      <span v-for="i in card.info" :key="i.label" class="kv">
        <span class="k">{{ i.label }}</span>
        <span class="v" :class="{ strong: i.mark }"><small v-if="i.mark">{{ i.mark }}</small>{{ i.value }}</span>
      </span>
      <span v-if="card.pdm" class="pdm">예지보전 {{ card.pdm.text }}</span>
    </span>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-3);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card:hover {
  border-color: var(--c-line-ink);
}

/* 고른 카드: 테두리를 굵게. 두께가 바뀌어도 안이 밀리지 않게 바깥선으로 그린다 */
.card.on {
  border-color: var(--c-ink);
  box-shadow: 0 0 0 var(--line-w) var(--c-ink);
}

/* 예지보전 테두리는 카드 둘레에서 떨어진다 */
.card.pdm-warn,
.card.pdm-danger {
  outline-offset: var(--sp-1);
}

.band {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
}

.code {
  font-size: var(--fs-lg);
  font-weight: var(--fw-code);
  line-height: var(--lh-tight);
}

.word {
  font-size: var(--fs-md);
}

.dur {
  margin-left: auto;
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.body {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
}

.name {
  margin-bottom: var(--sp-1);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
}

.tag {
  margin-left: var(--sp-2);
  padding: 0 var(--sp-2);
  border-radius: var(--r-1);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  vertical-align: middle;
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  font-size: var(--fs-md);
}

.k {
  color: var(--c-ink-3);
}

.v.strong {
  font-weight: var(--fw-strong);
}

.v small {
  margin-right: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.pdm {
  margin-top: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

@media (height <= 860px) {
  .body {
    padding: var(--sp-2) var(--sp-4) var(--sp-3);
  }
}
</style>
