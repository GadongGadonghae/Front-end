# FRONTEND.md — 프론트엔드 구조와 규칙

이 문서는 `src/`를 만들고 고치는 사람(팀원·코딩 에이전트)이 따르는 구조 규칙이다.
무엇을 만드는지는 `docs/specs/`, 어떻게 보이는지는 `DESIGN.md`, 어떻게 짜는지는 이 문서가 기준이다.
셋이 다르게 말하면 `CLAUDE.md` → `docs/specs/` → `DESIGN.md` → 이 문서 순으로 따른다.

| 버전 | 일자 | 변경 |
|---|---|---|
| 0.1 | 2026-11-16 | 첫 작성: 층 구조, 의존 방향, 토큰 단계, 부품 목록, 라우트, 데이터 층, 린트 |
| 0.2 | 2026-11-16 | 시안 B 18개 화면과 대조해 화면 전용 부품 추가 (예지보전·인버터·입고·보고서·설정), 차트 기능 보강 |
| 0.3 | 2026-11-17 | 1.1 Vue를 쓰는 이유 추가 (D-91). 아이콘·검사 절 번호를 실제와 맞춤 |

화면 구성의 근거는 시안 B(`docs/wireframes/후보/B*.html`)다. 시안은 구성 확인용이라 px 수치는 가져오지 않는다.

---

## 1. 기술 선택

| 항목 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Vue 3 SFC + `<script setup lang="ts">` | Composition API만 쓴다. Options API 쓰지 않음 |
| 빌드 | Vite | |
| 라우터 | vue-router | 로그인 확인·복귀(FN-016) |
| 상태 공유 | composable + 모듈 단위 `ref` | Pinia는 쓰지 않는다. 필요해지면 먼저 묻는다 |
| 차트 | SVG를 직접 그리는 Vue 컴포넌트 | 차트 라이브러리 쓰지 않음 |
| 아이콘 | 인라인 SVG 컴포넌트 `BaseIcon` (경로 데이터는 Lucide) | 아이콘 폰트·이모지 쓰지 않음. 한 가지 선 굵기 |
| 글꼴 | Pretendard (self-host 또는 CDN 1곳) | DESIGN.md Typography |
| 검사 | `vue-tsc`, ESLint, Stylelint | 7장 |

UI 라이브러리·차트 라이브러리·상태 관리 라이브러리를 새로 넣으려면 먼저 묻는다 (CLAUDE.md).

### 1.1 Vue를 쓰는 이유

결정 D-05(프론트 = Vue)를 따르고, 2026-11-16에 React 전환을 검토한 뒤 Vue를 유지하기로 했다 (D-91).

| 이유 | 이 프로젝트에서 뜻하는 것 |
|---|---|
| **1초 갱신 화면에 손이 덜 간다** | 설비 39대 상태가 1초마다, 요약이 10초마다, 알람이 수시로 바뀐다 (API 명세 3.1). Vue는 `ref`·`computed`가 값을 추적해 **바뀐 곳만** 다시 그린다. React처럼 다시 그리기를 막으려고 `useMemo`·`useCallback`을 챙길 일이 적다 |
| **정해진 방식이 하나다** | 라우터·개발 도구·빌드 도구(Vite)를 Vue 쪽이 함께 만든다. 고를 것이 적어 이 문서의 규칙(층·의존 방향·부품 목록)을 팀 전체가 같은 모양으로 지키기 쉽다 |
| **한 파일에 모양·로직·스타일** | `.vue` 파일 하나에 `<template>`·`<script>`·`<style scoped>`가 나뉜다. 스타일이 부품 밖으로 새지 않고, Stylelint로 "토큰 변수만 쓰기"를 파일 단위로 검사할 수 있다 |
| **HTML에 가까운 템플릿** | 화면 구성 확인용 시안이 HTML이라 구조를 옮겨 오기 쉽다. HTML·CSS를 아는 사람이 화면 코드를 읽기 쉽다 |
| **필요한 것이 다 된다** | 실시간(웹소켓), SVG 차트 직접 그리기, 3D 공장(Three.js 또는 TresJS, SCR-005)까지 Vue로 막히는 것이 없다 |
| **이미 쌓인 것과 이어진다** | 명세·CLAUDE.md·이 문서·구현 1~3단계가 모두 Vue 기준이다 |

