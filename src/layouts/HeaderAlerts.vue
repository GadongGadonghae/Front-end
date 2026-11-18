<!-- 헤더 알림 아이콘: 진행 중 개수, 누르면 최근 알림 5건과 "전체 보기" (기능명세서 0.5, 화면정의서 공통) -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseIcon from '@/components/base/BaseIcon.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import PdmMark from '@/components/domain/PdmMark.vue'
import { useTodayAlerts } from '@/composables/useTodayAlerts'

const { rows, ongoingCount } = useTodayAlerts()
const recent = computed(() => rows.value.slice(0, 5))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const close = () => { open.value = false }
const onDoc = (e: MouseEvent) => { if (root.value && !root.value.contains(e.target as Node)) close() }
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
document.addEventListener('click', onDoc)
document.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="alerts">
    <button class="bell" type="button" :aria-expanded="open" :aria-label="`알림, 진행 중 ${ongoingCount}건`" @click="open = !open">
      <BaseIcon name="bell" />
      <span v-if="ongoingCount > 0" class="count">{{ ongoingCount }}</span>
    </button>
    <div v-if="open" class="pop" role="dialog" aria-label="최근 알림">
      <ul>
        <li v-for="a in recent" :key="a.id" :class="{ off: !a.ongoing }">
          <PdmMark v-if="a.kind === 'risk'" level="danger" :muted="!a.ongoing" />
          <StatusKey v-else :state="a.kind" size="sm" :muted="!a.ongoing" />
          <span class="what"><b>{{ a.title }}</b>{{ a.message }}</span>
          <span class="when">{{ a.time }}</span>
        </li>
        <li v-if="recent.length === 0" class="empty">데이터 없음</li>
      </ul>
      <RouterLink class="all" to="/alarms" @click="close">전체 보기</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.alerts {
  position: relative;
}

.bell {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--control-h);
  height: var(--control-h);
  border: 0;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink-2);
  cursor: pointer;
}

.bell:hover {
  background: var(--c-surface-sunk);
}

.count {
  position: absolute;
  top: var(--sp-1);
  right: 0;
  min-width: var(--badge-h);
  padding: 0 var(--sp-1);
  border-radius: calc(var(--badge-h) / 2);
  background: var(--c-down);
  color: var(--c-down-ink);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
  line-height: var(--badge-h);
  text-align: center;
}

.pop {
  position: absolute;
  top: calc(100% + var(--sp-2));
  right: 0;
  z-index: 10;
  width: var(--popover-w);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-3);
  background: var(--c-surface);
  box-shadow: var(--shadow-float);
}

ul {
  margin: 0;
  padding: var(--sp-2) 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-4);
  font-size: var(--fs-md);
}

.what {
  overflow: hidden;
  color: var(--c-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.what b {
  margin-right: var(--sp-2);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

/* 해제된 알림은 흐리게 */
li.off .what,
li.off .what b {
  color: var(--c-ink-3);
}

.when {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.empty {
  display: block;
  color: var(--c-ink-3);
  text-align: center;
}

.all {
  display: block;
  padding: var(--sp-3) var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
  font-size: var(--fs-md);
  text-align: center;
  text-decoration: none;
}

.all:hover {
  background: var(--c-surface-sunk);
}
</style>
