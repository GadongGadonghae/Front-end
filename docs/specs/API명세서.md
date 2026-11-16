# API 명세서

| 버전 | 일자 | 변경내용 |
|---|---|---|
| 0.1 | 2026-11-13 | 골격 생성 |
| 0.2 | 2026-11-16 | 초안 작성: 실시간 웹소켓 채널(메시지·주기·구독), REST 조회·저장 API 전체, 화면별 호출·갱신 주기 |

> 표기: `[제안]` 프론트가 제안하는 형식으로 백엔드와 확인이 필요함, `[가정]` 확인 전 가정, `D-xx` 결정사항 (`../인터뷰/02_결정사항_미결.md`).
> 근거: 데이터정의서 7장 "화면별 필요 데이터"와 "API는 크게 두 갈래". 백엔드 기술은 미결(Q-12)이라 이 문서는 **프론트가 필요로 하는 계약**을 적는다.

---

## 1. 공통

| 항목 | 내용 |
|---|---|
| Base URL | REST `/api/v1`, 실시간 `/ws` (같은 서버·같은 도메인) [제안] |
| 인증 | 로그인하면 서버가 세션 쿠키(HttpOnly)를 준다. 7일 유지, 자동 로그아웃 없음 (D-75). 웹소켓도 같은 쿠키로 인증 [제안] |
| 시간 표기 | ISO 8601, 한국 시간 오프셋 포함 (`2026-11-16T14:32:08+09:00`). 날짜만은 `YYYY-MM-DD`. 하루 = 00:00~24:00 (A-07, D-42) |
| 빈 값 | 값이 없으면 `null` (0과 구분). 화면은 숫자 "-", 그래프·목록 "데이터 없음"으로 표시 (D-78). 예: 부하시간 0이면 OEE `null` |
| 수량·비율 | 수량은 정수. 비율은 **퍼센트 숫자**(61.8 = 61.8%), 소수 1자리 |
| ID | 라인 `L1`~`L6`, `PT`(도장 라인), 공용 구역 `CM`. 공정 `A`~`F`. 설비 `L3-PRS-2`, `L3-SLT`, `L3-WLD`, `PT-PNT-1`, `CM-VIS`. 제품 `L3-20261116-0412` (데이터정의서 4.3) |
| 상태·코드 | 상태 `R` `S` `I` `D`. 비가동 코드 `planned`(계획정지) `setup`(계획정지(셋업)) `starved`(재공부족) `blocked`(작업지연) `fault`(장비고장) `fault-alarm`(장비고장(알람)) `safety`(안전문제). 화면 이름은 프론트가 붙인다 |
| 목록 응답 | `{ "items": [...], "total": 802, "page": 1, "size": 50 }`. 페이지는 50건 (D-66) |
| 기간 조회 | `from`, `to` (날짜, 둘 다 포함). 최대 31일 (D-64). 넘으면 400 |
| 에러 | `{ "error": { "code": "TARGET_DATE_LOCKED", "message": "지난 날짜는 수정할 수 없습니다" } }` + HTTP 상태 (아래) |

| HTTP | 언제 | code 예 |
|---|---|---|
| 400 | 파라미터 잘못 (기간 31일 초과 등) | `RANGE_TOO_LONG`, `BAD_PARAM` |
| 401 | 로그인 안 함·세션 만료 → 프론트는 로그인 화면으로 | `UNAUTHORIZED` |
| 404 | 없는 설비·보고서·제품 | `NOT_FOUND` |
| 409 | 지난 날짜 목표 수정 (D-71) | `TARGET_DATE_LOCKED` |
| 422 | 하한 > 상한 (FN-015), 메모 길이 초과 | `LIMIT_ORDER`, `MEMO_TOO_LONG` |

---

## 2. 전송 방식: 실시간은 웹소켓 1개, 나머지는 REST