**알고 감수하는 것**
- React가 채용 공고·라이브러리 수·예제가 더 많다. 포트폴리오에서 React 경험을 원하면 불리할 수 있다.
- React 전용 도구는 쓸 수 없다 (예: Agentation). 같은 목적에는 Vue 공식 DevTools 플러그인을 쓴다.
- 3D 도우미 모음은 React Three Fiber 쪽이 더 풍부하다. 이 프로젝트의 3D(설비 39대 색·회전·클릭)는 Three.js만으로 충분하다.

**다시 볼 때**: 팀이 프레임워크를 바꾸기로 하면 D-05·D-91부터 고친다. 토큰(`styles/`)·타입(`types/`)·데이터 층(`data/`)·순수 함수(`lib/`)는 Vue를 모르게 짜 두었으므로, 바꿔도 화면 층(`components`·`layouts`·`pages`·`composables`)만 다시 짜면 된다.

---

## 2. 폴더 구조와 층

```
src/
├─ main.ts                앱 시작: 라우터·전역 스타일 연결
├─ App.vue                <RouterView /> 만
├─ styles/                ① 토큰·기본 스타일
│   ├─ tokens.css            :root 변수 (색·간격·둥글기·글자·크기·움직임) — 값은 여기에만
│   └─ base.css              초기화, 글꼴, tabular-nums, 포커스 테두리, 선택 색, 스크롤바
├─ types/                 ② 도메인 타입 (데이터정의서 DT 기준)
├─ data/                  ③ 데이터 층
│   ├─ contracts.ts          인터페이스: LiveChannel, 조회·저장 함수 시그니처
│   ├─ index.ts              지금 쓸 구현을 고름 (mock / api)
│   ├─ mock/                 데모 공급기: 기준정보, 시나리오, 1초 틱
│   └─ api/                  실제 백엔드 구현. endpoints(명세 1:1)·dto·http·source(계약으로 변환)
├─ lib/                   ④ 순수 함수: 숫자·시간 포맷, OEE 계산, 대표 상태(D>I>S>R)
├─ composables/           ⑤ 화면 로직: 구독·조회·가공 (use* 이름)
├─ components/
│   ├─ base/              ⑥ 업무를 모르는 기본 부품 (Base* 이름)
│   ├─ charts/            ⑦ SVG 차트 (Chart* 이름)
│   └─ domain/            ⑧ 업무 부품: 상태 열쇠 칸, 설비 칸, 알림 목록 …
├─ layouts/               ⑨ AppShell(상단 메뉴), PageHead(제목 줄), 토스트 자리
├─ pages/                 ⑩ 화면 = 부품 조립 (Scr*Page 이름)
└─ router/                ⑪ 라우트 표, 로그인 확인
```

### 의존 방향 (위에서 아래로만 가져다 쓴다)

```
pages ─┬─> layouts ─┐
       ├─> components/domain ─┬─> components/base
       │                      └─> components/charts ─> components/base
       └─> composables ─> data ─> types
                       └─> lib  ─> types
모든 층 ─> styles(토큰 변수만)
```

- **base·charts는 업무를 모른다.** `types/`의 업무 타입이나 `data/`를 가져오지 않는다. 필요한 값은 props로 받는다.
- **domain은 데이터를 직접 부르지 않는다.** props로 받은 업무 타입을 그린다. 데이터 구독·조회는 composable이 한다.
- **pages는 조립만 한다.** composable로 데이터를 받고 부품에 넘긴다. 페이지 안에 긴 가공 로직이나 새 스타일 덩어리를 두지 않는다. 같은 모양이 두 화면에 나오면 부품으로 뺀다.
- **data는 화면을 모른다.** Vue를 가져오지 않는 순수 TypeScript로 쓴다 (mock의 타이머 포함).
- 이 방향은 ESLint `no-restricted-imports`로 막는다 (6장).

---

## 3. 토큰 (`styles/tokens.css`)

색은 DESIGN.md frontmatter 값을 그대로 쓴다. 간격·둥글기·글자·크기 단계는 여기서 처음 정한다
(시안 B의 px 값은 옮기지 않는다). 아래 표는 초안이며 **`tokens.css`가 기준**이다. 바꾸면 이 표와
DESIGN.md를 같이 고친다.

