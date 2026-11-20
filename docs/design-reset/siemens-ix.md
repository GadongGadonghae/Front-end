# Siemens iX 디자인 시스템 조사 (공장 관제 대시보드 재설계 참고)

조사일 2026-11-20. 웹사이트(ix.siemens.io)는 렌더링하지 않고 **소스와 npm 패키지에서 직접 값을 뽑았다** (hex 값은 CSS 변수 체인을 스크립트로 풀어 확인).

## 0. 먼저 알아야 할 것: 버전이 두 갈래다

| 구분 | 상태 | 테마 이름 | 토큰 이름 | 출처 |
|---|---|---|---|---|
| **v5.3.0** (npm `latest`, 2026-10-12) | 정식 배포 | `classic` (light/dark) | `--theme-color-*`, `--theme-space-*`, `--theme-ms-*` | `@siemens/ix@5.3.0` `dist/siemens-ix/theme/classic-light.css`, `classic-dark.css` |
| **v6** (`main` 브랜치, npm `beta` 0.0.0-beta-20261110) | 출시 전 | `community` (classic의 새 이름) | `--si-sys-*`(시스템) / `--si-ref-*`(참조) 2층 | github.com/siemens/ix `packages/core/scss/theme/community/**` (커밋 3717df6, 2026-11-19), `BREAKING_CHANGES/v6.md` |

- v6에서 **상태 이름과 뜻이 바뀐다**: Alarm→Danger(빨강), Critical(주황)→Warning, Warning(노랑)→Caution, Info→Information, 그리고 Danger보다 위 단계로 **Critical = 보라**가 새로 생긴다. 근거는 ISO 3864-2(Danger 빨강, Warning 주황, Caution 노랑)와 WCAG(주황이 라이트 모드에서 대비가 더 좋음). 출처: github.com/siemens/ix-docs `blog/2026-09-08-colorchange/index.md`.
- 문서 원문은 github.com/siemens/ix-docs (`docs/**`)에 있고 지금은 **v5(classic) 기준**으로 쓰여 있다.
- 새로 체계를 짜는 우리 입장에서는 **v6 체계(2층 토큰, 상태 7단계, 상태 띠)가 더 참고할 만하다**. 아래 표에는 두 버전 값을 같이 적었다.

---

## 1. 테마

| 항목 | 내용 |
|---|---|
| 공개 테마 | v5 `classic` light/dark, v6 `community` light/dark (같은 테마, 이름만 바뀜) |
| 브랜드 테마 | "Siemens AG Corporate Brand Theme"(`brand`). Siemens AG 제품 전용, 사내 저장소 code.siemens.com에서만 받을 수 있음 → **우리는 못 씀** |
| 지정 방법 | `<html data-ix-theme="classic|community" data-ix-color-schema="light|dark|system">` (v5부터 테마 이름과 명암 모드를 따로 지정) |
| 기본값 | v1 시절 기본은 `theme-classic-dark` (`docs/home/migration/core-ui.md`). v5부터는 **기본 테마를 자동으로 넣지 않음**, 앱이 직접 지정 (`docs/home/migration/5_0_0/index.md`). |
| 밀도(density) | v6에 `data-ix-density="compact"`가 새로 생김. 글자와 아이콘이 한 단계 작아짐 (예: body 14→12px, 아이콘 md 20→16px) |
| 토큰 구조(v6) | `--si-ref-color-main-warm-gray-200: #f3f4f5`(원색 참조) → `--si-sys-color-background-0: var(--si-ref-…)`(역할). 컴포넌트는 sys만 씀. 컴포넌트별 변수는 `--ix-<component>--<property>--<state>` |
| 토큰 구조(v5) | 한 층: `--theme-color-1…8`, `--theme-color-std-text`, `--theme-color-soft-bdr`, `--theme-color-alarm` 등 |

- **원칙**: 테마 이름과 명암 모드는 따로 정하고, 컴포넌트는 역할 토큰만 참조한다.
- **"산업용은 다크가 기본" 근거**: 문서에서 이유를 설명한 곳은 **찾지 못했다**. 옛 기본값이 dark였다는 사실만 확인했고, v5 이후로는 중립이다(앱이 정함). **확인 못 함.**
- 출처: `ix-docs/docs/styles/theming/usage-developers.md`, `docs/home/support/faq.md`, `ix/packages/core/scss/theme/community/theme.scss`, `ix/BREAKING_CHANGES/v6.md` "Renamed the Classic theme to Community"
- **적용 아이디어**: 우리 `:root`도 `--ref-*`(원색) → `--sys-*`(역할) 2층으로 나누면 라이트 기본에 다크 대응을 나중에 붙이기 쉽다. `data-theme` 속성으로 명암을 고르는 방식도 같다.

---

## 2. 색 토큰 (배경·표면·글자·테두리·강조)

### 2-1. v6 community (권장 참고) — `--si-sys-color-*`

