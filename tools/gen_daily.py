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
    """글쓰기 모델 — models.WRITE 로 못 박는다 (2026-10-26 비용: '가장 새 Flash'로 저절로 올라타 3.8 이 되고,
    3.8 이 시간 초과로 실패하면 3.7·3.6 으로 같은 글을 다시 써서 돈이 두세 배 나갔다). 살아 있는 것만, 순서 그대로."""
    from models import WRITE
    try:
        with urllib.request.urlopen(f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_KEY}&pageSize=200", timeout=30) as r:
            names = {m["name"].split("/")[-1] for m in json.load(r).get("models", [])}
        picked = [m for m in WRITE if m in names] or list(WRITE)
    except Exception as e:
        print("[models] 목록 조회 실패, 못 박은 이름 그대로:", e, file=sys.stderr)
        picked = list(WRITE)
    print("[models]", picked)
    return picked

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
평론·서평에서나 쓰는 어려운 낱말(톺아보다·천착하다·반추하다·조응하다·궁구하다 같은)은 쓰지 않는다. 소리 내어 읽었을 때 바로 알아듣는 말로 (대표 2026-10-23: '톺아봅니다'를 오타로 읽음).
'시니어·어르신·노인·치매·두뇌·은퇴' 같은 말은 쓰지 않는다."""

sys.path.insert(0, HERE)
from models import lean, LEAN

# ── 답 묶음 (대표 2026-10-26: 글은 클국장이 쓰고 구글 비용을 줄인다) ──
# 밤 11시 반에 클국장(예약 작업)이 이 파일을 --bank 로 돌린다 → AI 에게 물을 글감(물음)이 daily/pre/<날짜>.queue.json 에 쌓이고,
# 클국장이 직접 답을 써서 daily/pre/<날짜>.bank.json 에 넣는다(물음마다 같은 꼴의 JSON). 0시 5분 실제 발행은 묶음에 답이 있으면
# 구글을 부르지 않고 그 답을 쓴다. 답이 없거나 그 답으로 코너가 안 되면 예전처럼 구글이 쓴다(예비 길).
import hashlib
BANK, BANK_ON = {}, [True]
BANK_MODE = "--bank" in sys.argv
PRE = os.path.join(HERE, "..", "daily", "pre")
class BankWait(BaseException):
    """클국장 답을 기다리는 물음 — 코너 안의 except Exception 에 걸리지 않고 곧장 코너를 멈추게(다른 물음으로 새지 않게)"""

def _bkey(prompt, json_mode, search):
    return hashlib.sha1(f"{int(bool(json_mode))}{int(bool(search))}\n{prompt}".encode()).hexdigest()[:16]
def load_bank(key):
    BANK.clear(); load_bank.key = key
    try:
        BANK.update(json.load(open(os.path.join(PRE, key + ".bank.json"), encoding="utf-8")))
        print(f"[bank] 클국장 답 {len(BANK)}개")
    except Exception:
        pass
load_bank.key = None
def _queue(k, prompt, json_mode, search):
    os.makedirs(PRE, exist_ok=True)
    f = os.path.join(PRE, f"{load_bank.key}.queue.json")
    try: q = json.load(open(f, encoding="utf-8"))
    except Exception: q = {}
    q[k] = {"json": bool(json_mode), "search": bool(search), "system": STYLE, "prompt": prompt}
    json.dump(q, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def gemini(prompt, json_mode=True, search=False, max_retry=None, timeout=None):
    """Gemini REST 호출. json_mode면 JSON 객체를 파싱해 돌려준다."""
    if max_retry is None:
        max_retry = 1 if search else 2   # 4 → 2 (2026-10-26 비용: 시간 초과로 끊겨도 요금은 나간다)
    prompt = prompt + "\n" + QUALITY
    k = _bkey(prompt, json_mode, search)
    if BANK_ON[0] and k in BANK:   # 클국장이 미리 써 둔 답
        text = BANK[k] if isinstance(BANK[k], str) else json.dumps(BANK[k], ensure_ascii=False)
        print(f"[bank] {k} 클국장 답 사용")
        return text if not json_mode else parse_json(text)
    if BANK_MODE:
        _queue(k, prompt, json_mode, search)
        raise BankWait(k)
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY 없음")
    if search and getattr(gemini, "search_ok", True) is False:
        raise RuntimeError("검색 기능 사용 불가(앞서 확인됨)")
    if getattr(gemini, "broke", False):   # 선불 잔액 소진(402)을 한 번 봤으면 그 뒤로는 부르지 않는다 (2026-10-27 — 다시 부르며 시간만 쓰다 사랑방 작업이 10분에 끊겼다)
        raise RuntimeError("구글 잔액 소진(402) — 부르지 않음")
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
            lean(body, model)   # 생각 양 '낮음' (2026-10-26 비용)
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
                if e.code == 402:
                    gemini.broke = True
                    raise RuntimeError(f"구글 잔액 소진(402): {msg[:120]}")
                if e.code == 404:
                    if model in gemini.models and not search:
                        gemini.models.remove(model)  # 없어진 모델은 이후 건너뜀
                    break
                if e.code == 400:
                    if "thinking" in detail.lower() and LEAN[0]:
                        LEAN[0] = False; print("[gemini] 생각 양 설정을 받지 않음 — 끄고 다시", file=sys.stderr); continue
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

def gen_greetings(d, fresh=False, avoid=None):
    # 일주일 치를 미리 만들어 둔 것이 있으면 그대로 쓴다 (대표 2026-10-25: 블로그 예약 발행용 — 사이트·블로그 카드가 같은 글귀)
    if not fresh:
        try:
            wk = json.load(open(os.path.join(os.path.dirname(HERE), "data", "greetings_week.json"), encoding="utf-8")).get(d.isoformat())
            if wk and len(wk) == 4 and all(len(line) <= 10 for x in wk for line in x.split("\n")): return wk
        except Exception: pass
    season = ["겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울"][d.month - 1]
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일, {season}이다.
아침 인사 카드에 넣을 짧은 인사말 4개를 만들어라. 카톡으로 친구에게 보내는 사진 카드에 들어간다.
각 인사말은 세 줄, 줄마다 2~8글자 내외의 짧은 구절, 줄바꿈은 \\n으로. 전체 28자 이내.
1번: 계절·날씨가 느껴지는 따뜻하고 품격 있는 인사. 2번: 안부를 묻거나 응원하는 다정한 인사.
3번·4번: 피식 웃음이 나는 위트 있는 인사. 말장난, 귀여운 과장, 요즘 말투를 살짝 섞어도 좋다(예: "커피 한 잔에\\n배터리 100%\\n오늘도 출동!", "오늘 할 일:\\n잘 먹고 잘 웃기\\n끝!"). 예시를 그대로 쓰지 말 것. 나이·건강·늙음 이야기, 비꼬기 금지.
형식: {{"greetings": ["...","...","...","..."]}}""" + (("\n같은 주 다른 날에 이미 쓴 인사말이다. 첫 구절·소재(커피·점심·할 일 목록 등)·말틀이 겹치지 않게 전혀 다른 것으로 써라:\n" + "\n".join(a.replace("\n", " / ") for a in avoid)) if avoid else ""))
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