### 3.1 색 (DESIGN.md와 같은 이름)
`--c-canvas`, `--c-surface`, `--c-surface-sunk`, `--c-track`, `--c-ink`, `--c-ink-2`(secondary), `--c-ink-3`(muted),
`--c-accent`(signal-blue), 상태 `--c-run`/`--c-run-ink`, `--c-stop`/`--c-stop-ink`/`--c-stop-solid`,
`--c-idle`/`--c-idle-ink`/`--c-idle-edge`, `--c-down`/`--c-down-ink`, `--c-caution-ink`, `--c-down-tint`, `--c-idle-tint`,
선 `--c-line`(옅은 구분선), `--c-line-strong`(입력 테두리).

### 3.2 간격 — 4px 기준
| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--sp-1` | 4px | 글자와 아이콘 사이, 아주 촘촘한 묶음 |
| `--sp-2` | 8px | 라벨과 값, 칸 안 줄 사이 |
| `--sp-3` | 12px | 목록 행 안쪽, 작은 칸 안쪽 |
| `--sp-4` | 16px | 패널 사이 간격, 표 셀 좌우 |
| `--sp-5` | 20px | 패널 안쪽 여백 |
| `--sp-6` | 24px | 화면 좌우 여백, 요약 덩어리 사이 |
| `--sp-8` | 32px | 큰 구역 사이 |

같은 것은 같은 간격: 묶음 안 < 묶음 사이. 토큰 사이 값(6px, 10px, 14px 등)을 직접 쓰지 않는다.

### 3.3 둥글기
| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--r-1` | 4px | 상태 열쇠 칸, 표 안 작은 요소 |
| `--r-2` | 6px | 버튼, 입력, 탭, 설비 칸 |
| `--r-3` | 8px | 패널 |

### 3.4 글자
| 토큰 | 크기 / 굵기 | 쓰는 곳 |
|---|---|---|
| `--fs-sm` | 13px / 400 | 축 라벨, 메타, 기준 시각, 숫자 위 이름표, 표 머리줄 |
| `--fs-md` | 14px / 400 · 600 | 본문 기본, 표 셀, 목록, 설명. 패널 제목은 600 |
| `--fs-lg` | 20px / 600 | 화면 제목, 이동 경로 현재 위치, 보조 숫자, 상태별 대수 |
| `--fs-xl` | 32px / 600 | 요약 열 숫자 |
| `--fs-2xl` | 44px / 600 | 화면의 핵심 숫자 하나 |

굵기는 400·600 두 가지. 상태 코드 글자(R/S/I/D)만 700. 모든 숫자는 `tabular-nums`.

### 3.5 크기·배치
| 토큰 | 값 | 뜻 |
|---|---|---|
| `--nav-h` | 52px | 상단 메뉴 높이 |
| `--head-h` | 64px | 화면 제목 줄 높이 (모든 화면 같음) |
| `--page-gutter` | `--sp-6` | 화면 좌우 여백 |
| `--col-summary` | `clamp(280px, 17vw, 320px)` | 왼쪽 요약 열 폭 |
| `--col-side` | `clamp(340px, 22vw, 440px)` | 오른쪽 알림·보조 열 폭 |
| `--key-sm` / `--key-md` / `--key-lg` | 22 / 26 / 40px | 상태 열쇠 칸 (표 안 / 목록·범례 / 대표 상태) |

### 3.6 움직임
`--dur-fast: 150ms`(hover·선택), `--dur-enter: 240ms`(토스트 등장), `--ease-out: cubic-bezier(.2,.8,.2,1)`.
움직이는 것은 고장 토스트와 물류 점뿐 (DESIGN.md). `prefers-reduced-motion`이면 끈다.

---

## 4. 부품 목록

