<!-- 알림 목록 (화면정의서 SCR-001 10번): 진행 중 위, 해제 흐리게. 진행 중 고장·위험은 옅은 빨강, 대기는 옅은 노랑 바탕 (DESIGN.md 이상 행 바탕)
     행을 누르면 open, 고장 건 보고서 버튼은 report -->
<script setup lang="ts">
import StatusKey from '@/components/domain/StatusKey.vue'
import PdmMark from '@/components/domain/PdmMark.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import type { AlertRowView } from '@/types/view'

defineProps<{ rows: AlertRowView[] }>()
const emit = defineEmits<{ open: [row: AlertRowView]; report: [row: AlertRowView] }>()

const tint = (r: AlertRowView) => (!r.ongoing ? 'off' : r.kind === 'D' || r.kind === 'risk' ? 't-down' : r.kind === 'I' ? 't-idle' : '')
</script>

<template>
  <ul v-if="rows.length" class="alerts">
    <li v-for="r in rows" :key="r.id" :class="tint(r)">
      <button class="hit" type="button" :aria-label="`${r.title} ${r.message}`" @click="emit('open', r)"></button>
      <span class="key">
        <PdmMark v-if="r.kind === 'risk'" level="danger" :muted="!r.ongoing" />
        <StatusKey v-else :state="r.kind" :muted="!r.ongoing" />
      </span>
      <span class="main">
        <b class="title">{{ r.title }}</b>
        <span class="msg">{{ r.message }}</span>
        <BaseButton v-if="r.report" class="report" size="sm" @click.stop="emit('report', r)">보고서 {{ r.report === 'view' ? '보기' : '만들기' }}</BaseButton>
      </span>
      <span class="meta"><span>{{ r.time }}</span><b>{{ r.duration }}</b></span>
    </li>
  </ul>
  <BaseEmpty v-else />
</template>

<style scoped>
.alerts {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

li {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-top: var(--line-w) solid var(--c-line);
}

/* 행 전체를 누르는 영역 (버튼은 그 위에) */
.hit {
  position: absolute;
  inset: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

/* 바탕색(이상 행)을 덮지 않게 옅은 겹침으로 */
.hit:hover {
  background: var(--c-line);
}

.key,
.main,
.meta {
  position: relative;
  pointer-events: none;
}

.key {
  display: grid;
  justify-items: start;
  min-width: var(--sp-8);
}

.main {
  display: grid;
  justify-items: start;
  gap: calc(var(--sp-1) / 2);
  min-width: 0;
}

.title {
  font-weight: var(--fw-strong);
}

.msg {
  max-width: 100%;
  overflow: hidden;
  color: var(--c-ink-2);
  font-size: var(--fs-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report {
  margin-top: var(--sp-2);
  pointer-events: auto;
}

.meta {
  display: grid;
  justify-items: end;
  color: var(--c-ink-3);
  font-size: var(--fs-label);
}

.meta b {
  color: var(--c-ink-3);
  font-weight: var(--fw-regular);
}

/* 진행 중 이상만 바탕 */
.t-down { background: var(--c-down-tint); }
.t-idle { background: var(--c-idle-tint); }

li:not(.off) .meta b {
  color: var(--c-ink);
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-strong);
}

.off { background: var(--c-surface-sunk); }

.off .title,
.off .msg {
  color: var(--c-ink-3);
}
</style>