| 방식 | 장점 | 한계 | 쓰는 곳 |
|---|---|---|---|
| **웹소켓** `/ws` [제안] | 서버가 바로 보냄. 양방향이라 화면이 "이 설비 값만" 구독·해제를 바꿀 수 있음 | 연결 관리(재연결·하트비트) 필요 | 1초 상태, 이벤트, 선택 설비 관리값 |
| SSE | 단순, 자동 재연결 | 서버→화면 한 방향. 구독 대상을 바꾸려면 연결을 새로 열어야 함 | 쓰지 않음 (대안으로만) |
| 주기 조회(polling) | 가장 단순 | 39대 × 1초 요청이 너무 많고 고장 알림이 늦음 | 쓰지 않음 |
| REST | 캐시·재시도·페이지가 쉬움 | 실시간 아님 | 기간 조회, 목록, 저장 |

- 브라우저가 MQTT 브로커에 직접 붙지 않는다. MQTT는 Node-RED ↔ 백엔드 구간에서만 쓰고, 화면에는 백엔드가 웹소켓으로 다시 보낸다 (데이터정의서 1장).
- 웹소켓이 끊긴 동안은 화면 값이 멈춘 것을 알 수 있게 표시하고, 다시 연결되면 아래 3.4대로 복구한다.

---

## 3. 실시간 채널 (웹소켓 `/ws`)

### 3.1 무엇을 언제 보내나 — 주기 표

| 메시지 `type` | 내용 | 보내는 때 | 주기 | 구독 주제 | 쓰는 화면 |
|---|---|---|---|---|---|
| `snapshot` | 설비 39대 현재 상태(상태·코드·상세·시작 시각·예지보전 최고 항목), 공장·라인 오늘 실적(출고 양품), 입고 코일 수·슬리팅 앞 재고 | 구독 직후 1회 + 계속 | **1초** (D-38) | `plant` | 헤더, 001, 010, 002-x, 005 |
| `summary` | 오늘 목표·실적·달성률, 공장 OEE·3요소, 품질(공정별 불량·출고 양품·불량·불량률), 라인별 계획·실적·OEE·불량 제외·공정 사이 재공 | 구독 직후 1회 + 계속 | **10초** [제안]. 계산이 무겁고 1초마다 바뀔 값이 아님 | `plant` | 001, 010, 002-x |
| `product.move` | 제품이 다음 설비로 넘어감 (제품 ID, 출발·도착 설비, 불량 제외 여부) | 생산 이벤트 발생 시 | **이벤트**. 1초 안에 생긴 것을 배열로 묶어 보냄 [제안] (공장 전체 초당 약 0.4건) | `plant` | 001(물류 점, D-81), 010 |
| `alarm.raised` | 상태 이력 시작 (R이 아닌 상태가 됨): 설비·상태·코드·상세·시작 시각, 고장이면 보고서 가능 | 상태가 바뀌는 즉시 | **이벤트**, 지연 1초 안 | `plant` | 헤더 알림 개수, 001 알림 열, 토스트(D만, FN-005), 006 진행 중 건 |
| `alarm.cleared` | 상태 이력 종료: 같은 건의 종료 시각 | 상태가 R로 돌아오는 즉시 | **이벤트** | `plant` | 위와 같음 |
| `risk.changed` | 예지보전 위험(90%) 진입·해제 (DT-020) | 등급이 바뀌는 즉시 | **이벤트** | `plant` | 001 알림 열(D-60), 006 위험 탭 |
| `risk` | 관리값 있는 설비 38대의 항목별 위험도(%) | 구독 직후 1회 + 계속 | **5초** [제안]. 위험도는 최근 10분 평균이라 1초마다 바뀌지 않음 (D-58) | `risk` | 004 |
| `telemetry` | 선택한 설비 1대의 관리값 새 값 (그래프 끝에 이어 붙임) | 원천 값이 들어올 때마다 | 설비마다 다름: 슬리터 **1초**, 도장 **5초**, 프레스·용접 **사이클마다**(약 120초), 비전 없음 (데이터정의서 4.1) | `telemetry:{설비ID}` | 002-2~5 관리값 그래프, 004 추이 |
| `inverter` | 실설비 슬리터의 운전 상태·지령/출력 주파수·RPM·최근 트립 | 계속 | **1초** | `telemetry:L1-SLT` | 002-2 (실설비만, D-43) |