### 4.1 base (업무 모름)
| 부품 | 하는 일 |
|---|---|
| `BasePanel` | 패널 껍데기. 제목·메타·오른쪽 도구 자리(slot) |
| `BaseBreadcrumb` | 이동 경로 (대시보드 > L3 > 프레스). 마지막 항목이 화면 제목 h1 |
| `BaseFigureRow` | 제목 줄 오른쪽 요약 숫자 묶음, 항목 사이 세로 가는 선 |
| `BaseTabs` | 링크 탭 (라인 A~F, 공정, 리포트 종류) |
| `BaseSegmented` | 구간 버튼 (일/주/월, 1시간/8시간/오늘, 관리값 항목) |
| `BaseTable` | 표: 머리줄, 숫자 열 정렬, 누를 수 있는 행, 펼침 행 slot |
| `BaseInput`, `BaseSelect`, `BaseDateField`, `BaseCheck` | 입력 (`BaseInput` type=search로 검색) |
| `BaseButton` | 기본·주요·작은 버튼 |
| `BasePager` | 50건 페이지 |
| `BaseEmpty` | "데이터 없음" (D-78) |
| `BaseNumber` | 숫자 표시: 천 단위, 단위 작게, 값 없으면 "-" (D-78) |
| `BaseFigure` | 이름표 + 큰 숫자 + 보조 설명 |
| `icons/*` | 인라인 SVG 아이콘 |

### 4.2 charts (업무 모름)
| 부품 | 하는 일 | 쓰는 화면 |
|---|---|---|
| `ChartLine` | 시간축 선 그래프: 계열 여러 개, 기준선(목표·상하한·80/90%), 지금 시각 선, 이탈 점, 구간 띠(미세정지 후보 등) | 001, 010, 002-x, 004, 011 |
| `ChartBarList` | 이름 · 가로 막대 · 값 목록: 기준선(라인 계획), 앞머리 슬롯(상태 열쇠 칸), 강조 행("가장 낮음") | 001, 003, 007, 011, 002-5 |
| `ChartTimeline` | 00~24시 구간 색 띠 | 003 |
| `ChartProgress` | 목표 하나에 대한 진행 막대 | 요약 열 |
| `ChartColumns` | 세로 막대 + 기준 점선 (일별 실적 vs 하루 계획) | 011 |

### 4.3 domain (업무 앎, 데이터는 props로)
| 부품 | 하는 일 | 쓰는 화면 |
|---|---|---|
| `StatusKey` | 상태 열쇠 칸 (R/S/I/D 글자 + 명칭 선택). 크기 sm/md/lg | 전 화면 |
| `StatusCounts` | 상태별 대수 묶음 (가로 / 2×2) | 001 범례, 010, 002-x |
| `PdmMark` | 예지보전 주의·위험 테두리와 "주의 84%" 글자 | 001, 010, 002-x, 004 |
| `StateLegend` | 범례 (상태 4색 + 주의·위험, 대수 선택) | 001, 010, 003 |
| `EquipCell` | 설비 칸 (작게: 배치도 / 크게: 라인 흐름, 사유·사이클 포함) | 001, 010 |
| `FactoryMap` | 공장 배치도 (입고 → 6라인 → 도장 2 → 비전 1, 연결선, 모눈) | 001 |
| `LineFlow` | 라인 흐름 (슬리팅 → 프레스 1~4 → 용접, 재공·생산·불량) | 010 |
| `AlertList` / `AlertItem` | 알림 목록 (진행 중 위, 해제 흐리게, 이상 행 바탕, 보고서 버튼) | 001, 010, 헤더 |
| `FaultToast` | 고장 토스트 | 전 화면 (layouts에서) |
| `SummaryColumn` / `SummaryBlock` | 왼쪽 요약 열과 덩어리 | 010, 003, 007, 011 |
| `EquipCard` | 공정 상세 설비 카드 (상태 띠 + 사이클·CT) | 002-x |
| `DowntimeHistory` | 비가동 이력 + 조치 메모 | 002-x |
| `InspectionPanel` | 공정 검사 숫자 + 불량 목록 | 002-x |
| `ProcessSteps` | 제품이 거친 공정 표시 (통과·불량·진행 중·안 거침) | 011 |
| `RiskList` / `RiskItem` | 예지보전 위험도 목록: 위험·주의 묶음, 항목 %, 80·90% 눈금 막대, 정상 접기 | 004 |
| `RiskEta` | 상한 도달 예상 시간 [차순위] | 004 |
| `InverterStatus` | 인버터 운전 상태·최근 트립·지령/출력 주파수 (실설비만) | 002-2 |
| `InboundLog` | 오늘 입고 기록 (시각 · 코일 수) | 002-1 |
| `ReplanReport` | 계획수정 보고서 본문: 발생 → 부족 수량 → 다른 라인 배정 표 → 결과 | 007 |
| `TargetForm` | 하루 목표 입력 + 라인 계획 자동 계산 안내 | 008 |
| `LimitTable` | 관리값 항목별 하한·상한 입력, 하한 > 상한 오류, 마지막 수정자 | 009 |

