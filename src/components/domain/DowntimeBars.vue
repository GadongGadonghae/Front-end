<!-- 비가동 코드별 (D-108, D-113): 위에 합계 한 줄, 아래 코드마다 "상태 열쇠 · 이름 · 시간·건수" + 가는 막대(가장 긴 코드 대비).
     도넛 대신 순위 막대: 값이 비슷한 코드 여럿을 비교하기에 도넛은 맞지 않는다 (dataviz). 막대 색은 상태 색 하나씩(고장 빨강 · 대기 노랑 · 계획정지 회색),
     상태 열쇠 칸(글자)이 있어 색만으로 말하지 않는다. 계획정지는 가동률에서 빼므로 이름을 흐리게 -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { formatSpan } from '@/lib/format'
import type { DowntimeSliceView } from '@/types/view'

const props = defineProps<{ rows: DowntimeSliceView[] }>()

const sorted = computed(() => [...props.rows].sort((a, b) => b.sec - a.sec))
const total = computed(() => props.rows.reduce((a, r) => a + r.sec, 0))
const count = computed(() => props.rows.reduce((a, r) => a + r.count, 0))
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.sec)))
</script>

<template>
  <div class="db">
    <template v-if="total > 0">
      <p class="sum"><b>{{ formatSpan(total) }}</b><span>비가동 {{ count }}건</span></p>
      <ul class="codes" :aria-label="`비가동 코드별 시간, 합계 ${formatSpan(total)}`">
        <li v-for="r in sorted" :key="r.key" :class="{ planned: r.state === 'S' }">
          <StatusKey :state="r.state" size="sm" />
          <span class="lb" :title="r.label">{{ r.label }}</span>
          <b class="v">{{ formatSpan(r.sec) }}<small>{{ r.count }}건</small></b>
          <span class="bar" aria-hidden="true"><i :class="`f-${r.state}`" :style="{ width: `${(r.sec / max) * 100}%` }"></i></span>
        </li>
      </ul>
    </template>
    <BaseEmpty v-else text="비가동 없음" />
  </div>
</template>

<style scoped>
.db {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--sp-3);
  min-height: 0;
}

.sum {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0;
}

.sum b {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.sum span {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.codes {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

/* 한 코드 = 윗줄(열쇠 · 이름 · 값) + 아랫줄(막대, 이름 칸부터) */
li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--sp-1) var(--sp-2);
  align-items: center;
  padding: var(--sp-2) 0;
  border-top: var(--line-w) solid var(--c-line);
  font-size: var(--fs-md);
}

li:first-child {
  border-top: 0;
}

.lb {
  overflow: hidden;
  color: var(--c-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.v {
  font-weight: var(--fw-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.v small {
  margin-left: var(--sp-2);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.bar {
  grid-column: 2 / -1;
  height: var(--sp-1);
  border-radius: var(--r-1);
  background: var(--c-track);
}

.bar i {
  display: block;
  height: 100%;
  border-radius: var(--r-1);
}

.f-D { background: var(--c-down); }
.f-I { background: var(--c-idle); }
.f-S { background: var(--c-stop-solid); }

/* 계획정지: 가동률에서 빼므로 흐리게 */
.planned .lb,
.planned .v {
  color: var(--c-ink-2);
}
</style>