- **헤더 시계**는 서버가 보내지 않는다. 화면이 자기 시계로 1초마다 그린다. 지속시간은 `since`(시작 시각)와 화면 시계로 계산하므로 1초 `snapshot`이 잠깐 늦어도 흐른다.
- 3D 공장(SCR-005)은 `snapshot`을 그대로 쓴다. 따로 보내지 않는다.

### 3.2 연결과 구독

```jsonc
// 화면 → 서버: 구독 (화면을 옮길 때 필요한 주제만 다시 보낸다)
{ "op": "subscribe", "topics": ["plant", "telemetry:L2-PRS-3"] }
{ "op": "unsubscribe", "topics": ["telemetry:L2-PRS-3"] }
// 서버 → 화면: 모든 메시지는 같은 봉투
{ "type": "snapshot", "at": "2026-11-16T14:32:08+09:00", "data": { ... } }
```

| 주제 | 언제 구독 | 받는 메시지 |
|---|---|---|
| `plant` | 로그인 후 앱이 켜져 있는 동안 항상 (헤더 알림·토스트 때문) | `snapshot`, `summary`, `product.move`, `alarm.*`, `risk.changed` |
| `risk` | 예지보전 화면을 연 동안 | `risk` |
| `telemetry:{설비ID}` | 공정 상세·예지보전에서 설비를 선택한 동안 (한 번에 1대) | `telemetry` (슬리터 실설비는 `inverter`도) |

- 하트비트: 서버가 30초마다 `{ "type": "ping" }`, 화면은 `{ "op": "pong" }` [제안]. 60초 동안 아무것도 안 오면 화면이 끊긴 것으로 보고 다시 연결.
- 인증 실패·세션 만료: 서버가 코드 `4401`로 닫는다 → 화면은 로그인 화면으로.

### 3.3 메시지 형식

**`snapshot` (1초)**
```json
{
  "type": "snapshot",
  "at": "2026-11-16T14:32:08+09:00",
  "data": {
    "equipment": [
      { "id": "L2-PRS-3", "state": "D", "code": "fault-alarm", "detail": "Pressure 1 상한 초과 (356 / 350)",
        "since": "2026-11-16T14:20:12+09:00", "pdm": null },
      { "id": "L5-PRS-2", "state": "R", "code": null, "detail": null,
        "since": "2026-11-16T10:29:53+09:00", "pdm": { "level": "danger", "item": "Pressure 1", "percent": 92 } }
    ],
    "plant": { "done": 742 },
    "lines": [ { "lineId": "L1", "done": 131 }, { "lineId": "PT", "done": 751 } ],
    "inbound": { "today": 24, "stock": 37 }
  }
}
```
- `equipment`는 39대 전부를 매번 보낸다 (약 6KB/초) [제안]. 나중에 바뀐 것만 보내는 방식으로 줄일 수 있다.
- `pdm`은 80% 이상인 가장 높은 항목 하나, 아니면 `null` (D-59).

**`summary` (10초)**
```json
{
  "type": "summary",
  "at": "2026-11-16T14:32:00+09:00",
  "data": {
    "plant": {
      "target": 1200, "done": 742, "rate": 61.8,
      "oee": { "oee": 78.4, "availability": 89.1, "performance": 92.0, "quality": 95.6 },
      "quality": { "ngByProcess": { "B": 4, "C": 11, "D": 6, "E": 3 }, "outbound": { "inspected": 751, "ok": 742, "ng": 9, "rate": 1.2 } }
    },
    "lines": [
      { "lineId": "L2", "plan": 200, "done": 108, "rate": 54.0, "oee": 68.9,
        "ngByProcess": { "B": 1, "C": 3, "D": 3 },
        "wip": [ { "from": "B", "to": "C", "qty": 6 }, { "from": "C", "to": "D", "qty": 0 } ] }
    ]
  }
}
```
- 오늘 목표가 없으면 `target`·`rate`·라인 `plan`은 `null` → 화면은 "목표 미설정" (D-72).
- 라인 계획 = 목표 ÷ 가동 라인 수 (D-87). 도장 라인 계획 = 목표 전체.

