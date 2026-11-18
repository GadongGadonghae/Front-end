<!-- 앱 틀: 상단 메뉴(화면정의서 1장 공통 헤더) + 화면 + 고장 토스트 자리 -->
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import BaseIcon from '@/components/base/BaseIcon.vue'
import FaultToast from '@/components/domain/FaultToast.vue'
import HeaderAlerts from '@/layouts/HeaderAlerts.vue'
import { useAuth } from '@/composables/useAuth'
import { useNow } from '@/composables/useNow'
import { useFaultToast } from '@/composables/useFaultToast'
import { useMaster } from '@/composables/useMaster'
import { useDataInfo } from '@/composables/useDataInfo'
import { DOWNTIME_NAME } from '@/lib/status'
import { formatDate, formatTime } from '@/lib/format'

const MENU = [
  { name: '대시보드', to: '/' },
  { name: '생산', to: '/production' },
  { name: '가동률', to: '/utilization' },
  { name: '예지보전', to: '/pdm' },
  { name: '알람이력', to: '/alarms' },
  { name: '리포트', to: '/reports/daily' },
  { name: '설정', to: '/settings/target' },
] as const

const route = useRoute()
const router = useRouter()
const { userName, logout } = useAuth()
const now = useNow()
const nowIso = computed(() => new Date(now.value).toISOString())
const { demo } = useDataInfo()
const { equipmentName } = useMaster()
const toast = useFaultToast()

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
      <RouterLink class="brand" to="/"><BaseIcon name="factory" :size="20" />라인가동현황</RouterLink>
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
        <span v-if="demo" class="demo">데모 데이터</span>
        <span class="clock">{{ formatDate(nowIso) }}<b>{{ formatTime(nowIso) }}</b></span>
        <HeaderAlerts />
        <span class="user"><BaseIcon name="user" />{{ userName }}</span>
        <button class="logout" type="button" aria-label="로그아웃" title="로그아웃" @click="onLogout"><BaseIcon name="log-out" /></button>
      </div>
    </header>

    <!-- 주소(경로)가 바뀌면 화면을 새로 만든다: 라인·공정 탭 전환. ?eq= 같은 쿼리만 바뀌면 그대로 -->
    <main class="main print-flow"><RouterView :key="route.path" /></main>

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
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-strong);
  text-decoration: none;
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

.demo {
  padding: 0 var(--sp-2);
  border: var(--line-w) solid var(--c-line-strong);
  border-radius: var(--r-1);
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
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
</style>
