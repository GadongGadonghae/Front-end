<!-- 켜고 끄는 스위치 (role=switch): 이름 + 작은 레일. 켜짐 = 먹색 레일 · 흰 손잡이 오른쪽, 꺼짐 = 옅은 레일 · 손잡이 왼쪽 -->
<script setup lang="ts">
defineProps<{ label: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <button type="button" role="switch" class="tg" :class="{ on: model }" :aria-checked="model" @click="model = !model">
    <span class="lb"><slot>{{ label }}</slot></span>
    <span class="rail" aria-hidden="true"><i></i></span>
  </button>
</template>

<style scoped>
.tg {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
  height: var(--control-h);
  padding: 0 var(--sp-3) 0 var(--sp-4);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-2);
  background: var(--c-surface);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  white-space: nowrap;
  cursor: pointer;
}

.tg:hover {
  background: var(--c-surface-sunk);
}

.tg.on {
  border-color: var(--c-ink);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.rail {
  position: relative;
  width: var(--sp-8);
  height: var(--sp-4);
  border-radius: var(--sp-2);
  background: var(--c-track);
  box-shadow: inset 0 0 0 var(--line-w) var(--c-line-strong);
}

.rail i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: var(--sp-3);
  height: var(--sp-3);
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: 0 0 0 var(--line-w) var(--c-line-strong);
  transition: transform var(--dur-fast) var(--ease-out);
}

.on .rail {
  background: var(--c-inverse);
  box-shadow: none;
}

.on .rail i {
  box-shadow: none;
  transform: translateX(var(--sp-4));
}
</style>
