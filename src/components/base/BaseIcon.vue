<!-- 인라인 SVG 아이콘. 한 가지 선 굵기, 글자색을 따른다 (FRONTEND.md 1장). 경로 데이터는 Lucide(ISC 라이선스)에서 가져옴 -->
<script setup lang="ts">
export type IconName = 'factory' | 'bell' | 'user' | 'log-out' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'x' | 'check'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

const PATHS: Record<IconName, string[]> = {
  factory: ['M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M17 18h1', 'M12 18h1', 'M7 18h1'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  user: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M15 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  check: ['M20 6 9 17l-5-5'],
}
</script>

<template>
  <svg
    class="icon"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="d in PATHS[props.name]" :key="d" :d="d" />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}
</style>
