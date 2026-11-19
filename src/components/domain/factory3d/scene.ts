// 3D 공장 장면 (SCR-005). Three.js로 설비 39대·컨베이어·재공·제품 점을 그린다
// 마우스: 왼쪽 끌기 = 이동, 휠 = 확대, 오른쪽 끌기 = 회전 (탑뷰에서 오른쪽을 누르면 3D로 바뀜)
// 값은 밖에서 넣는다 (setStates · setIssues · setRoutes · setFlow). 이 파일은 데이터를 부르지 않는다
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { makeKit } from '@/components/domain/factory3d/equipment'
import type { StateCode } from '@/types/state'
import type { FlowPositions, FlowLocation } from '@/types/live'
import type { ProductionLineId } from '@/types/plant'

export type ViewMode = '3d' | 'top'

/** 토큰에서 읽은 색 (getComputedStyle). 키는 상태 코드 + 모형 색 */
export interface SceneColors {
  state: Record<StateCode, string>
  bg: string; floor: string; grid: string; yard: string; body: string; frame: string
  metal: string; dark: string; chrome: string; glass: string; wood: string; carton: string; belt: string; route: string; route2: string; routeAlt: string; product: string; cap: string
}

export interface SceneHandlers {
  /** 설비를 눌렀을 때 */
  onPick(equipmentId: string): void
  /** 라인 이름표를 눌렀을 때 */
  onLine(lineId: ProductionLineId): void
  /** 구역 이름을 눌렀을 때 (코일 적재장 · 도장 · 비전/출하) */
  onZone(zone: ZoneId): void
}

export type ZoneId = 'inbound' | 'paint' | 'outbound'

export interface SceneIssue { equipmentId: string; state: StateCode }

const LINES: ProductionLineId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const lineZ = (i: number) => -30 + i * 12
const PAINT_Z = [-18, 18]
const PILE_CAP = 60
const MAX_BEADS = 1800

interface Eq {
  id: string; line: ProductionLineId | null; kind: 'SL' | 'PR' | 'WD' | 'PT' | 'VI'; no: string
  x: number; z: number; h: number
  group: THREE.Group; pad: THREE.Mesh; caps: THREE.Mesh[]; chip: Tag
  state: StateCode; dim: boolean
}
interface Tag { el: HTMLDivElement; pos: THREE.Vector3; only: ViewMode | null }
interface Bead { line: ProductionLineId; loc: FlowLocation; prev: THREE.Vector3 | null; draw: THREE.Vector3 | null; a0: number }

type Mat = THREE.MeshStandardMaterial
const matOf = (m: THREE.Object3D) => (m as THREE.Mesh).material as Mat