| 역할 | 토큰 | Light | Dark | 설명(원문 주석 요약) |
|---|---|---|---|---|
| 앱 바탕 | `background-0` | `#f3f4f5` | `#000609` | 가장 아래 층, 앱의 실제 바탕 |
| 주 표면 | `background-1` | `#ffffff` | `#1a272d` | 카드·사이드 패널·컨테이너 |
| 위 표면 | `background-2` | `#f0f1f2` | `#0b171c` | background-1 위에 놓는 요소 |
| 떠 있는 층 | `background-3` | `#ffffff` | `#243137` | 토스트·팝오버·드롭다운·모달(그림자와 함께) |
| 강조 컨테이너 | `background-4` | `#fafafa` | `#0e1b20` | 더 강하게 구분할 때 |
| hover | `background-hover` | `#e8ebed` | `#273940` | |
| 선택/활성 | `background-selected` / `-active` | `#dcdee0` | `#34454d` | |
| 비활성 | `background-disabled` | `#aeb5b8` | `#34454d` | |
| 반전 | `background-inverse` | `#000609` | `#ffffff` | |
| 글자 1 | `text-primary` | `#000609` | `#ffffff` | |
| 글자 2 | `text-secondary` | `#405158` | `#aeb5b8` | 보조 글, 라벨 |
| 비활성 글자 | `text-disabled` | `#919ca1` | `#5b6a71` | |
| 테두리 1(강) | `border-1` | `#000609` | `#ffffff` | |
| 테두리 2 | `border-2` | `#5b6a71` | `#919ca1` | 입력칸, 차트 축 |
| 테두리 3 | `border-3` | `#919ca1` | `#5b6a71` | 카드 외곽(outline) |
| 테두리 4(약) | `border-4` | `#e5e8e9` | `#405158` | 헤더 하단선, 표 행 구분 |
| 강조(accent) | `background-accent` / `text-accent` / `border-accent` | `#006a87` | `#00c9e4` | 청록(petrol). hover `#004f69`/`#00eaff` |
| 강조 위 글자 | `text-on-accent` | `#ffffff` | `#000609` | |
| 포커스 링 | `effects-focus` | `#008ff5` | `#199fff` | 키보드 포커스 전용, 2px, offset 1px |
| 모달 뒤 막 | `effects-backdrop` | 검정 30% | `#000609` 65% | |

### 2-2. v5 classic (정식 배포판) — `--theme-color-*`

| 역할 | 토큰 | Light | Dark |
|---|---|---|---|
| 바탕(base layer) | `color-1` | `#ffffff` | `#0f1619` |
| 1단 컨테이너 | `color-2` | `#eff0f1` | `#283236` |
| 3~8 | `color-3…8` | `#e2e4e6`…`#92979b` | `#3c484d`…`#94a1a9` (특정 컴포넌트 전용, 직접 쓰지 말 것) |
| 채움 컴포넌트 | `component-1` | `hsla(213,7%,68%,.2)` | `rgba(140,161,171,.2)` |
| 글자 | `std-text` / `soft-text` / `weak-text` | `rgba(0,10,20,.9)` / `.6` / `.4` | `rgba(245,252,255,.9)` / `rgba(229,247,255,.65)` / `rgba(219,244,255,.4)` |
| 대비 글자 | `contrast-text` | `#000` | `#fff` |
| 테두리 | `hard-bdr` / `std-bdr` / `soft-bdr` / `weak-bdr` / `x-weak-bdr` | `#b2b8be` / `rgba(0,20,40,.3)` / `.2` / `rgba(35,48,60,.15)` / `rgba(174,181,189,.2)` | `#6b7c85` / `rgba(211,236,248,.55)` / `.4` / `rgba(224,245,255,.25)` / `rgba(142,157,165,.2)` |
| primary | `primary` | `#006e93` | `#00bde3` |
| dynamic(선택 표시) | `dynamic` | `#005e66` | `#00eaff` |
| 포커스 | `focus-bdr` | `#199fff` | `#199fff` |

- **원칙**: 깊이는 **배경 층 + 테두리**로 만들고, 그림자는 떠 있는 요소(드롭다운·툴팁·모달·토스트)에만 쓴다. 카드나 내비게이션에는 그림자를 쓰지 않는다 (`ix-docs/docs/styles/elevation.md`).
- 글자 3단계: std(본문) / soft(보조·라벨·placeholder) / weak(비활성). 테두리 5단계는 용도별로 나뉜다: std=입력칸, soft=카드·구분선, weak=화면 영역 구분, x-weak=아주 약한 구분 (`docs/styles/colors.md`, `borders.md`).
- 강조색은 청록 계열 하나뿐이다. 상태색(빨강·주황·노랑·초록·파랑·보라)과 색조가 겹치지 않는다.
- 출처: `ix/packages/core/scss/theme/community/{_si-reference,light/_system,dark/_system}.scss`, `@siemens/ix@5.3.0/dist/siemens-ix/theme/classic-*.css`
- **적용 아이디어**: 바탕 `#f3f4f5` + 카드 `#ffffff` + 카드 외곽선 `border-4/3`이면 라이트 관제 화면이 "중립 회색 바탕 위 흰 판" 구조가 된다. 강조색은 청록 하나로 두면 상태 4색과 겹치지 않는다(CLAUDE.md 규칙과 맞음).

