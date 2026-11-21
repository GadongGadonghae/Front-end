// 성능 측정 (docs/10_성능검토.md). 같은 조건으로 개선 전·후를 재서 비교한다
//
// 쓰기
//   npm run perf -- --label 개선전              빌드 3종 → 미리보기 서버 → 시나리오 5개 × 3번 → docs/perf/개선전.json
//   npm run perf -- --label 개선후 --runs 5     같은 측정을 5번
//   npm run perf -- --compare 개선전 개선후      두 결과를 마크다운 표로
//   --only idle,enter                           일부 시나리오만
//   --gpu                                       그래픽 카드로 그린다 (사무실 PC에서 fps를 볼 때). 기본은 소프트웨어(SwiftShader): 어느 PC에서나 같은 조건
//   --skip-build                                이미 만든 빌드(node_modules/.perf)를 다시 쓴다
//   --root <폴더>                               다른 체크아웃(예: 옛 커밋의 git worktree)을 잰다. 결과는 이 저장소 docs/perf에
//   --merge                                     같은 이름의 결과 파일이 있으면 이번에 잰 시나리오만 바꿔 넣는다
//
// 조건: 실제 배포와 같은 빌드(vite build + vite preview), 창 1920×940, 시나리오마다 새 브라우저 창, 숫자는 가운데 값(중앙값)
// 데이터: 데모(mock). "다시 들어간 화면"은 데모 조회를 600ms 늦춘 빌드, "요청 수"는 실서버 모드 빌드에 빈 응답을 주고 요청 수만 센다 (서버 없이)
// 브라우저: 설치된 Chrome (playwright-core). 다른 곳에 있으면 CHROME_PATH 환경 변수로
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'
import { chromium } from 'playwright-core'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(HERE, 'docs/perf')
const W = 1920
const H = 940
const MOCK_DELAY = 600

// ── 인자 ──
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1] }
const has = (k) => argv.includes(k)
const ROOT = resolve(arg('--root', HERE))

/** 결과 이름표 (표에 쓰는 순서) */
const LABELS = {
  idle: ['대시보드를 띄워 둔 5초', { jsMs: '자바스크립트 시간(ms)', taskMs: '브라우저 작업 시간(ms)', longCount: '긴 작업(50ms+) 수' }],
  enter: ['가동률 → 대시보드', { readyMs: '3D 이름표가 뜨기까지(ms)', longCount: '긴 작업 수 (2초 안)', longMax: '가장 긴 작업(ms)', longSum: '긴 작업 합(ms)' }],
  revisit: [`가동률 다시 들어가기 (데모 조회 ${MOCK_DELAY}ms 지연)`, { firstMs: '처음 들어갈 때 값이 뜨기까지(ms)', secondMs: '다시 들어갈 때 값이 뜨기까지(ms)' }],
  requests: ['실서버 모드 요청 수 (가짜 응답)', { idle10s: '대시보드 10초 동안', toLine: '대시보드 → 라인 상세 2초 안 (같은 구독을 씀)', toLineLive: '  그중 실시간 구독 요청', toUtil: '대시보드 → 가동률 2초 안 (같은 구독 안 씀)', toUtilLive: '  그중 실시간 구독 요청', backQuick: '2초 만에 대시보드로 돌아올 때 2초 안', backQuickLive: '  그중 실시간 구독 요청', away30s: '대시보드 → 가동률 뒤 30초 동안 합', away30sLive: '  그중 실시간 구독 요청', utilAway10s: '가동률에 35초 머문 뒤 10초 동안', utilAwayLive: '  그중 실시간 구독 요청', backLate: '45초 만에 대시보드로 돌아올 때 2초 안', backLateLive: '  그중 실시간 구독 요청' }],
  memory: ['대시보드 ↔ 가동률 18번 오간 뒤', { heapStartMb: '처음 힙(MB)', heapEndMb: '18번 뒤 힙(MB)', domEnd: '18번 뒤 DOM 노드', listenersEnd: '18번 뒤 이벤트 리스너' }],
}
/** 실시간 구독(1초 상태 · 10초 요약 · 3D 물류)이 부르는 API */
const LIVE_PATHS = ['/monitoring/status', '/production/counts', '/coil/today', '/production/flow/positions', '/utilization/summary', '/utilization/by-line', '/production/plans', '/production/wip']

const median = (xs) => { const s = [...xs].filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null }

// ── 비교 표 ──
function compare(a, b) {
  const A = JSON.parse(readFileSync(join(OUT, `${a}.json`), 'utf8'))
  const B = JSON.parse(readFileSync(join(OUT, `${b}.json`), 'utf8'))
  const lines = [`| 시나리오 | 지표 | ${a} (${A.commit}) | ${b} (${B.commit}) | 변화 |`, '|---|---|---:|---:|---:|']
  for (const [key, [title, metrics]] of Object.entries(LABELS)) {
    if (!A.results[key] || !B.results[key]) continue
    let first = true
    for (const [m, name] of Object.entries(metrics)) {
      const x = A.results[key][m]
      const y = B.results[key][m]
      const ch = x == null || y == null ? '-' : x === 0 ? (y === 0 ? '0%' : '+') : `${y - x > 0 ? '+' : ''}${Math.round(((y - x) / x) * 100)}%`
      lines.push(`| ${first ? title : ''} | ${name} | ${x ?? '-'} | ${y ?? '-'} | ${ch} |`)
      first = false
    }
  }
  console.log(lines.join('\n'))
}

