// 일일 생산 보고서 → Word(.doc) 내려받기. 시안 B-daily의 [Google Docs(.doc)] 그대로:
// public/templates/daily-report-template.doc (UTF-16LE HTML)의 {{#표}}…{{/표}} 줄 틀을 반복하고 {{값}}을 바꾼다

export interface DailyDocData {
  values: Record<string, string>
  /** 표 이름 → 줄마다 칸 글자 (LINES·PROC·DOWN·WIP·HANDOVER) */
  tables: Record<string, string[][]>
  fileName: string
}

const TEMPLATE = '/templates/daily-report-template.doc'
const esc = (v: unknown) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export async function downloadDailyDoc(d: DailyDocData) {
  const res = await fetch(TEMPLATE)
  if (!res.ok) throw new Error(`보고서 양식을 불러오지 못했습니다 (${res.status})`)
  let doc = new TextDecoder('utf-16le').decode(await res.arrayBuffer())

  for (const [name, rows] of Object.entries(d.tables)) {
    doc = doc.replace(new RegExp(`\\{\\{#${name}\\}\\}([\\s\\S]*?)\\{\\{/${name}\\}\\}`), (_, proto: string) =>
      rows.map((cols) => cols.reduce((row, value, i) => row.split(`{{C${i}}}`).join(esc(value)), proto)).join(''))
  }
  for (const [key, value] of Object.entries(d.values)) doc = doc.split(`{{${key}}}`).join(esc(value))
  if (/\{\{[#/]?\w+\}\}/.test(doc)) throw new Error('보고서 양식 값을 다 채우지 못했습니다')

  const bytes = new Uint8Array(2 + doc.length * 2)
  bytes[0] = 0xff
  bytes[1] = 0xfe
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < doc.length; i += 1) view.setUint16(2 + i * 2, doc.charCodeAt(i), true)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/msword;charset=utf-16le' }))
  const a = document.createElement('a')
  a.href = url
  a.download = d.fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
