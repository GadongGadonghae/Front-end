<!-- 설비 칸 (배치도): 칸 전체를 상태 색으로 칠하고, 이름 · 상태 코드·명칭 · 고장이면 지속시간 · 예지보전 비율 (화면정의서 SCR-001 1번)
     칸이 좁으면 명칭을 숨기고 코드 글자는 남긴다 (색만으로 말하지 않기) -->
<script setup lang="ts">
import { STATE_NAME } from '@/lib/status'
import type { EquipCellView } from '@/types/view'

defineProps<{ cell: EquipCellView }>()
</script>

<template>
  <div class="cell" :class="[`st-${cell.state}`, cell.pdm ? `pdm-${cell.pdm.level}` : '']">
    <div class="in">
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

/* 좁은 칸: 명칭 숨김 */
@container (max-width: 96px) {
  .word { display: none; }
}

/* 낮은 칸: 이름과 상태를 한 줄로 */
@container (max-height: 36px) {
  .in { flex-direction: row; align-items: center; gap: var(--sp-1); }
  .row { margin-left: auto; flex: none; }
  .word { display: none; }
  .code { font-size: var(--fs-body); }

  /* 비율 글자는 숨기고 바깥 테두리로만 예지보전을 알린다 (비율은 알림 열·예지보전 화면) */
  .pdm { display: none; }
}
</style>
