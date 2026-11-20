# IBM Carbon Design System 조사 — 공장 관제 대시보드 재설계 참고

조사일 2026-11-20. 1차 출처만 사용:
- 패키지 빌드 결과(unpkg): `@carbon/themes@11.86.0`, `@carbon/layout@11.63.0`, `@carbon/motion@11.57.0`, `@carbon/colors@11.62.0`, `@carbon/type`
- 코드 저장소: https://github.com/carbon-design-system/carbon (packages/themes, layout, type, motion, styles, react)
- 문서 사이트 원문(mdx): https://github.com/carbon-design-system/carbon-website (src/pages/…) — carbondesignsystem.com 의 각 페이지와 같은 내용. 사이트 대신 이 원문을 읽었다(웹페이지 직접 렌더 없이 원문 mdx·데이터 파일로 확인).
- Carbon for IBM Products: https://github.com/carbon-design-system/ibm-products

표의 hex 값은 모두 위 패키지/데이터 파일에서 그대로 옮긴 것이다. 대비비(contrast)는 내가 WCAG 공식으로 직접 계산한 값이다.

---

## 1. 색 — 테마 모델과 토큰 역할

**규칙 한 줄**: 테마 4개(White, Gray 10, Gray 90, Gray 100). 밝은 테마는 층(layer)마다 White↔Gray 10을 번갈아 쌓고, 어두운 테마는 층마다 한 단계씩 밝아진다. 컴포넌트는 hex가 아니라 역할 토큰만 쓴다.

출처
- https://carbondesignsystem.com/elements/color/overview/ (원문 `src/pages/elements/color/overview.mdx`)
- https://carbondesignsystem.com/elements/color/usage/ (layering tokens / contextual tokens)
- https://carbondesignsystem.com/elements/themes/overview/
- 값: https://unpkg.com/@carbon/themes/scss/generated/_themes.scss (v11.86.0)

### 1-1. 층 모델
| 테마 | 배경(base) | layer-01 | layer-02 | layer-03 |
|---|---|---|---|---|
| White | #ffffff | #f4f4f4 | #ffffff | #f4f4f4 |
| Gray 10 (g10) | #f4f4f4 | #ffffff | #f4f4f4 | #ffffff |
| Gray 90 (g90) | #262626 | #393939 | #525252 | #6f6f6f |
| Gray 100 (g100) | #161616 | #262626 | #393939 | #525252 |

- 층마다 field·border·hover·selected 토큰이 같은 번호로 세트를 이룬다(`$layer-02` 위의 입력칸은 `$field-03`). text·icon 토큰은 층과 무관.
- "배경보다 어두운 컴포넌트를 올리지 말 것(고대비 모드 제외)" — color/overview Do/Don't.
- 상호작용 규칙: Black~Gray 70 값은 hover 때 밝아지고, Gray 60~White 값은 hover 때 반 단계 어두워진다.

### 1-2. 주요 역할 토큰 값 (White / g10, 비교용 g90 / g100)
| 토큰 | White | g10 | g90 | g100 |
|---|---|---|---|---|
| background | #ffffff | #f4f4f4 | #262626 | #161616 |
| background-hover | rgba(141,141,141,0.12) | 동일 | rgba(141,141,141,0.16) | 동일 |
| background-selected | rgba(141,141,141,0.20) | 동일 | rgba(141,141,141,0.24) | 동일 |
| layer-01 | #f4f4f4 | #ffffff | #393939 | #262626 |
| layer-02 | #ffffff | #f4f4f4 | #525252 | #393939 |
| layer-hover-01 | #e8e8e8 | #e8e8e8 | #474747 | #333333 |
| layer-selected-01 | #e0e0e0 | #e0e0e0 | #525252 | #393939 |
| layer-accent-01 | #e0e0e0 | #e0e0e0 | #525252 | #393939 |
| field-01 | #f4f4f4 | #ffffff | #393939 | #262626 |
| border-subtle-00 | #e0e0e0 | #c6c6c6 | #525252 | #393939 |
| border-subtle-01 | #c6c6c6 | #e0e0e0 | #6f6f6f | #525252 |
| border-strong-01 | #8d8d8d | #8d8d8d | #8d8d8d | #6f6f6f |
| text-primary | #161616 | #161616 | #f4f4f4 | #f4f4f4 |
| text-secondary | #525252 | #525252 | #c6c6c6 | #c6c6c6 |
| text-helper | #6f6f6f | #6f6f6f | #c6c6c6 | #a8a8a8 |
| text-placeholder | rgba(22,22,22,0.4) | 동일 | rgba(244,244,244,0.4) | 동일 |
| text-on-color | #ffffff | — | — | — |
| text-disabled | rgba(22,22,22,0.25) | — | — | — |
| icon-primary / icon-secondary | #161616 / #525252 | 동일 | — / #c6c6c6 | — / #c6c6c6 |
| interactive | #0f62fe | #0f62fe | #4589ff | #4589ff |
| focus | #0f62fe | #0f62fe | #ffffff | #ffffff |
| link-primary | #0f62fe | #0f62fe | #78a9ff | #78a9ff |
| highlight | #d0e2ff | #d0e2ff | #002d9c | #001d6c |
| background-brand | #0f62fe | — | — | — |
| overlay | rgba(0,0,0,0.6) | — | — | — |
| skeleton-background / element | #e8e8e8 / #c6c6c6 | — | — | — |
| shadow | rgba(0,0,0,0.3) | rgba(0,0,0,0.3) | rgba(0,0,0,0.8) | rgba(0,0,0,0.8) |

