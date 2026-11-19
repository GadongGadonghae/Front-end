<!-- 24시간 띠 범례 (StateBand와 같은 칠): 가동은 옅은 중립, 손실만 색, 계획정지 빗금 -->
<template>
  <ul class="legend" aria-label="범례">
    <li><i class="s-R"></i>가동</li>
    <li><i class="s-I"></i>대기</li>
    <li><i class="s-D"></i>고장</li>
    <li><i class="s-DC"></i>통신 끊김</li>
    <li><i class="s-S"></i>계획정지 (가동률에서 뺌)</li>
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

.s-R { background: var(--c-run-quiet); }
.s-S { background: repeating-linear-gradient(135deg, var(--c-stop) 0 3px, var(--c-stop-hatch) 3px 5px); }
.s-I { background: var(--c-idle); box-shadow: inset 0 0 0 var(--line-w) var(--c-idle-edge); }
.s-D { background: var(--c-down); }
.s-DC { background: var(--c-dc); }
</style>
