<!-- 앱 틀: 상단 메뉴(화면정의서 1장 공통 헤더) + 화면 + 고장 토스트 자리 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import flowMark from '@/assets/flow-mark.png'
import BaseIcon from '@/components/base/BaseIcon.vue'
import FaultToast from '@/components/domain/FaultToast.vue'
import HeaderAlerts from '@/layouts/HeaderAlerts.vue'
import { useAuth } from '@/composables/useAuth'
import { useNow } from '@/composables/useNow'
import { useFaultToast } from '@/composables/useFaultToast'
import { useTargetChange } from '@/composables/useTargetChange'
import { usePendingApprovals } from '@/composables/usePendingApprovals'
import { formatNumber } from '@/lib/format'
import { useMaster } from '@/composables/useMaster'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDate, formatTime } from '@/lib/format'
import { settingsTabsFor } from '@/lib/permissions'
import { useBack } from '@/composables/useBack'

const BASE_MENU = [
  { name: '대시보드', to: '/' },
  { name: '생산', to: '/production' },
  { name: '가동률', to: '/utilization' },
  { name: '예지보전', to: '/pdm' },
  { name: '알람이력', to: '/alarms' },
  { name: 'AI 리포트', to: '/reports/daily' },
]

const route = useRoute()
const router = useRouter()
const { userName, role, roleName, can, logout } = useAuth()
// 설정: 권한 있는 첫 탭으로, 하나도 없으면(라인 담당자·캠퍼스장) 메뉴에서 숨김 (11/20)
const MENU = computed(() => {
  const first = settingsTabsFor(role.value)[0]
  return first ? [...BASE_MENU, { name: '설정', to: first.to }] : BASE_MENU
})
const now = useNow()
// 11/21 도장 경로 맞추기: 결재로 경로가 바뀌어도 배치도·3D가 따라오게 (15초마다, 바뀐 때만 다시 그림)
let routeTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { routeTimer = setInterval(syncRoutes, 15_000) })
onUnmounted(() => { if (routeTimer) clearInterval(routeTimer) })
// 전체화면(F11)에서는 브라우저 뒤로 가기가 안 보여서 화면 안에 [‹ 이전] (11/21)
const { canBack, goBack } = useBack()
const nowIso = computed(() => new Date(now.value).toISOString())
const { equipmentName, syncRoutes } = useMaster()
const toast = useFaultToast()
// 목표 생산량 변동 카드: 생산관리팀장에게만, 공장장이 오늘 목표를 바꾸면 (11/20)
const target = useTargetChange()
const qty = (n: number | null) => (n == null ? '미설정' : `${formatNumber(n)}개`)
/** 목표 변동 카드 → 목표 기준 AI 보고서 작성 화면 (11/20) */
function writeTargetReport() {
  const c = target.change.value
  target.dismiss()
  // 목표가 올랐으면 늘어난 수량 = 추가 주문 → 추가 주문 배정 검토 (계획수정 보고서 화면에서 깜빡이는 추가 주문 카드)
  // 11/21: 늘든 줄든 계획수정 보고서 화면의 깜빡이는 계획 변경 카드로 (감소면 정지·감산 검토)
  if (c) router.push({ path: '/reports/replan', query: { order: '1' } })
}
// 결재 대기 카드: 공장장에게만, 생산관리팀장이 [작성 완료 · 결재 요청]을 누르면 (11/20)
const approvals = usePendingApprovals()
const latestPending = computed(() => approvals.pending.value[0] ?? null)
/** "계획수정 보고서 · 추가 주문 배정" 같은 제목. 일일 보고서는 그대로 */
const pendingName = computed(() => latestPending.value?.title ?? '')
/** 보고서로: 계획수정 보고서는 그 보고서를 열면 왼쪽에서 추가 주문 / 현재 트러블 슈팅 칸이 골라져 보여요 */
function openPending() {
  const f = latestPending.value
  approvals.dismiss()
  if (!f) return
  const [kind, id] = f.key.split(':')
  router.push(kind === 'replan' ? `/reports/replan/${id}` : '/reports/daily')
}