새 부품을 만들기 전에 이 표에서 먼저 찾는다. 표에 없는 부품을 만들면 이 표에 추가한다.

---

## 5. 화면과 라우트

| 화면 ID | 화면 | 경로 | 파일 |
|---|---|---|---|
| SCR-000 | 로그인 | `/login` | `pages/Scr000LoginPage.vue` |
| SCR-001 | 대시보드 (3D 전환 SCR-005 포함) | `/` | `pages/Scr001DashboardPage.vue` |
| SCR-010 | 라인 상세 | `/lines/:lineId` (A~F, PT=도장) | `pages/Scr010LinePage.vue` |
| SCR-002-1 | 코일입고 상세 | `/inbound` | `pages/Scr0021InboundPage.vue` |
| SCR-002-2~4 | 슬리팅·프레스·용접 상세 | `/lines/:lineId/:process` (slit·press·weld), `?eq=` 처음 고를 설비 | `pages/Scr002ProcessPage.vue` (공통 틀 하나, 공정별로 다른 칸만 바꿈) |
| SCR-002-5 | 도장 상세 | `/lines/PT/paint` | `pages/Scr002ProcessPage.vue` |
| SCR-002-6 | 출고 상세 | `/outbound` | `pages/Scr0026OutboundPage.vue` |
| SCR-003 | 가동률 | `/utilization` | `pages/Scr003UtilizationPage.vue` |
| SCR-004 | 예지보전 | `/pdm` | `pages/Scr004PdmPage.vue` |
| SCR-006 | 알람·비가동 이력 | `/alarms` (`?tab=risk`) | `pages/Scr006AlarmsPage.vue` |
| SCR-007 | 리포트 | `/reports/daily`, `/reports/replan/:id?` | `pages/Scr007*Page.vue` |
| SCR-008 | 생산 목표 설정 | `/settings/target` | `pages/Scr008TargetPage.vue` |
| SCR-009 | 관리값 기준 설정 | `/settings/limits` | `pages/Scr009LimitsPage.vue` |
| SCR-011 | 생산 조회 | `/production` | `pages/Scr011ProductionPage.vue` |

- 조회 조건(기간·라인·필터)은 URL query에 둔다. 새로고침·링크 공유 때 같은 화면이 나오게 한다.
- `/login` 외 모든 경로는 로그인해야 들어간다. 로그인 안 했으면 `/login?redirect=원래경로` (FN-016).
- 라우트 `meta`에 화면 ID와 메뉴 이름을 둔다 (`meta: { screen: 'SCR-001', menu: '대시보드' }`).
- 페이지 파일 첫 줄 주석에 화면정의서 절 번호를 적는다.

---

## 6. 데이터 층

데이터정의서 7장대로 두 갈래다. 메시지·API 형식과 주기는 `docs/specs/API명세서.md`가 기준이다
(웹소켓 `plant`·`risk`·`telemetry:{설비}` 구독, REST API-0xx). `contracts.ts`의 함수는 API 명세의 API와 1:1로 맞춘다.

```ts
// data/contracts.ts (모양만)
interface LiveChannel {                      // 실시간 push 1개 채널
  onSnapshot(cb: (s: PlantSnapshot) => void): Unsubscribe   // 1초마다 설비 39대 현재 상태
  onProductMove(cb: (e: ProductMove) => void): Unsubscribe  // 물류 점
  onAlarm(cb: (e: AlarmEvent) => void): Unsubscribe         // 고장 발생·해제 → 토스트·알림
}
interface Queries { /* 화면별 조회: getHourlyOutput, getDowntimeHistory, getOee, ... */ }
interface Commands { /* 저장: saveActionMemo, saveTarget, saveLimits, createReplanReport, login */ }
export interface DataSource { live: LiveChannel; q: Queries; cmd: Commands }
```

