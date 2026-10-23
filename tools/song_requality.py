"""그 시절 노래 — 영상 품질 다시 고르기 (대표 2026-10-23)
"중간에 노래가 매끄럽게 안 끝나고 다른 장면이 섞인다. 곡을 늘리기보다 영상 품질에 신경 써라."

고르는 차례
  ① 음반 원곡(유튜브 '- Topic' 채널, 'Provided to YouTube by …') — 처음부터 노래, 끝까지 노래, 다른 장면 없음
  ② 가수·음반사 공식 뮤직비디오 — 원곡보다 40초 넘게 길면 앞뒤에 딴 것이 붙은 것이라 뺀다
  ③ 방송사 공식 무대 한 곡 — 사회자 멘트·하이라이트·뉴스 꼭지가 아닌 것
  · 7분 30초를 넘는 영상은 뺀다 — 유튜브는 8분 넘는 영상에만 중간 광고를 넣는다
  · 공식이 아닌 영상은 새로 고르지 않는다(대법원 2017도19025). 지금 것이 비공식이고 공식이 없으면 그대로 둔다.
검색은 결과 페이지에서 읽어(한도 없음), 길이·채널·설명은 videos.list 로(50개에 1단위) 받는다.
결과: data/song_videos.new.json + daily/song_requality.md (바뀐 것 · 그대로 둔 것 · 걱정되는 것) → 클국장이 보고 main 에 반영
"""
import os, sys, json, re, time, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from yt_scrape import scrape
KEY = os.environ["YOUTUBE_API_KEY"]
SRC = os.path.join(HERE, "..", "data", "song_videos.json")
cur = json.load(open(SRC, encoding="utf-8"))
songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8"))

def norm(s): return re.sub(r"[\s\W_]+", "", s or "").lower()
def secs(s):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    return sum(int(x or 0) * k for x, k in zip(m.groups(), (3600, 60, 1))) if m else 0

INFO = {}
def info(ids):
    need = [i for i in dict.fromkeys(ids) if i not in INFO]
    for i in range(0, len(need), 50):
        p = urllib.parse.urlencode({"part": "contentDetails,snippet,status", "id": ",".join(need[i:i + 50]), "key": KEY})
        try:
            with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/videos?{p}", timeout=40) as r:
                for it in json.load(r).get("items", []):
                    rr = it["contentDetails"].get("regionRestriction", {})
                    INFO[it["id"]] = {"sec": secs(it["contentDetails"]["duration"]), "title": it["snippet"]["title"],
                                      "ch": it["snippet"]["channelTitle"], "desc": it["snippet"].get("description", "")[:300],
                                      "ok": it["status"].get("embeddable", True) and it["status"].get("privacyStatus") == "public"
                                            and "KR" not in rr.get("blocked", []) and ("allowed" not in rr or "KR" in rr["allowed"])}
        except Exception as e: print("videos.list 실패", e)
    return [INFO.get(i) for i in ids]

OFF = re.compile(r"official|공식|vevo|- topic|\bkbs|mbc|sbs|\bebs|mnet|1thek|원더케이|stone music|smtown|jyp|\byg\b|hybe|rhino|records|entertainment|크레디아|arte|뮤직앤뉴|music&new|riak|warner|sony|universal|decca|deutsche grammophon|emi", re.I)
BCAST = re.compile(r"\bkbs|mbc|sbs|\bebs|mnet|jtbc|tvn", re.I)
# 다른 장면이 섞이거나 앞뒤에 딴 것이 붙는 영상
MIX = re.compile(r"뉴스|tv ?앨범|하이라이트|highlight|모음|메들리|medley|playlist|플레이리스트|무대모음|교차편집|토크|인터뷰|비하인드|behind|teaser|티저|"
                 r"리액션|reaction|직캠|fancam|커버|cover|노래방|karaoke|반주|\bmr\b|\binst|lesson|강좌|교실|배우기|예능|방송분|라디오스타|인간극장|퀴즈|"
                 r"레전드|legend|full ?ep|ep\.\d|episode|\d+회|스페셜|special|드라마 ?ver|명장면|shorts|#shorts|\d+시간|1 ?hour|작업용|두뇌|실버|시니어", re.I)
MAXS, MINS = 450, 80

def topic(n): return n["ch"].endswith("- Topic") or n["desc"].startswith("Provided to YouTube")
def kind(n, a):
    if topic(n): return "원곡"
    if OFF.search(n["ch"]) or (norm(a) and (norm(a) in norm(n["ch"]) or norm(n["ch"]) in norm(a))):
        return "방송" if BCAST.search(n["ch"]) else "공식"
    return "비공식"
