// AI 리포트 결재·전송 (11/20 확정): 작성 중(생산 관리 팀장이 AI 보고서를 만들기만) → 작성 완료·결재 요청(팀장) → 결재 완료(공장장) → 전송 완료(공장장)
// 결재 요청 전에는 공장장에게 알리지 않고, 결재 전에는 팀장이 회수할 수 있다 (회수하면 작성 중으로 → 값 고친 뒤 다시 결재 요청)
// 🆕 11/20: 실서버(api)에서는 결재 상태를 서버(R-11)에서 읽는다 → 다른 컴퓨터·브라우저에서도 같은 상태, 리셋하면 같이 비워짐
//   브라우저 저장소(localStorage)는 데모 데이터(mock)일 때 상태, 그리고 .doc용 문서 사본만 둔다
// 전송된 보고서는 임시 MES(/mes)에서 캠퍼스장이 열람한다 (실서버는 M-01 수신함)
import { now as clockNow } from '@/clock'
import { computed, ref } from 'vue'
import { source } from '@/data'
import { useAuth } from '@/composables/useAuth'
import type { DailyDocData } from '@/lib/dailyDoc'
import type { ReplanDocData } from '@/lib/replanDoc'
import type { ReportFlowRecord, ReportFlowStatus } from '@/types/report'

const KEY = 'sfaas.reportFlow.v1'
/** 서버 결재 상태 다시 읽기 주기. 다른 사람이 결재 요청·결재하면 이만큼 뒤에 보인다 */
const POLL_MS = 5_000

/** 이 시스템이 도입된 곳: 차체 캠퍼스 공장 1 (서버가 생기면 서버 설정 고정값으로 내려받음) */
export const OUR_PLANT = { campusId: 'BODY', factoryId: 1 } as const

export type FlowStatus = ReportFlowStatus
export const FLOW_NAME: Record<FlowStatus, string> = { DRAFT: '작성 중', WRITTEN: '결재 요청', APPROVED: '결재 완료', SENT: '전송 완료' }

/** 보고서 한 건의 결재 기록 + 문서 내용 (MES 열람·.doc 내려받기용) */
export interface ReportFlow {
  /** daily:2026-11-20 · replan:보고서ID */
  key: string
  kind: 'daily' | 'replan'
  title: string
  /** 어느 캠퍼스·공장 보고서인지 (임시 MES 구분용). 옛 저장값에는 없을 수 있음 */
  campusId?: string
  factoryId?: number
  status: FlowStatus
  writtenBy: string | null
  writtenAt: string | null
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

/** 브라우저 기록: 데모 데이터일 때 상태 + 문서 사본 */
const local = ref<Record<string, ReportFlow>>(read())
/** 서버 결재 상태 (실서버). null = 서버 없음(데모 데이터) 또는 아직 못 읽음 */
const server = ref<Record<string, ReportFlow> | null>(null)
/** 데모 데이터면 true (서버가 null을 줌) */
const localOnly = ref(false)
/** 임시 MES 수신함 (실서버, M-01) */
const mes = ref<ReportFlow[] | null>(null)
/** 마지막 서버 기록 실패 문구 (화면에 보여 줌) */
const lastError = ref('')

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(local.value))
  } catch {
    // 저장소를 못 쓰는 환경: 이 창 안에서만 유지
  }
}

// 다른 탭에서 바꾸면 바로 반영 (데모 데이터)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) local.value = read()
  })
}

/** 서버 기록 → 결재 기록. 문서 사본은 서버(결재 요청 때 찍은 것) → 이 브라우저 순 */
function fromRecord(r: ReportFlowRecord): ReportFlow {
  const mine = local.value[r.key]
  const doc = r.doc ?? null
  return {
    key: r.key, kind: r.kind, title: r.title, campusId: r.campusId, factoryId: r.factoryId, status: r.status,
    // 작성 중이면 "작성"한 사람·시각은 아직 없음 (만든 시각일 뿐)
    writtenBy: r.status === 'DRAFT' ? null : r.writtenBy,
    writtenAt: r.status === 'DRAFT' ? null : r.writtenAt,
    approvedBy: r.approvedBy, approvedAt: r.approvedAt, sentBy: r.sentBy, sentAt: r.sentAt,
    daily: r.kind === 'daily' ? ((doc as DailyDocData | null) ?? mine?.daily) : undefined,
    replan: r.kind === 'replan' ? ((doc as ReplanDocData | null) ?? mine?.replan) : undefined,
  }
}

/** 서버 결재 상태 다시 읽기. 로그인 전·실패면 그대로 둔다 */
async function refresh() {
  try {
    const rows = await source.q.getReportFlows()
    if (rows === null) { localOnly.value = true; server.value = null; return }
    localOnly.value = false
    server.value = Object.fromEntries(rows.map((r) => [r.key, fromRecord(r)]))
  } catch {
    // 로그인 전이거나 서버가 잠깐 안 됨 → 다음에 다시
  }
}

