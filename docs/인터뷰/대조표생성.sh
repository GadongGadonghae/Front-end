#!/usr/bin/env bash
# 결정 ↔ 구현 대조표를 src 주석의 D-xx로 다시 만든다 (docs/인터뷰/05_결정_구현대조표.md)
# 쓰기: bash docs/인터뷰/대조표생성.sh > docs/인터뷰/05_결정_구현대조표.md
set -euo pipefail
SRC_GLOBS=(--include=*.ts --include=*.vue --include=*.css)

cat <<'HEAD'
# 결정 ↔ 구현 대조표

`02_결정사항_미결.md`의 D-xx가 **어느 코드에 들어 있는지** 거꾸로 찾는 표다.
결정을 고칠 때 손봐야 할 파일을 바로 보고, 결정과 코드가 어긋난 곳을 찾는 데 쓴다.

- 코드 → 결정 방향은 주석의 D-xx로 이미 된다 (`grep -rn "D-109" src`). 이 표는 그 반대 방향이다.
- 주석을 모아 만든 것이라 **손으로 고치지 않고 다시 생성한다**: `bash docs/인터뷰/대조표생성.sh > docs/인터뷰/05_결정_구현대조표.md`
- 코드에 안 나오는 결정은 표에 없다. 명세·진행 방식 결정(D-01 등)이거나, 아직 구현하지 않은 것이다.

| 결정 | 파일 수 | 구현 파일 (`src/` 기준) |
|---|---|---|
HEAD

for id in $(grep -roh "D-[0-9]\{1,3\}" src "${SRC_GLOBS[@]}" | sort -u -t- -k2 -n); do
  list=$(grep -rl "\b$id\b" src "${SRC_GLOBS[@]}" | sed 's|^src/||' | sort)
  n=$(printf '%s\n' "$list" | wc -l | tr -d ' ')
  files=$(printf '%s\n' "$list" | awk '{printf "%s`%s`", (NR>1 ? " · " : ""), $0}')
  echo "| $id | $n | $files |"
done

printf '\n_마지막 생성: %s_\n' "$(date +%Y-%m-%d)"
