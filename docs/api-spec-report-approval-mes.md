# 보고서 결재·전송 + 임시 MES API 명세 (백엔드 담당용 초안)

| 일자 | 내용 |
|---|---|
| 2026-11-20 | 첫 작성. 프론트가 브라우저 저장(localStorage)으로 시연 중인 기능을 서버 API로 옮기기 위한 초안. 기존 `docs/api-spec-v3.1.md` 규칙을 따름 |

> 이 문서는 **제안**입니다. 필드·주소는 백엔드와 맞춰 바꿀 수 있습니다. 바뀌면 프론트는 `src/composables/useReportFlow.ts`의 저장·불러오기 부분만 고치면 됩니다 (화면 코드는 거의 안 바뀜).

## 1. 목적과 흐름

AI 보고서를 **작성 → 결재 완료 → 전송 완료** 3단계로 관리하고, 전송된 보고서를 **임시 MES**에서 캠퍼스장이 열람합니다.

```
생산 관리 팀장: 보고서 작성(결재 요청)
      ↓ POST /api/reports
공장장: 결재            POST /api/reports/{reportId}/approve
      ↓
공장장: 보고서 전송     POST /api/reports/{reportId}/send   (결재 완료 후에만)
      ↓
캠퍼스장: 임시 MES에서 열람   GET /api/mes/reports
```

- 상태는 로그인한 **모든 계정에게** 보입니다 (목록·상세 조회에 상태 포함).
- 통신 방식은 **REST**입니다. 단발성 요청이라 WebSocket은 쓰지 않습니다. (선택: MES 화면에 "새 보고서 도착" 알림이 필요하면 기존 `/ws` 채널 1개 추가, 시연에는 불필요 — 목록을 몇 초마다 다시 조회해도 됨)
- 주소는 기존 규칙대로 `/api` 아래, **버전 번호 없음**.

## 2. 계정(역할)

프론트는 화면 권한을 4종으로 나눕니다. 서버 `role`에 아래 값을 추가하거나 매핑이 필요합니다.

| 프론트 계정 | 제안 role 값 | 보고서 | 기타 권한 |
|---|---|---|---|
| 공장장 | `PLANT_HEAD` | **결재·전송** | 생산 목표, 사용자 관리 |
| 생산 관리 팀장 | `PROD_LEAD` | **작성** | 조치 쓰기, 관리값 기준 |
| 라인 담당자 | `LINE_WORKER` | 보기만 | 조치 쓰기(**본인 라인만**) |
| 캠퍼스장 | `CAMPUS` | MES 열람 | 라인 가동 시스템 보기 전용 |

- 현재 C-01 응답의 `role`은 `ADMIN` · `MANAGER` · `OPERATOR` 3종입니다. 위 4종으로 바꿀지, 기존 값과 매핑할지 정해 주세요.
- 라인 담당자는 **담당 라인 목록**이 필요합니다. C-01 응답에 `lines: ["A","B"]`를 추가하거나 사용자 테이블에 담당 라인 컬럼이 필요합니다. 비가동 조치 쓰기 `PATCH /api/downtime/events/{eventId}` (U-09)는 서버에서 "설비의 라인이 담당 라인인지" 검사해야 합니다.
- **권한 검사는 서버가 최종**으로 해야 합니다. 프론트의 버튼 숨김은 화면 구분일 뿐 보안이 아닙니다.

## 3. 상태

`status` 값: `WRITTEN`(작성) → `APPROVED`(결재 완료) → `SENT`(전송 완료)

| 전이 | 누가 | 조건 | 위반 시 |
|---|---|---|---|
| (없음) → `WRITTEN` | `PROD_LEAD` | - | 403 |
| `WRITTEN` → `APPROVED` | `PLANT_HEAD` | 현재 `WRITTEN` | 403 / 409 |
| `APPROVED` → `SENT` | `PLANT_HEAD` | 현재 `APPROVED` (**결재 완료 후에만**) | 403 / 409 |
| `WRITTEN`·`APPROVED` → `WRITTEN` | `PROD_LEAD` | 다시 작성하면 결재를 처음부터 다시 받음 | 403 |
| `SENT` 이후 수정·재전송 | - | **막음** (현재 프론트 임시 규칙, 확정 필요) | 409 |

## 4. 엔드포인트

