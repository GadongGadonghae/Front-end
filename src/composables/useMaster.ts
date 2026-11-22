// 기준정보 (라인·공정·설비 39대·관리값 기준). 한 번만 불러와 앱 전체가 같이 쓴다
import { computed, shallowRef } from 'vue'
import { source } from '@/data'
import type { Equipment, MasterData } from '@/types/plant'

const master = shallowRef<MasterData | null>(null)
let loading: Promise<MasterData> | null = null

/**
 * 도장 경로만 맞추기 (11/21): 결재·다른 화면에서 경로를 바꾸면 배치도·3D·공정 탭이 따라오게.
 * 경로가 실제로 바뀐 때만 새 객체로 바꿔요 (안 바뀌면 화면이 다시 그려지지 않게)
 */
async function syncRoutes() {
  if (!master.value) return
  let next: MasterData
  try { next = await source.q.getMaster() } catch { return }
  const now = master.value
  if (!now) return
  const changed = now.lines.some((l) => (next.lines.find((x) => x.id === l.id)?.currentPaintId ?? l.currentPaintId) !== l.currentPaintId)
  if (!changed) return
  master.value = { ...now, lines: now.lines.map((l) => ({ ...l, currentPaintId: next.lines.find((x) => x.id === l.id)?.currentPaintId ?? l.currentPaintId })) }
}

export function useMaster() {
  if (!loading) loading = source.q.getMaster().then((m) => (master.value = m))

  const equipmentById = computed(() => new Map<string, Equipment>((master.value?.equipment ?? []).map((e) => [e.id, e])))

  /** 설비 이름 (예: B 프레스 3단). 모르면 ID 그대로 */
  const equipmentName = (id: string) => equipmentById.value.get(id)?.name ?? id

  /** 기준정보 다시 부르기 (관리값 기준을 저장한 뒤) */
  const reload = () => { loading = source.q.getMaster().then((m) => (master.value = m)); return loading }

  return { master, equipmentById, equipmentName, ready: loading, reload, syncRoutes }
}