/** 임시 MES 수신함 다시 읽기 (캠퍼스장) */
async function refreshMes() {
  try {
    const rows = await source.q.getMesReports()
    mes.value = rows === null ? null : rows.map(fromRecord)
  } catch {
    // 권한 없음(캠퍼스장 아님)·서버 안 됨 → 그대로
  }
}

let timer: ReturnType<typeof setInterval> | null = null
function startPolling() {
  if (timer || typeof window === 'undefined') return
  refresh()
  timer = setInterval(refresh, POLL_MS)
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

/** 서버에 기록. 실패하면 문구를 남기고 false */
async function server_(action: 'write' | 'recall' | 'approve' | 'send', key: string, content?: unknown): Promise<boolean> {
  lastError.value = ''
  try {
    await source.cmd.syncReportFlow(action, key, content)
    return true
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : '서버에 기록하지 못했습니다'
    return false
  }
}

export function useReportFlow() {
  const { userName, can } = useAuth()
  const now = () => new Date(clockNow()).toISOString()
  startPolling()

  /** 지금 결재 기록: 실서버면 서버 상태(+문서 사본), 데모 데이터면 브라우저 기록 */
  const flowOf = (key: string | null): ReportFlow | null => {
    if (!key) return null
    const f = localOnly.value ? local.value[key] : server.value?.[key]
    return f ? withStatus(f) : null
  }

  /** 브라우저 기록 (데모 상태 · 문서 사본) */
  function putLocal(f: ReportFlow) {
    local.value = { ...local.value, [f.key]: withStatus(f) }
    save()
  }

  /** 팀장: 작성 완료 · 결재 요청 (작성 중이거나 아직 기록이 없을 때). 이때 공장장에게 결재 알림 */
  async function write(key: string, kind: ReportFlow['kind'], title: string, doc: DailyDocData | ReplanDocData) {
    const f = flowOf(key)
    if (!can('reportWrite') || (f && f.status !== 'DRAFT')) return
    if (!(await server_('write', key, doc))) return
    putLocal({
      key, kind, title, ...OUR_PLANT, status: 'WRITTEN', writtenBy: userName.value, writtenAt: now(),
      approvedBy: null, approvedAt: null, sentBy: null, sentAt: null,
      ...(kind === 'daily' ? { daily: doc as DailyDocData } : { replan: doc as ReplanDocData }),
    })
    await refresh()
  }

  /** 팀장: 회수 (결재 요청 중일 때만) → 작성 중. 값을 고친 뒤 다시 결재 요청 */
  async function recall(key: string) {
    const f = flowOf(key)
    if (!f || f.status !== 'WRITTEN' || !can('reportWrite')) return
    if (!(await server_('recall', key))) return
    if (local.value[key]) putLocal({ ...local.value[key], status: 'DRAFT', writtenBy: null, writtenAt: null })
    await refresh()
  }

  /** 공장장: 결재 (결재 요청 중일 때만). 계획수정이면 서버가 계획에 적용 (추가 주문은 라인 가동까지) */
  async function approve(key: string) {
    const f = flowOf(key)
    if (!f || f.status !== 'WRITTEN' || !can('reportApprove')) return false
    if (!(await server_('approve', key))) return false
    if (local.value[key]) putLocal({ ...local.value[key], status: 'APPROVED', approvedBy: userName.value, approvedAt: now() })
    await refresh()
    return true
  }

  /** 공장장: 보고서 전송 (결재 완료 후에만) → MES */
  async function send(key: string) {
    const f = flowOf(key)
    if (!f || f.status !== 'APPROVED' || !can('reportApprove')) return
    if (!(await server_('send', key))) return
    if (local.value[key]) putLocal({ ...local.value[key], status: 'SENT', sentBy: userName.value, sentAt: now() })
    await refresh()
  }

  /** 결재 요청이 올라온 보고서 (공장장 알림용): 최근 요청 순 */
  const requested = computed(() => {
    const all = localOnly.value ? Object.values(local.value) : Object.values(server.value ?? {})
    return all.filter((f) => f.status === 'WRITTEN').sort((a, b) => (b.writtenAt ?? '').localeCompare(a.writtenAt ?? ''))
  })

  /** MES에 보일 보고서: 전송 완료만, 최근 전송 순 (실서버는 M-01 수신함) */
  const sent = computed(() => {
    const all = mes.value ?? Object.values(local.value).filter((f) => f.status === 'SENT')
    return all.map(withStatus).sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
  })

  /** 시연 전 초기화: 이 브라우저의 결재 기록을 지운다 (서버 기록은 demo_reset.sql이 지움) */
  function resetAll() {
    local.value = {}
    save()
  }

  return { flowOf, write, recall, approve, send, requested, sent, refresh, refreshMes, resetAll, lastError }
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
