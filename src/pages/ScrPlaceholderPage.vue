<!-- 자리표시 페이지: 화면을 만들기 전까지 라우트가 열리는지와 데이터 층이 1초마다 도는지만 보여 준다. 화면이 생기면 라우트에서 뺀다 -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { countByState, STATE_NAME } from '@/lib/status'
import { formatTime } from '@/lib/format'
import type { StateCode } from '@/types/state'

const route = useRoute()
const snapshot = useLiveSnapshot()
const counts = computed(() => (snapshot.value ? countByState(snapshot.value.equipment.map((e) => e.state)) : null))
const order: StateCode[] = ['R', 'S', 'I', 'D']
</script>

<template>
  <main class="placeholder">
    <p class="id">{{ route.meta.screen }}</p>
    <h1>{{ route.meta.title }}</h1>
    <p class="note">아직 만들지 않은 화면입니다 (FRONTEND.md 8장 순서대로 만듭니다)</p>
    <p v-if="snapshot && counts" class="live">
      데모 데이터 {{ formatTime(snapshot.at) }} ·
      <span v-for="s in order" :key="s">{{ STATE_NAME[s] }} {{ counts[s] }}&nbsp;</span>
    </p>
  </main>
</template>

<style scoped>
.placeholder {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-8) var(--page-gutter);
}

.id,
.note,
.live {
  color: var(--c-ink-3);
  font-size: var(--fs-body);
}

h1 {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
}
</style>
