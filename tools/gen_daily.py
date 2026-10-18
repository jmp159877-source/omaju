# 오마주 매일 콘텐츠 자동 생성
# 매일 자정(한국 시간) GitHub Actions가 실행한다.
#   1) Gemini로 그날 글을 만들고 (인사말·운세·그해 오늘·한 끼·퀴즈·사연)
#   2) 노래는 tools/songs.json 에서 10곡을 골라 붙이고
#   3) Firestore daily/{YYYY-MM-DD} 에 저장한다.
# 사이트(js/app.js)는 daily 문서가 있으면 그것을, 없으면 js/content.js 기본값을 쓴다.
# 필요한 비밀값(GitHub Secrets): GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 전체)

import os, sys, json, re, time, datetime, urllib.request, urllib.error, urllib.parse, random

KST = datetime.timezone(datetime.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"]  # 목록 조회가 안 될 때의 예비

def list_models():
    """구글에서 지금 쓸 수 있는 Flash 모델을 최신순으로 고른다 (이름이 바뀌어도 코드를 안 고치게)."""
    try:
        with urllib.request.urlopen(f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_KEY}&pageSize=200", timeout=30) as r:
            ms = json.load(r).get("models", [])
        names = [m["name"].split("/")[-1] for m in ms if "generateContent" in m.get("supportedGenerationMethods", [])]
        flash = [n for n in names if "flash" in n and "lite" not in n and "image" not in n and "tts" not in n and "live" not in n and "audio" not in n]
        def ver(n):
            m = re.search(r"gemini-(\d+)(?:\.(\d+))?", n); return (int(m.group(1)), int(m.group(2) or 0), 0 if "preview" in n or "exp" in n else 1) if m else (0, 0, 0)
        flash.sort(key=ver, reverse=True)
        picked = flash[:3]
        if not picked:
            picked = MODELS
        print("[models]", picked[:4])
        return picked
    except Exception as e:
        print("[models] 목록 조회 실패, 예비 목록 사용:", e, file=sys.stderr)
        return MODELS

ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
QUIZ_KINDS = ["사자성어", "속담", "우리말", "상식", "역사"]

STYLE = """너는 '오마주'의 편집자다. 오마주는 60~70대가 매일 아침 5분 보는 한국어 사이트다.
원칙: 이들을 젊게 대한다. 가르치지 않고 돌보지 않고 같이 논다.
말투: 담백하고 품격 있는 존댓말("~입니다", "~세요"). 짧은 문장. 과장·느낌표·이모지 금지.
절대 쓰지 않는 말: 시니어, 어르신, 노인, 노년, 은퇴, 치매, 두뇌, 건강관리, 효도, 실버, 황혼.
한자는 사자성어 표기 외에는 쓰지 않는다. 외래어 남발 금지.
반드시 JSON만 출력한다. 설명·마크다운·코드펜스 없이 JSON 객체 하나만."""


def today():
    return datetime.datetime.now(KST).date()


import threading
_lock = threading.Lock()
_last_call = [0.0]
MIN_GAP = 7.0  # 무료 등급 분당 호출 제한을 넘지 않게 호출 사이 최소 간격(초)


def _pace():
    with _lock:
        wait = _last_call[0] + MIN_GAP - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()


def _retry_delay(detail):
    m = re.search(r'"retryDelay":\s*"(\d+)', detail or "")
    return min(int(m.group(1)) + 2, 70) if m else 30


# 모든 글에 붙는 품격 기준 (운영자 당부)
QUALITY = """
[품격 기준] 고급 라이프스타일 매거진에 실릴 수준으로 쓴다. 40~60대 교양 있는 독자가 읽는다.
뻔하고 상투적인 표현, 누구나 아는 흔한 소재, 유치한 말장난, 과장된 감탄은 쓰지 않는다. 그렇다고 어렵거나 현학적이지 않게, 담백하고 구체적으로.
'시니어·어르신·노인·치매·두뇌·은퇴' 같은 말은 쓰지 않는다."""

def gemini(prompt, json_mode=True, search=False, max_retry=None, timeout=None):
    """Gemini REST 호출. json_mode면 JSON 객체를 파싱해 돌려준다."""
    if max_retry is None:
        max_retry = 1 if search else 4
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY 없음")
    prompt = prompt + "\n" + QUALITY
    if search and getattr(gemini, "search_ok", True) is False:
        raise RuntimeError("검색 기능 사용 불가(앞서 확인됨)")
    errs = []
    for model in list(gemini.models):
        for attempt in range(max_retry):
            body = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": STYLE}]},
                "generationConfig": {"temperature": 0.9, "maxOutputTokens": 8192},
            }
            if json_mode and not search:
                body["generationConfig"]["responseMimeType"] = "application/json"
            if search:
                body["tools"] = [{"google_search": {}}]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            _pace()
            try:
                with urllib.request.urlopen(req, timeout=(timeout or (60 if search else 90))) as r:
                    res = json.load(r)
                text = "".join(p.get("text", "") for p in res["candidates"][0]["content"]["parts"])
                return text if not json_mode else parse_json(text)
            except urllib.error.HTTPError as e:
                detail = ""
                try: detail = e.read().decode()[:600]
                except Exception: pass
                msg = re.sub(r"\s+", " ", detail)[:220]
                errs.append(f"{model} {e.code}: {msg}")
                print(f"[gemini] {model} {e.code}: {msg}", file=sys.stderr)
                if e.code == 404:
                    if model in gemini.models and not search:
                        gemini.models.remove(model)  # 없어진 모델은 이후 건너뜀
                    break
                if e.code == 400:
                    break
                if e.code == 429:
                    time.sleep(_retry_delay(detail)); continue
                time.sleep(6 * (attempt + 1)); continue
            except Exception as e:
                errs.append(f"{model}: {e}")
                print(f"[gemini] {model} 시도 {attempt + 1} 실패: {e}", file=sys.stderr)
                time.sleep(4)
    if search and errs and all((" 400:" in x or " 404:" in x) for x in errs):
        gemini.search_ok = False
    raise RuntimeError("Gemini 실패: " + " | ".join(errs[-3:]))


