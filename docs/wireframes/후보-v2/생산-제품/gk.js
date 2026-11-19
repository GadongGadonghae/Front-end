// 시안 G 변형(G1~G5) 공용 그리기. pd.js 다음에 불러온다.
// 디자인 요소 (가동률 시안 G와 같은 원칙: 데이터의 뜻만 그림, 빨강 = 고장 하나의 뜻):
//  · 행 바탕 = 그 제품의 지금 상태 (고장으로 멈춤 = 옅은 빨강, 불량 제외 = 옅은 먹색 빗금)
//  · 걸린 시간 막대 = 표준 걸린 시간 대비, 빠르면 파랑 · 느리면 먹색, 차이가 클수록 진하게
//  · 결과 도넛 · 투입 흐름 막대 (투입 = 양품 출고 + 불량 제외 + 진행 중)
//  · 시간표 = 굵은 칸, 지금 이후는 옅은 바탕
window.GK = (() => {
  const { products, DAY, PROC, NOW, WIP_AT, fmt, hms, hm, dur } = window.PD
  const { steps, result, where, J } = window.PDH
  const wip = products.filter((p) => p.result === 'wip')
  const done = products.filter((p) => p.result !== 'wip')
  const okLeads = done.filter((p) => p.result === 'ok').map((p) => p.lead).sort((a, b) => a - b)
  const STD = okLeads[Math.floor(okLeads.length / 2)] // 표준 걸린 시간 (데모: 오늘 양품 중앙값)
  const atProc = (p) => { const r = p.records.findIndex((x) => x.from != null && x.to == null); return r >= 0 ? { i: r, move: false } : { i: p.records.findIndex((x) => x.from == null), move: true } }
  const isStuck = (p) => p.records.some((r) => r.stuck)
  const rowState = (p) => (isStuck(p) ? 'st-stuck' : p.result === 'ng' ? 'st-ng' : '')

  const BLUE = (a) => `rgb(33 73 196 / ${a})`
  const INK = (a) => `rgb(22 25 29 / ${a})`
  /** 걸린 시간: 표준 대비 막대 (가운데 눈금 = 표준) */
  const leadBar = (p, w = 120) => {
    if (p.result === 'ng') return `<span class="lead none" style="width:${w}px" title="불량 제외 · 비교 안 함"></span>`
    const d = (p.lead - STD) / STD // + 느림, − 빠름
    const half = Math.min(50, (Math.abs(d) / 0.25) * 50)
    const a = (0.3 + Math.min(1, Math.abs(d) / 0.15) * 0.7).toFixed(2)
    const bg = d > 0 ? INK(a) : BLUE(a)
    return `<span class="lead" style="width:${w}px" title="표준 ${dur(STD)} 대비 ${d > 0 ? '+' : ''}${Math.round(d * 100)}%"><span class="base"></span><i style="${d > 0 ? 'left:50%' : 'right:50%'};width:${half}%;background:${bg}"></i></span>`
  }
  const leadText = (p) => { if (p.result !== 'ok') return '<span class="lead-d"></span>'; const d = Math.round(((p.lead - STD) / STD) * 100); return `<span class="lead-d ${d > 0 ? 'slow' : 'fast'}">${d > 0 ? '+' : ''}${d}%</span>` }

  /** 결과 도넛 (투입 = 양품 + 불량 + 진행 중) */
  const donut = (size = 150) => {
    const parts = [['ok', DAY.ok, BLUE(0.75)], ['ng', DAY.ng, INK(0.85)], ['wip', DAY.wip, BLUE(0.3)]]
    const total = DAY.input; const R = 15.9155; let at = 0
    const arcs = parts.map(([k, n, c]) => { const len = Math.max(0.8, (n / total) * 100); const s = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${len - 0.4} ${100 - len + 0.4}" stroke-dashoffset="${-at}"><title>${k} ${n}</title></circle>`; at += len; return s }).join('')
    return `<div class="gdonut" style="width:${size}px;height:${size}px"><svg viewBox="0 0 42 42"><circle r="${R}" cx="21" cy="21" fill="none" stroke="var(--track)" stroke-width="5"/>${arcs}</svg><div class="mid"><b>${fmt(DAY.input)}</b><span>오늘 투입</span></div></div>`
  }
  const legend3 = () => `<div class="r3"><span><i style="background:${BLUE(0.75)}"></i>양품 출고 <b>${fmt(DAY.ok)}</b></span><span><i style="background:${INK(0.85)}"></i>불량 제외 <b>${DAY.ng}</b></span><span><i style="background:${BLUE(0.3)}"></i>진행 중 <b>${DAY.wip}</b></span></div>`
  /** 투입 흐름 막대 */
  const flowBar = () => `<div class="flowbar" title="투입 ${fmt(DAY.input)}"><i style="width:${(DAY.ok / DAY.input) * 100}%;background:${BLUE(0.75)}"></i><i style="width:${(DAY.ng / DAY.input) * 100}%;background:${INK(0.85)}"></i><i style="width:${(DAY.wip / DAY.input) * 100}%;background:${BLUE(0.3)}"></i></div>`

  /** 공정 칸 보드. load = 칸 위에 쌓인 정도 막대 */
  const board = (sel, { load = false, compact = false } = {}) => `<div class="gboard">${[0, 1, 2, 3, 4].map((i) => {
    const list = wip.filter((p) => atProc(p).i === i)
    const st = list.filter((p) => p.records[i]?.stuck).length
    const max = Math.max(...[0, 1, 2, 3, 4].map((k) => wip.filter((p) => atProc(p).i === k).length), 1)
    return `<div class="gcol ${st ? 'has-stuck' : ''}"><h3>${PROC[i]}<b>${list.length}</b></h3>
      ${load ? `<span class="load"><i style="width:${(list.length / max) * 100}%;background:${st ? 'var(--down)' : INK(0.55)}"></i></span>` : ''}
      ${st ? `<span class="stuckn">고장으로 멈춤 ${st}</span>` : ''}
      ${list.slice(0, compact ? 3 : 5).map((p) => `<div class="gcard ${p.records[i]?.stuck ? 'stuck' : ''} ${p === sel ? 'sel' : ''}"><b>${p.short}</b><span>${p.records[i]?.stuck ? `${Math.round((NOW - p.records[i].from) / 60)}분 멈춤` : atProc(p).move ? '들어오는 중' : `${hm(p.records[i].from)}부터`}</span></div>`).join('')}
      ${list.length > (compact ? 3 : 5) ? `<span class="more">외 ${list.length - (compact ? 3 : 5)}개</span>` : ''}</div>`
  }).join('')}</div>`

  /** 제품 여정 시간표 */
  const gantt = (rows, sel, { thick = 16, tint = true, future = true, T0, T1 } = {}) => {
    T0 = T0 ?? Math.floor((Math.min(...rows.map((p) => p.inAt)) - 30) / 60) * 60
    T1 = T1 ?? NOW + Math.round((NOW - T0) * 0.18)
    const x = (s) => `${Math.max(0, Math.min(1, (s - T0) / (T1 - T0))) * 100}%`
    const lane = (p) => {
      let h = future ? `<span class="fut" style="left:${x(NOW)}"></span>` : ''; let prev = null
      p.records.forEach((r, i) => {
        if (r.from == null) return
        if (prev != null) h += `<span class="gap" style="left:${x(prev)};width:calc(${x(r.from)} - ${x(prev)})"></span>`
        const to = r.to ?? NOW
        h += `<i class="p${i} ${r.to == null ? (r.stuck ? 'stuck' : 'now') : ''} ${r.j === 'ng' ? 'ng' : ''}" style="left:${x(r.from)};width:calc(${x(to)} - ${x(r.from)})" title="${r.p}"></i>`
        prev = r.to
      })
      return `<div class="glane" style="height:${thick}px">${h}<span class="nowl" style="left:${x(NOW)}"></span></div>`
    }
    const ticks = []; for (let m = Math.ceil(T0 / 60); m * 60 <= T1; m += 1) ticks.push(m)
    return `<div class="ggantt"><span class="h">제품 ID</span><span class="h">지금 위치</span><span class="h ticks">${ticks.map((m) => `<span style="left:${x(m * 60)}">${hm(m * 60)}</span>`).join('')}</span>
      ${rows.map((p) => `<div class="grow ${tint ? rowState(p) : ''} ${p === sel ? 'sel' : ''}"><span class="id">${p.id}</span><span class="wh ${isStuck(p) ? 'stuck' : ''}">${where(p)}</span>${lane(p)}</div>`).join('')}</div>`
  }

  /** 이력 표 */
  const histTable = (rows, sel, { lead = true, tint = true } = {}) => `<table class="tbl gt"><thead><tr><th>제품 ID</th><th>라인</th><th>투입</th><th>끝남</th><th>걸린 시간${lead ? ` · 표준 ${dur(STD)} 대비` : ''}</th><th>거친 공정</th><th>결과</th></tr></thead><tbody>
    ${rows.map((p) => { const end = p.doneAt ?? p.records[p.ng.at].to; return `<tr class="${tint ? rowState(p) : ''} ${p === sel ? 'open' : ''}"><td class="id">${p.id}</td><td>${p.line}</td><td>${hms(p.inAt)}</td><td>${hms(end)}</td><td>${lead ? `<span class="leadcell"><span>${dur(p.lead)}</span>${leadBar(p, 90)}${leadText(p)}</span>` : dur(p.lead)}</td><td>${steps(p)}</td><td>${result(p)}</td></tr>` }).join('')}</tbody></table>`

  /** 상세 칸. band = 맨 위 상태 띠, dbar = 공정별 걸린 시간 막대 */
  const detail = (p, from, { band = false, dbar = false } = {}) => {
    const stuck = isStuck(p)
    const state = stuck ? '설비 고장으로 멈춤' : p.result === 'wip' ? '공정 중' : p.result === 'ng' ? '불량 제외' : '양품 출고'
    const dmax = Math.max(...p.records.map((r) => (r.from != null ? (r.to ?? NOW) - r.from : 0)), 1)
    return `${band ? `<div class="band ${stuck ? 'stuck' : p.result}"><span>${from}</span><b>${state}</b></div>` : `<span class="aux">${from}</span>`}
      <h3 class="pid-h">${p.id}</h3>
      <div class="passport">
        <div><div class="lb">라인</div><div class="v">${p.line}라인</div></div>
        <div><div class="lb">${p.result === 'wip' ? '지금 위치' : '결과'}</div><div class="v" style="${stuck ? 'color:var(--down)' : ''}">${p.result === 'wip' ? where(p) : result(p)}</div></div>
        <div><div class="lb">투입</div><div class="v">${hms(p.inAt)}</div></div>
        <div><div class="lb">${p.result === 'wip' ? '투입 뒤' : '걸린 시간'}</div><div class="v">${dur(p.lead)}${p.result === 'wip' ? '째' : ''} ${p.result !== 'wip' ? leadText(p) : ''}</div></div>
      </div>
      ${dbar ? `<div class="dbars">${p.records.map((r) => { const d = r.from != null ? (r.to ?? NOW) - r.from : 0; return `<div class="db"><span>${r.p}</span><span class="tr"><i style="width:${(d / dmax) * 100}%;background:${r.stuck ? 'var(--down)' : r.j === 'ng' ? INK(0.85) : r.to == null && r.from != null ? BLUE(0.35) : INK(0.45)}"></i></span><b>${r.from != null ? dur(d) : '-'}</b></div>` }).join('')}</div>` : ''}
      <div class="vtrail">${p.records.map((r) => `<div class="vstep ${r.j ?? (r.from != null ? (r.stuck ? 'stuck' : 'now') : 'todo')}"><span class="dot"></span><div><div class="p">${r.p}<small>${J(r)}</small></div>${r.eq ? `<div class="m">${r.eq}</div>` : ''}${r.from != null ? `<div class="m">${hms(r.from)} → ${r.to ? `${hms(r.to)} · ${dur(r.to - r.from)}` : `${Math.round((NOW - r.from) / 60)}분째`}</div>` : ''}${r.stuck ? '<div class="why">B라인 프레스 3단 고장 (14:08부터) · 앞에서 대기</div>' : ''}${r.reason ? `<div class="why">${r.reason}</div>` : ''}</div></div>`).join('')}</div>`
  }

  const tabs = (tab) => `<span class="gtabs"><button data-t="live" class="${tab === 'live' ? 'on' : ''}">공정 중 추적<b>${wip.length}</b></button><button data-t="hist" class="${tab === 'hist' ? 'on' : ''}">이력 조회</button></span>`
  const histBar = () => `<div class="hbar"><span class="search"><b>제품 ID 검색 (예: D-20261118-0412)</b></span><span class="field">기간 11/13 ~ 11/19</span><span class="field">라인 전체 ▾</span><span class="chips"><span class="chip on">전체</span><span class="chip">양품 출고 <b>${fmt(DAY.ok)}</b></span><span class="chip">불량 제외 <b>${DAY.ng}</b></span></span></div>`
  /** 탭 전환 공통 */
  const mount = (title, render) => {
    const S = { tab: new URLSearchParams(location.search).get('tab') || 'live' }
    const draw = () => { document.getElementById('app').innerHTML = window.PD_SHELL(title) + render(S.tab) }
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { S.tab = b.dataset.t; draw() } })
    draw()
  }
  /** 걸린 시간 분포 (끝난 제품). 표준보다 빠른 칸 = 파랑, 느린 칸 = 먹색, 높이 = 개수 */
  const leadHist = (h = 90) => {
    const ls = done.filter((p) => p.result === 'ok').map((p) => p.lead); const lo = Math.min(...ls); const hi = Math.max(...ls); const n = 12; const w = (hi - lo) / n || 1
    const bins = Array.from({ length: n }, (_, i) => ({ a: lo + i * w, c: ls.filter((v) => v >= lo + i * w && (i === n - 1 ? v <= hi : v < lo + (i + 1) * w)).length }))
    const max = Math.max(...bins.map((b) => b.c), 1)
    return `<div class="lhist-w"><div class="lhist" style="height:${h}px">${bins.map((b) => { const mid = b.a + w / 2; const d = Math.abs(mid - STD) / STD; const a = (0.3 + Math.min(1, d / 0.5) * 0.7).toFixed(2); return `<i style="height:${Math.max(2, (b.c / max) * 100)}%;background:${mid > STD ? INK(a) : BLUE(a)}" title="${dur(b.a)}~ · ${b.c}개"></i>` }).join('')}<span class="std" style="left:${((STD - lo) / (hi - lo)) * 100}%"><b>표준 ${dur(STD)}</b></span></div><div class="lhist-x"><span>${dur(lo)}</span><span>${dur(hi)}</span></div></div>`
  }
  const selLive = wip.find(isStuck) ?? wip[0]
  const selHist = done.find((p) => p.short === 'D-0893') ?? done[0]
  return { wip, done, STD, atProc, isStuck, leadBar, leadText, donut, legend3, flowBar, leadHist, board, gantt, histTable, detail, tabs, histBar, mount, selLive, selHist, BLUE, INK }
})()
