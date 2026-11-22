<!-- 패널: 흰 표면 + 가는 테두리, 제목 줄(제목 · 흐린 메타 · 오른쪽 도구). 그림자 없음 (DESIGN.md Elevation)
     flush: 본문에 안쪽 여백 없음 (목록이 패널 가장자리까지 갈 때) -->
<script setup lang="ts">
withDefaults(defineProps<{ title?: string; meta?: string; flush?: boolean }>(), { flush: false })
</script>

<template>
  <section class="panel" :class="{ flush }">
    <header v-if="title || $slots.tools || $slots.head" class="ph">
      <slot name="head">
        <h2>{{ title }}</h2>
        <span v-if="meta" class="meta">{{ meta }}</span>
      </slot>
      <div v-if="$slots.tools" class="tools"><slot name="tools" /></div>
    </header>
    <div class="pb"><slot /></div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-3);
  background: var(--c-surface);
}

.ph {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--control-h-sm);
  margin-bottom: var(--sp-4);
}

h2 {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.meta {
  overflow: hidden;
  color: var(--c-ink-3);
  font-size: var(--fs-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-left: auto;

  /* 단추·범례 글이 두 줄로 쪼개지지 않게 (제목 옆 흐린 글이 먼저 줄어든다) */
  white-space: nowrap;
}

.pb {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.flush {
  padding: 0;
}

.flush .ph {
  margin-bottom: 0;
  padding: var(--sp-5) var(--sp-5) var(--sp-3);
}
</style>