- **화면은 `data/index.ts`가 내보내는 `DataSource`만 쓴다.** mock인지 실제 API인지 모른다.
- 지금 구현은 `data/mock/`. `VITE_DATA_SOURCE=mock|api`로 고른다 (기본 mock).
- mock은 데이터정의서 3장 기준정보(라인·공정·설비 39대·관리값 기준)를 그대로 두고, 시나리오(정상 가동, L2 프레스 3단 고장, 재공부족 대기, 예지보전 주의·위험 등)로 상태를 만든다.
- 데모 값을 보여 줄 때는 화면에 "데모 값"임을 표시한다 (CLAUDE.md).
- 타입 이름은 데이터정의서 엔티티 영어 이름을 따른다 (`Equipment`, `StateEvent`, `Inspection`, `DailySummary` …). 각 타입 주석에 DT 번호를 적는다.
- 화면에서 1초 구독은 composable이 맡고, 화면을 떠나면 구독을 끊는다 (`onScopeDispose`).

---

## 7. 코드 규칙

**컴포넌트**
- 파일 이름 PascalCase, 두 단어 이상. base는 `Base*`, charts는 `Chart*`, 페이지는 `Scr{ID}*Page`.
- props·emits는 TypeScript로 정의 (`defineProps<…>()`). props를 직접 바꾸지 않는다.
- 한 컴포넌트 파일은 대략 200줄 안. 넘으면 나눈다.
- 스타일은 `<style scoped>`. 전역 스타일은 `styles/`에만.

**스타일**
- 색·간격·둥글기·글자 크기·그림자는 `var(--…)`로만. hex·rgb·이름 색을 컴포넌트에 쓰지 않는다 (Stylelint가 막음).
- 1px 선 굵기처럼 토큰이 없는 아주 작은 값만 px 직접 허용.
- 상태 색은 상태 표시에만, 강조 파랑은 실적·달성률·포커스·링크에만 (DESIGN.md Named Rules).

**문구**
- 화면 문구는 한국어, 용어는 `docs/인터뷰/03_용어집.md`. 명세에 없는 문구·수치를 지어내지 않는다.
- 빈 값: 숫자 "-", 그래프·목록 "데이터 없음".

**검사 (커밋 전)**
- `npm run check` = `vue-tsc` 타입 검사 + ESLint + Stylelint. 실패하면 커밋하지 않는다.
- 화면을 만들거나 바꾸면 렌더링해 보고 `/impeccable polish`·`audit`로 점검한다. 크기는 **실제 브라우저 화면 높이**로 본다:
  1920×940 (1920×1080 모니터에서 주소창·탭을 뺀 높이, 기준), 1536×730 (노트북 125% 배율, 가장 낮음), 1440×810.
  창 전체 높이(1080)로만 보면 아래쪽 칸이 눌리는 문제를 놓친다 (2026-11-17 대시보드에서 실제로 놓침).
- 지원하는 가장 좁은 창은 1280px (`--app-min-w`). 이보다 좁으면 가로 스크롤이 생기고 화면은 무너지지 않는다.
- 높이가 모자라 칸이 낮아지면 칸 안 배치를 옆으로 놓아 해결한다 (예: 대시보드 오늘 생산 = 숫자 왼쪽 열 + 그래프 오른쪽). 그래프는 `--chart-min-h`보다 납작해지지 않게 한다.

---

## 8. 만드는 순서

1. 기반: 라우터·린트 설정, `styles/`, `types/`, `data/contracts.ts`, `data/mock/` 기준정보와 1초 틱
2. 틀: `layouts/AppShell`, `PageHead`, 로그인 확인
3. base·charts 부품
4. domain 부품 (대시보드에 필요한 것부터)
5. 화면: 001 → 010 → 002-1~6 → 006 → 003 → 011 → 004 → 007 → 008·009 → 000
6. 화면이 다 되면 `/impeccable document`로 DESIGN.md에 실제 수치를 채운다

층마다 브랜치를 나누고 커밋한다.
