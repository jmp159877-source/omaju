"""여행(해외 골프 · 관광 · 자유여행): 주 단위로 data/travel.json 에 쌓는다.
매 실행마다 아직 없는 칸만 만든다 → AI 하루 한도가 막혀도 다음 실행에서 이어서 채운다
(나들이·볼거리와 같은 방식)."""
import os, sys, json, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
import gen_daily as g

KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
mon = today - datetime.timedelta(days=today.weekday())   # 이번 주 월요일을 주 이름으로
P = os.path.join(os.path.dirname(__file__), "..", "data", "travel.json")
KINDS = ["golf", "tour", "free"]
KO = {"golf": "해외 골프", "tour": "해외 관광", "free": "자유여행"}

cur = json.load(open(P, encoding="utf-8")) if os.path.exists(P) else {}
if cur.get("week") != mon.isoformat():
    cur = {"week": mon.isoformat()}
for k in KINDS:
    cur.setdefault(k, [])


def save():
    cur["updated"] = datetime.datetime.now(KST).isoformat(timespec="minutes")
    json.dump(cur, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


save()            # 파일이 늘 있게
g.gemini.models = g.list_models()

print("이번 주", mon, "채운 칸", [k for k in KINDS if cur[k]])
for k in KINDS:
    if cur[k]:
        continue
    avoid = [f"{x.get('where','')} {x.get('title','')}".strip()
             for j in KINDS if j != k for x in cur[j]]
    try:
        got = g.gen_travel(today, k, avoid)
        if got:
            cur[k] = got; save(); print("[ok]", KO[k], len(got))
        else:
            print("[빈 결과]", KO[k])
    except Exception as e:
        print("[실패]", KO[k], str(e)[:150], file=sys.stderr)
    time.sleep(5)
save()
print("저장:", {k: len(cur[k]) for k in KINDS})
