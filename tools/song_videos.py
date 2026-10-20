# 노래마다 유튜브 영상 하나를 골라 data/song_videos.json 에 저장 (한 번 고르면 계속 씀)
# 유튜브 무료 한도(하루 검색 약 100번) 안에서, 아직 안 고른 노래만 한 번에 최대 90곡.
import os, sys, json, re, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "song_videos.json")
KEY = os.environ["YOUTUBE_API_KEY"]

def search(q):
    p = urllib.parse.urlencode({"part": "snippet", "q": q, "type": "video", "videoEmbeddable": "true", "regionCode": "KR", "relevanceLanguage": "ko", "maxResults": 6, "key": KEY})
    with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/search?{p}", timeout=30) as r:
        return json.load(r).get("items", [])

sys.path.insert(0, HERE)
from yt_scrape import scrape

def norm(s): return re.sub(r"[\s\W_]+", "", s or "").lower()

# 클래식·외국 곡은 영어 제목으로 올라온 영상이 많다 → 다른 이름도 같이 맞춰 본다
ALIAS = {"쇼팽": "chopin", "생상스": "saint-saens", "베토벤": "beethoven", "모차르트": "mozart", "드뷔시": "debussy", "슈베르트": "schubert",
         "차이콥스키": "tchaikovsky", "비발디": "vivaldi", "바흐": "bach", "엘가": "elgar", "마스네": "massenet", "리스트": "liszt", "브람스": "brahms",
         "녹턴": "nocturne", "백조": "the swan", "월광": "moonlight", "사계": "four seasons", "타이스의 명상곡": "meditation thais", "사랑의 인사": "salut d'amour"}
def en(x):
    for k, v in ALIAS.items(): x = x.replace(k, v)
    return x.replace("2번", "no. 2").replace("번", "")

_len = {}
def length(vid):
    """영상 길이(초). 못 받아 오면 None — 그때는 길이로 거르지 않는다."""
    if vid in _len: return _len[vid]
    try:
        p = urllib.parse.urlencode({"part": "contentDetails", "id": vid, "key": KEY})
        with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/videos?{p}", timeout=30) as r:
            it = json.load(r)["items"][0]["contentDetails"]["duration"]
        m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", it)
        h, mi, se = (int(x) if x else 0 for x in m.groups())
        _len[vid] = h * 3600 + mi * 60 + se
    except Exception:
        _len[vid] = None
    return _len[vid]


songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8"))
have = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
# --redo=제목|가수,제목|가수 … 로 특정 곡만 다시 고른다 (잘못 걸린 것 손보기)
for arg in sys.argv[1:]:
    if arg.startswith("--redo="):
        for k in arg.split("=", 1)[1].split(","):
            have.pop(k.strip(), None)

import datetime
Y = datetime.date.today().year
now_years = {str(Y - n) for n in (50, 40, 30, 20)}
def prio(k):  # 올해 화면에 나오는 해(가요·팝송) → 장르 → 내년 것
    yr = k.split(":")[-1]
    return 0 if yr in now_years else 1 if k.startswith("genre:") else 2
todo, seen = [], set()
for y in sorted([k for k in songs if not k.startswith("_")], key=prio):
    for t, a in songs[y]:
        if not have.get(f"{t}|{a}") and (t, a) not in seen: seen.add((t, a)); todo.append((t, a))
print("남은 노래", len(todo))
# 강좌·모음집·예능·하이라이트가 걸리던 것을 막는다 (운영자 2026-10-20: 기타교실·78분 무대모음·55분 예능이 걸려 있었다)
bad = re.compile(r"커버|cover|노래방|karaoke|반주|\bmr\b|\binst\b|lesson|강좌|교실|리액션|reaction|shorts|배우기|실버|시니어|어르신|노인|메들리|모음|모음집|playlist|플레이리스트|작업용|하이라이트|highlight|라디오스타|인간극장|퀴즈쇼|예능|방송분|두뇌|전막|complete ballet|1 ?hour|\d+시간", re.I)
def score(it):
    sn = it["snippet"]; ti = sn["title"].lower(); s = 0
    if norm(t) in norm(ti) or norm(en(t)) in norm(ti): s += 3
    if any(norm(x) in norm(ti) or norm(x) in norm(sn["channelTitle"]) for x in (a, en(a))): s += 3
    if bad.search(ti): s -= 5
    if "official" in sn["channelTitle"].lower() or "공식" in sn["channelTitle"] or "kbs" in sn["channelTitle"].lower() or "mbc" in sn["channelTitle"].lower(): s += 1
    return s

api_ok = True
for t, a in todo[:400]:
    items = None
    if api_ok:
        try:
            items = search(f"{a} {t}")
        except Exception as e:
            print("유튜브 한도 바닥 → 검색 페이지로 계속:", str(e)[:80]); api_ok = False
    if items is None:
        try:
            items = scrape(f"{a} {t}")
        except Exception as e:
            print("검색 실패", t, e); continue
    # 안 맞으면 영어 이름·공식 영상으로 한 번 더
    for q2 in ([f"{en(a)} {en(t)}"] if en(a + t) != a + t else []) + [f"{a} {t} 공식 뮤직비디오", f"{t} {a} live"]:
        if items and max(map(lambda it: score(it), items)) >= 3: break
        try: items = (items or []) + scrape(q2)
        except Exception: pass
    items.sort(key=score, reverse=True)
    # 길이가 맞는 것으로 — 노래 한 곡은 80초~10분이다. 모음집·전막·예능은 여기서 걸러진다.
    got = None
    # 제목이 맞는 것만 — 가수만 맞고 다른 노래가 걸리던 것을 막는다
    # (2026-10-20: '이젠 나만의 길' 자리에 '아름다운 아픔'이 들어와 있었다)
    def title_hit(it):
        ti = it["snippet"]["title"].lower()
        return norm(t) in norm(ti) or norm(en(t)) in norm(ti)
    items = [x for x in items if title_hit(x)] or items
    for it in items[:6]:
        if score(it) < 3 or not title_hit(it): break
        sec = length(it["id"]["videoId"])
        if sec is None or 80 <= sec <= 600: got = it; break
        print("  길이로 거름", it["snippet"]["title"][:40], f"{sec // 60}분")
    if got:
        have[f"{t}|{a}"] = {"v": got["id"]["videoId"], "t": got["snippet"]["title"], "c": got["snippet"]["channelTitle"]}
        print("ok", t, "-", a, "→", got["snippet"]["title"][:50])
    else:
        have[f"{t}|{a}"] = None; print("못 찾음", t, a)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(have, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("저장", len([v for v in have.values() if v]), "곡")
