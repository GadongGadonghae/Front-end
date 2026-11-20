// 도장 경로 (백엔드 C-04 라인 목록 · M-09 경로 전환, P1): 생산 라인마다 제품을 보낼 도장 설비(PT1·PT2)
// 바꾸면 백엔드가 Node-RED로 경로 명령(MQTT Q-03)을 보낸다. 바꾼 뒤 기준정보를 다시 불러 배치도·공정 상세가 새 경로를 쓴다
import { computed, ref } from 'vue'
import { source } from '@/data'
import { useMaster } from '@/composables/useMaster'
import { lineName } from '@/lib/status'

export function usePaintRoute() {
  const { master, reload, equipmentName } = useMaster()
  const saving = ref<string | null>(null)
  const message = ref('')
  const error = ref('')

  const painters = computed(() => (master.value?.equipment ?? []).filter((e) => e.type === 'painter').map((e) => ({ value: e.id, label: e.shortName })))
  const rows = computed(() => (master.value?.lines ?? []).filter((l) => l.kind === 'production').map((l) => ({
    lineId: l.id,
    name: lineName(l.id),
    current: l.currentPaintId ?? '',
    changed: l.currentPaintId !== l.defaultPaintId,
    defaultName: l.defaultPaintId ? equipmentName(l.defaultPaintId) : '-',
  })))

  /** 경로 바꾸기. 사유는 선택 (백엔드 M-09 본문 reason) */
  async function change(lineId: string, paintId: string, reason = '') {
    error.value = ''
    message.value = ''
    saving.value = lineId
    const r = await source.cmd.setPaintRoute(lineId, paintId, reason)
    saving.value = null
    if (!r.ok) { error.value = r.error; return }
    message.value = `${lineName(lineId)} 제품을 ${equipmentName(paintId)}(으)로 보냅니다`
    await reload()
  }

  return { painters, rows, change, saving, message, error }
}
