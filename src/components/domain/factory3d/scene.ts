// 3D 공장 장면 (SCR-005). Three.js로 설비 39대·컨베이어·재공 상자·제품 상자를 그린다
// 보기 (D-118): 3D(비스듬히) ↔ 탑뷰(같은 원근 카메라가 위로 날아가 내려다본다. 평면 그림으로 바꾸지 않음)
//   탑뷰에 도착하면 바닥 상태 칸을 진하게 하고 설비마다 상태 칩(설비 번호 + 이상이면 상태 글자)을 띄운다 (11/20 예전 탑뷰 모양)
// 설비를 누르면 카메라가 그 설비로 다가가 화면 가운데에 두고, 닫으면(unfocus) 누르기 전 자리로 돌아온다
// 라인 바닥에 마우스를 올리면 그 라인 외곽선, 누르면 라인 선택 (on.onLine). 빈 곳을 누르면 on.onEmpty
// 마우스: 왼쪽 끌기 = 이동, 휠 = 확대, 오른쪽 끌기 = 회전 (탑뷰에서 오른쪽을 누르면 3D로)
// 값은 밖에서 넣는다 (setStates · setIssues · setRoutes · setFlow). 이 파일은 데이터를 부르지 않는다
// 그리기는 바뀐 것이 있을 때만 (성능 개선 1, docs/10_성능검토.md): 카메라가 움직이거나, 값·마우스가 바뀌었거나, 상자가 옮겨 가는 동안(초당 BOX_FPS번까지)
// 대시보드를 떠나 있는 동안은 pause()로 멈추고 돌아오면 resume() (성능 개선 2)
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { makeKit } from '@/components/domain/factory3d/equipment'
import { STATE_NAME } from '@/lib/status'
import type { StateCode } from '@/types/state'
import type { FlowPositions, FlowLocation } from '@/types/live'
import type { ProductionLineId } from '@/types/plant'

export type ViewMode = '3d' | 'top'

/** 토큰에서 읽은 색 (getComputedStyle). 키는 상태 코드 + 모형 색 */
export interface SceneColors {
  state: Record<StateCode, string>
  /** 라인 외곽선 · 고른 설비 테두리 (강조 파랑 = 포커스) */
  accent: string
  bg: string; floor: string; grid: string; yard: string; body: string; frame: string
  metal: string; dark: string; chrome: string; glass: string; wood: string; carton: string; belt: string; route: string; route2: string; routeAlt: string; product: string; cap: string
}

export interface SceneHandlers {
  /** 설비(또는 탑뷰 설비 카드)를 눌렀을 때 */
  onPick(equipmentId: string): void
  /** 라인 바닥을 눌렀을 때 */
  onLine(lineId: ProductionLineId): void
  /** 구역 이름을 눌렀을 때 (코일 적재장 · 도장 · 비전/출하) */
  onZone(zone: ZoneId): void
  /** 설비·라인이 아닌 빈 곳을 눌렀을 때 (끌기는 아님) */
  onEmpty(): void
}

export type ZoneId = 'inbound' | 'paint' | 'vision' | 'outbound'

export interface SceneIssue { equipmentId: string; state: StateCode }

/** 설비 상태. note = 탑뷰 설비 카드 둘째 줄 (이상 상태의 지속 시간) */
export interface SceneState { id: string; state: StateCode; note?: string | null }

const LINES: ProductionLineId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const lineZ = (i: number) => -30 + i * 12
const PAINT_Z = [-18, 18]
/** 라인 끝 → 도장으로 가는 세로 컨베이어 x, 도장 뒤 → 비전으로 가는 세로 컨베이어 x */
const XFER_X = 29
const OUT_X = 68
/** 라인 바닥 (마우스 올림·외곽선) 범위 */
const LINE_X0 = -57.5
const LINE_X1 = 31.5
const LINE_D = 10.6
/** 제품 상자 */
const BOX_W = 0.9
const BOX_H = 0.55
const ON_BELT = 0.6 + BOX_H / 2
const SLOT = 0.98
/** 재공 더미: 컨베이어 옆(+z)에 파렛트를 두고 3×3씩 쌓는다 */
const PILE_DZ = 3.2
const PILE_CAP = 63
const MAX_BOXES = 1800
const MOVE_MS = 900
/** 상자만 움직일 때 그리는 횟수 (초당). 카메라가 움직이면 매 프레임 */
const BOX_FPS = 24
/** 탑뷰에 담을 범위 (배정 칸 ~ 출하). 11/21: 배정 칸(x −94)도 탑뷰에 보이게 왼쪽을 넓힘 */
const TOP_FRAME = { x0: -104, x1: 99, z0: -47, z1: 40 }
/** 출하 적재: 상자 1개 = 제품 20개, 파렛트에 3×3씩 쌓음 */
const SHIP_PER_BOX = 20
const SHIP_MAX = 45
/** 처음 3D 자리 */
const HOME = { pos: new THREE.Vector3(-52, 96, 110), tgt: new THREE.Vector3(0, 0, 4) }

interface Pose { pos: THREE.Vector3; tgt: THREE.Vector3 }
interface Tag {
  el: HTMLElement; pos: THREE.Vector3
  /** top = 탑뷰 카드가 떠 있을 때만, 3d = 그 밖일 때만 */
  only: 'top' | '3d' | null
  /** b = 점 위 가운데, c = 점 가운데, r = 점 왼쪽 (오른쪽 끝을 점에) */
  anchor: 'b' | 'c' | 'r'
  /** 잰 크기. 글이 바뀌면 -1 (다시 잰다) */
  w: number; h: number
  /** 이상 표시처럼 서로 겹치면 위로 비켜 쌓는 이름표 */
  stack?: boolean
  /** 지난번에 쓴 transform·display (같으면 DOM을 건드리지 않는다) */
  tf?: string; disp?: string
}
interface Eq {
  id: string; line: ProductionLineId | null; kind: 'SL' | 'PR' | 'WD' | 'PT' | 'VI'; no: string
  x: number; z: number; h: number; pw: number; pd: number
  /** 처리 중인 제품 상자가 놓이는 곳 (설비 기준 상대 위치, y는 바닥에서) */
  work: [number, number, number]
  group: THREE.Group; pad: THREE.Mesh; caps: THREE.Mesh[]; card: Tag
  state: StateCode; note: string | null; dim: boolean; cardKey: string
  /** 지난번에 칠한 상태 · 고장 깜빡임 켜짐 (바뀔 때만 다시 칠한다) */
  painted: StateCode | null; hot: boolean
}
interface Pile { x: number; z: number; bz: number; lab: Tag; stack: string[]; n: number }
interface Box {
  line: ProductionLineId; loc: FlowLocation; slot: number
  /** 지난 그림에서 그린 자리 */
  draw: THREE.Vector3
  /** 움직이는 중이면 컨베이어를 따라가는 꺾은선 */
  path: THREE.Vector3[] | null; lens: number[]; t0: number
  /** 상자 묶음(InstancedMesh)에서의 번호. 안 그리면 -1 */
  i: number
}