async function onLogout() {
  await logout()
  router.push('/login')
}

function viewFault() {
  const e = toast.current.value
  toast.dismiss()
  if (e) router.push({ path: '/alarms' })
}
</script>

<template>
  <div class="shell print-flow">
    <header class="top no-print">
      <button v-if="canBack" type="button" class="back" aria-label="이전 화면" title="이전 화면" @click="goBack"><BaseIcon name="chevron-left" :size="20" />이전</button>
      <RouterLink class="brand" to="/"><img class="mark" :src="flowMark" alt="" />FLOW</RouterLink>
      <nav aria-label="메뉴">
        <RouterLink
          v-for="m in MENU"
          :key="m.name"
          :to="m.to"
          :class="{ on: route.meta.menu === m.name }"
          :aria-current="route.meta.menu === m.name ? 'page' : undefined"
        >{{ m.name }}</RouterLink>
      </nav>
      <div class="right">
        <span class="clock">{{ formatDate(nowIso) }}<b>{{ formatTime(nowIso) }}</b></span>
        <HeaderAlerts />
        <RouterLink v-if="can('mes')" class="mes" to="/mes">MES</RouterLink>
        <span class="user"><BaseIcon name="user" :size="20" />{{ userName }}<small class="role">{{ roleName }}</small></span>
        <button class="logout" type="button" aria-label="로그아웃" title="로그아웃" @click="onLogout"><BaseIcon name="log-out" :size="20" /></button>
      </div>
    </header>

    <!-- 주소(경로)가 바뀌면 화면을 새로 만든다: 라인·공정 탭 전환. ?eq= 같은 쿼리만 바뀌면 그대로 -->
    <main class="main print-flow"><RouterView :key="route.path" /></main>

    <aside v-if="target.change.value" class="target-card no-print" role="status" aria-live="polite">
      <div class="tc-body">
        <b>목표 생산량 변동</b>
        <span class="tc-qty">오늘 {{ target.change.value.before == null ? '목표' : qty(target.change.value.before) }} → <strong>{{ qty(target.change.value.after) }}</strong></span>
        <small v-if="target.change.value.by || target.change.value.at">{{ target.change.value.by ?? '' }}{{ target.change.value.at ? ` · ${formatTime(target.change.value.at)}` : '' }}</small>
        <button class="tc-go" type="button" @click="writeTargetReport">AI 보고서 작성 ›</button>
      </div>
      <button class="tc-close" type="button" aria-label="목표 변동 알림 닫기" title="닫기" @click="target.dismiss()"><BaseIcon name="x" :size="16" /></button>
    </aside>

    <aside v-if="latestPending" class="target-card no-print" role="status" aria-live="polite">
      <div class="tc-body">
        <b>결재할 보고서가 올라왔어요</b>
        <span class="tc-qty">{{ pendingName }}{{ approvals.pending.value.length > 1 ? ` 외 ${approvals.pending.value.length - 1}건` : '' }}</span>
        <small>{{ latestPending.writtenBy ?? '' }}{{ latestPending.writtenAt ? ` · ${formatTime(latestPending.writtenAt)} 결재 요청` : '' }}</small>
        <button class="tc-go" type="button" @click="openPending">보고서 보기 ›</button>
      </div>
      <button class="tc-close" type="button" aria-label="결재 알림 닫기" title="닫기" @click="approvals.dismiss()"><BaseIcon name="x" :size="16" /></button>
    </aside>

    <FaultToast
      v-if="toast.current.value"
      :equipment-name="equipmentName(toast.current.value.equipmentId)"
      :code-name="DOWNTIME_NAME[toast.current.value.code]"
      :detail="toast.current.value.detail"
      :time="formatTime(toast.current.value.start)"
      @view="viewFault"
      @dismiss="toast.dismiss"
    />
  </div>
</template>

