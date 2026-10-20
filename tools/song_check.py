"""노래 영상이 제대로 걸렸는지 잰다 — 길이·채널·제목을 받아 수상한 것을 추려 daily/song_check.md 로."""
import os, json, re, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ["YOUTUBE_API_KEY"]
d = json.load(open(os.path.join(HERE, "..", "data", "song_videos.json"), encoding="utf-8"))
ids = [(k, v["v"]) for k, v in d.items() if v and v.get("v")]

def dur_secs(s):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    if not m: return 0
    h, mi, se = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + se

info = {}
for i in range(0, len(ids), 50):
    chunk = ids[i:i + 50]
    p = urllib.parse.urlencode({"part": "contentDetails,snippet,status", "id": ",".join(v for _, v in chunk), "key": KEY})
    with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/videos?{p}", timeout=40) as r:
        for it in json.load(r).get("items", []):
            info[it["id"]] = {"sec": dur_secs(it["contentDetails"]["duration"]),
                              "title": it["snippet"]["title"], "ch": it["snippet"]["channelTitle"],
                              "embed": it["status"].get("embeddable", True)}

BAD = re.compile(r"교실|강좌|레슨|배우기|커버|cover|노래방|karaoke|반주|\bmr\b|메들리|모음|모음\.zip|playlist|플레이리스트|리액션|라디오스타|방송분|두뇌|작업용|모음집", re.I)
rows, bad = [], []
for k, v in ids:
    n = info.get(v)
    if not n:
        bad.append((k, "영상이 사라짐", "", 0)); continue
    why = []
    if not n["embed"]: why.append("우리 화면에서 못 틂")
    if n["sec"] > 600: why.append(f"너무 긺 {n['sec']//60}분")
    if n["sec"] < 80: why.append(f"너무 짧음 {n['sec']}초")
    if BAD.search(n["title"] + " " + n["ch"]): why.append("강좌·모음·방송 같은 것")
    rows.append((k, n, why))
    if why: bad.append((k, " / ".join(why), n["title"], n["sec"]))

out = [f"# 노래 영상 점검 — {len(ids)}곡 가운데 손볼 것 {len(bad)}곡\n"]
for k, why, t, s in bad:
    out.append(f"- **{k.split('|')[0]}** — {why}\n  - `{t[:80]}` ({s//60}:{s%60:02d})")
out.append("\n## 길이 분포")
import collections
c = collections.Counter("10분+" if n["sec"] > 600 else "7~10분" if n["sec"] > 420 else "3~7분" if n["sec"] > 180 else "80초~3분" if n["sec"] >= 80 else "80초 미만" for _, n, _ in rows)
for kk, vv in c.most_common(): out.append(f"- {kk}: {vv}곡")
os.makedirs(os.path.join(HERE, "..", "daily"), exist_ok=True)
open(os.path.join(HERE, "..", "daily", "song_check.md"), "w", encoding="utf-8").write("\n".join(out))
print("\n".join(out[:60]))