type Mat = THREE.MeshStandardMaterial
const matOf = (m: THREE.Object3D) => (m as THREE.Mesh).material as Mat
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const SVG_NS = 'http://www.w3.org/2000/svg'
const ICON_BOX = '<svg class="f3d-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 14 4.8v6.4L8 14.2 2 11.2V4.8zM2 4.8l6 3 6-3M8 7.8v6.4"/></svg>'
const ICON_GO = '<svg class="f3d-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>'
const ICON_ARROW = '<svg class="f3d-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10M9 4.5 12.5 8 9 11.5"/></svg>'

/** 모서리가 둥근 직사각형 (가운데 기준) */
function roundRect<T extends THREE.Path>(s: T, w: number, d: number, r: number): T {
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + d - r)
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + d)
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}
/** 바닥에 눕힌 테두리 띠 (라인 외곽선 · 고른 설비 테두리) */
function ringGeo(w: number, d: number, band: number, r: number) {
  const outer = roundRect(new THREE.Shape(), w, d, r)
  outer.holes.push(roundRect(new THREE.Path(), w - band * 2, d - band * 2, Math.max(0.05, r - band)))
  const g = new THREE.ShapeGeometry(outer, 8)
  g.rotateX(-Math.PI / 2)
  return g
}

export function createFactoryScene(host: HTMLElement, C: SceneColors, on: SceneHandlers) {
  // 크기는 ResizeObserver가 알려 줄 때만 읽는다 (매 프레임 clientWidth를 읽으면 레이아웃 계산이 끼어든다)
  let cw = host.clientWidth || 1
  let ch = host.clientHeight || 1
  const W = () => cw
  const H = () => ch

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W(), H())
  renderer.shadowMap.enabled = true
  // 그림자는 모형이 바뀔 때만 다시 그린다 (매 프레임 그림자 지도를 다시 그리면 그리기 비용이 크게 는다)
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(C.bg)

  // ── 카메라: 원근 하나로 3D·탑뷰·설비 다가가기를 모두 한다 ──
  const cam = new THREE.PerspectiveCamera(40, W() / H(), 1, 1000)
  cam.position.copy(HOME.pos)
  const ctl = new OrbitControls(cam, renderer.domElement)
  ctl.enableDamping = true
  ctl.screenSpacePanning = false
  ctl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
  ctl.target.copy(HOME.tgt)
  ctl.maxPolarAngle = Math.PI / 2.15
  ctl.minDistance = 10
  ctl.maxDistance = 260

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

  box(176, 0.4, 92, M(C.floor, { roughness: 0.95 }), 8, -0.4, 0)
  const grid = new THREE.GridHelper(176, 58, C.grid, C.grid)
  grid.position.set(8, 0.01, 0)
  scene.add(grid)
  box(18, 0.05, 86, M(C.yard), -62, 0, 0)
  const capM = M(C.cap)
  const kit = makeKit({ cap: capM, frame: C.frame, metal: C.metal, body: C.body, dark: C.dark, chrome: C.chrome, glass: C.glass, robot: C.routeAlt, wood: C.wood, carton: C.carton })
  const metal = M(C.metal, { metalness: 0.2, roughness: 0.5 })
  const frame = M(C.frame)
  const belt = M(C.belt)
  const pallet = M(C.frame, { roughness: 0.85 })

  // ── 겹쳐 그리는 이름표·카드 (HTML) ──
  const layer = document.createElement('div')
  layer.className = 'f3d-layer'
  host.appendChild(layer)
  // 탑뷰(장면이 흐릴 때)의 라인 외곽선은 흐려지지 않게 SVG로 겹쳐 그린다
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'f3d-svg')
  svg.setAttribute('aria-hidden', 'true')
  const poly = (cls: string) => {
    const p = document.createElementNS(SVG_NS, 'polygon')
    p.setAttribute('class', cls)
    svg.appendChild(p)
    return p
  }
  const polySel = poly('sel')
  const polyHov = poly('hov')
  layer.appendChild(svg)
  // ── 그리기 예약: 바뀐 것이 있으면 다음 프레임에 한 번 그린다 ──
  let dirty = true
  const invalidate = () => { dirty = true }
  const tags: Tag[] = []
  const tag = (html: string, cls: string, pos: [number, number, number], only: Tag['only'] = null, anchor: Tag['anchor'] = 'b'): Tag => {
    const el = document.createElement('div')
    el.className = `f3d-tag ${cls}`
    el.innerHTML = html
    layer.appendChild(el)
    const t: Tag = { el, pos: new THREE.Vector3(...pos), only, anchor, w: -1, h: -1 }
    tags.push(t)
    return t
  }
  /** 글이 바뀔 때만 DOM을 고치고 크기를 다시 재게 한다 */
  const setHtml = (t: Tag, html: string) => {
    if (t.el.dataset.k === html) return
    t.el.dataset.k = html
    t.el.innerHTML = html
    t.w = -1
    invalidate()
  }

  // ── 설비 ──
  const EQ = new Map<string, Eq>()
  const addEq = (g: THREE.Group, m: Pick<Eq, 'id' | 'line' | 'kind' | 'no' | 'x' | 'z' | 'h' | 'work'> & { pw?: number; pd?: number }) => {
    scene.add(g)
    const caps: THREE.Mesh[] = []
    // 설비 하나 안에서는 같은 원본 재질의 복제본 하나를 같이 쓴다 (부품마다 복제하면 재질이 천 개 넘게 되어 그릴 때마다 값 올리기가 늘어난다)
    const own = new Map<Mat, Mat>()
    g.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const mat = matOf(o)
      const isCap = mat === capM
      if (!own.has(mat)) own.set(mat, mat.clone())
      ;(o as THREE.Mesh).material = own.get(mat)!
      o.userData.eq = m.id
      if (isCap) caps.push(o as THREE.Mesh)
    })
    const pw = m.pw ?? 6
    const pd = m.pd ?? 5.6
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshBasicMaterial({ color: C.state.R, transparent: true, opacity: 0.35 }))
    pad.rotation.x = -Math.PI / 2
    pad.position.set(m.x, 0.03, m.z)
    pad.userData.eq = m.id
    scene.add(pad)
    // 탑뷰 설비 칩: 상태 색 면 + 설비 번호 (이상이면 상태 글자). 바닥 칸 위에 둔다 (11/20 예전 탑뷰 모양)
    const card = tag(`<button type="button" class="f3d-chip" data-eq="${m.id}"></button>`, '', [m.x, 1, m.z], 'top')
    const btn = card.el.firstElementChild as HTMLButtonElement
    btn.addEventListener('click', () => on.onPick(m.id))
    btn.addEventListener('pointerenter', () => { hoverEq = m.id; invalidate() })
    btn.addEventListener('pointerleave', () => { if (hoverEq === m.id) { hoverEq = null; invalidate() } })
    EQ.set(m.id, { ...m, pw, pd, group: g, pad, caps, card, state: 'R', note: null, dim: false, cardKey: '', painted: null, hot: false })
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

  // 재공 더미: 공정 사이 컨베이어 옆 파렛트 (공정 사이만)
  const PILES = new Map<string, Pile>()
  const pileAt = (key: string, x: number, bz: number) => {
    const z = bz + PILE_DZ
    box(SLOT * 3 + 0.3, 0.2, SLOT * 3 + 0.3, pallet, x, 0, z)
    PILES.set(key, { x, z, bz, lab: tag('', 'f3d-cnt', [x, 5.2, z], '3d'), stack: [], n: 0 })
  }

  /** 묶음(라인·도장) 안 설비가 아닌 부품: 원본 재질마다 복제본 하나 (흐리게·채도 낮추기를 묶음별로 따로 하려고) */
  const ownMats = (objs: THREE.Object3D[]) => {
    const own = new Map<Mat, Mat>()
    objs.forEach((o) => o.traverse((m) => {
      if (!(m as THREE.Mesh).isMesh || m.userData.eq) return
      const mat = matOf(m)
      if (!own.has(mat)) own.set(mat, mat.clone())
      ;(m as THREE.Mesh).material = own.get(mat)!
    }))
  }
  const lineObjs: Record<string, THREE.Object3D[]> = {}
  LINES.forEach((L, i) => {
    const z = lineZ(i)
    const n0 = scene.children.length
    box(76, 0.6, 2.2, belt, -15, 0, z)
    const slit = new THREE.Group()
    slit.position.set(-42, 0, z)
    slit.scale.setScalar(0.85)
    kit.slitter(slit)
    addEq(slit, { id: `${L}-SL`, line: L, kind: 'SL', no: 'SL', x: -42, z, h: 3.4, pw: 14, pd: 5, work: [6.2, ON_BELT, 0] })
    for (let p = 0; p < 4; p++) {
      const x = -25 + p * 8.5
      const pg = new THREE.Group()
      pg.position.set(x, 0, z)
      pg.scale.setScalar(0.85)
      const v = (['A', 'B', 'C', 'A'] as const)[p]
      kit.press(pg, v)
      // 상자는 프레스 금형 받침 위
      const bed = v === 'C' ? 1.9 : v === 'B' ? 1.65 : 1.5
      addEq(pg, { id: `${L}-PR${p + 1}`, line: L, kind: 'PR', no: `PR${p + 1}`, x, z, h: v === 'C' ? 8.6 : v === 'B' ? 9 : 7.5, work: [0.25, bed * 0.85 + BOX_H / 2, 0] })
    }
    const wg = new THREE.Group()
    wg.position.set(18, 0, z)
    wg.scale.setScalar(0.62)
    kit.welder(wg)
    addEq(wg, { id: `${L}-WD`, line: L, kind: 'WD', no: 'WD', x: 18, z, h: 5, pw: 7, pd: 5, work: [1.6, 0.82 + BOX_H / 2, 0] })
    box(6, 0.6, 2.2, belt, 25, 0, z)
    pileAt(`${L}:SL-PR`, -33, z)
    pileAt(`${L}:PR-WD`, 8.5, z)
    pileAt(`${L}:WD-PT`, 24.5, z)
    lineObjs[L] = scene.children.slice(n0)
    ownMats(lineObjs[L])
  })
  const transfer = box(2.2, 0.6, 36, belt.clone(), XFER_X, 0, 0)
  const paintObjs: THREE.Object3D[][] = [[], []]
  ;[[0, 1, 2], [3, 4, 5]].forEach((grp, pi) => {
    grp.forEach((i) => lineObjs[LINES[i]].push(box(2.8, 1.2, 2.8, frame.clone(), XFER_X, 0, lineZ(i))))
    const n0 = scene.children.length
    const z = PAINT_Z[pi]
    const g = new THREE.Group()
    g.position.set(48, 0, z)
    g.scale.setScalar(1.7)
    kit.paint(g)
    box(8, 0.6, 2.2, belt.clone(), 33, 0, z)
    addEq(g, { id: `PT${pi + 1}`, line: null, kind: 'PT', no: `PT${pi + 1}`, x: 48, z, h: 9, pw: 23, pd: 11, work: [-9.6, 0.85 + BOX_H / 2, 0] })
    box(10, 0.6, 2.2, belt.clone(), 64, 0, z)
    box(2.2, 0.6, Math.abs(z), belt.clone(), OUT_X, 0, z / 2)
    pileAt(`PT${pi + 1}:PT-VI`, 62, z)
    paintObjs[pi] = scene.children.slice(n0)
    ownMats(paintObjs[pi])
  })
  const vg = new THREE.Group()
  vg.position.set(74, 0, 0)
  vg.scale.setScalar(1.15)
  kit.vision(vg)
  box(10, 0.6, 2.2, belt, 72, 0, 0)
  addEq(vg, { id: 'VI', line: null, kind: 'VI', no: 'VI', x: 74, z: 0, h: 5, pw: 7, pd: 9, work: [0, ON_BELT, 0] })
  box(10, 0.6, 2.2, belt, 82, 0, 0)
  ;[-12, 12].forEach((z, i) => {
    const sg = new THREE.Group()
    sg.position.set(88, 0, z)
    sg.scale.setScalar(0.8)
    kit.shipping(sg, i === 0)
    scene.add(sg)
  })
  // 11/21 출하 적재: 오늘 출고(양품)만큼 상자가 쌓여요 (상자 1개 = 20개). 검사 뒤 컨베이어 끝 오른쪽 파렛트
  const SHIP_X = 93
  box(SLOT * 3 + 0.3, 0.2, SLOT * 3 + 0.3, pallet, SHIP_X, 0, 0)
  const shipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SLOT * 0.9, SLOT * 0.8, SLOT * 0.9), M(C.carton, { roughness: 0.9, metalness: 0 }), SHIP_MAX)
  shipMesh.count = 0
  shipMesh.castShadow = true
  // 처음 그릴 때 상자가 0개면 화면 범위(bounding sphere)가 빈 채로 굳어 나중 상자가 안 그려져요 → 범위 판정에서 빼요 (11/21)
  shipMesh.frustumCulled = false
  scene.add(shipMesh)
  const shipLab = tag('', 'f3d-cnt', [SHIP_X, 6.5, 0])
  // 11/21 비전 검사 칸: 오늘 검사 양품·불량 (비전 위)
  const viLab = tag('', 'f3d-vi', [74, 12, 0])
  let viKey = ''
  let shipped = -1

  // ── 라인 바닥: 마우스 올림 판(보이지 않음) + 외곽선 + 옅은 면 ──
  const pickables: THREE.Object3D[] = []
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.eq) pickables.push(o) })
  const LX = (LINE_X0 + LINE_X1) / 2
  const LW = LINE_X1 - LINE_X0
  const fillM = new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.07, depthWrite: false })
  const lineArea = LINES.map((L, i) => {
    const z = lineZ(i)
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(LW, LINE_D), new THREE.MeshBasicMaterial())
    hit.rotation.x = -Math.PI / 2
    hit.position.set(LX, 0.02, z)
    hit.visible = false
    hit.userData.line = L
    pickables.push(hit)
    const out = new THREE.Mesh(ringGeo(LW, LINE_D, 0.6, 1.6), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, depthWrite: false }))
    out.position.set(LX, 0.06, z)
    out.visible = false
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(LW, LINE_D), fillM)
    fill.rotation.x = -Math.PI / 2
    fill.position.set(LX, 0.045, z)
    fill.visible = false
    scene.add(hit, out, fill)
    return { L, z, out, fill }
  })

  // 라인 이름: 라인 바닥 왼쪽 끝. 누르는 단추가 아니다 (라인은 바닥을 눌러 고른다, D-118)
  const lineTags = LINES.map((L, i) => tag(`${L}라인`, 'f3d-line', [-50.5, 0.6, lineZ(i)], null, 'r'))
  // 구역 이름 (공정 머리글). 코일 입고·비전·적재는 눌러서 상세 화면으로
  const ZONES: [string, number, number, number, ZoneId | null][] = [
    ['코일 입고', -64, 7, -42, 'inbound'], ['슬리팅', -42, 6, -37, null], ['프레스 ×4', -12, 11, -37, null], ['용접', 18, 8, -37, null],
    ['도장 1', 48, 9, -24, null], ['도장 2', 48, 9, 12, null], ['비전 검사', 74, 8, -6, 'vision'], ['적재', 86, 6, -16, 'outbound'],
  ]
  for (const [n, x, y, z, go] of ZONES) {
    if (go) {
      const t = tag(`<button type="button" class="f3d-zone go">${n}${ICON_GO}</button>`, '', [x, y, z])
      t.el.firstElementChild!.addEventListener('click', () => on.onZone(go))
    } else tag(`<span class="f3d-zone">${n}</span>`, '', [x, y, z])
  }
  const coilLab = tag('', 'f3d-cnt', [-64, 9, -30], '3d')

  // ── 배정 칸 (11/20): 물량이 시작되는 코일 입고 왼쪽 바닥에, 라인 줄마다 현재 생산 / 배정(오늘 목표) ──
  // 승인·적용된 추가 주문 배정이 있으면 "+N 추가 배정"을 붙이고 강조색 테두리
  tag('배정<small>생산 / 배정</small>', 'f3d-zone f3d-alloc-head', [-94, 7, -42])   // 11/20: 코일 입고·설비를 가리지 않게 왼쪽으로 (-78 → -94)
  const allocTags = LINES.map((_L, i) => tag('', 'f3d-alloc', [-94, 1, lineZ(i)]))
  const num = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('ko-KR'))

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
      s(0.5, Math.abs(pz - z) || 0.5, XFER_X + off, (z + pz) / 2, mat, { line: L })
    })
    ;[0, 1].forEach((p) => s(8, 0.5, 33, PAINT_Z[p], rMat[p], { paint: p }))
    applyDim()
  }

  // ── 라인 선택: 고른 라인의 흐름(라인 → 지금 쓰는 도장 → 비전)만 밝게 ──
  let sel: ProductionLineId | null = null
  let hoverLine: ProductionLineId | null = null
  let hoverEq: string | null = null
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
  const fade = (t: Tag, dim: boolean, v = 0.3) => { t.el.style.opacity = dim ? String(v) : '' }
  function applyDim() {
    const pSel = sel ? routes[sel] : -1
    for (const e of EQ.values()) {
      e.dim = !!sel && (e.line ? e.line !== sel : e.kind === 'PT' && Number(e.id[2]) - 1 !== pSel)
      fade(e.card, e.dim, 0.45)
    }
    ;[0, 1].forEach((p) => { const dim = !!sel && p !== pSel; paintObjs[p].forEach((o) => dimObj(o, dim)); fade(PILES.get(`PT${p + 1}:PT-VI`)!.lab, dim, 0.25) })
    dimObj(transfer, !!sel)
    rMesh.forEach((m) => { const r = m.userData.r; dimObj(m, !!sel && (r.line ? r.line !== sel : r.paint !== pSel)) })
    LINES.forEach((L, i) => {
      const dim = !!sel && L !== sel
      lineObjs[L].forEach((o) => dimObj(o, dim))
      ;['SL-PR', 'PR-WD', 'WD-PT'].forEach((k) => fade(PILES.get(`${L}:${k}`)!.lab, dim, 0.25))
      fade(lineTags[i], dim, 0.5)
    })
    boxesDirty = true
    renderer.shadowMap.needsUpdate = true
    refreshOutlines()
  }
  /** 외곽선: 고른 라인 = 진하게, 마우스가 올라간 라인 = 옅게 + 옅은 면. 탑뷰 카드가 떠 있으면 SVG가 대신 그린다 */
  function refreshOutlines() {
    for (const a of lineArea) {
      const isSel = a.L === sel
      const isHov = a.L === hoverLine
      a.out.visible = !topUi && (isSel || isHov)
      ;(a.out.material as THREE.MeshBasicMaterial).opacity = isSel ? 1 : 0.55
      a.fill.visible = !topUi && isHov && !isSel
    }
    lineTags.forEach((t, i) => {
      t.el.classList.toggle('on', LINES[i] === sel)
      t.el.classList.toggle('hov', LINES[i] === hoverLine && LINES[i] !== sel)
    })
    invalidate()
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
    invalidate()
  }

  // ── 이상 표시 (상태 글자 + 이름 알약)와 화면 밖 고장 단추 ──
  const bangs = new Map<string, { t: Tag; state: StateCode }>()
  const setIssues = (list: SceneIssue[]) => {
    const keep = new Set(list.map((x) => x.equipmentId))
    for (const [id, b] of bangs) if (!keep.has(id)) { b.t.el.remove(); tags.splice(tags.indexOf(b.t), 1); bangs.delete(id); invalidate() }
    for (const it of list) {
      const e = EQ.get(it.equipmentId)
      if (!e) continue
      let b = bangs.get(e.id)
      if (!b) {
        const t = tag('<button type="button" class="f3d-bang"></button>', '', [e.x, e.h + 3.4, e.z], '3d')
        t.stack = true
        t.el.firstElementChild!.addEventListener('click', () => on.onPick(e.id))
        b = { t, state: it.state }
        bangs.set(e.id, b)
      }
      b.state = it.state
      const btn = b.t.el.firstElementChild as HTMLElement
      const html = `<span class="f3d-key st-${it.state}">${it.state}</span>${STATE_NAME[it.state]}`
      if (btn.dataset.k !== html) {
        btn.dataset.k = html
        btn.dataset.state = it.state
        btn.innerHTML = html
        btn.setAttribute('aria-label', `${e.id} ${STATE_NAME[it.state]} 보기`)
        b.t.w = -1
        invalidate()
      }
    }
  }
  const edges = new Map<string, HTMLButtonElement>()
  const v3 = new THREE.Vector3()
  const drawEdges = () => {
    const live = new Set<string>()
    for (const [id, b] of bangs) {
      if (b.state !== 'D' || focusId) continue
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
        el.innerHTML = `${ICON_ARROW}<span>${id} 고장</span>`
        el.addEventListener('click', () => on.onPick(id))
        layer.appendChild(el)
        edges.set(id, el)
      }
      let x = v3.x
      let y = v3.y
      if (v3.z > 1) { x = -x; y = -y }
      const k = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1)
      x /= k
      y /= k
      const ang = Math.round((Math.atan2(-y, x) * 180) / Math.PI / 45) * 45
      ;(el.firstElementChild as SVGElement).style.transform = `rotate(${ang}deg)`
      el.style.left = `${Math.round(Math.min(W() - 140, Math.max(8, ((x + 1) / 2) * W() - 56)))}px`
      el.style.top = `${Math.round(Math.min(H() - 44, Math.max(8, ((1 - y) / 2) * H() - 14)))}px`
    }
    for (const [id, el] of edges) if (!live.has(id)) { el.remove(); edges.delete(id) }
  }

  // ── 제품 상자: 컨베이어를 따라 움직이고, 공정 사이에서는 파렛트에 쌓인다 ──
  const boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_W), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 }), MAX_BOXES)
  boxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  boxMesh.count = 0
  scene.add(boxMesh)
  const boxes = new Map<string, Box>()
  let coilWip = 0
  const prodC = new THREE.Color(C.product)
  const bgC = new THREE.Color(C.bg)
  const tmpC = new THREE.Color()
  const tmpM = new THREE.Matrix4()
  const tmpV = new THREE.Vector3()
  const slotPos = (P: Pile, k: number, out: THREE.Vector3) => {
    const r = k % 9
    return out.set(P.x + ((r % 3) - 1) * SLOT, 0.2 + Math.floor(k / 9) * (BOX_H + 0.04) + BOX_H / 2, P.z + (Math.floor(r / 3) - 1) * SLOT)
  }
  /** 상자가 있어야 할 자리. 더미가 넘치면(PILE_CAP) 그리지 않는다 */
  const target = (b: Box, out: THREE.Vector3): THREE.Vector3 | null => {
    const l = b.loc
    if ('eq' in l) {
      const e = EQ.get(l.eq)
      return e ? out.set(e.x + e.work[0], e.work[1], e.z + e.work[2]) : null
    }
    const P = PILES.get(l.pile)
    if (!P || b.slot < 0 || b.slot >= PILE_CAP) return null
    return slotPos(P, b.slot, out)
  }
  /** 컨베이어 위 기준점: 더미는 옆 컨베이어 위, 설비는 그 자리 */
  const anchorOf = (l: FlowLocation, at: THREE.Vector3) => {
    if ('pile' in l) {
      const P = PILES.get(l.pile)
      if (P) return new THREE.Vector3(P.x, ON_BELT, P.bz)
    }
    return at.clone()
  }
  /** a → b 꺾은선: 컨베이어로 내려와 라인을 따라가고, 라인이 바뀌면 세로 컨베이어(x 29 · 68)로 돈다 */
  const route = (fl: FlowLocation, a: THREE.Vector3, tl: FlowLocation, b: THREE.Vector3) => {
    const a1 = anchorOf(fl, a)
    const b1 = anchorOf(tl, b)
    const pts = [a.clone(), a1]
    if (Math.abs(a1.z - b1.z) > 0.5) {
      const jx = a1.x < XFER_X && b1.x > XFER_X ? XFER_X : a1.x < OUT_X && b1.x >= OUT_X - 0.5 ? OUT_X : (a1.x + b1.x) / 2
      pts.push(new THREE.Vector3(jx, ON_BELT, a1.z), new THREE.Vector3(jx, ON_BELT, b1.z))
    }
    pts.push(b1, b.clone())
    const path = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.01)
    const lens = [0]
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + path[i].distanceTo(path[i - 1]))
    return { path, lens }
  }
  const along = (b: Box, k: number, out: THREE.Vector3) => {
    const p = b.path!
    const d = k * b.lens[b.lens.length - 1]
    let i = 1
    while (i < p.length - 1 && b.lens[i] < d) i++
    const seg = b.lens[i] - b.lens[i - 1] || 1
    return out.lerpVectors(p[i - 1], p[i], Math.min(1, Math.max(0, (d - b.lens[i - 1]) / seg)))
  }
  const sameLoc = (a: FlowLocation, b: FlowLocation) => ('eq' in a && 'eq' in b && a.eq === b.eq) || ('pile' in a && 'pile' in b && a.pile === b.pile)
  const pushSlot = (b: Box, id: string) => {
    if (!('pile' in b.loc)) return
    const P = PILES.get(b.loc.pile)
    if (!P) return
    b.slot = P.stack.length
    P.stack.push(id)
  }
  let boxesDirty = true
  /** 움직이는 상자가 있는지 (지난 그림 기준) */
  let boxesMoving = false
  let lastFlow: FlowPositions | null = null
  const setFlow = (f: FlowPositions | null) => {
    // 같은 값이 다시 오면 (다른 값이 바뀌어 push가 불릴 때) 아무것도 안 한다
    if (f === lastFlow) return
    lastFlow = f
    boxesDirty = true
    const now = performance.now()
    const next = new Map((f?.products ?? []).map((p) => [p.productId, p]))
    // 1) 더미를 떠난 상자: 맨 위 상자가 떠나는 것처럼 보이게 맨 위 상자와 자리를 바꾼 뒤 뺀다 (남은 상자는 움직이지 않음)
    for (const [key, P] of PILES) {
      for (let h = P.stack.length - 1; h >= 0; h--) {
        const id = P.stack[h]
        const nx = next.get(id)
        if (nx && 'pile' in nx.location && nx.location.pile === key) continue
        const top = P.stack.length - 1
        if (h !== top) {
          const topId = P.stack[top]
          P.stack[h] = topId
          const tb = boxes.get(topId)
          if (tb) { tb.slot = h; tb.path = null; slotPos(P, h, tb.draw) }
          const db = boxes.get(id)
          if (db) slotPos(P, top, db.draw)
        }
        P.stack.pop()
      }
    }
    // 2) 새 상자는 그 자리에 나타나고, 자리가 바뀐 상자는 컨베이어를 따라 옮겨 간다
    for (const [id, p] of next) {
      const b = boxes.get(id)
      if (!b) {
        const nb: Box = { line: p.lineId, loc: p.location, slot: -1, draw: new THREE.Vector3(), path: null, lens: [], t0: now, i: -1 }
        pushSlot(nb, id)
        target(nb, nb.draw)
        boxes.set(id, nb)
        continue
      }
      if (sameLoc(b.loc, p.location)) continue
      const from = b.draw.clone()
      const fl = b.loc
      b.loc = p.location
      b.slot = -1
      pushSlot(b, id)
      const to = target(b, new THREE.Vector3())
      if (!to) { b.path = null; continue }
      const r = route(fl, from, b.loc, to)
      b.path = r.path
      b.lens = r.lens
      b.t0 = now
    }
    for (const id of boxes.keys()) if (!next.has(id)) boxes.delete(id)
    for (const P of PILES.values()) P.n = 0
    for (const p of next.values()) if ('pile' in p.location) { const P = PILES.get(p.location.pile); if (P) P.n += 1 }
    coilWip = f?.coilWip ?? 0
    invalidate()
  }
  const pidPool = Array.from({ length: 36 }, () => { const t = tag('', 'f3d-pid', [0, 0, 0], '3d'); t.el.hidden = true; return t })
  const ease = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2
  /** 상자 그리기: 자리가 바뀐 때(setFlow·선택)만 전체를 다시 쓰고, 그 밖엔 움직이는 상자만 고친다. 움직이는 상자가 남았으면 true */
  const drawBoxes = (now: number): boolean => {
    const snap = reduced()
    let moving = false
    const posOf = (b: Box) => {
      if (!b.path) return target(b, tmpV)
      moving = true
      const k = snap ? 1 : Math.min(1, (now - b.t0) / MOVE_MS)
      const p = along(b, ease(k), tmpV)
      if (k >= 1) b.path = null
      return p
    }
    if (!boxesDirty) {
      for (const b of boxes.values()) {
        if (!b.path) continue
        if (b.i < 0) { boxesDirty = true; break }
        const p = posOf(b)!
        b.draw.copy(p)
        tmpM.makeTranslation(p.x, p.y, p.z)
        boxMesh.setMatrixAt(b.i, tmpM)
      }
      if (!boxesDirty) {
        if (moving) boxMesh.instanceMatrix.needsUpdate = true
        return moving
      }
      moving = false
    }
    let n = 0
    for (const b of boxes.values()) {
      b.i = -1
      if (n >= MAX_BOXES) continue
      const p = posOf(b)
      if (!p) continue
      b.draw.copy(p)
      b.i = n
      tmpM.makeTranslation(p.x, p.y, p.z)
      boxMesh.setMatrixAt(n, tmpM)
      tmpC.copy(prodC)
      if (sel && b.line !== sel) tmpC.lerp(bgC, 0.8)
      boxMesh.setColorAt(n, tmpC)
      n++
    }
    boxMesh.count = n
    boxMesh.instanceMatrix.needsUpdate = true
    if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true
    boxesDirty = false
    return moving
  }
  /** 제품 ID: 가까이 확대하면 화면 가운데 근처만. 쌓인 재공 상자는 수 이름표가 따로 있어 빼고 (겹쳐 읽히지 않는다) */
  let pidOn = false
  const drawPids = () => {
    let used = 0
    if (!topUi && cam.position.distanceTo(ctl.target) < 70) {
      const cand: [number, string, THREE.Vector3][] = []
      for (const [id, b] of boxes) {
        if ('pile' in b.loc && !b.path) continue
        v3.copy(b.draw).project(cam)
        if (Math.abs(v3.x) < 0.6 && Math.abs(v3.y) < 0.6 && v3.z < 1) cand.push([v3.x * v3.x + v3.y * v3.y, id, b.draw])
      }
      cand.sort((a, b) => a[0] - b[0]).slice(0, pidPool.length).forEach(([, id, at]) => {
        const t = pidPool[used++]
        if (t.el.dataset.k !== id) { t.el.dataset.k = id; t.el.textContent = `${id[0]}-${id.slice(-4)}`; t.el.title = id; t.w = -1 }
        t.pos.copy(at).y += BOX_H / 2 + 0.2
        t.el.hidden = false
        placeTag(t, W(), H(), null)
      })
    }
    if (!used && !pidOn) return
    for (let i = used; i < pidPool.length; i++) pidPool[i].el.hidden = true
    pidOn = used > 0
  }

  // ── 상태 색 ──
  let downCount = 0
  const setStates = (list: SceneState[]) => {
    let changed = false
    for (const s of list) {
      const e = EQ.get(s.id)
      if (!e) continue
      e.note = s.note ?? null
      if (e.state !== s.state) { e.state = s.state; changed = true }
    }
    if (!changed) return
    downCount = [...EQ.values()].filter((e) => e.state === 'D').length
    invalidate()
    for (const L of LINES) {
      const es = [...EQ.values()].filter((e) => e.line === L)
      tintLine(L, es.every((e) => e.state === 'S'))
    }
  }
  /** 상태 색·바닥 칸·탑뷰 칩·재공 수. 바뀐 설비만 칠한다 (blink = 고장 깜빡임 켜짐) */
  const paint = (blink: boolean) => {
    for (const e of EQ.values()) {
      const c = C.state[e.state]
      const pm = e.pad.material as THREE.MeshBasicMaterial
      if (e.painted !== e.state) {
        e.painted = e.state
        e.caps.forEach((m) => matOf(m).color.set(c))
        pm.color.set(c)
      }
      pm.opacity = e.dim ? 0.08 : topUi ? 0.75 : e.id === hoverEq || e.id === focusId ? 0.6 : 0.35
      const hot = e.state === 'D' && blink
      if (hot !== e.hot) {
        e.hot = hot
        e.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) matOf(o).emissive.setHex(hot ? 0x8a1c1c : 0) })
      }
      if (topUi && e.cardKey !== e.state) {
        // 가동(R)은 색으로 충분해 설비번호만. 이상 상태는 색만으로 구분하지 않게 상태 글자를 붙인다 (CLAUDE.md 색약 대비)
        e.cardKey = e.state
        const btn = e.card.el.firstElementChild as HTMLElement
        btn.className = `f3d-chip st-${e.state}`
        btn.textContent = e.state === 'R' ? e.no : `${e.no} ${e.state}`
        btn.setAttribute('aria-label', `${e.id} ${STATE_NAME[e.state]}`)
        e.card.w = -1
      }
    }
    for (const P of PILES.values()) {
      setHtml(P.lab, `${ICON_BOX}${P.n > PILE_CAP ? `${PILE_CAP}+` : P.n}`)
      const vis = P.n ? '' : 'hidden'
      if (P.lab.el.style.visibility !== vis) P.lab.el.style.visibility = vis
    }
    setHtml(coilLab, `코일 재고 ${(coilWip / 20).toFixed(1)}롤`) // coilWip은 제품 수 (1롤 = 20개), 슬리팅 전이라 롤로 보여 줌
  }

  // ── 이름표 자리 잡기: 정수 픽셀에 둔다 (소수 픽셀이면 글자가 번진다) ──
  const pv = new THREE.Vector3()
  const toPx = (p: THREE.Vector3, w: number, h: number): [number, number] | null => {
    pv.copy(p).project(cam)
    if (pv.z > 1) return null
    return [((pv.x + 1) / 2) * w, ((1 - pv.y) / 2) * h]
  }
  const corners = (z: number) => [[LINE_X0, z - LINE_D / 2], [LINE_X1, z - LINE_D / 2], [LINE_X1, z + LINE_D / 2], [LINE_X0, z + LINE_D / 2]]
  const drawPoly = (p: SVGPolygonElement, L: ProductionLineId | null, w: number, h: number) => {
    const a = L && topUi ? lineArea.find((x) => x.L === L) : null
    if (!a) { p.setAttribute('points', ''); return }
    p.setAttribute('points', corners(a.z).map(([x, z]) => toPx(tmpV.set(x, 0, z), w, h)?.map((n) => n.toFixed(1)).join(',') ?? '').join(' '))
  }
  const setTf = (t: Tag, tf: string) => { if (t.tf !== tf) { t.tf = tf; t.el.style.transform = tf } }
  const OFF = 'translate(-9999px,0)'
  /** 이름표 하나를 화면 좌표에 놓는다. placed = 서로 비켜 쌓을 이름표들의 자리 */
  const placeTag = (t: Tag, w: number, h: number, placed: [number, number, number, number][] | null) => {
    const shown = !t.only || (t.only === 'top') === topUi
    const disp = shown ? '' : 'none'
    if (t.disp !== disp) { t.disp = disp; t.el.style.display = disp }
    if (!shown) return
    const at = toPx(t.pos, w, h)
    if (!at) { setTf(t, OFF); return }
    if (t.w < 0 || !t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight }
    const x = t.anchor === 'r' ? at[0] - t.w : at[0] - t.w / 2
    let y = t.anchor === 'b' ? at[1] - t.h : at[1] - t.h / 2
    // 반 넘게 화면 밖이면 숨긴다 (가장자리에 이름표 조각만 걸리지 않게)
    if (y + t.h / 2 < 0 || y + t.h / 2 > h || x + t.w / 2 < 0 || x + t.w / 2 > w) { setTf(t, OFF); return }
    if (t.stack && placed) {
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((r) => x < r[0] + r[2] && x + t.w > r[0] && y < r[1] + r[3] && y + t.h > r[1])
        if (!hit) break
        y = hit[1] - t.h - 4
      }
      placed.push([x, y, t.w, t.h])
    }
    setTf(t, `translate(${Math.round(x)}px,${Math.round(y)}px)`)
  }
  const placeTags = () => {
    const w = W()
    const h = H()
    drawPoly(polySel, sel, w, h)
    drawPoly(polyHov, hoverLine !== sel ? hoverLine : null, w, h)
    // 이상 표시끼리 겹치면 위로 비켜 쌓는다 (이웃 설비가 함께 고장·대기일 때)
    const placed: [number, number, number, number][] = []
    for (const t of tags) if (!t.el.hidden) placeTag(t, w, h, placed)
  }

  // ── 카메라 이동: 지금 자리에서 목표 자리까지 과녁 둘레를 돌며(구면 보간) 부드럽게 ──
  let tween: ((now: number) => void) | null = null
  let dest: Pose | null = null
  const sph0 = new THREE.Spherical()
  const sph1 = new THREE.Spherical()
  const sph = new THREE.Spherical()
  const pose = (): Pose => dest ? { pos: dest.pos.clone(), tgt: dest.tgt.clone() } : { pos: cam.position.clone(), tgt: ctl.target.clone() }
  const fly = (to: Pose, ms: number, done?: () => void) => {
    const t0 = ctl.target.clone()
    sph0.setFromVector3(tmpV.copy(cam.position).sub(t0))
    sph1.setFromVector3(tmpV.copy(to.pos).sub(to.tgt))
    let dth = sph1.theta - sph0.theta
    if (dth > Math.PI) dth -= Math.PI * 2
    if (dth < -Math.PI) dth += Math.PI * 2
    const a = { r: sph0.radius, p: sph0.phi, t: sph0.theta }
    const b = { r: sph1.radius, p: sph1.phi }
    const s = performance.now()
    const dur = reduced() ? 0 : ms
    dest = { pos: to.pos.clone(), tgt: to.tgt.clone() }
    tween = (now) => {
      const k = dur ? Math.min(1, (now - s) / dur) : 1
      // 시작과 도착을 모두 부드럽게 (도착할 때 천천히)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      ctl.target.lerpVectors(t0, to.tgt, e)
      sph.set(a.r + (b.r - a.r) * e, a.p + (b.p - a.p) * e, a.t + dth * e)
      cam.position.setFromSpherical(sph).add(ctl.target)
      if (k >= 1) {
        cam.position.copy(to.pos)
        ctl.target.copy(to.tgt)
        tween = null
        dest = null
        done?.()
      }
    }
  }
  // 사용자가 끌거나 굴리면 날던 카메라는 그 자리에서 멈춘다
  ctl.addEventListener('start', () => { tween = null; dest = null })

  const topPose = (): Pose => {
    const f = TOP_FRAME
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const h = Math.max((f.x1 - f.x0) / (2 * t * cam.aspect), (f.z1 - f.z0) / (2 * t)) + 8
    const cx = (f.x0 + f.x1) / 2
    const cz = (f.z0 + f.z1) / 2
    // 바로 위에서 조금 앞(+z): 화면 위쪽 = 공장 안쪽(A라인)으로 3D와 같은 방향
    return { pos: new THREE.Vector3(cx, h, cz + 0.01), tgt: new THREE.Vector3(cx, 0, cz) }
  }
  /** 설비 다가가기: 그 설비를 과녁(화면 가운데)으로, 3D 첫 화면과 같은 방향에서 비스듬히 */
  const focusPose = (e: Eq): Pose => {
    const tgt = new THREE.Vector3(e.x, e.h * 0.45, e.z)
    const r = THREE.MathUtils.clamp(e.h * 2.4 + e.pw * 1.4 + 6, 26, 64)
    const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(r, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(-22))).add(tgt)
    return { pos, tgt }
  }

  let mode: ViewMode = '3d'
  let focusId: string | null = null
  /** 설비 다가가기 전 자리 (닫으면 여기로) */
  let saved: Pose | null = null
  /** 탑뷰로 가기 전 3D 자리 (3D로 돌아올 때 여기로) */
  let back3d: Pose | null = null
  /** 라인 상세로 다이빙하기 전 자리 (대시보드로 돌아오면 이 자리) */
  let beforeDive: Pose | null = null
  let onMode: ((m: ViewMode) => void) | null = null
  /** 탑뷰에 도착해 카드가 떠 있는 상태 (설비에 다가가 있거나 날고 있으면 아님) */
  let topUi = false
  const syncTopUi = () => {
    ctl.enableRotate = !(mode === 'top' && !focusId)
    const v = mode === 'top' && !focusId && !tween
    if (v === topUi) return
    topUi = v
    host.classList.toggle('topui', v)
    layer.classList.toggle('topui', v)
    refreshOutlines()
  }

  // 고른 설비 테두리 (바닥)
  const ringM = new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, depthWrite: false })
  let ring: THREE.Mesh | null = null
  const setRing = (e: Eq | null) => {
    invalidate()
    if (ring) { scene.remove(ring); ring.geometry.dispose(); ring = null }
    if (!e) return
    ring = new THREE.Mesh(ringGeo(e.pw + 1.4, e.pd + 1.4, 0.32, 0.9), ringM)
    ring.position.set(e.x, 0.07, e.z)
    scene.add(ring)
  }

  const setView = (m: ViewMode) => {
    const base = saved ?? pose()
    focusId = null
    saved = null
    setRing(null)
    if (m === 'top') {
      if (mode === '3d') back3d = base
      mode = 'top'
      onMode?.('top')
      fly(topPose(), 950)
    } else {
      const wasTop = mode === 'top'
      mode = '3d'
      onMode?.('3d')
      fly(wasTop && back3d ? back3d : { pos: HOME.pos.clone(), tgt: HOME.tgt.clone() }, wasTop ? 950 : 700)
    }
  }
  const focus = (id: string) => {
    const e = EQ.get(id)
    if (!e) return
    if (!saved) saved = pose()
    focusId = id
    setRing(e)
    fly(focusPose(e), 800)
  }
  /** 라인 상세로 가기 전: 그 라인을 내려다보며 다가간다 (다음 화면 '라인 흐름'으로 이어지게, D-119) */
  const dive = (L: ProductionLineId, done: () => void) => {
    const i = LINES.indexOf(L)
    if (i < 0) { done(); return }
    beforeDive = saved ?? pose()
    focusId = null
    saved = null
    setRing(null)
    sel = L
    applyDim()
    const tgt = new THREE.Vector3(-12, 0, lineZ(i))
    const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(58, THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(-8))).add(tgt)
    fly({ pos, tgt }, 600, done)
  }
  const unfocus = () => {
    if (!focusId) return
    focusId = null
    setRing(null)
    const s = saved
    saved = null
    if (s) fly(s, 650)
  }

  // ── 마우스 ──
  const onRightDown = (ev: PointerEvent) => { if (mode === 'top' && !focusId && ev.button === 2) setView('3d') }
  host.addEventListener('pointerdown', onRightDown, true)
  const noMenu = (e: Event) => e.preventDefault()
  renderer.domElement.addEventListener('contextmenu', noMenu)
  const ray = new THREE.Raycaster()
  const ms = new THREE.Vector2()
  const pickAt = (cx: number, cy: number): { eq?: string; line?: ProductionLineId } | null => {
    const r = renderer.domElement.getBoundingClientRect()
    ms.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ms, cam)
    const hit = ray.intersectObjects(pickables, false)[0]
    if (!hit) return null
    return hit.object.userData.eq ? { eq: hit.object.userData.eq } : { line: hit.object.userData.line }
  }
  let down: [number, number, number] | null = null
  let mx = 0
  let my = 0
  let inside = false
  let hoverDirty = false
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, e.button] })
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || down[2] !== 0 || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return
    const hit = pickAt(e.clientX, e.clientY)
    if (hit?.eq) on.onPick(hit.eq)
    else if (hit?.line) on.onLine(hit.line)
    else on.onEmpty()
  })
  renderer.domElement.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; inside = !e.buttons; hoverDirty = true })
  renderer.domElement.addEventListener('pointerleave', () => { inside = false; hoverDirty = true })
  const doHover = () => {
    const h = inside ? pickAt(mx, my) : null
    if ((h?.eq ?? null) !== hoverEq) { hoverEq = h?.eq ?? null; invalidate() }
    const L = h?.line ?? null
    if (L !== hoverLine) { hoverLine = L; refreshOutlines() }
    renderer.domElement.style.cursor = h ? 'pointer' : ''
  }

  // ── 크기·그리기 ──
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return // 보관 중(KeepAlive)에는 크기가 0
    cw = w
    ch = h
    cam.aspect = w / h
    cam.updateProjectionMatrix()
    renderer.setSize(w, h)
    for (const t of tags) t.tf = undefined
    invalidate()
  })
  ro.observe(host)
  let raf = 0
  let paused = false
  let lastBlink = false
  let lastBoxFrame = 0
  /** 매 프레임: 바뀐 것이 없으면 아무것도 안 하고 끝 */
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (paused) return
    let camMoved = false
    if (tween) { tween(now); camMoved = true }
    if (ctl.update()) camMoved = true
    syncTopUi()
    if (hoverDirty) { hoverDirty = false; doHover() }
    const blink = downCount > 0 && Math.sin(now / 180) > 0
    const blinkFlip = blink !== lastBlink
    // 상자만 움직일 때는 초당 BOX_FPS번까지
    const boxFrame = (boxesDirty || boxesMoving) && now - lastBoxFrame >= 1000 / BOX_FPS
    if (!camMoved && !dirty && !blinkFlip && !boxFrame) return
    lastBlink = blink
    const full = camMoved || dirty
    dirty = false
    if (full || blinkFlip) paint(blink)
    if (full || boxFrame) { boxesMoving = drawBoxes(now); lastBoxFrame = now }
    // paint가 이름표 글을 바꿨으면(dirty) 이번 프레임에 같이 놓는다
    if (full || dirty) { placeTags(); drawEdges() }
    dirty = false
    drawPids()
    renderer.render(scene, cam)
  }
  drawRoutes()
  raf = requestAnimationFrame(loop)

  /** 대시보드를 떠날 때 (KeepAlive 보관): 그리기를 멈추고, 설비·라인에 다가가 있던 카메라는 그 전 자리로 */
  const pause = () => {
    paused = true
    tween = null
    dest = null
    const back = beforeDive ?? saved
    beforeDive = null
    saved = null
    focusId = null
    setRing(null)
    if (back) { cam.position.copy(back.pos); ctl.target.copy(back.tgt); ctl.update() }
  }
  const resume = () => {
    paused = false
    invalidate()
  }

  return {
    setStates,
    setIssues,
    setFlow,
    setRoutes(r: Partial<Record<ProductionLineId, string | null>>) {
      const next = { ...routes }
      for (const L of LINES) next[L] = r[L] === 'PT2' ? 1 : r[L] === 'PT1' ? 0 : routes[L]
      if (LINES.some((L) => next[L] !== routes[L])) { routes = next; drawRoutes() }
    },
    select(L: ProductionLineId | null) { if (sel !== L) { sel = L; applyDim() } },
    /** 비전 검사 칸: 오늘 검사 양품·불량 수 */
    setVision(v: { ok: number; ng: number } | null) {
      const key = v ? `${v.ok}|${v.ng}` : ''
      if (key === viKey) return
      viKey = key
      setHtml(viLab, v ? `<b>비전 검사</b><span class="ok">양품 ${v.ok.toLocaleString('ko-KR')}</span><span class="ng">불량 ${v.ng.toLocaleString('ko-KR')}</span>` : '')
      viLab.el.style.visibility = v ? '' : 'hidden'
    },
    /** 출하 적재: 오늘 출고(양품) 수 → 파렛트 상자 (상자 1개 = 20개) + 수 이름표 */
    setShipped(n: number | null) {
      const v = Math.max(0, n ?? 0)
      if (v === shipped) return
      shipped = v
      const k = Math.min(SHIP_MAX, Math.ceil(v / SHIP_PER_BOX))
      const m4 = new THREE.Matrix4()
      for (let i = 0; i < k; i++) {
        const layer = Math.floor(i / 9), cell = i % 9
        m4.makeTranslation(SHIP_X + ((cell % 3) - 1) * SLOT, 0.2 + SLOT * 0.4 + layer * SLOT * 0.8, (Math.floor(cell / 3) - 1) * SLOT)
        shipMesh.setMatrixAt(i, m4)
      }
      shipMesh.count = k
      shipMesh.instanceMatrix.needsUpdate = true
      renderer.shadowMap.needsUpdate = true
      invalidate()
      setHtml(shipLab, `출하 ${v.toLocaleString('ko-KR')}개`)
      shipLab.el.style.visibility = v ? '' : 'hidden'
    },
    /** 배정 칸: 라인별 현재 생산 · 배정(오늘 목표) · 오늘 추가 배정 */
    setAllocation(rows: Partial<Record<ProductionLineId, { done: number | null; plan: number | null; added: number }>>) {
      LINES.forEach((L, i) => {
        const r = rows[L]
        const el = allocTags[i].el
        const pct = r?.done != null && r.plan ? Math.min(100, Math.round((r.done / r.plan) * 100)) : 0
        const html = `<span class="top"><b>${L}</b><span class="n"><b>${num(r?.done)}</b> / ${num(r?.plan)}</span></span>`
          + `<span class="bar"><i style="width:${pct}%"></i></span>`
          + (r?.added ? `<span class="add">+${num(r.added)} 추가 배정</span>` : '')
        // 1초마다 불려도 값이 같으면 DOM을 건드리지 않는다
        if (el.dataset.k === html) return
        el.dataset.k = html
        el.innerHTML = html
        allocTags[i].w = -1
        invalidate()
        el.classList.toggle('more', !!r?.added)
        el.setAttribute('aria-label', `${L}라인 현재 생산 ${num(r?.done)}, 배정 ${num(r?.plan)}${r?.added ? `, 오늘 추가 배정 ${num(r.added)}` : ''}`)
      })
    },
    setView,
    onModeChange(cb: (m: ViewMode) => void) { onMode = cb },
    focus,
    unfocus,
    dive,
    pause,
    resume,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      host.removeEventListener('pointerdown', onRightDown, true)
      host.classList.remove('topui')
      ctl.dispose()
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
