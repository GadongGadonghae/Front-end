// 시안 B 공용: 헤더, 선 그래프. data.js 다음에 불러온다. 값은 모두 데모 값.

function renderTop(active) {
  const items = [['대시보드', 'B.html'], ['생산', 'B-prod.html'], ['가동률', 'B-util.html'], ['예지보전', 'B-pdm.html'], ['알람이력', 'B-alarm.html'], ['AI 리포트', 'B-daily.html'], ['설정', 'B-target.html']]
  document.querySelector('header.top').innerHTML = `
    <a class="brand" href="B.html"><i data-lucide="factory"></i>라인가동현황</a>
    <nav class="nav">${items.map(([n, h]) => `<a href="${h}"${n === active ? ' class="on" aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
    <div class="r">
      <span class="clock">${NOW.date}<b>${NOW.time}</b></span>
      <button class="bell" aria-label="알림 5건"><i data-lucide="bell"></i><span>5</span></button>
      <a class="me" href="B-login.html" title="로그아웃"><i data-lucide="circle-user"></i>김현수</a>
    </div>`
}

// 같은 값이 다시 나오는 난수 (데모 그래프용)
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647 }

// 요소 크기에 맞춰 그리고, 창 크기가 바뀌면 다시 그린다
function draw(el, fn) { const go = () => { el.innerHTML = fn(el) }; go(); addEventListener('resize', go) }

// o: { bands:[[x0,x1]], x0, x1, xTicks:[[v,'라벨']], y0, y1, yTicks:[v], series:[{pts:[[x,y]], cls}], lines:[{v, cls, lab}], dot:true, now:x, over:v }
function lineChart(el, o) {
  const w = el.clientWidth, h = el.clientHeight, pad = { l: 52, r: o.lines?.some((l) => l.lab) ? 72 : 16, t: 10, b: 28 }
  const X = (v) => pad.l + ((v - o.x0) / (o.x1 - o.x0)) * (w - pad.l - pad.r)
  const Y = (v) => pad.t + (1 - (v - o.y0) / (o.y1 - o.y0)) * (h - pad.t - pad.b)
  const yt = (h - pad.t - pad.b) / (o.yTicks.length - 1) < 18 ? [o.yTicks[0], o.yTicks[o.yTicks.length - 1]] : o.yTicks // 낮으면 눈금 줄임
  const yg = yt.map((v) => `<line class="ch-grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ch-lab" x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`).join('')
  const xg = o.xTicks.map(([v, t]) => `<text class="ch-lab" x="${X(v)}" y="${h - 6}" text-anchor="middle">${t}</text>`).join('')
  const ln = (o.lines || []).map((l) => `<line class="${l.cls}" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(l.v)}" y2="${Y(l.v)}"/>${l.lab ? `<text class="ch-limit-lab" x="${w - pad.r + 6}" y="${Y(l.v) + 4}">${l.lab}</text>` : ''}`).join('')
  const bands = (o.bands || []).map(([a, b]) => `<rect class="ch-gap" x="${X(a)}" y="${pad.t}" width="${Math.max(X(b) - X(a), 2)}" height="${h - pad.t - pad.b}"/>`).join('')
  const now = o.now != null ? `<line class="ch-now" x1="${X(o.now)}" x2="${X(o.now)}" y1="${pad.t}" y2="${h - pad.b}"/>` : ''
  const ser = o.series.map((s) => `<path class="${s.cls}" d="${s.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('')}"/>`).join('')
  const s0 = o.series[0].pts, last = s0[s0.length - 1]
  const dot = o.dot ? `<circle class="ch-dot" cx="${X(last[0])}" cy="${Y(last[1])}" r="4"/>` : ''
  const over = o.over != null ? s0.filter((p) => p[1] > o.over).map(([x, y]) => `<circle class="ch-over" cx="${X(x)}" cy="${Y(y)}" r="3.5"/>`).join('') : ''
  return `<svg width="${w}" height="${h}" style="display:block" role="img" aria-label="${o.label || ''}">${bands}${yg}${xg}${ln}${now}${ser}${dot}${over}</svg>`
}

// 이전 보고서 기간 검색. root 안에서 data-date 날짜 묶음 뒤에 오는 <a> 항목을 기간으로 거른다.
// 반환값 apply() 는 목록에 항목을 새로 넣은 뒤 다시 거를 때 부른다.
function initPeriodFilter(root, heading) {
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const form = document.createElement('form')
  form.className = 'period-filter'
  form.setAttribute('role', 'search')
  form.setAttribute('aria-label', '이전 보고서 기간 검색')
  form.innerHTML = `
    <label><span>시작일</span><input type="date" name="from"></label>
    <span class="sep" aria-hidden="true">~</span>
    <label><span>종료일</span><input type="date" name="to"></label>
    <div class="period-bar">
      <div class="seg" role="group" aria-label="기간 빠른 선택">
        <button type="button" data-days="7">최근 7일</button><button type="button" data-days="30">최근 30일</button><button type="button" data-days="0" class="on" aria-pressed="true">전체</button>
      </div>
      <p class="period-msg" role="status" aria-live="polite"></p>
    </div>`
  heading.after(form)
  const empty = document.createElement('p')
  empty.className = 'period-empty'
  empty.textContent = '선택한 기간에 작성한 보고서가 없습니다.'
  empty.hidden = true
  root.append(empty)
  const { from, to } = form.elements
  const msg = form.querySelector('.period-msg')
  const presets = [...form.querySelectorAll('[data-days]')]
  const markPreset = btn => presets.forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-pressed', String(b === btn)) })

  const apply = () => {
    const start = from.value, end = to.value
    const invalid = start && end && start > end
    to.setAttribute('aria-invalid', String(Boolean(invalid)))
    let date = '', shown = 0, group = null, groupShown = 0
    const closeGroup = () => { if (group) group.hidden = groupShown === 0 }
    for (const el of root.children) {
      if (el.dataset.date) { closeGroup(); group = el; groupShown = 0; date = el.dataset.date; continue }
      if (el.tagName !== 'A') continue
      const visible = !invalid && (!start || date >= start) && (!end || date <= end)
      el.hidden = !visible
      if (visible) { shown += 1; groupShown += 1 }
    }
    closeGroup()
    empty.hidden = invalid || shown > 0
    msg.classList.toggle('err', Boolean(invalid))
    msg.textContent = invalid ? '시작일이 종료일보다 늦습니다' : `${shown}건`
  }
  form.addEventListener('submit', e => e.preventDefault())
  form.addEventListener('input', () => { markPreset(null); apply() })
  presets.forEach(btn => btn.addEventListener('click', () => {
    const days = Number(btn.dataset.days)
    if (days) { const today = new Date(); const past = new Date(today); past.setDate(today.getDate() - (days - 1)); from.value = ymd(past); to.value = ymd(today) }
    else { from.value = ''; to.value = '' }
    markPreset(btn)
    apply()
  }))
  apply()
  return apply
}