def parse_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    m = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(m.group(0) if m else text)


# ── 각 코너 ────────────────────────────────────────────────

def gen_greetings(d):
    season = ["겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울"][d.month - 1]
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일, {season}이다.
아침 인사 카드에 넣을 짧은 인사말 4개를 만들어라. 카톡으로 친구에게 보내는 사진 카드에 들어간다.
각 인사말은 세 줄, 줄마다 2~8글자 내외의 짧은 구절, 줄바꿈은 \\n으로. 전체 28자 이내.
1번: 계절·날씨가 느껴지는 따뜻하고 품격 있는 인사. 2번: 안부를 묻거나 응원하는 다정한 인사.
3번·4번: 피식 웃음이 나는 위트 있는 인사. 말장난, 귀여운 과장, 요즘 말투를 살짝 섞어도 좋다(예: "커피 한 잔에\\n배터리 100%\\n오늘도 출동!", "오늘 할 일:\\n잘 먹고 잘 웃기\\n끝!"). 예시를 그대로 쓰지 말 것. 나이·건강·늙음 이야기, 비꼬기 금지.
형식: {{"greetings": ["...","...","...","..."]}}""")
    g = [str(x).strip() for x in j.get("greetings", []) if str(x).strip()]
    assert len(g) == 4, "인사말 4개 아님"
    # 카드 한 줄에 10자(띄어쓰기 포함)를 넘으면 낱말 하나가 혼자 떨어진다 → 다시 만들게
    assert all(len(line) <= 10 for x in g for line in x.split("\n")), "인사말 한 줄이 너무 김"
    return g


def gen_fortune(d):
    out = {}
    for half in (ZODIAC[:6], ZODIAC[6:]):
        j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 다음 띠들의 '오늘의 운세'를 써라: {", ".join(half)}.

**가장 중요**: 이것은 수필이 아니라 **운세**다. 풍경 묘사로 채우지 말고, 오늘이 어떤 날인지 **분명히 짚어 주고**, 무엇이 잘 풀리고 무엇을 조심하면 좋은지 **일러 주어야** 한다.
나쁜 예(이렇게 쓰지 말 것): "높고 푸른 하늘 아래 도시의 풍경이 선명하게 다가옵니다. 서두르지 않을수록 계절의 결이 또렷해집니다."
좋은 예: "미뤄 둔 이야기를 꺼내기 좋은 날입니다. 먼저 말을 건네면 생각보다 쉽게 풀립니다. 다만 오후에는 말수를 줄이는 편이 낫습니다."

읽는 사람은 50~60대지만 생각과 생활은 40대다. 무섭게 겁주는 운세, 점집 말투("삼재다", "액운이 들었다"), 나이 이야기, 병·사고 이야기는 쓰지 않는다. 조심하라는 말도 담담하고 가볍게.
띠마다 내용과 말투가 겹치지 않게. 열두 띠가 모두 좋은 날일 수는 없으니, 띠에 따라 **아주 좋은 날·무난한 날·천천히 가는 편이 나은 날**이 섞이게 한다.

각 띠마다:
- total: 오늘의 운. 세 문장(100~150자). **첫 문장에 오늘이 어떤 날인지 분명히 말한다**(예: "뜻밖의 연락이 반가운 소식을 물고 오는 날입니다", "서두르면 손해를 보니 한 박자 늦추는 것이 좋은 날입니다"). 둘째 문장은 그래서 어떻게 하면 좋은지, 셋째 문장은 하루 끝의 모습.
- work: 하는 일·집안일이 어떻게 풀리는지 한 문장(30~50자). 구체적으로.
- people: 사람 사이의 운 한 문장(30~50자). 누구와 어떤 일이 있을지.
- money: 돈 쓰는 일에 대한 한 문장(30~50자). 큰돈·투자·주식 이야기는 하지 않고, 지갑을 여는 작은 결정 수준으로만(예: "눈에 들어온 물건은 하루 두고 보면 마음이 정해집니다").
- care: 오늘 하나만 조심하면 좋을 것 한 문장(25~45자). 겁주지 말고 담담하게(예: "서두른 대답이 말꼬리를 잡히기 쉬우니 한 번 더 생각하고 말하세요").
- do: 오늘 하면 운이 트이는 작은 일 한 문장(25~45자).
- color: 행운의 색(한 단어), num: 행운의 숫자(1~99), time: 좋은 시간대(예: "오전 10시 무렵"), place: 좋은 장소(예: "동네 공원").
형식: {{"fortune": {{"띠": {{"total":"...","work":"...","people":"...","money":"...","care":"...","do":"...","color":"...","num":7,"time":"...","place":"..."}}, ...}}}}""")
        f = j.get("fortune", {})
        for z in half:
            it = f.get(z) or {}
            assert isinstance(it, dict) and it.get("total"), f"{z} 운세 누락"
            out[z] = {k: v for k, v in ((k, str(it.get(k, "")).strip()) for k in ("total", "work", "people", "money", "care", "do", "color", "num", "time", "place")) if v}
    return out