---

## 3. 상태·알람 색

### 3-1. v6 (7단계 + neutral). 배경(강) / subtle(옅은 배경) / 글자색 / 위에 얹는 글자색

| 상태 | 뜻 | bg Light | bg Dark | subtle L / D | text L / D | text-on L / D | 흰 바탕 대비 |
|---|---|---|---|---|---|---|---|
| **critical** (보라, 신규) | Danger보다 위, 드문 안전·인프라 위협 | `#a733bc` | `#a733bc` | `#edd6f2` / `#52245c` | `#740089` / `#d59cde` | 흰 / 흰 | 5.46 |
| **danger** (빨강) | 알람·오류 | `#d72323` | `#d72323` | `#fccccc` / `#430000` | `#a70808` / `#ff8e8e` | 흰 / 흰 | 5.06 |
| **warning** (주황) | 경고 | `#ba5d00` | `#ff8000` | `#fee5cc` / `#3c1e00` | `#9a4d00` / `#ff9225` | 흰 / `#000609` | 4.51 |
| **caution** (노랑) | 주의 | `#fcb900` | `#ffc832` | `#ffedba` / `#322501` | `#4d3901` / `#ffc832` | **`#000609`(검정)** / 검정 | 1.74 (글자색으로 쓰면 안 됨) |
| **success** (초록) | 정상·완료 | `#376f1c` | `#59bd28` | `#d1f2c1` / `#1d3212` | `#376f1c` / `#99e672` | 흰 / 검정 | 6.08 |
| **information** (파랑) | 정보 | `#226ae7` | `#226ae7` | `#d2e0f7` / `#1a386b` | `#2050a2` / `#a9c3f1` | 흰 / 흰 | 4.90 |
| **neutral** (회색) | 중립·알 수 없음 | `#5b6a71` | `#aeb5b8` | — | — | 흰 / 검정 | 5.61 |
| accent | 강조(상태 아님) | `#006a87` | `#00c9e4` | — | — | 흰 / 검정 | 6.16 |

(대비값은 이번에 직접 계산함. 다크 모드 danger `#d72323` on `#1a272d` = 3.03:1이라 다크에서 빨강은 면/아이콘용이고 글자는 `text-danger #ff8e8e`를 쓴다.)

### 3-2. v5 classic (배포판) 상태색

| 상태 | Light | Dark | contrast(위 글자) | 글자 전용색 |
|---|---|---|---|---|
| alarm | `#d72332` | `#ff2453` | 흰 / 검정 | `alarm-text` `#b81e3f` / `#ff7694` |
| critical (주황) | `#bc5b01` | `#eb7a0a` | 흰 / 검정 | — |
| warning (노랑) | `#ffbb00` | `#ffbb00` | **검정** / 검정 | `warning-text` `#947100` / `#ffbb00` |
| success | `#2c8500` | `#44cc00` | 흰 / 검정 | — |
| info | `#0041b2` | `#357fff` | 흰 / 검정 | — |
| neutral | `#66727e` | `#b6b8b9` | 흰 / 검정 | — |
| 옅은 변형 | `alarm-10`, `alarm-40`, `warning-10/40`, `critical-40`, `info-40`, `neutral-40` (투명도 10%·40%) | | | |
| 상태 배경(입력 오류 등) | `component-error` `#fcccd0`, `component-warning` `#ffe8a8`, `component-info` `#ccdefc` | | | |

- 별도의 "off / maintenance / 통신 끊김" 상태**색**은 없다. 대신 **아이콘**이 있다: `maintenance*`(사각·삼각·마름모·팔각 변형), `namur-maintenance-required`, `disconnected`, `disconnected-circle`, `generic-device-disconnected`, `generic-device-stop`, `generic-device-pause`, `emergency-stop` (`@siemens/ix-icons@3.7.1/svg`).

### 3-3. 색 말고 상태를 보여 주는 방법

