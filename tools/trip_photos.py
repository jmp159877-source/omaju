"""여행·오늘의 산 칸마다 어울리는 사진을 한 장씩 붙인다 (운영자 2026-10-20).

- 무료 사진(Pixabay)만 쓴다 — 출처 표기 없이 쓸 수 있고 내려받아 우리 서버에 두는 방식이 규정에 맞다.
- 검색어는 Gemini 가 그 칸의 장소·결을 보고 영어로 두세 개 뽑는다(한국어로는 해외 사진이 거의 안 나온다).
- 받은 사진은 **한 장씩 밝기·채도를 재서** 칙칙한 것, 광고 같은 것, 사람 얼굴이 크게 나온 것을 거른다(CLAUDE.md).
- 1600x500 띠로 잘라 trip-photos 가지에 두고, 앱은 raw.githubusercontent 로 읽는다(저장소가 무거워지지 않게).

쓰는 법: python3 tools/trip_photos.py [travel|hike|all]
"""
import os, sys, io, json, hashlib, urllib.request, urllib.parse
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.environ.get('PHOTO_OUT', '/tmp/trip-out')
PIX = os.environ['PIXABAY_API_KEY']
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)
from models import pick

W, H = 1600, 500
WHAT = (sys.argv[1] if len(sys.argv) > 1 else 'all')


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': 'omaju.kr/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def gemini_json(prompt):
    key = os.environ['GEMINI_API_KEY']
    for m in pick('flash')[:3]:
        try:
            body = {'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {'responseMimeType': 'application/json'}}
            req = urllib.request.Request(
                f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}',
                data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            return json.loads(d['candidates'][0]['content']['parts'][0]['text'])
        except Exception as e:
            print('  검색어 실패', m, str(e)[:80])
    return None


def queries(items, kind):
    """칸마다 영어 검색어 두세 개. 장소가 분명하면 장소 이름을, 아니면 풍경 결을 쓴다."""
    lst = '\n'.join(f'{i}. {x.get("title","")} / {x.get("where","")}' for i, x in enumerate(items))
    what = '해외 여행지' if kind == 'travel' else '한국의 산'
    p = f'''아래는 오마주의 {what} 목록이다. 칸마다 **영어 사진 검색어**를 두 개씩 만든다.
- 무료 사진 사이트(Pixabay)에서 그 장소의 **풍경 사진**이 잘 나오게. 지명은 영어 표기로.
- 사람이 주인공인 사진이 걸리지 않게 'people', 'portrait' 같은 말은 넣지 않는다.
- 첫 번째는 지명 중심(예: "Tuscany vineyard autumn"), 두 번째는 풍경 결 중심(예: "rolling hills cypress golden light").
목록:
{lst}
형식(JSON만): {{"q": [["검색어1","검색어2"], ...]}}  — 목록과 같은 순서, 같은 개수.'''
    j = gemini_json(p) or {}
    q = j.get('q') or []
    out = []
    for i, x in enumerate(items):
        got = q[i] if i < len(q) and isinstance(q[i], list) else []
        got = [str(s) for s in got if s] or [str(x.get('where', '')).split('·')[-1].strip() + ' landscape']
        out.append(got)
    return out


def good(img):
    """따뜻하고 밝은 풍경만. 칙칙하거나 거의 흑백인 것, 너무 좁은 것은 뺀다."""
    if img.width < 1000 or img.height < 400: return False, 'too small'
    s = img.convert('RGB').resize((64, 40))
    r, g, b = ImageStat.Stat(s).mean
    bright = (r * 299 + g * 587 + b * 114) / 1000
    sat = ImageStat.Stat(s.convert('HSV')).mean[1]
    if bright < 95: return False, f'어두움 {round(bright)}'
    if sat < 28: return False, f'칙칙함 {round(sat)}'
    return True, f'밝기 {round(bright)} 채도 {round(sat)}'


def search(q):
    u = 'https://pixabay.com/api/?' + urllib.parse.urlencode({
        'key': PIX, 'q': q, 'image_type': 'photo', 'orientation': 'horizontal',
        'safesearch': 'true', 'per_page': 12, 'min_width': 1200, 'order': 'popular'})
    try:
        return json.loads(get(u))['hits']
    except Exception as e:
        print('  검색 실패', q, str(e)[:80]); return []


def band(img, path):
    w, h = img.size
    r = max(W / w, H / h)
    img = img.resize((round(w * r), round(h * r)), Image.LANCZOS)
    w, h = img.size
    top = max(0, round((h - H) * 0.42))
    img.crop(((w - W) // 2, top, (w - W) // 2 + W, top + H)).save(path, quality=86, optimize=True)


def fetch(qs, name):
    for q in qs:
        for hit in search(q):
            try:
                im = Image.open(io.BytesIO(get(hit['largeImageURL'])))
            except Exception:
                continue
            ok, why = good(im)
            if not ok:
                continue
            band(im, os.path.join(OUT, name))
            print(f'  ok {name} ← "{q}" ({why})')
            return True
    print('  못 찾음', name, qs)
    return False


def run(kind, path, rows):
    items = rows
    if not items:
        print(kind, '내용 없음'); return {}
    qs = queries(items, kind)
    out = {}
    for x, q in zip(items, qs):
        key = f'{kind}-' + hashlib.sha1((x.get('title', '') + '|' + x.get('where', '')).encode()).hexdigest()[:10]
        name = key + '.jpg'
        if os.path.exists(os.path.join(OUT, name)) or fetch(q, name):
            out[x.get('title', '') + '|' + x.get('where', '')] = name
    return out


def main():
    got = {}
    if WHAT in ('travel', 'all'):
        d = json.load(open(os.path.join(ROOT, 'data', 'travel.json'), encoding='utf-8'))
        for tab in ('golf', 'tour', 'free'):
            print(f'[여행 {tab}]')
            got.update(run('travel', None, d.get(tab) or []))
    if WHAT in ('hike', 'all'):
        d = json.load(open(os.path.join(ROOT, 'data', 'hike.json'), encoding='utf-8'))
        for region, rows in d.items():
            if not isinstance(rows, list): continue
            print(f'[산 {region}]')
            got.update(run('hike', None, rows))
    p = os.path.join(ROOT, 'data', 'trip_photos.json')
    old = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    old.update(got)
    json.dump(old, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('사진', len(got), '장 / 목록', len(old), '개')


main()