def gen_mind(d):
    """오늘의 마음 한 줄 — 짧은 문장 하나와 풀이, 오늘 해 볼 것."""
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 하루를 차분히 붙잡아 주는 '마음 한 줄'을 쓴다.
읽는 사람은 50~60대지만 생각과 생활은 40대다. 설교·훈계·자기계발서 말투 금지. 치유·힐링·멘탈 같은 외래어 금지. 나이 이야기 금지.
- line: 오늘의 문장 한 줄(25~45자). 누구나 아는 흔한 명언(법정·니체·괴테의 유명 구절 등) 금지. 담백하고 결이 있는 문장. 출처가 있으면 그대로, 없으면 새로 쓴다.
- by: 출처(사람 이름이나 책 제목). 지어내지 말 것 — 확실하지 않으면 빈 문자열.
- note: 그 문장을 오늘 하루에 붙여 읽는 풀이 두 문장(70~110자). 구체적인 장면이 떠오르게.
- todo: 오늘 해 볼 작은 일 한 문장(25~45자). 돈 들지 않고 혼자 지금 할 수 있는 것.
형식(JSON만): {{"line":"...","by":"...","note":"...","todo":"..."}}""", json_mode=True)
    out = {k: str(j.get(k, "")).strip() for k in ("line", "by", "note", "todo")}
    assert out["line"] and out["note"], "마음 한 줄 비어 있음"
    return out



# 오늘의 몸 한 가지 — 날마다 주제를 돌려 쓴다(한 달 안에 겹치지 않게)
BODY_TOPICS = [
    "무릎", "허리", "어깨와 목", "발과 발목", "손과 손목", "눈",
    "잠", "혈압", "혈당", "소화", "체온과 추위·더위", "숨과 폐활량",
    "다리 근력", "균형 감각", "걷는 자세", "앉아 있는 시간", "물 마시기", "단백질",
    "치아와 잇몸", "귀와 소리", "피부", "장", "심장 박동", "손톱·머리카락",
    "아침에 일어나는 법", "저녁에 몸을 식히는 법", "계단", "가방 드는 법",
]


def gen_body(d):
    """오늘의 몸 한 가지 — 몸에 관한 것 하나를 짧고 담백하게. 겁주지 않고, 오늘 해 볼 것 한 줄까지."""
    topic = BODY_TOPICS[d.toordinal() % len(BODY_TOPICS)]
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 오늘의 주제는 '{topic}'이다. 이 주제로 '오늘의 몸 한 가지'를 쓴다.
읽는 사람은 50~60대지만 생각과 생활은 40대다(러닝·골프·혼자 여행·새 일). 고급 라이프스타일 매거진의 몸 이야기 한 꼭지처럼 쓴다.
지킬 것:
- 겁주지 않는다. 병 이름을 늘어놓거나 '이러면 위험합니다' 식으로 쓰지 않는다. 진단·처방·약 이야기 금지.
- 시니어·어르신·노화·치매·은퇴·건강관리·웰니스·힐링 같은 말을 쓰지 않는다. 나이를 들먹이지 않는다.
- 누구나 아는 뻔한 말(물 많이 드세요, 스트레칭 하세요) 금지. 알아 두면 오늘 바로 써먹을 수 있는 구체적인 것 하나.
- 수치를 쓸 때는 널리 알려진 것만. 확실하지 않으면 숫자를 쓰지 않는다.
쓸 것:
- part: 주제를 한 낱말로(예: 무릎). '{topic}' 을 그대로 써도 된다.
- line: 오늘의 한 줄(20~34자). 제목처럼 또렷하게. 끝에 마침표를 찍지 않는다.
- note: 왜 그런지 풀어 주는 두세 문장(110~170자). 구체적인 장면(계단, 지하철, 책상, 골프장 같은)으로 시작하면 좋다.
- todo: 오늘 해 볼 것 한 문장(25~45자). 돈 들지 않고 지금 당장 혼자 할 수 있는 것. 횟수나 시간을 또렷하게.
- tip: 덧붙이는 한 줄(25~45자). 흔히 잘못 알고 있는 것을 바로잡거나, 하면 더 좋아지는 요령.
형식(JSON만): {{"part":"...","line":"...","note":"...","todo":"...","tip":"..."}}""", json_mode=True)
    out = {k: str(j.get(k, "")).strip() for k in ("part", "line", "note", "todo", "tip")}
    out["part"] = out["part"] or topic
    assert out["line"] and out["note"] and out["todo"], "오늘의 몸 한 가지 비어 있음"
    return out


# 어쩌다 점점 집사 — 댕댕이·냥이 하루 한 편씩 (대표 2026-10-24). 주제를 돌려 쓰고, 지난 제목과 겹치지 않게.
PET_TOPICS = {
    "dog": ["산책 뒤 행동", "밥·간식", "나이 든 아이", "혼자 있는 시간", "목욕·털 관리", "발·발톱", "잠버릇", "짖음", "철 따라 챙길 것",
            "놀이·장난감", "낯선 사람·손님", "차 타기·여행", "이빨·입 냄새", "물 마시기", "몸짓으로 하는 말", "새 식구 맞이"],
    "cat": ["물 마시기", "화장실", "밥·간식", "털 뿜뿜·빗질", "밤에 우다다", "숨는 자리", "나이 든 아이", "발톱·스크래처", "철 따라 챙길 것",
            "골골송·몸짓", "혼자 있는 시간", "창밖 구경", "사냥 놀이", "높은 곳", "새 식구 맞이", "병원 가는 날"],
}
PETS_FILE = os.path.join(HERE, "..", "data", "pets.json")


def gen_pet(d):
    """어쩌다 점점 집사 — 댕댕이·냥이 이야기 한 편씩. data/pets.json 맨 앞에 넣어 지난 이야기 목차가 쌓인다(같은 커밋으로 올라간다)."""
    try:
        with open(PETS_FILE, encoding="utf-8") as fp:
            db = json.load(fp)
    except Exception:
        db = {"dog": [], "cat": []}
    key, out = d.isoformat(), {}
    for k, nm, real in (("dog", "댕댕이", "강아지"), ("cat", "냥이", "고양이")):
        lst = db.setdefault(k, [])
        have = next((x for x in lst if x.get("date") == key), None)
        if have:
            out[k] = have; continue
        topic = PET_TOPICS[k][d.toordinal() % len(PET_TOPICS[k])]
        past = "\n".join("- " + x.get("title", "") for x in lst[:40])
        j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 잡지 '오마주'의 코너 '어쩌다 점점 집사'에 실을 {real}({nm}) 이야기 한 편을 쓴다. 오늘의 주제: '{topic}'.
