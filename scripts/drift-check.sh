#!/usr/bin/env bash
# 결정(D-xx) · 코드 · 문서 · 기억이 어긋난 곳을 한 바퀴 본다 (CLAUDE.md "기록" 절).
# 쓰기: npm run drift   또는   bash scripts/drift-check.sh
#
# 끊지 않는 점검이다. 경고만 보여 주고 끝에 개수만 알려 준다 (종료 코드는 늘 0).
# 2026-11-20 실제로 겪은 사고 세 가지를 잡도록 만들었다:
#   ① 코드가 가리키는 D-xx가 결정 로그에 없거나 대체된 번호 (낡은 주석)
#   ② 대조표가 지금 코드와 다름 (결정을 고치고 표를 다시 안 뽑음)
#   ③ 규칙 절이 다른 브랜치 CLAUDE.md에만 있고 이 브랜치엔 없음
set -uo pipefail
cd "$(dirname "$0")/.."

LOG=docs/인터뷰/02_결정사항_미결.md
TABLE=docs/인터뷰/05_결정_구현대조표.md
GEN=docs/인터뷰/대조표생성.sh
SRC_GLOBS=(--include=*.ts --include=*.vue --include=*.css)
warn=0
say() { printf '%s\n' "$*"; }
flag() { printf '  ⚠ %s\n' "$*"; warn=$((warn + 1)); }

say "결정·코드·문서 점검 ($(date +%Y-%m-%d))"

# ── ① 코드가 가리키는 D-xx가 결정 로그에 있나 ──
say ""
say "① 코드 주석의 D-xx ↔ 결정 로그"
for id in $(grep -roh "D-[0-9]\{1,3\}" src "${SRC_GLOBS[@]}" | sort -u -t- -k2 -n); do
  row=$(grep -m1 "^| ~\{0,2\}$id~\{0,2\} |" "$LOG" || true)
  if [ -z "$row" ]; then
    flag "$id: 코드에 있는데 결정 로그에 없음 → $(grep -rl "\b$id\b" src "${SRC_GLOBS[@]}" | head -3 | tr '\n' ' ')"
  elif printf '%s' "$row" | grep -q "^| ~~"; then
    flag "$id: 결정 로그에서 취소·대체된 번호인데 코드가 아직 가리킴 → $(grep -rl "\b$id\b" src "${SRC_GLOBS[@]}" | head -3 | tr '\n' ' ')"
  fi
done
[ "$warn" -eq 0 ] && say "  어긋난 것 없음"

# ── ② 대조표가 지금 코드와 같나 ──
say ""
say "② 결정↔구현 대조표 최신 여부"
before=$warn
if [ -x "$GEN" ] || [ -f "$GEN" ]; then
  tmp=$(mktemp)
  bash "$GEN" > "$tmp" 2>/dev/null || true
  # 끝의 "마지막 생성" 날짜 줄은 빼고 비교
  if ! diff -q <(grep -v '^_마지막 생성' "$TABLE") <(grep -v '^_마지막 생성' "$tmp") >/dev/null 2>&1; then
    flag "대조표가 지금 코드와 다름 → bash $GEN > $TABLE"
  fi
  rm -f "$tmp"
else
  flag "생성기를 찾을 수 없음: $GEN"
fi
[ "$warn" -eq "$before" ] && say "  최신"

# ── ③ 규칙 절이 다른 브랜치 CLAUDE.md에만 있지 않나 ──
say ""
say "③ CLAUDE.md 규칙 절이 브랜치 사이에서 빠지지 않았나"
before=$warn
here=$(grep -o '^\*\*[^*]*\*\*$' CLAUDE.md | sort -u)
for b in $(git for-each-ref --format='%(refname:short)' refs/heads | grep -v "^$(git branch --show-current)$"); do
  other=$(git show "$b:CLAUDE.md" 2>/dev/null | grep -o '^\*\*[^*]*\*\*$' | sort -u) || continue
  [ -z "$other" ] && continue
  missing=$(comm -13 <(printf '%s\n' "$here") <(printf '%s\n' "$other") | tr '\n' ' ')
  [ -n "${missing// /}" ] && flag "$b 에만 있는 절: $missing"
done
[ "$warn" -eq "$before" ] && say "  빠진 절 없음"

# ── ④ 기억: 색인과 파일이 맞나 (저장소 밖, 있을 때만) ──
MEM="$HOME/.claude/projects/C--dev-11-sfaas-0-project-front/memory"
if [ -d "$MEM" ]; then
  say ""
  say "④ 기억 색인 ↔ 파일"
  before=$warn
  for f in "$MEM"/*.md; do
    n=$(basename "$f")
    [ "$n" = "MEMORY.md" ] && continue
    grep -q "($n)" "$MEM/MEMORY.md" || flag "$n: 파일은 있는데 색인(MEMORY.md)에 없음 → 색인에 넣거나, 규칙이면 CLAUDE.md로 옮기고 지울 것"
  done
  [ "$warn" -eq "$before" ] && say "  맞음"
fi

say ""
if [ "$warn" -eq 0 ]; then
  say "어긋난 곳 없음."
else
  say "경고 $warn 건. 고치고 다시 돌리거나, 그대로 두는 이유를 결정 로그에 적을 것."
fi
exit 0