def gen_era(d):
    era, used = {}, []
    for ago in (50, 40, 30, 20, 10):
        yr = d.year - ago
        avoid = ("\n이미 다른 해에서 고른 소식과 겹치는 종류는 피하라: " + ", ".join(used)) if used else ""
        prompt = f"""{yr}년 {d.month}월(가능하면 {d.month}월 {d.day}일 전후 한 주 안)에 실제로 있었던 일을 구글 검색으로 확인해서 2~3개 골라라.
한국 소식 위주로 하되 세계 소식 1개를 섞어도 된다. 정치 논쟁·사건사고·죽음은 피하고 문화·생활·방송·유행 위주로.
해마다 되풀이되는 행사(프로야구 한국시리즈·미국 월드시리즈·전국체전·정기 시상식 개막 등)는 고르지 않는다. 스포츠는 그해에만 있었던 특별한 일(첫 우승, 올림픽 메달 등)일 때만 1개까지.
잡지 독자가 "아, 그때 그랬지" 하고 이야기를 꺼낼 만한, 그해만의 소식이어야 한다.{avoid}
남성 위주 소식(스포츠·정치·경제)만 고르지 말고, 3개 중 적어도 1개는 여성들이 공감할 감수성 있는 소식(드라마·영화·노래·책·패션·살림과 생활 문화·여성 인물의 활약 등)으로 고른다.
반드시 검색으로 확인된 사실만 쓰고, 날짜가 확실하면 "{d.month}월 N일," 로 시작한다. 확인이 안 되면 그 항목은 빼라.
또 그 시절(한국 {yr}년 무렵)의 생활 풍경을 떠올리게 하는 분위기 문장 한 개(40~60자)도 써라. "~그 시절을 다시 꺼내어 봅니다."로 끝낸다.
각 소식마다 그 소식을 대표하는 위키백과 문서 제목도 하나 적어라(한국어 위키백과에 있으면 "ko:문서제목", 없으면 "en:Article title"). 드라마·영화·노래·책·인물·행사·건물처럼 사진이 있을 만한 문서로.
형식(JSON만): {{"mood":"...", "facts":[["짧은 제목(4~8자)","설명 한두 문장(40~90자)","ko:위키백과 문서 제목"], ...]}}"""
        j = None
        for t in range(3):  # 검색으로 확인한 사실만 쓰도록 검색 호출을 몇 번 더 해 본다
            try:
                j = gemini(prompt, json_mode=True, search=True); break
            except Exception as e:
                print(f"[era] {yr} 검색 호출 실패 {t + 1}: {str(e)[:80]}", file=sys.stderr); time.sleep(5)
        if j is None:
            # 검색 없이 날짜를 지어내면 틀리기 쉽다 → 날짜 없이, 그해 누구나 아는 큰 문화 소식만
            j = gemini(prompt.replace("구글 검색으로 확인해서", "네가 확실히 아는 것만으로").replace("반드시 검색으로 확인된 사실만 쓰고, 날짜가 확실하면", "날짜는 쓰지 말고(\"{yr}년,\"으로 시작), 그해 크게 유행한 드라마·노래·영화·책처럼 누구나 아는 확실한 것만. 날짜가 확실해도") , json_mode=True)
        facts = []
        for f in j.get("facts", [])[:3]:
            if not isinstance(f, (list, tuple)) or len(f) < 2 or not str(f[1]).strip(): continue
            item = [str(f[0]).strip(), str(f[1]).strip()]
            ref = str(f[2]).strip() if len(f) > 2 else ""
            im = era_photo(item[0], ref, yr, item[1])
            if im: item.append(im["thumb"])  # 그 소식의 대표 사진 (위키백과, 없으면 제목으로 찾기)
            facts.append(item)
        assert j.get("mood") and facts, f"{yr} 그해 오늘 비어 있음"
        used += [f[0] for f in facts]
        era[str(ago)] = {"mood": j["mood"].strip(), "facts": facts, "songs": pick_songs(yr, d), "pop": pick_songs(f"pop:{yr}", d)}
    return era


def pick_songs(yr, d):
    songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8")).get(str(yr), [])
    if not songs:
        return []
    n = len(songs)
    start = (d.timetuple().tm_yday * 3) % n
    return [songs[(start + i) % n] for i in range(min(10, n))]


def gen_meal(d):
    season = ["한겨울", "늦겨울", "초봄", "봄", "늦봄", "초여름", "한여름", "늦여름", "초가을", "가을", "늦가을", "초겨울"][d.month - 1]
    j = gemini(f"""{season}({d.month}월)에 어울리는, 혼자서도 15~20분이면 만드는 한 끼 요리 하나를 정해라. 재료 5가지 이내, 흔한 재료. 한식·간단 양식·면 요리 등 매일 다르게.
형식: {{"meal": {{"title":"요리 이름(12자 이내)", "sub":"1인분 · N분 · 재료 N가지", "lead":"요리를 권하는 두 문장(50~80자, 제철 이야기 포함)", "ingredients":["재료와 양", ...5개 이내], "steps":["한 문장", "한 문장", "한 문장"], "tip":"한 문장"}}}}""")
    m = j["meal"]
    assert m.get("title") and len(m.get("steps", [])) >= 2 and m.get("ingredients"), "한 끼 형식 오류"
    return m


