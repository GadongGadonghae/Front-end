# 라인가동현황 모니터링 — 프론트엔드

공장 설비 39대(라인 A~F, 도장 2대, 비전 1대)의 상태·생산·가동률을 1초 단위로 보여 주는 관제 화면입니다.
Vue 3 + TypeScript + Vite. 차트는 라이브러리 없이 SVG로 직접 그립니다.

- 화면 요구사항: `docs/specs/` (화면정의서·기능명세서·데이터정의서), 결정 근거: `docs/인터뷰/02_결정사항_미결.md` (D-xx)
- 코드 구조·층·의존 방향: [`FRONTEND.md`](FRONTEND.md), 보이는 모습: [`DESIGN.md`](DESIGN.md)
- 백엔드 API 명세: [`docs/api-spec-v3.1.md`](docs/api-spec-v3.1.md), 프론트와의 차이·요청: [`docs/API-차이-v3.1.md`](docs/API-차이-v3.1.md)
- 진행 상황: [`docs/진행현황.md`](docs/진행현황.md)

---

## 1. 실행

```bash
npm install
npm run dev        # http://localhost:5173 (데모 데이터로 바로 뜸, 로그인은 아무 아이디·비밀번호)
npm run check      # 타입 검사 + ESLint + Stylelint (커밋 전 필수)
npm run build      # dist/ 에 빌드
```

Node 20 이상.

## 2. 데이터 모드: 데모(mock) ↔ 백엔드(api)

화면은 **데이터 계약** `src/data/contracts.ts`의 `DataSource` 인터페이스만 압니다. 그 계약을 누가 채우는지는 환경 변수 하나로 고릅니다.

| `VITE_DATA_SOURCE` | 채우는 쪽 | 상태 |
|---|---|---|
| `mock` (기본) | `src/data/mock/` 프론트 데모 공급기. 백엔드 없이 1초 갱신·고장·예지보전 장면을 흉내 냄 | 동작함. 화면 오른쪽 위에 "데모 데이터" 표시 |
| `api` | `src/data/api/` 실제 백엔드 어댑터 (REST + WebSocket) | **아직 없음.** 3장 순서로 만든다 |

```bash
cp .env.example .env.local     # .env.local 은 커밋하지 않음
# .env.local 에서 VITE_DATA_SOURCE=api 로 바꾸고 npm run dev
```

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `VITE_DATA_SOURCE` | `mock` | `mock` 또는 `api` |
| `VITE_API_BASE` | `/api` | REST 기본 주소 |
| `VITE_WS_URL` | `/ws` | WebSocket(STOMP) 주소 |
| `BACKEND_URL` | `http://localhost:8080` | 개발 서버가 `/api`·`/ws`를 넘길 백엔드 주소 |

### 개발 서버 프록시

`npm run dev`는 `/api`와 `/ws` 요청을 `BACKEND_URL`(Spring Boot)로 넘깁니다 (`vite.config.ts`). 브라우저는 프론트와 같은 주소로 요청하므로 **개발 중에는 백엔드 CORS 설정이 필요 없습니다.** 배포 때는 같은 도메인 아래 리버스 프록시(nginx 등)로 같은 구조를 두거나, 백엔드에서 프론트 주소를 CORS 허용해야 합니다.

## 3. 백엔드 연결하기 (`src/data/api/` 만들기)

### 3.1 구조

```
src/data/
  contracts.ts      ← 화면이 아는 유일한 인터페이스 (Queries · Commands · LiveChannel)
  index.ts          ← VITE_DATA_SOURCE 로 mock / api 를 고름
  mock/             ← 데모 공급기 (지금 쓰는 것)
  api/              ← 여기를 만든다: 같은 계약을 백엔드 REST·WebSocket으로 채움
```

- 화면·composable 코드는 바꾸지 않습니다. 어댑터가 백엔드 응답을 계약의 타입(`src/types/`)으로 바꿔 돌려주면 됩니다.
- `data/`는 Vue를 모르는 순수 TypeScript입니다 (ESLint가 막음). 어댑터도 `fetch`와 WebSocket만 씁니다.
- 어댑터를 만들면 `src/data/index.ts`의 `pick()`에서 `api`일 때 `createApiSource()`를 돌려주도록 한 줄을 바꿉니다.

### 3.2 공통으로 맞출 것

