// (base 부품용 도우미: 화면 상태가 아니라 초점 처리라 base에 둔다) 표·목록 안 한 줄 편집 (조치 메모): 한 번에 한 건만. 열면 입력 칸에 초점, 닫으면(저장·취소·Esc) 연 버튼으로 초점을 돌려준다 (WCAG 2.4.3)
// 템플릿: 여는 버튼에 :data-edit="attr(id, 'open')", 편집 form에 :data-edit="attr(id, 'form')"
import { nextTick, ref } from 'vue'

export function useInlineEdit(scope: string) {
  const editing = ref<string | null>(null)
  const draft = ref('')
  /** 저장 실패 문구. 실패하면 칸을 닫지 않아 다시 저장할 수 있다 */
  const error = ref('')
  const busy = ref(false)
  const attr = (id: string, part: 'open' | 'form') => `${scope}:${id}:${part}`
  const el = (id: string, part: 'open' | 'form') => document.querySelector<HTMLElement>(`[data-edit="${CSS.escape(attr(id, part))}"]`)

  function open(id: string, text: string) {
    editing.value = id
    draft.value = text
    error.value = ''
    nextTick(() => el(id, 'form')?.querySelector<HTMLElement>('input, textarea')?.focus())
  }
  function close() {
    const id = editing.value
    editing.value = null
    error.value = ''
    if (id) nextTick(() => el(id, 'open')?.focus())
  }
  /** 저장이 끝나면 닫고, 실패하면 문구를 띄우고 열어 둔다 */
  async function submit(save: () => Promise<unknown>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await save()
      close()
    } catch {
      error.value = '메모를 저장하지 못했습니다'
    } finally {
      busy.value = false
    }
  }

  return { editing, draft, error, busy, attr, open, close, submit }
}