**`alarm.raised` / `alarm.cleared`**
```json
{
  "type": "alarm.raised",
  "at": "2026-11-16T14:20:12+09:00",
  "data": {
    "id": "EV-20261116-0031", "equipmentId": "L2-PRS-3", "state": "D", "code": "fault-alarm",
    "detail": "Pressure 1 상한 초과 (356 / 350)", "start": "2026-11-16T14:20:12+09:00", "end": null,
    "memo": null, "memoBy": null, "memoAt": null, "reportId": null
  }
}
```
- 같은 `id`로 `alarm.cleared`가 오면 `end`가 채워져 있다. 형식은 상태 이력(5.6)과 같다.

**`product.move`**
```json
{ "type": "product.move", "at": "2026-11-16T14:32:08+09:00",
  "data": [ { "productId": "L3-20261116-0412", "from": "L3-PRS-2", "to": "L3-PRS-3", "rejected": false } ] }
```
- 공정 검사 불량이면 `rejected: true`, `to: null` → 화면은 그 자리에서 점을 지운다 (D-88).

**`risk` (5초)**
```json
{ "type": "risk", "at": "...", "data": [
  { "equipmentId": "L5-PRS-2", "items": [ { "item": "Pressure 1", "percent": 92 }, { "item": "Pressure 5 (합계)", "percent": 78 } ] }
] }
```

**`telemetry`**
```json
{ "type": "telemetry", "at": "...", "data": { "equipmentId": "L2-PRS-3", "values": [
  { "t": "2026-11-16T14:20:10+09:00", "item": "Pressure 1", "value": 356.0 },
  { "t": "2026-11-16T14:20:10+09:00", "item": "Press time", "value": 551 }
] } }
```

### 3.4 끊겼다 다시 연결될 때

1. 다시 `subscribe` → 서버가 `snapshot`·`summary`(·`risk`)를 바로 1회 보냄.
2. 끊긴 동안 놓친 알람은 웹소켓으로 다시 보내지 않는다. 화면이 REST `GET /state-events/today`(API-022)를 다시 불러 맞춘다.
3. 관리값 그래프는 REST `GET /equipment/{id}/telemetry`(API-040)로 빈 구간을 다시 채운다.

---

## 4. REST API 목록

"다시 부르는 때" = 화면이 이 API를 언제 다시 호출하는지. 실시간 값은 3장 웹소켓이 맡으므로 REST는 처음 열 때와 조건이 바뀔 때만 부른다.

### 4.1 공통·기준정보

| ID | 메서드 | 경로 | 설명 | FN | 화면 | 다시 부르는 때 |
|---|---|---|---|---|---|---|
| API-001 | POST | `/auth/login` | 로그인. 성공하면 세션 쿠키 | FN-016 | 000 | - |
| API-002 | POST | `/auth/logout` | 로그아웃 | FN-016 | 헤더 | - |
| API-003 | GET | `/auth/me` | 지금 로그인한 사용자 (없으면 401) | FN-016 | 앱 시작 | 앱 시작 1회 |
| API-010 | GET | `/master` | 기준정보: 라인·공정·설비 39대·설비 종류(표준CT)·비가동 코드 | - | 전 화면 | 앱 시작 1회 |

### 4.2 대시보드 SCR-001 · 라인 상세 SCR-010
실시간 값은 웹소켓 `snapshot`(1초)·`summary`(10초)·`alarm.*`.

