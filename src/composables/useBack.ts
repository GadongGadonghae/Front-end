// 화면 안 [‹ 이전] 버튼 (11/21): 전체화면(F11)에서는 브라우저 뒤로 가기를 누를 수 없어서.
// 이 앱 안에서 넘어온 이전 화면이 있으면 그리로, 없으면(첫 화면·새로고침 직후) 버튼을 숨긴다
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useBack() {
  const route = useRoute()
  const router = useRouter()
  const canBack = computed(() => {
    void route.fullPath   // 화면이 바뀔 때마다 다시 계산
    const s = window.history.state as { back?: string | null } | null
    return !!s?.back && s.back !== '/login'
  })
  function goBack() { router.back() }
  return { canBack, goBack }
}
