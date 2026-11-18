<!-- 인버터 상태 (SCR-002-2 4번, D-43): 실설비 슬리터(LS iG5A)만. 운전 상태 · 최근 트립 · 지령/출력 주파수 · RPM
     세 덩어리를 가로로 놓는다 (이름표 위, 값 아래): 넓은 칸을 쓰고 높이를 아낀다 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { InverterStatus } from '@/types/process'
import { formatDate, formatDuration, formatNumber, formatTime } from '@/lib/format'

const props = defineProps<{ status: InverterStatus }>()
const run = computed(() => (props.status.running ? (props.status.direction === 'reverse' ? '역방향 운전' : '정방향 운전') : '정지'))
</script>

<template>
  <dl class="kv">
    <div>
      <dt>운전 상태</dt>
      <dd>{{ run }}</dd>
    </div>
    <div>
      <dt>지령 / 출력</dt>
      <dd>{{ formatNumber(status.commandHz, 2) }} Hz / {{ formatNumber(status.outputHz, 2) }} Hz<span class="sub">RPM {{ formatNumber(status.rpm) }}</span></dd>
    </div>
    <div>
      <dt>최근 트립</dt>
      <dd v-if="status.lastTrip">
        {{ status.lastTrip.name }}
        <span class="sub">{{ formatDate(status.lastTrip.at) }} {{ formatTime(status.lastTrip.at) }} · {{ formatDuration(status.lastTrip.recoveredAfterSec) }} 뒤 복귀</span>
      </dd>
      <dd v-else>-</dd>
    </div>
  </dl>
</template>

<style scoped>
.kv {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-content: start;
  gap: var(--sp-3) var(--sp-8);
  font-size: var(--fs-md);
}

dt {
  margin-bottom: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

dd {
  margin: 0;
  font-weight: var(--fw-strong);
}

.sub {
  display: block;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}
</style>