| ID | 메서드 | 경로 | 설명 | FN | 화면 | 다시 부르는 때 |
|---|---|---|---|---|---|---|
| API-020 | GET | `/today/hourly?lineId=` | 오늘 시간대별 생산(1시간 단위 누적 실적, 계획선). `lineId` 없으면 공장 | FN-003 | 001, 010 | 열 때 + **매시 정각** (지금 시간대의 끝점은 `snapshot`의 실적으로 이어 그림) |
| API-022 | GET | `/state-events/today?area=` | 오늘 상태 이력(알림 열). 진행 중 위·최근순. `area`=라인 ID면 그 라인만 | FN-005, 006 | 헤더, 001, 010 | 열 때 + 웹소켓 재연결 때 (그 사이는 `alarm.*`로 이어 붙임) |
| API-023 | GET | `/risk-events/today` | 오늘 예지보전 위험(90%) 진행 중·해제 건 (알림 열에 함께 표시, D-60) | FN-007 | 001 | 열 때 + 재연결 때 (그 사이는 `risk.changed`) |

### 4.3 공정 상세 SCR-002-1~6

| ID | 메서드 | 경로 | 설명 | FN | 화면 | 다시 부르는 때 |
|---|---|---|---|---|---|---|
| API-030 | GET | `/lines/{lineId}/processes/{process}/today` | 공정 요약: 오늘 생산·양품, 공정 OEE, 앞·뒤 재공, 설비별 오늘 사이클 수·평균 CT(가장 느린 단 표시용), 도장은 라인별 받은 수 | FN-003, 004 | 002-2~5 | 열 때 + **30초마다** [제안] |
| API-040 | GET | `/equipment/{id}/telemetry?items=&range=1h\|8h\|today` | 관리값 추이 (그래프 처음 그리기). 응답에 그 항목의 하한·상한 포함 | FN-001 | 002-2~5, 004 | 설비·항목·범위를 바꿀 때 + 재연결 때 (그 사이는 `telemetry`) |
| API-041 | GET | `/state-events?equipmentId=&from=&to=` | 선택 설비의 비가동 이력 (오늘) — API-070과 같은 API | FN-006 | 002-x | 설비를 바꿀 때 (진행 중 건은 `alarm.*`) |
| API-042 | PUT | `/state-events/{id}/memo` | 조치 메모 저장·수정. 담당자 = 로그인 사용자 자동 (D-84) | FN-006 | 002-x, 006 | - |
| API-043 | GET | `/inspections/today?lineId=&process=` | 공정 검사: 오늘 검사 수·불량 수·불량률 + 불량 목록(시각·제품 ID·설비·사유) | FN-017 | 002-2~6 | 열 때 + **30초마다** [제안] |
| API-044 | GET | `/microstops/today?equipmentId=` | 미세정지 건수·손실시간·사이클타임 분포 [차순위] | FN-011 | 002-x | 열 때 + 30초마다 |
| API-045 | GET | `/inbound/today` | 코일입고: 오늘 입고 기록(시각·코일 수), 슬리팅 앞 재고 추이(라인별), 오늘 투입 | FN-001 | 002-1 | 열 때 + **1분마다** [제안] |

### 4.4 가동률 SCR-003

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-050 | GET | `/oee?period=day\|week\|month&date=&lineId=&process=&equipmentId=` | OEE·3요소, 라인별(또는 선택 라인의 공정별) OEE 막대, 비가동 코드별 시간·건수, 주·월이면 일별 OEE 추이 | FN-004 | 조건 바꿀 때 + 오늘이면 **1분마다** [제안] |
| API-051 | GET | `/state-timeline?date=&lineId=&process=&equipmentId=` | 00~24시 상태 구간 (라인 대표 상태 또는 설비별) | FN-004 | 조건 바꿀 때 + 오늘이면 1분마다 |