읽는 사람은 50~60대지만 생각과 생활은 40대다. 아이(반려동물)를 가족처럼 키우는 집사들. 고급 라이프스타일 매거진의 따뜻하고 재치 있는 한 꼭지처럼.
지킬 것:
- 겁주지 않는다. 병 이름을 늘어놓지 않는다. 진단·약·주사·사료 상표 이야기 금지. 널리 알려진 생활 요령만. 확실하지 않은 숫자는 쓰지 않는다.
- 시니어·어르신·노후·은퇴 같은 말 금지. 집안 사연(아내·남편·손주) 금지.
- 지난 제목과 겹치는 이야기 금지:
{past or '- (없음)'}
쓸 것(JSON만):
- kind: 이야기 갈래 한두 낱말(예: 행동, 챙길 것, 나이 든 아이, 놀이)
- title: 집사의 속마음으로 말을 거는 제목 한 문장(22~38자). '우리 {nm}' 같은 애칭을 자연스럽게. 낚시·과장 금지. 예: "산책만 다녀오면 발만 핥는 우리 {nm}, 괜찮은 걸까?"
- hook: 집에서 실제로 보는 장면 두 문장(50~80자). 정보가 아니라 공감 가는 순간.
- why: 왜 그런지 두세 문장(90~150자). 본문에는 '{real}'라는 말을 한 번 이상 쓴다.
- todo: 오늘 해 볼 것 세 가지(각 25~50자, 돈 많이 들지 않고 집에서 바로).
- vet: 이럴 땐 동물병원에 — 눈에 보이는 신호로 한 문장(30~60자).
형식: {{"kind":"...","title":"...","hook":"...","why":"...","todo":["...","...","..."],"vet":"..."}}""", json_mode=True)
        a = {"id": f"{k}-{key}", "date": key, "kind": str(j.get("kind", "")).strip(), "title": str(j.get("title", "")).strip(),
             "hook": str(j.get("hook", "")).strip(), "why": str(j.get("why", "")).strip(),
             "todo": [str(t).strip() for t in (j.get("todo") or []) if str(t).strip()][:3], "vet": str(j.get("vet", "")).strip()}
        assert a["title"] and a["why"] and len(a["todo"]) >= 2 and a["vet"], f"{nm} 이야기 비어 있음"
        bad = re.search(r"진단|처방|약을|주사|시니어|어르신|노후", a["why"] + " ".join(a["todo"]) + a["title"])
        assert not bad, f"{nm} 금지어: {bad.group(0)}"
        lst.insert(0, a); del lst[120:]
        out[k] = a
    with open(PETS_FILE, "w", encoding="utf-8") as fp:
        json.dump(db, fp, ensure_ascii=False, indent=1)
    return out


# 혼자라서 좋은 날 — 혼자일 때 더 좋은 하루 (대표 2026-10-24). 혼밥·살림 / 취미·혼자 보기를 하루씩 번갈아, 하루 코스·여행은 매주 금요일.
#  장소가 나오는 칸은 구글 검색으로 고르고, 한 번 더 검색해 '지금 실제로 있는 곳'만 남긴다(지어낸 곳은 신뢰를 바로 깬다).
#  '혼자일 때 무엇이 좋은가(solo)'를 항목마다 꼭 쓴다 — 산·나들이·여행 코너와 다른 이 칸의 값.
SOLO = {
    "day":   ("혼자 떠나는 하루 코스", True,  "아침부터 저녁까지 혼자 돌기 좋은 동선 하나(걷는 길·혼밥집·카페·서점·전망 같은 4~5곳을 시간 순서로). name 에 들를 곳, where 에 동네, note 에 그곳에서 할 일, time 에 시각(예: 오전 10시)."),
    "eat":   ("혼밥 맛집", True,  "1인석·바 좌석이 있거나 1인분을 파는, 혼자 가도 편한 식당 3~4곳. 노포·국밥·면·백반·초밥 바 등 결이 있는 집. name 식당 이름, where 동네·역, note 대표 메뉴와 맛."),
    "hobby": ("혼자 즐기는 취미 자리", True,  "오늘의 갈래: {topic}. 혼자 조용히 즐길 수 있는 실제 장소 3~4곳. name 장소 이름, where 시군구, note 무엇을 어떻게 즐기는지."),
    "see":   ("혼자 보기 좋은 것", True,  "오늘의 갈래: {topic}. 혼자 가기 좋은 실제 장소나 지금 하는 전시·공연 3~4개. name 이름, where 장소, note 무엇을 보는지·언제 가면 좋은지."),
    "home":  ("혼자 사는 살림", False, "오늘의 주제: {topic}. 혼자 사는 집에서 바로 써먹는 생활 요령 3~4가지. name 요령 한 줄 제목, where 는 빈칸, note 어떻게 하는지 두 문장. 겁주지 않고, 병·약 이야기 없이."),
    "trip":  ("혼자 떠나는 여행", True,  "혼자 1박 2일로 다녀오기 좋은 국내 여행지 한 곳({region} 쪽)과 그곳에서 들를 곳 3~4곳. name 들를 곳, where 시군구, note 할 일, time 은 '첫날 오후' 같은 때."),
}
SOLO_TOPIC = {"hobby": ["혼자 가는 조용한 낚시터", "혼자 치기 좋은 골프 연습장·파3", "1인 캠핑·차박 자리", "혼자 걷기 좋은 둘레길", "혼자 가는 사진 산책 명소", "혼자 다니는 자전거 길"],
              "see": ["혼영하기 좋은 극장", "평일 조용한 미술관", "혼자 가기 좋은 공연·클래식", "혼자 머물기 좋은 큰 서점·도서관"],
              "home": ["1인분 장보기", "혼자 먹는 저녁 한 그릇", "작은 집 정리", "혼자 아플 때 미리 챙겨 둘 것", "혼자 사는 집 안전", "주말 아침 나를 위한 루틴", "혼자 사는 집 냉장고 관리", "혼자 쓰는 돈 관리"]}
SOLO_REG = ["서울", "경기", "부산", "강원", "서울", "인천", "대구", "제주", "서울", "대전", "광주", "경북", "전남", "충남", "경남"]
SOLO_FILE = os.path.join(HERE, "..", "data", "solo.json")


def _solo_verify(items, region):
    """장소마다 지금 실제로 있는 곳인지 검색으로 한 번 더 본다 — 확인 못 한 곳은 뺀다"""
    q = "\n".join(f"{i}. {x.get('name')} ({x.get('where')})" for i, x in enumerate(items))
    try:
        j = gemini(f"""아래는 한국 {region} 쪽 장소 목록이다. 구글 검색으로 하나씩 확인해서, 지금 실제로 있고(폐업·종료 아님) 이름과 위치가 맞는지 판정하라.
확실히 확인된 것만 ok=true. 조금이라도 의심스러우면 false.
{q}
형식(JSON만): {{"ok":[true,false,...]}}""", json_mode=True, search=True)
        ok = j.get("ok") or []
        return [x for i, x in enumerate(items) if i < len(ok) and ok[i] is True]
    except Exception as e:
        print(f"[solo] 확인 실패 — 이번엔 싣지 않음: {str(e)[:100]}", file=sys.stderr)
        return []


def gen_solo(d, keys=None):
    """혼자라서 좋은 날 — 오늘 차례인 칸에 새 글 한 편씩. data/solo.json 맨 앞에 쌓는다(같은 커밋으로 올라간다)."""
    try:
        with open(SOLO_FILE, encoding="utf-8") as fp:
            db = json.load(fp)
    except Exception:
        db = {}
    key, n = d.isoformat(), d.toordinal()
    keys = keys or ((["eat", "home"] if n % 2 == 0 else ["hobby", "see"]) + (["day", "trip"] if d.weekday() in (0, 2, 4) else []))   # 하루 코스·여행은 월·수·금 주 세 번(대표 2026-10-27 "일주일에 두세 번"), 나머지 넷은 이틀에 한 번
    out = {}
    for k in keys:
        name, places, guide = SOLO[k]
        lst = db.setdefault(k, [])
        have = next((x for x in lst if x.get("date") == key), None)
        if have: out[k] = have; continue
        region = SOLO_REG[(n // 2 + list(SOLO).index(k)) % len(SOLO_REG)]
        topics = SOLO_TOPIC.get(k) or [""]
        topic = topics[(n // 2) % len(topics)]
        past = "\n".join("- " + x.get("title", "") for x in lst[:30])
        g = guide.format(topic=topic, region=region)
        prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 잡지 '오마주 매거진'의 코너 '혼자라서 좋은 날 · {name}' 한 편을 쓴다.
읽는 사람은 40~60대. 혼자가 쓸쓸한 처지가 아니라 '고른 시간'인 사람들 — 돌싱도, 각자의 삶을 사는 부부도, 혼자가 편한 사람도. 외로움·돌싱·이혼·사별 같은 말은 쓰지 않는다. 밝고 담백하게.
{('지역: ' + region + '. 실제로 있는 곳만 구글 검색으로 확인해서 고른다. 지어내지 않는다. 폐업했거나 확인 안 되는 곳은 넣지 않는다. 너무 유명한 관광지보다 혼자 가기 편한 곳.') if places else ''}
쓸 것: {g}
항목마다 solo(살림 칸은 빈칸): '혼자라서 좋은 점'을 한 문장(25~45자) — 1인석·눈치 안 보이는 분위기·혼자 걷기 좋은 길·조용한 시간대처럼 구체적으로.
- title: 말을 거는 제목 한 문장(20~36자). 예) "혼자 가도 눈치 안 보이는 서촌 국숫집 세 곳"
- hook: 공감 가는 장면 두 문장(50~80자).
- tips: 혼자 갈 때 알아 두면 좋은 요령 두 가지(각 25~50자).
지난 제목과 겹치지 않게:
{past or '- (없음)'}
형식(JSON만): {{"title":"...","hook":"...","items":[{{"name":"...","where":"...","time":"","note":"...","solo":"..."}}],"tips":["...","..."]}}"""
        a = None
        for tries in range(2):
            try:
                j = gemini(prompt, json_mode=True, search=places)
            except Exception as e:
                print(f"[solo] {k} 실패: {str(e)[:100]}", file=sys.stderr); continue
            items = [x for x in (j.get("items") or []) if x.get("name") and x.get("note")][:5]
            if places: items = _solo_verify(items, region)
            if len(items) < 2 or not j.get("title"): continue
            bad = re.search(r"돌싱|이혼|사별|외로|쓸쓸|시니어|어르신|노후", j.get("title", "") + j.get("hook", "") + json.dumps(items, ensure_ascii=False))
            if bad: print(f"[solo] {k} 금지어 {bad.group(0)} — 다시", file=sys.stderr); continue
            a = {"id": f"{k}-{key}", "date": key, "corner": k, "region": region if places else "", "topic": topic,
                 "title": str(j["title"]).strip(), "hook": str(j.get("hook", "")).strip(),
                 "items": [{f: ("" if (f == "time" and k not in ("day", "trip")) or (f == "solo" and k == "home") else str(x.get(f, "")).strip()) for f in ("name", "where", "time", "note", "solo")} for x in items],   # 영업시간은 자주 바뀌어 싣지 않는다
                 "tips": [str(t).strip() for t in (j.get("tips") or []) if str(t).strip()][:3]}
            break
        if not a: print(f"[solo] {k} 오늘은 못 만듦 — 지난 글이 그대로 보인다", file=sys.stderr); continue
        lst.insert(0, a); del lst[1000:]   # 지난 글도 아깝다 — 목록으로 계속 본다 (대표 2026-10-27)
        out[k] = a
    with open(SOLO_FILE, "w", encoding="utf-8") as fp:
        json.dump(db, fp, ensure_ascii=False, indent=1)
    assert out, "혼자라서 좋은 날 — 한 칸도 못 만듦"
    return out


