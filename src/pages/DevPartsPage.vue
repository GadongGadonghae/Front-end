<!-- 부품 견본 (개발 모드에서만 /dev/parts). 부품을 만들거나 고칠 때 한곳에서 확인한다. 값은 모두 데모 값 -->
<script setup lang="ts">
import { ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseFigure from '@/components/base/BaseFigure.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ChartLine from '@/components/charts/ChartLine.vue'
import ChartBarList from '@/components/charts/ChartBarList.vue'
import ChartProgress from '@/components/charts/ChartProgress.vue'
import StatusKey from '@/components/domain/StatusKey.vue'
import type { StateCode } from '@/types/state'

const range = ref<'1h' | '8h' | 'day'>('1h')
const states: StateCode[] = ['R', 'S', 'I', 'D']

// 데모: 시간당 누적 실적 (00~14시)
const hourly = [48, 50, 51, 47, 52, 50, 49, 53, 51, 46, 52, 50, 54, 51, 38]
let cum = 0
const actual: [number, number][] = [[0, 0], ...hourly.map((v, i): [number, number] => [i + 1, (cum += v)])]
// 데모: 관리값 추이 (상한에 다가감)
const pressure: [number, number][] = Array.from({ length: 60 }, (_, i) => [i, 290 + Math.sin(i / 2) * 8 + (i > 40 ? (i - 40) * 3 : 0)])
</script>

<template>
  <PageLayout>
    <template #head>
      <h1>부품 견본</h1>
      <BaseTabs label="예시 탭" active="B" :items="['A', 'B', 'C'].map((l) => ({ key: l, label: l, to: `/dev/parts?l=${l}` }))" />
      <BaseSegmented v-model="range" label="기간" :options="[{ value: '1h', label: '1시간' }, { value: '8h', label: '8시간' }, { value: 'day', label: '오늘' }]" />
    </template>
    <template #head-right>
      <BaseButton>기본</BaseButton>
      <BaseButton variant="primary">주요</BaseButton>
      <BaseButton size="sm">작게</BaseButton>
    </template>

    <div class="grid">
      <BasePanel title="숫자 덩어리" meta="BaseFigure · ChartProgress">
        <div class="figs">
          <BaseFigure label="실적 · 출고 양품 / 계획" :value="742" suffix="/ 1,200" size="lg" sub="달성률 61.8%" />
          <ChartProgress :percent="61.8" label="달성률 61.8%" />
          <BaseFigure label="라인 OEE" :value="68.9" :digits="1" unit="%" />
          <BaseFigure label="값 없음" :value="null" unit="%" sub="부하시간 0이면 -" size="sm" />
        </div>
      </BasePanel>

      <BasePanel title="상태 열쇠 칸" meta="StatusKey sm · md · lg">
        <div class="keys">
          <div v-for="s in states" :key="s" class="row">
            <StatusKey :state="s" size="sm" label />
            <StatusKey :state="s" label />
            <StatusKey :state="s" size="lg" label />
            <StatusKey :state="s" label="해제됨" muted />
          </div>
        </div>
      </BasePanel>

      <BasePanel title="가로 막대 목록" meta="ChartBarList · 기준선 · 강조 행">
        <ChartBarList
          label="라인별 실적"
          :marker="200"
          :rows="[
            { key: 'A', label: 'A', value: 131, display: '131 / 200' },
            { key: 'B', label: 'B 가장 낮음', value: 108, display: '108 / 200', strong: true },
            { key: 'C', label: 'C', value: 127, display: '127 / 200' },
            { key: 'PT', label: '도장', value: null, display: '-', muted: true },
          ]"
        />
      </BasePanel>

      <BasePanel title="상태 색 막대" meta="tone · 앞머리 칸 · 보조 열">
        <ChartBarList
          label="비가동 코드별 시간"
          thick
          :rows="[
            { key: 'a', label: '장비고장(알람)', value: 1836, display: '30:36', sub: '2건', tone: 'down' },
            { key: 'b', label: '재공부족', value: 1596, display: '26:36', sub: '3건', tone: 'idle' },
            { key: 'c', label: '계획정지', value: 1500, display: '25:00', sub: '1건', tone: 'stop' },
            { key: 'd', label: '작업지연', value: 0, display: '-', sub: '0건', muted: true },
          ]"
        >
          <template #lead="{ row }"><StatusKey :state="row.tone === 'down' ? 'D' : row.tone === 'stop' ? 'S' : 'I'" size="sm" /></template>
        </ChartBarList>
      </BasePanel>

      <BasePanel class="wide" title="선 그래프" meta="실적 vs 목표선 · 지금 · 끝점">
        <ChartLine
          label="오늘 누적 실적과 목표"
          :x="[0, 24]"
          :y="[0, 1200]"
          :x-ticks="[0, 6, 12, 18, 24].map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}시` }))"
          :y-ticks="[0, 400, 800, 1200]"
          :series="[{ key: 'actual', points: actual }, { key: 'target', kind: 'ref', points: [[0, 0], [24, 1200]] }]"
          :now="14.5"
          end-dot
        />
      </BasePanel>

      <BasePanel class="wide" title="관리값 그래프" meta="상하한 · 80/90% · 이탈 점 · 구간 띠">
        <ChartLine
          label="Pressure 1 추이"
          :x="[0, 60]"
          :y="[200, 360]"
          :x-ticks="[0, 15, 30, 45, 60].map((m) => ({ value: m, label: `${m}분` }))"
          :y-ticks="[200, 250, 300, 350]"
          :series="[{ key: 'p1', points: pressure }]"
          :ref-lines="[{ value: 350, kind: 'limit', label: '상한 350' }, { value: 335, kind: 'danger', label: '90%' }, { value: 320, kind: 'warn', label: '80%' }, { value: 200, kind: 'limit', label: '하한 200' }]"
          :bands="[{ from: 20, to: 24 }]"
          end-dot
        />
      </BasePanel>

      <BasePanel title="빈 값" meta="BaseEmpty"><BaseEmpty /></BasePanel>
      <BasePanel title="목록이 붙는 패널" meta="flush" flush><BaseEmpty text="본문 여백 없음" /></BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
h1 {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(calc(var(--sp-8) * 9), auto);
  gap: var(--sp-4);
}

.figs,
.keys {
  display: grid;
  gap: var(--sp-4);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
}
</style>
