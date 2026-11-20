// 데모 원인 추적 (계획수정 보고서 "원인 추적"). 실서버는 백엔드 CauseTraceService가 DB 근거로 만든다.
// 같은 고장 건이면 늘 같은 장면. 값·알람·과거 이력은 모두 데모용 (CLAUDE.md 데모 값 표시: 출처를 "데모 데이터"로 둔다)
import type { CauseCandidate, CauseEvidence, CauseScorePart, CauseTrace, TraceSentence } from '@/types/report'
import type { HistoryEvent } from '@/types/events'
import type { Equipment } from '@/types/plant'
import { hash, noise, rng } from '@/data/mock/rand'
import { MASTER } from '@/data/mock/master'

/** 설비 종류별 대표 관리 항목과 기준 (seed.sql 기준값) */
const ITEMS: Record<string, { item: string; label: string; unit: string; lower: number; upper: number }[]> = {
  press: [
    { item: 'pressureLeft', label: '좌 압력', unit: 'bar', lower: 270, upper: 285.3 },
    { item: 'pressureRight', label: '우 압력', unit: 'bar', lower: 267, upper: 276.3 },
    { item: 'pressureDiff', label: '압력 차(좌-우)', unit: 'bar', lower: -1.8, upper: 12.5 },
    { item: 'pressTime', label: '가압 시간', unit: '0.01s', lower: 540, upper: 570.6 },
  ],
  welder: [{ item: 'current', label: '전류', unit: 'kA', lower: 14.52, upper: 15.07 }],
  painter: [{ item: 'temperature', label: '온도', unit: '℃', lower: 18.54, upper: 27.99 }],
  slitter: [{ item: 'torque', label: '토크', unit: 'N·m', lower: 20, upper: 60 }],
}
/** 데모 조치 메모 (설비 종류별) */
const MEMOS: Record<string, string[]> = {
  press: ['유압 실 교체 후 압력 재설정', '압력 센서 커넥터 재체결'],
  welder: ['전극 팁 드레싱 후 재가동', '냉각수 유량 확인 후 재가동'],
  painter: ['히터 온도 센서 교정', '순환 펌프 필터 청소'],
  slitter: ['나이프 간격 재조정', '모터 드라이브 리셋'],
  vision: ['카메라 렌즈 청소 후 재가동', '조명 케이블 재체결'],
}
const SOURCE = '데모 데이터'
const codeName = (code: string | null) => MASTER.downtimeCodes.find((d) => d.code === code)?.name ?? code ?? '고장'

const hms = (ms: number) => new Date(ms).toTimeString().slice(0, 8)
const fmt = (n: number) => { const k = Math.abs(n) < 100 ? 100 : 10; return String(Math.round(n * k) / k) }
const grade = (s: number): CauseCandidate['grade'] => (s >= 70 ? 'HIGH' : s >= 40 ? 'MEDIUM' : 'LOW')
const GRADE_WORD = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' } as const