def gen_quiz(d):
    """오늘의 시사 상식: 최근 뉴스에 자주 나오는 말 하나를 골라 풀어 주고, 확인 문제 하나."""
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 최근 일주일 한국 뉴스·방송·인터넷에서 자주 나오는 시사 용어 하나를 구글 검색으로 골라라.
경제·기술·생활·문화·건강·사회 현상 중에서. 정치인 이름·정당 논쟁·사건사고·특정 기업 홍보는 피한다. 40~60대 교양 있는 독자가 "아, 요즘 이걸 이렇게 부르는구나" 하고 배울 만한 말.
'디지털 디톡스·워라밸·MZ·소확행·번아웃'처럼 이미 몇 년째 누구나 아는 말은 피하고, 최근 1~2년 사이 새로 자주 쓰이는 말을 고른다. 모임에서 꺼내면 대화가 되는 수준.
형식(JSON만):
{{"quiz": {{"kind":"시사 상식", "term":"용어(15자 이내)", "meaning":"한 줄 뜻(30자 이내)",
 "explain":"쉬운 풀이 세 문장(120~200자). 영어·줄임말이면 원래 말과 뜻을 함께.",
 "why":"요즘 왜 자주 들리는지 한두 문장(60~110자). 확인된 사실만.",
 "example":"이 말을 실제로 쓰는 예문 한 문장(대화체, 40자 이내)",
 "question":"확인 문제. 화면에 용어와 뜻이 이미 나오므로 '뜻이 무엇인가' '이 뜻의 용어는?'처럼 답이 보이는 문제는 금지. 대신 '다음 중 이 말의 사례로 알맞은 것은?' 처럼 이해해야 풀 수 있게. 보기 네 개 모두 그럴듯하게", "options":["보기1","보기2","보기3","보기4"], "answer":0}}}}
정답 번호(answer)는 0~3 중 무작위."""
    try:
        j = gemini(prompt, json_mode=True, search=True)
    except Exception as e:
        print(f"[quiz] 검색 실패, 검색 없이: {str(e)[:100]}", file=sys.stderr)
        j = gemini(prompt.replace("구글 검색으로 골라라", "네가 확실히 아는 최근 몇 년 사이 자주 쓰이는 말로 골라라").replace("확인된 사실만.", "일반적으로 알려진 사실만."), json_mode=True)
    q = j["quiz"]
    assert q.get("term") and len(q.get("options", [])) == 4 and 0 <= int(q.get("answer", -1)) <= 3, "시사 상식 형식 오류"
    q["answer"] = int(q["answer"]); q["kind"] = "시사 상식"
    assert q["options"][q["answer"]].replace(" ", "") != q["term"].replace(" ", ""), "답이 용어 그대로인 문제"
    return q

def gen_story(d):
    theme = random.Random(d.toordinal()).choice(["서랍 속 물건", "동네 가게", "첫 월급", "라디오", "소풍", "편지", "시장", "겨울 난로", "자전거", "사진 한 장", "전화", "다방", "극장", "기차", "텃밭", "친구"])
    j = gemini(f"""'그날의 사연' 한 편. 소재: {theme}. 1인칭 수필, 두 문단(각 120~180자). 1970년대에서 2010년대 사이(날마다 시대를 바꿔 가며)의 기억 하나를 구체적인 물건·소리·냄새로 떠올리고, 마지막은 지금의 담담한 한 줄로 맺는다. 교훈·설교 금지. 제목은 8자 이내, 부제는 15자 이내.
