"""오늘의 산: 주 단위로 지역별로 data/hike.json 에 쌓는다.
매 실행마다 아직 없는 지역만 만든다 → AI 하루 한도가 막혀도 다음 실행에서 이어서 채운다
(나들이·볼거리와 같은 방식)."""
import os, sys, json, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
import gen_daily as g

KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
if today.weekday() == 6:   # 일요일 밤에 돌면 다음 주치를 미리 만든다 — 월요일 아침에 새 주가 펼쳐져 있게 (대표 2026-10-24)
    today += datetime.timedelta(days=1)
mon = today - datetime.timedelta(days=today.weekday())   # 이번 주 월요일을 주 이름으로
P = os.path.join(os.path.dirname(__file__), "..", "data", "hike.json")

cur = json.load(open(P, encoding="utf-8")) if os.path.exists(P) else {}
if cur.get("week") != mon.isoformat():
    cur = {"week": mon.isoformat(), "regions": {}}
cur.setdefault("regions", {})


def save():
    cur["updated"] = datetime.datetime.now(KST).isoformat(timespec="minutes")
    json.dump(cur, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


save()            # 파일이 늘 있게
g.gemini.models = g.list_models()
t0 = time.time()

missing = [r for r in g.REGIONS if r not in cur["regions"]]
limit = int(os.environ.get("LIMIT", "9"))
print("이번 주", mon, "채운 지역", len(cur["regions"]), "남은 지역", len(missing))
for r in missing[:limit]:
    if time.time() - t0 > 25 * 60:
        print("시간이 다 되어 여기까지:", r); break
    try:
        got = g.gen_hike(today, r)
        if got:
            cur["regions"][r] = got; save(); print("[ok]", r, len(got))
        else:
            print("[빈 결과]", r)
    except Exception as e:
        print("[실패]", r, str(e)[:150], file=sys.stderr)
    time.sleep(3)
save()
print("저장: 지역", len(cur["regions"]), list(cur["regions"]))
