"""유튜브 영상 후보 보기 (검색 결과 + 길이·채널) — 노래 하나의 공식 음원을 손으로 고를 때. 결과는 daily/yt_find.md"""
import os, sys, json, re, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from yt_scrape import scrape
KEY = os.environ.get("YOUTUBE_API_KEY", "")
qs = [q.strip() for q in sys.argv[1].split(';') if q.strip()]
out = []
for q in qs:
    items = scrape(q); ids = [i["id"]["videoId"] for i in items]
    info = {}
    if KEY and ids:
        p = urllib.parse.urlencode({"part": "contentDetails,snippet,status", "id": ",".join(ids), "key": KEY})
        with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/videos?{p}", timeout=40) as r:
            for it in json.load(r).get("items", []):
                m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", it["contentDetails"]["duration"]); s = sum(int(x or 0) * k for x, k in zip(m.groups(), (3600, 60, 1)))
                info[it["id"]] = (s, it["status"].get("embeddable"), it["snippet"]["description"][:120].replace("\n", " "))
    out.append(f"## {q}")
    for it in items:
        v = it["id"]["videoId"]; s, e, d = info.get(v, (0, None, ""))
        out.append(f"- `{v}` {s // 60}:{s % 60:02d} 퍼가기={e} | {it['snippet']['channelTitle']} | {it['snippet']['title'][:70]} | {d}")
os.makedirs("daily", exist_ok=True); open("daily/yt_find.md", "w", encoding="utf-8").write("\n".join(out)); print("\n".join(out))
