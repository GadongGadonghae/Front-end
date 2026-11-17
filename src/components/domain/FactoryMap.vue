<!-- 공장 배치도 (화면정의서 SCR-001 1~5번, D-81): 설비 하나 = 칸 하나, 모눈 위에 왼쪽에서 오른쪽으로
     입고 1칸 → 6갈래 → 라인 L1~L6 (슬리팅 1 · 프레스 4 · 용접 1) → 도장 2칸으로 합류 → 비전 1칸(출고)
     라인 줄·도장 칸 → 라인 상세, 입고 칸 → 입고 상세, 비전 칸 → 출고 상세 (이벤트로 알림, 이동은 화면이 함) -->
<script setup lang="ts">
import EquipCell from '@/components/domain/EquipCell.vue'
import { formatNumber } from '@/lib/format'
import type { LineId } from '@/types/plant'
import type { FactoryMapView } from '@/types/view'

defineProps<{ view: FactoryMapView }>()
const emit = defineEmits<{ openLine: [id: LineId]; openInbound: []; openOutbound: [] }>()

const onKey = (e: KeyboardEvent, go: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() }
}
</script>

<template>
  <div class="map">
    <div class="cols head" aria-hidden="true">
      <span>입고</span><span></span>
      <span class="lhead"><span>라인</span><span>슬리팅</span><span>프레스</span><span>용접</span></span><span></span>
      <span>도장</span><span></span><span>출고</span>
    </div>

    <div class="cols body">
      <div class="end inbound">
        <div
          class="hit inb"
          role="button"
          tabindex="0"
          :aria-label="`코일입고, 오늘 입고 ${view.inbound.today}, 재고 ${view.inbound.stock}`"
          @click="emit('openInbound')"
          @keydown="onKey($event, () => emit('openInbound'))"
        >
          <span class="inb-name">코일입고</span>
          <span class="inb-row"><b>{{ formatNumber(view.inbound.today) }}</b><span>재고 {{ formatNumber(view.inbound.stock) }}</span></span>
        </div>
      </div>
      <div class="branch full" aria-hidden="true"></div>

      <div class="lines">
        <div
          v-for="l in view.lines"
          :key="l.id"
          class="hit line"
          role="button"
          tabindex="0"
          :aria-label="`${l.id} 라인 상세`"
          @click="emit('openLine', l.id)"
          @keydown="onKey($event, () => emit('openLine', l.id))"
        >
          <span class="lid"><b>{{ l.id }}</b><span>{{ formatNumber(l.done) }} / {{ formatNumber(l.plan) }}</span></span>
          <span class="grp"><EquipCell :cell="l.cells[0]" /></span>
          <span class="grp press"><EquipCell v-for="c in l.cells.slice(1, 5)" :key="c.id" :cell="c" /></span>
          <span class="grp"><EquipCell :cell="l.cells[5]" /></span>
        </div>
      </div>
      <div class="branch full" aria-hidden="true"></div>

      <div class="end paint">
        <div
          v-for="c in view.paint"
          :key="c.id"
          class="hit stub both"
          role="button"
          tabindex="0"
          aria-label="도장 라인 상세"
          @click="emit('openLine', 'PT')"
          @keydown="onKey($event, () => emit('openLine', 'PT'))"
        ><EquipCell :cell="c" /></div>
      </div>
      <div class="branch half" aria-hidden="true"></div>

      <div class="end vision">
        <div
          v-if="view.vision"
          class="hit stub left"
          role="button"
          tabindex="0"
          aria-label="출고 상세"
          @click="emit('openOutbound')"
          @keydown="onKey($event, () => emit('openOutbound'))"
        ><EquipCell :cell="view.vision" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: var(--sp-3) var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background-color: var(--c-surface);
  background-image:
    linear-gradient(var(--c-line) var(--line-w), transparent var(--line-w)),
    linear-gradient(90deg, var(--c-line) var(--line-w), transparent var(--line-w));
  background-position: calc(var(--line-w) * -1) calc(var(--line-w) * -1);
  background-size: var(--map-grid) var(--map-grid);
}

/* 입고 | 연결 | 라인들 | 연결 | 도장 | 연결 | 비전 */
.cols {
  display: grid;
  grid-template-columns:
    minmax(var(--map-end-min), 0.75fr) var(--map-conn) minmax(0, 6fr) var(--map-conn)
    minmax(var(--map-end-min), 0.75fr) var(--map-conn) minmax(var(--map-end-min), 0.75fr);
}

.head {
  flex: none;
  margin-bottom: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-label);
  text-align: center;
}

/* 라인 줄 안: 라인 이름 | 슬리팅 | 프레스 1~4 | 용접 */
.lhead,
.line {
  display: grid;
  grid-template-columns: var(--map-lid) minmax(0, 1fr) minmax(0, 4fr) minmax(0, 1fr);
  column-gap: var(--map-conn);
}

.lhead > :first-child {
  padding-left: var(--sp-2);
  text-align: left;
}

.body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.lines {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.hit {
  cursor: pointer;
}

.line {
  position: relative;
  flex: 1;
  align-items: center;
  min-height: 0;
  border-radius: var(--r-2);
}

/* 라인을 지나는 물류 선: 앞뒤 연결 칸까지 이어진다 */
.line::before {
  content: '';
  position: absolute;
  top: 50%;
  right: calc(var(--map-conn) / -2);
  left: calc(var(--map-conn) / -2);
  border-top: var(--line-w-strong) solid var(--c-line-ink);
}

.lid {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-left: var(--sp-2);
}

.lid b,
.lid span {
  width: fit-content;
  background: var(--c-surface);
}

.lid b {
  font-size: var(--fs-title);
  font-weight: var(--fw-code);
  line-height: var(--lh-tight);
}

.lid span {
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}

.grp {
  position: relative;
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: var(--sp-2);
  height: calc(100% - var(--sp-2));
}

/* 6갈래로 나뉘고 모이는 세로선: 첫 줄 가운데(1/12)부터 끝 줄 가운데(11/12)까지 */
.branch {
  position: relative;
}

.branch::before {
  content: '';
  position: absolute;
  top: calc(100% / 12);
  bottom: calc(100% / 12);
  left: 50%;
  border-left: var(--line-w-strong) solid var(--c-line-ink);
}

.branch.half::before {
  top: 25%;
  bottom: 25%;
}

.end {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.end > .hit {
  position: relative;
  flex: none;
  height: calc(100% / 6 - var(--sp-2));
}

.paint {
  justify-content: space-around;
}

/* 입고 칸 → 갈래선 */
.inbound::after {
  content: '';
  position: absolute;
  top: 50%;
  right: calc(var(--map-conn) / -2);
  width: calc(var(--map-conn) / 2);
  border-top: var(--line-w-strong) solid var(--c-line-ink);
}

/* 도장·비전 칸의 좌우 연결선 */
.stub::before,
.stub.both::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(var(--map-conn) / 2);
  border-top: var(--line-w-strong) solid var(--c-line-ink);
}

.stub::before {
  left: calc(var(--map-conn) / -2);
}

.stub.both::after {
  right: calc(var(--map-conn) / -2);
}

.inb {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--sp-2);
  border-radius: var(--r-2);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 var(--line-w-strong) var(--c-line-ink);
}

.inb-name {
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.inb-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  color: var(--c-ink-2);
  font-size: var(--fs-label);
}

.inb-row b {
  color: var(--c-ink);
  font-size: var(--fs-heading);
  line-height: 1;
}
</style>
