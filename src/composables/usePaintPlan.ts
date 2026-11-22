// 도장 운영 판단 (11/21, PT-01·PT-02): 10초마다 다시 읽고, [제안대로 적용]·경로 직접 바꾸기
// 계산은 서버(PaintPlanner)만 해요. 화면은 판단과 근거를 보여 주고 적용만 요청해요
import { onMounted, onUnmounted, ref } from 'vue'
import { source } from '@/data'
import { useMaster } from '@/composables/useMaster'
import type { PaintPlan } from '@/types/paint'

/** active = false면 부르지 않아요 (같은 화면을 쓰는 라인 공정 상세) */
export function usePaintPlan(active = true) {
  const plan = ref<PaintPlan | null>(null)
  const busy = ref(false)
  const message = ref('')
  const error = ref('')
  const { reload } = useMaster()

  async function refresh() {
    try {
      plan.value = await source.q.getPaintPlan()
    } catch {
      // 서버에 닿지 못하면 지난 값 그대로 (다음 10초에 다시)
    }
  }

  /** 제안대로 적용: 서버가 그 순간 다시 계산해서 적용 (화면 값이 몇 초 지났어도 안전) */
  async function apply() {
    busy.value = true
    error.value = ''
    message.value = ''
    const r = await source.cmd.applyPaintPlan()
    busy.value = false
    if (!r.ok) { error.value = r.error; return }
    plan.value = r.value.plan
    message.value = r.value.done.length ? `적용했습니다: ${r.value.done.join(' · ')}` : '바꿀 것이 없었습니다 (지금 운영이 맞습니다)'
    await reload()   // 배치도·3D·공정 탭이 새 경로를 쓰게
  }

  /** 경로 직접 바꾸기 (M-09). 운휴 중인 도장으로 보내면 서버가 그 도장을 다시 켜요 */
  async function route(lineId: string, paintId: string) {
    busy.value = true
    error.value = ''
    message.value = ''
    const r = await source.cmd.setPaintRoute(lineId, paintId, '도장 운영 화면에서 직접 변경')
    busy.value = false
    if (!r.ok) { error.value = r.error; return }
    message.value = `${lineId}라인 제품을 ${paintId}로 보냅니다`
    await reload()
    await refresh()
  }

  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => { if (!active) return; void refresh(); timer = setInterval(refresh, 10_000) })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { plan, busy, message, error, apply, route, refresh }
}
