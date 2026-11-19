// 실제 공장 설비를 닮은 3D 모형 (슬리팅 · 프레스 · 용접). 위치는 그룹 안 상대 좌표
// 상태 색을 받는 맨 위 뚜껑은 cap 재질로 만든다 (scene.ts가 그 재질을 찾아 상태 색으로 칠한다)
import * as THREE from 'three'

export interface Palette {
  cap: THREE.MeshStandardMaterial
  frame: string; metal: string; body: string; dark: string; chrome: string; glass: string; robot: string; wood: string; carton: string
}

type Mat = THREE.MeshStandardMaterial
const Z = Math.PI / 2

export function makeKit(P: Palette) {
  const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.3, ...o })
  const m = { frame: M(P.frame), steel: M(P.metal), dark: M(P.dark), body: M(P.body, { metalness: 0.1 }), chrome: M(P.chrome, { metalness: 0.8, roughness: 0.2 }), robot: M(P.robot, { metalness: 0.2 }), glass: M(P.glass, { transparent: true, opacity: 0.22, metalness: 0, roughness: 0.1 }), floor: M(P.dark, { metalness: 0.1 }), coil: M(P.metal, { metalness: 0.2, roughness: 0.5 }), wood: M(P.wood, { metalness: 0.05, roughness: 0.8 }), carton: M(P.carton, { metalness: 0.05, roughness: 0.8 }), black: M(P.dark, { roughness: 0.8 }) }
  const B = (p: THREE.Object3D, w: number, h: number, d: number, mat: Mat, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    o.position.set(x, y + h / 2, z)
    o.castShadow = o.receiveShadow = true
    p.add(o)
    return o
  }
  const C = (p: THREE.Object3D, r: number, h: number, mat: Mat, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat)
    o.position.set(x, y, z)
    o.rotation.x = rx
    o.rotation.z = rz
    o.castShadow = true
    p.add(o)
    return o
  }
  const S = (p: THREE.Object3D, r: number, mat: Mat, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)
    o.position.set(x, y, z)
    o.castShadow = true
    p.add(o)
  }
  const L = (p: THREE.Object3D, a: number[], b: number[], r: number, mat: Mat) => {
    const A = new THREE.Vector3(...(a as [number, number, number]))
    const d = new THREE.Vector3(...(b as [number, number, number])).sub(A)
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), mat)
    o.position.copy(A).addScaledVector(d, 0.5)
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    o.castShadow = true
    p.add(o)
  }
  const reel = (p: THREE.Object3D, x: number, r: number) => {
    B(p, 0.9, 3.4, 3.2, m.frame, x, 0.3, 0)
    C(p, 0.35, 3.6, m.steel, x, 2.3, 0, Z)
    C(p, r, 1.8, m.coil, x, 2.3, 0, Z)
    C(p, r * 0.45, 1.85, m.dark, x, 2.3, 0, Z)
  }
  const strip = (p: THREE.Object3D, x0: number, x1: number, y: number) => B(p, x1 - x0, 0.06, 2.4, m.chrome, (x0 + x1) / 2, y, 0)
  const robot = (p: THREE.Object3D, x: number, dir: number) => {
    B(p, 1.6, 1.2, 1.6, m.dark, x, 0.2, 0)
    L(p, [x, 1.4, 0], [x, 3.3, 0], 0.42, m.robot)
    S(p, 0.55, m.robot, x, 3.3, 0)
    L(p, [x, 3.3, 0], [x + dir * 1.5, 4.9, 0], 0.32, m.robot)
    S(p, 0.42, m.robot, x + dir * 1.5, 4.9, 0)
    L(p, [x + dir * 1.5, 4.9, 0], [x + dir * 2.9, 3.7, 0], 0.26, m.robot)
    S(p, 0.3, m.dark, x + dir * 2.9, 3.7, 0)
    L(p, [x + dir * 2.9, 3.7, 0], [x + dir * 3.3, 3.1, 0], 0.2, m.dark)
    L(p, [x + dir * 3.3, 3.1, 0], [x + dir * 3.55, 2.4, 0], 0.07, m.steel)
  }

  /** 슬리팅: 코일카 + 언코일러 + 슬리터 + 스크랩 와인더 + 리코일러. 길이 약 20 */
  const slitter = (p: THREE.Object3D) => {
    B(p, 16, 0.3, 6, m.floor, 0.5, 0, 0)
    for (const z of [-1.4, 1.4]) B(p, 6, 0.15, 0.3, m.steel, -6.5, 0.3, z)
    B(p, 2.4, 0.5, 3.4, m.frame, -6.5, 0.45, 0)
    C(p, 1.7, 1.8, m.coil, -6.5, 2.2, 0, Z)
    C(p, 0.75, 1.85, m.dark, -6.5, 2.2, 0, Z)
    reel(p, -3.2, 1.7)
    strip(p, -3.2, 5.5, 1.3)
    B(p, 3.2, 2.8, 3.4, m.frame, -0.5, 0.3, 0)
    B(p, 3.3, 0.35, 3.5, P.cap, -0.5, 3.1, 0)
    C(p, 0.35, 3.8, m.steel, -0.5, 1.0, 0, Z)
    C(p, 0.35, 3.8, m.steel, -0.5, 1.9, 0, Z)
    for (let k = -3; k <= 3; k++) C(p, 0.75, 0.09, m.chrome, -0.5, 1.0, k * 0.42, Z)
    B(p, 1.1, 1.6, 1.4, m.steel, -0.5, 0.3, 3.2)
    C(p, 0.8, 0.9, m.dark, -0.5, 1.5, 3.7, Z)
    reel(p, 5.5, 1.4)
    B(p, 1.6, 2.4, 1, m.body, 3, 0.3, -3.3)
  }

  /** 프레스: A C형 프레임 · B 4주 스트레이트 사이드 · C 유압. 가로세로 약 5, 높이 8~12 */
  const press = (p: THREE.Object3D, v: 'A' | 'B' | 'C') => {
    if (v === 'A') {
      B(p, 5, 1.2, 3.6, m.frame, 0, 0, 0)
      B(p, 3.6, 0.3, 3, m.steel, 0.3, 1.2, 0)
      B(p, 1.5, 5.4, 3.2, m.frame, -1.9, 1.2, 0)
      B(p, 5, 1.4, 3.2, P.cap, -0.2, 6.6, 0)
      B(p, 2.4, 1.4, 2.2, m.steel, 0.5, 4.3, 0)
      L(p, [0.5, 5.7, 0], [0.5, 6.6, 0], 0.25, m.chrome)
      B(p, 2.2, 0.5, 1.8, m.dark, 0.5, 1.5, 0)
      B(p, 2.2, 0.5, 1.8, m.dark, 0.5, 3.8, 0)
      C(p, 1.4, 0.5, m.dark, -0.7, 7.4, 2.0, Z)
    } else if (v === 'B') {
      B(p, 5.2, 1.3, 4, m.frame, 0, 0, 0)
      B(p, 4.6, 0.35, 3.4, m.steel, 0, 1.3, 0)
      for (const x of [-2.2, 2.2]) for (const z of [-1.6, 1.6]) B(p, 0.7, 6.2, 0.7, m.frame, x, 1.65, z)
      B(p, 5.2, 1.6, 4, P.cap, 0, 7.85, 0)
      B(p, 4.2, 1.1, 3.2, m.steel, 0, 4.4, 0)
      for (const x of [-1, 1]) L(p, [x, 5.5, 0], [x, 7.9, 0], 0.3, m.chrome)
      B(p, 3.2, 0.5, 2.4, m.dark, 0, 3.9, 0)
      B(p, 3.4, 0.5, 2.6, m.dark, 0, 1.65, 0)
      C(p, 1.6, 0.6, m.dark, 3.2, 8.7, 0, 0, Z)
    } else {
      B(p, 5, 1.4, 4, m.frame, 0, 0, 0)
      for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) C(p, 0.38, 7, m.chrome, x, 4.9, z)
      B(p, 5, 1, 4, P.cap, 0, 8.4, 0)
      L(p, [0, 5.7, 0], [0, 8.4, 0], 0.45, m.chrome)
      B(p, 4.2, 0.9, 3.2, m.steel, 0, 4.8, 0)
      B(p, 3.4, 0.5, 2.6, m.dark, 0, 1.4, 0)
      B(p, 3.2, 0.5, 2.4, m.dark, 0, 4.3, 0)
      B(p, 1.8, 2, 1.6, m.steel, 0, 0, 3.0)
      L(p, [0.6, 2.0, 3.0], [1.0, 10.2, 0.6], 0.14, m.dark)
    }
  }

  /** 용접: 안전 펜스가 있는 로봇 용접 셀. 가로 약 11, 세로 8. 바닥판 = 상태 색 (펜스 안 지그만으로는 위에서 잘 안 보인다) */
  const welder = (p: THREE.Object3D) => {
    B(p, 11, 0.2, 8, P.cap, 0, 0, 0)
    B(p, 11, 4, 0.1, m.glass, 0, 0.2, -4)
    B(p, 0.1, 4, 8, m.glass, -5.5, 0.2, 0)
    B(p, 0.1, 4, 8, m.glass, 5.5, 0.2, 0)
    for (const x of [-5.5, 5.5]) for (const z of [-4, 4]) B(p, 0.25, 4.2, 0.25, m.frame, x, 0.2, z)
    robot(p, -1.5, 1)
    B(p, 3.6, 1, 2.4, P.cap, 2.6, 0.2, 0)
    B(p, 3, 0.12, 1.8, m.chrome, 2.6, 1.2, 0)
    B(p, 0.12, 0.9, 1.8, m.chrome, 1.1, 1.3, 0)
    for (const z of [-0.8, 0.8]) C(p, 0.14, 0.5, m.steel, 3.6, 1.5, z)
    B(p, 1.2, 2.4, 0.9, m.body, -4.2, 0.2, 3.2)
  }

  const standCoil = (p: THREE.Object3D, x: number, y: number, z: number, r: number) => {
    C(p, r, 1.6, m.chrome, x, y + 0.8, z)
    C(p, r * 0.45, 1.65, m.dark, x, y + 0.8, z)
  }

  /** 코일 적재장 천장 크레인: 문형 크레인이 코일을 들고 있다. 가로 약 12 */
  const crane = (p: THREE.Object3D) => {
    for (const x of [-5.5, 5.5]) { B(p, 0.6, 6, 0.6, m.frame, x, 0.15, 0); B(p, 1.2, 0.3, 3.4, m.dark, x, 0.15, 0) }
    B(p, 12.4, 0.6, 0.9, m.frame, 0, 6.1, 0)
    B(p, 1.4, 0.9, 1.4, m.robot, 1.5, 5.2, 0)
    for (const z of [-0.5, 0.5]) L(p, [1.5, 5.2, z], [1.5, 3.4, z], 0.05, m.dark)
    B(p, 1.8, 0.3, 1.4, m.dark, 1.5, 3.1, 0)
    standCoil(p, 1.5, 1.4, 0, 1.1)
  }

  /** 도장: 도장 부스 + 건조로가 컨베이어로 이어진 모양. 가로 약 11 */
  const paint = (p: THREE.Object3D) => {
    B(p, 5, 4, 4, m.body, -3.2, 0, 0)
    B(p, 5.4, 0.5, 4.4, P.cap, -3.2, 4, 0)
    B(p, 3, 1.6, 0.1, m.glass, -3.2, 1.7, 2.05)
    B(p, 5, 3.6, 4, m.steel, 3.2, 0, 0)
    B(p, 5.4, 0.5, 4.4, P.cap, 3.2, 3.6, 0)
    C(p, 0.5, 2.4, m.dark, 3.2, 5.3, 0)
    B(p, 12, 0.3, 1.2, m.dark, 0, 0.2, 0)
    for (const x of [-5.5, -1.5, 1.5, 5.5]) B(p, 0.2, 1.4, 0.2, m.dark, x, 3.6, 0)
    B(p, 12, 0.2, 0.2, m.dark, 0, 5.0, 0)
    B(p, 1.2, 2.4, 0.9, m.body, -5.4, 0, 3)
  }

  /** 비전 검사: 컨베이어 위 카메라 게이트 + 모니터. 맨 위 보 = 상태 색 */
  const vision = (p: THREE.Object3D) => {
    for (const z of [-2, 2]) B(p, 0.45, 3.8, 0.45, m.frame, 0, 0, z)
    B(p, 0.7, 0.5, 4.9, P.cap, 0, 3.8, 0)
    for (const z of [-1, 0, 1]) { B(p, 0.6, 0.5, 0.7, m.dark, 0, 3.0, z); C(p, 0.18, 0.35, m.chrome, 0, 2.8, z) }
    for (const x of [-1.2, 1.2]) B(p, 0.3, 0.2, 3.6, m.body, x, 3.6, 0)
    B(p, 0.2, 2, 0.2, m.dark, 3.2, 0, 2.8)
    B(p, 1.6, 1, 0.1, m.dark, 3.2, 1.6, 2.8)
  }

  /** 출하: 파렛트 적재장(포장한 제품 상자 더미) + 지게차 */
  const shipping = (p: THREE.Object3D, forklift: boolean) => {
    for (const x of [-4, 0, 4]) for (const z of [-3, 0]) {
      B(p, 2.2, 0.25, 2.2, m.wood, x, 0, z)
      B(p, 2.0, 1.5, 2.0, m.carton, x, 0.25, z)
      B(p, 2.1, 1.6, 2.1, m.glass, x, 0.2, z)
    }
    if (forklift) {
      B(p, 1.6, 1.1, 2.4, m.robot, 5.4, 0.3, 3.3)
      B(p, 1.4, 0.8, 1.2, m.dark, 5.4, 0.75, 4.0)
      B(p, 0.25, 3.2, 0.25, m.dark, 5.4, 0.15, 1.9)
      for (const dx of [-0.5, 0.5]) B(p, 0.1, 0.1, 1.8, m.steel, 5.4 + dx, 0.2, 1.1)
    }
  }
  return { slitter, press, welder, crane, paint, vision, shipping }
}
