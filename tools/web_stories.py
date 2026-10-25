# 구글 웹 스토리 (홍보국 2026-10-25 — 대표 "올려 봐"): 손가락으로 넘겨 보는 세로 화면.
#  구글 검색·디스커버에 큰 그림 카드로 뜬다. 날마다 두 편 —
#   stories/greet-<날짜>.html  '○월 ○일 좋은 아침 인사 이미지 4장' (표지 → 카드 넉 장 → 끝장)
#   stories/fortune-<날짜>.html '○월 ○일 띠별 오늘의 운세' (표지 → 띠 열둘 → 끝장)
#  끝장·카드마다 '오마주에서 보기' 링크(?from=story) — 웹 스토리에서 온 분을 관리자에서 센다.
#  seo_pages.py 가 부르고, 만든 주소는 sitemap.xml 에 함께 올린다. 최근 30일만 만든다.
import os, json, glob, html, datetime
from PIL import Image, ImageDraw, ImageFilter

e = lambda s: html.escape(str(s or ''), quote=True)
SITE = 'https://omaju.kr'
WD = '월화수목금토일'
ORDER = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지']

BOILER = ('<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;'
          '-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}'
          '@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}'
          '@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}'
          '@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>'
          '<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>')

CSS = ('amp-story{font-family:"Nanum Myeongjo",serif;color:#fff}'
       '.bg{background:linear-gradient(180deg,#0F3D2C 0%,#155A40 100%)}'
       '.lab{font-size:13px;letter-spacing:.04em;opacity:.85;padding:28px 20px 0}'
       '.mid{align-content:center;justify-items:center;text-align:center;padding:0 26px}'
       '.date{font-size:16px;color:#D9C27A;margin:18px 0 0}'
       '.h1{font-size:31px;font-weight:800;line-height:1.35;margin:10px 0 0}'
       '.p{font-size:16px;line-height:1.6;opacity:.9;margin:12px 0 0}'
       '.card{width:78%;margin:84px auto 0;border-radius:10px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}'
       '.cap{align-content:end;text-align:center;padding:0 20px 96px;font-size:17px;font-weight:700;text-shadow:0 1px 6px rgba(0,0,0,.5)}'
       '.z{font-size:44px;font-weight:800;margin:0}'
       '.zt{font-size:19px;line-height:1.65;margin:18px 0 0;font-weight:700}'
       '.zd{font-size:15px;line-height:1.6;margin:18px 0 0;color:#F9E9A8}'
       '.zl{font-size:13px;opacity:.8;margin:16px 0 0}'
       '.logo{width:120px;margin:0 auto;background:#fff;border-radius:16px;padding:10px}')


def head(url, title, desc, poster):
    return (f'<!doctype html><html amp lang="ko"><head><meta charset="utf-8"><title>{e(title)}</title>'
            f'<link rel="canonical" href="{url}"><meta name="viewport" content="width=device-width">'
            f'<meta name="description" content="{e(desc)}"><meta name="robots" content="max-image-preview:large">'
            f'<meta property="og:title" content="{e(title)}"><meta property="og:image" content="{SITE}/{poster}">'
            '<script async src="https://cdn.ampproject.org/v0.js"></script>'
            '<script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&display=swap" rel="stylesheet">'
            f'{BOILER}<style amp-custom>{CSS}</style>'
            f'<script type="application/ld+json">{json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": title, "description": desc, "image": [f"{SITE}/{poster}"], "inLanguage": "ko", "author": {"@type": "Organization", "name": "오마주 매거진"}, "publisher": {"@type": "Organization", "name": "오마주 매거진", "logo": {"@type": "ImageObject", "url": f"{SITE}/icon-192.png"}}}, ensure_ascii=False)}</script>'
            '</head><body>'
            f'<amp-story standalone title="{e(title)}" publisher="오마주 매거진" publisher-logo-src="{SITE}/icon-192.png" poster-portrait-src="{SITE}/{poster}">')


