"""창간 독자 번호를 자동으로 매긴다 (운영자 2026-10-23).
- 대표가 손으로 넣은 번호는 그대로 둔다.
- 번호가 없는 창간 독자(창간 ~ 2026-11-22 18:00 KST 사이 구독, 관리자·'빼기' 한 사람 제외)에게
  구독한 순서대로 **1206번부터**(대표 2026-10-26 19:47 — 그전엔 125번부터)(이미 그보다 큰 번호가 있으면 그다음부터) 이어서 매긴다.
- 시세·이슈 작업 끝에 붙어 하루 여러 번 돈다. 관리자 '구독자' 탭의 '빈 칸 채우기'도 같은 규칙.
"""
import os, json, datetime as D
from google.cloud import firestore as fs
from google.oauth2 import service_account

START = 1206
END = D.datetime(2026, 11, 22, 9, 0, tzinfo=D.timezone.utc)   # 2026-11-22 18:00 KST

info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
db = fs.Client(project=info["project_id"], credentials=service_account.Credentials.from_service_account_info(info))
users = [(d.id, d.to_dict()) for d in db.collection("users").stream()]
n = max([START - 1] + [u.get("founderNo") or 0 for _, u in users])
todo = sorted([(u["createdAt"], uid, u.get("nick", "")) for uid, u in users
               if u.get("role") != "admin" and not u.get("noFounder") and not u.get("founderNo")
               and u.get("createdAt") and u["createdAt"] < END], key=lambda x: x[0])
for _, uid, nick in todo:
    n += 1
    db.collection("users").document(uid).update({"founderNo": n})
    print(f"창간 번호 {n:05d} → {nick}")
print(f"새로 매김 {len(todo)}명, 마지막 번호 {n}")
