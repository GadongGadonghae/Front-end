<!-- 가운데 뚫린 도넛: 몫 나누기 (비가동 코드별 시간, 생산 결과). 가운데 글은 슬롯.
     색만으로 말하지 않게 조각마다 title을 달고, 옆 목록(부르는 쪽)에 같은 색 열쇠와 값을 쓴다. hatch = 빗금 조각 (계획정지) -->
<script setup lang="ts">
import { computed, useId } from 'vue'

export interface DonutSlice { key: string; value: number; color: string; hatch?: boolean; title: string }

const props = defineProps<{ slices: DonutSlice[]; label: string }>()
const uid = useId()
const R = 15.9155 // 둘레 100
const GAP = 0.5

const arcs = computed(() => {
  const list = props.slices.filter((s) => s.value > 0)
  const total = list.reduce((a, s) => a + s.value, 0)
  let at = 0
  return list.map((s, i) => {
    const len = (s.value / total) * 100
    const arc = { ...s, pid: `${uid}-h${i}`, dash: `${Math.max(0.3, len - GAP)} ${100 - Math.max(0.3, len - GAP)}`, offset: -at }
    at += len
    return arc
  })
})
</script>

<template>
  <div class="donut" role="img" :aria-label="label">
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <defs>
        <template v-for="a in arcs" :key="a.pid">
          <pattern v-if="a.hatch" :id="a.pid" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="2" class="hatch-bg" />
            <rect width="1" height="2" :style="{ fill: a.color }" />
          </pattern>
        </template>
      </defs>
      <circle class="ring" :r="R" cx="21" cy="21" />
      <circle
        v-for="a in arcs"
        :key="a.key"
        class="arc"
        :r="R"
        cx="21"
        cy="21"
        :stroke-dasharray="a.dash"
        :stroke-dashoffset="a.offset"
        :style="{ stroke: a.hatch ? `url(#${a.pid})` : a.color }"
      ><title>{{ a.title }}</title></circle>
    </svg>
    <div class="mid"><slot /></div>
  </div>
</template>

<style scoped>
.donut {
  position: relative;
  flex: none;
  width: var(--donut-size);
  height: var(--donut-size);
  margin: 0 auto;
}

svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring,
.arc {
  fill: none;
  stroke-width: 5;
}

.ring {
  stroke: var(--c-track);
}

.hatch-bg {
  fill: var(--c-stop);
}

.mid {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
</style>
