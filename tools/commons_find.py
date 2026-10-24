"""위키미디어 공용(Commons)에서 자유 이용 사진 후보를 받아 온다 — 전기차 시대 연재용 (2026-10-24).
쓸 수 있는 라이선스(CC0·퍼블릭 도메인·CC BY·CC BY-SA)만 받고, 지은이·라이선스·원본 주소를 meta.json 에 남긴다.
사용: python tools/commons_find.py "검색어1;검색어2" [장수=6]  → /tmp/commons/<검색어>-<n>.jpg"""
import json, os, re, sys, urllib.parse, urllib.request
OK = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", re.I)
UA = {"User-Agent": "omaju-magazine/1.0 (https://omaju.kr; jmp159877@gmail.com)"}
out = "/tmp/commons"; os.makedirs(out, exist_ok=True)
qs = [q.strip() for q in sys.argv[1].split(";") if q.strip()]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 6
meta = []
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
for q in qs:
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": q + " filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 40,
         "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 2000, "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription|DateTimeOriginal"}
    j = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))
    pages = sorted((j.get("query") or {}).get("pages", {}).values(), key=lambda x: x.get("index", 99))
    got = 0
    for pg in pages:
        ii = (pg.get("imageinfo") or [{}])[0]; em = ii.get("extmetadata", {})
        lic = (em.get("LicenseShortName") or {}).get("value", "")
        if not OK.match(lic) or ii.get("width", 0) < 1400 or ii.get("width", 0) < ii.get("height", 1): continue
        slug = re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")
        fn = f"{slug}-{got + 1}.jpg"
        try:
            open(f"{out}/{fn}", "wb").write(get(ii.get("thumburl") or ii["url"]))
        except Exception as e:
            print("받기 실패", pg["title"], e); continue
        artist = re.sub(r"<[^>]+>", "", (em.get("Artist") or {}).get("value", "")).strip()
        meta.append({"file": fn, "q": q, "title": pg["title"], "license": lic, "artist": artist, "page": ii.get("descriptionurl"),
                     "size": [ii.get("width"), ii.get("height")], "date": (em.get("DateTimeOriginal") or {}).get("value", "")[:10]})
        print("받음", fn, pg["title"], lic, artist[:40]); got += 1
        if got >= n: break
json.dump(meta, open(f"{out}/meta.json", "w"), ensure_ascii=False, indent=1)
