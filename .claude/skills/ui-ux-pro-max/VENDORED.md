# 저장소에 넣은 외부 스킬 — ui-ux-pro-max

| 항목 | 값 |
|---|---|
| 원본 | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| 버전 | v2.15.0 (커밋 `a38d04c3d5c298c851dbe5e6ee1965ee3de42cb5`, 2026-08-14) |
| 가져온 곳 | 원본 `.claude/skills/ui-ux-pro-max/` 폴더 하나 |
| 라이선스 | MIT (`LICENSE` 동봉) |
| 넣은 날 | 2026-11-19 (D-100) |

## 원본에서 바꾼 곳
1. `scripts/tests/` 삭제 (실행에 필요 없음).
2. `SKILL.md` 머리말: `description`을 이 프로젝트 용도로 바꾸고 `disable-model-invocation: true` 추가 → `/ui-ux-pro-max`로 부를 때만 동작. 원본 설명은 모든 UI 작업에 자동으로 끼어들어 unslop·impeccable과 부딪힌다.
3. `SKILL.md` 맨 앞에 "이 프로젝트에서 쓰는 법" 블록 추가.
4. `SKILL.md`의 스크립트 경로 `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py` → `.claude/skills/ui-ux-pro-max/scripts/search.py` (플러그인이 아니라 저장소 안 스킬이라서).

## 넣기 전 점검
- `scripts/*.py`: 네트워크 호출·외부 명령 실행 없음 (`urllib`은 `validate_data.py`의 문자열 파싱만). 표준 라이브러리만 씀, Python 3 필요.
- 파일 쓰기: `--persist`·`--preview`를 줄 때만. 이 프로젝트에서는 쓰지 않음.
- 원본 플러그인에 딸린 다른 스킬(banner-design, brand, design, design-system, slides, ui-styling)은 넣지 않음.

## 버전 올리기
원본 저장소의 새 태그 중 **나온 지 2주 넘은 것**을 고르고, 같은 폴더만 다시 가져와 위 1~4를 다시 적용한 뒤 이 파일의 버전을 고친다.
