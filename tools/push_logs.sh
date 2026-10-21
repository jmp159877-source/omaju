#!/usr/bin/env bash
# 봇이 남기는 기록을 main 이 아니라 logs 가지에 올린다 (운영자 2026-10-20).
#   까닭: Vercel 은 빌드를 건너뛴 커밋도 '배포 한 건'으로 센다. 하루 한도가 100건인데
#   밤새 쌓이는 기록 커밋만으로 60건 가까이 먹어, 정작 화면을 고쳐 올릴 자리가 없어졌다.
#   화면이 읽는 data/*.json 은 main 에 그대로 두고, 아무도 읽지 않는 기록만 이리로 보낸다.
#
# 쓰는 법:  tools/push_logs.sh daily/last-radio.log daily/2026-10-21.json ...
#   없는 파일은 그냥 건너뛴다. 실패해도 워크플로를 죽이지 않는다(기록일 뿐이므로).
set -u
[ $# -gt 0 ] || exit 0
: "${GITHUB_TOKEN:?GITHUB_TOKEN 없음}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY 없음}"

URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
WORK=$(mktemp -d)

# 먼저 있던 기록을 받아 온다 — 기록 없이 밀어 넣는 방식이라, 안 받아 오면 서로의 것을 지운다.
git clone -q --depth 1 --branch logs "$URL" "$WORK/old" 2>/dev/null && rm -rf "$WORK/old/.git" || mkdir -p "$WORK/old"

n=0
for f in "$@"; do
  [ -f "$f" ] || continue
  mkdir -p "$WORK/old/$(dirname "$f")"
  cp "$f" "$WORK/old/$f"
  n=$((n+1))
done
[ $n -gt 0 ] || { rm -rf "$WORK"; exit 0; }

cd "$WORK/old" || exit 0
# Vercel 이 가지 푸시도 '배포 한 건'으로 센다 — 이 가지에서는 아예 배포하지 않게 못 박아 둔다.
printf '%s\n' '{ "git": { "deploymentEnabled": false } }' > vercel.json
git init -q -b logs
git config user.name omaju-bot
git config user.email bot@omaju.kr
git add -A
git commit -qm "기록 $(date -u +%F\ %H:%M) [skip ci]" 2>/dev/null || { cd /; rm -rf "$WORK"; exit 0; }
for i in 1 2 3; do git push -q -f "$URL" logs && break; sleep 5; done
cd /; rm -rf "$WORK"
echo "기록 $n 개를 logs 가지에 올림"