형식: {{"story": {{"title":"...", "sub":"...", "paras":["문단1","문단2"], "by":"오마주 편집실"}}}}""")
    s = j["story"]
    assert s.get("title") and len(s.get("paras", [])) >= 2, "사연 형식 오류"
    s["by"] = "오마주 편집실"
    return s



# ── 앞으로 나아가기 ────────────────────────────────────────

FOLLOW = [("gym", "요가", "10~20분 안팎의 쉬운 아침 요가. 초보도 따라 할 수 있는 것"),
          ("meditate", "명상", "10분 안팎의 안내 명상(호흡·마음챙김·잠들기 전 명상 등). 한국어 안내 음성"),
          ("sing", "노래 교실", "노래 교실 강사가 트로트·가요 한 곡을 가르쳐 주는 영상"),
          ("dance", "댄스", "라인댄스나 생활 댄스 기초 동작을 천천히 가르쳐 주는 영상"),
          ("golf", "골프 레슨", "드라이버·아이언·퍼팅 등 골프 기본기를 알려 주는 레슨 영상"),
          ("park", "파크골프", "파크골프 기본 자세·스윙·규칙을 알려 주는 영상")]
REGIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]


# 잡지에 어울리지 않는 영상 거르기: 나이 딱지(실버·시니어·어르신·노인·치매), 쇼츠, 광고·이벤트, 짧은 맛보기
YT_BAD = re.compile(r"실버|시니어|어르신|노인|치매|요양|shorts|#shorts|이벤트|구독|광고|협찬|리액션|먹방", re.I)
def yt_ok(items):
    good = [it for it in items if not YT_BAD.search(it["snippet"]["title"] + " " + it["snippet"].get("channelTitle", ""))]
    return good or []


def youtube_pick(query):
    """유튜브에서 영상 하나 고르기. 키가 안 되면 None (검색 링크로 대체)."""
    key = os.environ.get("YOUTUBE_API_KEY") or GEMINI_KEY
    try:
        q = urllib.parse.urlencode({"part": "snippet", "q": query, "type": "video", "videoEmbeddable": "true", "videoDuration": "medium", "relevanceLanguage": "ko", "regionCode": "KR", "maxResults": 8, "order": "relevance", "key": key})
        j = get_json(f"https://www.googleapis.com/youtube/v3/search?{q}")
        items = yt_ok(j.get("items", []))
        if not items:
            return None
        pick = items[datetime.date.today().toordinal() % len(items)]
        import html
        return {"videoId": pick["id"]["videoId"], "title": html.unescape(pick["snippet"]["title"]), "channel": html.unescape(pick["snippet"]["channelTitle"]), "thumb": pick["snippet"]["thumbnails"].get("medium", {}).get("url", "")}
    except Exception as e:
        print(f"[youtube] 한도 바닥 → 검색 페이지로: {str(e)[:80]}", file=sys.stderr)
        try:
            sys.path.insert(0, HERE)
            from yt_scrape import scrape
            items = yt_ok(scrape(query))
            if items:
                pick = items[datetime.date.today().toordinal() % min(4, len(items))]
                return {"videoId": pick["id"]["videoId"], "title": pick["snippet"]["title"], "channel": pick["snippet"]["channelTitle"], "thumb": f"https://i.ytimg.com/vi/{pick['id']['videoId']}/mqdefault.jpg"}
        except Exception as e2:
            print(f"[youtube] 검색 페이지도 실패: {str(e2)[:80]}", file=sys.stderr)
        return None


UA_BOT = "OmajuBot/1.0 (https://omaju.kr; bot@omaju.kr)"  # 위키백과 규칙: 누가 요청하는지 밝혀야 막히지 않는다


def get_json(url):
    for t in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA_BOT}), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and t < 3: time.sleep(2 * (t + 1) ** 2); continue  # 너무 잦다고 하면 쉬었다가
            raise


FOLLOW_FALLBACK = {"gym": ("아침 요가 초보", "가볍게 몸을 펴며 하루를 열어 보세요"), "meditate": ("10분 아침 명상", "숨을 고르며 마음을 가만히 내려놓아 보세요"), "sing": ("노래교실 인기 가요", "목을 풀고 한 곡 시원하게 불러 보세요"),
                   "dance": ("쉬운 라인댄스 따라하기", "신나는 음악에 발을 맞춰 보세요"), "golf": ("골프 스윙 기초 레슨", "오늘은 스윙 한 가지만 다듬어 볼까요"),
                   "park": ("파크골프 치는 법", "가까운 구장에서 한 라운드 어떠세요")}


def gen_follow(d):
    try:
        j = _gen_follow_ai(d)
    except Exception as e:
        print(f"[follow] 문구 생성 실패, 기본 검색어로 영상만 찾습니다: {str(e)[:80]}", file=sys.stderr)
        j = {"follow": {k: {"query": q, "say": say} for k, (q, say) in FOLLOW_FALLBACK.items()}}
    out = {}
    for k, name, _ in FOLLOW:
        it = j["follow"].get(k) or {"query": FOLLOW_FALLBACK[k][0], "say": FOLLOW_FALLBACK[k][1]}
        v = youtube_pick(it["query"]) or youtube_pick(FOLLOW_FALLBACK[k][0])
        out[k] = {"name": name, "query": it["query"].strip(), "say": it["say"].strip(), **(v or {})}
    return out


def _gen_follow_ai(d):
    return gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. '오늘의 따라하기' 다섯 항목 각각에 대해 유튜브 검색어 하나와 한 줄 권유 문구를 만들어라.
항목: {json.dumps([(k, n, desc) for k, n, desc in FOLLOW], ensure_ascii=False)}
검색어는 한국어 유튜브에서 실제로 좋은 영상이 나올 만한 자연스러운 말(8~16자), 날마다 조금씩 다르게. "시니어·어르신·노인" 금지.
권유(say)는 20~40자, 오늘 기분에 맞게.
형식: {{"follow": {{"gym": {{"query":"...", "say":"..."}}, "meditate": {{...}}, "sing": {{...}}, "dance": {{...}}, "golf": {{...}}, "park": {{...}}}}}}""")


