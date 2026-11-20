// AI 리포트 결재·전송 (11/20 확정): 작성(생산 관리 팀장) → 결재 완료(공장장) → 전송 완료(공장장, 결재 완료 후에만)
// 상태는 모두에게 보인다. 전송된 보고서는 임시 MES(/mes)에서 캠퍼스장이 열람한다
// 문서 내용(MES 열람·.doc용)은 브라우저 저장소(localStorage)에 두고, 상태는 서버에도 기록한다 (11/20 R-10·R-13·R-14)
//   → 서버가 결재 때 계획·도장 경로에 적용하고, 전송된 보고서는 서버 MES 수신함(M-01)에도 들어간다. 데모 데이터는 저장소만
import { computed, ref } from 'vue'
import { source } from '@/data'
import { useAuth } from '@/composables/useAuth'
import type { DailyDocData } from '@/lib/dailyDoc'
import type { ReplanDocData } from '@/lib/replanDoc'

const KEY = 'sfaas.reportFlow.v1'

/** 이 시스템이 도입된 곳: 차체 캠퍼스 공장 1 (서버가 생기면 서버 설정 고정값으로 내려받음) */
export const OUR_PLANT = { campusId: 'BODY', factoryId: 1 } as const

export type FlowStatus = 'WRITTEN' | 'APPROVED' | 'SENT'
export const FLOW_NAME: Record<FlowStatus, string> = { WRITTEN: '작성', APPROVED: '결재 완료', SENT: '전송 완료' }

/** 보고서 한 건의 결재 기록 + 작성 때 찍어 둔 문서 내용 (MES 열람·.doc 내려받기용) */
export interface ReportFlow {
  /** daily:2026-11-20 · replan:보고서ID */
  key: string
  kind: 'daily' | 'replan'
  title: string
  /** 어느 캠퍼스·공장 보고서인지 (임시 MES 구분용). 옛 저장값에는 없을 수 있음 */
  campusId?: string
  factoryId?: number
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
/** 마지막 서버 기록 실패 문구 (화면에 보여 줌) */
const lastError = ref('')

/** 서버에도 기록. 실패하면 문구를 남기고 false (저장소는 바꾸지 않음) */
async function server(action: 'write' | 'approve' | 'send', key: string, content?: unknown): Promise<boolean> {
  lastError.value = ''
  try {
    await source.cmd.syncReportFlow(action, key, content)
    return true
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : '서버에 기록하지 못했습니다'
    return false
  }
}

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
  async function write(key: string, kind: ReportFlow['kind'], title: string, doc: DailyDocData | ReplanDocData) {
    if (!can('reportWrite') || store.value[key]?.status === 'SENT') return
    if (!(await server('write', key, doc))) return
    put({
      key, kind, title, ...OUR_PLANT, status: 'WRITTEN', writtenBy: userName.value, writtenAt: now(),
      approvedBy: null, approvedAt: null, sentBy: null, sentAt: null,
      ...(kind === 'daily' ? { daily: doc as DailyDocData } : { replan: doc as ReplanDocData }),
    })
  }

  /** 공장장: 결재 */
  async function approve(key: string) {
    const f = store.value[key]
    if (!f || f.status !== 'WRITTEN' || !can('reportApprove')) return
    if (!(await server('approve', key))) return
    put({ ...f, status: 'APPROVED', approvedBy: userName.value, approvedAt: now() })
  }

  /** 공장장: 보고서 전송 (결재 완료 후에만) → MES */
  async function send(key: string) {
    const f = store.value[key]
    if (!f || f.status !== 'APPROVED' || !can('reportApprove')) return
    if (!(await server('send', key))) return
    put({ ...f, status: 'SENT', sentBy: userName.value, sentAt: now() })
  }

  /** MES에 보일 보고서: 전송 완료만, 최근 전송 순 */
  const sent = computed(() => Object.values(store.value).filter((f) => f.status === 'SENT').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? '')))

  /** 시연 전 초기화: 결재·전송 기록을 모두 지운다 */
  function resetAll() {
    store.value = {}
    save()
  }

  return { flowOf, write, approve, send, sent, resetAll, lastError }
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
