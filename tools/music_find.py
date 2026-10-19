"""오프닝 배경 음악 후보 찾기 (아침·낮·저녁).

인터넷 아카이브에서 **CC0(퍼블릭 도메인 헌정)** 음원만 골라 받아 온다.
CC0 는 상업적으로 써도 되고 출처를 밝히지 않아도 된다 — 오마주처럼 상표를 낼 서비스에 안전하다.
받은 것은 25초로 잘라 제미나이에게 들려 주고, 사람 목소리 밑에 깔 수 있는 것만 남긴다.

결과: out_music/<슬롯>_<번호>.mp3 와 out_music/report.txt
"""
import os, sys, json, time, base64, urllib.parse, urllib.request, subprocess, re

KEY = os.environ['GEMINI_API_KEY']
OUT = 'out_music'
os.makedirs(OUT, exist_ok=True)
LOG = open(f'{OUT}/report.txt', 'w', encoding='utf-8')


def say(*a):
    print(*a, flush=True); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()


# 슬롯마다 찾을 결 — 말소리를 가리지 않는 조용한 기악곡
SLOTS = {
    'morning': ('밝고 산뜻한 아침', 'acoustic guitar OR piano OR ukulele bright cheerful instrumental'),
    'noon':    ('가볍게 흐르는 한낮', 'bossa nova OR jazz OR swing light instrumental'),
    'evening': ('잔잔한 저녁',       'piano OR strings calm warm ambient instrumental'),
}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': 'omaju/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def search(q, rows=40):
    """CC0 음원만. licenseurl 에 publicdomain/zero 가 들어간 것."""
    query = f'({q}) AND mediatype:(audio) AND licenseurl:(*publicdomain\\/zero*)'
    url = ('https://archive.org/advancedsearch.php?q=' + urllib.parse.quote(query)
           + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=licenseurl'
           + f'&rows={rows}&page=1&output=json')
    return json.loads(get(url))['response']['docs']


def files(ident):
    meta = json.loads(get(f'https://archive.org/metadata/{ident}'))
    out = []
    for f in meta.get('files', []):
        if f.get('format') in ('VBR MP3', '128Kbps MP3', 'MP3'):
            sec = float(f.get('length', 0) or 0) if re.match(r'^[\d.]+$', str(f.get('length', ''))) else 0
            out.append((f['name'], sec))
    return out


def clip(src, dst, sec=25):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '20', '-t', str(sec),
                    '-i', src, '-ac', '1', '-ar', '24000', '-b:a', '96k', dst], check=True)


def describe(path):
    """제미나이에게 들려 주고 쓸 만한지 묻는다."""
    b = base64.b64encode(open(path, 'rb').read()).decode()
    ask = ('이 음악을 듣고 아래를 한국어 JSON 으로만 답하세요. 설명 문장 금지.\n'
           '{"vocal": 사람 목소리나 노랫말이 들리면 true, "mood": "분위기 한 줄", '
           '"instrument": "주된 악기", "bed": 라디오 진행자 말소리 밑에 조용히 깔기 좋으면 true 아니면 false, '
           '"why": "bed 판단 이유 한 줄", "grade": 1~5 점수}\n'
           '기준: 선율이 너무 도드라지거나, 드럼이 세거나, 갑자기 커지거나, 잡음·히스가 들리거나, '
           '싸구려 미디 음색이면 bed=false. 고급 라이프스타일 잡지에 어울리는 따뜻하고 차분한 연주면 높은 점수.')
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': 'audio/mpeg', 'data': b}}, {'text': ask}]}],
            'generationConfig': {'responseMimeType': 'application/json'}}
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key={KEY}',
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r:
        d = json.load(r)
    return json.loads(d['candidates'][0]['content']['parts'][0]['text'])


WANT = int(os.environ.get('WANT', '3'))     # 슬롯마다 남길 개수
TRY = int(os.environ.get('TRY', '14'))      # 슬롯마다 들어 볼 개수
keep = {}
for slot, (ko, q) in SLOTS.items():
    say(f'\n=== {slot} ({ko}) ===')
    docs = search(q)
    say('찾은 음반', len(docs))
    got, seen, n = [], 0, 0
    for d in docs:
        if len(got) >= WANT or seen >= TRY: break
        ident = d['identifier']
        try:
            fl = [(nm, sec) for nm, sec in files(ident) if 40 <= sec <= 600]
        except Exception as e:
            say('  [메타 실패]', ident, str(e)[:60]); continue
        if not fl: continue
        nm, sec = fl[0]
        seen += 1; n += 1
        raw, cut = f'{OUT}/_raw{n}.mp3', f'{OUT}/_cut{n}.mp3'
        try:
            open(raw, 'wb').write(get(f'https://archive.org/download/{ident}/{urllib.parse.quote(nm)}', 180))
            clip(raw, cut)
            v = describe(cut)
        except Exception as e:
            say('  [실패]', ident, str(e)[:80]); time.sleep(3); continue
        ok = (not v.get('vocal')) and v.get('bed') and int(v.get('grade', 0)) >= 4
        say(f"  {'○' if ok else '×'} {d.get('title','')[:40]} / {str(d.get('creator',''))[:20]}"
            f" | {v.get('instrument')} | {v.get('mood')} | {v.get('grade')}점 | {v.get('why','')[:50]}")
        if ok:
            dst = f'{OUT}/{slot}_{len(got) + 1}.mp3'
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-ac', '2',
                            '-ar', '44100', '-b:a', '128k', dst], check=True)
            got.append({'file': os.path.basename(dst), 'id': ident, 'title': d.get('title'),
                        'creator': str(d.get('creator', '')), 'src': nm, **v})
        os.remove(raw); os.remove(cut)
        time.sleep(2)
    keep[slot] = got
    say(f'남긴 것 {len(got)}개')

json.dump(keep, open(f'{OUT}/picked.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
say('\n끝')