def gen_phrase(d):
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. '오늘의 회화' — 영어·일본어·중국어 각 한 문장. 여행·식당·인사·쇼핑·길 묻기 등 실제로 쓸 상황 하나를 정해 세 언어가 같은 뜻이 되게.
각 언어: text(원문), reading(한국어로 적은 발음. 원문의 낱말(어절) 단위로 띄어 쓴다. 예: "체크 플리즈", "오카이케이오 오네가이시마스", "마이단 셰셰". 한 글자씩 띄우지 말 것), meaning(우리말 뜻), tip(쓰는 상황이나 한 가지 요령, 30자 이내).
중국어는 간체와 함께 reading에 성조 없이 한국어 발음만. 일본어는 한자 포함 원문.
형식: {{"phrase": {{"topic":"상황(6자 이내)", "en": {{"text":"...","reading":"...","meaning":"...","tip":"..."}}, "ja": {{...}}, "zh": {{...}}}}}}""")
    p = j["phrase"]
    assert all(k in p and p[k].get("text") for k in ("en", "ja", "zh")), "회화 형식 오류"
    return p


def gen_outing(d):
    from concurrent.futures import ThreadPoolExecutor
    out = {}
    wk = d + datetime.timedelta(days=(5 - d.weekday()) % 7)  # 이번 토요일
    def one(region):
        prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 한국 '{region}' 지역에서 이번 주말({wk.month}월 {wk.day}일 전후)에 가볼 만한 곳 3개를 구글 검색으로 찾아라.
전시·공연·축제·장터·단풍길·둘레길·공원 등 실제로 지금 열리고 있거나 갈 수 있는 곳만. 확인 안 되는 건 넣지 마라. 각 항목: title(이름, 16자 이내), where(장소, 20자 이내), when(기간이나 시간, 20자 이내), why(가 볼 이유 한 문장 40~70자), kind(전시|공연|축제|나들이 중 하나).
형식(JSON만): {{"items": [{{"title":"...","where":"...","when":"...","why":"...","kind":"..."}}, ...]}}"""
        try:
            try:
                j = gemini(prompt, json_mode=True, search=True)
            except Exception as e:
                print(f"[outing] {region} 검색 실패: {str(e)[:100]}", file=sys.stderr)
                j = gemini(prompt.replace("구글 검색으로 찾아라", "네가 아는 범위에서 골라라") + "\n확실하지 않으면 그 지역에서 늘 갈 수 있는 공원·산책길·시장 위주로.", json_mode=True)
            items = [x for x in j.get("items", []) if x.get("title")][:3]
            return region, items
        except Exception as e:
            print(f"[outing] {region} 실패: {e}", file=sys.stderr)
            return region, []
    regions = getattr(gen_outing, "regions", None) or REGIONS
    for region, items in map(one, regions):
            if items:
                out[region] = items
    assert out, "나들이 전부 실패"
    return out


# ── 오늘의 문화: 시 · 그림 · 한 문장 ──────────────────────
def wiki_image(ref):
    lang, title = ref.split(":", 1)
    try:
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        j = get_json(url)
        img = (j.get("originalimage") or {}).get("source") or (j.get("thumbnail") or {}).get("source")
        th = (j.get("thumbnail") or {}).get("source")
        if img and th:
            # 너무 큰 원본 대신 1280px 썸네일 주소로
            big = re.sub(r"/(\d+)px-", "/1280px-", th) if "/thumb/" in th else img
            return {"img": big, "thumb": re.sub(r"/(\d+)px-", "/640px-", th) if "/thumb/" in th else th, "page": j.get("content_urls", {}).get("desktop", {}).get("page", "")}
    except Exception as e:
        print(f"[culture] 그림 사진 실패 {ref}: {e}", file=sys.stderr)
    return None


def _norm(t):
    return re.sub(r"[\s·'\"「」『』]", "", re.sub(r"\s*\(.*?\)", "", t or ""))


def wiki_find(q, year=None, text="", title_hint=""):
    """위키백과 검색으로 사진 있는 문서 찾기. 단, 문서 이름이 소식 글(text) 안에 실제로 나오는 것만 — 엉뚱한 사람·사진 막기"""
    body = _norm(text)
    for lang in ("ko", "en"):
        for query in ([f"{q} {year}", q] if year else [q]):
            try:
                u = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": query, "srlimit": 5, "format": "json"})
                hits = get_json(u).get("query", {}).get("search", [])
            except Exception as e:
                print(f"[era] 위키 검색 실패 {query}: {str(e)[:60]}", file=sys.stderr); hits = []
            for h in hits:
                # 문서 이름의 낱말(연도 빼고)이 모두 소식 글에 나와야 함: '1986년 아시안 게임' ↔ '서울 아시안게임' 은 통과, '한강 (작가)' ↔ 밥 딜런 소식은 탈락
                words = [w for w in re.split(r"\s+", re.sub(r"\s*\(.*?\)", "", h["title"])) if w and not re.fullmatch(r"\d+년?", w)]
                if not words or (body and not all(_norm(w) in body for w in words)) or len(_norm(h["title"])) < 2:
                    continue
                # 한 낱말짜리 문서('자동차' 같은 넓은 말)는 소식 제목에 그 낱말이 있을 때만
                if len(words) == 1 and _norm(words[0]) not in _norm(title_hint or q):
                    continue
                time.sleep(0.4)
                im = wiki_image(f"{lang}:{h['title']}")
                if im and photo_ok(im): return im
            time.sleep(0.4)
    return None


BAD_PIC = re.compile(r"logo|로고|\.svg|map|지도|flag|국기|깃발|emblem|icon|interface|screenshot|screen|diagram|chart|seal|coat_of_arms", re.I)
def photo_ok(im):
    """잡지에 실을 만한 사진만: 로고·지도·깃발·화면 캡처·아이콘 같은 그림은 뺀다"""
    name = urllib.parse.unquote((im.get("thumb") or "").split("?")[0].split("/")[-1])
    return bool(name) and not BAD_PIC.search(name)


