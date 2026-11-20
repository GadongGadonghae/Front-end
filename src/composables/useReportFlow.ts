// AI 리포트 결재·전송 (11/20 확정): 작성(생산 관리 팀장) → 결재 완료(공장장) → 전송 완료(공장장, 결재 완료 후에만)
// 상태는 모두에게 보인다. 전송된 보고서는 임시 MES(/mes)에서 캠퍼스장이 열람한다
// 백엔드에 보고서 상태 API가 없어서 브라우저 저장소(localStorage)에 둔다 → 같은 주소·같은 브라우저에서만 이어진다
import { computed, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import type { DailyDocData } from '@/lib/dailyDoc'
import type { ReplanDocData } from '@/lib/replanDoc'

const KEY = 'sfaas.reportFlow.v1'

export type FlowStatus = 'WRITTEN' | 'APPROVED' | 'SENT'
export const FLOW_NAME: Record<FlowStatus, string> = { WRITTEN: '작성', APPROVED: '결재 완료', SENT: '전송 완료' }

/** 보고서 한 건의 결재 기록 + 작성 때 찍어 둔 문서 내용 (MES 열람·.doc 내려받기용) */
export interface ReportFlow {
  /** daily:2026-11-20 · replan:보고서ID */
  key: string
  kind: 'daily' | 'replan'
  title: string
  status: FlowStatus
  writtenBy: string
  writtenAt: string
  approvedBy: string | null
  approvedAt: string | null
  sentBy: string | null
  sentAt: string | null
  daily?: DailyDocData
  replan?: ReplanDocData
}

function read(): Record<string, ReportFlow> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ReportFlow>
  } catch {
    return {}
  }
}

const store = ref<Record<string, ReportFlow>>(read())

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.value))
  } catch {
    // 저장소를 못 쓰는 환경: 이 창 안에서만 유지
  }
}

// 다른 탭(예: 공장장 탭 ↔ MES 탭)에서 바꾸면 바로 반영
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) store.value = read()
  })
}

/** 문서 안 "문서 상태" 칸도 결재 상태로 맞춘다 */
function withStatus(f: ReportFlow): ReportFlow {
  const label = FLOW_NAME[f.status]
  return {
    ...f,
    daily: f.daily && { ...f.daily, values: { ...f.daily.values, STATUS: label } },
    replan: f.replan && { ...f.replan, docStatus: label },
  }
}

export function useReportFlow() {
  const { userName, can } = useAuth()
  const now = () => new Date().toISOString()

  const flowOf = (key: string | null) => (key ? store.value[key] ?? null : null)

  function put(f: ReportFlow) {
    store.value = { ...store.value, [f.key]: withStatus(f) }
    save()
  }

  /** 팀장: 작성 완료(결재 요청). 다시 누르면 내용을 새로 찍고 결재를 다시 받는다. 전송 뒤에는 못 바꾼다 */
  function write(key: string, kind: ReportFlow['kind'], title: string, doc: DailyDocData | ReplanDocData) {
    if (!can('reportWrite') || store.value[key]?.status === 'SENT') return
    put({
      key, kind, title, status: 'WRITTEN', writtenBy: userName.value, writtenAt: now(),
      approvedBy: null, approvedAt: null, sentBy: null, sentAt: null,
      ...(kind === 'daily' ? { daily: doc as DailyDocData } : { replan: doc as ReplanDocData }),
    })
  }

  /** 공장장: 결재 */
  function approve(key: string) {
    const f = store.value[key]
    if (!f || f.status !== 'WRITTEN' || !can('reportApprove')) return
    put({ ...f, status: 'APPROVED', approvedBy: userName.value, approvedAt: now() })
  }

  /** 공장장: 보고서 전송 (결재 완료 후에만) → MES */
  function send(key: string) {
    const f = store.value[key]
    if (!f || f.status !== 'APPROVED' || !can('reportApprove')) return
    put({ ...f, status: 'SENT', sentBy: userName.value, sentAt: now() })
  }

  /** MES에 보일 보고서: 전송 완료만, 최근 전송 순 */
  const sent = computed(() => Object.values(store.value).filter((f) => f.status === 'SENT').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? '')))

  /** 시연 전 초기화: 결재·전송 기록을 모두 지운다 */
  function resetAll() {
    store.value = {}
    save()
  }

  return { flowOf, write, approve, send, sent, resetAll }
}

const stamp = (who: string | null, at: string | null) => {
  if (!who || !at) return null
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${who} · ${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 결재 줄(ReportApproval)에 넘길 글 */
export function flowLine(f: ReportFlow | null) {
  return {
    status: f?.status ?? null,
    label: f ? FLOW_NAME[f.status] : '미작성',
    written: f ? stamp(f.writtenBy, f.writtenAt) : null,
    approved: f ? stamp(f.approvedBy, f.approvedAt) : null,
    sent: f ? stamp(f.sentBy, f.sentAt) : null,
    writer: f?.writtenBy ?? null,
    approver: f?.approvedBy ?? null,
  }
}
