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
POLITICS = ("위성락", "안보실", "미군", "한-미 협정", "한미 협정", "대통령", "장동혁", "선거", "투표", "당대표", "검증 현장", "탄핵", "계엄", "지지율", "공천", "美", "北", "中 ", "日 ", "대사", "외교", "주한미군", "국방", "항의", "규탄", "李 ", "李,", "尹", "與", "野", "정부 ", "장관", "주진우", "의원",  "영부인", "여사", "대통령실", "청와대", "국회", "여당", "야당", "국민의힘", "민주당", "혁신당", "개혁신당",
            "의원", "장관", "총리", "검찰", "공수처", "특검", "탄핵", "개각", "총선", "대선", "지방선거",
            "공천", "국정감사", "국감", "대정부질문", "원내대표", "당대표", "비대위", "정치권", "여야", "청문회",
            "감찰관", "특별감찰", "정치", "사법부", "판사", "재판", "무죄", "유죄", "선고", "기소", "검사", "시장 후보", "구청장", "지사", "정당", "국정", "윤석열", "이재명", "한동훈", "김건희", "오세훈", "김민석", "조국", "북한", "북 ", "미사일", "자주포", "군사", "전쟁", "도발", "안보", "외교", "트럼프", "관세", "여론", "조세", "종부세", "세제", "5·18", "5.18", "민주화", "이념", "보수", "진보", "좌파", "우파")
# 사건·사고 — 아침에 보는 잡지에 올리지 않는다
ENT_SKIP = ("승리", "눈물", "토로", "오열", "심경", "혼인", "임신", "출산", "열애", "이혼", "아빠 된다", "엄마 된다", "결혼 발표", "비밀 결혼", "결혼", "허리", "몸매", "각선미", "비주얼", "미모", "얼굴 크기", "인형", "비키니", "노출", "볼륨", "망언", "사태", "호감도", "비호감", "저격")  # 10/30: 장원영 '한 줌 허리' — 외모 품평도 거른다  # 10/29 클국장: '솔비, 이규한과 결혼 결심한 이유'가 끼었다
GRIM = ("살해", "결혼설", "빅뱅 승리", "빅뱅 출신 승리", "前 빅뱅", "비밀 결혼", "출산설", "열애설", "임신설", "이혼설", "결별설", "설 제기", "아빠 되나", "엄마 되나", "산재", "공황", "갑질", "서 불", "에서 불", "불, ", "불이 ", "대응 1단계", "대응 2단계", "소방", "진화", "산불", "불륜", "폭로", "사과 거부", "사과 요구", "외도", "이혼 소송", "악플", "악성 댓글", "저격", "갑론을박", "숨진", "숨져", "사망", "故", "추서", "타계", "영면", "추모", "장례", "유족", "시스템 장애", "먹통", "털렸", "해킹", "발칵", "[사설]", "시신", "흉기", "성폭행", "성범죄", "몰카", "음주운전", "참사",
        "추락사", "자살", "극단적", "학대", "마약", "화재로", "실종", "유족", "부고", "별세", "빈소",
        "구속", "영장", "징역", "피소", "고소", "고발", "소송", "논란", "의혹", "갑질", "폭행",
        "방화", "불길", "범행", "피의자", "검거", "체포", "흉악", "화재", "불이 나", "사고", "탈출", "녹취", "숨지", "부상", "해킹", "유출", "사기", "해커", "범죄", "털어", " 턴 ", "경찰", "수사", "혐의",
        "이태원", "특조위", "참사", "세월호", "희생자", "이혼", "前남편", "前부인", "전남편", "전처", "파경", "결별",
        "패소", "승소", "분쟁", "배상", "해명", "반박", "폭발", "정부,",
        "억까", "결례", "불화", "갈등", "경매", "사라진다", "무거운 표정", "밀린 월급", "체불", "줄 돈도")  # 10/30 클국장: 장원영 '결례' 억까·모레노 불화설·체코 원전 갈등·옥주현 경매·'퇴직금 사라진다'가 끼었다  # 10/29 클국장: 엘리엇 패소·헤이지니 반박·가스폭발이 끼었다  # 2026-10-28 클국장: 이태원특조위·서인영 이혼 고백이 끼었다


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
            if len(re.findall(r"[가-힣]", t)) < len(t.replace(" ", "")) * 0.4: continue   # 한글이 거의 없는 제목('2026년 10월 FOMC Comments', 10/30)
            if cat == "스포츠" and re.search(r"\d회[초말]|\d+-\d+\s*$|전반|후반 \d+분", t): continue   # 경기 중 점수는 아침이면 지난 이야기(10/30 '6회말 동점 4-4')
            if cat == "연예" and any(w in t for w in ENT_SKIP):   # 연예인 사생활(결혼·임신·열애)·범죄 전력자 소식은 아침 잡지에 맞지 않는다(2026-10-28)
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


