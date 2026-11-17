<!-- 선 그래프 범례: 실선(주 계열, 강조 파랑) · 점선(목표·계획·기준) · 가는 선(보조 계열) · 띠(미세정지 후보 등 구간) -->
<script setup lang="ts">
defineProps<{ items: { label: string; kind: 'main' | 'ref' | 'thin' | 'band' | 'warn' | 'danger' }[] }>()
</script>

<template>
  <ul class="legend">
    <li v-for="i in items" :key="i.label"><i :class="i.kind"></i>{{ i.label }}</li>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  gap: var(--sp-4);
  margin: 0;
  padding: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-label);
  list-style: none;
}

li {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}

i {
  width: var(--sp-4);
  border-top: var(--chart-stroke) solid var(--c-accent);
}

i.ref {
  border-top: var(--line-w-strong) dashed var(--c-ink-3);
}

/* 예지보전 80%·90% 옅은 선 (ChartLine의 warn·danger와 같은 색) */
i.warn {
  border-top: var(--line-w-strong) solid var(--c-idle-edge);
}

i.danger {
  border-top: var(--line-w-strong) solid var(--c-down);
}

i.thin {
  border-top: var(--chart-stroke-thin) solid var(--c-ink-2);
}

i.band {
  height: var(--sp-3);
  border-top: 0;
  background: var(--c-idle-tint);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-idle-edge);
}
</style>
