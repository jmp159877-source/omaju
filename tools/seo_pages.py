# 검색에 걸리는 글마다 따로 된 쪽 (대표 2026-10-24: "쌓이는 글이 네이버·구글에서 검색되게")
#  사이트는 한 쪽 안에서 글을 불러와 보여 주므로 검색 로봇 눈에는 첫 화면 하나뿐이다.
#  그래서 새벽에 글을 만들 때 글마다 가벼운 쪽을 하나씩 떠 두고(pet/<id>.html · meal/<날짜>.html), sitemap.xml 에 모두 올린다.
#  쪽 안에는 제목·본문이 그대로 들어 있고, 위아래에 '오늘 호 펼쳐 보기' — 검색으로 온 사람을 오마주 매거진으로 데려온다.
#  오늘(한국 시각)까지의 글만 만든다(미리 만든 내일치는 그날 새벽에). daily.yml 이 같은 커밋으로 올린다.
import os, json, glob, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(KST).date().isoformat()
SITE = 'https://omaju.kr'
e = lambda s: html.escape(str(s or ''), quote=True)


IMGS, META = {}, {}   # 이미지 사이트맵·새 글 알림판(RSS)용 (대표 2026-10-25: "이미지 검색에 1도 안 걸린다")


def page(path, title, desc, kicker, body, back, ld, image, imgs=(), date=''):
    url = f'{SITE}/{path}'
    IMGS[url] = [(f'{SITE}/{image}', title)] + [(f'{SITE}/{i}', t) for i, t in imgs]
    META[url] = (title, desc, date)
    doc = f'''<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} | 오마주 매거진</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article"><meta property="og:site_name" content="오마주 매거진">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/{image}">
<link rel="icon" href="/icon-192.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>
:root{{--g:#1F5A3E;--gs:#EEF5F0;--ink:#1A1A1A;--sub:#5F6360;--hair:#E6E6E0}}
*{{box-sizing:border-box}}body{{margin:0;background:#fff;color:var(--ink);font-family:'Noto Sans KR',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.72;word-break:keep-all;-webkit-font-smoothing:antialiased}}
.top{{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--hair)}}
.top{{gap:12px}}.top a{{color:var(--g);font-weight:800;text-decoration:none;font-size:1.05rem;white-space:nowrap}}.top a+a{{font-size:.95rem;font-weight:700}}
.hero{{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}}
main{{max-width:720px;margin:0 auto;padding:22px 22px 60px}}
.tag{{display:inline-block;background:var(--g);color:#fff;font-weight:700;font-size:.85rem;padding:6px 12px;border-radius:6px}}
h1{{font-size:1.8rem;line-height:1.35;letter-spacing:-.02em;margin:14px 0 6px;word-break:keep-all}}
.date{{color:var(--sub);font-size:.95rem;margin:0 0 6px}}
.sub{{display:inline-block;background:var(--gs);color:var(--g);font-weight:700;font-size:.85rem;padding:5px 11px;border-radius:6px;margin:30px 0 10px}}
.box{{border-radius:14px;padding:18px;margin:14px 0 0}}.green{{background:var(--gs);color:#23412F}}.yellow{{background:#FFF7DB;color:#3A2E00}}
.box b{{display:block;font-size:.85rem;margin-bottom:4px}}
ol{{padding-left:1.3em}}li{{margin:0 0 10px}}ul.chips{{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}}ul.chips li{{background:#F4F4EF;border-radius:999px;padding:8px 15px;margin:0}}
.go{{display:block;text-align:center;background:#F9E9A8;color:#3A2E00;font-weight:800;text-decoration:none;border-radius:14px;padding:16px;margin:34px 0 0;font-size:1.05rem}}
.note{{color:var(--sub);font-size:.9rem}}footer{{text-align:center;color:var(--sub);font-size:.85rem;padding:30px 20px;border-top:1px solid var(--hair)}}
</style></head><body>
<div class="top"><a href="{SITE}/?from=search">오마주 매거진</a><a href="{back}">오늘 호 보기 ›</a></div>
<img class="hero" src="/{image}" alt="{e(title)}">
<main>
<span class="tag">{e(kicker)}</span>
{body}
<a class="go" href="{back}">오늘의 오마주 매거진 펼쳐 보기 ›</a>
<p class="note">매일 아침 새로 나오는 무료 매거진, 오마주 매거진. 네이버·구글에서 "오마주 매거진"을 검색하세요.</p>
</main>
<footer>© 오마주 매거진 · <a href="{SITE}/terms.html">이용약관</a> · <a href="{SITE}/privacy.html">개인정보처리방침</a></footer>
</body></html>
'''
    os.makedirs(os.path.dirname(os.path.join(ROOT, path)), exist_ok=True)
    open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(doc)
    return url


