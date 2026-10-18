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
save()
print("저장: 극장", len(cur["movie"]), "지역", len(cur["regions"]), list(cur["regions"]))