| 수단 | 규칙 | 출처 |
|---|---|---|
| **모양이 다른 상태 아이콘** | danger=원(alarm), critical=**팔각형**(warning-octagon), warning=**삼각형**(warning), caution=**마름모**(warning-rhomb), information=**사각형**(info), success=원+체크(success). 채운 판(plate) 모양도 같이 정해져 있다 | `ix/packages/core/src/components/badge/badge.status-icon.ts`, `kpi/kpi.types.ts` |
| 상태 아이콘 전용 규칙 | 상태 아이콘은 위험도 순서를 따르고 해당 색과 함께 쓴다. 다른 용도로 쓰지 않는다 | `ix-docs/docs/icons/icon-usage.mdx` |
| **상태 띠(strip)** | v6 카드·토스트·블라인드: 면 전체를 칠하지 않고 **위(카드)나 왼쪽(토스트·블라인드)에 4px 띠**(`border-width-emphasis`=0.25rem)를 둔다. 테두리는 중립 `border-3` | `BREAKING_CHANGES/v6.md` "Status variants", `card.vars.scss`, `toast.vars.scss`, `blind.vars.scss` |
| 이벤트 목록 표시줄 | 행 왼쪽에 **8px 세로 색 막대**(`itemColor`에 CSS 변수를 넘김), 행 높이 40px, 행 간격 8px | `event-list-item.vars.scss`, `event-list-item.tsx` |
| KPI | 아래 2px 테두리 색 + 상태 아이콘(16px). neutral/accent는 아이콘 없음. 아이콘은 `aria-hidden`이라 **상태를 글자로 같이 보여야 한다**고 명시 | `kpi/kpi.tsx`, `kpi.vars.scss` |
| 배지(badge, pill 대체) | 종류 4가지: label(글자 "Online"), counter(99+), dot, status-icon. 깜빡임(pulse)은 "즉시 긴급"에만 | `ix-docs/docs/components/badge/guide.md` |
| 글자 규칙 | 상태색을 글자에 쓰지 않는다(대비 부족). 글자는 `alarm-text`(v6는 `text-danger` 등)를 따로 쓴다 | `docs/styles/colors.md` |

- **원칙 한 줄**: 상태는 "색 + 모양이 다른 아이콘 + 글자" 세 겹으로 보여 주고, 면 전체를 칠하기보다 얇은 띠로 표시한다(v6).
- **적용 아이디어**: 고장(D)=빨강 원형 아이콘, 예지보전 위험=팔각/주의=마름모처럼 **모양으로도 구분**하면 "예지보전 빨강 테두리 ↔ 고장 빨강 칸"이 헷갈리는 문제를 줄일 수 있다. 노랑(대기 I)은 iX처럼 **위 글자를 검정**으로 하고 노랑 글자는 쓰지 않는다(`#4d3901` 같은 진한 갈색만 허용).

---

## 4. 글꼴

| 항목 | v5 classic | v6 community |
|---|---|---|
| sans | `--theme-font-sans: "Siemens Sans"` (글꼴 파일은 패키지에 **없음**. foundation fallback: `'SiemensSans Pro VF', 'SiemensSans Pro', helvetica, arial, sans-serif, system-ui, …, 'Noto Sans', …`) | `--si-ref-typography-font-family-sans: Arial, helvetica, sans-serif` |
| mono | `"JetBrains Mono"` | `'Courier New', monospace` |
| 굵기 | normal 400 / bold 700 / black 900 | roman 400 / **sbold 600** / bold 700 |
| ligature | — | `font-feature-settings: 'clig' off, 'liga' off` (모든 글자 스타일 공통) |

**v6 글자 단계 (`--si-sys-typography-*`, font 단축 속성 전체 값)** — 기본 밀도

| 토큰 | 크기 / 줄높이 | 굵기 | 용도 |
|---|---|---|---|
| display-xxl | 58px / 1.24 | 400 (sbold 있음) | |
| display-xl | 48px / 1.33 | 400 | |
| display-lg | 40px / 1.3 | 400 | |
| display | 32px / 1.25 | 400 | 큰 숫자, KPI 값(한 줄) |
| h1 | 28px / 1.29 | 600 | |
| h2 | 24px / 1.33 | 600 | |
| h3 | 20px / 1.2 | 600 | **ix-kpi 값** |
| h4 | 16px / 1.25 | 600 | |
| h5 | 14px / 1.43 | 600 (h5-bold 700) | |
| h6 | 12px / 1.33 | 600 | |
| body-lg | 16px / 1.25 | 400 | |
| body | 14px / 1.14 | 400 | 한 줄 라벨·UI 글 |
| body-paragraph | 14px / 1.43 | 400 | 여러 줄 문단 |
| body-sm | 12px / 1.33 | 400 | |
| code / code-sm / code-lg | 14 / 12 / 16px | 400 | |
| compact 밀도 | body 12px, body-sm 10px, display 28px … | | |

**v5 크기 단계 (`--theme-ms-*`)**: -2=10px, -1=12px, 0=14px, 1=16px, 1-2=18px, 2=20px, 3=24px, 4=29px, 5=35px, 6=42px, 7=50px, 8=60px. h1=29px bold/1.2, h2=24/1.43, h3=20/1.5, h4=16/1.5, h5=14/1.43, h6=12/1.5, body=14/1.43, label=14/1.2, display=24/1.

- 문서 규칙: H1~H6=제목 계층, Body=여러 줄 글, Label=컴포넌트 안 한 줄 글, **Display=KPI 같은 큰 숫자 한 줄** (`ix-docs/docs/styles/typography/guide.md`).
- **tabular-nums 지침: 없음**. core scss와 문서 전체에서 `tabular`/`font-variant-numeric`이 한 번도 나오지 않는다. **확인 못 함 = 지침 없음.**
- 출처: `ix/packages/core/scss/theme/community/density/typography/_default.scss`, `_compact.scss`, `scss/mixins/_fonts.scss`, `scss/entries/_foundation.scss`, `@siemens/ix@5.3.0` classic CSS
- **적용 아이디어**: 기본 글자 14px, 제목 600 굵기, KPI 값은 20px(h3) 또는 32px(display)의 2단계로 정하면 iX와 같은 위계가 된다. tabular-nums는 우리 규칙대로 따로 둔다.

