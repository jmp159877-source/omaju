"""이미 만들어진 하루 내용의 '그해 오늘' 소식에 사진이 빠졌으면 위키백과에서 찾아 붙인다. 사용: python tools/era_photos.py 2026-10-16"""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from gen_daily import firestore, era_photo, era_fs, era_unfs

date = sys.argv[1]; ALL = "--all" in sys.argv  # --all: 이미 붙은 사진도 다시 맞는지 찾음
ref = firestore().collection("daily").document(date)
d = ref.get().to_dict() or {}
era = era_unfs(d.get("era") or {})
y0 = int(date[:4]); added = 0
for ago, e in era.items():
    for f in e.get("facts", []):
        if ALL or len(f) < 3 or not f[2]:
            im = era_photo(f[0], "", y0 - int(ago), f[1])
            if im:
                f[:] = [f[0], f[1], im["thumb"]]; added += 1; print("사진", ago, f[0], im["thumb"][-60:])
            else:
                if ALL and len(f) > 2: f[:] = [f[0], f[1]]  # 맞는 사진을 못 찾으면 사진 없이(엉뚱한 사진보다 낫다)
                print("못 찾음", ago, f[0])
ref.set({"era": era_fs(era)}, merge=True)
p = f"daily/{date}.json"; full = ref.get().to_dict()
if isinstance(full.get("era"), dict): era_unfs(full["era"])
json.dump(full, open(p, "w"), ensure_ascii=False, indent=1, default=str)
print("붙인 사진", added)
