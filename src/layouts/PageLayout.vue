<!-- 화면 틀: 모든 화면이 같은 높이의 제목 줄(--head-h) + 본문을 쓴다 (DESIGN.md Layout, FRONTEND.md 3.5)
     head: 제목·이동 경로·탭·필터, head-right: 기준 시각·보조 숫자 -->
<template>
  <div class="page">
    <div class="head">
      <div class="head-left"><slot name="head" /></div>
      <div v-if="$slots['head-right']" class="head-right"><slot name="head-right" /></div>
    </div>
    <div class="body"><slot /></div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-rows: var(--head-h) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
  min-width: 0;
}

.head-left {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
  min-width: 0;
}

.head-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-6);
}

.body {
  min-height: 0;
}
</style>
