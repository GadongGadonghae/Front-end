<!-- SCR-009 관리값 기준 설정 (화면정의서 SCR-009, 시안 B-limit). 기준은 설비별 (백엔드 M-10·M-11)
     설비 종류 → 설비 고르기 → 관리값 표 (항목 · 단위 · 하한 · 상한 · 마지막 수정). 변경 이력 목록 없음 (D-73)
     하한 > 상한이면 그 줄 아래에 오류를 보이고 저장하지 않는다. 저장하면 상태 판정·위험도에 바로 반영 (D-28) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { settingsTabsFor } from '@/lib/permissions'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSegmented from '@/components/base/BaseSegmented.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import { useControlLimits } from '@/composables/useSettings'
import { metricLabel } from '@/lib/metrics'

const c = useControlLimits()
const { type, equipmentId } = c

// 권한 있는 설정 탭만 (11/20, lib/permissions.ts)
const { role: myRole } = useAuth()
const TABS = computed(() => settingsTabsFor(myRole.value))
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">설정</h1>
      <BaseTabs :items="TABS" active="limits" label="설정 종류" />
    </template>

    <div class="layout">
      <BasePanel>
        <template #head>
          <h2 class="sr-only">관리값 기준</h2>
          <div class="types">
            <BaseSegmented v-model="type" label="설비 종류" :options="c.typeOptions.value" />
            <BaseSelect v-model="equipmentId" label="설비" :options="c.equipmentOptions.value" />
            <span class="note">설비마다 기준이 따로 있음 · 빈 칸은 기준 미정</span>
          </div>
        </template>

        <form class="form" @submit.prevent="c.save">
          <table aria-label="관리값 기준">
            <colgroup><col /><col class="c-unit" /><col class="c-lim" /><col class="c-lim" /><col class="c-mod" /></colgroup>
            <thead>
              <tr><th scope="col">항목</th><th scope="col">단위</th><th scope="col">하한</th><th scope="col">상한</th><th scope="col">마지막 수정</th></tr>
            </thead>
            <tbody>
              <template v-for="r in c.rows.value" :key="r.key">
                <tr :class="{ bad: r.invalid, dirty: r.dirty }">
                  <td class="item">{{ metricLabel(r.item) }}<span v-if="r.dirty" class="changed">바뀜</span></td>
                  <td class="unit">{{ r.unit }}</td>
                  <td>
                    <input
                      v-model="r.draft.lower"
                      class="lim"
                      inputmode="decimal"
                      :aria-label="`${r.item} 하한`"
                      :aria-invalid="!!r.invalid || undefined"
                      :aria-describedby="r.invalid ? `err-${r.key}` : undefined"
                      placeholder="미정"
                    />
                  </td>
                  <td>
                    <input
                      v-model="r.draft.upper"
                      class="lim"
                      inputmode="decimal"
                      :aria-label="`${r.item} 상한`"
                      :aria-invalid="!!r.invalid || undefined"
                      :aria-describedby="r.invalid ? `err-${r.key}` : undefined"
                      placeholder="미정"
                    />
                  </td>
                  <td>
                    <span class="mod">
                      <template v-if="r.modified">{{ r.modified }}<small>{{ r.modifiedBy ?? '-' }}</small></template>
                      <template v-else>기본값<small>데이터셋 설명서</small></template>
                    </span>
                  </td>
                </tr>
                <tr v-if="r.invalid" class="err-row">
                  <td colspan="2"></td>
                  <td :id="`err-${r.key}`" colspan="3" role="alert">{{ r.invalid }}</td>
                </tr>
              </template>
            </tbody>
          </table>

          <div class="foot">
            <p v-if="c.error.value" class="msg err" role="alert">{{ c.error.value }}</p>
            <p v-else-if="c.otherDirty.value" class="msg warn" role="status">다른 설비에 저장하지 않은 값이 있습니다: {{ c.otherDirty.value }}. 저장은 지금 고른 설비만 합니다</p>
            <p v-else-if="c.saved.value" class="msg" role="status">{{ c.saved.value }}</p>
            <p v-else class="msg">저장하면 상태 판정(상·하한 이탈 → D)과 예지보전 위험도에 바로 반영됩니다</p>
            <BaseButton :disabled="!c.dirtyCount.value" @click="c.revert">되돌리기</BaseButton>
            <BaseButton type="submit" variant="primary" :disabled="c.saving.value || !c.dirtyCount.value">
              저장<template v-if="c.dirtyCount.value"> ({{ c.dirtyCount.value }}개)</template>
            </BaseButton>
          </div>
        </form>
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

.layout {
  display: grid;
  grid-template-columns: minmax(0, var(--limits-w));
  align-items: start;
  height: 100%;
  min-height: 0;
}

.types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-5);
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.form {
  display: flex;
  flex-direction: column;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--fs-md);
}

.c-unit { width: 6em; }
.c-lim { width: 10em; }
.c-mod { width: 12em; }

th {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  text-align: left;
}

td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: var(--line-w) solid var(--c-line);
  vertical-align: middle;
}

th:first-child,
td:first-child {
  padding-left: 0;
}

.item {
  font-weight: var(--fw-strong);
}

.changed {
  margin-left: var(--sp-2);
  color: var(--c-accent);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.unit {
  color: var(--c-ink-2);
}

.lim {
  width: 100%;
  height: var(--control-h-sm);
  padding: 0 var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lim::placeholder {
  color: var(--c-ink-3);
}

.bad .lim {
  border-color: var(--c-down);
}

tr.bad td {
  border-bottom-color: transparent;
}

tr.err-row td {
  padding-top: 0;
  color: var(--c-down);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.mod {
  display: flex;
  flex-direction: column;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.mod small {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.foot {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-top: var(--sp-4);
}

.msg {
  margin: 0 auto 0 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.msg.warn {
  color: var(--c-caution-ink);
  font-weight: var(--fw-strong);
}

.msg.err {
  color: var(--c-down);
  font-weight: var(--fw-strong);
}
</style>