def gen_book(d):
    """오늘의 한 권 — 실제로 나온 책 하나를 골라 잡지 책 소개면처럼.
    책 속 문장을 그대로 옮기지 않는다(저작권). 어떤 대목에서 멈추게 되는지를 내 말로 쓴다."""
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 오늘 소개할 책 한 권을 구글 검색으로 확인해서 고른다.
읽는 사람은 50~60대지만 생각과 생활은 40대다(유튜브·넷플릭스, 러닝·골프, 혼자 여행, 새 일, 콘서트).
고르는 기준:
- 한국에서 실제로 구할 수 있는 책. 제목·지은이·옮긴이·출판사를 검색으로 확인한 것만. 확실하지 않으면 다른 책으로 바꾼다.
- 베스트셀러 1위 같은 너무 뻔한 책, 자기계발·재테크·처세 책은 피한다. 요즘 많이 읽히는 책과 오래된 좋은 책을 섞되 오늘은 하나만.
- 소설·에세이·역사·과학·예술·여행기 등 결이 있는 책. 어렵고 현학적인 책도 피한다.
- 죽음·질병·노년을 주제로 한 책은 피한다.
쓸 것:
- title, author, publisher: 검색으로 확인한 그대로. translator 는 번역서일 때만, 아니면 빈 문자열.
- year: 한국에서 나온 해(네 자리 숫자 문자열). 확실하지 않으면 빈 문자열.
- kind: 소설 / 에세이 / 역사 / 과학 / 예술 / 여행기 처럼 한 낱말.
- blurb: 어떤 책인지 세 문장(120~180자). 줄거리를 다 풀지 말고, 이 책이 무엇을 들여다보는지. 출판사 홍보 문구를 그대로 옮기지 말 것.
- scene: 읽다가 멈추게 되는 대목 하나를 **내 말로 옮긴** 두 문장(70~110자). 책 속 문장을 그대로 따오지 말 것. "~하는 대목이 있습니다" 처럼.
- why: '이런 날 읽기 좋습니다' 한 줄(25~45자). 구체적인 장면이 떠오르게.
형식(JSON만): {{"title":"...","author":"...","translator":"","publisher":"...","year":"","kind":"...","blurb":"...","scene":"...","why":"..."}}""", json_mode=True, search=True)
    out = {k: str(j.get(k, "")).strip() for k in ("title", "author", "translator", "publisher", "year", "kind", "blurb", "scene", "why")}
    assert out["title"] and out["author"] and out["blurb"], "오늘의 한 권 비어 있음"
    return out



def gen_movies(d):
    """이번 주 극장 — 지금 걸려 있는 영화 네 편. 보도자료 문구를 옮기지 않는다."""
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 지금 한국 극장에서 상영 중이거나 이번 주에 개봉하는 영화 4편을 구글 검색으로 확인해서 골라라.
읽는 사람은 50~60대지만 생각과 생활은 40대다. 관객이 많이 드는 작품과 조용하지만 좋은 작품을 섞어라. 애니메이션만 넷이 되지 않게.
확인된 것만 쓴다. 제목·감독·주연·개봉일이 확실하지 않으면 그 작품은 빼라.
각 항목:
- title(한국 개봉 제목), director(감독), cast(주연 두 명까지 ' · '로), opened(개봉일 '10월 15일' 꼴, 개봉 예정이면 'N월 N일 개봉'), rating(관람 등급 '15세' 꼴, 모르면 빈 문자열)
- why: 어떤 영화인지 두 문장(60~100자). 줄거리를 다 말하지 말 것. 홍보 문구를 그대로 옮기지 말 것.
형식(JSON만): {{"items":[{{"title":"...","director":"...","cast":"...","opened":"...","rating":"","why":"..."}}, ...]}}""", json_mode=True, search=True)
    items = [x for x in j.get("items", []) if x.get("title") and x.get("why")][:4]
    assert items, "극장 비어 있음"
    return items


def gen_stage(d, region):
    """이번 주 무대·전시 — 한 지역의 공연 3개와 전시 3개."""
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 한국 '{region}' 지역에서 지금 하고 있거나 이번 달 안에 볼 수 있는
공연(연극·뮤지컬·콘서트·국악·클래식) 3개와 전시(미술관·박물관·사진전) 3개를 구글 검색으로 확인해서 찾아라.
읽는 사람은 50~60대지만 생각과 생활은 40대다. 어린이 공연과 지나치게 실험적인 것은 뺀다.
실제로 열리는 것만. 기간·장소가 확인되지 않으면 그 항목은 빼라.
각 항목: title(이름 20자 이내), where(장소 20자 이내), when(기간 '10월 2일~11월 9일' 꼴), price(값대 '3만~7만 원' 꼴, 무료면 '무료', 모르면 빈 문자열),
why(어떤 무대·전시인지 한 문장 40~70자. 홍보 문구를 옮기지 말 것).
형식(JSON만): {{"stage":[{{"title":"...","where":"...","when":"...","price":"","why":"..."}}, ...], "exhibit":[...]}}"""
    j = gemini(prompt, json_mode=True, search=True)
    out = {k: [x for x in j.get(k, []) if x.get("title") and x.get("when")][:3] for k in ("stage", "exhibit")}
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
    recent = ", ".join(recent_titles(d, "meal")) or "없음"
    j = gemini(f"""{season}({d.month}월)에 어울리는, 혼자서도 15~20분이면 만드는 한 끼 요리 하나를 정해라. 재료 5가지 이내, 흔한 재료. 한식·간단 양식·면 요리 등 매일 다르게.
