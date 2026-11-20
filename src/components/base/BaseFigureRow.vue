<!-- 제목 줄 오른쪽 요약 숫자 묶음 (DESIGN.md Layout "공정 상세": 요약 숫자는 제목 줄 오른쪽). 항목 사이는 세로 가는 선 -->
<template>
  <div class="frow"><slot /></div>
</template>

<style scoped>
.frow {
  display: flex;
  align-items: flex-end;
}

.frow > :slotted(*) {
  padding: 0 var(--sp-6);
  border-left: var(--line-w) solid var(--c-line-strong);
}

.frow > :slotted(:first-child) {
  padding-left: 0;
  border-left: 0;
}

.frow > :slotted(:last-child) {
  padding-right: 0;
}

@media (width <= 1600px) {
  .frow > :slotted(*) {
    padding: 0 var(--sp-4);
  }
}
</style>