def rich(t):
    import re
    return re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', e(t))


def kdate(d):
    y, m, dd = d.split('-'); return f'{int(y)}년 {int(m)}월 {int(dd)}일'


def main():
    urls = []
    # 어쩌다 점점 집사
    try: pets = json.load(open(os.path.join(ROOT, 'data', 'pets.json'), encoding='utf-8'))
    except Exception: pets = {}
    for k, nm, real, img in (('dog', '댕댕이', '강아지', 'img/pet-dog.jpg'), ('cat', '냥이', '고양이', 'img/pet-cat.jpg')):
        for a in pets.get(k, []):
            if not a.get('id') or (a.get('date') or '') > TODAY: continue
            body = (f'<h1>{e(a["title"])}</h1><p class="date">어쩌다 점점 집사 · {nm} · {kdate(a["date"])}</p>'
                    + (f'<div class="box green">{e(a.get("hook"))}</div>' if a.get('hook') else '')
                    + f'<span class="sub">왜 그럴까요</span><p>{e(a.get("why"))}</p>'
                    + '<span class="sub">이렇게 해 보세요</span><ol>' + ''.join(f'<li>{e(t)}</li>' for t in a.get('todo', [])) + '</ol>'
                    + f'<div class="box yellow"><b>이럴 땐 동물병원에</b>{e(a.get("vet"))}</div>'
                    + '<p class="note">집에서 해 볼 수 있는 생활 요령이에요. 아이마다 다르니 걱정되면 수의사와 먼저 상의해 주세요.</p>')
            desc = (a.get('hook', '') + ' ' + a.get('why', ''))[:150]
            ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': desc, 'datePublished': a['date'],
                  'inLanguage': 'ko', 'about': real, 'image': f'{SITE}/{img}',
                  'author': {'@type': 'Organization', 'name': '오마주 매거진'}, 'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
            urls.append((page(f'pet/{a["id"]}.html', a['title'], desc, f'어쩌다 점점 집사 · {nm}', body, f'{SITE}/?from=search#{k}', ld, img), a['date']))
    # 혼자라서 좋은 날 (대표 2026-10-24: "목록이 쌓이니 검색되게")
    NM = {'day': '혼자 떠나는 하루 코스', 'eat': '혼밥 맛집', 'hobby': '혼자 즐기는 취미 자리', 'see': '혼자 보기 좋은 것', 'home': '혼자 사는 살림', 'trip': '혼자 떠나는 여행'}
    try: solo = json.load(open(os.path.join(ROOT, 'data', 'solo.json'), encoding='utf-8'))
    except Exception: solo = {}
    for k, nm in NM.items():
        img = f'img/solo-{k}.jpg'
        for a in solo.get(k, []):
            if not a.get('id') or (a.get('date') or '') > TODAY: continue
            body = (f'<h1>{e(a["title"])}</h1><p class="date">혼자라서 좋은 날 · {nm}' + (f' · {e(a.get("region"))}' if a.get('region') else '') + f' · {kdate(a["date"])}</p>'
                    + (f'<div class="box green">{e(a.get("hook"))}</div>' if a.get('hook') else '')
                    + '<ol>' + ''.join(f'<li><b>{e(x.get("name"))}</b>' + (f' · {e(x.get("where"))}' if x.get('where') else '') + (f' <small>{e(x.get("time"))}</small>' if x.get('time') else '') + f'<br>{e(x.get("note"))}' + (f'<br><i>혼자라서 좋은 점 — {e(x.get("solo"))}</i>' if x.get('solo') else '') + '</li>' for x in a.get('items', [])) + '</ol>'
                    + (('<div class="box yellow"><b>혼자 갈 때 알아 두면 좋아요</b>' + '<br>'.join(e(t) for t in a.get('tips', [])) + '</div>') if a.get('tips') else '')
                    + ('<p class="note">가시기 전에 영업 시간과 휴무일을 한 번 더 확인해 주세요.</p>' if k != 'home' else ''))
            desc = (a.get('hook', '') + ' ' + ', '.join(x.get('name', '') for x in a.get('items', [])))[:150]
            ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': desc, 'datePublished': a['date'], 'inLanguage': 'ko', 'image': f'{SITE}/{img}',
                  'author': {'@type': 'Organization', 'name': '오마주 매거진'}, 'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
            urls.append((page(f'solo/{a["id"]}.html', a['title'], desc, f'혼자라서 좋은 날 · {nm}', body, f'{SITE}/?from=search#solo-{k}', ld, img), a['date']))
    # 기획 연재 '전기차 시대' (대표 2026-10-24) — 도표는 검색이 읽을 수 있게 표로, 사진은 출처와 함께
    for SK, SNAME, SABOUT in (('ev', '전기차 시대', '중국 전기차'), ('ai', 'AI 시대에 살 준비가 되었는가', '생성형 AI')):
        try: ev = json.load(open(os.path.join(ROOT, 'data', SK + '.json'), encoding='utf-8'))
        except Exception: ev = {}
        for a in ev.get('items', []):
            if not a.get('id') or (a.get('date') or '') > TODAY: continue
            parts = []
            for b in a.get('blocks', []):
                if b.get('h'): parts.append(f'<span class="sub">{e(b["h"])}</span>')
                elif b.get('p'): parts.append(f'<p>{rich(b["p"])}</p>')
                elif b.get('box'): parts.append(f'<div class="box green"><b>{e(b["box"]["title"])}</b>{rich(b["box"]["text"])}</div>')
                elif b.get('photo'): ph = b['photo']; parts.append(f'<figure><img src="/{e(ph["src"])}" alt="{e(ph.get("caption"))}" style="width:100%;border-radius:12px"><figcaption>{e(ph.get("caption"))} <small>사진: {e(ph.get("credit"))}</small></figcaption></figure>')
                elif b.get('gallery'):   # 차 사진 띠 — 검색용 쪽에서는 한 장씩 차례로 (이미지 검색에도 걸리게)
                    for ph in b['gallery'].get('items', []): parts.append(f'<figure><img src="/{e(ph["src"])}" alt="{e(ph.get("caption"))}" loading="lazy" style="width:100%;border-radius:12px"><figcaption>{e(ph.get("caption"))} <small>사진: {e(ph.get("credit"))}</small></figcaption></figure>')
                elif b.get('chart'):
                    c = b['chart']
                    rows = [(c.get('on'), f'{c["value"]}%')] if c.get('kind') == 'donut' else [(i[0], f'{i[1]:,}{c.get("unit", "")}' if isinstance(i[1], int) else f'{i[1]}{c.get("unit", "")}') for i in c.get('items', [])]
                    parts.append(f'<table><caption>{e(c["title"])}</caption>' + ''.join(f'<tr><th>{e(l)}</th><td>{e(v)}</td></tr>' for l, v in rows) + f'</table><p class="note">자료: {e(c.get("source"))}</p>')
            body = (f'<h1>{e(a["title"])}</h1><p class="date">기획 연재 {SNAME} {a["no"]}편 · 오마주 편집실 · {kdate(a["date"])}</p>'
                    + (f'<div class="box green">{e(a.get("hook"))}</div>' if a.get('hook') else '') + ''.join(parts)
                    + (('<div class="box yellow"><b>생각해 볼 점</b>' + '<br>'.join(rich(t) for t in a.get('cons', [])) + '</div>') if a.get('cons') else '')
                    + '<p class="note">출처: ' + ' · '.join(e(x.get('name')) for x in a.get('sources', [])) + '</p>'
                + f'<p><a href="/{SK}/index.html"><b>{e(SNAME)} 연재 전체 보기 ›</b></a></p>')
            desc = (a.get('dek', '') + ' ' + a.get('hook', ''))[:150]
            img = next((b['photo']['src'] for b in a.get('blocks', []) if b.get('photo')), f'img/detail_{SK}.jpg')
            ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': desc, 'datePublished': a['date'], 'inLanguage': 'ko', 'image': f'{SITE}/{img}',
                  'about': SABOUT, 'author': {'@type': 'Organization', 'name': '오마주 편집실'}, 'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
            urls.append((page(f'{SK}/{a["id"]}.html', f'{a["title"]} — {SNAME} {a["no"]}편', desc, f'기획 연재 · {SNAME}', body, f'{SITE}/?from=search#{SK}', ld, img), a['date']))
    # 기획 연재 목차 쪽 (대표 2026-10-24: "기획 연재 두 개도 검색되게") — 연재 전체를 한 쪽에 모아 검색이 묶음으로 알아보게
    for SK, SNAME, SDESC in (('ev', '전기차 시대', '중국 전기차가 이미 우리 곁에 왔습니다. 브랜드 해부부터 충전·보험·중고값까지, 50~60대의 눈으로 객관적으로 짚는 오마주 매거진 기획 연재.'),
                             ('ai', 'AI 시대에 살 준비가 되었는가', '쉰과 예순이 가장 빨리 배우고 있는 생성형 AI. 처음 써 보기부터 사기 막기까지, 오늘 휴대폰으로 해 볼 수 있는 것을 짚는 오마주 매거진 기획 연재.')):
        try: lst = [a for a in json.load(open(os.path.join(ROOT, 'data', SK + '.json'), encoding='utf-8')).get('items', []) if a.get('id') and (a.get('date') or '') <= TODAY]
        except Exception: lst = []
        if not lst: continue
        lst.sort(key=lambda a: a['no'])
        body = (f'<h1>{e(SNAME)}</h1><p class="date">오마주 매거진 기획 연재 · 오마주 편집실 · 지금까지 {len(lst)}편</p><div class="box green">{e(SDESC)}</div>'
                + '<ol>' + ''.join(f'<li><a href="/{SK}/{a["id"]}.html"><b>{a["no"]}편. {e(a["title"])}</b></a><br><small>{e(a.get("dek", ""))} · {kdate(a["date"])}</small></li>' for a in lst) + '</ol>')
        ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': f'{SNAME} — 오마주 매거진 기획 연재', 'description': SDESC, 'inLanguage': 'ko',
              'hasPart': [{'@type': 'Article', 'headline': a['title'], 'url': f'{SITE}/{SK}/{a["id"]}.html', 'datePublished': a['date']} for a in lst],
              'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
        urls.append((page(f'{SK}/index.html', f'{SNAME} — 기획 연재', SDESC, '기획 연재 · 오마주 편집실', body, f'{SITE}/?from=search#{SK}', ld, f'img/detail_{SK}.jpg'), lst[-1]['date']))
    # 오늘의 한 끼
    for f in sorted(glob.glob(os.path.join(ROOT, 'daily', '*.json'))):
        d = os.path.basename(f)[:10]
        if d > TODAY: continue
        try: day = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        m = day.get('meal') or {}
        if not m.get('title') or not m.get('steps'): continue
        hook = ((day.get('hooks') or {}).get('food') or {}).get('hook', '').replace('\n', ' ')
        no = (datetime.date.fromisoformat(d) - datetime.date(2026, 10, 22)).days + 1
        title = f'{m["title"]} 레시피' + (f' — {hook}' if hook else '')
        body = (f'<h1>{e(m["title"])}</h1><p class="date">오늘의 한 끼' + (f' No.{no}' if no > 0 else '') + f' · {kdate(d)}' + (f' · {e(m.get("sub"))}' if m.get('sub') else '') + '</p>'
                + (f'<div class="box green">{e(m.get("lead"))}</div>' if m.get('lead') else '')
                + '<span class="sub">재료</span><ul class="chips">' + ''.join(f'<li>{e(t)}</li>' for t in m.get('ingredients', [])) + '</ul>'
                + '<span class="sub">만드는 법</span><ol>' + ''.join(f'<li>{e(t)}</li>' for t in m['steps']) + '</ol>'
                + (f'<div class="box yellow"><b>요령</b>{e(m.get("tip"))}</div>' if m.get('tip') else ''))
        desc = (m.get('lead', '') + ' 재료: ' + ', '.join(m.get('ingredients', [])))[:150]
        ld = {'@context': 'https://schema.org', '@type': 'Recipe', 'name': m['title'], 'description': m.get('lead', ''), 'datePublished': d,
              'inLanguage': 'ko', 'image': f'{SITE}/img/food.jpg', 'recipeCategory': '집밥', 'recipeCuisine': '한식·가정식',
              'recipeIngredient': m.get('ingredients', []), 'recipeInstructions': [{'@type': 'HowToStep', 'text': t} for t in m['steps']],
              'author': {'@type': 'Organization', 'name': '오마주 매거진'}}
        urls.append((page(f'meal/{d}.html', title, desc, '오늘의 한 끼', body, f'{SITE}/?from=search#food', ld, 'img/food.jpg'), d))
    # 오늘의 인사 카드 — 이미지 검색에 걸리게 (대표 2026-10-25). 그림은 daily.yml 이 tools/shorts_cards.mjs 로 떠 둔 greet/img/<날짜>-N.jpg
    WD = '월화수목금토일'
    def season(m): return '겨울' if m in (12, 1, 2) else '봄' if m <= 5 else '여름' if m <= 8 else '가을'
    greet_list = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'daily', '*.json'))):
        d = os.path.basename(f)[:10]
        if d > TODAY: continue
        try: day = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        G = [g for g in (day.get('greetings') or []) if g]
        files = [f'greet/img/{d}-{i + 1}.jpg' for i in range(len(G))]
        if not G or not all(os.path.exists(os.path.join(ROOT, x)) for x in files): continue
        dt = datetime.date.fromisoformat(d); md = f'{dt.month}월 {dt.day}일'; wd = WD[dt.weekday()] + '요일'; ss = season(dt.month)
        title = f'{md} {wd} 아침 인사 이미지 — {ss} 좋은 글귀 카드 {len(G)}장'
        alts = [f'{md} {wd} 좋은 아침 인사 이미지 {i + 1} — ' + g.replace(chr(10), ' ') for i, g in enumerate(G)]
        body = (f'<h1>{e(md)} {e(wd)}, 오늘의 아침 인사</h1><p class="date">오마주 매거진 · 오늘의 인사 카드 · {kdate(d)}</p>'
                + f'<div class="box green">카톡으로 보내기 좋은 {e(ss)} 아침 인사 이미지 {len(G)}장이에요. 마음 가는 분께 한 장 보내 보세요. 오마주 매거진 첫 화면에서 날짜가 들어간 카드로 바로 보낼 수 있어요.</div>'
                + ''.join(f'<figure style="margin:22px 0"><img src="/{x}" alt="{e(a)}" loading="lazy" style="width:100%;border-radius:14px"><figcaption style="margin-top:8px;color:#444">{e(g).replace(chr(10), "<br>")}</figcaption></figure>' for x, a, g in zip(files, alts, G))
                + '<p class="note">좋은 아침 인사말 · 아침 인사 글귀 · ' + e(wd) + ' 인사말 · ' + e(ss) + ' 인사 이미지 — 매일 아침 새 카드가 올라옵니다.</p>'
                + '<p><a href="/greet/index.html"><b>지난 인사 카드 모두 보기 ›</b></a></p>')
        desc = f'{md} {wd} 아침에 보내기 좋은 {ss} 인사 이미지와 글귀. ' + ' / '.join(g.replace(chr(10), ' ') for g in G)[:110]
        ld = {'@context': 'https://schema.org', '@type': 'ImageGallery', 'name': title, 'description': desc, 'datePublished': d, 'inLanguage': 'ko',
              'image': [{'@type': 'ImageObject', 'contentUrl': f'{SITE}/{x}', 'caption': a} for x, a in zip(files, alts)],
              'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
        u = page(f'greet/{d}.html', title, desc, '오늘의 인사 카드', body, f'{SITE}/?from=search', ld, files[0], list(zip(files[1:], alts[1:])), d)
        urls.append((u, d)); greet_list.append((d, title))
    if greet_list:
        body = '<h1>오늘의 인사 카드 모음</h1><p class="date">오마주 매거진 · 매일 아침 새 카드</p><div class="box green">카톡으로 보내기 좋은 아침 인사 이미지를 날마다 모아 둡니다.</div><ol>' + ''.join(f'<li><a href="/greet/{d}.html"><b>{e(t)}</b></a></li>' for d, t in reversed(greet_list)) + '</ol>'
        ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': '오늘의 인사 카드 모음 — 아침 인사 이미지', 'inLanguage': 'ko'}
        urls.append((page('greet/index.html', '아침 인사 이미지 모음 — 날마다 새 인사 카드', '카톡으로 보내기 좋은 좋은 아침 인사 이미지와 글귀를 날마다 모아 둡니다.', '오늘의 인사 카드', body, f'{SITE}/?from=search', ld, f'greet/img/{greet_list[-1][0]}-1.jpg', (), greet_list[-1][0]), greet_list[-1][0]))
    # 오늘의 한 권 · 요즘 말(시사 상식) · 몸 한 가지 · 그해 오늘 — 콘텐츠마다 검색어가 걸리게 (홍보국 2026-10-25: "소제목부터 내용까지 다 노출되게")
    ORG = {'author': {'@type': 'Organization', 'name': '오마주 매거진'}, 'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
    def art(title, desc, d, img): return {'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': desc, 'datePublished': d, 'inLanguage': 'ko', 'image': f'{SITE}/{img}', **ORG}
    for f in sorted(glob.glob(os.path.join(ROOT, 'daily', '*.json'))):
        d = os.path.basename(f)[:10]
        if d > TODAY: continue
        try: day = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        dt = datetime.date.fromisoformat(d)
        b = day.get('book') or {}
        if b.get('title') and b.get('blurb'):
            title = f'{b["title"]} — {b.get("author", "")} | 책 소개·줄거리·읽을 만한 대목'
            body = (f'<h1>{e(b["title"])}</h1><p class="date">오늘의 한 권 · {e(b.get("author"))}' + (f' · {e(b.get("publisher"))}' if b.get('publisher') else '') + (f' · {e(b.get("year"))}' if b.get('year') else '') + f' · {kdate(d)}</p>'
                    + f'<div class="box green">{e(b["blurb"])}</div>' + (f'<span class="sub">멈추게 되는 대목</span><p>{e(b.get("scene"))}</p>' if b.get('scene') else '')
                    + (f'<span class="sub">왜 지금 이 책인가</span><p>{e(b.get("why"))}</p>' if b.get('why') else '') + '<p class="note">책 속 문장을 그대로 옮기지 않고, 읽은 느낌을 우리 말로 적었습니다.</p>')
            desc = f'{b["title"]}({b.get("author", "")}) 책 소개. ' + b['blurb'][:120]
            urls.append((page(f'book/{d}.html', title, desc, '오늘의 한 권', body, f'{SITE}/?from=search#book', art(title, desc, d, 'img/book.jpg'), 'img/book.jpg', (), d), d))
        q = day.get('quiz') or {}
        if q.get('term') and q.get('meaning'):
            title = f'{q["term"]} 뜻 — {q["meaning"]} | 요즘 말 상식'
            body = (f'<h1>‘{e(q["term"])}’ 무슨 뜻일까요?</h1><p class="date">오늘의 시사 상식 · {e(q.get("kind") or "")} · {kdate(d)}</p>'
                    + f'<div class="box green"><b>뜻</b>{e(q["meaning"])}</div>' + (f'<p>{e(q.get("explain"))}</p>' if q.get('explain') else '')
                    + (f'<span class="sub">왜 화제일까</span><p>{e(q.get("why"))}</p>' if q.get('why') else '') + (f'<div class="box yellow"><b>이렇게 써요</b>{e(q.get("example"))}</div>' if q.get('example') else ''))
            desc = f'{q["term"]} 뜻: {q["meaning"]}. ' + (q.get('explain') or '')[:110]
            urls.append((page(f'word/{d}.html', title, desc, '오늘의 시사 상식', body, f'{SITE}/?from=search#quiz', art(title, desc, d, 'img/issue.jpg' if os.path.exists(os.path.join(ROOT, 'img/issue.jpg')) else 'img/hero.jpg'), 'img/issue.jpg' if os.path.exists(os.path.join(ROOT, 'img/issue.jpg')) else 'img/hero.jpg', (), d), d))
        y = day.get('body') or {}
        if y.get('part') and y.get('line'):
            title = f'{y["part"]} — {y["line"]} | 오늘의 몸 한 가지'
            body = (f'<h1>{e(y["line"])}</h1><p class="date">오늘의 몸 한 가지 · {e(y["part"])} · {kdate(d)}</p>' + (f'<p>{e(y.get("note"))}</p>' if y.get('note') else '')
                    + (f'<div class="box green"><b>오늘 해 볼 것</b>{e(y.get("todo"))}</div>' if y.get('todo') else '') + (f'<div class="box yellow"><b>요령</b>{e(y.get("tip"))}</div>' if y.get('tip') else '')
                    + '<p class="note">생활 속 요령이에요. 통증이나 불편이 오래가면 전문의와 먼저 상의해 주세요.</p>')
            desc = f'{y["part"]}: {y["line"]}. ' + (y.get('note') or '')[:110]
            img = 'img/body.jpg' if os.path.exists(os.path.join(ROOT, 'img/body.jpg')) else 'img/hero.jpg'
            urls.append((page(f'body/{d}.html', title, desc, '오늘의 몸 한 가지', body, f'{SITE}/?from=search#body', art(title, desc, d, img), img, (), d), d))
        era = day.get('era') or {}
        for ago, x in sorted(era.items(), key=lambda kv: -int(kv[0]) if str(kv[0]).isdigit() else 0):
            if not str(ago).isdigit() or not isinstance(x, dict): continue
            yr = dt.year - int(ago)
            facts = [f for f in (x.get('facts') or []) if isinstance(f, (list, tuple)) and len(f) >= 2]
            songs = [s_ for s_ in (x.get('songs') or []) if isinstance(s_, (list, tuple)) and len(s_) >= 2]
            if not facts and not songs: continue
            title = f'{yr}년 {dt.month}월 {dt.day}일, 그해 오늘 — 그때 뉴스·인기 가요'
            body = (f'<h1>{yr}년 {dt.month}월 {dt.day}일, 그해 오늘</h1><p class="date">그때 돌아보기 · {ago}년 전 오늘 · 오마주 매거진</p>'
                    + (f'<div class="box green">{e(x.get("mood"))}</div>' if x.get('mood') else '')
                    + ''.join(f'<span class="sub">{e(t)}</span><p>{e(c)}</p>' for t, c, *_ in facts)
                    + (('<span class="sub">' + str(yr) + '년 그 시절 노래</span><ol>' + ''.join(f'<li>{e(a)} — {e(b_)}</li>' for a, b_, *_ in songs[:10]) + '</ol>') if songs else ''))
            desc = f'{yr}년 {dt.month}월 {dt.day}일 그해 오늘. ' + ' · '.join(t for t, *_ in facts[:3]) + (' · 인기 가요 ' + ', '.join(a for a, *_ in songs[:3]) if songs else '')
            img = 'img/detail_history.jpg' if os.path.exists(os.path.join(ROOT, 'img/detail_history.jpg')) else 'img/hero.jpg'
            urls.append((page(f'then/{d}-{ago}.html', title, desc[:150], '그해 오늘', body, f'{SITE}/?from=search#history', art(title, desc[:150], d, img), img, (), d), d))
    # 심리 테스트 — "성격 테스트·심리 테스트 무료"로 찾는 낯선 분들이 걸리게 (홍보국 2026-10-25). 유형 소개까지 쪽에 싣고, 해 보기는 오마주로.
    try:
        import subprocess
        T = json.loads(subprocess.run(['node', '--input-type=module', '-e', "import {TESTS} from './js/psy_tests.js'; console.log(JSON.stringify(TESTS))"], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout or '{}')
    except Exception as ex:
        print('[심리 테스트 못 읽음]', ex); T = {}
    open_tests = []
    for tid, t in T.items():
        if (t.get('open') or '9999') > TODAY: continue
        types = t.get('types') or {}
        kick = t.get('kick', ''); ttl = (t.get('title') or '').replace(chr(10), ' ')
        title = f'{kick} 심리 테스트 — {ttl} | 무료 성격 테스트'
        img = f'img/{tid}.jpg' if t.get('photo') and os.path.exists(os.path.join(ROOT, f'img/{tid}.jpg')) else 'img/psy.jpg'
        body = (f'<h1>{e(ttl)}</h1><p class="date">오마주 매거진 · 심리 테스트 · 질문 {len(t.get("qs") or [])}개 · 1분</p><div class="box green">{e(t.get("lead"))}</div>'
                + f'<p><a class="go" href="{SITE}/?from=search#{tid}">지금 테스트 해 보기 ›</a></p>'
                + f'<span class="sub">나올 수 있는 유형 {len(types)}가지</span>'
                + ''.join(f'<p><b>{e(v.get("name"))}</b> — {e(v.get("nick"))}<br><small>{e((v.get("read") or "")[:80])}…</small></p>' for v in types.values())
                + '<p class="note">내 유형과 잘 맞는 짝·부딪히는 짝, 오늘 해 볼 것까지 결과에서 볼 수 있어요. 결과 카드는 카톡으로 보내 친구와 비교해 보세요.</p>')
        desc = f'{kick} 심리 테스트. {t.get("lead", "")}'[:150]
        ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': desc, 'datePublished': t.get('open'), 'inLanguage': 'ko', 'image': f'{SITE}/{img}', **ORG}
        urls.append((page(f'test/{tid}.html', title, desc, '심리 테스트', body, f'{SITE}/?from=search#{tid}', ld, img, (), t.get('open')), t.get('open'))); open_tests.append((tid, title, t.get('open')))
    if open_tests:
        body = '<h1>오마주 심리 테스트 모음</h1><p class="date">질문 넷, 1분이면 끝 · 결과는 넉넉하게</p><ol>' + ''.join(f'<li><a href="/test/{i}.html"><b>{e(tt)}</b></a></li>' for i, tt, _ in sorted(open_tests, key=lambda x: x[2], reverse=True)) + '</ol>'
        urls.append((page('test/index.html', '무료 심리 테스트 모음 — 성격·관계·취향 테스트', '1분이면 끝나는 오마주 매거진 심리 테스트 모음. 카톡 답장 속도, 여행 스타일 등.', '심리 테스트', body, f'{SITE}/?from=search', {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': '심리 테스트 모음', 'inLanguage': 'ko'}, 'img/psy.jpg', (), TODAY), TODAY))
    # 오늘의 운세 — 띠별 (대표 2026-10-25: "뭐라도 걸려서 들어오게")
    ORDER = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지']
    for f in sorted(glob.glob(os.path.join(ROOT, 'daily', '*.json'))):
        d = os.path.basename(f)[:10]
        if d > TODAY: continue
        try: day = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        F = day.get('fortune') or {}
        if not isinstance(F, dict) or len(F) < 12: continue
        dt = datetime.date.fromisoformat(d); md = f'{dt.month}월 {dt.day}일'; wd = WD[dt.weekday()] + '요일'
        title = f'{dt.year}년 {md} {wd} 오늘의 운세 — 띠별 운세 쥐띠부터 돼지띠까지'
        rows = []
        for z in ORDER:
            x = F.get(z) or {}
            if not x: continue
            rows.append(f'<span class="sub">{e(z)}띠 오늘의 운세</span><p>{e(x.get("total"))}</p>'
                        + ''.join(f'<p><b>{lb}</b> {e(x.get(k))}</p>' for lb, k in (('재물', 'money'), ('사람', 'people'), ('일', 'work'), ('조심', 'care'), ('해 보면 좋은 것', 'do')) if x.get(k))
                        + f'<p class="note">행운의 색 {e(x.get("color"))} · 숫자 {e(x.get("num"))} · 장소 {e(x.get("place"))} · 좋은 때 {e(x.get("time"))}</p>')
        body = f'<h1>{e(md)} {e(wd)} 오늘의 운세</h1><p class="date">오마주 매거진 · 띠별 운세 · {kdate(d)}</p><div class="box green">재미로 보는 오늘 하루의 길잡이예요. 좋은 말은 챙기고, 조심할 말은 가볍게 마음에 두세요.</div>' + ''.join(rows)
        desc = f'{md} {wd} 띠별 오늘의 운세. 쥐띠 ' + ((F.get('쥐') or {}).get('total', ''))[:90]
        ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': desc, 'datePublished': d, 'inLanguage': 'ko', 'image': f'{SITE}/img/fortune.jpg',
              'author': {'@type': 'Organization', 'name': '오마주 매거진'}, 'publisher': {'@type': 'Organization', 'name': '오마주 매거진', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/icon-192.png'}}}
        urls.append((page(f'fortune/{d}.html', title, desc, '오늘의 운세', body, f'{SITE}/?from=search#fortune', ld, 'img/fortune.jpg', (), d), d))
    # 구글 웹 스토리 (홍보국 2026-10-25) — 인사 카드·띠별 운세를 넘겨 보는 세로 화면
    try:
        import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from web_stories import build as stories
        for u, d, t, ds, poster in stories(ROOT, TODAY):
            urls.append((u, d)); IMGS[u] = [(f'{SITE}/{poster}', t)]; META[u] = (t, ds, d)
    except Exception as ex: print('웹 스토리 실패', str(ex)[:120])
    # 사이트맵 — 첫 화면 · 약관 + 글마다, 그림까지 (이미지 검색)
    x = lambda t: html.escape(str(t or ''), quote=False)
    def imgtags(u): return ''.join(f'<image:image><image:loc>{x(i)}</image:loc><image:title>{x(t)}</image:title></image:image>' for i, t in IMGS.get(u, []))
    rows = [f'  <url><loc>{SITE}/</loc><lastmod>{TODAY}</lastmod><changefreq>daily</changefreq><priority>1.0</priority><image:image><image:loc>{SITE}/img/hero.jpg</image:loc><image:title>오마주 매거진 — 오늘도 마음은 주니어</image:title></image:image></url>']
    rows += [f'  <url><loc>{u}</loc><lastmod>{d}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority>{imgtags(u)}</url>' for u, d in sorted(urls, key=lambda x: x[1], reverse=True)]
    rows += [f'  <url><loc>{SITE}/{p}</loc><lastmod>2026-10-21</lastmod><changefreq>yearly</changefreq><priority>0.2</priority></url>' for p in ('terms.html', 'privacy.html')]
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + '\n'.join(rows) + '\n</urlset>\n')
    # 새 글 알림판(RSS) — 네이버 서치어드바이저에 한 번 등록하면 새 글을 빨리 가져간다
    items = sorted(urls, key=lambda x: x[1], reverse=True)[:60]
    def rfc(d): return datetime.datetime.fromisoformat(d + 'T06:00:00+09:00').strftime('%a, %d %b %Y %H:%M:%S +0900')
    ri = ''.join(f'<item><title>{x(META.get(u, ("",))[0])}</title><link>{x(u)}</link><guid>{x(u)}</guid><description>{x(META.get(u, ("", ""))[1])}</description><pubDate>{rfc(d)}</pubDate></item>' for u, d in items)
    open(os.path.join(ROOT, 'rss.xml'), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>오마주 매거진</title><link>{SITE}/</link><description>매일 아침 새로 나오는 무료 매거진 — 오늘의 한 끼·인사 카드·운세·집사·혼자라서 좋은 날·기획 연재</description><language>ko</language>{ri}</channel></rss>\n')
    print('검색용 쪽', len(urls), '개 · sitemap.xml')


if __name__ == '__main__':
    main()