<style scoped>
.role {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.mes {
  padding: var(--sp-1) var(--sp-3);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  text-decoration: none;
}

.shell {
  display: grid;
  grid-template-rows: var(--nav-h) minmax(0, 1fr);
  min-width: var(--app-min-w);
  height: 100%;
}

.top {
  display: flex;
  align-items: stretch;
  gap: var(--sp-8);
  padding: 0 var(--page-gutter);
  border-bottom: var(--line-w) solid var(--c-line-strong);
  background: var(--c-surface);
  font-size: var(--fs-figure);

  /* 메뉴 글자는 줄바꿈하지 않는다 (1280 폭에서 "대시보/드"로 쪼개지던 것) */
  white-space: nowrap;
}


.back {
  display: flex;
  align-items: center;
  align-self: center;
  gap: var(--sp-1);
  margin-right: 0;
  padding: var(--sp-1) var(--sp-3) var(--sp-1) var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.back:hover { background: var(--c-surface-sunk); }

.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
  text-decoration: none;
}

/* FLOW 로고 심볼 (docs/참고자료/FLOW_로고.png에서 잘라 냄, 11/22) */
.mark {
  display: block;
  width: auto;
  height: 22px;
}

nav {
  display: flex;
  gap: var(--sp-1);
}

nav a {
  display: flex;
  align-items: center;
  margin-bottom: calc(var(--line-w) * -1);
  padding: 0 var(--sp-4);
  border-bottom: var(--indicator-w) solid transparent;
  color: var(--c-ink-2);
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}

nav a:hover {
  color: var(--c-ink);
}

nav a.on {
  border-bottom-color: var(--c-ink);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.right {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  margin-left: auto;
  color: var(--c-ink-2);
}

.clock b {
  margin-left: var(--sp-2);
  color: var(--c-ink);
  font-weight: var(--fw-strong);
}

.user {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.logout {
  display: grid;
  place-items: center;
  width: var(--control-h);
  height: var(--control-h);
  margin-left: calc(var(--sp-3) * -1);
  border: 0;
  border-radius: var(--r-2);
  background: none;
  color: var(--c-ink-3);
  cursor: pointer;
}

.logout:hover {
  background: var(--c-surface-sunk);
  color: var(--c-ink);
}

.main {
  min-height: 0;
  padding: var(--sp-4) var(--page-gutter) var(--page-gutter);
  overflow: auto;
}

/* 좁은 창 (1280~1600): 간격과 글자를 한 단계 줄여 한 줄에 들어가게 */
@media (width < 1600px) {
  .top {
    gap: var(--sp-4);
    font-size: var(--fs-md);
  }

  /* 로고와 조금 더 떨어지게 (11/22) */
  .back {
    margin-right: var(--sp-2);
  }

  .brand {
    font-size: var(--fs-figure);
  }

  nav a {
    padding: 0 var(--sp-3);
  }

  .right {
    gap: var(--sp-3);
  }
}
/* 계정 권한 이름 (11/20): 이름 옆에 작게 */
.user .role {
  margin-left: var(--sp-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}
/* 목표 생산량 변동 카드 (11/20): 머리줄 바로 아래 오른쪽, 작게 */
.target-card {
  position: fixed;
  top: 64px; /* 머리줄 높이 + 여백 */
  right: var(--sp-6);
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-line-strong);
  border-left: 4px solid var(--c-accent);
  border-radius: var(--r-3);
  background: var(--c-surface);
  box-shadow: var(--shadow-float);
}
.tc-body {
  display: grid;
  gap: 2px;
  font-size: var(--fs-sm);
}
.tc-body small {
  color: var(--c-ink-3);
}
.tc-go {
  justify-self: start;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-accent);
  font: inherit;
  font-weight: var(--fw-strong);
  cursor: pointer;
}
.tc-close {
  display: grid;
  place-items: center;
  padding: 2px;
  border: 0;
  background: none;
  color: var(--c-ink-2);
  cursor: pointer;
}
</style>