def outlink(href, text):
    return f'<amp-story-page-outlink layout="nodisplay"><a href="{href}">{e(text)}</a></amp-story-page-outlink>'


def end_page():
    return ('<amp-story-page id="end"><amp-story-grid-layer template="fill" class="bg"></amp-story-grid-layer>'
            '<amp-story-grid-layer template="vertical" class="mid">'
            f'<div><amp-img class="logo" src="{SITE}/icon-192.png" width="192" height="192" layout="fixed" alt="오마주 매거진"></amp-img>'
            '<p class="h1">매일 아침,<br>새로 나오는 잡지.</p><p class="p">운세 · 한 끼 · 그 시절 노래 · 여행 · 인사 카드<br>가입 없이 무료로</p>'
            '<p class="zl">네이버·구글에서 "오마주 매거진"</p></div></amp-story-grid-layer>'
            + outlink(f'{SITE}/?from=story', '오늘 호 펼쳐 보기') + '</amp-story-page>')


def poster_from(src, dst, label):
    """3:4 표지 그림 (720×960): 짙은 초록 바탕 위에 그림을 얹는다"""
    W, H = 720, 960
    bg = Image.new('RGB', (W, H), (15, 61, 44)); d = ImageDraw.Draw(bg)
    for y in range(H): d.line([(0, y), (W, y)], fill=(15, int(61 + 29 * y / H), int(44 + 20 * y / H)))
    im = Image.open(src).convert('RGB'); im.thumbnail((560, 700), Image.LANCZOS)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([(W - im.width) // 2 + 6, 90 + 14, (W + im.width) // 2 + 6, 90 + im.height + 14], 14, fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(14)); bg.paste(sh, (0, 0), sh)
    bg.paste(im, ((W - im.width) // 2, 90))
    bg.save(dst, quality=88)


def build(root, today, days=30):
    """만든 (주소, 날짜) 목록을 돌려준다"""
    out = []
    os.makedirs(os.path.join(root, 'stories', 'img'), exist_ok=True)
    fp = os.path.join(root, 'stories', 'img', 'fortune-poster.jpg')
    if not os.path.exists(fp):
        im = Image.open(os.path.join(root, 'img', 'fortune.jpg')).convert('RGB')
        w = round(im.height * 3 / 4); x = (im.width - w) // 2
        im.crop((x, 0, x + w, im.height)).resize((720, 960), Image.LANCZOS).save(fp, quality=88)
    start = (datetime.date.fromisoformat(today) - datetime.timedelta(days=days)).isoformat()
    for f in sorted(glob.glob(os.path.join(root, 'daily', '*.json'))):
        d = os.path.basename(f)[:10]
        if d > today or d < start: continue
        try: day = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        dt = datetime.date.fromisoformat(d); md = f'{dt.month}월 {dt.day}일'; wd = WD[dt.weekday()] + '요일'
        # ① 아침 인사 카드
        G = [g for g in (day.get('greetings') or []) if g]
        files = [f'greet/img/{d}-{i + 1}.jpg' for i in range(len(G))]
        if G and all(os.path.exists(os.path.join(root, x)) for x in files):
            poster = f'stories/img/greet-{d}.jpg'
            if not os.path.exists(os.path.join(root, poster)): poster_from(os.path.join(root, files[0]), os.path.join(root, poster), md)
            url = f'{SITE}/stories/greet-{d}.html'
            title = f'{md} {wd} 좋은 아침 인사 이미지 {len(G)}장'
            desc = f'카톡으로 보내기 좋은 {md} {wd} 아침 인사 카드. ' + ' / '.join(g.replace(chr(10), ' ') for g in G)[:100]
            pages = ['<amp-story-page id="cover"><amp-story-grid-layer template="fill">'
                     f'<amp-img src="{SITE}/{poster}" width="720" height="960" layout="responsive" alt="{e(title)}"></amp-img></amp-story-grid-layer>'
                     '<amp-story-grid-layer template="vertical" class="cap"><div>'
                     f'<p class="date">{e(md)} {e(wd)}</p><p class="h1">좋은 아침<br>인사 이미지 {len(G)}장</p><p class="p">카톡으로 바로 보내기 좋은 오늘의 카드</p></div></amp-story-grid-layer></amp-story-page>']
            for i, (x, g) in enumerate(zip(files, G)):
                pages.append(f'<amp-story-page id="c{i + 1}"><amp-story-grid-layer template="fill" class="bg"></amp-story-grid-layer>'
                             f'<amp-story-grid-layer template="vertical"><p class="lab">오마주 매거진 · 아침 인사 {i + 1}/{len(G)}</p>'
                             f'<div class="card"><amp-img src="{SITE}/{x}" width="1200" height="1500" layout="responsive" alt="{e(md + " 좋은 아침 인사 이미지 " + str(i + 1) + " — " + g.replace(chr(10), " "))}"></amp-img></div></amp-story-grid-layer>'
                             '<amp-story-grid-layer template="vertical" class="cap"><p>길게 눌러 저장 · 마음 가는 분께</p></amp-story-grid-layer>'
                             + outlink(f'{SITE}/?from=story#g1', '오마주에서 카톡으로 보내기') + '</amp-story-page>')
            pages.append(end_page())
            open(os.path.join(root, 'stories', f'greet-{d}.html'), 'w', encoding='utf-8').write(head(url, title, desc, poster) + ''.join(pages) + '</amp-story></body></html>\n')
            out.append((url, d, title, desc, poster))
        # ② 띠별 운세
        F = day.get('fortune') or {}
        if isinstance(F, dict) and len(F) >= 12:
            url = f'{SITE}/stories/fortune-{d}.html'
            title = f'{md} {wd} 띠별 오늘의 운세'
            desc = f'{md} {wd} 쥐띠부터 돼지띠까지 오늘의 운세. 쥐띠 ' + ((F.get('쥐') or {}).get('total', ''))[:80]
            poster = 'stories/img/fortune-poster.jpg'
            pages = ['<amp-story-page id="cover"><amp-story-grid-layer template="fill">'
                     f'<amp-img src="{SITE}/{poster}" width="720" height="960" layout="responsive" alt="{e(title)}"></amp-img></amp-story-grid-layer>'
                     '<amp-story-grid-layer template="vertical" class="cap"><div>'
                     f'<p class="date">{e(md)} {e(wd)}</p><p class="h1">띠별<br>오늘의 운세</p><p class="p">쥐띠부터 돼지띠까지, 넘겨 보세요</p></div></amp-story-grid-layer></amp-story-page>']
            for i, z in enumerate(ORDER):
                x = F.get(z) or {}
                if not x: continue
                pages.append(f'<amp-story-page id="z{i}"><amp-story-grid-layer template="fill" class="bg"></amp-story-grid-layer>'
                             '<amp-story-grid-layer template="vertical" class="mid"><div>'
                             f'<p class="date">{e(md)} 오늘의 운세</p><p class="z">{e(z)}띠</p><p class="zt">{e(x.get("total"))}</p>'
                             + (f'<p class="zd">해 보면 좋은 것 · {e(x.get("do"))}</p>' if x.get('do') else '')
                             + f'<p class="zl">행운의 색 {e(x.get("color"))} · 숫자 {e(x.get("num"))}</p></div></amp-story-grid-layer>'
                             + outlink(f'{SITE}/?from=story#fortune', '내 띠 자세히 보기') + '</amp-story-page>')
            pages.append(end_page())
            open(os.path.join(root, 'stories', f'fortune-{d}.html'), 'w', encoding='utf-8').write(head(url, title, desc, poster) + ''.join(pages) + '</amp-story></body></html>\n')
            out.append((url, d, title, desc, poster))
    return out