# 구글 없이 고르기 (대표 2026-10-27 — 구글 선불 잔액이 바닥나 "구글에 낼 돈"을 없애기로) — 이제 기본.
# 뉴스 순서(많이 오르내린 차례)대로 분야마다 앞에서부터, 한 분야 둘까지, 날씨·시세 제목은 뺀다.
# 문장은 제목을 다듬기만 한다([단독]·따옴표·말줄임 걷기, 45자 안쪽) — 제목에 있는 말만 남으니 없는 사실이 보태질 일이 없다.
SKIP = ("날씨", "기온", "비 소식", "눈 소식", "미세먼지", "추위", "영하", "한파", "출근길", "쌀쌀", "강풍", "환율", "코스피", "코스닥", "주가", "증시", "마감", "광고", "이벤트", "할인")
def tidy(t):
    if " - " in t and len(t.rsplit(" - ", 1)[1]) <= 25: t = t.rsplit(" - ", 1)[0]   # 끝에 남은 ' - 언론사'
    t = re.sub(r"^\s*[\[(【<][^\])】>]{1,8}[\])】>]\s*", "", t)          # 앞의 [단독]·(종합)
    t = re.sub(r"[\[(【<](종합|단독|속보|영상|사진|포토|인터뷰)[^\])】>]*[\])】>]", "", t)
    t = re.sub(r"\s*\[[^\]]*\]\s*$", "", t)                       # 끝에 붙은 [○○의 개장전 요것만] 같은 꼭지 이름 (10/30)
    t = re.sub(r"[\"'“”‘’]", "", t); t = re.sub(r"\s*(…|‥|···|··|\.{2,}|[!?])+\s*", ", ", t); t = re.sub(r"(,\s*)+", ", ", t)
    t = re.sub(r"\s+", " ", t).strip(" ,·")
    t = re.sub(r"\s*[\[(【<][^\])】>]*$", "", t).strip(" ,·")      # 자르다 남은 여는 괄호 조각
    if len(t) > 45:
        cut = t[:45]; sp = max(cut.rfind(" "), cut.rfind(","))
        t = (cut[:sp] if sp > 25 else cut).strip(" ,·")
        t = re.sub(r"\s*[\[(【<][^\])】>]*$", "", t).strip(" ,·")
    return t
def pick_rule(pool):
    per, out, cats = {}, [], ["경제", "사회", "스포츠", "연예"]
    for rnd in range(2):
        for c in cats:
            for p in pool:
                if p["cat"] != c or any(w in p["title"] for w in SKIP) or any(o["url"] == p["url"] for o in out): continue
                if per.get(c, 0) > rnd: break
                line = tidy(p["title"])
                if len(line) < 10: continue
                out.append({"cat": c, "line": line, "title": p["title"], "src": p["src"], "url": p["url"]}); per[c] = per.get(c, 0) + 1
                break
            if len(out) >= 5: return out
    return out


def main():
    pool = gather()
    if len(pool) < 8:
        print("쓸 만한 제목이 모자람 — 그만둠", file=sys.stderr)
        sys.exit(1)

    got = None
    if os.environ.get("ISSUES_AI"):   # 구글로 고쳐 쓰기는 일부러 켤 때만
        try:
            G.gemini.models = G.list_models()
            listing = "\n".join(f"{i}. [{p['cat']}] {p['title']}" for i, p in enumerate(pool))
            got = G.gemini(PROMPT.format(list=listing))
        except Exception as e:
            print("[구글 실패 → 규칙으로]", str(e)[:120], file=sys.stderr)
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
        items = pick_rule(pool)
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
