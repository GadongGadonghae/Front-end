<!-- 구간 버튼: 주소를 바꾸지 않는 한 가지 선택 (일/주/월, 1시간/8시간/오늘, 관리값 항목, 2D/3D)
     variant soft = 패널 안 탭·정렬: 회색 바탕에 고른 것만 흰 면 (먹색으로 채우는 기본형은 화면 위 기간 같은 큰 선택에만) -->
<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{ options: { value: T; label: string; /** 고장 설비 칸은 빨갛게 (11/22) */ tone?: 'down'; /** 화면 낭독기 이름 (색으로만 알리는 칸) */ aria?: string }[]; label: string; size?: 'md' | 'sm'; variant?: 'solid' | 'soft' }>(), { size: 'md', variant: 'solid' })
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="seg" :class="[size, variant]" role="group" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :class="[{ on: o.value === model }, o.tone]"
      :aria-label="o.aria"
      :title="o.aria"
      :aria-pressed="o.value === model"
      @click="model = o.value"
    >{{ o.label }}</button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  overflow: hidden;
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
}

button {
  height: var(--control-h);
  padding: 0 var(--sp-3);
  border: 0;
  border-left: var(--line-w) solid var(--c-line);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  white-space: nowrap;
  cursor: pointer;
}

button:first-child {
  border-left: 0;
}

button:hover {
  background: var(--c-surface-sunk);
}

button.on {
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

/* 고장 설비: 빨간 칸. 고른 칸은 먹색 안쪽 테두리로 구분 */
button.down {
  background: var(--c-down);
  color: var(--c-down-ink);
  font-weight: var(--fw-strong);
}

button.down:hover { filter: brightness(1.08); }
button.down.on { box-shadow: inset 0 0 0 3px var(--c-inverse); }

.sm button {
  height: var(--control-h-sm);
  font-size: var(--fs-sm);
}

.soft {
  gap: 2px;
  padding: 2px;
  border: 0;
  background: var(--c-track);
}

.soft button {
  border-left: 0;
  border-radius: var(--r-1);
  background: none;
}

.soft button:hover {
  background: color-mix(in srgb, var(--c-surface) 60%, transparent);
}

.soft button.on {
  background: var(--c-surface);
  box-shadow: 0 0 0 var(--line-w) var(--c-line-strong);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.soft.sm button {
  height: calc(var(--control-h-sm) - 4px);
}
</style>