def era_photo(title, ref, year, desc=""):
    """그해 오늘 소식 사진: AI가 준 위키 문서 → 없거나 사진이 없으면 소식 글로 위키 검색(글에 나오는 문서만)"""
    im = wiki_image(ref) if re.match(r"^(ko|en):.+", ref or "") else None
    if im and photo_ok(im): return im
    text = f"{title} {desc}"
    key = re.sub(r"\s*(개막|종영|소식|열기|시작|인수|출시)$", "", title)
    return wiki_find(key, year, text, title) or wiki_find(re.sub(r"^\d+월 \d+일,\s*", "", desc)[:40], None, text, title)


def gen_culture(d):
    data = json.load(open(os.path.join(HERE, "..", "data", "culture.json"), encoding="utf-8"))
    n = d.toordinal()
    poem = data["poems"][n % len(data["poems"])]
    quote = data["quotes"][(n * 7) % len(data["quotes"])]
    bible = data["bible"][(n * 5) % len(data["bible"])]
    dharma = data["dharma"][(n * 3) % len(data["dharma"])]
    ps = data["paintings"]; paint = None
    for k in range(len(ps)):
        cand = ps[(n * 3 + k) % len(ps)]
        im = wiki_image(cand["wiki"])
        if im:
            paint = {**cand, **im}; break
    season = ["한겨울", "늦겨울", "이른 봄", "봄", "늦봄", "초여름", "한여름", "늦여름", "초가을", "가을", "늦가을", "초겨울"][d.month - 1]
    a = gemini(f"""오늘의 문화 코너 해설을 써라. 확실한 사실만, 모르는 건 쓰지 말 것.
[시] {poem["author"]} 「{poem["title"]}」 ({poem["year"]})
본문:
{poem["text"]}
- poem_bg: 이 시가 언제, 어떤 시집이나 자리에서 나왔고 시대 배경이 어땠는지 세 문장(120~200자).
- poem_words: 지금은 잘 안 쓰는 옛말·어려운 낱말 풀이 3~6개. [["낱말","뜻"], ...] (없으면 빈 목록)
- poem_note: 감상 세 문장(120~180자). 시 구절을 길게 인용하지 말 것.
[그림] {paint["artist"] if paint else "-"} 「{paint["title"] if paint else "-"}」 ({paint["year"] if paint else "-"})
- painting_about: 작품 소개 세 문장(130~200자). 어디에 있는지(소장처)도 확실하면.
- painting_points: 그림에서 눈여겨볼 곳 세 가지, 각각 한 문장. ["...","...","..."]
- painting_artist: 화가 이야기 두세 문장(90~150자).
[한 문장] "{quote["text"]}" — {quote["who"]}
- quote_note: 출처 이야기 한 문장과 오늘 하루에 어떻게 쓸지 한 문장.
형식: {{"poem_bg":"...","poem_words":[["",""]],"poem_note":"...","painting_about":"...","painting_points":["","",""],"painting_artist":"...","quote_note":"..."}}""")
    try:
        b = _gen_culture_b(d, season, bible, dharma)
    except Exception as e:
        print(f"[culture] 에세이·유머 생성 실패 (다음 실행에서 다시): {str(e)[:80]}", file=sys.stderr); b = {}
    return _culture_out(d, n, data, poem, quote, bible, dharma, paint, a, b)


def _gen_culture_b(d, season, bible, dharma):
    return gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일, {season}.
