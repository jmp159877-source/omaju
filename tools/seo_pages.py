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


def page(path, title, desc, kicker, body, back, ld, image):
    url = f'{SITE}/{path}'
    doc = f'''<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} | 오마주 매거진</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
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
<img class="hero" src="/{image}" alt="">
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
    # 사이트맵 — 첫 화면 · 약관 + 글마다
    rows = [f'  <url><loc>{SITE}/</loc><lastmod>{TODAY}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>']
    rows += [f'  <url><loc>{u}</loc><lastmod>{d}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>' for u, d in sorted(urls, key=lambda x: x[1], reverse=True)]
    rows += [f'  <url><loc>{SITE}/{p}</loc><lastmod>2026-10-21</lastmod><changefreq>yearly</changefreq><priority>0.2</priority></url>' for p in ('terms.html', 'privacy.html')]
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')
    print('검색용 쪽', len(urls), '개 · sitemap.xml')


if __name__ == '__main__':
    main()