---

## 5. 간격·크기·둥글기·그림자

| 항목 | v6 값 | v5 값 |
|---|---|---|
| 간격 (spacing-x/y-10…140) | 2, 4, 6, **8, 12, 16, 20, 24, 32**, 40, 48, 64, 80, 96px | `--theme-space-0…8`: 6, 8, 12, 16, 24, 32, 48, 64, 96px |
| 크기 (size-10…200) | 2, 4, 8, 12, 16, 20, 24, **32, 40, 48**, 64, 80, 96, 120, 160, 240, 320, 480, 600, 720px | 컨트롤 높이 small 24 / **default 32** / large 40px |
| 둥글기 | none 0 / **xs 2px**(버튼·입력) / **sm 4px**(카드·토스트·블라인드·KPI) / full | min 0 / small 2px / default 4px |
| 테두리 두께 | default 1px / **selected 2px** / **emphasis 4px**(상태 띠) | |
| 포커스 링 | 2px, offset 1px | |
| 아이콘 | sm 16 / **md 20** / lg 24 / xl 32 / xxl 48 (compact는 한 단계 작음) | 기본 24 (v6부터 20) |
| 그림자 | shadow-10: `0 .5px 1px` 14% + `0 -.25px 1px` 12% / shadow-20: `0 1px 2px` 14% / shadow-30: `0 2px 6px` 14% (메뉴·드롭다운·툴팁) / shadow-40: `0 4px 12px` 14% (모달·알림) — 검정 기준, 다크는 60~80% | shadow-1~4, 떠 있는 요소는 shadow-4 `0 0 2px .2, 0 4px 8px .1, 0 12px 18px .1` |
| 움직임 | default 150ms(hover 등) / medium 300ms / slow 500ms / x-slow 1000ms. `prefers-reduced-motion`이면 전부 0 | 같음 |
| 브레이크포인트 | sm 576 / md 768 / lg 992 / xl 1200 / xxl 1400px | |

- **원칙**: 8px 바탕 간격 + 2·4·6px 보조. 둥글기는 2px/4px 두 가지뿐. 그림자는 떠 있는 층에만 쓴다.
- 출처: `ix/packages/core/scss/theme/community/density/sizing/_default.scss`, `light/_system.scss`(shadow), `theme/core/_common.scss`(time), `ix-docs/docs/styles/animation.md`, `elevation.md`
- **적용 아이디어**: 둥글기 2/4px, 컨트롤 높이 32px, 행 높이 40px, 아이콘 20px로 맞추면 "기업용 산업 SW" 인상이 바로 난다(둥글기가 크면 소비자 앱처럼 보임).

---

## 6. 컴포넌트 (우리 화면과 관련 있는 것)

