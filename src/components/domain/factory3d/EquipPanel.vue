<!-- 3D 공장: 고른 설비 팝업 (D-118). 3D 화면 왼쪽에 붙는다 (설비는 카메라가 화면 가운데로 데려온다)
     머리 = 상태 열쇠 칸 + 명칭, 이상 상태면 그 상태의 옅은 바탕. 설비 ID를 크게, 고장(D)·통신 끊김(DC)이면 지속 시간·발생 시점을 숫자 두 칸으로
     닫기: × · Esc · 팝업 밖을 누름 (Factory3D가 처리) -->
<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import { DOWNTIME_NAME, PROCESS_NAME, showsSince } from '@/lib/status'
import { formatDuration, formatNumber, formatTime } from '@/lib/format'
import type { Equipment } from '@/types/plant'
import type { EquipmentLive } from '@/types/live'

const props = defineProps<{
  e: Equipment
  l: EquipmentLive
  /** 지금 상태가 이어진 초 */
  sec: number
  lineName: string
  /** 이상 상태 (고장 · 통신 끊김 · 원인 코드가 있는 대기): 버튼을 보인다 */
  abnormal: boolean
  /** 아직 확인하지 않은 이상: [확인] 버튼 */
  issue: boolean
  /** 비전 검사: 오늘 합격 · 불량 (그 밖 설비는 없음) */
  vision?: { ok: number; ng: number } | null
}>()
const emit = defineEmits<{ close: []; ack: []; goLine: []; goAction: [] }>()

const isVision = computed(() => props.e.process === 'INSPECTION')
const tone = computed(() => (props.l.state === 'D' ? 'down' : props.l.state === 'I' ? 'idle' : props.l.state === 'DC' ? 'dc' : null))
/** 원인: 원인 코드 이름 + 내용 한 줄 (11/21). 고장이면 "고장 원인" */
const cause = computed(() => {
  const name = props.l.code ? DOWNTIME_NAME[props.l.code] : null
  const detail = props.l.detail && props.l.detail !== name ? props.l.detail : null
  const parts = [name, detail].filter((x): x is string => !!x)
  return parts.length ? parts.join(' · ') : null
})
const causeLabel = computed(() => (props.l.state === 'D' ? '고장 원인' : props.l.state === 'DC' ? '끊긴 원인' : '대기 원인'))
</script>

<template>
  <section class="pop" :class="tone && `t-${tone}`" role="dialog" :aria-label="`${e.id} 설비 상태`">
    <header class="head">
      <StatusKey :state="l.state" :label="true" />
      <button type="button" class="x" aria-label="닫기 (Esc)" title="닫기 (Esc)" @click="emit('close')"><BaseIcon name="x" /></button>
    </header>

    <div class="who">
      <h3 class="id">{{ e.id }}</h3>
      <p class="where">{{ PROCESS_NAME[e.process] }} · {{ lineName }}</p>
    </div>

    <!-- 발생 시점 · 지속 시간은 고장(D) · 통신 끊김(DC)만 (11/22) -->
    <dl v-if="showsSince(l.state)" class="nums">
      <div><dt>발생 시점</dt><dd class="num">{{ formatTime(l.since) }}</dd></div>
      <div><dt>지속 시간</dt><dd class="num">{{ formatDuration(sec) }}</dd></div>
    </dl>

    <dl v-if="vision" class="nums">
      <div><dt>오늘 합격</dt><dd class="num">{{ formatNumber(vision.ok) }}</dd></div>
      <div><dt>오늘 불량</dt><dd class="num">{{ formatNumber(vision.ng) }}</dd></div>
    </dl>

    <dl v-if="abnormal" class="facts">
      <div>
        <dt>{{ causeLabel }}</dt>
        <dd class="cause">{{ cause ?? '원인 미입력' }}</dd>
        <dd v-if="l.code" class="code">코드 {{ l.code }}</dd>
      </div>
    </dl>

    <!-- 이상 없는 설비(가동·계획 정지 등)는 할 일이 없어 버튼을 두지 않는다. 비전 검사는 상세 보기만 -->
    <footer v-if="abnormal || isVision" class="acts">
      <BaseButton v-if="issue" @click="emit('ack')">확인</BaseButton>
      <BaseButton @click="emit('goLine')">{{ isVision ? '상세 보기' : '라인 가기' }}</BaseButton>
      <BaseButton v-if="abnormal" variant="primary" @click="emit('goAction')">조치 가기</BaseButton>
    </footer>
  </section>
</template>

<style scoped>
.pop {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-3);
  background: var(--c-surface);
  color: var(--c-ink);
  animation: pop-in var(--dur-enter) var(--ease-out);
}

@keyframes pop-in {
  from { opacity: 0; transform: translateX(calc(var(--sp-3) * -1)); }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
  border-bottom: var(--line-w) solid var(--c-line);
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

/* 이상 상태: 머리만 그 상태의 옅은 바탕 (알람 이력 진행 중 행과 같은 바탕) */
.t-down .head { background: var(--c-down-tint); }
.t-idle .head { background: var(--c-idle-tint); }
.t-dc .head { background: var(--c-dc-tint); }

.x {
  display: inline-grid;
  place-items: center;
  width: var(--control-h-sm);
  height: var(--control-h-sm);
  border: 0;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink-2);
  cursor: pointer;
}

.x:hover { background: var(--c-surface-sunk); color: var(--c-ink); }

.who {
  padding: var(--sp-4);
}

.id {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.where {
  margin-top: var(--sp-1);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.nums {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  margin: 0;
  padding: 0 var(--sp-4) var(--sp-4);
}

.nums dt,
.facts dt {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.nums dd {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
  font-variant-numeric: tabular-nums;
}

.facts {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: var(--sp-4);
  border-top: var(--line-w) solid var(--c-line);
}

.facts dd {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-md);
  line-height: var(--lh-body);
}

.facts .cause {
  font-size: var(--fs-row);
  font-weight: var(--fw-strong);
}

.facts .code {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.acts {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: var(--sp-2);
  padding: 0 var(--sp-4) var(--sp-4);
}
</style>
