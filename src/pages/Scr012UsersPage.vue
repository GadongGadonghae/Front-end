<!-- 설정 · 사용자 관리 (API 명세 C-02 목록 · C-03 등록, 11/20)
     왼쪽: 새 사용자 등록 (아이디 · 비밀번호 · 이름 · 역할 · 이메일 · 메모). 오른쪽: 사용자 목록 (최근 로그인 포함)
     수정·삭제 API는 아직 없어서 등록만 해요 -->
<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'
import { settingsTabsFor } from '@/lib/permissions'
import { computed, ref, shallowRef } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import BasePanel from '@/components/base/BasePanel.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/base/BaseTable.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import { source } from '@/data'
import { formatTime, toDateStr } from '@/lib/format'
import { ROLE_LABEL, type UserRole, type UserRow } from '@/types/user'

// 권한 있는 설정 탭만 (11/20, lib/permissions.ts)
const { role: myRole } = useAuth()
const TABS = computed(() => settingsTabsFor(myRole.value))
// 권한 3가지 (11/20). 할 수 있는 일은 lib/permissions.ts
const ROLES: { value: UserRole; label: string }[] = [
  { value: 'LINE_MANAGER', label: ROLE_LABEL.LINE_MANAGER },
  { value: 'PRODUCTION_MANAGER', label: ROLE_LABEL.PRODUCTION_MANAGER },
  { value: 'PLANT_MANAGER', label: ROLE_LABEL.PLANT_MANAGER },
  { value: 'CAMPUS_HEAD', label: ROLE_LABEL.CAMPUS_HEAD },
]
const roleName = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r
const COLS: TableColumn[] = [
  { key: 'loginId', label: '아이디' },
  { key: 'name', label: '이름' },
  { key: 'role', label: '역할' },
  { key: 'email', label: '이메일' },
  { key: 'last', label: '최근 로그인' },
  { key: 'memo', label: '메모' },
]

// ── 목록 ──
const users = shallowRef<UserRow[] | null>(null)
const loadError = ref('')
const load = () => source.q.getUsers()
  .then((l) => { users.value = l; loadError.value = '' })
  .catch((e) => { users.value = []; loadError.value = e instanceof Error ? e.message : '목록을 불러오지 못했습니다' })
load()
const rows = computed(() => (users.value ?? []).map((u) => ({
  ...u, key: u.loginId,
  last: u.lastLoginAt ? `${toDateStr(Date.parse(u.lastLoginAt))} ${formatTime(u.lastLoginAt).slice(0, 5)}` : '-',
})))

// ── 등록 ──
const loginId = ref('')
const password = ref('')
const name = ref('')
const role = ref<UserRole>('LINE_MANAGER')
const email = ref('')
const memo = ref('')
const saving = ref(false)
const error = ref('')
const saved = ref('')

function check(): string {
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(loginId.value.trim())) return '아이디는 영문·숫자 3~30자로 입력하세요'
  if (password.value.length < 4) return '비밀번호는 4자 이상으로 입력하세요'
  if (!name.value.trim() || name.value.trim().length > 20) return '이름은 1~20자로 입력하세요'
  if (email.value && !/^[^@\s]+@[^@\s]+$/.test(email.value.trim())) return '이메일 형식이 아닙니다'
  if (memo.value.length > 200) return '메모는 200자까지 쓸 수 있습니다'
  return ''
}

async function save() {
  error.value = check()
  saved.value = ''
  if (error.value || saving.value) return
  saving.value = true
  const r = await source.cmd.createUser({
    loginId: loginId.value.trim(), password: password.value, name: name.value.trim(), role: role.value,
    email: email.value.trim() || undefined, memo: memo.value.trim() || undefined,
  })
  saving.value = false
  if (!r.ok) { error.value = r.error; return }
  saved.value = `${r.value.loginId} 등록했습니다`
  loginId.value = ''
  password.value = ''
  name.value = ''
  email.value = ''
  memo.value = ''
  load()
}
</script>

<template>
  <PageLayout>
    <template #head>
      <h1 class="title">설정</h1>
      <BaseTabs :items="TABS" active="users" label="설정 종류" />
    </template>

    <div class="layout">
      <BasePanel title="새 사용자 등록" meta="로그인 계정">
        <form class="form" autocomplete="off" @submit.prevent="save">
          <BaseInput v-model="loginId" label="아이디" size="md" autocomplete="off" />
          <BaseInput v-model="password" label="비밀번호" type="password" size="md" autocomplete="new-password" />
          <BaseInput v-model="name" label="이름" size="md" />
          <BaseSelect v-model="role" label="권한" :options="ROLES" />
          <BaseInput v-model="email" label="이메일 (선택)" size="md" />
          <BaseInput v-model="memo" label="메모 (선택)" size="md" />
          <div class="actions">
            <BaseButton type="submit" variant="primary" :disabled="saving">{{ saving ? '등록 중…' : '등록' }}</BaseButton>
            <p v-if="error" class="msg err" role="alert">{{ error }}</p>
            <p v-else-if="saved" class="msg ok" role="status">{{ saved }}</p>
          </div>
          <ul class="rules">
            <li>같은 아이디는 등록할 수 없음</li>
            <li>비밀번호는 서버에 암호화해서 저장</li>
            <li>수정·삭제는 아직 지원하지 않음</li>
          </ul>
        </form>
      </BasePanel>

      <BasePanel title="사용자 목록" :meta="users ? `${users.length}명` : '불러오는 중'">
        <p v-if="loadError" class="msg err" role="alert">{{ loadError }}</p>
        <BaseTable v-else-if="rows.length" label="사용자 목록" :columns="COLS" :rows="rows" :row-key="(r) => r.key">
          <template #cell-role="{ row }">{{ roleName(row.role) }}</template>
          <template #cell-email="{ row }">{{ row.email ?? '-' }}</template>
          <template #cell-memo="{ row }">{{ row.memo ?? '-' }}</template>
        </BaseTable>
        <BaseEmpty v-else :text="users ? '사용자가 없습니다' : '불러오는 중'" />
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
  grid-template-columns: var(--col-form) minmax(0, 1fr);
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}

.msg {
  margin: 0;
  font-size: var(--fs-sm);
}

.msg.err {
  color: var(--c-down);
}

.msg.ok {
  color: var(--c-ink-2);
}

.rules {
  margin: var(--sp-2) 0 0;
  padding-left: 1.2em;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  line-height: 1.6;
}
</style>
