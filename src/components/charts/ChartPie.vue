<!-- 파이: 전체 중 종류별 몫 (예: 오늘 불량 제외의 공정별 수). 조각 색은 --c-cat-1~4 (상태 색과 겹치지 않는 파랑 진하기)
     색만으로 말하지 않게 옆 목록에 같은 색 칸 + 이름 + 개수를 함께 쓴다 (부르는 쪽). 합이 0이면 빈 원 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  slices: { key: string; label: string; value: number }[]
}>()

const R = 50
const total = computed(() => props.slices.reduce((a, s) => a + s.value, 0))
const pt = (a: number) => `${R + R * Math.sin(a)} ${R - R * Math.cos(a)}`

/** 12시 방향부터 시계 방향으로 조각 경로 */
const paths = computed(() => {
  let a = 0
  return props.slices.map((s, i) => {
    const sweep = total.value ? (s.value / total.value) * Math.PI * 2 : 0
    const from = a
    a += sweep
    const d = sweep >= Math.PI * 2 - 1e-6
      ? `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z`
      : `M ${R} ${R} L ${pt(from)} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${pt(a)} Z`
    return { key: s.key, d, cat: `cat-${(i % 4) + 1}`, title: `${s.label} ${s.value}`, show: s.value > 0 }
  })
})
const aria = computed(() => (total.value ? `${props.label}: ${props.slices.map((s) => `${s.label} ${s.value}`).join(', ')}` : `${props.label}: 없음`))
</script>

<template>
  <svg class="pie" viewBox="0 0 100 100" role="img" :aria-label="aria">
    <circle v-if="!total" class="empty" cx="50" cy="50" r="49" />
    <template v-for="p in paths" :key="p.key">
      <path v-if="p.show" :class="['slice', p.cat]" :d="p.d"><title>{{ p.title }}</title></path>
    </template>
  </svg>
</template>

<style scoped>
.pie {
  display: block;
  flex: none;
  width: var(--pie-size);
  height: var(--pie-size);
}

.slice {
  stroke: var(--c-surface);
  stroke-width: var(--line-w-strong);
  stroke-linejoin: round;
}

.cat-1 { fill: var(--c-cat-1); }
.cat-2 { fill: var(--c-cat-2); }
.cat-3 { fill: var(--c-cat-3); }
.cat-4 { fill: var(--c-cat-4); }

.empty {
  fill: var(--c-track);
}
</style>
