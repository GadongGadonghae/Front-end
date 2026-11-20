<!-- 임시 MES (11/20, 시연용): 캠퍼스장이 우리 시스템에서 "보고서 전송"된 AI 보고서를 받아 열람한다
     같은 앱·같은 브라우저 저장(localStorage)을 읽으므로 같은 주소·같은 브라우저에서만 보인다
     보고서 외 나머지(캠퍼스 공장 현황 등)는 더미 데이터 — 화면에 더미라고 밝힌다. 실제 MES 연동은 향후 과제 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import MesReportView from '@/components/domain/MesReportView.vue'
import { useAuth } from '@/composables/useAuth'
import { useReportFlow, flowLine } from '@/composables/useReportFlow'
import { downloadDailyDoc } from '@/lib/dailyDoc'
import { downloadReplanDoc } from '@/lib/replanDoc'

const router = useRouter()
const { userName, roleName, logout } = useAuth()
const flow = useReportFlow()

const pickedKey = ref<string | null>(null)
const picked = computed(() => flow.sent.value.find((f) => f.key === pickedKey.value) ?? flow.sent.value[0] ?? null)
const KIND = { daily: '일일 생산 마감', replan: '생산계획 수정 검토' }

async function download() {
  const f = picked.value
  if (f?.daily) await downloadDailyDoc(f.daily)
  else if (f?.replan) await downloadReplanDoc(f.replan)
}

async function onLogout() {
  await logout()
  router.push('/login')
}
</script>

<template>
  <div class="mes">
    <header class="top">
      <b class="brand">차체 캠퍼스 MES</b>
      <span class="tag">임시 구현 · 시연용</span>
      <span class="sp" />
      <RouterLink class="link" to="/">라인 가동 시스템 보기 ›</RouterLink>
      <span class="user">{{ userName }} · {{ roleName }}</span>
      <button class="out" type="button" @click="onLogout">로그아웃</button>
    </header>

    <main class="body">
      <section class="panel list">
        <h2>받은 공장 보고서 <small>{{ flow.sent.value.length }}건</small></h2>
        <ul v-if="flow.sent.value.length">
          <li v-for="f in flow.sent.value" :key="f.key">
            <button type="button" :class="{ on: picked?.key === f.key }" @click="pickedKey = f.key">
              <span class="from">공장 1 · {{ KIND[f.kind] }}</span>
              <b>{{ f.title }}</b>
              <span class="when">{{ flowLine(f).sent }} 전송</span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">아직 전송된 보고서가 없습니다. 우리 시스템에서 공장장이 결재 후 [보고서 전송]을 누르면 여기에 들어옵니다.</p>
      </section>

      <section class="panel view">
        <template v-if="picked">
          <div class="vh">
            <div>
              <h2>{{ picked.title }}</h2>
              <p class="sign">작성 {{ flowLine(picked).written }} · 결재 {{ flowLine(picked).approved }} · 전송 {{ flowLine(picked).sent }}</p>
            </div>
            <BaseButton size="sm" @click="download">Word(.doc) 받기</BaseButton>
          </div>
          <MesReportView :daily="picked.daily" :replan="picked.replan" />
        </template>
        <p v-else class="empty">보고서를 고르면 내용이 보입니다.</p>
      </section>

      <!-- 더미 영역: 캠퍼스 공장 현황 등은 사용자가 직접 채운다 (모두 더미 데이터라고 표시) -->
      <section class="panel dummy">
        <h2>캠퍼스 공장 현황 <small class="tag">더미 데이터</small></h2>
        <p class="empty">이 영역은 시연용 더미 화면 자리입니다.</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.mes {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100%;
  background: var(--c-canvas);
}

.top {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--page-gutter);
  background: var(--c-inverse);
  color: var(--c-inverse-ink);
}

.brand {
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.tag {
  padding: 2px var(--sp-2);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.sp {
  flex: 1;
}

.link {
  color: var(--c-inverse-ink);
}

.out {
  padding: var(--sp-1) var(--sp-3);
  border: var(--line-w) solid currentcolor;
  border-radius: var(--r-1);
  background: none;
  color: var(--c-inverse-ink);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.user {
  color: var(--c-inverse-ink-2);
  font-size: var(--fs-sm);
}

.body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--page-gutter);
}

.panel {
  padding: var(--sp-4);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-2);
  background: var(--c-surface);
}

.dummy {
  grid-column: 1 / -1;
}

h2 {
  margin-bottom: var(--sp-3);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

h2 small {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.list ul {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.list button {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.list button.on {
  border-color: var(--c-accent);
  background: var(--c-accent-tint);
}

.from,
.when,
.sign {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.vh {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.empty {
  color: var(--c-ink-3);
}
</style>
