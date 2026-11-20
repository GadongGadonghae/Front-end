<!-- SCR-003 가동률 (D-108 시안 G, D-113 다듬기): 타임라인을 보여 주며 라인별 OEE를 비교한다.
     왼쪽 열: 종합(OEE 다리) · 비가동 코드별(순위 막대). 오른쪽: 구역별 가동 [생산 라인 · 코일입고 · 도장 · 출고], 라인을 누르면 설비별.
     기간(일/주/월)만 먹색 구간 버튼, 패널 안 탭·정렬은 옅은 구간 버튼 (성격이 다른 선택을 모양으로 나눔) -->
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseDateField from '@/components/base/BaseDateField.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import OeeBridge from '@/components/domain/OeeBridge.vue'
import DowntimeBars from '@/components/domain/DowntimeBars.vue'
import UtilLedger from '@/components/domain/UtilLedger.vue'
import BandLegend from '@/components/domain/BandLegend.vue'
import { useUtilization, type UtilTab } from '@/composables/useUtilization'
import { formatNumber } from '@/lib/format'
import type { Period } from '@/types/analysis'

const route = useRoute()
const u = useUtilization({ tab: route.query.tab as string | undefined, line: route.query.line as string | undefined })
const { period, date, tab, sort } = u

const PERIODS: { value: Period; label: string }[] = [{ value: 'day', label: '일' }, { value: 'week', label: '주' }, { value: 'month', label: '월' }]
const TABS: { value: UtilTab; label: string }[] = [
  { value: 'line', label: '생산 라인' }, { value: 'inbound', label: '코일입고' }, { value: 'paint', label: '도장' }, { value: 'out', label: '출고 비전' },
]
/** 줄이 적은 구역의 설명 줄 (시안 G) */
const NOTE: Partial<Record<UtilTab, string>> = {
  paint: 'A~F 모든 라인의 제품을 도장 두 대가 나눠 받습니다',
  out: '모든 제품이 출고 비전 한 대를 거칩니다',
}
const SORTS = [{ value: 'line' as const, label: '라인순' }, { value: 'low' as const, label: 'OEE 낮은 순' }]
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">가동률</h1>
      <div class="filters">
        <BaseSegmented v-model="period" label="기간" :options="PERIODS" />
        <BaseDateField v-model="date" label="날짜" :max="u.today" />
      </div>
    </template>
    <template #head-right><span class="basis">{{ u.rangeText.value }}</span></template>

    <div class="layout">
      <div class="side">
        <BasePanel :title="u.title.value" :meta="`OEE · ${u.periodWord.value}`">
          <p class="key">{{ formatNumber(u.summary.value?.oee.oee, 1) }}<small v-if="u.summary.value?.oee.oee != null">%</small></p>
          <OeeBridge :oee="u.summary.value?.oee ?? null" :line-yield="u.summary.value?.lineYield ?? null" />
        </BasePanel>
        <BasePanel class="codes" title="비가동 코드별" :meta="`${u.scopeName.value} · ${u.periodWord.value}`">
          <DowntimeBars :rows="u.downtime.value" />
        </BasePanel>
      </div>

      <BasePanel class="main">
        <template #head>
          <h2>구역별 가동</h2>
          <!-- 설비별로 들어간 뒤 [생산 라인] 탭을 다시 눌러도 전체 라인으로 돌아온다 -->
          <span @click="tab === 'line' && u.backToLines()"><BaseSegmented v-model="tab" label="구역" size="sm" variant="soft" :options="TABS" /></span>
          <span v-if="tab === 'line' && u.line.value" class="crumb">
            <BaseButton size="sm" @click="u.backToLines"><BaseIcon class="back" name="chevron-right" :size="16" />전체 라인 보기</BaseButton>
            <b>{{ u.scopeName.value }}</b><span class="meta">설비별</span>
          </span>
        </template>
        <template #tools>
          <BandLegend v-if="period === 'day' && tab !== 'inbound'" />
          <BaseSegmented v-if="tab === 'line' && !u.line.value" v-model="sort" label="정렬" size="sm" variant="soft" :options="SORTS" />
        </template>

        <div v-if="tab === 'inbound'" class="inbound">
          <b>코일입고는 가동률을 재지 않습니다</b>
          <span>설비 없이 수량만 관리하는 곳이라 가동·정지 상태가 없습니다.</span>
          <span>오늘 입고 코일 수와 슬리팅 앞 재고는 <RouterLink to="/inbound">코일입고 상세</RouterLink>에서 봅니다.</span>
        </div>
        <p v-if="NOTE[tab] && !u.line.value" class="note">{{ NOTE[tab] }}</p>
        <UtilLedger
          v-if="tab !== 'inbound' && u.rows.value.length"
          :rows="u.rows.value"
          :mode="period === 'day' ? 'day' : 'period'"
          :name-head="tab === 'line' && !u.line.value ? '라인' : '설비'"
          :oee-head="u.oeeHead.value"
          :until="u.until.value"
          :day-head="u.dayHead.value"
          :base-name="u.scopeName.value"
          @pick="u.pickLine"
        />
        <BaseEmpty v-else-if="tab !== 'inbound'" :text="u.loading.value ? '불러오는 중' : '데이터 없음'" />
      </BasePanel>
    </div>
  </PageLayout>
</template>

<style scoped>
.title {
  font-size: var(--fs-page);
  font-weight: var(--fw-strong);
  white-space: nowrap;
}

.filters {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.basis {
  color: var(--c-ink-3);
  font-size: var(--fs-md);
}

.layout {
  display: grid;
  grid-template-columns: var(--col-summary) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-height: 0;
}

.codes {
  flex: 1;
}

.key {
  margin-bottom: var(--sp-3);
  font-size: var(--fs-xl);
  font-weight: var(--fw-strong);
  line-height: var(--lh-tight);
}

.key small {
  font-size: var(--fs-lg);
}

.main :deep(.ph) {
  flex-wrap: wrap;
}

.note {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink-2);
  font-size: var(--fs-md);
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
  color: var(--c-ink-3);
}

/* 왼쪽 화살표 = 오른쪽 화살표를 뒤집어 씀 */
.back {
  transform: scaleX(-1);
}

.crumb b {
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.crumb .meta {
  margin-left: var(--sp-2);
  font-size: var(--fs-sm);
}

.inbound {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-2);
  padding-left: var(--sp-8);
  color: var(--c-ink-2);
}

.inbound b {
  color: var(--c-ink);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.inbound a {
  color: var(--c-accent);
}

/* 낮은 창: 비가동 목록 간격을 좁힌다 */
@media (height <= 860px) {
  .side :deep(.codes li) {
    padding: var(--sp-1) 0;
    font-size: var(--fs-sm);
  }

  .key {
    margin-bottom: var(--sp-2);
  }
}
</style>
