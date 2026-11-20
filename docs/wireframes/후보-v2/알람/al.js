// 알람·비가동 이력 시안 공용 데모 값과 그리기 (데모 장면: 2026-11-19 14:20:00).
// 값은 지금 데모 공급기 장면(src/data/mock/scenario.ts)을 옮기고 몇 건을 더 지은 것 — 명세 수치가 아니다. 화면에 "데모 값" 표시.
window.AL = (() => {
  const t = (h, m = 0, s = 0) => h * 3600 + m * 60 + s
  const NOW = t(14, 20, 0)
  const p2 = (n) => String(n).padStart(2, '0')
  const hms = (sec) => `${p2(Math.floor(sec / 3600))}:${p2(Math.floor((sec % 3600) / 60))}:${p2(sec % 60)}`
  const hm = (sec) => hms(sec).slice(0, 5)
  const dur = (sec) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60
    return h ? `${h}시간 ${m}분` : m ? `${m}분 ${p2(s)}초` : `${s}초`
  }
  const STATE = { D: '고장', I: '대기', S: '정지' }

  // 오늘 비가동 이력 (R이 아닌 구간마다 1건). to = null → 진행 중
  // mail · slack: 고장(D)만 보냄 (FN-005). null = 보내지 않는 건
  const R = (o) => ({ mail: null, slack: null, memo: null, by: null, at: null, report: null, ...o })
  const rows = [
    R({ id: 1, s: 'D', line: 'B', eq: '프레스 3단', proc: '프레스', code: '장비고장(알람)', detail: '압력(좌) 상한 초과 (356 / 350)', from: t(14, 8, 4), to: null, mail: true, slack: true, report: 'make' }),
    R({ id: 2, s: 'I', line: 'B', eq: '프레스 4단', proc: '프레스', code: '재공부족', detail: '앞 공정 정지', from: t(14, 8, 32), to: null }),
    R({ id: 3, s: 'I', line: 'B', eq: '용접', proc: '용접', code: '재공부족', detail: '앞 공정 정지', from: t(14, 8, 57), to: null }),
    R({ id: 4, s: 'S', line: 'D', eq: '슬리팅', proc: '슬리팅', code: '계획정지(셋업)', detail: '코일 교체', from: t(13, 57, 52), to: null }),
    R({ id: 5, s: 'I', line: 'A', eq: '용접', proc: '용접', code: '재공부족', detail: '앞 공정 정지', from: t(12, 40, 5), to: t(12, 46, 12) }),
    R({ id: 6, s: 'D', line: 'F', eq: '용접', proc: '용접', code: '안전문제', detail: '비상정지 (BX)', from: t(11, 30, 11), to: t(11, 36, 23), mail: true, slack: false, memo: '안전 펜스 센서 점검 후 복귀', by: '이민재', at: '11:52', report: 'make' }),
    R({ id: 7, s: 'I', line: 'E', eq: '프레스 3단', proc: '프레스', code: '재공부족', detail: '앞 공정 정지', from: t(10, 15, 20), to: t(10, 19, 2) }),
    R({ id: 8, s: 'D', line: '도장', eq: '도장 #2', proc: '도장', code: '장비고장(알람)', detail: '온도 상한 초과 (31.2 / 30.0)', from: t(10, 2, 55), to: t(10, 21, 35), mail: true, slack: true, memo: '버너 출력 조정', by: '김현수', at: '10:40', report: 'view' }),
    R({ id: 9, s: 'I', line: 'C', eq: '용접', proc: '용접', code: '작업지연', detail: '뒤 공정 정지', from: t(9, 44, 0), to: t(9, 47, 30) }),
    R({ id: 10, s: 'I', line: 'A', eq: '슬리팅', proc: '슬리팅', code: '재공부족', detail: '코일 공급 지연', from: t(8, 51, 36), to: t(8, 55, 41), memo: '입고 대차 지연', by: '이민재', at: '09:03' }),
    R({ id: 11, s: 'I', line: 'B', eq: '프레스 4단', proc: '프레스', code: '재공부족', detail: '앞 공정 정지', from: t(8, 2, 10), to: t(8, 9, 30) }),
    R({ id: 12, s: 'I', line: 'F', eq: '용접', proc: '용접', code: '재공부족', detail: '앞 공정 정지', from: t(7, 13, 10), to: t(7, 31, 40) }),
    R({ id: 13, s: 'I', line: 'F', eq: '프레스 3단', proc: '프레스', code: '재공부족', detail: '앞 공정 정지', from: t(7, 12, 50), to: t(7, 31, 20) }),
    R({ id: 14, s: 'D', line: 'F', eq: '프레스 2단', proc: '프레스', code: '장비고장', detail: '모터 과부하', from: t(7, 12, 30), to: t(7, 31, 0), mail: true, slack: true, memo: '모터 교체', by: '김현수', at: '07:58', report: 'view' }),
    R({ id: 15, s: 'S', line: 'C', eq: '프레스 1단', proc: '프레스', code: '계획정지', detail: '금형 교체', from: t(6, 19, 12), to: t(6, 44, 12) }),
    R({ id: 16, s: 'I', line: 'D', eq: '슬리팅', proc: '슬리팅', code: '재공부족', detail: '코일 공급 지연', from: t(3, 10, 40), to: t(3, 21, 15) }),
  ].map((r) => ({ ...r, ongoing: r.to == null, len: (r.to ?? NOW) - r.from, name: r.line === '도장' ? r.eq : `${r.line}라인 ${r.eq}` }))

  // 예지보전 위험(90%) 이력 (D-65). 진행 중 = 아직 90% 아래로 내려오지 않음
  const risks = [
    { line: 'E', eq: '프레스 2단', item: '압력(좌)', from: t(13, 50, 23), to: null, max: 92 },
    { line: 'A', eq: '용접', item: '용접 시간', from: t(9, 20, 4), to: t(9, 34, 41), max: 91 },
  ]

  const DEFAULT = (r) => r.s !== 'S' // 기본 필터 = 오늘 · D·I (D-64)
  const shown = rows.filter(DEFAULT)
  const count = (f) => rows.filter(f).length

  // ── 그리기 ─────────────────────────────
  const svg = (d, n = 14) => `<svg class="ic" width="${n}" height="${n}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
  const IC = {
    check: svg('<path d="M3 8.5l3 3 7-7"/>'),
    x: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
    chev: svg('<path d="M4.5 6.5L8 10l3.5-3.5"/>', 12),
    bell: svg('<path d="M4 11V7a4 4 0 018 0v4l1 1.5H3L4 11zM6.5 14h3"/>', 16),
  }
  // 비가동 코드 7개 (기능명세서 3.1 · 데이터정의서). 알람 = 고장(D) 3개: 장비고장 · 장비고장(알람) · 안전문제 (FN-005)
  const CODES = [['장비고장', 'D'], ['장비고장(알람)', 'D'], ['안전문제', 'D'], ['재공부족', 'I'], ['작업지연', 'I'], ['계획정지', 'S'], ['계획정지(셋업)', 'S']]
    .map(([c, s]) => { const l = rows.filter((r) => r.code === c); return { c, s, n: l.length, sec: l.reduce((a, r) => a + r.len, 0), ongoing: l.some((r) => r.ongoing) } })
  const hrm = (sec) => (sec ? dur(sec).replace(/ \d+초$/, '').replace(/^(\d+)초$/, '1분') : '-')
  const key = (s) => `<span class="k ${s}">${s}</span>`
  const codeCell = (r) => `<span class="code">${key(r.s)}<span>${STATE[r.s]} · ${r.code}</span></span>`
  const sent = (r) => (r.mail == null ? '<span class="none">-</span>'
    : `<span class="sent"><span class="${r.mail ? '' : 'fail'}">${r.mail ? IC.check : IC.x}메일${r.mail ? '' : ' 실패'}</span><span class="${r.slack ? '' : 'fail'}">${r.slack ? IC.check : IC.x}슬랙${r.slack ? '' : ' 실패'}</span></span>`)
  let savedId = null
  const memo = (r) => `<span class="memo"><span class="txt ${r.memo ? '' : 'none'}">${r.memo ?? '-'}</span>${r.id === savedId ? `<span class="saved">${IC.check}저장됨</span>` : ''}<button class="link" data-memo="${r.id}">${r.memo ? '고치기' : '쓰기'}</button></span>`
  const who = (r) => (r.by ? `<span class="who">${r.by}<small>${r.at} 저장</small></span>` : '<span class="none">-</span>')
  const report = (r) => (r.report ? `<button class="btn">${r.report === 'view' ? '보기' : '만들기'}</button>` : '<span class="none">-</span>')
  const end = (r) => (r.ongoing ? '<span class="live">진행 중</span>' : `<span class="t">${hms(r.to)}</span>`)
  const eqCell = (r) => (r.line === '도장' ? `<span class="eq"><b>${r.eq}</b></span>` : `<span class="eq"><b>${r.eq}</b><small>${r.line}라인</small></span>`)
  const tone = (r) => (r.ongoing && r.s !== 'S' ? `tone-${r.s}` : '')
  const maxLen = Math.max(...shown.map((r) => r.len))
  const dbar = (r, max = maxLen) => `<span class="dbar"><span class="dur">${dur(r.len)}</span><span class="tr"><i class="fill-${r.s}" style="width:${Math.max(3, (r.len / max) * 100)}%"></i></span></span>`

  const COLS = {
    start: ['발생', (r) => `<span class="t">${hms(r.from)}</span>`],
    end: ['해제', end],
    line: ['라인', (r) => (r.line === '도장' ? '도장' : `${r.line}라인`)],
    eq: ['설비', eqCell],
    name: ['설비', (r) => `<span class="eq"><b>${r.name}</b></span>`],
    code: ['상태 · 코드', codeCell],
    detail: ['상세', (r) => r.detail],
    dur: ['지속', (r) => `<span class="dur-t ${r.ongoing ? 'on' : ''}">${dur(r.len)}</span>`, 'r'],
    dbar: ['지속', (r) => dbar(r), 'r'],
    sent: ['발송', sent],
    memo: ['조치 메모', memo],
    who: ['조치 담당자', who],
    report: ['보고서', report],
  }
  const FULL = ['start', 'end', 'line', 'eq', 'code', 'detail', 'dur', 'sent', 'memo', 'who', 'report']
  /** 이력 표. cols = COLS 열쇠 목록, sel = 고른 건 id */
  /** 조치 메모 펼침: 그 행 바로 아래 3줄 입력칸 */
  const editor = (r, n) => `<tr class="memo-row"><td colspan="${n}"><div class="memo-ed">
    <label for="ta-${r.id}">조치 메모 <span>${r.name} · ${hms(r.from)} · ${r.code}</span></label>
    <textarea id="ta-${r.id}" rows="3" data-ta="${r.id}" placeholder="무엇을 했는지 적기 (선택)">${r.memo ?? ''}</textarea>
    <div class="memo-act"><span class="hint">${r.by ? `마지막 저장 ${r.by} · ${r.at}` : '저장하면 로그인한 사람 이름이 조치 담당자로 남음'} · Esc 닫기</span><button class="btn" data-cancel>취소</button><button class="btn primary" data-save="${r.id}">저장</button></div>
  </div></td></tr>`
  const table = (list, { cols = FULL, sel = null, memo: open = null, ed = editor } = {}) => `<table class="tbl"><thead><tr>${cols.map((c) => `<th class="${COLS[c][2] ?? ''}">${COLS[c][0]}</th>`).join('')}</tr></thead>
    <tbody>${list.length ? list.map((r) => `<tr data-id="${r.id}" class="${tone(r)} ${r.id === sel ? 'sel' : ''}">${cols.map((c) => `<td class="${COLS[c][2] ?? ''}">${COLS[c][1](r)}</td>`).join('')}</tr>${r.id === open ? ed(r, cols.length) : ''}`).join('')
      : `<tr><td colspan="${cols.length}" class="none" style="text-align:center;padding:40px">데이터 없음</td></tr>`}</tbody></table>`
  const pager = (n) => `<div class="pager"><span>${n}건 · 50건씩</span><span class="pg"><span class="on">1</span></span></div>`

  /** 필터 줄 (D-84 순서). 상태 칩에 오늘 건수 */
  const filters = ({ compact = false } = {}) => `<div class="filters">
    <span class="field">2026-11-19</span><span class="aux">~</span><span class="field">2026-11-19</span>${compact ? '' : '<span class="hint">최대 31일</span>'}
    <span class="field">라인 전체 ${IC.chev}</span><span class="field">공정 전체 ${IC.chev}</span>
    <span class="lab">상태</span>
    <span class="ck on">${IC.check}${key('D')}고장 <b>${count((r) => r.s === 'D')}</b></span>
    <span class="ck on">${IC.check}${key('I')}대기 <b>${count((r) => r.s === 'I')}</b></span>
    <span class="ck off">${key('S')}정지 <b>${count((r) => r.s === 'S')}</b></span>
    <span class="field">코드 전체 ${IC.chev}</span>
    <span class="ck">진행 중만 <b>${count((r) => r.ongoing && r.s !== 'S')}</b></span>
  </div>`

  const riskTable = () => `<table class="tbl"><thead><tr><th>발생</th><th>해제</th><th>라인</th><th>설비</th><th>항목</th><th class="r">최고 %</th></tr></thead><tbody>
    ${risks.map((r) => `<tr><td><span class="t">${hms(r.from)}</span></td><td>${r.to == null ? '<span class="live">진행 중</span>' : `<span class="t">${hms(r.to)}</span>`}</td><td>${r.line}라인</td><td><span class="eq"><b>${r.eq}</b></span></td><td>${r.item}</td><td class="r"><b class="risk">${r.max}%</b></td></tr>`).join('')}</tbody></table>`
  const riskView = () => `<main class="page" style="grid-template-rows:minmax(0,1fr)"><section class="panel scroll"><header><h2>예지보전 위험 이력</h2><span class="meta">위험(90%)에 들어간 때부터 내려온 때까지 · 빨강 테두리 = 위험 (고장 빨강 칸과 구분) · 메일·슬랙 없음 (D-60)</span></header>
    <div class="filters" style="margin-bottom:12px"><span class="field">2026-11-19</span><span class="aux">~</span><span class="field">2026-11-19</span><span class="field">라인 전체 ${IC.chev}</span></div>${riskTable()}${pager(risks.length)}</section></main>`

  const shell = (title, tab) => `
<header class="nav"><b class="logo">라인가동현황</b>
  <nav><a>대시보드</a><a>생산</a><a>가동률</a><a>예지보전</a><a class="on">알람이력</a><a>리포트</a><a>설정</a></nav>
  <span class="right"><span class="demo">데모 값 · ${title}</span><span class="bell">${IC.bell}<b>3</b></span> 2026-11-19 (목) <b>14:20:00</b></span>
</header>
<div class="bar">
  <h1>알람·비가동 이력</h1>
  <span class="gtabs"><button data-t="alarm" class="${tab === 'alarm' ? 'on' : ''}">알람·비가동</button><button data-t="risk" class="${tab === 'risk' ? 'on' : ''}">예지보전 위험<b>${risks.filter((r) => r.to == null).length}</b></button></span>
  <span class="basis">오늘 00:00 ~ 14:20 기준</span>
</div>`

  /** 탭 전환 + 행 고르기 공통. render(state) → 알람 탭 본문. 행을 누르면 state.sel이 바뀐다 */
  const mount = (title, render, { sel = 1 } = {}) => {
    const q = new URLSearchParams(location.search)
    const S = { tab: q.get('tab') === 'risk' ? 'risk' : 'alarm', sel, memo: Number(q.get('memo')) || null, saved: null }
    const draw = () => {
      const sc = document.querySelector('.panel.scroll.main')?.scrollTop
      document.getElementById('app').innerHTML = shell(title, S.tab) + (S.tab === 'risk' ? riskView() : render(S))
      const m = document.querySelector('.panel.scroll.main'); if (sc != null && m) m.scrollTop = sc
      const ta = document.querySelector('[data-ta]'); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length) }
    }
    S.draw = draw; window.__S = S
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.memo) { S.memo = null; draw() } })
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (b) { S.tab = b.dataset.t; draw(); return }
      const mm = e.target.closest('[data-memo]'); if (mm) { const id = Number(mm.dataset.memo); S.memo = S.memo === id ? null : id; savedId = null; draw(); return }
      if (e.target.closest('[data-cancel]')) { S.memo = null; draw(); return }
      const sv = e.target.closest('[data-save]')
      if (sv) { const r = rows.find((x) => x.id === Number(sv.dataset.save)); const v = document.querySelector('[data-ta]').value.trim(); r.memo = v || null; r.by = v ? '로그인 사용자' : null; r.at = v ? '14:20' : null; S.memo = null; savedId = r.id; draw(); return }
      const r = e.target.closest('[data-id]'); if (r && !e.target.closest('button')) { S.sel = Number(r.dataset.id); draw() }
    })
    draw()
  }

  return { COLS, IC, CODES, hrm, editor, NOW, t, rows, shown, risks, STATE, hms, hm, dur, key, codeCell, sent, memo, who, report, end, eqCell, tone, dbar, maxLen, table, pager, filters, count, mount, FULL }
})()
