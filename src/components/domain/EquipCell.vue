<!-- 설비 칸: 칸 전체를 상태 색으로 칠한다 (DESIGN.md Components "설비 칸")
     작게(배치도, SCR-001 1번): 이름 · 상태 코드·명칭 · 고장이면 지속시간 · 예지보전 비율
     크게(라인 흐름, SCR-010 3번): 이름 → 고장·대기면 비가동 코드와 사유 → 오늘 사이클·평균 CT → 코드·명칭·지속시간
     칸이 좁으면 명칭을 숨기고 코드 글자는 남긴다 (색만으로 말하지 않기) -->
<script setup lang="ts">
import { computed } from 'vue'
import { STATE_NAME } from '@/lib/status'
import type { EquipCellView, FlowCellView } from '@/types/view'

const props = defineProps<{ cell: EquipCellView | FlowCellView }>()
const large = computed(() => ('info' in props.cell ? props.cell : null))
</script>

<template>
  <div class="cell" :class="[`st-${cell.state}`, cell.pdm ? `pdm-${cell.pdm.level}` : '', { large }]">
    <div v-if="large" class="in lg">
      <div class="top">
        <span class="name">{{ large.name }}</span>
        <span v-if="large.pdm" class="pdm">{{ large.pdm.text }}</span>
      </div>
      <p v-if="large.reason" class="why"><b>{{ large.reason.code }}</b><span v-if="large.reason.detail">{{ large.reason.detail }}</span></p>
      <p v-if="large.note" class="note">{{ large.note }}</p>
      <dl v-if="large.info.length" class="info">
        <template v-for="i in large.info" :key="i.label"><dt>{{ i.label }}</dt><dd>{{ i.value }}</dd></template>
      </dl>
      <div class="foot">
        <span class="code">{{ large.state }}</span>
        <span class="word">{{ STATE_NAME[large.state] }}</span>
        <span class="dur">{{ large.duration }}</span>
      </div>
    </div>

    <div v-else class="in">
      <div class="top">
        <span class="name">{{ cell.name }}</span>
        <span v-if="cell.pdm" class="pdm">{{ cell.pdm.text }}</span>
      </div>
      <div class="row">
        <span class="code">{{ cell.state }}</span>
        <span class="word">{{ STATE_NAME[cell.state] }}</span>
        <span v-if="cell.duration" class="dur">{{ cell.duration }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cell {
  container-type: size;
  min-width: 0;
  height: 100%;
  padding: var(--sp-2);
  border-radius: var(--r-2);
}

.in {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.top,
.row {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
}

.name {
  overflow: hidden;
  font-size: var(--fs-label);
  font-weight: var(--fw-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdm {
  margin-left: auto;
  font-size: var(--fs-caption);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.code {
  font-size: var(--fs-heading);
  font-weight: var(--fw-code);
  line-height: 1;
}

.word {
  font-size: var(--fs-label);
}

.dur {
  margin-left: auto;
  font-size: var(--fs-label);
  font-weight: var(--fw-strong);
}

/* ── 큰 칸 (라인 흐름) ── */
.cell.large {
  padding: var(--sp-3) var(--sp-4);
}

.lg {
  justify-content: flex-start;
  gap: var(--sp-2);
}

.lg .name {
  font-size: var(--fs-body-lg);
}

.why {
  font-size: var(--fs-label);
  line-height: var(--lh-body);
}

.why b {
  display: block;
  font-size: var(--fs-body);
  font-weight: var(--fw-strong);
}

.note {
  font-size: var(--fs-label);
}

.info {
  display: grid;
  grid-template-columns: auto 1fr;
  align-content: start;
  gap: var(--sp-1) var(--sp-3);
  font-size: var(--fs-label);
  white-space: nowrap;
}

.info dd {
  margin: 0;
  font-weight: var(--fw-strong);
  text-align: right;
}

.foot {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-top: auto;
  white-space: nowrap;
}

.lg .code {
  font-size: var(--fs-figure-sm);
}

.lg .word {
  font-size: var(--fs-body);
}

.lg .dur {
  font-size: var(--fs-body);
}

/* 좁은 칸: 명칭 숨김 */
@container (max-width: 96px) {
  .word { display: none; }
}

/* 낮은 칸: 이름과 상태를 한 줄로 */
@container (max-height: 40px) {
  .in { flex-direction: row; align-items: center; gap: var(--sp-1); }
  .row { margin-left: auto; flex: none; }
  .word { display: none; }
  .code { font-size: var(--fs-body); }

  /* 비율 글자는 숨기고 바깥 테두리로만 예지보전을 알린다 (비율은 알림 열·예지보전 화면) */
  .pdm { display: none; }
}

/* 좁은 큰 칸 (1280~1440 창의 프레스 단): 숫자 이름표를 위, 값을 아래로 쌓고 명칭을 숨긴다 */
@container (max-width: 136px) {
  .info { grid-template-columns: 1fr; gap: 0; }
  .info dd { margin-bottom: var(--sp-1); text-align: left; }
  .lg .word { display: none; }
}

/* 낮은 큰 칸: 사유 상세·메모·두 번째 숫자(평균 CT)를 숨기고 간격을 줄인다. 숨긴 값은 공정 상세에 있다 */
@container (max-height: 176px) {
  .why span,
  .note,
  .info dt:nth-of-type(n + 2),
  .info dd:nth-of-type(n + 2) { display: none; }
  .lg { gap: var(--sp-1); }
  .info { gap: 0 var(--sp-3); }
  .lg .code { font-size: var(--fs-heading); }
}
</style>
