# SFaaS API 명세서 v3.1

> 기준본: API 명세서 아티팩트(https://claude.ai/artifact/TFF4RzC1MZqwoATAQZYVmx, 2026-11-17 팀 결정 반영)와 같은 내용입니다. v3.1은 v3에서 API 주소의 버전(`/v1`)만 뺀 판입니다(API 개수·요청·응답은 그대로). Notion v0.2는 더 이상 기준이 아닙니다. 명세에 없는 내용은 추가하거나 추측하지 않았고, 적혀 있지 않은 항목(자료형, 필수 여부, 엔드포인트별 오류 코드, 엔드포인트별 인증 여부)은 "명세에 없음"으로 표시했습니다.

## 🔄 변경 요약 (v0.1 → v2 → v3 → v3.1)

| 구분 | 이전 | v2 |
| --- | --- | --- |
| 💾 저장 단위 | equipment_metric 5초 평균만 저장 | 사이클(제품) 1건 = 1행, 공정별 4개 테이블에 전부 저장. 5초 평균은 조회·집계 때만 계산 |
| 🧪 공정 불량 | 검사 불합격 + 직전 알람이면 NG_PROCESS | 공정마다 result(OK/NG) 판정, NG면 그 공정에서 폐기 |
| 🔍 검사 판정 | OK · OK_RECHECK · NG_PROCESS · NG_VISION | 비전 OK / NG 두 가지만 (재검 구분 없음) |
| ⛔ 비가동 코드 | 영문 코드 | 영문 코드 유지. 관리값 이탈 알람은 UP_ALARM으로 분리(DB와 동일). 비가동은 전부 저장, 조회 시 1분 이상만 |
| ➕ 추가 | - | 재배정 보고서 R-01~02(계획서 작성까지), 계획정지 S-01~03(일정표 없이 시작·종료), alarm 테이블, users 컬럼(email, memo, lastLoginAt). REST 36 → 41개 |
| 🎨 도장 경로 | P2 (중간발표 이후) | P1로 올림: M-09, Q-03, M-08 paintId, M-07 groupBy=paint |
| 🕘 시간대 | +09:00 | 백엔드 Asia/Seoul 고정 |
| 🛠️ 오후 수정 | M-10 응답에 equipmentId 없음 · 상태값 DC 없음 · 조치 담당자를 이름(actionBy)으로 받음 | M-10에 equipmentId 추가(기준치가 설비별) · 상태값 DC(통신 끊김) 5번째로 추가(R/S/I/D/DC, 우선순위 D > DC > S > I > R) · U-08·U-09 조치 담당자는 번호(actionUserId)로 받고 응답에 이름(actionUserName) 추가 |
| 🟣 [v3] DC 처리 | 임시로 비계획정지(UP_ETC) | 가동(R)으로 계산. 통신만 끊겼고 설비는 돌고 있을 수 있어서예요. 비가동 이력·사유는 만들지 않아요 |
| 🟡 [v3] I(대기) 판정 | 슬리터 runCoil=0 등 | 재공품이 없어서 대기(앞 공정에서 올 제품이 없는 상태). 사유는 UP_SHORTAGE로 자동 |
| 📦 [v3] COIL 공정 | 공정 코드 5개 | 6개(COIL 코일입고 추가). M-13에 코일입고 → 슬리팅 재공품 포함 |
| 🔁 [v3] 재배정 승인 | R-03 승인 API 논의 | 승인 API 없음. DB 승인 칸(approved 등)은 만들어 두고 비워 둠 |
| 🧾 [v3] 설비 목록·채팅 | C-05 dataSource, 채팅 P3 | dataSource 삭제 · 채팅(H-01·H-02) P2 (DB에 채팅 테이블 추가) |
| 🔩 [v3] 슬리팅 항목 | runCoil · lineSpeed 등(임시) | torque · current · voltage (DB slitting_data와 동일) |
| 💓 [v3] DC 판정 기준 | 값이 10초 이상 안 들어오면 DC | 설비가 1초마다 상태 신호(heartbeat, Q-04)를 보내고, 그 신호가 10초 이상 끊기면 DC, fault=true면 고장(D). 사이클 값이 없어도 신호가 오면 DC가 아님 |
| ⏸️ [v3] S-01 응답 | 설비 6줄 | stopId 1건으로 묶어 응답(equipmentIds 포함) |
| 🧹 [v3] 브로커·정제·저장 | Node-RED가 정제 후 DB에 바로 저장 | 설비 → MQTT 브로커(앞단) → Node-RED(정제 6가지 후 PostgreSQL에 바로 INSERT) → Spring Boot(DB의 새 값을 읽어 판정, 결과를 DB에 갱신하고 WebSocket으로 푸시). 가상 설비·PLC는 OPC UA 없이 MQTT로 바로 전송 |
| 🔗 [v3.1] API 주소 | Base URL /api/v1 | /api (주소에 버전을 붙이지 않음, 11/17). WebSocket /ws, /topic/*, MQTT 토픽은 그대로 |

**❓ 아직 미정:** 노사협의(`UP_LABOR`) RFP 원문 확인 · 슬리팅 관리값 기준(데이터 확정 후) · 알람 등급(WARNING/CRITICAL) 기준 · users.role 종류 · 토픽 이름·페이로드(sfaas/hb는 제안, IoT 담당과 확인).

**✅ 11/17 팀 결정:** DC는 가동(R)으로 계산 · COIL 공정 추가(M-13 포함) · 재배정 승인 API 없음 · dataSource 삭제 · 채팅 P2 · 설비 → 브로커(앞단) → Node-RED(정제 후 DB 바로 저장) → Spring Boot(DB의 새 값을 판정), OPC UA 없이 MQTT 직접 · I = 재공품 없어서 대기 · 슬리팅 torque/current/voltage · 설비가 1초마다 상태 신호(heartbeat)를 보내고 DC는 그 신호가 끊긴 경우만 · S-01은 stopId 1건으로 묶어 응답.

**✅ 11/16 팀 회의로 확정:** 사이클 단위 저장 · 공정마다 OK/NG 판정 · 비가동 코드와 설비 ID·공정 코드는 API 방식(알람은 `UP_ALARM` 분리) · 알람 테이블 추가 · 계획정지는 일정표 없이 원하는 시점에 등록 · 도장 경로 전환 P1 · 재배정은 계획서 작성까지만 · 검사 판정은 OK/NG만 · 측정 항목 이름은 DB 정의서 기준(camelCase).

## 공통 규칙

- Base URL: `http://localhost:8080/api`
- 주소에 버전을 붙이지 않음(11/17 결정, `/api/v1` → `/api`)
- 인증: Spring Security + JWT. 로그인 후 `Authorization: Bearer <token>` 헤더. (C-01 로그인 외 엔드포인트별 인증 여부는 명세에 없음)
- 시간: ISO-8601 KST(`2026-11-18T09:30:00+09:00`). 백엔드는 `Asia/Seoul` 고정, DB는 시간대 없는 `TIMESTAMP`에 KST로 저장. 기간 조회는 `from`, `to`
- 명명: URL은 소문자·복수형 명사, JSON 필드는 camelCase
- 담당: BE1(나연) = 설비·생산 데이터 백엔드(수집 값 저장, 판정 RSID·알람·비가동 사유, 가동률 집계·통계 API), BE2(은빈) = 인증·사용자 백엔드(로그인, JWT, 사용자 관리), FE = Vue, IoT = Node-RED·가상 설비
- 우선순위: P1 = 중간발표(11/18)까지 필수, P2 = 기본 기능 이후, P3 = 고도화
- 라인 선택: 화면 상단의 라인 선택(전체 / A~F)은 `lineId` 쿼리로 보내고, 생략하면 전체
- 성공 응답은 데이터를 그대로(래퍼 없음), 목록은 `page`, `size`로 나눔

### 공통 오류 형식

```json
{ "status": 404, "code": "EQUIPMENT_NOT_FOUND", "message": "설비 X-PR9를 찾을 수 없습니다", "timestamp": "2026-11-18T09:30:00+09:00" }
```

엔드포인트별 오류 코드 목록은 명세에 없음(위 예시의 `EQUIPMENT_NOT_FOUND`만 기재됨).

### 설비 ID · 공정 코드

총 39대(설비목록_v1.csv 기준). 공용 설비는 라인 없이 적습니다. 11/16 팀 회의로 설비 ID·공정 코드는 이 문서(API) 방식으로 확정했고, DB도 v0.3부터 같은 ID(`A-PR1`)를 씁니다.

| 구분 | 규칙 | 예시 | 대수 |
| --- | --- | --- | --- |
| 슬리터 | `{라인}-SL` | A-SL | 6 |
| 프레스 | `{라인}-PR{1~4}` | A-PR1 | 24 |
| 용접 로봇 | `{라인}-WD` | C-WD | 6 |
| 도장 | `PT{1~2}` | PT2 | 2 |
| 비전 검사기 | `VI` | VI | 1 |

- 공정 코드(`process`): `COIL`(코일입고, 설비 없음) · `SLITTING` · `PRESS` · `WELDING` · `PAINTING` · `INSPECTION`
- 라인 코드(`lineId`): `A`~`F`

### 설비 상태 (RSID)

Spring Boot가 DB에 저장된 값으로 판정하고, 여러 신호가 겹치면 **D > DC > S > I > R** 순서로 하나만 표시합니다.

| 코드 | 의미 | 화면 색 | 가동률 계산 |
| --- | --- | --- | --- |
| R 🟢 | 가동 | 초록 | 가동 시간 |
| S ⚪ | 정지(계획) | 회색 | 계획 가동시간에서 제외 |
| I 🟡 | 대기 (재공품이 없어 기다리는 상태) | 노랑 | 비계획정지(재공부족) |
| D 🔴 | 고장·알람 | 빨강 | 비계획정지(장비고장) |
| DC 🟣 | 통신 끊김 (상태 신호가 10초 이상 안 들어옴) | 보라 (제안) | 가동(R)으로 계산 (통신만 끊겼고 설비는 돌고 있을 수 있음). 비가동 이력·사유 없음 |

I(대기) 판정: 설비 바로 앞 구간의 재공품이 없을 때입니다. 재공품 = 앞 공정 OK 행 수 − 이 공정 행 수(M-13과 같은 계산)이고, 슬리팅은 코일입고 재공품이 기준입니다. DC는 가동(R)으로 계산하니 비가동 이력이 생기지 않고, 상태 타임라인(U-12)과 화면 색에서만 구분됩니다.

DC 판정: 설비(Node-RED·가상 설비)가 1초마다 상태 신호(heartbeat, Q-04)를 따로 보내고, 그 신호가 10초 이상 끊기면 DC입니다. 신호는 계속 오는데 `fault`가 `true`면 고장(D, `UP_BREAKDOWN`)입니다. 사이클 값(Q-01)이 안 와도 상태 신호가 오면 DC가 아니라 I(재공품 없음) 등으로 판정합니다.

설비 상태 공통 필드(M-01 · M-12 · W-01 동일): `equipmentId`, `lineId`, `process`, `status`(R/S/I/D/DC), `since`, `reasonCode`(R이면 null), `lastValues`. 같은 설비는 어느 API로 봐도 같은 값이 나오고, 시각은 항상 ISO-8601 KST입니다.

### 비가동 사유 코드 (`reasonCode`)

- 계획정지: `PL_SHIFT`(교대) · `PL_PM`(예방보전) · `PL_CHANGE`(모델 교체) · `PL_SETUP`(코일·나이프 교체)
- 비계획정지: `UP_BREAKDOWN`(장비고장) · `UP_ALARM`(알람, 관리값 이탈) · `UP_DELAY`(작업지연) · `UP_SHORTAGE`(재공부족) · `UP_LABOR`(노사협의 ❓) · `UP_SAFETY`(안전문제) · `UP_ETC`(기타)

관리값 이탈 알람은 진짜 고장(정비 호출)과 구분되도록 `UP_ALARM`으로 따로 둡니다(DB 코드 UP_ALARM 기준, 11/16 회의). `UP_LABOR`는 RFP 원문 확인 전까지 미정입니다. 사유는 Spring Boot가 자동으로 붙이고 틀린 것만 사람이 고칩니다(U-09). I(재공품 없음)는 `UP_SHORTAGE`로 자동 판정하고, 작업지연(`UP_DELAY`)은 사람이 U-09로 고칩니다.

### 공정·비전 판정 (`result`)

- 공정 판정: 슬리팅·프레스·용접·도장은 사이클(제품) 1건마다 `OK` / `NG`. NG면 그 공정에서 바로 폐기하고 검사기로 가지 않습니다. 공정 불량 수 = 공정별 테이블의 `result = NG` 행 수.
- 비전 판정: `OK`(양품) · `NG`(비전 불량) 두 가지만 씁니다. 재검 구분(`OK_RECHECK`)은 쓰지 않기로 했습니다.
- 집계: 최종 양품 = 비전 `OK` · 생산 수 = 검사 수 + 공정 불량 수

### 가동률 · OEE

가동률 = (계획 가동시간 − 비계획정지 시간) ÷ 계획 가동시간 × 100. OEE = 시간가동률 × 속도가동률(`performance`) × 양품률(`quality`). 공정별 제품 1개 처리 시간으로 `lossQty`와 `performance`를 계산합니다. 라인 생산 능력은 가장 느린 공정 기준(프레스·용접 17초 → 시간당 약 211개)입니다. 계획정지(S) 시간 안에서 난 고장은 손실로 세지 않고, 계획정지가 끝난 뒤까지 이어지면 넘친 시간만 비계획정지입니다. 라인별 가동률은 슬리팅~용접만 계산하고 공용 설비(도장·검사)는 제외합니다. 비가동은 길이와 상관없이 전부 저장하고, 1분 이상만 비가동 1건으로 세는 건 조회할 때 걸러요(`minMinutes=1`).

### 공정별 제품 1개 처리 시간 (11/17 갱신)

| 공정 | 입고 | 슬리팅 | 프레스 | 용접 | 도장 | 검사 | 출고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 제품 1개 처리 시간 | 0초 | 16초 | 17초 (1대당, 라인에 4대) | 17초 | 4초 | 7초 | 0초 |

라인 생산 능력은 라인 안에서 가장 느린 공정 기준입니다. 프레스·용접 17초 → 시간당 3,600 ÷ 17 = **약 211개**이고(DB `process.cycle_time_sec`도 프레스 1대당 17초), 재배정 손실 수량 = 정지 시간 × 라인 생산 능력입니다(DB 기준).


## API 명세 (REST 총 41개)

### 🖥️ 모니터링 (M) — 현재 상태 · 알람 · 출고 카운트 · 공정 상세

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | 전체 설비 현재 상태 (흐름도용) | GET | `/monitoring/status` | 쿼리 `lineId?` | `[ { "equipmentId": "A-PR1", "lineId": "A", "process": "PRESS", "status": "D", "since": "2026-11-18T09:12:04+09:00", "reasonCode": "UP_ALARM", "lastValues": { "pressureLeft": 287.1, "pressureRight": 271.0, "pressTime": 551 } } ]` | BE1 | P1 |
| M-02 | 라인별 상태 요약 | GET | `/monitoring/lines/summary` | - | `[ { "lineId": "A", "R": 5, "S": 0, "I": 1, "D": 0, "DC": 0, "worstStatus": "I" } ]` | BE1 | P1 |
| M-03 | 설비 공정 값 추이 (관리값 추이 차트, 상·하한선 포함) | GET | `/equipments/{equipmentId}/metrics` | 경로 `equipmentId`; 쿼리 `from, to, metric?`; 쿼리 `interval=raw\|5s (기본 raw)` | `{ "equipmentId": "C-WD", "metrics": [ { "metric": "current", "unit": "kA", "limitLow": 14.52, "limitHigh": 15.07, "points": [ { "ts": "2026-11-18T09:31:10+09:00", "value": 15.3, "result": "NG" } ] } ] }` | BE1 | P1 |
| M-04 | 현재 활성 알람 | GET | `/alarms/active` | 쿼리 `lineId?` | `[ { "alarmId": 381, "equipmentId": "C-WD", "itemName": "current", "measuredValue": 15.3, "lowerLimit": 14.52, "upperLimit": 15.07, "level": "CRITICAL", "message": "용접 전류 상한 초과", "occurredAt": "2026-11-18T09:31:10+09:00", "clearedAt": null } ]` | BE1 | P1 |
| M-05 | 알람 이력 | GET | `/alarms` | 쿼리 `from, to, equipmentId?, page, size` | `{ "content": [ { "alarmId": 381, "equipmentId": "C-WD", "level": "CRITICAL", "message": "용접 전류 상한 초과", "itemName": "current", "measuredValue": 15.3, "lowerLimit": 14.52, "upperLimit": 15.07, "occurredAt": "2026-11-18T09:31:10+09:00", "clearedAt": null, "ackedAt": null } ], "totalElements": 1 }` | BE1 | P1 |
| M-06 | 알람 확인 처리 | PATCH | `/alarms/{alarmId}/ack` | 경로 `alarmId`; 본문 `{ackUserId}` | `{ "alarmId": 381, "ackUserId": 1, "ackedAt": "2026-11-18T09:35:00+09:00" }` | BE1 | P2 |
| M-07 | 출고 양품/불량 카운트 | GET | `/production/counts` | 쿼리 `date (기본 오늘), lineId?`; 쿼리 `groupBy=line\|paint` | `{ "date": "2026-11-18", "total": 1200, "processNg": 30, "inspected": 1170, "ngVision": 28, "ok": 1142, "yieldRate": 95.2, "byGroup": [ { "key": "A", "total": 210, "good": 201, "ng": 9 } ], "byProcess": [ { "process": "PRESS", "produced": 1215, "ng": 12 } ] }` | BE1 | P1 |
| M-08 | 비전 검사 결과 목록 | GET | `/inspections` | 쿼리 `from, to, lineId?, result?(OK/NG), page, size`; 쿼리 `paintId?` | `{ "content": [ { "inspectionId": 9001, "productId": "C-20261118-0123", "lineId": "C", "paintId": "PT1", "result": "OK", "inspectedAt": "2026-11-18T09:32:00+09:00" } ] }` | BE1 | P1 |
| M-09 | 도장 경로 전환 | PUT | `/lines/{lineId}/paint-route` | 경로 `lineId`; 본문 `{paintId:"PT2", reason}` | `{ "lineId": "C", "currentPaintId": "PT2", "changedAt": "2026-11-18T09:35:00+09:00" }` | BE1 | P1 |
| M-10 | 알람 기준치 조회 | GET | `/alarms/thresholds` | 쿼리 `process?, equipmentId?` | `[ { "id": 3, "equipmentId": "C-WD", "process": "WELDING", "metric": "current", "low": 14.52, "high": 15.07 } ]` | BE1 | P1 |
| M-11 | 알람 기준치 수정 | PUT | `/alarms/thresholds/{id}` | 경로 `id`; 본문 `{low, high}` | `{ "id": 3, "low": 14.52, "high": 15.1, "updatedAt": "2026-11-18T09:40:00+09:00" }` | BE1 | P1 |
| M-12 | 공정 상세: 공정별 설비 목록·상태·원인 | GET | `/monitoring/processes/{process}/equipments` | 경로 `process`; 쿼리 `lineId? (생략 시 전체)` | `[ { "equipmentId": "A-PR1", "lineId": "A", "process": "PRESS", "status": "D", "reasonCode": "UP_ALARM", "since": "2026-11-18T09:12:04+09:00", "lastValues": { "pressureLeft": 287.1 } } ]` | BE1 | P1 |
| M-13 | 공정별 재공품(WIP) 수량 | GET | `/production/wip` | 쿼리 `lineId? (생략 시 전체)` | `[ { "process": "COIL", "nextProcess": "SLITTING", "wipQty": 120 }, { "process": "PRESS", "nextProcess": "WELDING", "wipQty": 42 } ]` | BE1 | P1 |

**M-01**
- 응답은 설비 39대분 배열이에요. lastValues 키는 DB 컬럼명을 camelCase로 쓴 값이에요(프레스 pressureLeft·pressureRight·pressTime…).
- 해설: A라인 프레스 1호기(A-PR1)가 지금 고장(D) 상태예요. 09:12:04부터 그 상태이고 사유는 알람(UP_ALARM, 관리값 이탈)이에요.
- 해설: lastValues는 마지막으로 받은 공정 값이에요. 압력 1이 287.1bar, 압력 2가 271.0bar, 프레스 시간이 551(0.01초 단위, 5.51초)이에요. 압력 1이 알람 상한(285.3bar, DB 초안 값)을 넘어 D로 판정됐어요.
- 해설: 이 건이 39대분 배열로 와서 공정 흐름도의 설비 색(R·S·I·D·DC)을 칠해요.

**M-03**
- interval=raw는 사이클 값 그대로, 5s는 조회할 때 5초 평균을 계산해요. 지표마다 단위와 상·하한이 같이 와서 프론트가 설비별 예외 처리 없이 차트를 그릴 수 있어요. limitLow/limitHigh·unit은 DB threshold(설비별 관리값 기준)의 하한·상한·단위이고 M-10 기준치와 같은 값이에요. metric 이름은 M-10과 같은 camelCase(pressureLeft)예요.

**M-04**
- alarm 테이블에서 조회해요.

**M-07**
- lineId를 생략한 전체 조회는 출고 검사 기준 생산량이고, lineId를 지정하면 byProcess에 공정별 생산·불량 수가 추가돼요. total(생산) = inspected + processNg, 최종 양품 ok = inspected − ngVision, 양품률 = ok ÷ total이에요.
- 해설: 오늘 생산된 제품이 1,200개예요. 그중 30개는 공정에서 NG로 폐기됐고, 나머지 1,170개가 출고 검사를 받았어요.
- 해설: 비전 불량이 28개라 최종 양품은 1,170 − 28 = 1,142개이고, 양품률은 1,142 ÷ 1,200 = 95.2%예요.
- 해설: byProcess는 공정별 분해예요. 프레스는 1,215개를 찍었고 그중 12개가 NG예요.
- 해설: byGroup은 라인별 분해예요. A라인은 210개 중 양품 201, 불량 9예요.

**M-08**
- result는 비전 OK/NG만 써요(재검 구분 없음).

**M-09**
- 호출하면 MQTT Q-03 명령이 Node-RED로 나가요. 11/16 회의에서 P1으로 올렸어요.

**M-10**
- 판정에 쓰는 기준치를 코드 수정 없이 조회·수정할 수 있어요. metric 값은 DB threshold.item_name을 camelCase로 바꾼 이름이에요(pressure_left → pressureLeft). 변환은 백엔드가 해요.

**M-12**
- 공정 상세 화면은 M-12(설비 목록·상태), M-07(lineId 지정 시 공정별 생산량), M-13(재공품), U-03(공정별 가동률·OEE)을 함께 불러 채워요.

**M-13**
- 재공품 = 앞 공정 OK 행 수 − 다음 공정 행 수. 공정별 테이블의 행 수로 세요. 코일입고(COIL)는 coil_receipt의 product_qty 합(1롤 = 20개) − 슬리팅 행 수예요. 행 수로 세면 6롤이 6개가 되니 꼭 합계로 세요. 설비의 I(대기) 판정은 자기 공정 바로 앞 구간 재공품이 0일 때예요.

### 📊 가동률 (U) — 가동률 · OEE · 비가동 분석 · 상태 타임라인

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| U-01 | 공장 전체 가동률 요약 (목표/실적, OEE) | GET | `/utilization/summary` | 쿼리 `from, to, lineId?` | `{ "target": 95.0, "actual": 91.4, "oee": 74.0, "availability": 91.4, "performance": 88.5, "quality": 91.5, "plannedMin": 28800, "unplannedStopMin": 2476, "lossQty": 1240 }` | BE1 | P1 |
| U-02 | 가동률 추이 | GET | `/utilization/trend` | 쿼리 `from, to, unit=day\|week\|month, lineId?` | `[ { "period": "2026-11-17", "target": 95.0, "actual": 92.1 } ]` | BE1 | P1 |
| U-03 | 공정별 가동률 | GET | `/utilization/by-process` | 쿼리 `from, to, lineId?` | `[ { "process": "PRESS", "actual": 89.3, "oee": 74.0, "unplannedStopMin": 132 } ]` | BE1 | P1 |
| U-04 | 라인별 가동률 | GET | `/utilization/by-line` | 쿼리 `from, to` | `[ { "lineId": "A", "actual": 93.0, "stopCount": 4 } ]` | BE1 | P1 |
| U-05 | 설비별 가동률 순위 (낮은 순) | GET | `/utilization/by-equipment` | 쿼리 `from, to, process?, limit=10` | `[ { "equipmentId": "C-WD", "actual": 78.5 } ]` | BE1 | P2 |
| U-06 | 요일별 가동률 + 비가동 건수 | GET | `/utilization/by-weekday` | 쿼리 `from, to, lineId?` | `[ { "weekday": "MON", "actual": 96.6, "stopCount": 108 } ]` | BE1 | P2 |
| U-07 | 비가동 사유별 집계 (파이·표) | GET | `/downtime/summary` | 쿼리 `from, to, groupBy=line\|process` | `{ "from": "2026-11-17", "to": "2026-11-18", "totalMin": 1616, "byReason": [ { "reasonCode": "UP_BREAKDOWN", "minutes": 175, "count": 12, "ratio": 10.8 }, { "reasonCode": "UP_SHORTAGE", "minutes": 235, "count": 20, "ratio": 14.5 } ], "byGroup": [ { "key": "A", "totalMin": 298, "UP_BREAKDOWN": 45 } ] }` | BE1 | P1 |
| U-08 | 알람·비가동 이력 목록 (조회 조건 + 조치 담당자) | GET | `/downtime/events` | 쿼리 `from, to, lineId?, process?, status?(S/I/D), reasonCode?`; 쿼리 `inProgress?(진행중만), actionUserId?(조치 담당자 번호), equipmentId?`; 쿼리 `minMinutes=1, page, size` | `{ "content": [ { "eventId": 5001, "lineId": "B", "equipmentId": "B-PR3", "process": "PRESS", "status": "D", "reasonCode": "UP_BREAKDOWN", "startAt": "2026-11-18T09:12:04+09:00", "endAt": null, "minutes": 42, "inProgress": true, "detail": "압력 상한 초과", "actionUserId": null, "actionUserName": null, "actionAt": null, "memo": "" } ] }` | BE1 | P1 |
| U-09 | 비가동 사유·조치 담당자·메모 입력/수정 | PATCH | `/downtime/events/{eventId}` | 경로 `eventId`; 본문 `{reasonCode, memo, actionUserId}` | `{ "eventId": 5001, "reasonCode": "UP_DELAY", "actionUserId": 7, "actionUserName": "김정비" }` | BE1 | P2 |
| U-10 | 장비 고장 Top N (30분 이상) | GET | `/downtime/top` | 쿼리 `from, to, minMinutes=30, limit=5` | `[ { "equipmentId": "B-PR3", "totalMin": 265, "count": 12 } ]` | BE1 | P2 |
| U-11 | 양품률 추이 | GET | `/production/yield` | 쿼리 `from, to, unit=day`; 쿼리 `groupBy=line\|paint?` | `[ { "period": "2026-11-17", "total": 1180, "good": 1121, "yieldRate": 95.0 } ]` | BE1 | P1 |
| U-12 | 설비 R/S/I/D/DC 상태 타임라인 | GET | `/equipments/{equipmentId}/status-history` | 경로 `equipmentId`; 쿼리 `from, to` | `[ { "status": "R", "startAt": "2026-11-18T08:00:00+09:00", "endAt": "2026-11-18T09:12:04+09:00" }, { "status": "D", "startAt": "2026-11-18T09:12:04+09:00", "endAt": null, "reasonCode": "UP_BREAKDOWN" } ]` | BE1 | P2 |

**U-01**
- OEE = 시간가동률(availability) × 속도가동률(performance) × 양품률(quality)이고, 시간가동률은 actual과 같아요. 라인 생산 능력은 가장 느린 공정 기준(프레스·용접 17초 → 시간당 약 211개)이에요. 계획정지 시간 안에서 난 고장은 손실로 세지 않고, 계획정지가 끝난 뒤까지 이어진 시간만 비계획정지예요. 예시 숫자는 임시예요.

**U-04**
- 라인별 가동률은 슬리팅~용접 설비만으로 계산해요. 공용 설비(도장·검사)는 제외해요.

**U-07**
- ❓ UP_LABOR(노사협의)는 RFP 원문 확인 전까지 미정이에요.
- 해설: 조회 기간 비계획정지가 총 1,616분이에요.
- 해설: 그중 장비고장은 12번 발생해 175분이고 전체의 10.8%예요. 이 값으로 비가동 파이차트를 그려요.

**U-09**
- 사유는 Spring Boot가 자동으로 붙이고, 틀린 것만 사람이 이 API로 고쳐요.

**U-12**
- WebSocket(W-01)은 지금부터의 변화만 알려줘서, 화면을 열 때 과거 구간(R 포함)은 이 API로 받아요. equipment_status_history를 조회해요.

### 🔎 생산·설비 데이터 (G) — 생산량 조회 · 일 생산 계획 · 설비 데이터 조회

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | 설비 데이터 조회 (공정별 테이블의 사이클 단위 행) | GET | `/equipment-data` | 쿼리 `from, to, lineId?, process?, equipmentId?`; 쿼리 `result?(OK/NG), page, size` | `{ "content": [ { "ts": "2026-11-18T09:30:01+09:00", "equipmentId": "A-PR1", "process": "PRESS", "result": "OK", "values": { "pressureLeft": 275.1, "pressureRight": 271.3 } } ], "totalElements": 1 }` | BE1 | P2 |
| G-01 | 생산량 조회 (기간별·라인별·계획 대비) | GET | `/production/summary` | 쿼리 `from, to, unit=day\|week\|month, lineId?` | `[ { "period": "2026-11-17", "lineId": "A", "planQty": 1500, "actualQty": 1240, "achievementRate": 82.7 } ]` | BE1 | P2 |
| G-02 | 일 생산 계획(목표) 조회 | GET | `/production/plans` | 쿼리 `from, to, lineId?` | `[ { "date": "2026-11-17", "lineId": "A", "planQty": 1500 } ]` | BE1 | P2 |
| G-03 | 일 생산 계획(목표) 설정 | PUT | `/production/plans/{date}` | 경로 `date`; 본문 `{lineId, planQty}` | `{ "date": "2026-11-17", "lineId": "A", "planQty": 1500 }` | BE1 | P2 |

**E-01**
- values 안의 항목은 공정마다 달라요. 키 이름은 DB 정의서 컬럼명을 camelCase로 써요(슬리팅은 torque·current·voltage).

**G-01**
- 해설: 17일 A라인 계획은 1,500개인데 실제로 1,240개를 만들었고, 달성률은 82.7%예요.

### 🔁 생산 재배정 (R) — 정지 손실 → 여유 라인 추천 → 계획서 작성까지 (재배정 수행 없음)

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | 재배정 보고서 목록 | GET | `/reassignments` | 쿼리 `from, to, page, size` | `{ "content": [ { "reportId": 12, "downtimeId": 5001, "sourceLineId": "B", "equipmentId": "B-PR3", "stopMin": 42, "lossQty": 126, "createdAt": "2026-11-18T09:55:00+09:00" } ] }` | BE1 | P1 |
| R-02 | 재배정 보고서 상세 (라인별 추가 배정) | GET | `/reassignments/{reportId}` | 경로 `reportId` | `{ "reportId": 12, "downtimeId": 5001, "sourceLineId": "B", "lossQty": 126, "details": [ { "targetLineId": "D", "spareCapacity": 300, "addQty": 126 } ] }` | BE1 | P1 |
| N-01 | 계획수정 보고서를 슬랙으로 보내기 (2026-11-20, D-120) | POST | `/reassignments/{reportId}/slack` | 경로 `reportId` | `{ "reportId": 12, "mock": false, "sentAt": "2026-11-20T14:12:03+09:00", "summary": ["...", "...", "..."], "summaryModel": "gemini-3.8-flash", "summaryFallbackReason": null }`. 고장 장비 + 보고서 + LLM 3줄 요약을 슬랙 웹훅 1건으로 보냄. 요약 실패면 `summaryModel: "template"`. 웹훅 없음 503 `SLACK_NOT_CONFIGURED`, 슬랙 거절·연결 실패 502 `SLACK_SEND_FAILED`. 보낸 기록은 저장하지 않음. 자세히 `docs/09_슬랙전송.md` | BE1 | P2 |

**R-01**
- 손실 수량 = 정지 시간 × 라인 생산 능력(가장 느린 공정 기준, 프레스·용접 17초 → 시간당 약 211개). 흐름: 정지 30분 이상 → 손실 수량 계산 → 여유 라인 추천 → 계획서(보고서) 작성. 실제 재배정 수행과 승인은 하지 않아요. 보고서는 Spring Boot가 자동으로 만들어요. DB에는 승인 칸(approved, approved_by, approved_at)을 만들어 두지만 비워 두고, 승인 API는 없어요.

### ⏸️ 계획정지 (S) — 일정표 없이 원하는 시점에 계획정지를 시작·종료 (RSID의 S 판정)

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | 계획정지 조회 (진행 중 + 이력) | GET | `/planned-stops` | 쿼리 `from, to, lineId?, inProgress?` | `[ { "stopId": 7, "lineId": "A", "equipmentIds": ["A-SL", "A-PR1", "A-PR2", "A-PR3", "A-PR4", "A-WD"], "reasonCode": "PL_PM", "startAt": "2026-11-18T12:00:00+09:00", "endAt": null, "inProgress": true } ]` | BE1 | P2 |
| S-02 | 계획정지 시작 (원하는 시점에) | POST | `/planned-stops` | 본문 `{lineId, reasonCode, startAt? (생략하면 지금)}` | `201 { "stopId": 8, "status": "S", "startAt": "2026-11-18T12:00:00+09:00" }` | BE1 | P2 |
| S-03 | 계획정지 종료 | PATCH | `/planned-stops/{stopId}/end` | 경로 `stopId`; 본문 `{endAt? (생략하면 지금)}` | `{ "stopId": 8, "endAt": "2026-11-18T13:00:00+09:00", "minutes": 60 }` | BE1 | P2 |

**S-01**
- 일정표 테이블 없이, 계획정지 코드(PL_*)가 붙은 비가동 이력(downtime)으로 조회해요. 진행 중인 건은 endAt이 null이에요. 라인 정지 1건은 stopId 1건으로 묶어서 내려주고, 그 라인의 설비 6대(슬리팅 1·프레스 4·용접 1, 도장·검사는 제외)를 equipmentIds로 함께 줘요. DB에는 설비마다 한 줄씩(같은 stop_group_id) 저장돼요.

**S-02**
- 라인 전체가 대상이에요. 시작한 시점부터 그 라인의 모든 설비가 S로 판정되고 계획 가동시간에서 제외돼요. startAt을 생략하면 지금부터예요.

**S-03**
- 종료하면 라인의 설비는 다시 R/I/D 판정으로 돌아가요.

### 🔐 관리·공통 (C) — 로그인 · 사용자 · 라인/설비 기준정보 · 채팅

| ID | 기능 | 메서드 | URL | 요청 | 응답 예시 | 담당 | 우선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | 로그인 | POST | `/auth/login` | 본문 `{loginId, password}` | `{ "accessToken": "eyJhbGciOiJIUzI1NiJ9...", "userName": "홍길동", "role": "ADMIN" }` | BE2 | P1 |
| C-02 | 사용자 목록 | GET | `/users` | 쿼리 `page, size` | `[ { "loginId": "admin01", "userName": "관리자", "role": "ADMIN", "email": "admin@sfaas.local", "memo": "", "lastLoginAt": "2026-11-16T09:00:00+09:00" } ]` | BE2 | P2 |
| C-03 | 사용자 등록 | POST | `/users` | 본문 `{loginId, password, userName, role, email, memo}` | `201 { "loginId": "worker01" }` | BE2 | P2 |
| C-04 | 라인 목록 | GET | `/lines` | - | `[ { "lineId": "A", "defaultPaintId": "PT1", "currentPaintId": "PT1" } ]` | BE1 | P1 |
| C-05 | 설비 목록 | GET | `/equipments` | 쿼리 `lineId?, process?` | `[ { "equipmentId": "A-PR1", "name": "A라인 프레스 1호기", "lineId": "A", "process": "PRESS" } ]` | BE1 | P1 |
| H-01 | 채팅 메시지 목록 | GET | `/chat/messages` | 쿼리 `page, size` | `{ "content": [ { "messageId": 1, "sender": "admin01", "text": "B라인 점검 시작", "sentAt": "2026-11-16T09:10:00+09:00" } ] }` | BE2 | P2 |
| H-02 | 채팅 메시지 전송 | POST | `/chat/messages` | 본문 `{text}` | `201 { "messageId": 2 }` | BE2 | P2 |

**C-01**
- 이후 모든 요청에 Authorization: `Bearer <accessToken>` 헤더를 붙여요. 인증 처리는 Spring Security + JWT예요.

**C-04**
- currentPaintId는 M-09로 경로를 바꾸면 함께 바뀌어요.

**C-05**
- 설비 ID는 설비목록_v1.csv 방식(A-PR1)으로 확정됐어요. DB도 v0.3부터 같은 ID를 써요.

**H-01**
- 채팅은 기본 기능 이후(P2)예요. DB에 채팅 테이블을 추가할 예정이고, 실시간 전달은 /topic/chat으로 할 예정이에요.

## 아키텍처 (데이터 흐름)

1. **설비 · 데이터** (가상 설비(KAMP 재생) · 슬리팅 PLC) — 설비 39대(슬리터 6 · 프레스 24 · 용접 6 · 도장 2 · 비전 1). 프레스·용접·도장·비전은 가상 설비 프로그램이 KAMP CSV 값을 MQTT로 바로 보내고, 슬리팅은 PLC 연동 설비(인버터)가 MQTT로 보내요. OPC UA는 거치지 않아요(고도화로 미룸).
2. **MQTT (Mosquitto)** (앞단 브로커 · sfaas/raw/#) — 설비 바로 뒤에 둔 브로커예요. 설비 값(Q-05)과 상태 신호(Q-04)를 받아 두기 때문에, 뒤쪽 연결이 잠시 끊겨도 데이터가 남아 유실을 막아요.
3. **Node-RED** (정제 (function 노드)) — 브로커에서 원본 값(sfaas/raw)을 구독해 정제하고, MQTT로 다시 보내지 않고 PostgreSQL에 바로 저장(INSERT)해요. 정제는 형식 통일(equipmentId·KST ts·숫자 변환), camelCase 이름 변환, 단위·스케일 맞추기, 필수값 확인, 센서 오류 제거, 중복·순서 정리 6가지예요. 상태·알람·OK/NG 판정은 하지 않아요(판정 칸은 비워 두고 저장).
4. **PostgreSQL** (Node-RED가 저장 · Spring Boot가 판정 갱신) — 공정별 사이클 테이블 4개와 inspection_result는 Node-RED가 값을 INSERT하고 Spring Boot가 result를 채워요. alarm, equipment_status_history, downtime_event, reassignment_*, users 등은 Spring Boot가 저장해요.
5. **Spring Boot** (판정) — DB에 Node-RED가 저장한 새 값을 읽고(1초마다 새 행을 조회) 설비 상태 신호(DB의 equipment_signal)와 함께 RSID 상태, 알람, 공정/비전 OK·NG, 비가동 사유를 판정해 DB에 갱신해요. 기준치는 API(M-10/M-11)로 바꿀 수 있고, 가동률·OEE·재공품도 여기서 계산해요.
6. **REST + WebSocket** (/api · /ws (STOMP)) — 처음 조회와 이력은 REST, 이후 변화는 WebSocket 채널 4개로 푸시해요. 판정 결과는 DB에 갱신한 뒤 바로 나가요.
7. **Vue + ECharts** (모니터링 · 가동률) — 화면 2개(모니터링 · 가동률)와 로그인·사용자 관리. REST로 현재 상태를 받고 /ws를 구독해 실시간으로 갱신해요.

저장 테이블: `coil_receipt` · `slitting_data` · `press_data` · `welding_data` · `painting_data` · `inspection_result` · `alarm` · `equipment_status_history` · `downtime_event` · `reassignment_report` · `reassignment_detail` · `users` · `equipment_signal` · `chat_message`

판정 위치:

| 판정 | 입력 | 저장 | 화면 알림 |
| --- | --- | --- | --- |
| 상태 RSID | Q-01 원시 값 + 등록된 계획정지 + 재공품 (상태 신호가 10초 이상 없으면 DC, 재공품이 없으면 I) | `equipment_status_history` | W-01 |
| 알람 | Q-01 원시 값 + 기준치(M-10) | `alarm` | W-02 |
| 공정 판정 OK/NG | Q-01 사이클 값 + 기준치 | 공정별 테이블 `result` | W-03 |
| 비가동 사유 | S·I·D 구간 전부 저장(1분 미만 포함) | `downtime_event` | W-01 |
| 비전 판정 | Q-02 원시 값 | `inspection_result` | W-03 |

## MQTT 토픽

설비(가상 설비·PLC)가 원본 값을 브로커로 보내고(`sfaas/raw/#`), Node-RED가 **정제한 뒤 PostgreSQL에 바로 저장**합니다(MQTT로 다시 보내지 않습니다). Spring Boot는 저장된 새 값을 읽어 **판정**하고, 상태 신호(`sfaas/hb/#`)도 Node-RED가 받아 DB에 저장하기 때문에 MQTT를 직접 구독하지 않습니다(경로 지시 Q-03만 Spring Boot가 보냅니다). 브로커가 앞단이라 Node-RED가 잠시 멈춰도 MQTT에 데이터가 남습니다.

### 🧹 Node-RED 정제 규칙 (function 노드)

Node-RED는 값을 깨끗하게 맞추는 일만 하고, 정상·불량을 정하는 판정은 Spring Boot가 합니다.

| # | 정제 | 예시 |
| --- | --- | --- |
| 1 | 형식 통일 | 토픽에서 `equipmentId`를 꺼내 payload에 넣고, `ts`를 KST(+09:00) ISO-8601로 통일, 문자열 숫자(`"275.1"`)는 숫자로 변환 |
| 2 | 이름 변환 | `pressure_left` → `pressureLeft` (API camelCase) |
| 3 | 단위·스케일 맞추기 | 슬리팅 PLC 레지스터 값(토크·전류·전압)을 실제 단위로 변환. 프레스 `pressTime`은 0.01초 단위 그대로 |
| 4 | 필수값 확인 | 값이 비었거나 숫자가 아니면(`null`, `NaN`, 글자) 버림 |
| 5 | 센서 오류 제거 | 음수 압력처럼 물리적으로 불가능한 값만 버림 |
| 6 | 중복·순서 정리 | QoS 1 재전송 중복은 하나만 남기고, 시각이 거꾸로 온 것은 정렬. 공용 도장(PT1·PT2)은 `lineId`가 없으면 버림 |

⚠️ 5번은 범위를 좁게 잡아야 합니다. 관리값을 벗어난 값(예: 압력 287, 상한 285.3 초과)은 정상적으로 들어온 불량 신호라서 지우지 말고 그대로 넘겨야 알람(D)이 뜹니다. 지우는 건 센서 오류뿐입니다.

Spring Boot가 하는 것(판정): 상태(R/S/I/D/DC), 알람, 공정 OK/NG, 비가동 사유, 재공품, 가동률 계산, DB 저장.

| ID | 토픽 | 방향 | 발행 시점 | QoS / retain | 저장 테이블 | 우선 |
| --- | --- | --- | --- | --- | --- | --- |
| Q-01 | (MQTT 없음) 정제본을 DB에 바로 INSERT | Node-RED → DB | 1초마다 (프레스·용접은 1사이클마다) | 0 / 없음 | 공정별 4개 `*_data` (1건 = 1행) | P1 |
| Q-02 | (MQTT 없음) 정제본을 DB에 바로 INSERT | Node-RED → DB | 제품 1개 검사마다 | 1 / 없음 | `inspection_result` (가칭) | P1 |
| Q-03 | `sfaas/cmd/route/{lineId}` | BE → Node-RED | M-09 경로 전환 호출 시 | 1 / retain | - | P1 |
| Q-04 | `sfaas/hb/{equipmentId}` | 설비 → Node-RED → DB | 1초마다 (살아 있다는 신호 + 고장 여부 `fault`) | 0 / 없음 | `equipment_signal` (설비당 1행 덮어쓰기: `last_seen_at`, `fault` 0/1) | P1 |
| Q-05 | `sfaas/raw/{equipmentId}` · `sfaas/raw/VI` | 설비 → Node-RED | 1초마다 (프레스·용접은 1사이클마다) · 검사는 제품 1개마다 | 0 / 없음 (검사는 1 / 없음) | 저장 안 함 (Node-RED가 정제해 Q-01·Q-02처럼 DB에 바로 저장) | P1 |

`values` 안의 측정 항목 이름은 DB 테이블 정의서 v0.3.7 컬럼명을 camelCase로 씁니다. 프레스 `pressureLeft`·`pressureRight`·`pressureTotal`·`pressTime`, 용접 `pressForce`·`current`·`voltage`·`weldTime`, 도장 `ph`·`temperature`·`current`·`voltage`(도장은 공용이라 `lineId`도 함께 보냅니다). 슬리팅은 `torque`·`current`·`voltage`를 보냅니다(DB slitting_data와 같음). 슬리팅 관리값 기준은 데이터가 정해진 뒤 DB에 추가합니다.

```json
// Q-01 A-PR1 정제본  (KAMP 7번 재생, DB에 저장되는 값)
{ "equipmentId": "A-PR1", "ts": "2026-11-18T09:30:01+09:00", "source": "REPLAY", "values": { "pressureLeft": 275.1, "pressureRight": 271.3, "pressureTotal": 546.4, "pressTime": 550 } }
```

해설: A라인 프레스 1호기가 09:30:01에 압력 275.1·271.3bar(합 546.4), 프레스 시간 550(0.01초 단위, 5.5초)을 보냈어요. 이 메시지 1건이 press_data 1행(제품 1개)으로 저장돼요. 정상인지 고장인지는 여기서 정하지 않고 Spring Boot가 정해요.

```json
// Q-01 A-SL 정제본  (슬리팅 PLC, DB에 저장되는 값)
{ "equipmentId": "A-SL", "ts": "2026-11-18T09:30:01+09:00", "source": "PLC", "values": { "torque": 12.4, "current": 3.1, "voltage": 220.0 } }
```

해설: A라인 슬리팅 설비의 PLC 값이에요. 모터 토크 12.4, 전류 3.1, 전압 220.0을 보냈고(예시 값은 임시예요), 이 메시지 1건이 slitting_data 1행으로 저장돼요.

```json
// Q-01 C-WD 정제본  (KAMP 5번 재생, DB에 저장되는 값)
{ "equipmentId": "C-WD", "ts": "2026-11-18T09:31:10+09:00", "source": "REPLAY", "values": { "pressForce": 2.8, "current": 15.3, "voltage": 2.7, "weldTime": 71 } }
```

해설: C라인 용접 로봇이 09:31:10에 전류 15.3kA를 측정했어요(알람 상한 15.07kA 초과, DB 초안 값). 기준치(M-10)를 넘는지는 Spring Boot가 비교해 알람을 만들어요.

```json
// Q-01 PT1 정제본  (KAMP 도금욕 재생, 공용 도장은 lineId 필수)
{ "equipmentId": "PT1", "ts": "2026-11-18T09:31:40+09:00", "lineId": "C", "source": "REPLAY", "values": { "ph": 3.2, "temperature": 23.1, "current": 2.9, "voltage": 3.1 } }
```

해설: 공용 도장 1호기(PT1)가 C라인 제품의 도장 값을 보낸 메시지예요. 도장은 여러 라인이 같이 쓰는 설비라서 어느 라인 제품인지 lineId를 꼭 넣어요. DB painting_data.line_id에 저장되고, 라인별 도장 불량 집계에 쓰여요.

```json
// Q-04 sfaas/hb/A-PR1  (상태 신호, 토픽 이름은 제안)
{ "equipmentId": "A-PR1", "ts": "2026-11-18T09:30:01+09:00", "fault": false }
```

해설: 설비가 1초마다 보내는 '살아 있어요' 신호예요. 평소 fault는 false, 고장나면 true예요. Node-RED가 받아 DB(equipment_signal: last_seen_at, fault 0/1)를 덮어쓰고, 이 신호가 10초 이상 안 오면 Spring Boot가 DC(통신 끊김)로 판정해요. 사이클 값(Q-01)이 안 와도 이 신호가 오면 DC가 아니에요. 토픽 이름과 페이로드는 제안이라 IoT 담당과 확인해요(fault는 가상 설비·PLC가 보내야 해요).

```json
// Q-02 VI 정제본  (KAMP 6번 재생, DB에 저장되는 값)
{ "ts": "2026-11-18T09:32:00+09:00", "productId": "C-20261118-0123", "lineId": "C", "paintId": "PT1", "visionPass": false }
```

해설: C라인 제품 C-20261118-0123의 비전 검사 결과예요(제품 번호는 DB product_id와 같은 문자열이에요). 불합격(visionPass: false)이라 Spring Boot가 NG로 판정해요. 공정 NG품은 이미 공정에서 폐기돼 검사기까지 오지 않아요.

```json
// Q-03 sfaas/cmd/route/C
{ "lineId": "C", "paintId": "PT2", "requestedBy": "admin", "ts": "2026-11-18T09:35:00+09:00" }
```

해설: 방향이 반대인 명령이에요. 관리자(admin)가 C라인 도장을 PT2 설비로 바꿔 달라고 Spring Boot가 Node-RED에 보내는 메시지예요.

## WebSocket(STOMP) 채널 (Spring Boot → Vue)

`ws://localhost:8080/ws`에 STOMP로 연결하고 필요한 채널만 구독합니다. 연결이 끊기면 REST(M-01, M-04, M-07)로 다시 채우고 재구독합니다.

| ID | 구독 경로 | 보내는 시점 | 화면 | 우선 |
| --- | --- | --- | --- | --- |
| W-01 | `/topic/status` | RSID가 바뀔 때 | 모니터링 흐름도 | P1 |
| W-02 | `/topic/alarms` | 알람 발생·해제·확인 시 | 알람 팝업·목록 | P1 |
| W-03 | `/topic/production` | 비전 검사 1건마다 · 공정 NG 발생 시 | 양품/불량 카운터 | P1 |
| W-04 | `/topic/metrics/{equipmentId}` | 1초마다, 새 점이 있을 때만 (구독한 화면이 있을 때만 계산, 11/22) | 설비 상세 실시간 차트 | P2 |
| W-05 | `/topic/flow` | 1초마다 (구독한 화면이 있을 때만 계산, 11/22 추가) | 3D 물류 (제품 위치 · 코일 재고) | P2 |

```json
// W-01 /topic/status
{ "equipmentId": "C-WD", "lineId": "C", "process": "WELDING", "status": "D", "since": "2026-11-18T09:31:10+09:00", "reasonCode": "UP_ALARM", "lastValues": { "pressForce": 2.8, "current": 15.3, "voltage": 2.7, "weldTime": 71 } }
```

해설: C라인 용접 로봇(C-WD)의 상태가 고장(D)으로 바뀌었다는 알림이에요. 09:31:10부터 그 상태이고, 비가동 사유는 알람(UP_ALARM, 관리값 이탈)이에요. 화면의 설비 색이 빨간색으로 바뀌어요.

```json
// W-02 /topic/alarms
{ "alarmId": 381, "type": "RAISED", "equipmentId": "C-WD", "level": "CRITICAL", "message": "용접 전류 상한 초과", "occurredAt": "2026-11-18T09:31:10+09:00" }
```

해설: 알람 381번이 새로 발생(RAISED)했다는 알림이에요. C-WD에서 심각(CRITICAL) 단계로 "용접 전류 상한 초과"가 일어났고, 화면에 팝업으로 떠요.

```json
// W-03 /topic/production
{ "last": { "lineId": "C", "paintId": "PT1", "result": "OK" }, "today": { "total": 1201, "processNg": 30, "inspected": 1171, "ngVision": 28, "ok": 1143, "yieldRate": 95.2 } }
```

해설: 출고 검사 결과가 하나 나올 때마다 오는 메시지예요. last는 방금 검사한 제품(C라인, 도장 PT1, 양품)이고, today는 오늘 누적이에요. 생산 1201개 중 공정 불량 30, 검사 1171, 비전 불량 28, 양품 1143이고 양품률은 95.2%예요. 공정 NG가 생길 때마다 같은 채널로 갱신해요.