| 컴포넌트 | 생김새·규칙 (v6 수치) | 우리 화면 |
|---|---|---|
| **Application header** | 높이 48px, 바탕 background-1, 아래 테두리 border-4. 왼쪽 회사 로고(높이 32px, SVG `currentcolor`) + 앱 이름(+ 보조 문구). 오른쪽 슬롯은 "전체 맥락 정보·모드 전환·현지 시각"용. "깔끔하고 가볍게 유지" | 상단 바: 로고 + "라인가동현황" + 오른쪽에 현재 시각·연결 상태 |
| **Application menu** (세로 내비) | 접힘 48px / 펼침 240px(고정, 바꿀 수 없음). 항목 높이 48px, 아이콘 + 라벨, 알림 숫자는 아이콘 오른쪽 위. 선택 항목 = background-0 바탕 + 강조 표시. 아래쪽 칸 = 설정·테마 전환·정보(화면 이동 안 함). 접혔을 때 hover하면 툴팁 | 왼쪽 메뉴 8개 화면, 알람 메뉴에 미확인 개수 |
| **Event list** | 행 높이 40px, 행 사이 8px, 왼쪽 8px 색 막대(itemColor), 안쪽 여백 16px, 오른쪽 chevron(불투명도 0.6). outline(테두리 border-3) / filled(background-1) 두 가지. 선택 = 강조색 테두리 | 알람 이력·실시간 고장 목록 |
| **Badge** (Pill은 v7에서 제거 예정) | label / counter(99+) / dot / status-icon. 높이 20px, 둥글기 full. 글자는 body-sbold. outline = 약한 강조 | 상태 글자 R/S/I/D 표시, 미확인 알람 개수 |
| **Chip** | 높이 32px, 좌우 여백 12px. 누르거나 닫을 수 있는 것만 chip, 읽기 전용은 badge | 필터 선택값 |
| **Category filter** | 검색 입력칸 안에서 "범주 = 값" 칩을 쌓는 필터(=, != 연산). 자동완성, 2줄 넘으면 스크롤 | 알람 이력 필터(라인·설비·등급) |
| **Tabs** | 높이 40px, 좌우 여백 24px, 선택 표시는 아래 선 | 라인 상세 탭, 가동률 기간 탭 |
| **Card** | 둥글기 4px, 테두리 1px, 내용 여백 16px 권장. v6: 기본 `base`(중립), 상태 카드는 **위쪽 4px 색 띠**만(면을 칠하지 않음). 카드는 그림자 없음. 카드 전체가 누르는 영역 | 설비 카드, 라인 요약 카드 |
| **Push card** | 높이 48px 영역에 알림 숫자 + 아이콘 + 제목/부제, 펼치면 관련 목록. 너비 320px | "고장 3건" 같은 요약 + 펼침 목록 |
| **KPI** (`ix-kpi`) | 높이 40px(세로 배치 64px), 라벨(text-secondary) + 값(h3 20px) + 단위(8px 띄움). 상태 = 아래 2px 테두리 색 + 16px 상태 아이콘 | 가동률·생산량 KPI |
| **Key value / list** | 라벨 최소 너비 120px, 행 여백 4~6px, 1px 구분선 | 설비 정보 패널 |
| **Toast** | 너비 320px 고정, 최소 높이 48px, 왼쪽 4px 상태 띠, 그림자 shadow-40. 종류 info/success/warning/error. 기본 위치 **오른쪽 아래**, 3~8초 자동 닫힘 + 남은 시간 막대, 새 것이 아래 | 고장 발생 토스트(D-81) |
| **Message bar** | 테두리 2px, 최소 높이 48px, 화면 상단 고정 알림 | 통신 끊김(DC) 같은 화면 전체 경고 |
| **Blind** (접는 영역) | 왼쪽 chevron + 라벨 + 보조 라벨 + 오른쪽 동작 버튼. 여러 개 쌓을 때 간격 8px. 상태 변형 있음(v6는 4px 띠) | 상세 화면의 접는 구획 |
| **Button** | 높이 32px, 둥글기 2px, 좌우 여백 8px, 최소 너비 80px | |
| **Toggle** | 스위치 48×24px | 설정 화면 |
| **Data grid** | `@siemens/ix-aggrid` (AG Grid 테마). 줄무늬 행 = background-2, 행 구분선 border-4, 헤더 바탕 background-1 + 아래 border-3, 헤더 글자 700, 세로 열 구분선 없음, hover = background-hover, 선택 = background-active. 행 클릭은 상세(pane/modal)를 열고 선택은 체크박스로 따로 | 알람 이력 표, 생산 이력 표 |
| **HTML table** | 기본 `<table>`에 스타일만 입힘. 줄무늬 옵션. 셀에 툴팁으로 맥락 제공(접근성 문서) | 가벼운 표 |

- **"완성된 산업용 제품" 느낌을 만드는 해부 규칙 (공통)**: ① 높이가 24/32/40/48px로 정해져 있음 ② 둥글기 2·4px ③ 레이아웃 안에는 그림자 없이 1px 테두리 ④ 상태는 4px 띠 / 8px 막대 / 2px 밑줄로 **얇게** ⑤ 상태 아이콘은 모양이 정해져 있음 ⑥ 보조 글자는 secondary 회색 ⑦ 오른쪽 chevron·hover 툴팁 같은 작은 단서.
- 출처: `ix/packages/core/src/components/*/*.vars.scss`, `ix-docs/docs/components/{application-header,application-menu,badge,pill,card,toast,blind,category-filter,grid,html-grid}/guide.md`, `ix/packages/aggrid/src/aggrid-ix-theme-params.ts`
- 확인 못 한 것: Event list·KPI·Tabs·Message bar의 **사용 지침 문서(guide.md)는 저장소에 없다**(코드 예시만 있음). 위 내용은 컴포넌트 소스에서 읽었다. Date picker는 조사하지 않았다.
- **적용 아이디어**: 알람 이력은 "왼쪽 8px 등급 막대 + 40px 행 + 등급 아이콘 + 글자" event-list 형태로, 표 화면은 aggrid 규칙(세로선 없음, 줄무늬, 헤더 굵게)으로 만들면 된다.

---

## 7. 대시보드와 차트

