<!-- 제품 여정 범례 (ProductJourney와 같은 칠): 머문 시간 · 지금 처리 중 · 설비 고장으로 멈춤 · 불량 제외 -->
<template>
  <ul class="legend" aria-label="범례">
    <li><i class="done"></i>공정에 머문 시간</li>
    <li><i class="now"></i>지금 처리 중</li>
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

i {
  width: var(--sp-5);
  height: var(--sp-3);
  border-radius: var(--r-1);
}

.done { background: var(--c-step-3); }
.now { background: var(--c-accent-tint); box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-accent); }
.stuck { background: var(--c-down); }
.fut { background: var(--c-surface-sunk); box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong); }
</style>