### R-10 보고서 작성(결재 요청)
- `POST /api/reports` — 권한 `PROD_LEAD`
- 본문
```json
{
  "kind": "DAILY",
  "targetKey": "2026-11-20",
  "title": "일일 생산 보고서 · 2026-11-20",
  "content": { "...": "6장 참고" }
}
```
- `kind`: `DAILY`(일일 생산 보고서) · `REPLAN`(계획수정 보고서). `targetKey`: DAILY는 날짜, REPLAN은 보고서 ID(`reportId`). 같은 `kind + targetKey`가 이미 `WRITTEN`/`APPROVED`면 **같은 보고서를 갱신**하고 상태를 `WRITTEN`으로 되돌림. `SENT`면 409.
- 응답 `201`: 7장 보고서 객체

### R-11 보고서 목록
- `GET /api/reports?kind=&status=&from=&to=&page=1&size=50` — 로그인한 모든 계정
- 응답: `{ "items": [ <보고서 요약> ], "total": 1, "page": 1, "size": 50 }` (요약 = 7장에서 `content` 제외)

### R-12 보고서 상세
- `GET /api/reports/{reportId}` — 로그인한 모든 계정 (`CAMPUS`는 `SENT`만)
- 응답: 7장 보고서 객체 (`content` 포함)

### R-13 결재
- `POST /api/reports/{reportId}/approve` — 권한 `PLANT_HEAD`, 본문 없음
- 서버가 결재자(로그인 사용자)와 결재 시각을 기록. 응답: 7장 보고서 객체

### R-14 보고서 전송
- `POST /api/reports/{reportId}/send` — 권한 `PLANT_HEAD`, 본문 없음, **`APPROVED`일 때만**
- 서버가 전송자와 전송 시각을 기록하고 `SENT`로 바꿈. 응답: 7장 보고서 객체

### M-01 MES 수신함 (임시 MES)
- `GET /api/mes/reports?factoryId=&page=1&size=50` — 권한 `CAMPUS` (필요하면 `PLANT_HEAD`도)
- **`SENT`만** 최근 전송 순. 응답: `{ "items": [ <보고서 요약> ], "total": 1, "page": 1, "size": 50 }`
- 열람 상세는 R-12 사용. (MES 화면에는 캠퍼스·공장 구분 표시가 있으므로 `campusId`·`factoryId`를 보고서에 같이 저장하면 좋음. 현재 우리 시스템은 **차체 캠퍼스 공장 1** 한 곳)

## 5. 오류 응답

| 상태 | 뜻 |
|---|---|
| 401 | 로그인 필요 |
| 403 | 권한 없음 (역할 불일치) |
| 404 | 보고서 없음 |
| 409 | 상태가 맞지 않음 (예: `WRITTEN`인데 전송 시도, `SENT` 이후 수정) — 본문에 현재 `status` 포함 |

본문은 기존 오류 형식을 따름 (예: `{ "code": "REPORT_NOT_APPROVED", "message": "결재 완료 후에만 전송할 수 있습니다" }`).

## 6. `content` (보고서 내용)

프론트는 보고서를 만들 때 **그 시점의 문서 내용**을 그대로 보관하고, MES가 그 내용을 읽기 전용으로 보여 줍니다. 생성 후 원천 데이터가 바뀌어도 작성 이력은 그대로 보존합니다 (일일 보고서 하단 문구와 같은 원칙). 가장 간단한 방법은 **JSON 문서를 그대로 저장**(DB `jsonb` 컬럼)하는 것입니다.

