"""배경 음악 음원을 어디서 받을 수 있는지 한 번에 확인한다 (추측하지 않기).
1) 쓸 수 있는 구글 모델 가운데 음악 만드는 것(lyria)이 있는지
2) 인터넷 아카이브 내려받기 주소가 왜 404 인지 — 실제 주소와 응답을 찍어 본다
3) 위키미디어 공용 음원 주소가 받아지는지
"""
import os, sys, json, urllib.parse, urllib.request

KEY = os.environ['GEMINI_API_KEY']
UA = 'omaju-radio/1.0 (https://omaju.kr; bot@omaju.kr)'


def head(url, label):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read(400000)
            print(f'  [{r.status}] {label} {len(b)}바이트  최종주소={r.url[:110]}')
            return True
    except Exception as e:
        body = ''
        if hasattr(e, 'read'):
            try: body = e.read()[:200].decode('utf-8', 'ignore')
            except Exception: pass
        print(f'  [실패] {label} {str(e)[:90]} {body[:120]}')
        return False


print('=== 1) 쓸 수 있는 모델 ===')
try:
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models?key={KEY}&pageSize=200')
    ms = json.load(urllib.request.urlopen(req, timeout=60)).get('models', [])
    print('  모두', len(ms), '개')
    for m in ms:
        n = m['name']
        if any(k in n.lower() for k in ('lyria', 'music', 'audio', 'tts')):
            print('   -', n, '|', ','.join(m.get('supportedGenerationMethods', []))[:70])
except Exception as e:
    print('  실패', str(e)[:120])

print('\n=== 2) 인터넷 아카이브 ===')
q = '(piano calm instrumental) AND mediatype:(audio) AND licenseurl:(*publicdomain\\/zero*)'
url = ('https://archive.org/advancedsearch.php?q=' + urllib.parse.quote(q)
       + '&fl%5B%5D=identifier&fl%5B%5D=title&rows=6&page=1&output=json')
try:
    docs = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60))['response']['docs']
except Exception as e:
    docs = []; print('  찾기 실패', str(e)[:120])
for d in docs[:4]:
    ident = d['identifier']
    print(f" 음반 {ident[:60]} / {str(d.get('title'))[:40]}")
    try:
        meta = json.load(urllib.request.urlopen(urllib.request.Request(
            f'https://archive.org/metadata/{ident}', headers={'User-Agent': UA}), timeout=60))
    except Exception as e:
        print('  메타 실패', str(e)[:90]); continue
    server, dirn = meta.get('server'), meta.get('dir')
    mp3 = [f['name'] for f in meta.get('files', []) if str(f.get('format', '')).endswith('MP3')]
    print('  서버', server, '| 폴더', dirn, '| mp3', len(mp3), mp3[:2])
    if not mp3: continue
    nm = urllib.parse.quote(mp3[0])
    head(f'https://archive.org/download/{ident}/{nm}', 'download')
    if server and dirn:
        head(f'https://{server}{dirn}/{nm}', '직접')

print('\n=== 3) 위키미디어 공용 ===')
api = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search'
       '&gsrsearch=' + urllib.parse.quote('filetype:audio piano calm') + '&gsrnamespace=6&gsrlimit=5'
       '&prop=imageinfo&iiprop=url|mime|size')
try:
    pages = json.load(urllib.request.urlopen(urllib.request.Request(api, headers={'User-Agent': UA}), timeout=60))
    for p in (pages.get('query', {}).get('pages') or {}).values():
        ii = (p.get('imageinfo') or [{}])[0]
        print(' ', p['title'][:60], '|', ii.get('mime'), '|', round((ii.get('size') or 0) / 1e6, 1), 'MB')
        if ii.get('url'): head(ii['url'], '받기')
except Exception as e:
    print('  실패', str(e)[:120])
print('\n끝')