/** 장면 3가지: 알람 + 기준 이탈(근거 강함) · 기준 쪽으로 치우침(보통) · 공정값 이상 없음(약함) */
export function demoCauseTrace(ev: HistoryEvent, e: Equipment): CauseTrace {
  const r = rng(hash('cause-trace', ev.id))
  const start = Date.parse(ev.start)
  const def = (ITEMS[e.type] ?? [])[e.type === 'press' ? Math.min(3, Math.max(0, e.order - 1)) : 0]
  const scene = def ? Math.floor(noise('cause-scene', ev.id, e.id) * 3) : 2
  const evidence: CauseEvidence[] = []
  const add = (type: CauseEvidence['type'], title: string, detail: string, at: number) => {
    const id = `E${evidence.length + 1}`
    evidence.push({ id, type, title, detail, at: new Date(at).toISOString(), source: SOURCE })
    return id
  }
  const end = ev.end ? Date.parse(ev.end) : null
  const fault = add('FAULT', `${e.name} ${codeName(ev.code)}`,
    `${hms(start)} 시작 · ${end ? `정지 ${Math.max(1, Math.round((end - start) / 60_000))}분 (종료 ${hms(end)})` : '진행 중'}`, start)

  let alarmId: string | null = null
  let trendId: string | null = null
  let alarmMin = 0
  if (def) {
    const half = (def.upper - def.lower) / 2
    const center = def.lower + half
    if (scene === 0) {
      alarmMin = 2 + Math.floor(r() * 6)
      const v = def.upper + half * (0.05 + r() * 0.1)
      alarmId = add('ALARM', `${def.label} 알람 (위험)`,
        `${def.label} 상한 초과 · 측정 ${fmt(v)}${def.unit} · 기준 ${fmt(def.lower)}~${fmt(def.upper)}${def.unit} · 고장 ${alarmMin}분 전 (${hms(start - alarmMin * 60_000)})`,
        start - alarmMin * 60_000)
    }
    const pct = scene === 0 ? 104 : scene === 1 ? 84 + Math.floor(r() * 5) : 20 + Math.floor(r() * 25)
    const recent = center + half * (pct / 100)
    const base = center + half * (0.15 + r() * 0.15)
    const out = scene === 0 ? 3 : 0
    trendId = add('TREND', `${def.label} 고장 전 1시간`,
      `직전 10분 평균 ${fmt(recent)}${def.unit} · 그 전 50분 평균 ${fmt(base)}${def.unit} · 기준 ${fmt(def.lower)}~${fmt(def.upper)}${def.unit} · 직전 10분 위험도 ${pct}% · 직전 10분 측정 5점 중 기준 이탈 ${out}점`,
      start)
    if (scene === 0) add('QUALITY', '고장 전 공정 판정', '직전 10분 공정 판정 5개 중 불량 3개', start)
  }
  const past = scene === 2 ? Math.floor(r() * 2) : 1 + Math.floor(r() * 3)
  const pastAlarm = scene === 0 ? past : 0
  const memos = MEMOS[e.type] ?? ['담당자 점검 후 재가동']
  const memo = past ? memos[Math.floor(r() * memos.length)] : null
  const history = add('HISTORY', '같은 설비 과거 고장', past
    ? `최근 30일 같은 설비 고장 ${past}건 · 평균 복구 ${18 + Math.floor(r() * 30)}분 · 고장 전 알람이 있던 건 ${pastAlarm}건 · 최근 조치 메모: “${memo}”`
    : '최근 30일 같은 설비 고장 없음 (이번이 처음)', start - 30 * 86_400_000)

  const causes: Omit<CauseCandidate, 'id'>[] = []
  const make = (label: string, item: string | null, parts: CauseScorePart[], cites: (string | null)[]) => {
    const score = parts.reduce((a, p) => a + p.points, 0)
    causes.push({ label, item, score, grade: grade(score), parts, evidence: cites.filter((x): x is string => !!x) })
  }
  const histPart = (hit: number): CauseScorePart => (past
    ? { label: '과거 사례', points: Math.round((30 * hit) / past), max: 30, note: `과거 고장 ${past}건 중 ${hit}건에서 같은 항목 알람` }
    : { label: '과거 사례', points: 0, max: 30, note: '최근 30일 같은 설비 고장 없음' })
  if (def && scene < 2) {
    make(`${def.label} 이상 (${scene === 0 ? '상한 초과' : '상한 쪽으로 치우침'})`, def.item, [
      scene === 0 ? { label: '직접 신호', points: 40, max: 40, note: '고장 전 30분 안에 알람 1건' } : { label: '직접 신호', points: 10, max: 40, note: '직전 10분 위험도 80% 이상' },
      scene === 0 ? { label: '시간 근접', points: alarmMin <= 5 ? 20 : 14, max: 20, note: `마지막 신호가 고장 ${alarmMin}분 전` } : { label: '시간 근접', points: 8, max: 20, note: '직전 10분 평균 기준 (특정 시점 없음)' },
      histPart(pastAlarm),
      { label: '데이터 완전성', points: 10, max: 10, note: '직전 10분 공정값 5점, 통신 끊김 없음' },
    ], [alarmId, trendId, history])
  }
  make('설비 자체 고장 (기계·전기 계통)', null, [
    !def ? { label: '직접 신호', points: 0, max: 40, note: '공정값이 없어 판단 근거 부족' }
      : scene === 2 ? { label: '직접 신호', points: 15, max: 40, note: '관리값 알람·이탈 없이 고장 신호만 있음' }
        : { label: '직접 신호', points: 0, max: 40, note: '관리값 이상이 있어 후순위' },
    { label: '시간 근접', points: 0, max: 20, note: '시점을 가리키는 신호 없음' },
    past ? { label: '과거 사례', points: Math.round((30 * (past - pastAlarm)) / past), max: 30, note: `과거 고장 ${past}건 중 ${past - pastAlarm}건이 알람 없이 발생` } : histPart(0),
    def ? { label: '데이터 완전성', points: 10, max: 10, note: '직전 10분 공정값 5점, 통신 끊김 없음' } : { label: '데이터 완전성', points: 0, max: 10, note: '직전 10분 공정값 없음' },
  ], [fault, trendId, history])
  const ranked: CauseCandidate[] = causes.sort((a, b) => b.score - a.score).map((c, i) => ({ ...c, id: `C${i + 1}` }))

  // 템플릿 문장 (백엔드 시연 모드와 같은 틀). 데모 값이 근거에서 나오므로 모두 검증 통과
  const top = ranked[0]
  const byId = new Map(evidence.map((x) => [x.id, x]))
  const sentences: TraceSentence[] = [{ text: `${e.name} 설비가 ${hms(start)}에 ${codeName(ev.code)} 사유로 멈췄습니다.`, kind: 'fact', evidence: [fault], verified: true, issue: null }]
  if (alarmId) sentences.push({ text: `고장 전 ${byId.get(alarmId)!.title}이 있었습니다: ${byId.get(alarmId)!.detail}.`, kind: 'fact', evidence: [alarmId], verified: true, issue: null })
  if (trendId && top.item) sentences.push({ text: `${byId.get(trendId)!.title} 기록: ${byId.get(trendId)!.detail}.`, kind: 'fact', evidence: [trendId], verified: true, issue: null })
  sentences.push({ text: `과거 이력: ${byId.get(history)!.detail}.`, kind: 'fact', evidence: [history], verified: true, issue: null })
  sentences.push({ text: `근거가 가장 강한 원인 후보는 ‘${top.label}’이며 근거 강도는 ${GRADE_WORD[top.grade]}(${top.score}점)입니다.`, kind: 'inference', evidence: [top.id, ...top.evidence], verified: true, issue: null })
  if (top.grade !== 'HIGH') sentences.push({ text: '근거 강도가 높지 않아 원인을 단정할 수 없으며 현장 확인이 필요합니다.', kind: 'inference', evidence: [top.id], verified: true, issue: null })
  sentences.push(top.item && def
    ? { text: `${def.label} 측정 센서와 관련 기구부를 먼저 점검하고, 재가동 뒤 값이 기준 ${fmt(def.lower)}~${fmt(def.upper)}${def.unit} 안에 드는지 확인하세요.`, kind: 'action', evidence: [top.id, ...top.evidence], verified: true, issue: null }
    : { text: '관리값에서 뚜렷한 이상이 보이지 않으므로 모터·구동부·전기 계통과 안전장치를 먼저 점검하세요.', kind: 'action', evidence: [top.id, fault], verified: true, issue: null })
  if (memo) sentences.push({ text: `지난 고장의 조치 메모를 참고하세요: “${memo}”`, kind: 'action', evidence: [history], verified: true, issue: null })

  return {
    windowFrom: new Date(start - 3_600_000).toISOString(), windowTo: new Date(start).toISOString(),
    evidence, causes: ranked, sentences, verifiedCount: sentences.length, model: 'mock-template', mock: true, fallbackReason: null,
  }
}
