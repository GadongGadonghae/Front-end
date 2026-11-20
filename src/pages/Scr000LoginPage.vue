<!-- SCR-000 로그인 (화면정의서 3장 SCR-000, FN-016): 아이디·비밀번호, 실패 메시지만, 회원가입 없음 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseIcon from '@/components/base/BaseIcon.vue'
import { useAuth } from '@/composables/useAuth'
import { useDataInfo } from '@/composables/useDataInfo'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()
const { demo } = useDataInfo()

const userId = ref('')
const password = ref('')
const failed = ref(false)
const unreachable = ref(false)
/** 로그인은 됐지만 권한 코드를 모를 때 (예전 계정, DB v0.3.13 전) */
const roleError = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  failed.value = false
  unreachable.value = false
  roleError.value = ''
  try {
    failed.value = !(await login(userId.value, password.value))
  } catch (e) {
    if (e instanceof Error && e.message.includes('권한')) roleError.value = e.message
    else unreachable.value = true
  } finally {
    busy.value = false
  }
  if (failed.value || unreachable.value || roleError.value) return
  // 로그인 후 원래 가려던 화면, 없으면 대시보드 (FN-016)
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
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
      <p v-else-if="roleError" class="error" role="alert">{{ roleError }}</p>
      <BaseButton variant="primary" type="submit" :disabled="busy">로그인</BaseButton>
      <p v-if="demo" class="note">데모 데이터: 아이디·비밀번호를 아무거나 입력하면 들어갑니다 (prodlead = 생산관리팀장, linelead = 라인 담당자, 그 밖 = 공장장)</p>
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
</style>