### 4.5 예지보전 SCR-004

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-060 | GET | `/pdm/risks` | 38대 항목별 위험도(%) 처음 목록 (이후 웹소켓 `risk` 5초) | FN-007 | 열 때 + 재연결 때 |
| API-040 | GET | `/equipment/{id}/telemetry?range=8h` | 선택 설비 관리값 추이 + 상·하한 (위 4.3과 같은 API) | FN-007 | 설비·범위 바꿀 때 |
| API-061 | GET | `/pdm/eta?equipmentId=` | 상한 도달 예상 시간 [차순위] | FN-007 | 설비 바꿀 때 + 1분마다 |

### 4.6 알람·비가동 이력 SCR-006

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-070 | GET | `/state-events?from=&to=&lineId=&process=&state=D,I&code=&ongoing=&page=&size=50` | 이력 표. 기본 오늘·D·I (D-64). 발송 결과(이메일·슬랙 성공/실패) 포함 | FN-006 | 필터·페이지 바꿀 때 (진행 중 건의 지속시간은 화면 시계, 해제는 `alarm.cleared`) |
| API-042 | PUT | `/state-events/{id}/memo` | 조치 메모 (위와 같음) | FN-006 | - |
| API-071 | GET | `/risk-events?from=&to=&lineId=&page=&size=50` | 예지보전 위험 탭 (D-65) | FN-007 | 필터·페이지 바꿀 때 |

### 4.7 리포트 SCR-007

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-080 | GET | `/reports/daily?date=` | 일일 생산 리포트: 라인별 계획·실적·달성률·OEE·불량 제외, 공정별 생산·불량, 비가동 코드별 시간·건수, 재공품, OEE 요약 | FN-008 | 날짜 바꿀 때 (지난 날짜는 마감 값) |
| API-081 | POST | `/replan-reports` `{ "stateEventId": "..." }` | 계획수정 보고서 만들기: 그 시점 기준으로 계산해 저장 (D-68). 고장(D) 건만 | FN-009 | - |
| API-082 | GET | `/replan-reports?from=&to=` | 날짜별 보고서 목록 | FN-009 | 열 때 + 만든 직후 |
| API-083 | GET | `/replan-reports/{id}` | 보고서 내용: 발생, 부족 수량, 라인별 추가 배정 표, 결과 | FN-009 | 목록에서 고를 때 |
| API-084 | GET | `/replan-reports/{id}/pdf` | PDF 다운로드 (`application/pdf`) | FN-009 | - |

### 4.8 설정 SCR-008 · SCR-009

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-090 | GET | `/targets?from=&to=` | 날짜별 목표·라인 계획·실적·달성률 목록 | FN-014 | 열 때 + 저장 직후 |
| API-091 | PUT | `/targets/{date}` `{ "quantity": 1200 }` | 하루 목표 저장(같은 날 덮어씀). 지난 날짜면 409 (D-71) | FN-014 | - |
| API-092 | GET | `/control-limits?type=` | 설비 종류별 관리값 항목·단위·하한·상한·마지막 수정 시각·수정자 | FN-015 | 종류 바꿀 때 + 저장 직후 |
| API-093 | PUT | `/control-limits/{type}` `[{ "item", "lower", "upper" }]` | 저장. 하한 > 상한이면 422. 저장 즉시 판정·위험도에 반영 (D-28) | FN-015 | - |

### 4.9 생산 조회 SCR-011

| ID | 메서드 | 경로 | 설명 | FN | 다시 부르는 때 |
|---|---|---|---|---|---|
| API-100 | GET | `/production/summary?period=day\|week\|month&from=&to=&lineId=` | 계획·실적·달성률·투입(진행 중)·불량 제외(공정별), 라인별 계획 대비, 추이(일: 시간대별 누적, 주·월: 일별) | FN-018 | 조건 바꿀 때 + 오늘이면 **1분마다** [제안] |
| API-101 | GET | `/products?from=&to=&lineId=&result=&q=&page=&size=50` | 제품 내역 (최근순). `result`=all\|ok\|ng\|wip. 90일 넘은 기간은 빈 목록 (D-86) | FN-018 | 조건·페이지 바꿀 때 |
| API-102 | GET | `/products/{productId}` | 제품 1개 공정별 기록: 공정·설비·통과 시각·검사 판정·불량 사유 | FN-018 | 행을 펼칠 때 |