1) essay: '오늘의 에세이' 한 편. 잡지 칼럼처럼 결이 있는 문장으로, 흔한 계절 찬가나 교훈 대신 작고 구체적인 장면 하나에서 시작할 것. 지금 계절의 풍경·소리·냄새로 시작하는 1인칭 수필, 세 문단(각 120~180자), 제목 12자 이내. 교훈·설교 금지. 담백하고 따뜻하게.
2) bible_note: 다음 성경 구절에 대한 짧은 묵상 두 문장(70~120자). 특정 교파 주장 없이 부드럽게. 구절: {bible["ref"]} "{bible["text"]}"
3) dharma_note: 다음 불교 가르침에 대한 쉬운 풀이 두 문장(70~120자). 출처: {dharma["src"]} "{dharma["text"]}"
4) humor: '오늘의 유머' 하나. 40~60대 어른이 피식 웃을 만한 재치 있는 짧은 이야기(3~5문장)와 마지막 반전 한마디. 부부·직장·명절·단톡방·건강검진·운동·스마트폰·손주 등 생활 속 장면에서 끌어낼 것. 어린이용 말장난·넌센스 퀴즈(예: '아몬드가 죽으면')는 금지. 늙음·외모·성별·지역 비하, 정치, 야한 이야기 금지. 남의 책·방송 대사를 그대로 옮기지 말 것. kind는 "짧은 이야기".
형식: {{"essay": {{"title":"...","paras":["...","...","..."]}}, "bible_note":"...", "dharma_note":"...", "humor": {{"kind":"넌센스 퀴즈 또는 짧은 이야기","title":"이야기면 제목(8자 이내), 퀴즈면 빈 문자열","text":"문제 또는 이야기(줄바꿈 \\n)","punch":"정답 또는 마지막 한마디"}}}}""")


def _culture_out(d, n, data, poem, quote, bible, dharma, paint, a, b):
    out = {
        "poem": {**poem, "bg": a.get("poem_bg", "").strip(), "words": [{"w": str(w[0]).strip(), "m": str(w[1]).strip()} for w in a.get("poem_words", []) if isinstance(w, list) and len(w) == 2 and w[0]], "note": a.get("poem_note", "").strip()},
        "quote": {**quote, "note": a.get("quote_note", "").strip()},
    }
    if b.get("bible_note"): out["bible"] = {**bible, "note": b["bible_note"].strip()}
    if b.get("dharma_note"): out["dharma"] = {**dharma, "note": b["dharma_note"].strip()}
    h = b.get("humor") or {}
    if h.get("text") and h.get("punch"):
        out["humor"] = {k: str(h.get(k, "")).strip() for k in ("kind", "title", "text", "punch")}
    # AI 유머가 없으면 비워 둠 → 다음 실행에서 다시 만들고, 그동안 화면은 엄선 목록에서 보여 줌
    e = b.get("essay") or {}
    if e.get("title") and len(e.get("paras", [])) >= 2:
        out["essay"] = {"title": e["title"].strip(), "paras": [x.strip() for x in e["paras"]], "by": "오마주 편집실"}
    if paint:
        out["painting"] = {**paint, "about": a.get("painting_about", "").strip(), "points": [x for x in a.get("painting_points", []) if x], "artist_story": a.get("painting_artist", "").strip()}
    return out

# ── 저장 ────────────────────────────────────────────────

def firestore():
    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT 없음")
    info = json.loads(raw)
    cred = service_account.Credentials.from_service_account_info(info)
    return fs.Client(project=info["project_id"], credentials=cred)


# 코너마다 꼭 있어야 하는 부분 — 하나라도 없으면 '덜 됨'으로 보고 다시 만든다
NEED = {"culture": ("essay", "humor", "bible", "dharma", "poem"), "fortune": ("total",), "follow": tuple(k for k, _, _ in FOLLOW)}
def complete(name, v):
    if not v: return False
    # era: 그날의 신문(era_news)이 먼저 넣은 해는 노래 목록이 없어도 된다 — 앱이 data/songs.json 에서 같은 규칙으로 고른다
    if name == "follow":
        return all(isinstance(v.get(k), dict) and v[k].get("videoId") for k in NEED["follow"])
    if name == "fortune":
        # care(조심할 것)까지 있어야 '운세' 꼴이 된 것 — 옛 형식(total 만 있는 날)은 다시 만든다
        return isinstance(v, dict) and len(v) >= 12 and all(isinstance(x, dict) and x.get("total") and x.get("care") for x in v.values()) if isinstance(v, dict) else bool(v)
    return all(v.get(k) for k in NEED.get(name, ())) if isinstance(v, dict) else bool(v)


def main():
    gemini.models = list_models()
    force = "--force" in sys.argv
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--only=")), None)
    rg = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--regions=")), None)
    if rg: gen_outing.regions = [r for r in rg if r]
    d = today()
    for a in sys.argv:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", a):
            d = datetime.date.fromisoformat(a)
    key = d.isoformat()
    db = firestore()
    ref = db.collection("daily").document(key)
    cur = ref.get()
    have = cur.to_dict() if cur.exists else {}
    if have.get("source") == "admin" and not force:
        print(f"{key} 관리자가 직접 쓴 내용이 있음. 건너뜀."); return

    out, errors = {}, []
    ref.set({"source": "auto", "startedAt": datetime.datetime.now(KST).isoformat()}, merge=True)
    for name, fn in [("greetings", gen_greetings), ("fortune", gen_fortune), ("era", gen_era), ("meal", gen_meal), ("quiz", gen_quiz), ("story", gen_story), ("follow", gen_follow), ("phrase", gen_phrase), ("culture", gen_culture), ("outing", gen_outing)]:
        if only and name not in only:
            continue
        if not force and complete(name, have.get(name)):  # 다 갖춘 코너는 다시 만들지 않음 (AI 한도 아끼기). 빠지거나 덜 된 코너만 다음 실행에서 채움
            print(f"[skip] {name} 이미 있음"); continue
        try:
            out[name] = fn(d)
            if name == "outing":
                ref.set({"outing": out[name]}, merge=True)  # 지역별 필드 병합 (다른 묶음 결과 보존)
            else:
                ref.set({name: out[name]}, merge=True)
            print(f"[ok] {name}")
        except Exception as e:
            out.pop(name, None)  # 저장에 실패한 코너는 마지막 한꺼번에 저장에서 빼서 다른 코너까지 날리지 않게
            errors.append(f"{name}: {e}")
            print(f"[fail] {name}: {e}", file=sys.stderr)
    if not out:
        missing = [n for n in (only or []) if not have.get(n)]
        if missing or errors:
            raise SystemExit("아무것도 만들지 못함: " + ", ".join(errors)[:300])
        print(f"{key} 모든 코너가 이미 있음."); return
    out["source"] = "auto"
    out["generatedAt"] = datetime.datetime.now(KST).isoformat()
    out["errors"] = errors
    ref.set(out, merge=True)
    os.makedirs(os.path.join(HERE, "..", "daily"), exist_ok=True)
    full = ref.get().to_dict() or out
    with open(os.path.join(HERE, "..", "daily", key + ".json"), "w", encoding="utf-8") as f:
        json.dump(full, f, ensure_ascii=False, indent=1, default=str)
    print(f"{key} 저장 완료. 코너 {len(out) - 3}개" + (f", 실패 {len(errors)}개" if errors else ""))


if __name__ == "__main__":
    main()
