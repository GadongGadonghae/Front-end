// 기준정보 (라인·공정·설비 39대·관리값 기준). 한 번만 불러와 앱 전체가 같이 쓴다
import { computed, shallowRef } from 'vue'
import { source } from '@/data'
import type { Equipment, MasterData } from '@/types/plant'

const master = shallowRef<MasterData | null>(null)
let loading: Promise<MasterData> | null = null

export function useMaster() {
  if (!loading) loading = source.q.getMaster().then((m) => (master.value = m))

  const equipmentById = computed(() => new Map<string, Equipment>((master.value?.equipment ?? []).map((e) => [e.id, e])))

  /** 설비 이름 (예: B 프레스 3단). 모르면 ID 그대로 */
  const equipmentName = (id: string) => equipmentById.value.get(id)?.name ?? id

  /** 기준정보 다시 부르기 (관리값 기준을 저장한 뒤) */
  const reload = () => { loading = source.q.getMaster().then((m) => (master.value = m)); return loading }

  return { master, equipmentById, equipmentName, ready: loading, reload }
}