대비비(직접 계산, White 위 / #f4f4f4 위): text-primary 18.1 / 16.5, text-secondary #525252 7.8 / 7.1, text-helper #6f6f6f 5.0 / 4.57, border-strong #8d8d8d 3.3 / 3.0, interactive #0f62fe 5.0 / 4.55.
→ Carbon의 회색 단계는 "#6f6f6f까지가 본문 글자(4.5:1) 하한, #8d8d8d가 UI 경계(3:1) 하한"으로 짜여 있다.

**적용 아이디어**: g10(배경 #f4f4f4, 카드 #ffffff)이 "하루 종일 띄워 두는 밝은 관제 화면"에 맞다 — 카드가 배경에서 그림자 없이 떠 보인다. 글자 3단(#161616 / #525252 / #6f6f6f)과 경계 2단(#e0e0e0 subtle / #8d8d8d strong)을 그대로 토큰 뼈대로 쓸 수 있다.

---

## 2. 상태 색 · 지원 색 · 상태 표시(Status indicator)

출처
- 토큰 값: `@carbon/themes` _themes.scss, https://github.com/carbon-design-system/carbon/blob/main/packages/themes/tokens/themes/g10/status.tokens.json
- 패턴: https://carbondesignsystem.com/patterns/status-indicator-pattern/ (원문 `src/pages/patterns/status-indicator-pattern/index.mdx`, 데이터 `src/data/status-indicators/status-indicators.yaml`, `palettes.js`)
- 컴포넌트: `packages/react/src/components/IconIndicator`, `ShapeIndicator`
- 접근성: https://carbondesignsystem.com/guidelines/accessibility/color/

### 2-1. support 토큰 (UI 피드백: 폼 오류, 알림 등)
| 토큰 | White / g10 | g90 | g100 | White 위 대비 |
|---|---|---|---|---|
| support-error | #da1e28 (Red 60) | #ff8389 | #fa4d56 | 5.0 |
| support-warning | #f1c21b (Yellow 30) | #f1c21b | #f1c21b | **1.68** (글자 불가) |
| support-success | #24a148 (Green 50) | #42be65 | #42be65 | 3.35 |
| support-info | #0043ce (Blue 70) | #4589ff | #4589ff | 7.8 |
| support-caution-major | #ff832b (Orange 40) | 동일 | 동일 | 2.46 |
| support-caution-minor | #f1c21b (Yellow 30) | 동일 | 동일 | 1.68 |
| support-caution-undefined | #8a3ffc (Purple 60) | — | — | 5.0 |
| text-error | #da1e28 | — | — | 5.0 |

### 2-2. status 토큰 (상태 표시용 — 위와 별도 세트)
| 토큰 | 밝은 테마 | 어두운 테마 | 용도 |
|---|---|---|---|
| status-red | #da1e28 (Red 60) | #fa4d56 (Red 50) | 실패·위험·긴급 |
| status-orange | #ff832b (Orange 40) | #ff832b | 심각한 주의 |
| status-orange-outline | #ba4e00 (Orange 60) | — | 주황 도형 테두리(대비 확보) |
| status-yellow | #f1c21b (Yellow 30) | #f1c21b | 일반 주의 |
| status-yellow-outline | #8e6a00 (Yellow 60) | — | 노랑 도형 테두리(대비 확보) |
| status-green | #24a148 (Green 50) | #42be65 (Green 40) | 정상·성공 |
| status-blue | #0043ce (Blue 70) | #4589ff (Blue 50) | 정보·진행 중 |
| status-purple | #8a3ffc (Purple 60) | #a56eff (Purple 50) | 미정의·이상치 |
| status-gray | #6f6f6f (Gray 60) | #8d8d8d (Gray 50) | 시작 전·보류·알 수 없음 |

핵심: **노랑(#f1c21b)과 주황(#ff832b)은 흰 배경에서 3:1이 안 된다. Carbon은 이 둘에만 어두운 테두리(Yellow 60 #8e6a00 = 4.99:1, Orange 60 #ba4e00 = 5.03:1)를 덧그려 해결**한다. 노랑 아이콘 안의 기호는 검정(secondarytoken `$black`).
"확장 상태 팔레트(Yellow/Orange 10~100)는 노랑·주황 대비 확보용으로만, 데이터 시각화와 일부 상태 표시에만 쓴다."

### 2-3. 상태 표시 패턴 규칙
- 요소 4가지: **기호(symbol)·도형(shape)·색·글자**. "WCAG 준수를 위해 이 중 최소 3가지가 있어야 한다."
- 변형:

| 변형 | 구성 | 쓰는 곳 | 크기 짝 |
|---|---|---|---|
| Icon indicator | 아이콘(도형+색+기호) + 글자 라벨 | 알림, 표, 작업 목록, 대시보드 위젯 | 아이콘 20px ↔ 글자 16, 아이콘 16px ↔ 글자 14 |
| Shape indicator | 도형+색 + 글자 라벨(기호 없음) | 목록, 대시보드, 표, 차트, 네트워크도 — 좁은 곳·대량 훑기 | 도형 16px ↔ 글자 14 또는 12 |
| Badge | 숫자 있음/없음 점 | 헤더 알림 버튼 | 숫자는 3자리, 넘으면 "+" |
| Differential | +/−, 꺾쇠, 화살표 + 글자 | 증감(델타) | 부호 필수 |

- 묶음 상태: "여러 상태를 합칠 때는 가장 주의도 높은 색으로" (초록·노랑·빨강이 섞이면 빨강).
- 인지 부하: "조치가 필요 없으면 표시기를 쓰지 말고 글자로". 한 화면에 5~6개 넘는 표시기는 과함.
- 주의 수준 3단: High(즉시 조치: 경보·오류) / Medium(조치 불필요, 진행 피드백) / Low(새것·변경됨).
- 정렬: 표시기는 **라벨 앞**에, 세로로 쌓으면 왼쪽 정렬. "같은 도형에 다른 색을 한 경험 안에서 섞지 말 것", "색과 라벨만으로 구분하지 말 것(도형도)".

Icon indicator 종류(코드 `IconIndicator`, size 16|20):
| kind | 아이콘 |
|---|---|
| failed | ErrorFilled (원 안 ×, 빨강) |
| caution-major | WarningAltInvertedFilled (역삼각형 !, 주황) |
| caution-minor | WarningAltFilled (삼각형 !, 노랑) |
| undefined | UndefinedFilled (마름모, 보라) |
| succeeded | CheckmarkFilled (초록) |
| normal | CheckmarkOutline (파랑) |
| in-progress / incomplete | InProgress / Incomplete (파랑) |
| not-started | CircleDash (회색 점선 원) |
| pending | PendingFilled (회색) |
| unknown | UnknownFilled (회색 ?) |
| informative | WarningSquareFilled (파랑 사각) |

Shape indicator 종류(코드 `ShapeIndicator`, textSize 12|14):
failed=Critical(빨강) · critical=CriticalSeverity(빨강) · high=Caution(빨강 삼각) · medium=DiamondFill(주황+주황 테두리) · low=LowSeverity(노랑+노랑 테두리) · cautious=Caution(노랑) · undefined=DiamondFill(보라) · stable=CircleFill(초록 원) · informative=LowSeverity(파랑) · incomplete(파랑) · draft=CircleStroke(회색 빈 원).

### 2-4. 데이터 시각화 경보(alert) 팔레트 — 별도
| 의미 | 밝은 테마 | 어두운 테마 |
|---|---|---|
| 위험/오류 | Red 60 #da1e28 | Red 50 #fa4d56 |
| 심각한 주의 | Orange 40 #ff832b | Orange 40 #ff832b |
| 일반 주의 | Yellow 30 #f1c21b | Yellow 30 #f1c21b |
| 정상 | **Green 60 #198038** | Green 50 #24a148 |
(출처 https://carbondesignsystem.com/data-visualization/color-palettes/#alert-palette, 데이터 `src/data/data-visualization/palettes.js`) — 차트에서는 정상 초록이 UI용(Green 50)보다 한 단계 진한 Green 60(흰 배경 대비 5.0)이다.

**적용 아이디어**
- R 가동=초록(Green 50 #24a148 면 / 글자는 Green 60~70), S 정지=회색(Gray 60 #6f6f6f), I 대기=노랑(#f1c21b + **#8e6a00 테두리·글자**), D 고장=빨강(#da1e28) 매핑이 Carbon 상태 팔레트와 정확히 맞는다. DC 통신 끊김은 Carbon의 `unknown`(회색 ?) 또는 `undefined`(보라 마름모)가 대응.
- 상태 칸마다 "도형+색+글자" 3요소: 예) 가동 ● 원, 대기 ▲ 삼각, 고장 ✕ 원, 정지 ■ 사각 — "같은 도형에 다른 색 금지" 규칙을 따른다.
- 예지보전 주의/위험 = Carbon의 caution-minor / caution-major(노랑 삼각 / 주황 역삼각). 위험을 빨강 대신 **주황**으로 두면 "빨강 = 고장 하나"(D-77/공통 원칙)를 지키면서 고장 빨강과 헷갈리지 않는다(결정 필요).
- 라인 요약 칸은 "가장 심한 상태 색으로 합친다" 규칙을 그대로 쓸 수 있다.

---

## 3. 글자(Typography)

출처
- https://carbondesignsystem.com/elements/typography/overview/ , /type-sets/
- 값: https://github.com/carbon-design-system/carbon/blob/main/packages/type/src/styles.ts , scale.ts , fontFamily.ts
- Plex KR: https://github.com/IBM/plex/tree/master/packages/plex-sans-kr , `@carbon/type/scss/_font-family.scss`

**규칙 한 줄**: 제품 화면은 productive 세트(고정 크기, -01 접미사), 홍보·큰 화면은 expressive/fluid 세트. IBM Plex Light 300 / Regular 400 / SemiBold 600만 쓴다(SemiBold는 제목용, 본문 강조용 아님).

크기 단계 공식: 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 54, 60 … (step n = 이전 + ⌊(n−2)/4 + 1⌋ × 2).

### 3-1. v11 토큰(제품용)
| 토큰 | 크기 | 줄높이 | 굵기 | 자간 | 용도 |
|---|---|---|---|---|---|
| label-01 | 12px (0.75rem) | 1.33333 (16px) | 400 | 0.32px | 라벨, 보조 |
| label-02 | 14px | 1.28572 (18px) | 400 | 0.16px | |
| helper-text-01 | 12px | 1.33333 | — | 0.32px | 도움말 |
| legal-01 | 12px | 1.33333 | 400 | 0.32px | |
| code-01 / code-02 | 12 / 14px (Plex Mono) | 1.33333 / 1.42857 | 400 | 0.32px | |
| body-compact-01 | 14px | 1.28572 (18px) | 400 | 0.16px | **표 행 글자**, 컴포넌트 안 짧은 글 |
| body-compact-02 | 16px | 1.375 (22px) | 400 | 0 | |
| body-01 | 14px | 1.42857 (20px) | 400 | 0.16px | 문단 |
| body-02 | 16px | 1.5 (24px) | 400 | 0 | |
| heading-compact-01 | 14px | 1.28572 (18px) | 600 | 0.16px | **표 열 머리** |
| heading-compact-02 | 16px | 1.375 (22px) | 600 | 0 | |
| heading-01 | 14px | 1.42857 (20px) | 600 | 0.16px | |
| heading-02 | 16px | 1.5 (24px) | 600 | 0 | |
| heading-03 | 20px | 1.4 (28px) | 400 | 0 | **표 제목**, 카드 제목 |
| heading-04 | 28px | 1.28572 (36px) | 400 | 0 | 페이지 제목 |
| heading-05 | 32px | 1.25 (40px) | 400 | 0 | |
| heading-06 | 42px | 1.199 | 300 | 0 | 큰 숫자 |
| heading-07 | 54px | 1.199 | 300 | 0 | |

- productive = `heading-0x`(고정), expressive = `fluid-heading-03~06`(브레이크포인트마다 커짐). 제품 대시보드는 productive.
- 특징: **20px 이상 제목은 Regular 400, 42px 이상은 Light 300**. 굵기로가 아니라 크기로 위계를 만든다. SemiBold는 14·16px 작은 제목에만.
- 데이터 표 기준(data-table/style): 표 제목 heading-03 20px/400, 열 머리 heading-compact-01 14px/600, 행 글자 body-compact-01 14px/400.
- 큰 글자 기준(접근성): 24px 이상 Regular 또는 19px 이상 SemiBold = 3:1 허용.

### 3-2. 한국어
- **IBM Plex Sans KR이 있다**: `@ibm/plex-sans-kr` v1.1.0(npm), Google Fonts "IBM Plex Sans KR"(300/400/500/600/700 확인). Carbon 공식 클래스 `.cds--type-sans-kr`, 폰트 스택 `'IBM Plex Sans KR', system-ui, -apple-system, BlinkMacSystemFont, '.SFNSText-Regular', sans-serif`.
- 단, Carbon 문서에 한국어 전용 크기·줄높이·자간 지침은 없다(typography 문서에 CJK 언급 없음). 자간 0.16/0.32px는 라틴 기준이라 한글에는 0이 낫다(내 판단).

**적용 아이디어**: 관제 화면 기본 글자 14px(body-compact-01), 표 머리 14px/600, 카드 제목 20px/400, 핵심 숫자 42px/300 처럼 "크기로 위계, 굵기는 작은 제목에만" 원칙(D-95와 같은 방향)을 가져온다. 글꼴은 Plex Sans KR을 쓰면 Carbon 느낌이 가장 강해진다(숫자는 아래 9장 주의 참고).

---

## 4. 간격 · 격자 · 밀도 · 컴포넌트 높이

출처
- https://carbondesignsystem.com/elements/spacing/overview/
- https://carbondesignsystem.com/elements/2x-grid/overview/ , /2x-grid/usage/
- 값: https://unpkg.com/@carbon/layout/scss/generated/_spacing.scss , _size.scss , _layout.scss , _container.scss , _icon-size.scss
- 밀도: https://github.com/carbon-design-system/carbon/blob/main/packages/styles/scss/utilities/_layout.scss
- 브레이크포인트: `packages/layout/src/index.ts`

### 4-1. 간격 토큰
| 토큰 | rem | px |
|---|---|---|
| spacing-01 | 0.125 | 2 |
| spacing-02 | 0.25 | 4 |
| spacing-03 | 0.5 | 8 |
| spacing-04 | 0.75 | 12 |
| spacing-05 | 1 | 16 |
| spacing-06 | 1.5 | 24 |
| spacing-07 | 2 | 32 |
| spacing-08 | 2.5 | 40 |
| spacing-09 | 3 | 48 |
| spacing-10 | 4 | 64 |
| spacing-11 | 5 | 80 |
| spacing-12 | 6 | 96 |
| spacing-13 | 10 | 160 |

보조: layout-01~07 = 16/24/32/48/64/96/160px, container-01~05 = 24/32/40/48/64px, icon-size-01/02 = 16/20px.

### 4-2. 2x 격자
- 기본 단위 **mini unit = 8px**. 여백·안쪽 여백은 항상 8의 배수.
- 기본 거터 32px(상자 안쪽 여백 16px ×2). 상자 padding은 모든 브레이크포인트에서 16px.
- 거터 모드: **wide**(기본, 32px, 라벨 있는 입력칸은 반드시 wide) / **narrow**(컨테이너가 거터로 16px 걸침 — "제품에서 가장 흔한 선택") / **condensed**(1px 거터, 붙어 있는 상자, 관련 데이터 묶음). 한 화면에서 섞어 쓰는 게 보통.
- "글자는 어떤 모드에서도 거터로 걸치지 않는다."

| 브레이크포인트 | 폭 | 열 | 열 기준폭 | padding | margin |
|---|---|---|---|---|---|
| sm | 320px | 4 | 80px | 16px | 0 |
| md | 672px | 8 | 80px | 16px | 16px |
| lg | 1056px | 16 | 64px | 16px | 16px |
| xlg | 1312px | 16 | 80px | 16px | 16px |
| max | 1584px | 16 | 96px | 16px | 24px |

→ 1920px 화면은 `max`(16열, 바깥 여백 24px).

### 4-3. 컴포넌트 높이·밀도 (공통 size 토큰)
| size | 높이 | 아이콘-글자 간격 |
|---|---|---|
| xs | 24px | 4px |
| sm | 32px | 8px |
| md | 40px | 8px |
| lg | 48px | 12px |
| xl | 64px | 12px |
| 2xl | 80px | 12px |

밀도(density) 토큰 `padding-inline`: **normal 16px / condensed 8px** (Tile 등이 사용).
UI Shell: 헤더 높이 48px, 사이드 내비 펼침 256px / 접힘(rail) 48px (`styles/scss/components/ui-shell` — mini-units(6), mini-units(32)).

**적용 아이디어**: 2/4/8/12/16/24/32/48 토큰을 그대로 채택하고, 1920 화면은 16열·바깥 24px. 설비 39칸 같은 촘촘한 묶음은 condensed(1px 거터) 상자 모음이 Carbon식 "타일 벽"이 된다. 입력·버튼·표 행을 sm 32px 한 높이로 맞추면 관제 화면 밀도에 맞다.

---

## 5. 모양 · 높이감(elevation)

출처
- `packages/layout/scss/generated/_border-radius.scss`, `packages/styles/scss/components/button/_vars.scss`, `_radius.scss`
- `packages/styles/scss/utilities/_box-shadow.scss`, `_focus-outline.scss`
- Tile usage: https://carbondesignsystem.com/components/tile/usage/ ; Tag style: https://carbondesignsystem.com/components/tag/style/

**규칙 한 줄**: v11은 사실상 **직각**(버튼 `$button-border-radius: 0`, 입력칸·표·타일·탭 모두 0). 깊이는 그림자가 아니라 **층 색 차이(White↔Gray 10)와 1px 경계선**으로 낸다. 그림자는 떠 있는 것(메뉴·팝오버·토스트·모달)만.

| 항목 | 값 |
|---|---|
| radius 토큰(최근 추가) | 00=0, 02=2px, 04=4px, 08=8px, 16=16px, 24=24px, max=999999px |
| 버튼 기본 radius | 0 (`enable-v12-release` 기능 플래그를 켜면 max=알약형 — v12에서 둥근 쪽으로 바뀔 조짐) |
| 태그 radius | 16px (알약형 — 직각 체계의 예외) |
| 그림자 | `box-shadow: 0 2px 6px $shadow` (밝은 테마 rgba(0,0,0,0.3)) |
| 포커스 | 2px solid `$focus`(#0f62fe), outline-offset −2px (안쪽 테두리), 고대비 모드는 점선 |
| 타일 | "타일은 페이지 배경과 같은 평면, 높이감 없음. 타일에 그림자를 넣지 말 것" |

**적용 아이디어**: 관제 화면 원칙(그라데이션·빛 번짐 없음)과 정확히 맞는다. 카드 = 배경과 다른 층 색 + (필요 시) 1px #e0e0e0, 그림자는 토스트·드롭다운에만. 포커스는 2px 안쪽 파랑 테두리를 그대로.

---

## 6. 컴포넌트

### 6-1. Data table
출처 https://carbondesignsystem.com/components/data-table/usage/ , /style/
| 크기 | 행 높이 | 짝지을 툴바 |
|---|---|---|
| xs | 24px | small 툴바 |
| sm | 32px | small 툴바 |
| md | 40px (기본) | — |
| lg | 48px | tall 툴바 |
| xl | 64px | tall 툴바 (2줄 내용일 때만) |
- 머리 행 높이 = 본문 행 높이(섞지 말 것).
- 색: 머리 배경 `$layer-accent`(White에서 #e0e0e0), 행 배경 `$layer`, 행 글자 `$text-secondary`(#525252), hover 시 `$layer-hover`+`$text-primary`, 행 아래 경계 `$border-subtle`, 선택 행 `$layer-selected`. 지브라 = 홀수 행 `$layer-accent`.
- 간격: 열 좌우 padding 16px, 표 제목 위 16·아래 24px, 정렬 아이콘 padding 8px.
- 글자: 제목 20/400, 열 머리 14/600, 행 14/400.
- 변형: 기본 / 선택(라디오·체크박스) / 펼침(expandable — "보조 정보나 추가 조회가 필요한 데이터"는 펼친 칸에, "모두 펼치기"는 기본 숨김) / 정렬 / 툴바(검색·필터·설정, 기본 버튼) / 페이지 바.
- 일괄 작업(batch actions): 행을 고르면 표 위에 **파랑 바(`$background-brand` #0f62fe, 흰 글자)**가 나타나 툴바를 덮는다. 일괄 모드에서는 행 단위 아이콘·더보기 메뉴 비활성. 취소는 바 오른쪽 끝.
- 잘린 글은 툴팁으로 전체를 보여 줄 것.

**적용 아이디어**: 알람 이력·생산 이력 표는 sm 32px 행 + small 툴바, 머리 회색 띠(#e0e0e0) + 행 경계선만(세로선 없음) — 이 조합이 "Carbon 표" 인상의 대부분이다. 메모 입력은 expandable 행 안에 두면 Carbon 문법에 맞다(Carbon 코어에는 셀 안 편집 컴포넌트가 없다. IBM Products의 `EditInPlace`가 있음).

### 6-2. Tabs vs Content switcher
출처 https://carbondesignsystem.com/components/tabs/usage/ , /content-switcher/usage/
| | Tabs | Content switcher |
|---|---|---|
| 뜻 | 서로 **다른 내용 묶음**(서류철 칸 비유 — 두 칸에 같은 종이는 없다) | **같은 내용의 다른 보기**(격자↔표, 전체/읽음/안읽음) |
| 위계 | 상위 | 탭 안의 하위에서 자주 씀 |
| 변형 | line(페이지·컴포넌트 안), contained(정해진 영역 강조), vertical, 아이콘 전용, 닫기 가능 | 높이 sm 32 / md 40 / lg 48px, 모든 칸 같은 폭(가장 긴 라벨 + 오른쪽 16px 이상) |

**적용 아이디어**: 가동률 화면의 "일/주/월"이나 "차트/표 보기"는 content switcher, "라인별 상세 / 공정별 상세"처럼 내용이 다른 것은 tabs.

### 6-3. Button
출처 https://carbondesignsystem.com/components/button/usage/ , /style/
- 종류: primary(한 화면에 **하나만**) / secondary / tertiary(테두리) / ghost(배경 없음, 가장 약함) / danger(primary·tertiary·ghost 3형).
- 크기: xs 24 · sm 32 · md 40 · lg(productive) 48 · lg(expressive) 48 · xl 64 · 2xl 80px. 버튼 묶음 안에서 크기 섞지 말 것.
- 안쪽 여백: 왼쪽 16px, 오른쪽 64px(아이콘 자리) — 글자는 왼쪽 정렬. 버튼 사이 간격 16px(또는 붙여서 1px).
- "목록·대시보드처럼 행동이 많은 곳은 tertiary·ghost가 낫다", 행동 3개 이상이면 secondary 대신 tertiary/ghost.

### 6-4. Tag
출처 https://carbondesignsystem.com/components/tag/usage/ , /style/
- 변형: read-only(분류·라벨) / dismissible(필터) / selectable(필터 선택) / operational(추가 태그 펼침).
- 크기: sm 18px · md 24px(기본) · lg 32px, radius 16px, 태그끼리 8px 간격.
- 색(White): 배경 색 20 / 글자 색 70. 예) 빨강 #ffd7d9 / #a2191f, 초록 #a7f0ba / #0e6027, 회색 #e0e0e0 / #525252 계열, 파랑 #d0e2ff / Blue 70.
- 잘리면 앞에서 자르고 툴팁.

### 6-5. Notification
출처 https://carbondesignsystem.com/components/notification/usage/ , https://carbondesignsystem.com/patterns/notification-pattern/
| 변형 | 성격 | 지속 |
|---|---|---|
| Inline | 작업 흐름 안, 주 내용 영역 위쪽 | 해결·닫을 때까지 |
| Toast | 비모달, 시간 기반 | 기본은 남아 있음, 자동 닫힘 설정 시 **5초**. 행동 버튼(tertiary 1개)이 있으면 자동으로 닫지 말 것 |
| Actionable | 안에 버튼 | 행동·닫기까지 |
| Callout | 페이지와 함께 뜨는 안내, 닫기 없음(성공·오류 없음) | 고정 |
| Banner / 알림 패널 / Modal | 제품 수준 / 알림 모음 / 차단형 | — |
- 상태 4종: 정보(파랑, information filled) / 성공(초록, checkmark filled) / 주의(노랑, warning filled) / 오류(빨강, error filled). 아이콘+제목+본문+닫기 ×.
- 토스트: **화면 오른쪽 위**에서 들어오고 나감, 서로 8px(`$spacing-03`) 간격으로 쌓임, 새 것이 맨 위, 폭 고정.
- 고대비(어두운 바탕)는 치명적 메시지에, 저대비(옅은 배경 Red 10 #fff1f1 등 + 왼쪽 색 띠)는 덜 방해됨. 한 변형 안에서 섞지 말고, 애매하면 저대비.
- 두 줄 넘으면 actionable로 바꾸고 "자세히 보기".

**적용 아이디어**: 고장 발생 토스트 = 오류 toast, 오른쪽 위, "확인" 버튼이 있으니 자동 닫힘 없음. 여러 대 동시 고장은 8px 간격으로 쌓고, 많아지면 헤더 알림 배지(숫자 3자리+)로 넘긴다.

### 6-6. Structured list
출처 https://carbondesignsystem.com/components/structured-list/usage/
- 단순한 정보 훑기·비교용(기본 / 선택형). 중첩 금지, 복잡하면 data table. 안쪽 여백 condensed 8px / 기본 16px.
- 적용: 설정 화면, 설비 상세의 "항목–값" 목록.

### 6-7. Tile
출처 https://carbondesignsystem.com/components/tile/usage/
- 변형: base / clickable / selectable / expandable. 최소 64px 높이·128px 폭, padding = 밀도 토큰(normal 16 / condensed 8px). 그림자 없음.
- 적용: 설비 카드·KPI 카드는 base tile(눌러서 상세로 가면 clickable).

### 6-8. Date picker
출처 https://carbondesignsystem.com/components/date-picker/usage/
- 변형: simple 입력(기억하는 날짜) / calendar(single·range — 다른 날과의 관계가 중요할 때) / time picker. 입력칸 높이 sm 32 · md 40 · lg 48. 범위는 시작·끝 라벨 필수. 상태: hover·focus·open·error·warning·disabled·skeleton·read-only.
- 적용: 이력 조회는 range calendar, 보고서 기간도 같음.

### 6-9. Toggle
출처 https://carbondesignsystem.com/components/toggle/usage/
- 즉시 적용되는 켜기/끄기 하나에만(설정). 확인이 필요한 행동·3개 이상 선택지에는 쓰지 말 것.
- 기본 toggle: 48×24px, 라벨 + 상태 글자(켜짐/꺼짐) 필수. small: 높이 16px, 라벨 없이 다른 컴포넌트와 한 줄.

### Carbon을 "완성품"처럼 보이게 하는 문법 (위 내용 정리)
1. 모든 높이가 24/32/40/48 중 하나, 같은 줄의 입력·버튼·툴바 높이가 같다.
2. 바깥 여백·padding이 16px로 일정, 글자는 열선에 맞춰 왼쪽 정렬(가운데 정렬 거의 없음).
3. 직각 + 1px 경계 + 층 색 차이. 그림자는 떠 있는 것만.
4. 색은 회색 + 파랑 하나(#0f62fe). 상태 색은 상태에만.
5. 표 머리 회색 띠, 세로선 없음, 행 경계선만.
6. 제목은 크고 가늘게(20px 이상 Regular), 작은 라벨만 SemiBold.
7. 빈 상태·로딩(skeleton)·오류 상태가 모두 정해져 있다.

---

## 7. 데이터 시각화 · 대시보드

출처
- https://carbondesignsystem.com/data-visualization/dashboards/
- https://carbondesignsystem.com/data-visualization/color-palettes/ (데이터 `src/data/data-visualization/palettes.js`)
- https://carbondesignsystem.com/data-visualization/chart-types/ , /chart-anatomy/ , /legends/ , /axes-and-labels/ , /gantt-charts/
- (참고: 이 영역 문서 대부분에 "작업 중(work in progress)" 표시가 있다.)

### 7-1. 대시보드 두 종류
| | Presentation | Exploration |
|---|---|---|
| 목적 | 핵심 KPI의 **현재 상태**를 한눈에, 어디를 볼지 안내 (예: 자동차 계기판, 시세판) | 검색·정렬·필터·롤업·드릴다운으로 패턴 찾기 |
| 규칙 | ① 강한 위계: 가장 중요한 데이터가 **가장 높은 대비·가장 큰 면적**, 맨 위, F자 흐름 ② 지표 수 제한, 비필수는 필요할 때만 ③ 데이터셋마다 색 고정 ④ 여백으로 구분 | ① 모든 차트 같은 배치·간격, 범례 위치 동일, 단위계 바꾸지 말 것 ② 연동 차트(한 차트 필터·확대 → 관련 차트 동시 반영) ③ 주석으로 추세·평균·최고·최저 표시(데이터 가리지 않게) |

→ 실시간 대시보드 = presentation, 가동률·이력·보고서 = exploration.

### 7-2. 차트 종류(목적별 분류)
비교: simple/grouped/floating bar, lollipop, bubble, radar · 추세: line, area, boxplot, histogram · 부분-전체: donut, pie, stacked bar, bullet, stacked area, **meter**, gauge, treemap · 상관: scatter, **heat map**, parallel coordinates · 연결: alluvial, network, tree · 지도.
Gantt: 왼쪽 작업 목록(card) + 오른쪽 시간축 막대(task). "이웃 막대는 대비되는 색, 비슷한 색은 떨어뜨려라." Carbon Charts 라이브러리에는 없고 Figma 키트(알파)만.
→ **상태 시간 막대(24h 타임라인)에 대한 별도 지침은 없다.** 가장 가까운 것은 Gantt + floating bar + 위 경보 팔레트.

### 7-3. 팔레트 (밝은 테마)
범주형 14색(이 순서대로만 사용 — 이웃 색 대비 최대화):
| # | 이름 | hex |
|---|---|---|
| 1 | Purple 70 | #6929c4 |
| 2 | Cyan 50 | #1192e8 |
| 3 | Teal 70 | #005d5d |
| 4 | Magenta 70 | #9f1853 |
| 5 | Red 50 | #fa4d56 |
| 6 | Red 90 | #570408 |
| 7 | Green 60 | #198038 |
| 8 | Blue 80 | #002d9c |
| 9 | Magenta 50 | #ee538b |
| 10 | Yellow 50 | #b28600 |
| 11 | Teal 50 | #009d9a |
| 12 | Cyan 90 | #012749 |
| 13 | Orange 70 | #8a3800 |
| 14 | Purple 50 | #a56eff |

개수가 정해졌을 때 쓰는 묶음(밝은 테마, 각 첫 번째 안):
- 1색: Purple 70 #6929c4 (또는 Blue 80 #002d9c, Cyan 50 #1192e8, Teal 70 #005d5d)
- 2색: #6929c4 + #009d9a
- 3색: #a56eff + #005d5d + #9f1853
- 4색: #9f1853 + #fa4d56 + #570408 + #a56eff
- 5색: #6929c4 + #1192e8 + #005d5d + #9f1853 + #570408

순차(단색, 밝은 테마는 진할수록 큰 값): Blue 10→100 = #edf5ff #d0e2ff #a6c8ff #78a9ff #4589ff #0f62fe #0043ce #002d9c #001d6c #001141 (Purple·Cyan·Teal 계열도 있음).
발산: ① 빨강–청록(온도: 뜨거움/차가움) #750e13 … #fff1f1 | #e5f6ff … #003a6d ② 보라–틸(온도 연상 없는 성과·비율) #491d8b … #f6f2ff | #d9fbfb … #004144. 밝은/어두운 테마 구분 없음.
경보: 2-4절 표.
그라데이션: 단일 범주의 극값 강조용만, 의미 있는 진행에는 금지, 여러 그라데이션 금지.
어두운 테마 범주형: #8a3ffc #33b1ff #007d79 #ff7eb6 #fa4d56 #fff1f1 #6fdc8c #4589ff #d12771 #d2a106 #08bdba #bae6ff #ba4e00 #d4bbff.

### 7-4. 범례·축·해부
- 범례: **가능하면 범례 대신 직접 라벨.** 범주 하나면 범례 없음. 약어 금지. 기본 위치 아래(대시보드처럼 좁을 땐 위/아래), 색 대신/함께 질감(texture) 사용 가능.
- 축: 막대·면적(부분-전체·비교)은 **반드시 0부터**, 선·산점도는 0 아닌 시작 허용. 데이터 공백은 **보간하지 말고** 공백 시작·끝을 표시. 축 생략은 물결선(최소 16px). 시간축 눈금 간격 일정, 날/월/연이 바뀌는 눈금은 SemiBold "landmark 라벨". 현지 날짜 형식.
- 해부: 제목은 "보여 주는 핵심 통찰"을 서술, 툴팁은 두 축 값을 모두 반복, 그래프 틀에 요소를 너무 채우지 말 것.

**적용 아이디어**
- 실시간 화면은 presentation 규칙대로: 고장·지연 같은 가장 중요한 숫자가 왼쪽 위·가장 큰 면적·가장 높은 대비.
- 24h 상태 타임라인: 상태 4색(+DC)을 Gantt식 가로 막대로, 통신 끊김 구간은 "보간 금지 → 빈칸 + 시작·끝 표시" 규칙을 그대로 적용. 자정이 넘는 눈금은 SemiBold.
- 가동률 막대는 0부터 시작(축 자르지 않기). 라인 6개 비교는 범주형 6색보다 **직접 라벨 + 회색 바탕 + 이상치만 색**이 Carbon 지침(범례 피하기)과 우리 원칙(이상만 색)에 둘 다 맞다.

---

## 8. 움직임(Motion)

출처 https://carbondesignsystem.com/elements/motion/overview/ ; 값 https://unpkg.com/@carbon/motion/scss/generated/_tokens.scss , `packages/motion/src/index.ts`

| 토큰 | 값 | 용도 |
|---|---|---|
| duration-fast-01 | 70ms | 버튼·토글 미세 반응 |
| duration-fast-02 | 110ms | 페이드 |
| duration-moderate-01 | 150ms | 작은 펼침, 짧은 이동 |
| duration-moderate-02 | 240ms | 펼침, 시스템 알림, **토스트** |
| duration-slow-01 | 400ms | 큰 펼침, 중요한 시스템 알림 |
| duration-slow-02 | 700ms | 배경 어둡게 |

| 곡선 | productive | expressive |
|---|---|---|
| standard (처음부터 끝까지 보이는 것) | cubic-bezier(0.2, 0, 0.38, 0.9) | cubic-bezier(0.4, 0.14, 0.3, 1) |
| entrance (들어옴: 모달·토스트) | cubic-bezier(0, 0, 0.38, 0.9) | cubic-bezier(0, 0, 0.3, 1) |
| exit (나감) | cubic-bezier(0.2, 0, 1, 0.9) | cubic-bezier(0.4, 0.14, 1, 1) |

규칙: 제품 화면·데이터 표·차트는 productive(효율적·눈에 안 띔), expressive는 새 페이지 열기 같은 드문 큰 순간만. 장식용 곡선 금지.
**적용 아이디어**: 고장 토스트 = 240ms + entrance productive, 사라질 때 exit productive. 1초 갱신 숫자에는 움직임 없음(우리 원칙과 동일).

---

## 9. 모니터링 · 운영 화면 관련 / Carbon for IBM Products

출처
- https://github.com/carbon-design-system/ibm-products (packages/ibm-products/src/components)
- https://carbondesignsystem.com/patterns/empty-states-pattern/
- https://carbondesignsystem.com/patterns/status-indicator-pattern/

- Carbon 문서에 "IoT/공장/운영 대시보드" 전용 지침은 **없다**. 관련된 것은 상태 표시 패턴(2장), 대시보드 2종(7장), 알림 패턴(6-5)이다.
- IBM Products 컴포넌트 중 쓸 만한 것: `BigNumber`(큰 숫자 — 값, 분수 total, 퍼센트, 증감 trending, 소수 자리 fractionDigits 기본 1, 잘라쓰기), `SidePanel`(오른쪽 상세 패널), `EmptyStates`, `FilterPanel`/`FilterSummary`, `PageHeader`, `NotificationsPanel`, `Datagrid`, `EditInPlace`(셀 안 편집), `TagSet`, `DescriptionList`, `Toolbar`.
- IBM Products의 `StatusIcon`(fatal·critical·major-warning·minor-warning·undefined·unknown·normal·info·in-progress·running·pending)은 **폐기 예정(deprecated)**, "Carbon 코어의 Icon Indicator로 바꾸라"고 명시 → 지금 기준은 코어 `IconIndicator`/`ShapeIndicator`.
- 빈 상태: 구성 = 제목(짧게) + 본문(다음 행동 설명) + 선택적 행동 버튼/링크 + 그림. 종류 = 데이터 없음(첫 사용) / 사용자 행동 결과(검색 결과 없음, 완료) / 오류(권한·시스템·설정 필요). **왼쪽 정렬 묶음이 기본**, 작은 타일 안일 때만 그림을 가운데. 여러 빈 상태가 한 화면에 있으면 행동은 tertiary 버튼(기본 버튼 중복 방지).

**적용 아이디어**: KPI 칸은 BigNumber 문법(큰 숫자 + 작은 라벨 + 증감 부호)으로 "지금 기준 N개 앞섬/뒤처짐"(D-101)을 표현. 설비 클릭 → 오른쪽 SidePanel 상세는 엔터프라이즈 인상이 강하다. "데이터 없음"(D-78)은 빈 상태의 "제목 + 이유 한 줄" 축약형으로.

---

## 우리에게 맞지 않는 점 · 주의

1. **글꼴**: Carbon = IBM Plex. 한글은 IBM Plex Sans KR이 있지만 ① 한글 크기·줄높이·자간 지침이 없고(자간 0.16/0.32px는 라틴용), ② Plex Sans KR의 숫자가 고정폭(tnum)을 지원하는지는 이번에 확인하지 못했다 — 1초 갱신 숫자에 `tabular-nums`가 먹는지 직접 확인해야 한다. ③ 웹폰트 용량이 크다(한글 서브셋 분할 필요). 기존 글꼴을 유지하고 Carbon 크기·굵기 체계만 빌리는 선택지도 있다.
2. **노랑 대기(I)**: Carbon 노랑 #f1c21b는 흰 바탕 대비 1.68:1 — 글자·얇은 선으로 쓰면 AA 불가. Carbon도 #8e6a00 테두리를 덧그려 해결한다. 우리 대기 노랑도 "면은 #f1c21b, 글자·테두리는 Yellow 60~70" 이중 구조가 필요.
3. **초록 가동(R)**: support-success #24a148은 흰 바탕 3.35:1 — 큰 면·아이콘은 되지만 작은 글자는 Green 60 #198038(5.0) 이상.
4. **빨강 하나 원칙과 Carbon 위계 차이**: Carbon은 빨강(실패/치명)–주황(심각 주의)–노랑(주의)의 3단 경고를 쓴다. 우리 "빨강 = 고장 하나" 원칙에서는 예지보전 위험을 주황으로 옮겨야 일관된다(또는 테두리로만). 그대로 가져오면 예지보전 빨강 테두리와 고장 빨강이 겹친다.
5. **강조색 파랑 #0f62fe**: Carbon의 정체성 자체(IBM 파랑). 그대로 쓰면 "IBM 제품처럼" 보여 엔터프라이즈 인상은 강하지만 고유성이 없다. 상태 4색과 겹치지 않으므로 충돌은 없음. 또한 Carbon status-blue(정보·진행)와 interactive가 같은 파랑 계열이라, 파랑을 상태 의미로 쓰지 않는 우리에겐 문제 없음.
6. **직각 모서리**: Carbon v11은 0px(태그만 알약형). 현재 화면이 둥근 모서리라면 직각 전환은 인상이 크게 바뀐다. 단 Carbon도 radius 토큰(2/4/8/16/24)을 새로 넣었고 v12 플래그에서 버튼을 둥글게 바꾸는 중이라, "2~4px 살짝"은 Carbon 정신과 충돌하지 않는다.
7. **행 글자 #525252(text-secondary)**: Carbon 표는 행 글자를 2차 회색으로, hover 때만 1차 검정으로 바꾼다. 하루 종일 읽는 관제 표에서는 기본 1차 글자가 더 나을 수 있다.
8. **배치 작업 파랑 바, 48px 헤더 등 IBM 고유 크롬**: 그대로 쓰면 IBM 클론처럼 보일 수 있다. 원리(높이 단계·층 색·상태 3요소)만 빌리고 브랜드 요소(파랑 바, Plex, 검정 헤더)는 선택적으로.
9. **문서 성숙도**: 데이터 시각화 지침 대부분이 "작업 중" 표시, Gantt는 알파 Figma 키트뿐, 상태 타임라인 지침 없음 — 24h 상태 타임라인은 우리가 정해야 한다.
10. **밀도**: Carbon 기본(md 40px 행, 16px padding)은 39대·6라인 한 화면에는 성기다. sm 32px / xs 24px + condensed 8px를 기본으로 낮춰야 한다.
