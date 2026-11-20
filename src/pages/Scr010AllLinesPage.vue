<!-- 전체 라인 (대시보드 > 전체라인 탭): A~F + 도장 7칸을 가로로 나란히.
     칸마다 라인 상세 요약 카드와 같은 세 값: 오늘 라인 실적 / 계획(달성률) · 라인 OEE · 라인 불량(불량률) · 오늘 알람 이력 건수. 칸 이름을 누르면 그 라인 상세 -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BaseBreadcrumb from '@/components/base/BaseBreadcrumb.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import ChartDonutValue from '@/components/charts/ChartDonutValue.vue'
import { useAllLines } from '@/composables/useAllLines'
import { linePath, lineTabs } from '@/lib/routes'
import { formatNumber } from '@/lib/format'
import { lineName } from '@/lib/status'

const router = useRouter()
const { columns } = useAllLines()
const tabs = lineTabs(lineName)
</script>

<template>
  <PageLayout>
    <template #head>
      <BaseBreadcrumb :items="[{ label: '대시보드', to: '/' }, { label: '전체 라인' }]" />
      <BaseTabs :items="tabs" active="ALL" label="라인" />
    </template>

    <div class="cols">
      <section v-for="c in columns" :key="c.id" class="col" :aria-label="c.name">
        <button type="button" class="name" @click="router.push(linePath(c.id))">{{ c.name }}<BaseIcon name="chevron-right" :size="16" /></button>

        <!-- 실적은 도넛(달성률)으로 한눈에, 라인 상세 요약 카드와 같은 색 -->
        <div class="fig plan">
          <h3>오늘 라인 실적 / 계획</h3>
          <ChartDonutValue
            :parts="[{ value: c.rate ?? 0, color: 'var(--c-accent)' }, { value: Math.max(0, 100 - (c.rate ?? 0)), color: 'var(--c-track)' }]"
            :center="c.rate != null ? `${formatNumber(c.rate, 1)}%` : '-'"
            sub="달성률"
            :label="`${c.name} 달성률 ${formatNumber(c.rate, 1)}%`"
            :size="96"
          />
          <p class="mid num">{{ formatNumber(c.done) }}<small> / {{ formatNumber(c.plan) }}</small></p>
        </div>

        <div class="fig">
          <h3>라인 OEE</h3>
          <p class="big num">{{ formatNumber(c.oee, 1) }}<small v-if="c.oee != null">%</small></p>
        </div>

        <div class="fig">
          <h3>라인 불량</h3>
          <p class="big num">{{ formatNumber(c.ng) }}<small v-if="c.ng != null">개</small></p>
          <p class="sub">불량률 <b class="num">{{ formatNumber(c.ngRate, 1) }}<template v-if="c.ngRate != null">%</template></b></p>
        </div>

        <div class="fig">
          <h3>오늘 알람 이력</h3>
          <p class="big num">{{ formatNumber(c.alarms.total) }}<small>건</small></p>
          <p class="sub" :class="{ on: c.alarms.ongoing > 0 }">진행 중 <b class="num">{{ formatNumber(c.alarms.ongoing) }}</b></p>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}

.col {
  display: grid;
  grid-template-rows: auto minmax(0, 1.8fr) repeat(3, minmax(0, 1fr));
  min-width: 0;
  min-height: 0;
  padding: var(--sp-3) var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-3);
  background: var(--c-surface);
}

.name {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: var(--sp-1);
  padding: 0 0 var(--sp-2);
  border: 0;
  background: none;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  cursor: pointer;
}

.name:hover {
  text-decoration: underline;
}

.fig {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-1);
  min-width: 0;
  border-top: var(--line-w) solid var(--c-line);
}

.fig h3 {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-regular);
}

.big {
  margin: 0;
  color: var(--c-ink);
  font-size: var(--fs-xl);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
  white-space: nowrap;
}

.plan {
  align-items: center;
}

.plan h3 {
  align-self: stretch;
}

.mid {
  margin: 0;
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.big small,
.mid small {
  margin-left: 2px;
  color: var(--c-ink-3);
  font-size: var(--fs-figure);
  font-weight: var(--fw-regular);
}

.sub {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.sub b {
  margin-left: var(--sp-1);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

/* 진행 중 알람이 있으면 고장 색 글자 (색만으로 말하지 않게 '진행 중 n' 글자와 같이) */
.sub.on,
.sub.on b {
  color: var(--c-down);
}

.num {
  font-variant-numeric: tabular-nums;
}
</style>
