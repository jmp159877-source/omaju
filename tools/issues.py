# 오마주 오늘의 이슈 — 경제·사회·스포츠·연예에서 오늘 가장 많이 오르내린 제목 다섯 줄.
# 하루에 네 번 GitHub Actions 가 돌려 Firestore settings/issues 에 저장한다(커밋하지 않는다).
#
# 지키는 것 (운영자 2026-10-20):
#   · 정치는 넣지 않는다. 아침에 보는 잡지에 정쟁이 올라오면 안 된다.
#   · 사건·사고(죽음·범죄·참사)도 넣지 않는다. 뉴스 앱이 아니라 라이프스타일 매거진이다.
#   · 낚시 제목을 그대로 베끼지 않는다. AI 는 '제목에 있는 사실'만 한 줄로 고쳐 쓴다 —
#     없는 숫자·이름·원인을 보태면 그 자리에서 거짓말이 된다.
import os, re, sys, json, html, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_daily as G

KST = datetime.timezone(datetime.timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (omaju.kr today issues)"}

TOPICS = [("경제", "BUSINESS"), ("사회", "NATION"), ("스포츠", "SPORTS"), ("연예", "ENTERTAINMENT")]

# 정치 — 통째로 뺀다
POLITICS = ("대통령", "대통령실", "청와대", "국회", "여당", "야당", "국민의힘", "민주당", "혁신당", "개혁신당",
            "의원", "장관", "총리", "검찰", "공수처", "특검", "탄핵", "개각", "총선", "대선", "지방선거",
            "공천", "국정감사", "국감", "대정부질문", "원내대표", "당대표", "비대위", "정치권", "여야", "청문회",
            "감찰관", "특별감찰")
# 사건·사고 — 아침에 보는 잡지에 올리지 않는다
GRIM = ("살해", "숨진", "숨져", "사망", "시신", "흉기", "성폭행", "성범죄", "몰카", "음주운전", "참사",
        "추락사", "자살", "극단적", "학대", "마약", "화재로", "실종", "유족", "부고", "별세", "빈소",
        "구속", "영장", "징역", "피소", "고소", "고발", "소송", "논란", "의혹", "갑질", "폭행",
        "방화", "불길", "범행", "피의자", "검거", "체포", "흉악")


def rss(topic):
    url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl=ko&gl=KR&ceid=KR:ko"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        root = ET.fromstring(r.read())
    out = []
    for it in root.iter("item"):
        t = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src = (it.findtext("source") or "").strip()
        if not t or not link:
            continue
        # 구글 뉴스 제목은 "제목 - 언론사" 꼴이다
        if " - " in t and not src:
            t, src = t.rsplit(" - ", 1)
        elif " - " in t and t.endswith(" - " + src):
            t = t[: -(len(src) + 3)]
        out.append({"title": html.unescape(t).strip(), "src": src or "", "url": link})
    return out


def norm(s):
    return re.sub(r"[^가-힣a-zA-Z0-9]", "", s)


def gather():
    seen, pool = set(), []
    for cat, topic in TOPICS:
        try:
            items = rss(topic)
        except Exception as e:
            print(f"[{cat}] 못 받음: {str(e)[:80]}", file=sys.stderr)
            continue
        kept = 0
        for it in items:
            t = it["title"]
            if any(w in t for w in POLITICS) or any(w in t for w in GRIM):
                continue
            k = norm(t)[:18]
            if not k or k in seen:
                continue
            seen.add(k)
            it["cat"] = cat
            pool.append(it)
            kept += 1
            if kept >= 12:
                break
        print(f"[{cat}] {kept} 건")
    return pool


PROMPT = """아래는 오늘 한국 뉴스에서 많이 오르내린 제목들이다. 분야와 번호가 붙어 있다.

{list}

이 중에서 **다섯 개**를 골라라. 고르는 기준:
· 네 분야(경제·사회·스포츠·연예)가 되도록 고루 섞이게. 한 분야에서 둘까지만.
· 40~60대가 오늘 누군가와 이야기할 때 꺼낼 만한 것. 알아 두면 쓸모 있는 것.
· 같은 사건을 다룬 제목이 여럿이면 하나만.
· 특정인을 깎아내리는 것, 자극적인 것, 광고성인 것, 몇 달째 이어지는 뻔한 것은 고르지 않는다.
· **날씨·기온 예보는 고르지 않는다.** 바로 윗칸이 '오늘의 날씨'라 같은 말이 두 번 나온다.
· 환율·주가 숫자만 있는 것도 고르지 않는다. 윗칸이 '오늘의 경제'다.

고른 것마다 제목을 **한 문장(공백 포함 45자 안쪽)**으로 고쳐 쓴다.
· **제목에 있는 사실만 쓴다.** 제목에 없는 숫자·이름·원인·결과를 절대 보태지 않는다. 모르면 짧게 쓴다.
· 낚시·호들갑·물음표·느낌표·따옴표 금지. "충격", "발칵", "초유" 같은 말 금지.
· 신문 1면 제목이 아니라, 아는 사람이 담담하게 알려 주는 한 문장으로.

JSON 하나만 출력:
{{"items":[{{"n":번호,"cat":"경제","line":"한 문장"}}]}}"""


def main():
    pool = gather()
    if len(pool) < 8:
        print("쓸 만한 제목이 모자람 — 그만둠", file=sys.stderr)
        sys.exit(1)

    G.gemini.models = G.list_models()
    listing = "\n".join(f"{i}. [{p['cat']}] {p['title']}" for i, p in enumerate(pool))
    got = G.gemini(PROMPT.format(list=listing))
    items = []
    for x in (got or {}).get("items", []):
        try:
            p = pool[int(x["n"])]
        except Exception:
            continue
        line = re.sub(r"\s+", " ", str(x.get("line", ""))).strip()
        if not line or len(line) > 60:
            continue
        if any(u["url"] == p["url"] for u in items):
            continue
        items.append({"cat": x.get("cat") or p["cat"], "line": line,
                      "title": p["title"], "src": p["src"], "url": p["url"]})
    items = items[:5]
    if len(items) < 3:
        print(f"고른 것이 {len(items)} 개뿐 — 그만둠", file=sys.stderr)
        sys.exit(1)

    doc = {"items": items, "updatedAt": datetime.datetime.now(KST).isoformat()}
    for i in items:
        print(f"  [{i['cat']}] {i['line']}  ({i['src']})")
        # 실행 기록(로그)은 이 상자 밖에서 내려받을 수 없다 → 눈에 보이는 알림으로 남겨 나중에 읽는다
        if os.environ.get("GITHUB_ACTIONS"):
            print(f"::notice title=오늘의 이슈::[{i['cat']}] {i['line']} ({i['src']}) ← {i['title']}")
    if os.environ.get("DRY"):
        return
    db = G.firestore()
    db.collection("settings").document("issues").set(doc)
    print("저장 완료", doc["updatedAt"])


if __name__ == "__main__":
    main()
