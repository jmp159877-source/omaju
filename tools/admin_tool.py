#!/usr/bin/env python3
"""관리자 계정 살펴보기·세우기.

  python3 tools/admin_tool.py list            — 관리자인 회원과 전체 회원 목록(아이디·별명)
  python3 tools/admin_tool.py grant <아이디>   — 그 아이디를 관리자로
  python3 tools/admin_tool.py drop  <아이디>   — 관리자에서 내리기

깃허브 액션에서 돌린다(사막 안에서는 파이어스토어에 닿지 못한다).
"""
import os, sys, json


def note(s):
    print("::notice::" + s)


def main():
    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    db = fs.Client(project=info["project_id"],
                   credentials=service_account.Credentials.from_service_account_info(info))

    cmd = (sys.argv[1] if len(sys.argv) > 1 else "list").strip()
    who = (sys.argv[2] if len(sys.argv) > 2 else "").strip().lower()

    if cmd == "list":
        rows = []
        for d in db.collection("users").stream():
            u = d.to_dict() or {}
            rows.append((u.get("username") or "(아이디 없음)", u.get("nick") or "", u.get("role") or "member",
                         u.get("via") or "아이디", d.id))
        admins = [r for r in rows if r[2] == "admin"]
        note(f"회원 {len(rows)}명 / 관리자 {len(admins)}명")
        for r in admins:
            note(f"관리자 — 아이디 {r[0]} · 별명 {r[1]} · 들어온 길 {r[3]}")
        for r in sorted(rows, key=lambda x: x[0]):
            note(f"회원 — 아이디 {r[0]} · 별명 {r[1]} · 권한 {r[2]} · 들어온 길 {r[3]}")
        return

    if cmd not in ("grant", "drop") or not who:
        note("쓰는 법: list | grant <아이디> | drop <아이디>")
        return

    hits = list(db.collection("users").where("username", "==", who).stream())
    if not hits:
        note(f"'{who}' 라는 아이디의 회원이 없습니다. list 로 먼저 확인하세요.")
        return
    for d in hits:
        db.collection("users").document(d.id).update({"role": "admin" if cmd == "grant" else "member"})
        note(f"{who} → {'관리자로 세웠습니다' if cmd == 'grant' else '일반 회원으로 내렸습니다'}")


if __name__ == "__main__":
    main()
