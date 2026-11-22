<!-- 조치 메모 펼침 (D-109, 시안 D4): 표의 그 행 바로 아래에 펼친다.
     왼쪽 = 그 건의 사정(상세 · 지속 · 메일 발송), 오른쪽 = 3줄 입력칸 + 취소 · 저장. 담당자는 저장한 로그인 사용자 (D-84)
     Esc = 취소, Ctrl+Enter = 저장. 저장 실패는 입력칸 아래에 문구 (쓴 글은 그대로). 초점 처리(열면 입력칸, 닫으면 연 버튼)는 부르는 쪽의 useInlineEdit가 한다 -->
<script setup lang="ts">
import BaseTextarea from '@/components/base/BaseTextarea.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import NotifySent from '@/components/domain/NotifySent.vue'
import type { NotifyResult } from '@/types/events'

defineProps<{
  /** 무엇에 대한 메모인지: "B라인 프레스 3단 · 14:08:04 · 장비고장(알람)" */
  subject: string
  detail: string
  duration: string
  ongoing: boolean
  notify: NotifyResult | null
  /** 마지막 저장 "이민재 · 11:52". 없으면 null */
  lastSaved: string | null
  saving?: boolean
  /** 저장 실패 문구. 없으면 '' */
  error?: string
}>()
const draft = defineModel<string>({ default: '' })
const emit = defineEmits<{ save: []; cancel: [] }>()
</script>

<template>
  <form class="editor" @submit.prevent="emit('save')" @keydown.esc.prevent="emit('cancel')" @keydown.ctrl.enter.prevent="emit('save')">
    <dl class="ctx">
      <dt>상세</dt><dd>{{ detail }}</dd>
      <dt>지속</dt><dd>{{ duration }}<template v-if="ongoing"> · 진행 중</template></dd>
      <dt>메일</dt><dd><NotifySent :notify="notify" /></dd>
    </dl>
    <div class="write">
      <BaseTextarea v-model="draft" label="조치 메모" :hint="subject" :rows="3" placeholder="무엇을 했는지 적기 (선택)" />
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <div class="act">
        <span class="note">{{ lastSaved ? `마지막 저장 ${lastSaved}` : '' }}</span>
        <BaseButton @click="emit('cancel')">취소</BaseButton>
        <BaseButton type="submit" variant="primary">{{ saving ? '저장 중' : '저장' }}</BaseButton>
      </div>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: var(--sp-6);
  white-space: normal;
}

.ctx {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: start;
  gap: var(--sp-2) var(--sp-3);
  margin: var(--sp-6) 0 0;
  font-size: var(--fs-sm);
}

.ctx dt {
  color: var(--c-ink-3);
}

.ctx dd {
  margin: 0;
}

.write {
  display: grid;
  gap: var(--sp-2);
}

.act {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.err {
  margin: 0;
  color: var(--c-ink);
  font-size: var(--fs-sm);
  font-weight: var(--fw-strong);
}

.note {
  margin-right: auto;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}
</style>
