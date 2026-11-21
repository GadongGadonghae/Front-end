// 계획수정 보고서 → Word(.doc) 내려받기. 시안 B-report의 [Google Docs(.doc)] 그대로:
// public/templates/production-plan-report-template.doc (UTF-16LE HTML 문서)의 "빈칸"을 순서대로 채우고 {{항목}}을 바꾼다

export interface ReplanDocData {
  documentNo: string
  generatedAt: string
  targetLine: string
  plan: number
  actual: number
  shortage: number
  /** 정지 지속 (초) */
  stopSec: number
  factLine: string
  factEquipment: string
  factStart: string
  factCause: string
  /** 남은 시간 (초) */
  remainingSec: number
  modelName: string
  docStatus: string
  author: string
  allocationText: string
  /** 표 줄: 라인(설비), 남은 계획, 남은 능력, 비율, 추가 배정 (이미 글자로) */
  rows: string[][]
  totalPlan: string
  totalCapacity: string
  totalAllocation: string
  resultGrade: string
  resultText: string
  actions: string[]
  risks: string[]
}

const TEMPLATE = '/templates/production-plan-report-template.doc'

const esc = (v: unknown) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** 3723초 → "1시간 2분 3초", 716초 → "11분 56초" */
function durationText(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}시간 ` : ''}${m}분 ${s % 60}초`
}

/** 양식을 채운 문서 HTML (Word 내려받기와 임시 MES 화면이 같은 문서를 쓰게, 11/21) */
export async function replanDocHtml(d: ReplanDocData): Promise<string> {
  const res = await fetch(TEMPLATE)
  if (!res.ok) throw new Error(`보고서 양식을 불러오지 못했습니다 (${res.status})`)
  let doc = new TextDecoder('utf-16le').decode(await res.arrayBuffer())

  // 양식의 "빈칸" 15곳: 머리표 → 1. 발생 현황 → 2. 생산 영향 순서
  const blanks = [
    d.documentNo, d.generatedAt, d.targetLine, `${d.plan}개`, `${d.actual}개`, `${d.shortage}개`, durationText(d.stopSec),
    d.factLine, d.factEquipment, d.factStart, d.factCause, durationText(d.remainingSec), `${d.shortage}개`, `${d.plan}개`, `${d.actual}개`,
  ]
  for (const v of blanks) doc = doc.replace('빈칸', esc(v))
  if (doc.includes('빈칸')) throw new Error('보고서 양식 값을 다 채우지 못했습니다')

  const font = 'font-size:9.0pt;font-family:"맑은 고딕";color:black'
  const cellFirst = 'border:solid black 1.0pt;border-top:none;mso-border-top-alt:solid black .75pt;mso-border-alt:solid black .75pt;padding:1.5pt 3.0pt 1.5pt 3.0pt'
  const cellRest = 'border-top:none;border-left:none;border-bottom:solid black 1.0pt;border-right:solid black 1.0pt;mso-border-top-alt:solid black .75pt;mso-border-left-alt:solid black .75pt;mso-border-alt:solid black .75pt;padding:1.5pt 3.0pt 1.5pt 3.0pt'
  const rows = d.rows.map((cells) => '<tr>' + cells.map((c, i) =>
    `<td style='${i === 0 ? cellFirst : cellRest}'><p class=MsoNormal${i === 0 ? '' : " align=right style='text-align:right'"}><span style='${font}'>${esc(c)}<o:p></o:p></span></p></td>`,
  ).join('') + '</tr>').join('\n')
  const actions = d.actions.map((a, i) =>
    `<p class=MsoNormal style='margin-top:0cm;margin-right:0cm;margin-bottom:1.0pt;margin-left:36.0pt;text-indent:-18.0pt;mso-list:l1 level1 lfo1;tab-stops:list 36.0pt'><![if !supportLists]><span style='${font}'><span style='mso-list:Ignore'>${i + 1}.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]><span style='${font}'>${esc(a)}<o:p></o:p></span></p>`,
  ).join('\n')
  const risks = d.risks.map((r) =>
    `<li class=MsoNormal style='color:black;margin-bottom:1.0pt;mso-list:l0 level1 lfo2;tab-stops:list 36.0pt'><span style='font-size:9.0pt;font-family:"맑은 고딕"'>${esc(r)}<o:p></o:p></span></li>`,
  ).join('\n')
  const sections: Record<string, string> = {
    TARGET_LINE: esc(d.factLine), MODEL_NAME: esc(d.modelName), DOC_STATUS: esc(d.docStatus), AUTHOR: esc(d.author),
    ALLOCATION_TEXT: esc(d.allocationText), ALLOCATION_ROWS: rows,
    TOTAL_PLAN: esc(d.totalPlan), TOTAL_CAPACITY: esc(d.totalCapacity), TOTAL_ALLOCATION: esc(d.totalAllocation),
    RESULT_GRADE: esc(d.resultGrade), RESULT_TEXT: esc(d.resultText), ACTIONS: actions, RISKS: risks,
  }
  for (const [k, html] of Object.entries(sections)) doc = doc.split(`{{${k}}}`).join(html)
  if (/\{\{[A-Z_]+\}\}/.test(doc)) throw new Error('보고서 양식 항목을 다 채우지 못했습니다')
  return doc
}

export async function downloadReplanDoc(d: ReplanDocData) {
  const doc = await replanDocHtml(d)
  // UTF-16LE + BOM으로 다시 저장 (Word가 이 형식으로 읽음)
  const bytes = new Uint8Array(2 + doc.length * 2)
  bytes[0] = 0xff
  bytes[1] = 0xfe
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < doc.length; i += 1) view.setUint16(2 + i * 2, doc.charCodeAt(i), true)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/msword;charset=utf-16le' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `생산계획_수정_보고서_${d.documentNo}.doc`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
