#!/usr/bin/env bash
# 최근 N일 가운데 인사 카드 그림이 없는 날을 그려 둔다 (daily.yml · greet_imgs.yml 이 부른다)
N=${1:-7}
pip install -q pillow >/dev/null 2>&1
(cd tools && [ -d node_modules/puppeteer-core ] || { npm init -y >/dev/null; npm i --no-audit --no-fund puppeteer-core@23 >/dev/null 2>&1; })
export CHROME=$(which google-chrome || which chromium-browser || which chromium || echo /usr/bin/google-chrome)
for d in $(python3 -c "import datetime as D;t=D.datetime.now(D.timezone(D.timedelta(hours=9))).date();print(' '.join(str(t-D.timedelta(i)) for i in range($N)))"); do
  [ -f daily/$d.json ] || continue
  [ -f greet/img/$d-1.jpg ] && [ "$FORCE" != "1" ] && continue
  node tools/shorts_cards.mjs $d /tmp/gc/$d && python3 tools/greet_imgs.py $d /tmp/gc/$d
done
true