// ── 측정 ──
async function measure() {
  const label = arg('--label', 'run')
  const runs = Number(arg('--runs', 3))
  const gpu = has('--gpu')
  const only = arg('--only', '')?.split(',').filter(Boolean)
  const want = (k) => !only?.length || only.includes(k)
  const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  const dirty = execSync('git status --porcelain -- src', { cwd: ROOT }).toString().trim() !== ''

  // 빌드 3종: 데모 · 데모(조회 지연) · 실서버 모드
  const variants = { mock: {}, slow: { VITE_MOCK_DELAY_MS: String(MOCK_DELAY) }, api: { VITE_DATA_SOURCE: 'api' } }
  const dirOf = (v) => join(ROOT, 'node_modules/.perf', v)
  if (!has('--skip-build')) {
    for (const [v, env] of Object.entries(variants)) {
      for (const k of ['VITE_MOCK_DELAY_MS', 'VITE_DATA_SOURCE']) delete process.env[k]
      Object.assign(process.env, env)
      console.log(`빌드: ${v}`)
      await build({ root: ROOT, logLevel: 'error', build: { outDir: dirOf(v), emptyOutDir: true } })
    }
    for (const k of ['VITE_MOCK_DELAY_MS', 'VITE_DATA_SOURCE']) delete process.env[k]
  }
  const servers = {}
  const base = {}
  let port = 4180
  for (const v of Object.keys(variants)) {
    servers[v] = await preview({ root: ROOT, logLevel: 'error', build: { outDir: dirOf(v) }, preview: { port, strictPort: true, open: false } })
    base[v] = `http://localhost:${port}`
    port += 1
  }

  const args = gpu ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: !gpu, args } : { channel: 'chrome', headless: !gpu, args })

  const scenarios = { idle, enter, revisit, requests, memory }
  const raw = {}
  try {
    for (const [k, fn] of Object.entries(scenarios)) {
      if (!want(k)) continue
      raw[k] = []
      for (let i = 0; i < runs; i++) {
        process.stdout.write(`${LABELS[k][0]} ${i + 1}/${runs} … `)
        const r = await fn(browser, base)
        raw[k].push(r)
        console.log(JSON.stringify(r))
      }
    }
  } finally {
    await browser.close()
    for (const s of Object.values(servers)) await s.close()
  }

  const results = Object.fromEntries(Object.entries(raw).map(([k, rs]) => [k, Object.fromEntries(Object.keys(rs[0]).map((m) => [m, median(rs.map((r) => r[m]))]))]))
  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `${label}.json`)
  let doc = { label, date: new Date().toISOString(), commit: dirty ? `${commit}+수정` : commit, gpu, runs, viewport: `${W}x${H}`, results, raw }
  if (has('--merge') && existsSync(file)) {
    const old = JSON.parse(readFileSync(file, 'utf8'))
    if (old.commit !== doc.commit) throw new Error(`--merge: 커밋이 다름 (${old.commit} ≠ ${doc.commit})`)
    doc = { ...old, date: doc.date, results: { ...old.results, ...results }, raw: { ...old.raw, ...raw } }
  }
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
  console.log(`\n저장: ${file}`)
  console.table(Object.fromEntries(Object.entries(results).map(([k, v]) => [LABELS[k][0], v])))
}

// ── 공통 ──
const SESSION = { loginId: 'lead', name: '김현수', role: 'PROD_LEAD', lines: [], expiresAt: Date.now() + 864e5 }

async function open(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } })
  await ctx.addInitScript((s) => {
    localStorage.setItem('sfaas.session', JSON.stringify(s))
    localStorage.setItem('sfaas.accessToken', 'perf')
    window.__long = []
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true })
  }, SESSION)
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  if (url) await page.goto(url)
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300) }
  const longs = async (reset = false) => page.evaluate((r) => { const x = window.__long; if (r) window.__long = []; return x }, reset)
  return { ctx, page, metrics, gc, longs }
}
const dash = (page) => page.locator('.f3d-line').first().waitFor({ timeout: 30_000 })
const utilRows = (page) => page.locator('.ledger .rows').first().waitFor({ timeout: 30_000 })
const nav = (page, name) => page.getByRole('link', { name, exact: true }).first().click()
const sum = (xs) => xs.reduce((a, x) => a + x, 0)

/** 대시보드를 띄워 두기만 한 5초: 자바스크립트·작업 시간 */
async function idle(browser, base) {
  const { ctx, page, metrics, longs } = await open(browser, `${base.mock}/`)
  await dash(page)
  await page.waitForTimeout(4000)
  await longs(true)
  const a = await metrics()
  await page.waitForTimeout(5000)
  const b = await metrics()
  const l = await longs()
  await ctx.close()
  return { jsMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000), taskMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000), longCount: l.length }
}