export function createFactoryScene(host: HTMLElement, C: SceneColors, on: SceneHandlers) {
  const W = () => host.clientWidth || 1
  const H = () => host.clientHeight || 1

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W(), H())
  renderer.shadowMap.enabled = true
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(C.bg)

  const persp = new THREE.PerspectiveCamera(40, W() / H(), 1, 1000)
  persp.position.set(-52, 96, 110)
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000)
  ortho.up.set(0, 0, -1)
  const fitOrtho = () => {
    const a = W() / H()
    let hw = 96
    let hh = 54
    if (a > hw / hh) hw = hh * a
    else hh = hw / a
    Object.assign(ortho, { left: -hw, right: hw, top: hh, bottom: -hh })
    ortho.updateProjectionMatrix()
  }
  fitOrtho()
  const mkCtl = (cam: THREE.Camera) => {
    const c = new OrbitControls(cam, renderer.domElement)
    c.enableDamping = true
    c.screenSpacePanning = false
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    c.target.set(0, 0, 4)
    return c
  }
  const cP = mkCtl(persp)
  cP.maxPolarAngle = Math.PI / 2.15
  cP.minDistance = 12
  cP.maxDistance = 260
  const cO = mkCtl(ortho)
  cO.enableRotate = false
  cO.minZoom = 0.6
  cO.maxZoom = 6
  cO.enabled = false
  let mode: ViewMode = '3d'
  let cam: THREE.Camera = persp

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cc, 2.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(-40, 90, 50)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70 })
  scene.add(sun)

  const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.15, ...o })
  const box = (w: number, h: number, d: number, mat: Mat, x: number, y: number, z: number, p?: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y + h / 2, z)
    m.castShadow = m.receiveShadow = true
    ;(p ?? scene).add(m)
    return m
  }
  const cyl = (r: number, h: number, mat: Mat, x: number, y: number, z: number, p?: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    ;(p ?? scene).add(m)
    return m
  }

  const floor = box(176, 0.4, 92, M(C.floor, { roughness: 0.95 }), 8, -0.4, 0)
  const grid = new THREE.GridHelper(176, 58, C.grid, C.grid)
  grid.position.set(8, 0.01, 0)
  scene.add(grid)
  box(18, 0.05, 86, M(C.yard), -62, 0, 0)
  const capM = M(C.cap)
  const kit = makeKit({ cap: capM, frame: C.frame, metal: C.metal, body: C.body, dark: C.dark, chrome: C.chrome, glass: C.glass, robot: C.routeAlt, wood: C.wood, carton: C.carton })
  const metal = M(C.metal, { metalness: 0.2, roughness: 0.5 })
  const frame = M(C.frame)
  const belt = M(C.belt)

  // ── 겹쳐 그리는 이름표 (HTML) ──
  const layer = document.createElement('div')
  layer.className = 'f3d-layer'
  host.appendChild(layer)
  const tags: Tag[] = []
  const tag = (html: string, cls: string, pos: [number, number, number], only: ViewMode | null = null): Tag => {
    const el = document.createElement('div')
    el.className = `f3d-tag ${cls}`
    el.innerHTML = html
    layer.appendChild(el)
    const t = { el, pos: new THREE.Vector3(...pos), only }
    tags.push(t)
    return t
  }

  // ── 설비 ──
  const EQ = new Map<string, Eq>()
  const addEq = (g: THREE.Group, m: Omit<Eq, 'group' | 'pad' | 'caps' | 'chip' | 'state' | 'dim'> & { pw?: number; pd?: number }) => {
    scene.add(g)
    const caps: THREE.Mesh[] = []
    g.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const mat = matOf(o)
      const isCap = mat === capM
      ;(o as THREE.Mesh).material = mat.clone()
      o.userData.eq = m.id
      if (isCap) caps.push(o as THREE.Mesh)
    })
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(m.pw ?? 6, m.pd ?? 5.6), new THREE.MeshBasicMaterial({ color: C.state.R, transparent: true, opacity: 0.35 }))
    pad.rotation.x = -Math.PI / 2
    pad.position.set(m.x, 0.03, m.z)
    pad.userData.eq = m.id
    scene.add(pad)
    const chip = tag('<span class="f3d-chip"></span>', '', [m.x, 1, m.z], 'top')
    EQ.set(m.id, { ...m, group: g, pad, caps, chip, state: 'R', dim: false })
  }

  for (let i = 0; i < 12; i++) {
    const x = -67 + (i % 2) * 7
    const z = -36 + Math.floor(i / 2) * 13.5
    for (let k = 0; k < 2; k++) cyl(2.2, 2.6, metal, x, 1.4 + k * 2.7, z)
    cyl(0.7, 5.6, frame, x, 2.8, z)
  }
  const craneG = new THREE.Group()
  craneG.position.set(-62, 0, 0)
  craneG.scale.setScalar(1.05)
  kit.crane(craneG)
  scene.add(craneG)
  const lineObjs: Record<string, THREE.Object3D[]> = {}
  LINES.forEach((L, i) => {
    const z = lineZ(i)
    const n0 = scene.children.length
    box(76, 0.6, 2.2, belt, -15, 0, z)
    const slit = new THREE.Group()
    slit.position.set(-42, 0, z)
    slit.scale.setScalar(0.85)
    kit.slitter(slit)
    addEq(slit, { id: `${L}-SL`, line: L, kind: 'SL', no: 'SL', x: -42, z, h: 3.4, pw: 14, pd: 5 })
    for (let p = 0; p < 4; p++) {
      const x = -25 + p * 8.5
      const pg = new THREE.Group()
      pg.position.set(x, 0, z)
      pg.scale.setScalar(0.85)
      const v = (['A', 'B', 'C', 'A'] as const)[p]
      kit.press(pg, v)
      addEq(pg, { id: `${L}-PR${p + 1}`, line: L, kind: 'PR', no: `PR${p + 1}`, x, z, h: v === 'C' ? 8.6 : v === 'B' ? 9 : 7.5 })
    }
    const wg = new THREE.Group()
    wg.position.set(18, 0, z)
    wg.scale.setScalar(0.62)
    kit.welder(wg)
    addEq(wg, { id: `${L}-WD`, line: L, kind: 'WD', no: 'WD', x: 18, z, h: 5, pw: 7, pd: 5 })
    box(6, 0.6, 2.2, belt, 25, 0, z)
    lineObjs[L] = scene.children.slice(n0)
    lineObjs[L].forEach((o) => o.traverse((m) => { if ((m as THREE.Mesh).isMesh && !m.userData.eq) (m as THREE.Mesh).material = matOf(m).clone() }))
  })
  const transfer = box(2.2, 0.6, 36, belt.clone(), 29, 0, 0)
  const paintObjs: THREE.Object3D[][] = [[], []]
  ;[[0, 1, 2], [3, 4, 5]].forEach((grp, pi) => {
    grp.forEach((i) => lineObjs[LINES[i]].push(box(2.8, 1.2, 2.8, frame.clone(), 29, 0, lineZ(i))))
    const n0 = scene.children.length
    const z = PAINT_Z[pi]
    const g = new THREE.Group()
    g.position.set(48, 0, z)
    g.scale.setScalar(1.7)
    kit.paint(g)
    box(8, 0.6, 2.2, belt.clone(), 33, 0, z)
    addEq(g, { id: `PT${pi + 1}`, line: null, kind: 'PT', no: `PT${pi + 1}`, x: 48, z, h: 9, pw: 23, pd: 11 })
    box(10, 0.6, 2.2, belt.clone(), 64, 0, z)
    box(2.2, 0.6, Math.abs(z), belt.clone(), 68, 0, z / 2)
    paintObjs[pi] = scene.children.slice(n0)
  })
  const vg = new THREE.Group()
  vg.position.set(74, 0, 0)
  vg.scale.setScalar(1.15)
  kit.vision(vg)
  box(10, 0.6, 2.2, belt, 72, 0, 0)
  addEq(vg, { id: 'VI', line: null, kind: 'VI', no: 'VI', x: 74, z: 0, h: 5, pw: 7, pd: 9 })
  box(10, 0.6, 2.2, belt, 82, 0, 0)
  ;[-12, 12].forEach((z, i) => {
    const sg = new THREE.Group()
    sg.position.set(88, 0, z)
    sg.scale.setScalar(0.8)
    kit.shipping(sg, i === 0)
    scene.add(sg)
  })

  const lineTags = LINES.map((L, i) => {
    const t = tag(`${L}라인`, 'f3d-line', [-55, 1, lineZ(i)])
    t.el.addEventListener('click', () => on.onLine(L))
    return t
  })
  // 구역 이름: 코일 적재장·도장·비전·출하는 눌러서 상세 화면으로 (2D 배치도와 같은 이동)
  const ZONES: [string, number, number, number, ZoneId | null][] = [
    ['코일 적재장', -64, 7, -42, 'inbound'], ['슬리팅', -42, 6, -37, null], ['프레스 ×4', -12, 11, -37, null], ['용접', 18, 8, -37, null],
    ['도장 1', 48, 9, -24, 'paint'], ['도장 2', 48, 9, 12, 'paint'], ['비전 검사', 74, 8, -6, 'outbound'], ['출하', 86, 6, -16, 'outbound'],
  ]
  for (const [n, x, y, z, go] of ZONES) {
    const t = tag(n, go ? 'f3d-zone f3d-go' : 'f3d-zone', [x, y, z])
    if (go) t.el.addEventListener('click', () => on.onZone(go))
  }

  // 재공 더미 (공정 사이만)
  const PILES = new Map<string, { x: number; z: number; lab: Tag; n: number }>()
  const pileAt = (key: string, x: number, z: number) => PILES.set(key, { x, z, lab: tag('', 'f3d-cnt', [x, 3.2, z], '3d'), n: 0 })
  LINES.forEach((L, i) => { pileAt(`${L}:SL-PR`, -33, lineZ(i)); pileAt(`${L}:PR-WD`, 8.5, lineZ(i)); pileAt(`${L}:WD-PT`, 24.5, lineZ(i)) })
  ;[0, 1].forEach((p) => pileAt(`PT${p + 1}:PT-VI`, 64, PAINT_Z[p]))
  const coilLab = tag('', 'f3d-cnt', [-64, 9, -30], '3d')

  // ── 도장 경로 ──
  let routes: Record<ProductionLineId, number> = { A: 0, B: 0, C: 0, D: 1, E: 1, F: 1 }
  const defP = (i: number) => (i < 3 ? 0 : 1)
  const rMat = [C.route, C.route2, C.routeAlt].map((c) => new THREE.MeshBasicMaterial({ color: c }))
  let rMesh: THREE.Mesh[] = []
  const drawRoutes = () => {
    // 막대마다 geometry와 복제한 재질을 새로 만들므로 같이 정리한다 (안 하면 그래픽 메모리에 남는다)
    rMesh.forEach((m) => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose() })
    rMesh = []
    const s = (w: number, d: number, x: number, z: number, mat: THREE.MeshBasicMaterial, r: { line?: string; paint?: number }) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat.clone())
      m.position.set(x, 0.72, z)
      m.userData.r = r
      scene.add(m)
      rMesh.push(m)
    }
    LINES.forEach((L, i) => {
      const z = lineZ(i)
      const pz = PAINT_Z[routes[L]]
      const mat = routes[L] !== defP(i) ? rMat[2] : rMat[routes[L]]
      const off = ((i % 3) - 1) * 0.45
      s(6, 0.5, 25, z, mat, { line: L })
      s(0.5, Math.abs(pz - z) || 0.5, 29 + off, (z + pz) / 2, mat, { line: L })
    })
    ;[0, 1].forEach((p) => s(8, 0.5, 33, PAINT_Z[p], rMat[p], { paint: p }))
    applyDim()
  }

  // ── 라인 선택: 고른 라인의 흐름(라인 → 지금 쓰는 도장 → 비전)만 밝게 ──
  let sel: ProductionLineId | null = null
  const dimObj = (o: THREE.Object3D, dim: boolean) => o.traverse((m) => {
    if (!(m as THREE.Mesh).isMesh) return
    const mat = matOf(m)
    const u = mat.userData
    if (u.o0 === undefined) { u.o0 = mat.opacity; u.t0 = mat.transparent && mat.opacity < 1 }
    const tr = dim || u.t0
    // 불투명 ↔ 반투명이 바뀌면 셰이더를 다시 만들어야 투명도가 먹는다
    if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true }
    mat.opacity = dim ? 0.15 : u.o0
    mat.depthWrite = !dim
  })
  const fade = (t: Tag, dim: boolean, v = 0.3) => { t.el.style.opacity = dim ? String(v) : '1' }
  function applyDim() {
    const pSel = sel ? routes[sel] : -1
    for (const e of EQ.values()) {
      e.dim = !!sel && (e.line ? e.line !== sel : e.kind === 'PT' && Number(e.id[2]) - 1 !== pSel)
      fade(e.chip, e.dim)
    }
    ;[0, 1].forEach((p) => { const dim = !!sel && p !== pSel; paintObjs[p].forEach((o) => dimObj(o, dim)); fade(PILES.get(`PT${p + 1}:PT-VI`)!.lab, dim, 0.25) })
    dimObj(transfer, !!sel)
    rMesh.forEach((m) => { const r = m.userData.r; dimObj(m, !!sel && (r.line ? r.line !== sel : r.paint !== pSel)) })
    LINES.forEach((L, i) => {
      const dim = !!sel && L !== sel
      lineObjs[L].forEach((o) => dimObj(o, dim))
      ;['SL-PR', 'PR-WD', 'WD-PT'].forEach((k) => fade(PILES.get(`${L}:${k}`)!.lab, dim, 0.25))
      fade(lineTags[i], dim, 0.4)
      lineTags[i].el.classList.toggle('on', L === sel)
    })
  }

  // 정지된 라인(설비가 모두 S): 채도·명도를 낮춘다. 상태 색 뚜껑·바닥 칸은 그대로
  const hsl = { h: 0, s: 0, l: 0 }
  const tinted = new Set<string>()
  const tintLine = (L: ProductionLineId, off: boolean) => {
    if (tinted.has(L) === off) return
    if (off) tinted.add(L)
    else tinted.delete(L)
    lineObjs[L].forEach((o) => o.traverse((m) => {
      if (!(m as THREE.Mesh).isMesh || m === EQ.get(`${L}-SL`)!.pad) return
      if ([...EQ.values()].some((e) => e.caps.includes(m as THREE.Mesh))) return
      const mat = matOf(m)
      if (mat.userData.c0 === undefined) mat.userData.c0 = mat.color.getHex()
      mat.color.setHex(mat.userData.c0)
      if (off) { mat.color.getHSL(hsl); mat.color.setHSL(hsl.h, hsl.s * 0.3, hsl.l * 0.78) }
    }))
  }

  // ── "!" 이슈 표시와 화면 밖 고장 말풍선 ──
  const bangs = new Map<string, { t: Tag; state: StateCode }>()
  const setIssues = (list: SceneIssue[]) => {
    const keep = new Set(list.map((x) => x.equipmentId))
    for (const [id, b] of bangs) if (!keep.has(id)) { b.t.el.remove(); tags.splice(tags.indexOf(b.t), 1); bangs.delete(id) }
    for (const it of list) {
      const e = EQ.get(it.equipmentId)
      if (!e) continue
      let b = bangs.get(e.id)
      if (!b) {
        const t = tag('<button type="button" class="f3d-bang" aria-label="이상 보기">!</button>', '', [e.x, e.h + 3.6, e.z])
        t.el.firstElementChild!.addEventListener('click', () => on.onPick(e.id))
        b = { t, state: it.state }
        bangs.set(e.id, b)
      }
      b.state = it.state
      ;(b.t.el.firstElementChild as HTMLElement).dataset.state = it.state
    }
  }
  const edges = new Map<string, HTMLButtonElement>()
  const v3 = new THREE.Vector3()
  const drawEdges = () => {
    const live = new Set<string>()
    for (const [id, b] of bangs) {
      if (b.state !== 'D') continue
      const e = EQ.get(id)!
      v3.set(e.x, e.h, e.z).project(cam)
      const off = v3.z > 1 || Math.abs(v3.x) > 0.95 || Math.abs(v3.y) > 0.92
      if (!off) continue
      live.add(id)
      let el = edges.get(id)
      if (!el) {
        el = document.createElement('button')
        el.type = 'button'
        el.className = 'f3d-edge'
        el.addEventListener('click', () => flyTo(id))
        layer.appendChild(el)
        edges.set(id, el)
      }
      let x = v3.x
      let y = v3.y
      if (v3.z > 1) { x = -x; y = -y }
      const k = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1)
      x /= k
      y /= k
      const ang = (Math.atan2(-y, x) * 180) / Math.PI
      const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(ang / 45) % 8) + 8) % 8]
      el.textContent = `${arrow} ${id} 고장`
      el.style.left = `${Math.min(W() - 130, Math.max(8, ((x + 1) / 2) * W() - 50))}px`
      el.style.top = `${Math.min(H() - 40, Math.max(8, ((1 - y) / 2) * H() - 12))}px`
    }
    for (const [id, el] of edges) if (!live.has(id)) { el.remove(); edges.delete(id) }
  }

  // ── 제품 점 ──
  const beadMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), MAX_BEADS)
  beadMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  beadMesh.count = 0
  scene.add(beadMesh)
  const beads = new Map<string, Bead>()
  const pileOrder = new Map<string, string[]>()
  let coilWip = 0
  const prodC = new THREE.Color(C.product)
  const bgC = new THREE.Color(C.bg)
  const tmpC = new THREE.Color()
  const tmpM = new THREE.Matrix4()
  const slot = (k: number): [number, number, number] => [((k % 3) - 1) * 0.95, 0.75 + Math.floor(k / 9) * 0.24, ((Math.floor(k / 3) % 3) - 1) * 0.95]
  const posOf = (id: string, b: Bead): THREE.Vector3 | null => {
    const l = b.loc
    if ('eq' in l) {
      const e = EQ.get(l.eq)
      if (!e) return null
      return new THREE.Vector3(e.x + (e.kind === 'PT' ? -6 : 1.6), e.h + 0.15, e.z + (e.kind === 'VI' ? 0 : 1.2))
    }
    const P = PILES.get(l.pile)
    const k = pileOrder.get(l.pile)?.indexOf(id) ?? -1
    if (!P || k < 0 || k >= PILE_CAP) return null
    const [dx, dy, dz] = slot(k)
    return new THREE.Vector3(P.x + dx, dy, P.z + dz)
  }
  const sameLoc = (a: FlowLocation, b: FlowLocation) => ('eq' in a && 'eq' in b && a.eq === b.eq) || ('pile' in a && 'pile' in b && a.pile === b.pile)
  const setFlow = (f: FlowPositions | null) => {
    const now = performance.now()
    const seen = new Set<string>()
    pileOrder.clear()
    for (const P of PILES.values()) P.n = 0
    for (const p of f?.products ?? []) {
      seen.add(p.productId)
      const b = beads.get(p.productId)
      if (!b) beads.set(p.productId, { line: p.lineId, loc: p.location, prev: null, draw: null, a0: now })
      else if (!sameLoc(b.loc, p.location)) { b.prev = b.draw?.clone() ?? null; b.loc = p.location; b.a0 = now }
      if ('pile' in p.location) {
        const k = p.location.pile
        if (!pileOrder.has(k)) pileOrder.set(k, [])
        pileOrder.get(k)!.push(p.productId)
        const P = PILES.get(k)
        if (P) P.n += 1
      }
    }
    for (const id of beads.keys()) if (!seen.has(id)) beads.delete(id)
    coilWip = f?.coilWip ?? 0
  }
  const pidPool = Array.from({ length: 36 }, () => { const t = tag('', 'f3d-pid', [0, 0, 0], '3d'); t.el.hidden = true; return t })
  const drawBeads = (now: number) => {
    let n = 0
    const show = mode === '3d'
    if (show) for (const [id, b] of beads) {
      if (n >= MAX_BEADS) break
      const to = posOf(id, b)
      if (!to) continue
      let pos = to
      const k = Math.min(1, (now - b.a0) / 1000)
      if (b.prev && k < 1) { pos = v3.copy(b.prev).lerp(to, k); pos.y += Math.sin(k * Math.PI) * 0.8 }
      tmpM.makeTranslation(pos.x, pos.y, pos.z)
      beadMesh.setMatrixAt(n, tmpM)
      tmpC.copy(prodC)
      if (sel && b.line !== sel) tmpC.lerp(bgC, 0.8)
      beadMesh.setColorAt(n, tmpC)
      b.draw = pos.clone()
      n++
    }
    beadMesh.count = n
    beadMesh.instanceMatrix.needsUpdate = true
    if (beadMesh.instanceColor) beadMesh.instanceColor.needsUpdate = true
    // 제품 ID: 가까이 확대하면 화면 가운데 근처만
    let used = 0
    if (show && persp.position.distanceTo(cP.target) < 70) {
      const cand: [number, string, THREE.Vector3][] = []
      for (const [id, b] of beads) {
        if (!b.draw) continue
        v3.copy(b.draw).project(persp)
        if (Math.abs(v3.x) < 0.6 && Math.abs(v3.y) < 0.6 && v3.z < 1) cand.push([v3.x * v3.x + v3.y * v3.y, id, b.draw])
      }
      cand.sort((a, b) => a[0] - b[0]).slice(0, pidPool.length).forEach(([, id, at]) => {
        const t = pidPool[used++]
        t.el.textContent = `${id[0]}-${id.slice(-4)}`
        t.el.title = id
        t.pos.copy(at).y += 0.5
        t.el.hidden = false
      })
    }
    for (let i = used; i < pidPool.length; i++) pidPool[i].el.hidden = true
  }

  // ── 상태 색 ──
  const setStates = (list: { id: string; state: StateCode }[]) => {
    for (const s of list) { const e = EQ.get(s.id); if (e) e.state = s.state }
    for (const L of LINES) {
      const es = [...EQ.values()].filter((e) => e.line === L)
      tintLine(L, es.every((e) => e.state === 'S'))
    }
  }
  const paint = (now: number) => {
    const blink = Math.sin(now / 180) > 0
    for (const e of EQ.values()) {
      const c = C.state[e.state]
      e.caps.forEach((m) => matOf(m).color.set(c))
      const pm = e.pad.material as THREE.MeshBasicMaterial
      pm.color.set(c)
      pm.opacity = e.dim ? 0.08 : mode === 'top' ? 0.75 : 0.35
      const hot = e.state === 'D' && blink
      e.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) matOf(o).emissive.setHex(hot ? 0x8a1c1c : 0) })
      if (mode === 'top') {
        const chip = e.chip.el.firstElementChild as HTMLElement
        chip.dataset.state = e.state
        chip.textContent = `${e.no} ${e.state}`
      }
    }
    for (const P of PILES.values()) {
      P.lab.el.textContent = P.n > PILE_CAP ? `${PILE_CAP}+ / ${P.n}` : String(P.n)
      P.lab.el.style.visibility = P.n ? 'visible' : 'hidden'
    }
    coilLab.el.textContent = `코일 재공 ${coilWip}개`
  }
  const pv = new THREE.Vector3()
  const placeTags = () => {
    const w = W()
    const h = H()
    for (const t of tags) {
      if (t.el.hidden) continue
      const shown = !t.only || t.only === mode
      t.el.style.display = shown ? '' : 'none'
      if (!shown) continue
      pv.copy(t.pos).project(cam)
      if (pv.z > 1) { t.el.style.visibility = 'hidden'; continue }
      if (!t.el.classList.contains('f3d-cnt')) t.el.style.visibility = ''
      t.el.style.transform = `translate(${((pv.x + 1) / 2) * w}px,${((1 - pv.y) / 2) * h}px) translate(-50%,-100%)`
    }
  }

  // ── 보기 전환 ──
  let tween: ((now: number) => void) | null = null
  const fly = (pos: THREE.Vector3, tgt: THREE.Vector3, ms = 650, done?: () => void) => {
    const p0 = persp.position.clone()
    const t0 = cP.target.clone()
    const s = performance.now()
    tween = (now) => {
      const k = Math.min(1, (now - s) / ms)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      persp.position.lerpVectors(p0, pos, e)
      cP.target.lerpVectors(t0, tgt, e)
      if (k >= 1) { tween = null; done?.() }
    }
  }
  const shadows = () => {
    const top = mode === 'top'
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== beadMesh && ((o as THREE.Mesh).geometry.type === 'BoxGeometry' || o === floor)) o.receiveShadow = !top })
  }
  let onMode: ((m: ViewMode) => void) | null = null
  const setView = (m: ViewMode) => {
    if (m === mode) {
      if (m === '3d') { const t = cP.target.clone(); fly(new THREE.Vector3(t.x - 50, 85, t.z + 90), t) }
      return
    }
    if (m === 'top') {
      const t = new THREE.Vector3(2, 0, 0)
      ortho.zoom = 1
      ortho.updateProjectionMatrix()
      fly(new THREE.Vector3(t.x, 150, t.z + 0.01), t, 600, () => {
        mode = 'top'
        cam = ortho
        cP.enabled = false
        cO.enabled = true
        cO.target.copy(t)
        ortho.position.set(t.x, 200, t.z)
        ortho.lookAt(t)
        cO.update()
        shadows()
        onMode?.('top')
      })
    } else {
      const t = cO.target.clone()
      mode = '3d'
      cam = persp
      cO.enabled = false
      cP.enabled = true
      persp.position.set(t.x, 150 / ortho.zoom, t.z + 0.01)
      cP.target.copy(t)
      cP.update()
      shadows()
      onMode?.('3d')
    }
  }
  function flyTo(id: string) {
    const e = EQ.get(id)
    if (!e) return
    if (mode === 'top') {
      cO.target.set(e.x, 0, e.z)
      ortho.position.set(e.x, 200, e.z)
      ortho.zoom = 2.2
      ortho.updateProjectionMatrix()
    } else fly(new THREE.Vector3(e.x - 18, 30, e.z + 30), new THREE.Vector3(e.x, 0, e.z))
  }

  // ── 마우스 ──
  const onRightDown = (ev: PointerEvent) => { if (mode === 'top' && ev.button === 2) setView('3d') }
  host.addEventListener('pointerdown', onRightDown, true)
  const noMenu = (e: Event) => e.preventDefault()
  renderer.domElement.addEventListener('contextmenu', noMenu)
  const ray = new THREE.Raycaster()
  const ms = new THREE.Vector2()
  let down: [number, number, number] | null = null
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, e.button] })
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || down[2] !== 0 || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return
    const r = renderer.domElement.getBoundingClientRect()
    ms.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ms, cam)
    const hit = ray.intersectObjects(scene.children, true).find((x) => x.object.userData.eq)
    if (hit) on.onPick(hit.object.userData.eq)
  })

  // ── 크기·그리기 ──
  const ro = new ResizeObserver(() => {
    persp.aspect = W() / H()
    persp.updateProjectionMatrix()
    fitOrtho()
    renderer.setSize(W(), H())
  })
  ro.observe(host)
  let raf = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    tween?.(now)
    ;(mode === 'top' ? cO : cP).update()
    if (mode === 'top') ortho.lookAt(cO.target.x, 0, cO.target.z)
    paint(now)
    drawBeads(now)
    placeTags()
    drawEdges()
    renderer.render(scene, cam)
  }
  drawRoutes()
  shadows()
  raf = requestAnimationFrame(loop)

  return {
    setStates,
    setIssues,
    setFlow,
    setRoutes(r: Partial<Record<ProductionLineId, string | null>>) {
      const next = { ...routes }
      for (const L of LINES) next[L] = r[L] === 'PT2' ? 1 : r[L] === 'PT1' ? 0 : routes[L]
      if (LINES.some((L) => next[L] !== routes[L])) { routes = next; drawRoutes() }
    },
    select(L: ProductionLineId | null) { sel = L; applyDim() },
    setView,
    onModeChange(cb: (m: ViewMode) => void) { onMode = cb },
    flyTo,
    /** 화면 좌표 (팝업 위치용) */
    screenOf(id: string): { x: number; y: number } | null {
      const e = EQ.get(id)
      if (!e) return null
      v3.set(e.x, e.h + 3, e.z).project(cam)
      return { x: ((v3.x + 1) / 2) * W(), y: ((1 - v3.y) / 2) * H() }
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      host.removeEventListener('pointerdown', onRightDown, true)
      cP.dispose()
      cO.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()) }
      })
      renderer.dispose()
      renderer.domElement.remove()
      layer.remove()
    },
  }
}

export type FactoryScene = ReturnType<typeof createFactoryScene>