| 항목 | 내용 |
|---|---|
| 차트 라이브러리 | ECharts 테마 `@siemens/ix-echarts` (배포 4.1.1: `theme-classic-light/dark`, `theme-brand-*`. v6: `theme-community-light/dark`) |
| 공통 설정 | 선 굵기 2px, 점 4px 원, smooth 꺼짐, 막대 테두리 0, 바탕 투명, 축·눈금 `rgba(0,0,0,.3)`, 격자선 `rgba(0,0,0,.1)`, 축 글자 `rgba(0,0,0,.75)` (classic light). v6 light: 축 `#5B6A71`, 축 글자 `#000609`, 격자선 `#EBEDEE` |
| visualMap / 캔들 | 심각도 순 `#dc0031`, `#ff8d00`, `#f0b800` / 상승 `#339b00`, 하락 `#dc0031` (classic light) |
| 계열 순서 (classic light, 권장 순) | `#00838F`, `#00572B`, `#0041D6`, `#008A7C`, `#0076A8`, `#003C61`, `#7C40FF`, `#4A52F2`, `#900EEC`, `#9E5833`, `#6F2542`, `#AA32BE`, `#182171`, `#B74E2A`, `#73735E`, `#7A8000`, `#61778C` (청록·남색부터 시작 — 상태색과 겹치지 않음) |
| 계열 (classic dark) | `#00C2CC`, `#94FFC9`, `#9EBBFF`, `#00FFE7`, `#42C6FF`, `#A3EEFF`, `#B999FF`, … |
| 계열 (v6 community light `data-categorical-1…17`) | `#0096b4`, `#005159`, `#00890e`, `#1a747d`, `#3664c6`, `#002949`, `#7353e5`, `#553ba3`, `#740089`, `#d72323`(10번째에 빨강 나옴), `#4f153d`, `#c04774`, `#00237a`, `#643200`, `#7b5a00`, `#757563`, `#405158` |
| 평가색 (v6 `data-rating-*`) | excellent `#00a327`, good `#9ec625`, average `#fcb900`, poor `#e37200`, bad `#d72323` |
| 순차 팔레트 (v6) | 색마다 4단계 (`data-sequential-<hue>-1…4`), 예: blue `#4dd1e7 → #00bedc → #0087be → #00557c` |
| -40 변형 (v5) | 각 차트색의 40% 투명 버전 = "올해 vs 작년, 실적 vs 기준" 비교용 |
| 차트 지침 | 선·막대: Y축 0부터, 축 라벨 분명히, 간격 일정, **데이터 빈 구간은 눈에 보이게**. 게이지: 단순하게, 범위 구간은 색으로(초록=좋음, 빨강=위험) + **범위와 바늘 값에 글자 라벨**, 구간을 너무 많이 두지 않음 |
| 대시보드 패턴 | 카드 문서: "카드는 대시보드를 만들 때 쓴다", 레이아웃 그리드·카드 리스트로 묶고 왼쪽 위부터 배치. **별도의 대시보드 패턴 문서나 '시간에 따른 상태'(상태 타임라인/간트) 지침은 없음** — 확인 못 함 |

- **원칙**: 데이터색은 상태색과 따로 두고 청록·남색에서 시작한다. 비교는 같은 색의 40% 투명 버전으로 한다.
- 출처: `@siemens/ix-echarts@4.1.1/dist/index.js`, `ix/packages/echarts/src/themes/community-light.ts`, `ix-docs/docs/styles/colors.md`(chart 절), `docs/components/{charts-overview,line-chart,bar-chart,gauge-chart}/overview.mdx`, `card/guide.md`
- **적용 아이디어**: 24시간 상태 타임라인은 iX에 정해진 형태가 없으니 우리 상태 4색 그대로 쓰고, 생산량·추세 같은 일반 데이터 계열은 `#00838F` 같은 청록 계열에서 시작해 상태색과 섞이지 않게 한다. 계획 대비 실적은 "같은 색 100% / 40%"로.

---

## 8. 산업 HMI 원칙 (ISA-101 등)

| 찾은 것 | 내용 |
|---|---|
| ISA-101 / ISA-18.2 / IEC 62682 / EEMUA 191 | iX 문서·소스 어디에도 **언급 없음** (`ISA`, `HMI`, `EEMUA`, `acknowledg` 검색). "회색이 정상, 색은 이상에만"이라는 문장도 **명시돼 있지 않음** |
| 대신 있는 것 | ① ISO 3864-2 / ISO 7010을 근거로 한 위험 단계 색(Caution 노랑 → Warning 주황 → Danger 빨강 → Critical 보라). Critical은 "드물고 심각한 상황에만, 평범한 danger 알림을 달리 보여 주는 용도로 쓰지 말 것" ② v6 카드가 면 전체 칠하기에서 **중립 카드 + 4px 띠**로 바뀜 (사실상 "기본은 중립, 이상만 얇게 색") ③ 배지 pulse는 즉시 긴급일 때만 ④ 알람 메일 문구 규칙: 제목에 이유와 심각도, 본문에 무엇·언제·어디, 결과와 해결 방법, "may/should" 대신 행동 지시 |
| 알람 확인(acknowledge) | 컴포넌트·지침 **없음** |

- 출처: `ix-docs/blog/2026-09-08-colorchange/index.md`, `ix/BREAKING_CHANGES/v6.md`, `docs/components/badge/guide.md`, `docs/guidelines/language/operational-emails/operative-alarms-and-events/usage.mdx`
- **적용 아이디어**: ISA-101식 원칙(정상은 회색, 이상만 색)은 우리 CLAUDE.md "이상만 색"과 같지만 iX에서 빌려 올 근거는 아니다. 근거로는 ISO 3864 위험 단계와 v6의 "중립 카드 + 띠" 결정을 인용할 수 있다.

---

## 9. 아이콘 (`@siemens/ix-icons`)

