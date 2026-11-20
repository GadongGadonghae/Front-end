// 시안 D 변형(D1~D5) 공용. al.js 다음에 불러온다.
// 1차 시안 D에서 바꾼 것: 지속 시간은 보통 글자(막대 없음) · 조치 메모는 행 아래로 3줄 입력칸이 펼쳐짐 · 코드는 명세 7개 (알람 = 고장 3개)
window.DK = (() => {
  const { rows, shown, CODES, key, hrm, IC } = AL
  const STATE = { D: '고장', I: '대기', S: '정지' }
  const TODO = [
    ['memo', '조치 메모 없는 고장', (r) => r.s === 'D' && !r.memo],
    ['fail', '발송 실패', (r) => r.mail === false || r.slack === false],
    ['rep', '보고서 안 만든 고장', (r) => r.report === 'make'],
  ]
  const live = (s) => rows.filter((r) => r.ongoing && r.s === s).length
  /** 거르기: S.f = 'code:장비고장' | 'todo:memo' | null */
  const filtered = (S) => {
    if (!S.f) return shown
    const [k, v] = S.f.split(':')
    if (k === 'code') return rows.filter((r) => r.code === v)
    if (k === 'state') return rows.filter((r) => r.s === v)
    return rows.filter(TODO.find((t) => t[0] === v)[2])
  }
  const label = (S) => { if (!S.f) return null; const [k, v] = S.f.split(':'); return k === 'todo' ? TODO.find((t) => t[0] === v)[1] : k === 'state' ? STATE[v] : v }
  const chip = (S) => (S.f ? `<span class="fchip">거름 <b>${label(S)}</b><button class="link" data-f="">풀기</button></span>` : '')

  /** 상태별 코드 목록. 알람(고장) 3종은 0건이어도 늘 보임 */
  const codeGroups = (S, { counts = true } = {}) => ['D', 'I', 'S'].map((s) => {
    const cs = CODES.filter((c) => c.s === s)
    const n = cs.reduce((a, c) => a + c.n, 0)
    return `<div class="cg ${s === 'S' ? 'muted' : ''}">
      <div class="cg-h">${key(s)}<b>${STATE[s]}</b>${s === 'D' ? '<span class="aux">알람 · 메일·슬랙 발송</span>' : s === 'S' ? '<span class="aux">계획 · 기본 숨김</span>' : ''}<span class="cg-n">${n}건</span></div>
      ${cs.map((c) => `<button class="cr ${S.f === 'code:' + c.c ? 'on' : ''} ${c.n ? '' : 'zero'}" data-f="code:${c.c}"><span>${c.c}</span><span class="n">${c.n || '-'}${c.n ? '건' : ''}</span>${counts ? `<span class="h">${hrm(c.sec)}</span>` : ''}</button>`).join('')}
    </div>`
  }).join('')

  const todo = (S, { big = false } = {}) => `<div class="todo ${big ? 'big' : ''}">${TODO.map(([k, n, fn]) => { const c = rows.filter(fn).length; return `<button data-f="todo:${k}" class="${S.f === 'todo:' + k ? 'on' : ''} ${c ? '' : 'zero'}"><span>${n}</span><b>${c}</b></button>` }).join('')}</div>`

  const mount = (title, render) => {
    AL.mount(title, (S) => render(S))
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return
      const st = window.__S
      const v = b.dataset.f
      st.f = !v || st.f === v ? null : v; st.memo = null; st.draw()
    })
  }
  return { STATE, TODO, live, filtered, label, chip, codeGroups, todo, mount, IC }
})()