| 항목 | 백엔드 (v3.1, v3.2 예정) | 어댑터가 할 일 |
|---|---|---|
| 인증 | `POST /api/auth/login` → `accessToken`, 이후 `Authorization: Bearer <token>` | 토큰을 저장하고 모든 요청 헤더에 붙임. 401이면 로그인 화면으로 (계약의 `login`·`logout`) |
| 시간 | ISO-8601 KST (`+09:00`) | 그대로 씀 |
| 목록 | `{ items, total, page, size }`, page는 1부터 (v3.2에서 맞춰 줌) | 그대로 씀 |
| 오류 | `{ status, code, message, timestamp }` | 저장 계열은 `{ ok: false, error: message }`로 바꿈 |
| 식별자·코드 | 라인 `A~F`, 설비 `A-PR1`, 공정 `PRESS`, 사유 `UP_ALARM`, 상태 `R/S/I/D/DC` | 프론트도 같은 값을 씀 (변환 없음) |
| 관리값 항목 | `pressureLeft` 등 camelCase | 그대로 씀. 화면 이름은 `src/lib/metrics.ts` |

### 3.3 실시간 (WebSocket STOMP)

| 백엔드 채널 | 계약 | 어댑터가 할 일 |
|---|---|---|
| `/topic/status` (W-01, 바뀐 설비만) | `live.onSnapshot` (1초, 39대 전체) | 처음 `GET /api/monitoring/status`(M-01)로 39대를 채우고, W-01이 올 때마다 그 설비만 바꿔 끼운 스냅샷을 내보냄. 라인별 실적은 `GET /api/production/counts?groupBy=line`(M-07)을 주기 조회 |
| `/topic/alarms` (W-02) | `live.onAlarm` | 관리값 이탈 알람. 고장 전체(장비고장·안전문제 포함) 알림은 W-01 상태가 D로 바뀌는 것도 함께 봄 |
| `/topic/production` (W-03) | `live.onSummary` 일부 | 오늘 누적 수량. 목표·OEE·재공은 U-01·M-13·G-02 주기 조회로 채움 |
| `/topic/metrics/{equipmentId}` (W-04, P2) | `live.onTelemetry` | 고른 설비의 새 관리값 |

- 연결이 끊기면 REST(M-01, M-04, M-07)로 다시 채우고 재구독합니다 (백엔드 명세).
- STOMP 클라이언트 라이브러리(예: `@stomp/stompjs`)가 필요합니다. **라이브러리 추가는 팀 확인 후** (CLAUDE.md 규칙).

### 3.4 화면별 API 대응

계약 함수마다 어떤 백엔드 API로 채우는지, 백엔드에 없는 것은 무엇인지는 [`docs/API-차이-v3.1.md`](docs/API-차이-v3.1.md) 4장 표에 있습니다. 요약:

| 화면 | 백엔드 API | 비고 |
|---|---|---|
| 대시보드·라인 상세 | M-01, M-07, M-13, U-01, U-08, W-01~03 | 시간대별 생산 누적 API는 요청 중 |
| 공정 상세 | M-12, M-03, M-07, M-13, U-03, U-08, U-09, M-08 | 도장 경로 전환 M-09 |
| 가동률 | U-01~05, U-07, U-12 | OEE 필드·`lineYield`는 v3.2 |
| 알람·비가동 이력 | U-08, U-09 | 메일·슬랙 발송 결과 필드는 요청 중 |
| 생산 조회 | G-01, M-07, U-11 | 제품 내역 API는 요청 중 |
| 설정 | G-02·G-03(P2), M-10·M-11 | |
| 예지보전·리포트 | (없음) | 차순위. 중간발표 뒤 |

### 3.5 연결 순서 (권장)

1. `api/http.ts`: 기본 주소·토큰 헤더·오류 변환 (`fetch` 감싸기)
2. 로그인 `login`·`logout` → 로그인 화면에서 확인
3. `getMaster` (C-04 라인, C-05 설비, M-10 기준치) → 모든 화면의 기준
4. 대시보드: `live.onSnapshot`(M-01 + W-01), `getTodayStateEvents`(U-08)
5. 공정 상세 → 가동률 → 알람 이력 → 생산 조회 → 설정 순
6. 백엔드에 없는 함수는 어댑터에서 빈 값(`[]`, `null`)을 돌려주고 화면은 "데이터 없음"으로 둠

### 3.6 확인

- `VITE_DATA_SOURCE=api npm run dev`로 띄우고, 화면 오른쪽 위 "데모 데이터" 표시가 사라졌는지 봅니다 (`DataSource.demo = false`).
- 백엔드 없이 프론트만 볼 때는 `mock`으로 돌아가면 됩니다.

## 4. 폴더

```
src/
  types/        데이터 모양 (데이터정의서·백엔드 명세 기준)
  data/         계약 + 구현 (mock / api)
  lib/          순수 함수 (상태 이름·순서, 숫자·시간 형식, 관리값 이름)
  composables/  화면 상태 (조회·구독·계산)
  components/   base(기본) · charts(그래프) · domain(업무 부품)
  layouts/      화면 틀 (상단 메뉴·제목 줄)
  pages/        화면 (ScrNNN = 화면정의서 화면 ID)
  styles/       토큰(tokens.css)·상태 색(state.css)
```