/** 대시보드 → 가동률 → 대시보드: 돌아올 때 3D가 뜨기까지 시간과 멈춤(긴 작업) */
async function enter(browser, base) {
  const { ctx, page, longs } = await open(browser, `${base.mock}/`)
  await dash(page)
  await page.waitForTimeout(2000)
  await nav(page, '가동률')
  await utilRows(page)
  await page.waitForTimeout(1500)
  await longs(true)
  const t0 = Date.now()
  await nav(page, '대시보드')
  await dash(page)
  const readyMs = Date.now() - t0
  await page.waitForTimeout(Math.max(0, 2000 - readyMs))
  const l = await longs()
  await ctx.close()
  return { readyMs, longCount: l.length, longMax: Math.max(0, ...l), longSum: sum(l) }
}

/** 가동률에 처음 들어갈 때와 다시 들어갈 때 값이 뜨기까지 (데모 조회 지연 빌드) */
async function revisit(browser, base) {
  const { ctx, page } = await open(browser, `${base.slow}/`)
  await dash(page)
  await page.waitForTimeout(1500)
  let t0 = Date.now()
  await nav(page, '가동률')
  await utilRows(page)
  const firstMs = Date.now() - t0
  await nav(page, '대시보드')
  await dash(page)
  await page.waitForTimeout(1500)
  t0 = Date.now()
  await nav(page, '가동률')
  await utilRows(page)
  const secondMs = Date.now() - t0
  await ctx.close()
  return { firstMs, secondMs }
}

/** 실서버 모드에서 나가는 요청 수: 모든 /api 요청에 빈 배열로 답하고 개수만 센다 */
async function requests(browser, base) {
  const { ctx, page } = await open(browser)
  let hits = []
  await page.route('**/api/**', (r) => { hits.push(new URL(r.request().url()).pathname.replace(/^\/api/, '')); return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) })
  await page.goto(`${base.api}/`)
  await page.waitForTimeout(3000)
  hits = []
  await page.waitForTimeout(10_000)
  const idle10s = hits.length
  const live = (xs) => xs.filter((p) => LIVE_PATHS.includes(p)).length
  // 같은 구독(상태·요약)을 쓰는 화면으로: 라인 상세 (앱 안 이동 = 주소 바꾸고 popstate)
  const go = (path) => page.evaluate((x) => { history.pushState({}, '', x); dispatchEvent(new PopStateEvent('popstate')) }, path)
  hits = []
  await go('/lines/B')
  await page.waitForTimeout(2000)
  const toLine = hits.length
  const toLineLive = live(hits)
  await go('/')
  await page.waitForTimeout(4000)
  hits = []
  await nav(page, '가동률')
  await page.waitForTimeout(2000)
  const toUtil = hits.length
  const toUtilLive = live(hits)
  // 금방 돌아올 때 (구독 유지 30초 안)
  hits = []
  await nav(page, '대시보드')
  await page.waitForTimeout(2000)
  const backQuick = hits.length
  const backQuickLive = live(hits)
  // 떠난 뒤 30초 동안 모두 몇 건 나가는지 (떠난 화면 몫 구독이 얼마나 더 도는지), 그 뒤 다른 화면에 머무는 동안
  hits = []
  await nav(page, '가동률')
  await page.waitForTimeout(30_000)
  const away30s = hits.length
  const away30sLive = live(hits)
  await page.waitForTimeout(5_000)
  hits = []
  await page.waitForTimeout(10_000)
  const utilAway10s = hits.length
  const utilAwayLive = live(hits)
  hits = []
  await nav(page, '대시보드')
  await page.waitForTimeout(2000)
  const backLate = hits.length
  const backLateLive = live(hits)
  await ctx.close()
  return { idle10s, toLine, toLineLive, toUtil, toUtilLive, backQuick, backQuickLive, away30s, away30sLive, utilAway10s, utilAwayLive, backLate, backLateLive }
}

/** 대시보드 ↔ 가동률을 18번 오간 뒤 메모리 (메모리 정리 후) */
async function memory(browser, base) {
  const { ctx, page, metrics, gc } = await open(browser, `${base.mock}/`)
  await dash(page)
  await page.waitForTimeout(2000)
  await gc()
  const a = await metrics()
  for (let i = 0; i < 18; i++) {
    await nav(page, '가동률')
    await utilRows(page)
    await page.waitForTimeout(300)
    await nav(page, '대시보드')
    await dash(page)
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1000)
  await gc()
  const b = await metrics()
  await ctx.close()
  const mb = (x) => Math.round((x / 1e6) * 10) / 10
  return { heapStartMb: mb(a.JSHeapUsedSize), heapEndMb: mb(b.JSHeapUsedSize), domEnd: b.Nodes, listenersEnd: b.JSEventListeners }
}

// ── 시작 (맨 아래: 위의 상수가 다 정해진 뒤) ──
if (has('--compare')) {
  const [a, b] = argv.slice(argv.indexOf('--compare') + 1)
  compare(a, b)
} else {
  await measure()
}
