<!-- 제품 여정 범례 (ProductJourney와 같은 칠): 공정 5색 · 지금 처리 중(옅은 칠 + 파란 테두리) · 설비 고장으로 멈춤 · 지금 이후 -->
<script setup lang="ts">
const PROCS = ['슬리팅', '프레스', '용접', '도장', '출고']
</script>

<template>
  <ul class="legend" aria-label="범례">
    <li v-for="(p, i) in PROCS" :key="p"><i :style="{ background: `color-mix(in srgb, var(--c-proc-${i + 1}) 50%, var(--c-surface))` }"></i>{{ p }}</li>
    <li class="sep"><i class="now"></i>지금 처리 중</li>
    <li><i class="stuck"></i>설비 고장으로 멈춤</li>
    <li><i class="fut"></i>지금 이후</li>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
  margin: 0;
  padding: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  list-style: none;
}

li {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

/* 공정 색과 상태 표시 사이 구분 */
.sep {
  padding-left: var(--sp-4);
  border-left: var(--line-w) solid var(--c-line-strong);
}

i {
  width: var(--sp-5);
  height: var(--sp-3);
  border-radius: var(--r-1);
}

.now { background: var(--c-surface); box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-accent); }
.stuck { background: var(--c-down); }
.fut { background: var(--c-surface-sunk); box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong); }
</style>