RANK = {"원곡": 3, "공식": 2, "방송": 1, "비공식": 0}

def hit(n, t):
    tt = norm(t); return tt and (tt in norm(n["title"]) or (topic(n) and tt[:6] in norm(n["title"])))

def good(n, t, a, ref=None):
    """이 영상을 써도 되는가 — (괜찮음, 까닭)"""
    if not n: return False, "영상이 사라짐"
    if not n["ok"]: return False, "우리 화면에서 못 틂"
    if n["sec"] > MAXS: return False, f"{n['sec']//60}분 {n['sec']%60}초 — 중간 광고가 붙을 수 있음"
    if n["sec"] < MINS: return False, f"{n['sec']}초 — 한 곡이 다 안 됨"
    if not topic(n) and MIX.search(n["title"]): return False, "방송 꼭지·모음·커버 같은 것"
    if ref and not topic(n) and n["sec"] > ref + 40: return False, f"원곡보다 {n['sec']-ref}초 김 — 앞뒤에 딴 것이 붙음"
    return True, ""

pairs = []
for y, l in songs.items():
    if y.startswith("_"): continue
    for t, a in l: pairs.append((t, a))
pairs = list(dict.fromkeys(pairs))
only = next((x.split("=", 1)[1] for x in sys.argv if x.startswith("--only=")), None)
if only: pairs = [p for p in pairs if only in p[0]]
print("살펴볼 곡", len(pairs))
info([v["v"] for v in cur.values() if v and v.get("v")])

new, rep = dict(cur), {"바꿈": [], "그대로": [], "걱정": []}
for t, a in pairs:
    k = f"{t}|{a}"; old = cur.get(k) or {}
    cands = []
    for q in (f"{a} {t}", f"{t} {a} topic", f"{a} {t} 공식"):
        try: cands += [c["id"]["videoId"] for c in scrape(q)]
        except Exception as e: print("검색 실패", q, e)
        time.sleep(0.6)
    cands = list(dict.fromkeys(cands))[:18]
    ns = dict(zip(cands, info(cands)))
    ref = next((n["sec"] for n in ns.values() if n and topic(n) and hit(n, t)), None)
    ok = []
    for vid, n in ns.items():
        if not n or not hit(n, t): continue
        if a and not (norm(a)[:4] in norm(n["title"] + n["ch"] + n["desc"])): continue
        g, _ = good(n, t, a, ref)
        if g and kind(n, a) != "비공식": ok.append((RANK[kind(n, a)], -abs(n["sec"] - (ref or n["sec"])), vid, n))
    ok.sort(reverse=True)
    on = INFO.get(old.get("v")) if old else None
    og, why = good(on, t, a, ref) if on else (False, "영상 없음")
    ok_rank = RANK[kind(on, a)] if on else -1
    best = ok[0] if ok else None
    if best and (not og or best[0] > ok_rank):
        vid, n = best[2], best[3]
        new[k] = {"v": vid, "t": n["title"], "c": n["ch"]}
        rep["바꿈"].append(f"- **{t}** · {a} — {kind(n, a)} `{n['title'][:60]}` ({n['sec']//60}:{n['sec']%60:02d}, {n['ch']})\n"
                          f"  - 전: {('`'+on['title'][:60]+'` ('+kind(on,a)+(', '+why if why else '')+')') if on else '없음'}")
    elif og:
        rep["그대로"].append(f"- {t} · {a} — {kind(on, a)} ({on['sec']//60}:{on['sec']%60:02d})")
    else:
        rep["걱정"].append(f"- **{t}** · {a} — {why}; 나은 공식 영상 못 찾음" + (f" `{on['title'][:60]}`" if on else ""))
    print(t, "→", "바꿈" if new.get(k) != cur.get(k) else ("그대로" if og else "걱정"))

json.dump(new, open(os.path.join(HERE, "..", "data", "song_videos.new.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
out = [f"# 노래 영상 다시 고르기 — {len(pairs)}곡: 바꿈 {len(rep['바꿈'])} · 그대로 {len(rep['그대로'])} · 걱정 {len(rep['걱정'])}\n"]
for h in ("걱정", "바꿈", "그대로"):
    out.append(f"\n## {h} ({len(rep[h])})"); out += rep[h]
os.makedirs(os.path.join(HERE, "..", "daily"), exist_ok=True)
open(os.path.join(HERE, "..", "daily", "song_requality.md"), "w", encoding="utf-8").write("\n".join(out))
print(out[0])
