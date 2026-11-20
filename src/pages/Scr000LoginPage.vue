<!-- SCR-000 로그인 (화면정의서 3장 SCR-000, FN-016): 아이디·비밀번호, 실패 메시지만, 회원가입 없음 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import { useAuth, homePath as DEFAULT_PATH } from '@/composables/useAuth'
import { useDataInfo } from '@/composables/useDataInfo'
import { DEMO_LOGINS } from '@/composables/useAuth'
import { useReportFlow } from '@/composables/useReportFlow'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()
const { demo } = useDataInfo()

const userId = ref('')
const password = ref('')
const failed = ref(false)
const unreachable = ref(false)
const busy = ref(false)

const flow = useReportFlow()
const cleared = ref(false)
/** 시연 전 초기화: 보고서 결재·전송 기록을 지운다 (이 브라우저·이 주소의 저장만) */
function resetDemo() {
  flow.resetAll()
  cleared.value = true
}

/** 데모 계정 칸을 누르면 아이디·비밀번호를 채운다 */
function fill(id: string, pw: string) {
  userId.value = id
  password.value = pw
}

async function submit() {
  busy.value = true
  failed.value = false
  unreachable.value = false
  try {
    failed.value = !(await login(userId.value, password.value))
  } catch {
    unreachable.value = true
  } finally {
    busy.value = false
  }
  if (failed.value || unreachable.value) return
  // 로그인 후 원래 가려던 화면, 없으면 대시보드 (FN-016)
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : DEFAULT_PATH()
  router.replace(redirect)
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <h1><BaseIcon name="factory" :size="24" />라인가동현황</h1>
      <BaseInput v-model="userId" label="아이디" autocomplete="username" :invalid="failed" />
      <BaseInput v-model="password" label="비밀번호" type="password" autocomplete="current-password" :invalid="failed" />
      <p v-if="failed" class="error" role="alert">아이디 또는 비밀번호가 맞지 않습니다</p>
      <p v-else-if="unreachable" class="error" role="alert">서버에 연결할 수 없습니다</p>
      <BaseButton variant="primary" type="submit" :disabled="busy">로그인</BaseButton>
      <div v-if="demo" class="demo">
        <p class="note">시연용 데모 계정 (비밀번호 1234) · 누르면 채워집니다</p>
        <ul>
          <li v-for="a in DEMO_LOGINS" :key="a.loginId">
            <button type="button" @click="fill(a.loginId, a.password)"><b>{{ a.roleName }}</b><span>{{ a.loginId }} · {{ a.name }}{{ a.lines.length ? ` · ${a.lines.join('·')}라인` : '' }}</span></button>
          </li>
        </ul>
        <button type="button" class="reset" @click="resetDemo">{{ cleared ? '초기화했습니다' : '시연 기록 초기화 (결재·전송 기록 지우기)' }}</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: var(--page-gutter);
}

.card {
  display: grid;
  gap: var(--sp-4);
  width: min(100%, var(--popover-w));
  padding: var(--sp-8);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-3);
  background: var(--c-surface);
}

h1 {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
  font-size: var(--fs-lg);
  font-weight: var(--fw-strong);
}

.card :deep(.btn) {
  height: var(--control-h-lg);
  margin-top: var(--sp-2);
}

.error {
  color: var(--c-down);
  font-size: var(--fs-md);
}

.note {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.demo ul {
  display: grid;
  gap: var(--sp-1);
  margin: var(--sp-2) 0 0;
  padding: 0;
  list-style: none;
}

.demo button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-w) solid var(--c-line);
  border-radius: var(--r-1);
  background: var(--c-surface);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.demo .reset {
  justify-content: center;
  margin-top: var(--sp-2);
  color: var(--c-ink-3);
}

.demo button span {
  color: var(--c-ink-3);
}
</style>