요 며칠 낸 요리: {recent}. **이 요리들의 주재료(예: 표고버섯)는 다시 쓰지 말고**, 주재료·조리법이 다른 것으로 고른다.
형식: {{"meal": {{"title":"요리 이름(12자 이내)", "sub":"1인분 · N분 · 재료 N가지", "lead":"요리를 권하는 두 문장(50~80자, 제철 이야기 포함)", "ingredients":["재료와 양", ...5개 이내], "steps":["한 문장", "한 문장", "한 문장"], "tip":"한 문장"}}}}""")
    m = j["meal"]
    assert m.get("title") and len(m.get("steps", [])) >= 2 and m.get("ingredients"), "한 끼 형식 오류"
    return m


def recent_titles(d, key, days=14):
    """요 며칠 낸 제목 — 같은 재료·같은 일이 연달아 나오지 않게 (2026-10-23: 여드레 중 이레가 표고버섯, 정원은 이틀 내리 알뿌리)"""
    out = []
    for k in range(1, days + 1):
        p = os.path.join(HERE, "..", "daily", (d - datetime.timedelta(days=k)).isoformat() + ".json")
        try:
            t = (json.load(open(p, encoding="utf-8")).get(key) or {}).get("title")
            if t and t not in out: out.append(t)
        except Exception:
            pass
    return out


def recent_quiz_terms(d, days=21):
    """요 며칠 다룬 시사 용어 — 같은 말이 연달아 나오지 않게 (2026-10-20: 사흘 내리 '텍스트힙')"""
    out = []
    for k in range(1, days + 1):
        p = os.path.join(HERE, "..", "daily", (d - datetime.timedelta(days=k)).isoformat() + ".json")
        try:
            t = (json.load(open(p, encoding="utf-8")).get("quiz") or {}).get("term")
            if t and t not in out: out.append(t)
        except Exception:
            pass
    return out


def gen_quiz(d):
    """오늘의 시사 상식: 최근 뉴스에 자주 나오는 말 하나를 골라 풀어 주고, 확인 문제 하나."""
    recent = ", ".join(recent_quiz_terms(d)) or "없음"
    # 사흘에 한 번은 **요즘 말(신조어)** — 10~30대가 쓰는 말을 알아 두면 대화가 된다 (운영자 2026-10-20).
    # 가르치려 들지 않고, "요즘 애들 말" 같은 낮춰 보는 틀도 쓰지 않는다. 그냥 재미있는 말 하나를 아는 것.
    slang = (d.toordinal() % 3 == 0)
    what = ("최근 1~2년 사이 10~30대가 실제로 자주 쓰는 **요즘 말(신조어·줄임말)** 하나를 구글 검색으로 골라라.\n"
            "유행어·밈·줄임말·새로 생긴 표현 중에서. 비속어·혐오 표현·특정인 조롱은 절대 고르지 않는다.\n"
            "'요즘 애들', '신세대' 같은 낮춰 보거나 선을 긋는 말투를 쓰지 않는다. 알아 두면 자식·조카와 말이 통하고\n"
            "모임에서 꺼내면 웃음이 나는 말로. 뜻풀이는 유래까지 짧게."
            if slang else
            "최근 일주일 한국 뉴스·방송·인터넷에서 자주 나오는 시사 용어 하나를 구글 검색으로 골라라.\n경제·기술·생활·문화·건강·사회 현상 중에서.")
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. {what} **요 며칠 다룬 {recent} 은(는) 절대 고르지 말고, 결이 다른 분야에서 고른다.** 정치인 이름·정당 논쟁·사건사고·특정 기업 홍보는 피한다. 40~60대 교양 있는 독자가 "아, 요즘 이걸 이렇게 부르는구나" 하고 배울 만한 말.
'디지털 디톡스·워라밸·MZ·소확행·번아웃'처럼 이미 몇 년째 누구나 아는 말은 피하고, 최근 1~2년 사이 새로 자주 쓰이는 말을 고른다. 모임에서 꺼내면 대화가 되는 수준.
형식(JSON만):
{{"quiz": {{"kind":"{'요즘 말' if slang else '시사 상식'}", "term":"용어(15자 이내)", "meaning":"한 줄 뜻(30자 이내)",
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
    q["answer"] = int(q["answer"]); q["kind"] = "요즘 말" if slang else "시사 상식"
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
          # 앞으로 나아가기 — '영포티가 실제로 하는 것' (대표 2026-10-24: 노래 교실·댄스·골프·파크골프는 너무 시니어 같다 → 뺐다)
          ("run", "러닝 입문", "처음 달리는 사람을 위한 러닝 기초(자세·호흡·무릎 안 아프게·5km 첫 도전). 밝고 활기찬 러닝 크루·코치 채널"),
          ("pilates", "필라테스·홈트", "집에서 10~20분 따라 하는 필라테스나 홈트레이닝. 에너지 있고 밝은 화면"),
          ("photo", "폰 사진 잘 찍기", "휴대폰으로 여행·음식·인물 사진을 감각 있게 찍는 요령"),
          ("coffee", "커피·와인 한 잔", "핸드드립 커피 내리는 법이나 와인 고르는 법·마시는 법 같은 취미 입문"),
          ("camp", "차박·캠핑 첫걸음", "처음 하는 차박·캠핑 준비물과 요령, 감성 캠핑")]
REGIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]


# 잡지에 어울리지 않는 영상 거르기: 나이 딱지(실버·시니어·어르신·노인·치매), 쇼츠, 광고·이벤트, 짧은 맛보기
YT_BAD = re.compile(r"실버|시니어|어르신|노인|치매|요양|중장년|노래교실|shorts|#shorts|이벤트|구독|광고|협찬|리액션|먹방|레전드|전국노래자랑|노래자랑|\d{2}세\b|\(\d{2}세\)|알아내다니|굿바이|충격|대박|미쳤", re.I)
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


FOLLOW_FALLBACK = {"gym": ("아침 요가 초보", "가볍게 몸을 펴며 하루를 열어 보세요"), "meditate": ("10분 아침 명상", "숨을 고르며 마음을 가만히 내려놓아 보세요"),
                   "run": ("러닝 입문 5km 처음 달리기", "오늘은 딱 10분만, 천천히 달려 볼까요"), "pilates": ("필라테스 홈트 20분", "매트 하나면 충분해요, 땀 한번 내 봐요"),
                   "photo": ("핸드폰 사진 잘 찍는 법", "오늘 찍는 한 장이 인생샷이 될지도"), "coffee": ("핸드드립 커피 내리는 법", "오늘은 내 손으로 내린 커피 한 잔"),
                   "camp": ("차박 처음 준비물", "이번 주말, 트렁크 열고 떠나 볼까요")}


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
    return gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. '오늘의 따라하기' 일곱 항목 각각에 대해 유튜브 검색어 하나와 한 줄 권유 문구를 만들어라.
항목: {json.dumps([(k, n, desc) for k, n, desc in FOLLOW], ensure_ascii=False)}
검색어는 한국어 유튜브에서 실제로 좋은 영상이 나올 만한 자연스러운 말(8~16자), 날마다 조금씩 다르게. "시니어·어르신·노인·중장년" 금지.
보는 사람은 나이는 50대여도 감각은 40대 — 젊고 밝은 채널, 요즘 유행하는 것이 나오게.
권유(say)는 20~40자, 오늘 기분에 맞게.
형식: {{"follow": {{"gym": {{"query":"...", "say":"..."}}, "meditate": {{...}}, "run": {{...}}, "pilates": {{...}}, "photo": {{...}}, "coffee": {{...}}, "camp": {{...}}}}}}""")


