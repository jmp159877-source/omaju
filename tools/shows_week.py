"""이번 주, 무엇을 볼까: 주 단위로 data/shows.json 에 쌓는다.
극장은 전국 공통 한 벌, 무대·전시는 지역별. 매 실행마다 아직 없는 것만 만든다
→ AI 하루 한도가 막혀도 다음 실행에서 이어서 채운다 (나들이와 같은 방식)."""
import os, sys, json, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
import gen_daily as g

KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
mon = today - datetime.timedelta(days=today.weekday())  # 이번 주 월요일을 주 이름으로
P = os.path.join(os.path.dirname(__file__), "..", "data", "shows.json")
cur = json.load(open(P, encoding="utf-8")) if os.path.exists(P) else {}
if cur.get("week") != mon.isoformat():
    cur = {"week": mon.isoformat(), "movie": [], "regions": {}}
cur.setdefault("movie", []); cur.setdefault("regions", {})


def save():
    cur["updated"] = datetime.datetime.now(KST).isoformat(timespec="minutes")
    json.dump(cur, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


save()  # 파일이 늘 있게
g.gemini.models = g.list_models()
t0 = time.time()

if not cur["movie"]:
    try:
        cur["movie"] = g.gen_movies(today); save(); print("[ok] 극장", len(cur["movie"]))
    except Exception as e:
        print("[실패] 극장", str(e)[:150], file=sys.stderr)

missing = [r for r in g.REGIONS if r not in cur["regions"]]
limit = int(os.environ.get("LIMIT", "9"))
print("이번 주", mon, "채운 지역", len(cur["regions"]), "남은 지역", len(missing))
for r in missing[:limit]:
    if time.time() - t0 > 25 * 60:
        print("시간이 다 되어 여기까지:", r); break
    try:
        got = g.gen_stage(today, r)
        if got.get("stage") or got.get("exhibit"):
            cur["regions"][r] = got; save(); print("[ok]", r, len(got.get("stage", [])), len(got.get("exhibit", [])))
        else:
            print("[빈 결과]", r)
    except Exception as e:
        print("[실패]", r, str(e)[:150], file=sys.stderr)

# ── 예고편·소개 영상 (대표 2026-10-24: "유튜브에 미리 보기나 소개 영상이 있을 거야, 링크 달아 직관적으로") ──
# 공식 채널 것만 단다(배급사·제작사·공연장·미술관). 무단 게시물 링크는 피한다(CLAUDE.md, 대법원 2017도19025).
import re, urllib.parse
from yt_scrape import scrape
OFF = re.compile(r"official|공식|엔터|entertainment|enm|film|필름|무비|movie|pictures|픽쳐스|cgv|롯데|메가박스|쇼박스|showbox|플러스엠|디즈니|disney|"
                 r"warner|워너|sony|소니|universal|유니버설|paramount|파라마운트|넷플릭스|netflix|marvel|아트센터|예술의전당|세종문화회관|미술관|박물관|museum|"
                 r"문화재단|극장|씨어터|theater|theatre|컴퍼니|company|뮤지컬|musical|오케스트라|orchestra|필하모닉|philharmonic|아트|art|갤러리|gallery|국립|시립|"
                 r"엔진|배급|studio|스튜디오|mmca|리움|leeum|interpark|인터파크|티켓|ticket|yes24|멜론티켓", re.I)
NOTOFF = re.compile(r"내가|나의|감성|참견|브이로그|vlog|dream|리뷰|산책|일상|여행자|탐방", re.I)   # '미술관' 같은 말이 들어가도 개인 채널(내가사랑한미술관)
BAD = re.compile(r"리뷰|결말|해석|리액션|reaction|줄거리|요약|몰아보기|브이로그|vlog|후기|쿠키|해설|명장면|full|풀버전|shorts|#shorts|커버|cover|패러디|직캠", re.I)
WANT = {"movie": re.compile(r"예고편|티저|trailer|teaser|하이라이트|스팟|spot", re.I),
        "stage": re.compile(r"티저|트레일러|trailer|teaser|하이라이트|highlight|스팟|spot|소개|프리뷰|preview|예고|하이라이트", re.I),
        "exhibit": re.compile(r"소개|티저|트레일러|trailer|teaser|프리뷰|preview|하이라이트|전시|투어|tour|스케치", re.I)}
def _n(t): return re.sub(r"[\s\W_]+", "", t or "").lower()
def _info(ids):
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key or not ids: return {}
    try:
        q = urllib.parse.urlencode({"part": "contentDetails,status", "id": ",".join(ids), "key": key})
        j = g.get_json(f"https://www.googleapis.com/youtube/v3/videos?{q}")
        out = {}
        for it in j.get("items", []):
            m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", it["contentDetails"]["duration"]); sec = sum(int(x or 0) * k for x, k in zip(m.groups(), (3600, 60, 1))) if m else 0
            rr = it["contentDetails"].get("regionRestriction", {})
            out[it["id"]] = {"sec": sec, "ok": it["status"].get("embeddable", True) and it["status"].get("privacyStatus") == "public" and "KR" not in rr.get("blocked", [])}
        return out
    except Exception as e:
        print("[영상] videos.list 실패", str(e)[:80], file=sys.stderr); return {}
def trailer(title, kind):
    q = {"movie": f"{title} 공식 예고편", "stage": f"{title} 공연 티저 하이라이트", "exhibit": f"{title} 전시 소개 영상"}[kind]
    try: items = scrape(q)
    except Exception as e: print("[영상] 검색 실패", title, str(e)[:60], file=sys.stderr); return None
    toks = [_n(w) for w in re.split(r"[\s:·,()\[\]《》<>'\"]+", title) if len(_n(w)) >= 2]
    def same(t):   # 제목 낱말이 모두 들어 있어야 같은 작품 (첫 글자만 보면 다른 공연이 걸렸다, 2026-10-24)
        nt = _n(t); return toks and all(w in nt for w in toks)
    c = [it for it in items if same(it["snippet"]["title"]) and OFF.search(it["snippet"]["channelTitle"]) and not NOTOFF.search(it["snippet"]["channelTitle"])   # 공식은 채널 이름으로만 본다
         and not BAD.search(it["snippet"]["title"]) and WANT[kind].search(it["snippet"]["title"])]
    inf = _info([it["id"]["videoId"] for it in c])
    hi = 360 if kind == "movie" else 720
    for it in c:
        v = it["id"]["videoId"]; f = inf.get(v)
        if inf and (not f or not f["ok"] or not (15 <= f["sec"] <= hi)): continue
        return {"videoId": v, "title": it["snippet"]["title"], "channel": it["snippet"]["channelTitle"]}
    return None
n_new = 0
for kind, lst in [("movie", cur["movie"])] + [(k, v.get(k, [])) for v in cur["regions"].values() for k in ("stage", "exhibit")]:
    for x in lst:
        if x.get("vchk") == 2: continue
        x.pop("video", None)
        if time.time() - t0 > 30 * 60: break
        v = trailer(x["title"], kind); x["vchk"] = 2
        if v: x["video"] = v; n_new += 1
        time.sleep(0.8)
print("[영상] 새로 단 것", n_new)
save()
print("저장: 극장", len(cur["movie"]), "지역", len(cur["regions"]), list(cur["regions"]))
