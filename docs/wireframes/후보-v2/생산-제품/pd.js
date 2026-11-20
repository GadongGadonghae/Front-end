// 생산 조회 · 제품 중심 시안 공용 데모 값 (2026-11-19 14:20 기준). 명세 수치 아님 — 화면에 "데모 값" 표시.
// 제품 한 줄(API-101)과 공정별 기록(API-102)에 있는 정보만 쓴다: ID · 라인 · 투입/완료 · 거친 공정 · 결과 · 공정별 설비/시각/판정/사유
window.PD = (() => {
  const NOW = 14 * 3600 + 20 * 60
  const hms = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((n) => String(n).padStart(2, '0')).join(':')
  const hm = (s) => hms(s).slice(0, 5)
  const dur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초` : `${Math.round(s)}초`)
  const fmt = (n) => n.toLocaleString('ko-KR')
  const PROC = ['슬리팅', '프레스', '용접', '도장', '출고 검사']
  // 공정별 처리 시간(초)과 다음 공정까지 이동·대기(초) — 데모
  const WORK = [37, 82, 17, 260, 20]
  const MOVE = [25, 30, 40, 35]
  const rnd = (seed) => { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296 }
  const PAINT = { A: '도장 #1', B: '도장 #1', C: '도장 #1', D: '도장 #2', E: '도장 #2', F: '도장 #2' }
  const eqName = (line, i, stage) => [`${line}라인 슬리팅`, `${line}라인 프레스 ${stage ?? '1~4'}단`, `${line}라인 용접`, PAINT[line], '비전'][i]
  // 불량 사례 (공정 검사, D-88)
  const NG = {
    'D-0893': { at: 2, reason: '용접 전류 하한 이탈 (138 / 140A)' },
    'B-0867': { at: 1, reason: '3단 압력(좌) 상한 이탈 (356 / 350)' },
    'E-0971': { at: 4, reason: '외관 불량 (도장 흐름)' },
    'A-0975': { at: 0, reason: '슬리팅 폭 하한 이탈 (159.6 / 160mm)' },
    'C-0958': { at: 3, reason: '도막 두께 하한 이탈 (18 / 20㎛)' },
  }
  const LINES = ['A', 'B', 'C', 'D', 'E', 'F']
  const START = { A: 976, B: 862, C: 955, D: 882, E: 961, F: 940 }
  const products = []
  for (const line of LINES) {
    for (let k = 0; k < 14; k++) {
      const no = START[line] + k
      const id = `${line}-20261119-${String(no).padStart(4, '0')}`
      const short = `${line}-${String(no).padStart(4, '0')}`
      const inAt = NOW - (14 - k) * 125 - Math.round(rnd(id) * 40)
      const records = []
      let at = inAt
      let result = 'ok'
      let ngInfo = null
      for (let i = 0; i < 5; i++) {
        const w = WORK[i] * (0.9 + rnd(id + i) * 0.25)
        const from = at
        const to = from + w
        const bStuck = line === 'B' && i === 1 && to > 14 * 3600 + 8 * 60
        if (from > NOW || bStuck) {
          if (from <= NOW) { records.push({ p: PROC[i], eq: eqName(line, i, 3), from, to: null, j: null, stuck: bStuck }) }
          result = 'wip'
          for (let r = records.length; r < 5; r++) records.push({ p: PROC[r], eq: null, from: null, to: null, j: null })
          break
        }
        if (to > NOW) { records.push({ p: PROC[i], eq: eqName(line, i), from, to: null, j: null }); result = 'wip'; for (let r = i + 1; r < 5; r++) records.push({ p: PROC[r], eq: null, from: null, to: null, j: null }); break }
        const ng = NG[short] && NG[short].at === i
        records.push({ p: PROC[i], eq: eqName(line, i), from, to, j: ng ? 'ng' : 'ok', reason: ng ? NG[short].reason : null })
        if (ng) { result = 'ng'; ngInfo = { at: i, reason: NG[short].reason }; for (let r = i + 1; r < 5; r++) records.push({ p: PROC[r], eq: null, from: null, to: null, j: null }); break }
        at = to + (MOVE[i] ?? 0) * (0.8 + rnd(id + 'm' + i) * 0.6)
      }
      const doneAt = result === 'ok' ? records[4].to : null
      products.push({ id, short, line, inAt, doneAt, result, ng: ngInfo, records, lead: (doneAt ?? (result === 'ng' ? records[ngInfo.at].to : NOW)) - inAt })
    }
  }
  products.sort((a, b) => b.inAt - a.inAt)
  const RESULT = { ok: '양품 출고', ng: '불량 제외', wip: '진행 중' }
  // 오늘 전체 (요약 숫자, 지금 데모 화면 값)
  const DAY = { input: 5831, ok: 5567, ng: 229, wip: 35, plan: 9000, expected: 5375 }
  const NG_BY = [{ p: '슬리팅', n: 30 }, { p: '프레스', n: 77 }, { p: '용접', n: 42 }, { p: '도장', n: 20 }, { p: '출고 검사', n: 60 }]
  const NG_REASON = [
    { p: '프레스', r: '압력 상한 이탈', n: 41 }, { p: '출고 검사', r: '외관 불량', n: 38 }, { p: '프레스', r: '프레스 시간 이탈', n: 36 },
    { p: '용접', r: '용접 전류 이탈', n: 29 }, { p: '슬리팅', r: '폭 치수 이탈', n: 30 }, { p: '출고 검사', r: '치수 불량', n: 22 },
    { p: '도장', r: '도막 두께 이탈', n: 20 }, { p: '용접', r: '용접 시간 이탈', n: 13 },
  ]
  // 지금 공정별로 있는 제품 수 (진행 중 35 = 데모 분포)
  const WIP_AT = { 슬리팅: 6, 프레스: 14, 용접: 4, 도장: 8, '출고 검사': 3 }
  return { NOW, PROC, products, RESULT, DAY, NG_BY, NG_REASON, WIP_AT, hms, hm, dur, fmt }
})()

window.PD_SHELL = (title, extra = '') => `
<header class="nav"><b class="logo">라인가동현황</b>
  <nav><a>대시보드</a><a class="on">생산</a><a>가동률</a><a>예지보전</a><a>알람이력</a><a>리포트</a><a>설정</a></nav>
  <span class="right"><span class="demo">데모 값 · ${title}</span>2026-11-19 (목) <b>14:20:00</b></span>
</header>
<div class="bar">
  <h1>생산 조회</h1>
  <span class="seg"><b>일</b><span>주</span><span>월</span></span>
  <span class="field">2026-11-19</span>
  <span class="field">라인 전체 ▾</span>
  ${extra}
  <span class="basis">00:00 ~ 14:20 기준</span>
</div>`

window.PDH = (() => {
  const { PROC, RESULT, hms, dur } = window.PD
  /** 거친 공정 칩: 지남 · 지금 위치 · 불량 제외 위치 */
  const steps = (p) => p.records.map((r, i) => {
    let cls = 'todo'
    if (r.j === 'ok') cls = 'done'
    if (r.j === 'ng') cls = 'ng'
    if (r.from != null && r.to == null) cls = r.stuck ? 'stuck' : 'now'
    if (p.result === 'wip' && r.from == null && i > 0 && p.records[i - 1].to != null) cls = 'now'
    return `<span class="st ${cls}">${PROC[i] === '출고 검사' ? '출고' : PROC[i]}</span>`
  }).join('<span class="st-sep"></span>')
  const result = (p) => `<span class="res ${p.result}">${RESULT[p.result]}${p.result === 'ng' ? ` · ${PROC[p.ng.at]}` : ''}</span>`
  const where = (p) => {
    const r = p.records.find((x) => x.from != null && x.to == null)
    if (r) return `${r.p}${r.stuck ? ' (설비 고장으로 멈춤)' : ''}`
    const next = p.records.find((x) => x.from == null)
    return next ? `${next.p}(으)로 이동 중` : ''
  }
  const J = (r) => (r.j === 'ok' ? '합격' : r.j === 'ng' ? '불량 제외' : r.from != null ? (r.stuck ? '멈춤' : '처리 중') : '가지 않음')
  return { steps, result, where, J, hms, dur }
})()
