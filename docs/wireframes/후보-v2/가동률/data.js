// 가동률 시안 공용 데모 값 (데모 장면: 2026-11-19 14:20 기준). 명세 수치가 아니다 — 화면에 "데모 값" 표시.
// 상태 이력은 지금 데모 공급기 장면(scenario.ts)과 같은 사건을 라인 대표 상태(D > DC > S > I > R)로 옮겼다.
window.UT = (() => {
  const NOW = 14 * 3600 + 20 * 60 // 14:20
  const t = (h, m = 0, s = 0) => h * 3600 + m * 60 + s
  const fmtHM = (sec) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`
  const fmtDur = (sec) => {
    const m = Math.round(sec / 60)
    return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
  }

  // 사건: 라인 대표 상태 구간 (R 외의 것만). 나머지는 R
  const EVENTS = {
    A: [
      { s: 'I', from: t(5, 28), to: t(5, 32), code: '재공부족', why: '코일 공급 지연', eq: 'A라인 슬리팅' },
      { s: 'I', from: t(12, 40), to: t(12, 46), code: '재공부족', why: '앞 공정 정지', eq: 'A라인 용접' },
    ],
    B: [
      { s: 'I', from: t(8, 2), to: t(8, 9), code: '재공부족', why: '앞 공정 정지', eq: 'B라인 프레스 4단' },
      { s: 'D', from: t(14, 8), to: NOW, code: '알람(관리값 이탈)', why: '압력(좌) 상한 초과 356/350', eq: 'B라인 프레스 3단', ongoing: true },
    ],
    C: [
      { s: 'S', from: t(6, 12), to: t(6, 37), code: '모델 교체', why: '금형 교체', eq: 'C라인 프레스 1단' },
    ],
    D: [
      { s: 'I', from: t(3, 10), to: t(3, 21), code: '재공부족', why: '코일 공급 지연', eq: 'D라인 슬리팅' },
      { s: 'S', from: t(13, 58), to: NOW, code: '코일·나이프 교체', why: '코일 교체', eq: 'D라인 슬리팅', ongoing: true },
    ],
    E: [
      { s: 'I', from: t(10, 15), to: t(10, 19), code: '재공부족', why: '앞 공정 정지', eq: 'E라인 프레스 3단' },
    ],
    F: [
      { s: 'D', from: t(11, 31), to: t(11, 37), code: '안전문제', why: '비상정지 (BX)', eq: 'F라인 용접' },
      { s: 'DC', from: t(14, 17), to: NOW, code: '통신 끊김', why: '상태 신호 10초 넘게 없음', eq: 'F라인 프레스 3단', ongoing: true },
    ],
    PT: [
      { s: 'D', from: t(10, 2), to: t(10, 21), code: '알람(관리값 이탈)', why: '도장 온도 상한 초과', eq: '도장 #2' },
    ],
    VI: [],
  }

  const LINES = [
    { id: 'A', name: 'A라인', kind: '생산', oee: 81.2, a: 98.9, p: 86.4, q: 95.0 },
    { id: 'B', name: 'B라인', kind: '생산', oee: 68.9, a: 87.4, p: 83.1, q: 94.9 },
    { id: 'C', name: 'C라인', kind: '생산', oee: 80.4, a: 97.1, p: 86.9, q: 95.3 },
    { id: 'D', name: 'D라인', kind: '생산', oee: 76.0, a: 92.6, p: 86.0, q: 95.4 },
    { id: 'E', name: 'E라인', kind: '생산', oee: 79.3, a: 99.5, p: 83.8, q: 95.1 },
    { id: 'F', name: 'F라인', kind: '생산', oee: 82.1, a: 99.0, p: 87.2, q: 95.1 },
    { id: 'PT', name: '도장', kind: '도장', oee: 84.0, a: 97.8, p: 89.6, q: 95.9 },
    { id: 'VI', name: '출고', kind: '출고', oee: 90.0, a: 100, p: 91.2, q: 98.7 },
  ]
  const PLANT = { oee: 78.4, a: 89.1, p: 92.0, q: 95.6, lineYield: 95.5 }

  // 라인별: 전체 구간(R 포함)과 상태별 합계
  for (const l of LINES) {
    const ev = EVENTS[l.id].slice().sort((x, y) => x.from - y.from)
    const segs = []
    let at = 0
    for (const e of ev) {
      if (e.from > at) segs.push({ s: 'R', from: at, to: e.from })
      segs.push(e)
      at = e.to
    }
    if (at < NOW) segs.push({ s: 'R', from: at, to: NOW })
    l.segs = segs
    l.events = ev
    l.sum = { R: 0, S: 0, I: 0, D: 0, DC: 0 }
    for (const s of segs) l.sum[s.s] += s.to - s.from
    l.loss = l.sum.I + l.sum.D + l.sum.DC
    // 시간대별 가동 비율 (0~1). 계획정지(S)는 부하시간에서 뺀다 (OEE 규칙)
    l.hours = Array.from({ length: 24 }, (_, h) => {
      const a = h * 3600; const b = Math.min((h + 1) * 3600, NOW)
      if (b <= a) return null
      let run = 0; let load = 0
      for (const s of segs) {
        const x = Math.max(a, s.from); const y = Math.min(b, s.to)
        if (y <= x) continue
        if (s.s !== 'S') load += y - x
        if (s.s === 'R') run += y - x
      }
      return load ? run / load : null
    })
  }

  // 비가동 코드별 (화면정의서 SCR-003 4번)
  const CODES = [
    { code: '알람(관리값 이탈)', s: 'D', sec: t(0, 30, 36), n: 2 },
    { code: '재공부족', s: 'I', sec: t(0, 26, 36), n: 3 },
    { code: '모델 교체', s: 'S', sec: t(0, 25, 0), n: 1 },
    { code: '코일·나이프 교체', s: 'S', sec: t(0, 22, 8), n: 1 },
    { code: '안전문제', s: 'D', sec: t(0, 6, 12), n: 1 },
  ]

  const STATE_NAME = { R: '가동', S: '정지', I: '대기', D: '고장', DC: '통신 끊김' }

  return { NOW, LINES, PLANT, CODES, STATE_NAME, fmtHM, fmtDur }
})()

// 시안 공통: 상단 메뉴와 조회 조건 (모든 시안이 같은 틀)
window.UT_SHELL = (title) => `
<header class="nav"><b class="logo">라인가동현황</b>
  <nav><a>대시보드</a><a>생산</a><a class="on">가동률</a><a>예지보전</a><a>알람이력</a><a>리포트</a><a>설정</a></nav>
  <span class="right"><span class="demo">데모 값 · 시안 ${title}</span>2026-11-19 (목) <b>14:20:00</b></span>
</header>
<div class="bar">
  <h1>가동률</h1>
  <span class="seg"><b>일</b><span>주</span><span>월</span></span>
  <span class="field">2026-11-19</span>
  <span class="field">라인 전체 ▾</span><span class="field">공정 전체 ▾</span><span class="field muted">설비 전체 ▾</span>
  <span class="basis">00:00 ~ 14:20 기준</span>
</div>`
