"""여행·오늘의 산 칸마다 어울리는 사진을 한 장씩 붙인다 (운영자 2026-10-20).

- 무료 사진(Pixabay)만 쓴다 — 출처 표기 없이 쓸 수 있고 내려받아 우리 서버에 두는 방식이 규정에 맞다.
- 검색어는 Gemini 가 그 칸의 장소·결을 보고 영어로 뽑는다(한국어로는 해외 사진이 거의 안 나온다).
- **고른 뒤에 Gemini 가 사진을 직접 눈으로 보고 고른다.** 밝기·채도만 재던 때는 말레이시아 골프장 자리에
  원숭이가, 타이난 미식 자리에 소금밭이 들어왔다(2026-10-20). 무엇이 찍혔는지를 봐야 한다.
- 1600x500 띠로 잘라 trip-photos 가지에 두고, 앱은 raw.githubusercontent 로 읽는다(저장소가 무거워지지 않게).

쓰는 법: python3 tools/trip_photos.py [travel|hike|all]   (FORCE=1 이면 이미 있는 것도 다시 고른다)
"""
import os, sys, io, json, base64, hashlib, urllib.request, urllib.parse
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.environ.get('PHOTO_OUT', '/tmp/trip-out')
PIX = os.environ['PIXABAY_API_KEY']
FORCE = os.environ.get('FORCE') == '1'
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)
from models import pick

W, H = 1600, 500
WHAT = (sys.argv[1] if len(sys.argv) > 1 else 'all')


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': 'omaju.kr/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def gemini(parts, want_json=True, timeout=180):
    key = os.environ['GEMINI_API_KEY']
    for m in pick('flash')[:3]:
        try:
            body = {'contents': [{'parts': parts}]}
            if want_json:
                body['generationConfig'] = {'responseMimeType': 'application/json'}
            req = urllib.request.Request(
                f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}',
                data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.load(r)
            t = d['candidates'][0]['content']['parts'][0]['text']
            return json.loads(t) if want_json else t
        except Exception as e:
            print('   (gemini 실패', m, str(e)[:70], ')')
    return None


# ── 1단계: 검색어 ──────────────────────────────────────────────
HINT = {
    'golf': '해외 골프 여행지. 사진은 **골프장 풍경**(페어웨이·그린·바다나 산이 보이는 코스)이어야 한다.',
    'tour': '해외 관광지. 사진은 그 도시·장소를 **한눈에 알아볼 수 있는 풍경**이어야 한다.',
    'free': '해외 자유여행지. 사진은 그 도시의 **거리·골목·물가 풍경**이어야 한다.',
    'hike': '한국의 산. 사진은 **산길·능선·숲** 풍경이어야 한다.',
}


FALLBACK = {
    'golf': ['golf course fairway morning light', 'golf links coast green'],
    'tour': ['old town square golden hour', 'historic city skyline warm light'],
    'free': ['narrow street cafe morning light', 'canal old town quiet street'],
    'hike': ['mountain ridge trail autumn', 'forest path morning light'],
}


def queries(items, kind):
    lst = '\n'.join(f'{i}. {x.get("title","")} / {x.get("where","")}' for i, x in enumerate(items))
    p = f'''아래는 오마주의 목록이다. {HINT.get(kind, "")}
칸마다 **영어 사진 검색어 네 개**를 만든다(무료 사진 사이트 Pixabay 용). 앞에서부터 차례로 써 보고
쓸 만한 사진이 나오면 멈추므로, **뒤로 갈수록 넓고 흔한 말**로 간다.
- 1번 지명 중심 / 2번 그 나라·지역의 큰 범위 + 결 / 3번 지명 없이 결만 / 4번 아주 흔한 말(그 결의 풍경이면 무엇이든).
- 사람이 주인공인 사진이 걸리지 않게 people, portrait, player, swing, wedding 같은 말은 넣지 않는다.
- 골프면 네 개 모두 **코스 풍경**이 나오게 쓴다(golf course / fairway / green / links). 공·채·자세 접사가 나오는
  'golf', 'golf ball', 'golf club' 만 쓰지 않는다.
목록:
{lst}
형식(JSON만): {{"q": [["검색어1","검색어2","검색어3","검색어4"], ...]}} — 목록과 같은 순서, 같은 개수.'''
    j = gemini([{'text': p}]) or {}
    q = j.get('q') or []
    out = []
    for i, x in enumerate(items):
        got = [str(s) for s in (q[i] if i < len(q) and isinstance(q[i], list) else []) if s]
        out.append(got or [str(x.get('where', '')).split('·')[-1].strip() + ' landscape'])
    return out


# ── 2단계: 기계가 먼저 거르기 ───────────────────────────────────
def good(img):
    """밝고 결이 맞는 것만. 어두운 것·칙칙한 것뿐 아니라 **원색으로 쨍한 것**도 뺀다(잡지 톤)."""
    if img.width < 1000 or img.height < 400: return False, '작음'
    s = img.convert('RGB').resize((64, 40))
    r, g, b = ImageStat.Stat(s).mean
    bright = (r * 299 + g * 587 + b * 114) / 1000
    sat = ImageStat.Stat(s.convert('HSV')).mean[1]
    if bright < 95: return False, f'어두움 {round(bright)}'
    if bright > 225: return False, f'날아감 {round(bright)}'
    if sat < 28: return False, f'칙칙함 {round(sat)}'
    if sat > 125: return False, f'원색 {round(sat)}'
    return True, f'밝기 {round(bright)} 채도 {round(sat)}'