def gen_phrase(d):
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. '오늘의 회화' — 영어·일본어·중국어 각 한 문장. 여행·식당·인사·쇼핑·길 묻기 등 실제로 쓸 상황 하나를 정해 세 언어가 같은 뜻이 되게.
각 언어: text(원문), reading(한국어로 적은 발음. 원문의 낱말(어절) 단위로 띄어 쓴다. 예: "체크 플리즈", "오카이케이오 오네가이시마스", "마이단 셰셰". 한 글자씩 띄우지 말 것), meaning(우리말 뜻), tip(쓰는 상황이나 한 가지 요령, 30자 이내).
중국어는 간체와 함께 reading에 성조 없이 한국어 발음만. 일본어는 한자 포함 원문.
형식: {{"phrase": {{"topic":"어떤 상황인지 사람 말로 8~14자(예: '식당에서 메뉴 고를 때', '택시에서 길 알려 줄 때'). '추천 요청'처럼 말토막으로 쓰지 말 것", "en": {{"text":"...","reading":"...","meaning":"...","tip":"..."}}, "ja": {{...}}, "zh": {{...}}}}}}""")
    p = j["phrase"]
    assert all(k in p and p[k].get("text") for k in ("en", "ja", "zh")), "회화 형식 오류"
    return p


def gen_outing(d):
    from concurrent.futures import ThreadPoolExecutor
    out = {}
    wk = d + datetime.timedelta(days=(5 - d.weekday()) % 7)  # 이번 토요일
    def one(region):
        prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 한국 '{region}' 지역에서 이번 주말({wk.month}월 {wk.day}일 전후)에 가볼 만한 곳 4개를 구글 검색으로 찾아라.
앞의 3개는 전시·공연·축제·장터·단풍길·둘레길·공원 등 실제로 지금 열리고 있거나 갈 수 있는 곳만.
**네 번째 하나는 kind 를 '숨은 곳' 으로 하고, 번잡한 데를 피해 조용히 쉴 만한 자리**를 골라라 —
사람 적은 수목원·외곽의 정원 카페·풍광 좋은 낚시터·한적한 저수지 둘레·오래된 서점 같은 곳.
유명 관광지는 넣지 마라. 확인 안 되는 건 넣지 마라. 각 항목: title(이름, 16자 이내), where(장소, 20자 이내), when(기간이나 시간, 20자 이내), why(가 볼 이유 한 문장 40~70자), kind(전시|공연|축제|나들이|숨은 곳 중 하나).
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


def gen_garden(d):
    """오늘의 정원 — 주 2~3회(월·수·금)만 새로 쓰고, 다른 날은 지난 것을 그대로 둔다.
    철을 타는 이야기라 며칠 같아도 어색하지 않고, 매일 새로 쓰면 할 말이 금세 바닥난다."""
    mm = d.month
    season = ("한겨울" if mm in (12, 1, 2) else "봄" if mm in (3, 4, 5)
              else "한여름" if mm in (6, 7, 8) else "가을")
    recent = ", ".join(recent_titles(d, "garden")) or "없음"
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일, 한국의 {season}이다.
마당·화분·주말농장을 가꾸는 사람에게 **이 철에 지금 해야 할 일 한 가지**를 알려 주는 짧은 글을 쓴다.
요 몇 주 다룬 글: {recent}. **같은 일(예: 알뿌리 심기)을 다시 쓰지 말고** 이 철의 다른 일을 고른다.
읽는 사람은 40~70대, 베란다 화분부터 작은 마당까지 제각각이다.

[쓰는 법]
- 고급 라이프스타일 매거진의 정원 칼럼. 부드러운 구어체("~예요/~죠/~거든요"). 느낌표 금지.
- **지금 이 주에 해야 하는 일**이어야 한다. 한 달 뒤에 할 일이나 이미 지난 일은 안 된다.
- 숫자를 하나는 넣어 손이 가게 한다(깊이·간격·횟수·온도). 다만 어려운 학명·전문 용어는 쓰지 않는다.
- 겁주지 않는다. 농약·비료 상품명과 정확한 약제량은 쓰지 않는다.
- 시니어·어르신·노인 같은 말을 쓰지 않는다.
- 베란다 화분만 있는 사람도 해 볼 수 있게 한 줄은 배려한다.

[형식] JSON 만:
{{"garden": {{
 "title": "한 줄 제목 (16~28자, 할 일이 드러나게)",
 "when": "지금 할 때 (예: 10월 중순 ~ 11월 초)",
 "body": ["본문 1 (60~90자)", "본문 2 (60~90자)", "본문 3 (60~90자)"],
 "tip": "요령 하나 (50~80자)",
 "myth": "잘못 알려진 것 하나 — 따옴표로 그 말을 적고 바로잡는다 (50~90자)",
 "by": "오마주 정원노트"
}}}}"""
    j = gemini(prompt, json_mode=True)
    g = j.get("garden", {})
    if not (g.get("title") and g.get("body")):
        raise RuntimeError("정원 내용이 비었음")
    g["by"] = "오마주 정원노트"
    return g


def gen_culture(d):
    data = json.load(open(os.path.join(HERE, "..", "data", "culture.json"), encoding="utf-8"))
    n = d.toordinal()
    poem = data["poems"][n % len(data["poems"])]
    quote = data["quotes"][(n * 7) % len(data["quotes"])]
    bible = data["bible"][(n * 5) % len(data["bible"])]
    dharma = data["dharma"][(n * 3) % len(data["dharma"])]
    ps = data["paintings"]
    # 그림은 날짜로만 고른다 — 사진을 받아 보고 고르면 받는 곳(깃허브·클국장 작업 공간)마다 고른 그림이 달라져
    # 주문서 문구가 바뀌고, 클국장이 밤에 써 둔 답을 못 찾는다(2026-10-27 문화·말 거는 제목이 그래서 비었다).
    cand = ps[(n * 3) % len(ps)]
    im = wiki_image(cand["wiki"])
    paint = {**cand, **(im or {})}
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
    if paint and paint.get("img"):   # 사진을 못 받았으면 빼 둔다 — 화면이 같은 차례로 사진을 직접 찾는다
        out["painting"] = {**paint, "about": a.get("painting_about", "").strip(), "points": [x for x in a.get("painting_points", []) if x], "artist_story": a.get("painting_artist", "").strip()}
    return out

# ── 저장 ────────────────────────────────────────────────