---

## 5. 주요 응답 형식

### 5.1 API-010 기준정보
```json
{
  "lines": [ { "id": "L1", "name": "L1", "kind": "production", "order": 1 }, { "id": "PT", "name": "도장", "kind": "paint", "order": 7 } ],
  "processes": [ { "id": "A", "name": "코일입고", "order": 1 } ],
  "equipmentTypes": [ { "code": "press", "name": "프레스", "standardCtSec": 120 } ],
  "equipment": [ { "id": "L3-PRS-2", "area": "L3", "process": "C", "order": 2, "type": "press", "name": "L3 프레스 2단", "shortName": "2단", "real": false } ],
  "downtimeCodes": [ { "code": "fault-alarm", "name": "장비고장(알람)", "state": "D" } ]
}
```

### 5.2 API-020 시간대별 생산
```json
{ "date": "2026-11-16", "lineId": null, "target": 1200,
  "hours": [ { "hour": 0, "done": 48, "cumulative": 48, "planCumulative": 50 }, { "hour": 14, "done": 38, "cumulative": 742, "planCumulative": 725 } ] }
```
- 계획선 = 목표 × 지난 부하시간 비율 [가정] (FN-003). 목표 없으면 `target`·`planCumulative` = `null`.

### 5.3 API-030 공정 요약 (프레스 예)
```json
{ "lineId": "L2", "process": "C", "output": 118, "good": 115, "oee": 70.2,
  "wip": { "before": 6, "after": 0 },
  "equipment": [ { "id": "L2-PRS-1", "cycles": 124, "avgCtMs": 548 }, { "id": "L2-PRS-2", "cycles": 122, "avgCtMs": 582, "slowest": true } ] }
```

### 5.4 API-040 관리값 추이
```json
{ "equipmentId": "L2-PRS-3", "range": "1h",
  "items": [ { "item": "Pressure 1", "unit": "", "lower": 200, "upper": 350,
    "points": [ { "t": "2026-11-16T13:32:00+09:00", "value": 291.2 } ] } ] }
```
- 기준이 미정인 항목(슬리터 등)은 `lower`·`upper` = `null` → 화면은 선을 그리지 않고 "기준 미정"을 표시 (데이터정의서 3.1).
- 8시간·오늘 범위는 서버가 1분 평균 등으로 줄여 보낸다 [제안] (최대 약 1,500점).

### 5.5 API-043 공정 검사
```json
{ "lineId": "L2", "process": "C", "inspected": 118, "ng": 3, "rate": 2.5,
  "defects": [ { "t": "2026-11-16T14:19:58+09:00", "productId": "L2-20261116-0118", "equipmentId": "L2-PRS-3", "reason": "Pressure 1 상한 이탈 (353)" } ] }
```

### 5.6 상태 이력 (API-022, 041, 070 공통, DT-013·014)
```json
{
  "id": "EV-20261116-0019", "equipmentId": "L6-WLD", "state": "D", "code": "safety", "detail": "비상정지 (BX)",
  "start": "2026-11-16T11:42:19+09:00", "end": "2026-11-16T11:48:31+09:00",
  "memo": "안전 펜스 센서 점검 후 복귀", "memoBy": "이민재", "memoAt": "2026-11-16T11:52:00+09:00",
  "notify": { "email": { "ok": true, "at": "..." }, "slack": { "ok": false, "at": "..." } },
  "reportId": null
}
```
- 지속시간은 보내지 않는다. 화면이 `start`·`end`(진행 중이면 화면 시계)로 계산한다.
- `notify`는 고장(D) 건만. 그 외 `null` (FN-005).

### 5.7 API-042 조치 메모
- 요청 `{ "memo": "버너 출력 조정" }` (한 줄, 최대 200자 [제안]). 빈 문자열이면 메모 삭제.
- 응답: 갱신된 상태 이력 1건 (5.6). `memoBy`는 서버가 세션 사용자로 채운다.