| 항목 | 내용 |
|---|---|
| 라이선스 / 수 | MIT, 3.7.1 기준 SVG 1,490개 (외곽선 + `-filled` 쌍) |
| 그리드 | 24×24 설계, v6부터 기본 표시 20×20 |
| 모양 | 기하학적, **뾰족한 모서리와 직선**, 둥근 모서리는 대상이 원래 둥글 때만 |
| 선 | 기본 외곽선 2px (1.5/1px 허용), 도형 사이 틈 2px. 채운 버전은 활성·토글 상태나 무게가 더 필요할 때 |
| 색 | 단색. 실행 중에 맥락에 맞게 칠함 |
| 취소선 | 왼쪽 위 → 오른쪽 아래 대각선 + 2px 틈 (예: 알람 음소거) |
| 단독 아이콘 | 글자 없는 아이콘은 반드시 툴팁 + 스크린리더 설명 |
| 우리에게 쓸 만한 것 | `machine-a/b/c`, `robotic-arm`, `plant`, `sensor`, `maintenance*`, `namur-maintenance-required`, `disconnected`, `generic-device-{stop,pause,play,alarm,disconnected,maintenance}`, `emergency-stop`, `gauge`, `trend-*`, `alarm`, `alarm-bell`, `warning`, `warning-rhomb`, `warning-octagon`, `info`, `success` |

- 출처: `ix-docs/docs/icons/design-new-icons.md`, `icon-usage.mdx`, `@siemens/ix-icons@3.7.1` (`package.json` license MIT, `svg/`)
- **적용 아이디어**: MIT라서 SVG를 그대로 가져다 쓸 수 있다(새 의존성 추가는 먼저 물어볼 것). 상태 아이콘 모양 규칙(원·삼각·마름모·팔각)을 우리 R/S/I/D·예지보전 단계에 맞춰 쓰기 좋다.

---

## 우리에게 맞지 않는 점

1. **글꼴**: Siemens Sans는 브랜드 테마 전용이라 공개 패키지에 글꼴 파일이 없다. v6 community는 **Arial**로 바꿨다. 둘 다 한글 글리프가 없어 한국어 화면에서는 OS 대체 글꼴(맑은 고딕 등)로 떨어진다. 한글 글꼴(Pretendard, Noto Sans KR 등)은 우리가 따로 정해야 하고, iX 글자 단계(14px 기본, 600 굵기)는 한글에서 다시 확인해야 한다.
2. **브랜드 테마 사용 불가**: Siemens 로고·브랜드 테마는 Siemens AG 제품 전용이다. "Siemens처럼 보이게" 흉내 내면 안 되고, 원칙과 수치만 빌린다.
3. **상태 이름 충돌**: iX의 Warning·Critical 뜻이 v5와 v6에서 서로 반대로 바뀐다. 우리 상태(R/S/I/D)는 "위험 단계"가 아니라 "설비 운전 상태"다. 대기 I=노랑을 iX의 caution(주의)과 같은 뜻으로 섞지 말 것. 예지보전 주의/위험을 iX caution/danger에 맞추는 편이 의미가 맞다.
4. **R 가동 초록**: iX는 success 초록을 "완료·정상 결과"에 쓰고, 화면에 넓게 깔리는 기본 상태로 쓰지는 않는다. 39대 대부분이 가동이면 초록이 화면을 채운다 → 우리 "이상만 색" 원칙과 부딪친다. R은 옅게 하거나 띠·점으로만 칠하는 방법을 생각해 볼 것.
5. **다크 기본**: 옛 기본이 다크였고 문서 시연도 다크 위주지만, 이유가 문서에 없고 v5부터는 중립이다. 우리는 사무실 라이트 화면이니 light 값을 기준으로 삼는다.
6. **대시보드·타임라인·알람 확인 지침 없음**: 24시간 상태 타임라인, OEE, 알람 확인 절차는 iX에서 빌릴 것이 없다. 직접 정해야 한다.
7. **tabular-nums 지침 없음**: 1초 갱신 숫자 고정 폭은 우리 규칙으로 따로 둔다.
8. **컴포넌트 라이브러리 자체**: `@siemens/ix-vue`는 Web Components(Stencil) 기반이라 새 UI 라이브러리를 들이는 셈이다(CLAUDE.md: 먼저 물어봐야 함). 토큰과 규칙만 옮기는 쪽이 맞다.
9. **v6 미출시**: v6 토큰은 2026-11 현재 main/beta에만 있어 값이 바뀔 수 있다. 확정값이 필요하면 v5.3.0 classic을 인용하고, v6는 "방향" 근거로만 쓴다.

---

### 재현용 자료 (scratchpad)
- 소스 클론: `research/src/ix` (sparse), `research/src/ix-docs` (md만)
- npm: `research/pkgs/siemens-ix-5.3.0`, `siemens-ix-echarts-4.1.1`, `siemens-ix-aggrid-5.1.0`, `icons`
- 토큰 풀이 스크립트: `research/scripts/resolve.mjs` (v6 sys→hex), `research/scripts/pair.mjs` (classic light/dark 비교)