`DAILY`
```json
{
  "values": { "DOC_NO": "DAILY-20261120-D", "DOC_AT": "2026-11-20 09:29:16", "PROD_DATE": "2026-11-20 (금)", "SHIFT": "일 단위 (00:00~24:00)",
    "STATUS": "전송 완료", "SUM_PLAN": "9,000개", "SUM_ACTUAL": "5,567개", "SUM_RATE": "61.9%", "SUM_DEFECT": "229개",
    "SUMMARY_TEXT": "...", "AI_REVIEW": "...", "QUALITY": "...", "M0": "78.4%", "M1": "89.1%", "M2": "92.0%", "M3": "95.6%" },
  "tables": { "LINES": [["A","1,500","983","65.5%","81.2%","34"]], "PROC": [["슬리팅","5,831","30","0.5%"]],
    "DOWN": [["C라인 프레스 1단","모델 교체 · 금형 교체","01:28~01:53 (25:00)","-"]], "WIP": [["코일입고","슬리팅","140롤"]], "HANDOVER": [["1. ..."]] },
  "fileName": "DAILY-20261120-D.doc"
}
```
`REPLAN`
```json
{ "documentNo": "AI-RPT-20261120-001", "generatedAt": "2026-11-20 09:12", "targetLine": "B", "plan": 1500, "actual": 810, "shortage": 126,
  "stopSec": 2520, "factEquipment": "B라인 프레스 3단", "factStart": "09:12", "factCause": "장비고장(알람) · 압력 상한 초과",
  "remainingSec": 52000, "modelName": "AI 분석 보고서", "docStatus": "전송 완료", "author": "김현수", "allocationText": "...",
  "rows": [["D","1,200","300","25.0%","126"]], "totalPlan": "1,200", "totalCapacity": "300", "totalAllocation": "126",
  "resultGrade": "목표 달성 가능", "resultText": "...", "actions": ["..."], "risks": ["..."] }
```
- 프론트 타입 정의: `src/lib/dailyDoc.ts`(`DailyDocData`), `src/lib/replanDoc.ts`(`ReplanDocData`). 값은 이미 화면 표시용 글자(쉼표·% 포함)로 들어 있습니다.
- 서버가 숫자 원본으로 문서를 직접 만들 수 있게 되면 그때 `content`를 서버 생성 방식으로 바꿔도 됩니다 (프론트 변경 필요).
- `STATUS`/`docStatus` 값(문서 안의 "문서 상태")은 서버가 저장하지 않고, 조회할 때 `status`에서 `작성`/`결재 완료`/`전송 완료`로 바꿔 채워도 됩니다.

## 7. 보고서 객체

```json
{
  "reportId": 31,
  "kind": "DAILY",
  "targetKey": "2026-11-20",
  "title": "일일 생산 보고서 · 2026-11-20",
  "status": "SENT",
  "campusId": "BODY",
  "factoryId": 1,
  "writtenBy": { "userId": 7, "userName": "김현수" },
  "writtenAt": "2026-11-20T09:29:16+09:00",
  "approvedBy": { "userId": 3, "userName": "최영호" },
  "approvedAt": "2026-11-20T09:29:40+09:00",
  "sentBy": { "userId": 3, "userName": "최영호" },
  "sentAt": "2026-11-20T09:29:52+09:00",
  "content": { }
}
```
- 시각은 `+09:00` 포함 ISO 8601 (기존 규칙).
- 아직 안 한 단계의 `approvedBy` · `approvedAt` · `sentBy` · `sentAt`은 `null`.
- 목록(R-11, M-01)에서는 `content`를 뺍니다.

## 8. DB 제안

`reports` 테이블 (JPA 엔티티 `Report`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| report_id | bigint PK | |
| kind | varchar | `DAILY` · `REPLAN` |
| target_key | varchar | 날짜 또는 보고서 ID. `(kind, target_key)` 유니크 |
| title | varchar | |
| status | varchar | `WRITTEN` · `APPROVED` · `SENT` |
| campus_id, factory_id | varchar, int | 임시 MES 구분용 |
| content | jsonb | 6장 |
| written_by, written_at | bigint FK(user), timestamptz | |
| approved_by, approved_at | 〃 | null 가능 |
| sent_by, sent_at | 〃 | null 가능 |

사용자 테이블: `role` 값 4종, 라인 담당자의 담당 라인(`user_line` 또는 배열 컬럼).

## 9. 프론트가 서버로 바뀔 때 고칠 곳

- `src/composables/useReportFlow.ts` — `write`/`approve`/`send` → R-10/R-13/R-14, `sent` → M-01, `flowOf` → R-11/R-12 (지금은 localStorage 키 `sfaas.reportFlow.v1`)
- `src/composables/useAuth.ts` — 로그인 응답의 `role`·`lines` 사용 (지금은 프론트 데모 계정표 `src/data/accounts.ts`)
- `src/data/contracts.ts`·`src/data/api/*` — 위 호출 추가 (data 층은 Vue를 모르는 순수 TS 규칙 유지)
- 시연용 데모 계정(`plant`·`lead`·`lineA`·`campus`, 비밀번호 1234)은 서버 계정으로 대체

## 10. 정해야 할 것

1. 전송 후 수정·재전송을 막을지 (현재 프론트는 막음)
2. `role` 4종으로 바꿀지, 기존 3종에 매핑할지
3. `content`를 프론트가 보내는 JSON으로 저장할지, 서버가 원천 데이터로 직접 만들지
4. MES 수신함을 `CAMPUS`만 쓰게 할지, 공장장도 볼 수 있게 할지
5. 캠퍼스·공장 구분 값(`campusId`·`factoryId`)을 지금 넣을지
