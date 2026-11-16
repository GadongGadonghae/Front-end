<!-- 자리표시 페이지: 화면을 만들기 전까지 라우트가 열리는지와 데이터 층이 1초마다 도는지만 보여 준다. 화면이 생기면 라우트에서 뺀다 -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { useLiveSnapshot } from '@/composables/useLiveSnapshot'
import { countByState } from '@/lib/status'
import type { StateCode } from '@/types/state'

const route = useRoute()
const snapshot = useLiveSnapshot()
const counts = computed(() => (snapshot.value ? countByState(snapshot.value.equipment.map((e) => e.state)) : null))
const order: StateCode[] = ['R', 'S', 'I', 'D']
</script>

<template>
  <PageLayout>
    <template #head>
      <h1>{{ route.meta.title }}</h1>
      <span class="id">{{ route.meta.screen }}</span>
    </template>
    <template #head-right>
      <span v-if="counts" class="counts">
        <span v-for="s in order" :key="s" class="count"><StatusKey :state="s" label />{{ counts[s] }}</span>
      </span>
    </template>
    <div class="empty">아직 만들지 않은 화면입니다 (FRONTEND.md 8장 순서대로 만듭니다)</div>
  </PageLayout>
</template>

<style scoped>
h1 {
  font-size: var(--fs-heading);
  font-weight: var(--fw-strong);
}

.id {
  color: var(--c-ink-3);
  font-size: var(--fs-body);
}

.counts {
  display: flex;
  gap: var(--sp-5);
}

.count {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-title);
  font-weight: var(--fw-strong);
}

.empty {
  display: grid;
  place-items: center;
  height: 100%;
  border: var(--line-w) dashed var(--c-line-strong);
  border-radius: var(--r-3);
  color: var(--c-ink-3);
}
</style>