def gen_hooks(d, day):
    """판갈이 (대표 2026-10-24): 오늘 즐기기 칸 제목을 유튜브 썸네일처럼 '말 거는 한 줄'로.
    오늘 실제로 올라온 내용(day)만 보고 쓴다 — 내용에 없는 사실·숫자를 보태면 낚시가 된다."""
    meal, book, quiz, cul = day.get("meal") or {}, day.get("book") or {}, day.get("quiz") or {}, day.get("culture") or {}
    poem, humor = cul.get("poem") or {}, cul.get("humor") or {}
    src = {
        "food": {"제목": meal.get("title"), "소개": meal.get("lead"), "요령": meal.get("tip"), "분량": meal.get("sub")},
        "book": {"제목": book.get("title"), "지은이": book.get("author"), "소개": book.get("blurb"), "한 장면": book.get("scene")},
        "quiz": {"낱말": quiz.get("term"), "뜻": quiz.get("meaning"), "왜 화제": quiz.get("why")},
        "culture": {"오늘의 시": f"{poem.get('title', '')} — {poem.get('author', '')}", "시 풀이": poem.get("note"), "유머 제목": humor.get("title")},
    }
    src = {k: v for k, v in src.items() if any(v.values())}
    if not src: raise RuntimeError("오늘 내용이 아직 없음")
    j = gemini(f"""오마주는 마음은 40대인 50~60대가 매일 아침 보는 라이프스타일 매거진이다.
아래는 오늘 올라온 코너 내용이다. 코너마다 유튜브 썸네일처럼 '눌러 보고 싶게 말을 거는 제목' 한 줄과 밑줄 한 줄을 써라.
{json.dumps(src, ensure_ascii=False)}

[제목 hook] 18~26자. **독자에게 말을 걸어 자기 이야기를 떠올리게** — 읽는 사람이 속으로 "나는?" 하고 답하게 되는 물음이나 반전, 구체적인 장면으로(대표 2026-10-25: "일방향이 되면 안 된다, 그냥 주고 너는 봐라가 아니라"). 세 개 중 적어도 둘은 독자를 향한 물음으로. 뜻이 끊기는 자리에 줄바꿈(\\n)을 하나 넣어 두 줄로(줄마다 13자 이내, 앞줄이 조금 길게). 예: "카톡 답장 속도로 보는\\n나의 연애 온도". 예: "연근 하나로 파스타가 이렇게 된다고?", "값은 그대로인데 뭔가 달라졌다면, 그걸 부르는 말".
[밑줄 sub] 30자 이내. 무엇이 들어 있는지 담백하게.
[글 끝 물음 ask] 한 끼(food)·한 권(book)만. 30자 안팎, 독자 자신의 경험·취향을 묻는 정답 없는 물음 한 줄(대표 2026-10-25 "일방향이 되면 안 된다"). 예: "이 음식 하면 떠오르는 사람이 있나요?", "오래전에 읽었는데 아직 한 장면이 남은 책은요?". 숙제·시험 같은 물음, '댓글 달아 주세요' 같은 호소 금지.
[머리말 kick] '오늘의 한 끼 · 요리 이름'처럼 코너 이름 · 오늘 것 이름. 문화는 '오늘의 문화'만.
지킬 것: 위 내용에 있는 사실만 쓴다. 없는 숫자·효과·사람·장소·결과를 보태지 않는다(내용에 '미술관'이 없으면 미술관이라 쓰지 않는다). '충격' '경악' '무조건' '이것만' 같은 낚시 말,
느낌표 남발, 나이·건강 걱정·시니어 같은 말 금지. 퀴즈는 정답(낱말 뜻)을 제목에서 미리 말하지 않는다.
{QUALITY}
형식: {{"hooks": {{"food": {{"kick":"...","hook":"...","sub":"...","ask":"..."}}, "book": {{"kick":"...","hook":"...","sub":"...","ask":"..."}}, "quiz": {{"kick":"...","hook":"...","sub":"..."}}, ...}}}} (위에 있는 코너만)""")
    h = j.get("hooks") or {}
    out = {}
    for k in src:
        v = h.get(k) or {}
        if all(isinstance(v.get(x), str) and v[x].strip() for x in ("kick", "hook", "sub")) and len(v["hook"].replace("\n", "")) <= 34:
            out[k] = {x: v[x].strip() for x in ("kick", "hook", "sub")}
            if k in ("food", "book") and isinstance(v.get("ask"), str) and 6 <= len(v["ask"].strip()) <= 45:
                out[k]["ask"] = v["ask"].strip()
    # 머리말은 AI 에게 맡기지 않는다 — '오늘의 책'·'오늘의 퀴즈'처럼 코너 이름을 멋대로 바꿨다(2026-10-24 첫날)
    kick = {"food": f"오늘의 한 끼 · {meal.get('title', '')}".rstrip(" ·"), "book": f"오늘의 한 권 · 『{book.get('title', '')}』" if book.get("title") else "오늘의 한 권",
            "quiz": "오늘의 " + (quiz.get("kind") or "시사 상식"), "culture": "오늘의 문화"}
    for k in out: out[k]["kick"] = kick[k]
    assert out, "제목을 하나도 못 씀"
    return out


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
NEED = {"pet": ("dog", "cat"), "solo": (), "hooks": ("food", "book", "quiz"), "garden": ("title", "when", "body", "tip"), "culture": ("essay", "humor", "bible", "dharma", "poem"), "mind": ("line", "note"), "body": ("line", "note", "todo"), "book": ("title", "author", "blurb", "scene", "why"), "fortune": ("total",), "follow": tuple(k for k, _, _ in FOLLOW)}
def complete(name, v):
    if not v: return False
    # era: 그날의 신문(era_news)이 먼저 넣은 해는 노래 목록이 없어도 된다 — 앱이 data/songs.json 에서 같은 규칙으로 고른다
    if name == "follow":
        return all(isinstance(v.get(k), dict) and v[k].get("videoId") for k in NEED["follow"])
    if name == "fortune":
        # care(조심할 것)까지 있어야 '운세' 꼴이 된 것 — 옛 형식(total 만 있는 날)은 다시 만든다
        return isinstance(v, dict) and len(v) >= 12 and all(isinstance(x, dict) and x.get("total") and x.get("care") for x in v.values()) if isinstance(v, dict) else bool(v)
    return all(v.get(k) for k in NEED.get(name, ())) if isinstance(v, dict) else bool(v)


def recent_garden(d):
    """바로 앞 날짜들의 daily 파일에서 정원 글을 찾아 그대로 쓴다 (새로 쓰지 않는 날)."""
    for back in range(1, 10):
        f = os.path.join(HERE, "..", "daily", (d - datetime.timedelta(days=back)).isoformat() + ".json")
        try:
            with open(f, encoding="utf-8") as fp:
                g = (json.load(fp) or {}).get("garden")
            if g and g.get("title"): return g
        except Exception:
            pass
    return None


def snapshot(ref, key, fallback=None):
    """서버에 들어간 그날치를 daily/{날짜}.json 으로 떠 둔다 (오프닝·읽어 드려요가 이 파일을 읽는다)."""
    os.makedirs(os.path.join(HERE, "..", "daily"), exist_ok=True)
    full = ref.get().to_dict() or fallback or {}
    with open(os.path.join(HERE, "..", "daily", key + ".json"), "w", encoding="utf-8") as fp:
        json.dump(full, fp, ensure_ascii=False, indent=1, default=str)
    return full


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
    load_bank(key)
    if BANK_MODE:   # 클국장 밤 작업: 서버에 쓰지 않고 물음만 모은다 (돌 때마다 물음 목록을 새로 — 앞 답에 따라 뒤 물음이 바뀐다)
        try: os.remove(os.path.join(PRE, key + ".queue.json"))
        except FileNotFoundError: pass
        class _Doc:
            exists = False
            def to_dict(self): return {}
        class _Ref:
            def get(self): return _Doc()
            def set(self, *a, **k): pass
        ref = _Ref()
    else:
        db = firestore()
        ref = db.collection("daily").document(key)
    cur = ref.get()
    have = cur.to_dict() if cur.exists else {}
    if have.get("source") == "admin" and not force:
        print(f"{key} 관리자가 직접 쓴 내용이 있음. 건너뜀."); return

    out, errors = {}, []
    ref.set({"source": "auto", "startedAt": datetime.datetime.now(KST).isoformat()}, merge=True)
    for name, fn in [("greetings", gen_greetings), ("fortune", gen_fortune), ("era", gen_era), ("mind", gen_mind), ("body", gen_body), ("book", gen_book), ("meal", gen_meal), ("quiz", gen_quiz), ("story", gen_story), ("follow", gen_follow), ("phrase", gen_phrase), ("culture", gen_culture), ("outing", gen_outing), ("garden", gen_garden), ("pet", gen_pet), ("solo", gen_solo), ("hooks", None)]:
        if only and name not in only:
            continue
        if BANK_MODE and name == "outing":   # 지역 열일곱 곳 — 주간 나들이(outing_week)가 따로 쓴다
            continue
        fresh = name == "hooks" and any(k in out for k in ("meal", "book", "quiz", "culture"))   # 내용이 새로 나왔으면 제목도 새로
        if not force and not fresh and complete(name, have.get(name)):  # 다 갖춘 코너는 다시 만들지 않음 (AI 한도 아끼기). 빠지거나 덜 된 코너만 다음 실행에서 채움
            print(f"[skip] {name} 이미 있음"); continue
        if name == "garden" and not force and d.weekday() not in (0, 2, 4):
            prev = recent_garden(d)        # 월·수·금에만 새로 쓴다 (운영자 2026-10-22: 주 2~3회)
            if prev:
                out["garden"] = prev; ref.set({"garden": prev}, merge=True)
                print("[keep] garden 지난 것 그대로"); continue
        try:
            try:
                out[name] = gen_hooks(d, {**have, **out}) if name == "hooks" else fn(d)
            except Exception as e1:
                if BANK_MODE or not BANK: raise
                # 클국장 답으로 코너가 안 되면 그 코너만 구글로 다시 (예비 길)
                print(f"[bank] {name} 클국장 답으로 안 됨 → 구글로: {str(e1)[:100]}", file=sys.stderr)
                BANK_ON[0] = False
                try: out[name] = gen_hooks(d, {**have, **out}) if name == "hooks" else fn(d)
                finally: BANK_ON[0] = True
            if name == "outing":
                ref.set({"outing": out[name]}, merge=True)  # 지역별 필드 병합 (다른 묶음 결과 보존)
            elif name == "era":
                # 2026-10-28: 다섯 해를 한꺼번에 넣다가 한 해가 "invalid nested entity" 로 막혀 다섯 해가 다 빠졌다.
                # 해마다 따로 넣고, 막히면 그 해를 칸별로 나눠 넣어(막힌 칸만 빠지게) 어느 칸인지 기록에 남긴다.
                for ago, v in out[name].items():
                    try:
                        ref.set({"era": {ago: v}}, merge=True)
                    except Exception as e:
                        print(f"[era] {ago}년 전 한꺼번에 저장 실패: {str(e)[:100]} → 칸별로", file=sys.stderr)
                        for fk, fv in v.items():
                            try: ref.set({"era": {ago: {fk: fv}}}, merge=True)
                            except Exception as e2:
                                print(f"[era] {ago}년 전 {fk} 저장 실패: {str(e2)[:80]} 값={json.dumps(fv, ensure_ascii=False)[:600]}", file=sys.stderr)
            else:
                ref.set({name: out[name]}, merge=True)
            print(f"[ok] {name}")
        except BankWait as e:
            errors.append(f"{name}: 답 기다림 {e}"); print(f"[bank] {name} 답 기다림 {e}"); continue
        except Exception as e:
            out.pop(name, None)  # 저장에 실패한 코너는 마지막 한꺼번에 저장에서 빼서 다른 코너까지 날리지 않게
            errors.append(f"{name}: {e}")
            print(f"[fail] {name}: {e}", file=sys.stderr)
    if BANK_MODE:
        qf = os.path.join(PRE, key + ".queue.json")
        n = len(json.load(open(qf, encoding="utf-8"))) if os.path.exists(qf) else 0
        print(f"[bank] {key} 다 된 코너 {sorted(out)} · 답을 기다리는 물음 {n}개 ({qf})")
        print("[bank] 실패:", errors)
        return
    if not out:
        missing = [n for n in (only or []) if not have.get(n)]
        if missing or errors:
            raise SystemExit("아무것도 만들지 못함: " + ", ".join(errors)[:300])
        # 다 있어도 그날치 기록 파일은 떠 둔다 — 오프닝·읽어 드려요가 이 파일을 보고 대본을 쓴다 (2026-10-20)
        snapshot(ref, key)
        print(f"{key} 모든 코너가 이미 있음."); return
    # 코너는 위에서 이미 하나씩 저장했다. 여기서 또 한꺼번에 저장하면 한 코너의 모양이 조금만 어긋나도
    # (2026-10-20: "Property era contains an invalid nested entity") 그날치 기록 전체가 날아간다.
    # 그래서 마지막에는 표시만 남기고, 내용은 읽어 와서 파일로 떠 둔다.
    try:
        ref.set({"source": "auto", "generatedAt": datetime.datetime.now(KST).isoformat(), "errors": errors}, merge=True)
    except Exception as e:
        print(f"[fail] 표시 저장: {e}", file=sys.stderr)
    out["source"] = "auto"
    out["errors"] = errors
    snapshot(ref, key, out)
    print(f"{key} 저장 완료. 코너 {len(out) - 3}개" + (f", 실패 {len(errors)}개" if errors else ""))