### 5.8 API-083 계획수정 보고서
```json
{
  "id": "RP-20261116-01", "createdAt": "2026-11-16T14:24:31+09:00", "createdBy": "김현수",
  "cause": { "stateEventId": "EV-20261116-0031", "lineId": "L2", "equipmentId": "L2-PRS-3", "start": "2026-11-16T14:20:12+09:00", "code": "fault-alarm", "detail": "Pressure 1 상한 초과 (356 / 350)" },
  "shortage": { "remainingSec": 34529, "qty": 92 },
  "allocation": [ { "lineId": "L1", "remainingPlan": 69, "capacity": 218, "ratio": 20.4, "added": 19 } ],
  "result": { "achievable": true, "expectedShortfall": 0 }
}
```
- 계산 규칙은 기능명세서 FN-009. 도장 설비 고장은 `allocation`이 다른 도장 1대, 비전 고장은 빈 배열 + 출고 전량 미달 (A-13).

---

## 6. 화면별 사용 요약

| 화면 | 웹소켓 (주기) | REST (처음·조건 변경) | REST 주기 갱신 |
|---|---|---|---|
| 공통 헤더 | `plant`: `alarm.*` (이벤트) | API-003, 010, 022 | - |
| 001 대시보드 | `snapshot` 1초, `summary` 10초, `product.move`·`alarm.*`·`risk.changed` 이벤트 | API-020, 022, 023 | API-020 매시 정각 |
| 010 라인 상세 | `snapshot` 1초, `summary` 10초, `product.move`·`alarm.*` | API-020(lineId), 022(area) | API-020 매시 정각 |
| 002-1 코일입고 | `snapshot`의 `inbound` 1초 | API-045 | 1분 |
| 002-2~5 공정 상세 | `snapshot` 1초, `telemetry:{선택 설비}` (슬리터 1초·도장 5초·프레스·용접 사이클마다), 슬리터 실설비 `inverter` 1초 | API-030, 040, 041, 043, 044 | API-030·043·044 30초 |
| 002-6 출고 | `snapshot` 1초 | API-043(process=F), 041 | 30초 |
| 003 가동률 | - | API-050, 051 | 오늘이면 1분 |
| 004 예지보전 | `risk` 5초, `telemetry:{선택 설비}` | API-060, 040, 061 | API-061 1분 |
| 005 3D | `snapshot` 1초 (001과 같음) | - | - |
| 006 알람·비가동 이력 | `alarm.*` (진행 중 건 해제) | API-070, 071, 042 | - |
| 007 리포트 | - | API-080, 081~084 | - |
| 008·009 설정 | - | API-090~093 | - |
| 011 생산 조회 | - | API-100, 101, 102 | 오늘이면 API-100 1분 |

---

## 7. 확인이 필요한 것

| 항목 | 지금 제안 | 확인할 사람 |
|---|---|---|
| 실시간 방식 | 웹소켓 1개 + REST (SSE는 대안) | 백엔드 (Q-12와 함께) |
| `snapshot` 크기 | 39대 전체를 1초마다 (약 6KB/초). 바뀐 것만 보내기는 나중에 | 백엔드 |
| `summary` 주기 | 10초 | 백엔드·PM |
| `risk` 주기 | 5초 | 백엔드 |
| REST 주기 갱신 | 공정 요약·검사 30초, 가동률·생산 조회·입고 1분, 시간대별 생산 매시 정각 | PM |
| 관리값 추이 줄이기 | 8시간·오늘은 1분 평균, 최대 약 1,500점 | 백엔드 |
| 세션 방식 | HttpOnly 쿠키 7일 (D-75) | 백엔드 |
| 조치 메모 길이 | 200자 | PM |
| 웹소켓 끊김 표시 | 화면에 "연결 끊김"과 마지막 갱신 시각 표시, 자동 재연결 | 프론트·PM |