def search(q):
    u = 'https://pixabay.com/api/?' + urllib.parse.urlencode({
        'key': PIX, 'q': q, 'image_type': 'photo', 'orientation': 'horizontal',
        'safesearch': 'true', 'per_page': 12, 'min_width': 1200, 'order': 'popular'})
    try:
        return json.loads(get(u))['hits']
    except Exception as e:
        print('  검색 실패', q, str(e)[:70]); return []


# ── 3단계: Gemini 가 사진을 직접 보고 고르기 ────────────────────
def thumb(img, px=420):
    im = img.convert('RGB')
    im = im.resize((px, max(1, round(px * im.height / im.width))), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=62)
    return base64.b64encode(b.getvalue()).decode()


def judge(cands, item, kind):
    """후보 사진을 보여 주고 '이 칸에 어울리는 한 장'을 고르게 한다. 없으면 0."""
    head = f'''오마주(50~60대가 보는 고급 라이프스타일 매거진)의 한 칸에 **띠 사진** 한 장을 고른다.
칸: {item.get("title","")} — {item.get("where","")}
{HINT.get(kind, "")}

고르는 기준
1) **무엇이 찍혔는지가 이 칸과 맞아야 한다.** 골프 칸에 동물·건물, 미식 칸에 소금밭 같은 것은 0번(없음)이다.
   장소 이름이 정확히 그곳이 아니어도, 그 나라·그 결의 풍경이면 쓴다.
2) 잡지에 실릴 사진인가 — 따뜻한 빛, 여백, 얕은 심도. 광고 사진 같은 것, 원색이 쨍한 것, 관광 안내판·글자·로고가
   크게 박힌 것, 사람 얼굴이 크게 나온 것, 흔한 합성·일러스트는 쓰지 않는다.
3) 가로로 길게(1600x500) 잘라 쓰므로 가운데 띠만 남아도 뜻이 통해야 한다.

아래 {len(cands)}장 중 가장 맞는 것의 번호 하나. 쓸 만한 것이 하나도 없으면 0.
형식(JSON만): {{"pick": 번호, "why": "한 줄"}}'''
    parts = [{'text': head}]
    for i, (_, im, _) in enumerate(cands):
        parts.append({'text': f'{i+1}번'})
        parts.append({'inline_data': {'mime_type': 'image/jpeg', 'data': thumb(im)}})
    j = gemini(parts) or {}
    try:
        n = int(j.get('pick', 0))
    except Exception:
        n = 0
    return (n, str(j.get('why', ''))[:60]) if 1 <= n <= len(cands) else (0, str(j.get('why', ''))[:60])


def band(img, path):
    w, h = img.size
    r = max(W / w, H / h)
    img = img.resize((round(w * r), round(h * r)), Image.LANCZOS)
    w, h = img.size
    top = max(0, round((h - H) * 0.42))
    img.crop(((w - W) // 2, top, (w - W) // 2 + W, top + H)).save(path, quality=86, optimize=True)


def fetch(qs, name, item, kind):
    """검색어를 **하나씩** 써 보며 그때마다 눈으로 골라 본다. 좁은 말부터 넓은 말 순서.

    한 번에 다 모아 놓고 한 번만 보면, 첫 검색어가 엉뚱한 사진만 물어 왔을 때 그대로 빈손이 된다
    (2026-10-20 골프 세 칸). 차례로 보고 쓸 만한 것이 나오면 멈춘다.
    """
    seen, last = set(), ''
    for q in list(qs) + FALLBACK.get(kind, []):
        cands = []
        for hit in search(q):
            u = hit.get('largeImageURL')
            if not u or u in seen: continue
            seen.add(u)
            try:
                im = Image.open(io.BytesIO(get(u)))
            except Exception:
                continue
            ok, why = good(im)
            if ok: cands.append((q, im, why))
            if len(cands) >= 6: break
        if not cands: continue
        n, why = judge(cands, item, kind)
        last = why
        if n:
            q2, im, m = cands[n - 1]
            band(im, os.path.join(OUT, name))
            print(f'  ok {name} ← "{q2}" ({m}) · {why}')
            return True
    print(f'  못 구함 — {item.get("title","")} · {last}')
    return False


def run(kind, rows):
    if not rows:
        print(kind, '내용 없음'); return {}, []
    qs = queries(rows, kind)
    out, miss = {}, []
    for x, q in zip(rows, qs):
        k = f'{kind}-' + hashlib.sha1((x.get('title', '') + '|' + x.get('where', '')).encode()).hexdigest()[:10]
        name = k + '.jpg'
        have = os.path.exists(os.path.join(OUT, name)) and not FORCE
        if have or fetch(q, name, x, kind):
            out[x.get('title', '') + '|' + x.get('where', '')] = name
        else:
            miss.append(x.get('title', ''))
    return out, miss


def main():
    got, miss = {}, []
    if WHAT in ('travel', 'all'):
        d = json.load(open(os.path.join(ROOT, 'data', 'travel.json'), encoding='utf-8'))
        for tab in ('golf', 'tour', 'free'):
            print(f'[여행 {tab}]')
            a, b = run(tab, d.get(tab) or [])
            got.update(a); miss += b
    if WHAT in ('hike', 'all'):
        d = json.load(open(os.path.join(ROOT, 'data', 'hike.json'), encoding='utf-8'))
        for region, rows in (d.get('regions') or d).items():
            if not isinstance(rows, list): continue
            print(f'[산 {region}]')
            a, b = run('hike', rows)
            got.update(a); miss += b
    p = os.path.join(ROOT, 'data', 'trip_photos.json')
    old = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    old.update(got)
    json.dump(old, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('사진', len(got), '장 / 목록', len(old), '개')
    if miss: print('못 구한 칸:', ', '.join(miss))


main()