if __name__ == "__main__":
    main()


def gen_travel(d, kind, avoid=()):
    """해외여행 — 골프 / 관광 / 자유여행. 한 칸에 네 곳."""
    want = {
        "golf": ("해외 골프 여행지", "라운딩하기 좋은 해외 골프 여행지. 코스 이름과 어느 나라 어느 도시인지, "
                 "몇 박이면 알맞은지, 골프장 수준과 그린피 느낌을 적는다."),
        "tour": ("해외 관광지", "패키지로 가도 좋고 둘이 가도 좋은 해외 도시·지역. 그 계절에 무엇이 볼 만한지 적는다."),
        "free": ("해외 자유여행지", "일정을 스스로 짜서 다녀오기 좋은 해외 도시. 이동이 편한지, 말이 통하는지, "
                 "혼자 또는 둘이 다니기 수월한지를 적는다."),
    }[kind]
    av = ", ".join(avoid) or "없음"
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 한국에서 출발하는 {want[0]} 네 곳을 구글 검색으로 확인해서 골라라.
{want[1]}
읽는 사람은 나이는 50~60대지만 생각과 생활은 40대다. 혼자 또는 둘이 떠나는 것을 좋아하고, 돈을 아주 아끼지도 아주 쓰지도 않는다.
[반드시] 지금 계절({d.month}월)에 가기 좋은 곳으로. 지금 가면 장마·혹서·혹한인 곳은 빼라.
[반드시] 누구나 아는 곳만 늘어놓지 말 것. 네 곳 중 둘은 덜 알려졌지만 다녀온 사람들이 좋았다고 하는 곳으로.
[금지] 효도관광·실버·어르신 같은 말. 여행사 홍보 문구를 옮기는 것. 위험하거나 외교부가 여행을 자제하라는 곳.
[반드시 빼라] 다른 칸에 이미 넣은 곳: {av}. 같은 도시·같은 지역은 한 번만 나와야 한다.
각 항목:
 title: 어디인지 한눈에 (20자 이내)
 where: 나라 · 도시 (20자 이내)
 when: 언제 가면 좋은지 ('11월~2월' 꼴, 12자 이내)
 cost: 대략 드는 돈 ('항공 포함 3박 150만 원 안팎' 꼴, 20자 이내. 모르면 빈 문자열)
 why: 왜 좋은지 한 문장 (50~80자). 구체적인 장면이 떠오르게.
 tip: 가기 전에 알아 둘 것 한 가지 (30~60자). 비자·직항 여부·주의할 것 같은 실제로 쓸모 있는 것.
형식(JSON만): {{"items":[{{"title":"...","where":"...","when":"...","cost":"...","why":"...","tip":"..."}}, ...]}}"""
    j = gemini(prompt, json_mode=True, search=True)
    return [x for x in j.get("items", []) if x.get("title") and x.get("why")][:4]


def gen_hike(d, region):
    """오늘의 산 — 한 지역에서 이번 주 걷기 좋은 산길 셋. '나를 돌보기' 결이라 몸 챙기는 요령을 함께."""
    prompt = f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 한국 '{region}' 안에서 지금 걷기 좋은 산 세 곳을 구글 검색으로 확인해서 골라라.
읽는 사람은 나이는 50~60대지만 생각과 생활은 40대다. 등산을 즐기지만 무릎과 발목을 아낀다.
[반드시] {d.month}월 지금 가기 좋은 곳. 단풍이 어디까지 내려왔는지, 길이 미끄럽지는 않은지를 헤아려라.
[반드시] 세 곳의 난이도를 다르게. 하나는 평탄하게 걷는 둘레길, 하나는 보통, 하나는 제법 오르는 길.
[반드시] 실제로 있는 산과 실제 코스 이름만. 확인되지 않으면 빼라.
[금지] 시니어·어르신·노인 같은 말. 밧줄을 타거나 바위를 기어오르는 위험한 코스.
각 항목:
 title: 산과 코스 이름 (20자 이내, 예: '북한산 둘레길 소나무숲길')
 where: 어디인지 (20자 이내, 예: '서울 강북구')
 course: 길이 ('7.5km' 꼴, 10자 이내)
 hours: 걸리는 시간 ('3시간 안팎' 꼴, 10자 이내)
 level: 난이도 ('평탄' '보통' '제법 오름' 중 하나)
 why: 이 길이 지금 왜 좋은지 한 문장 (50~80자). 눈에 보이는 장면으로.
 care: 이 길을 걸을 때 몸을 챙기는 요령 한 줄 (30~60자). 무릎·발목·숨 고르기·물·햇빛 같은 실제로 쓸모 있는 것.
형식(JSON만): {{"items":[{{"title":"...","where":"...","course":"...","hours":"...","level":"...","why":"...","care":"..."}}, ...]}}"""
    j = gemini(prompt, json_mode=True, search=True)
    return [x for x in j.get("items", []) if x.get("title") and x.get("why")][:3]
