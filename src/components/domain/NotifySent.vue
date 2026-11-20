<!-- 알림 발송 결과 (D-63): 메일 성공/실패 (슬랙 없음, D-110). 고장(D)만 보내므로 결과가 없으면 "-"
     실패는 빨강을 쓰지 않는다 (빨강 = 고장 하나의 뜻, D-106) → ✗ 아이콘 + "실패" 글자 + 굵게 밑줄 -->
<script setup lang="ts">
import BaseIcon from '@/components/base/BaseIcon.vue'
import type { NotifyResult } from '@/types/events'

defineProps<{ notify: NotifyResult | null }>()
</script>

<template>
  <span v-if="notify" class="sent">
    <span :class="{ fail: !notify.email }"><BaseIcon :name="notify.email ? 'check' : 'x'" :size="14" />메일<template v-if="!notify.email"> 실패</template></span>
  </span>
  <span v-else class="none">-</span>
</template>

<style scoped>
.sent {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  color: var(--c-ink-2);
}

.sent > span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.sent .fail {
  color: var(--c-ink);
  font-weight: var(--fw-strong);
  text-decoration: underline var(--indicator-w) var(--c-ink-3);
  text-underline-offset: 3px;
}

.none {
  color: var(--c-ink-3);
}
</style>
