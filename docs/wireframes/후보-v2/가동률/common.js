// 가동률 시안 공용 그리기 도우미
window.UTH = (() => {
  const { NOW, STATE_NAME, fmtHM, fmtDur } = window.UT
  const pct = (sec, span = 86400) => `${(sec / span) * 100}%`

  /** 24시간 타임라인 한 줄. 가동은 옅은 중립, 손실만 색. 진행 중 사건은 먹색 테두리 */
  function track(l, { height = 22, now = true } = {}) {
    const segs = l.segs.map((s) => {
      const title = s.s === 'R' ? `가동 ${fmtHM(s.from)}~${fmtHM(s.to)}` : `${STATE_NAME[s.s]} · ${s.code} · ${s.eq} · ${fmtHM(s.from)}~${s.ongoing ? '진행 중' : fmtHM(s.to)} (${fmtDur(s.to - s.from)})`
      const w = Math.max(s.to - s.from, s.s === 'R' ? 0 : 240) // 아주 짧은 손실도 보이게 최소 4분 폭
      return `<i class="seg-${s.s}${s.ongoing ? ' ongoing' : ''}" style="left:${pct(s.from)};width:${pct(w)}" title="${title}"></i>`
    }).join('')
    const future = `<i class="future" style="left:${pct(NOW)};right:0" title="아직 오지 않은 시간"></i>`
    return `<div class="track" style="height:${height}px">${future}${segs}${now ? `<span class="now" style="left:${pct(NOW)}"></span>` : ''}</div>`
  }

  function axis(ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24]) {
    return `<div class="axis">${ticks.filter((h) => Math.abs(h * 3600 - NOW) > 3600 * 1.2).map((h) => `<span style="left:${(h / 24) * 100}%">${String(h).padStart(2, '0')}시</span>`).join('')}<span style="left:${(NOW / 86400) * 100}%;top:-2px;color:var(--ink);font-weight:600">지금 ${fmtHM(NOW)}</span></div>`
  }

  function legend() {
    return `<div class="legend">
      <span><i class="sw seg-R"></i>가동</span>
      <span><i class="sw seg-I"></i>대기</span>
      <span><i class="sw seg-D"></i>고장</span>
      <span><i class="sw seg-DC"></i>통신 끊김</span>
      <span><i class="sw seg-S"></i>계획정지 (가동률에서 뺌)</span>
    </div>`
  }

  const key = (s) => `<span class="k ${s}">${s}</span>`
  const oeeTone = (v, avg) => (v < avg - 5 ? 'low' : '')

  return { track, axis, legend, key, pct, oeeTone }
})()
