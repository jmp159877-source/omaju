# 오늘의 오프닝 (미소·한결) 만들기 — 대본 → 목소리 3벌(아침·낮·저녁) → 받아쓰기 확인 → 장면·자막 시간표
# 결과: MEDIA_DIR/opening/{날짜}.json, {날짜}-{morning|noon|evening}.mp3  (media 가지에 올림, 최근 5일만 남김)
# 쓰는 법: python3 tools/opening.py [YYYY-MM-DD] [--force]
import os, sys, json, re, time, wave, base64, subprocess, urllib.request, datetime, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_check import check
from models import pick

KEY = os.environ['GEMINI_API_KEY']
MEDIA = os.environ.get('MEDIA_DIR', 'media')
OUT = os.path.join(MEDIA, 'opening')
os.makedirs(OUT, exist_ok=True)
KST = datetime.timezone(datetime.timedelta(hours=9))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORCE = '--force' in sys.argv
DATE = args[0] if args else datetime.datetime.now(KST).strftime('%Y-%m-%d')
D = datetime.date.fromisoformat(DATE)
HOST = 'miso' if (D - datetime.date(2026, 10, 19)).days % 2 == 0 else 'hangyeol'   # 월요일(10/19)을 윤미소로 (운영자 2026-10-18)
OTHER = 'hangyeol' if HOST == 'miso' else 'miso'
NAME = {'miso': '윤미소', 'hangyeol': '서한결'}
WD = '월화수목금토일'[D.weekday()]
SLOTS = ['morning', 'noon', 'evening']
TAGS = ['read', 'smile', 'surprise', 'moved', 'laugh', 'talk', 'curious', 'secret', 'delight', 'thumb']
VOICE = {'miso': 'Callirrhoe', 'hangyeol': 'Charon'}
PITCH = {'miso': 195, 'hangyeol': None}   # 미소는 고른 견본 높이(195Hz)에 맞춘다
PROFILE = {
 'miso': '[목소리 설정] 45세 한국 여성 아나운서. 반듯하고 품위 있되 생기 있는 진행자. 안정된 중음, 발음이 또렷하고 말에 탄력이 있다. 아침을 여는 사람답게 눈빛이 살아 있는 밝은 기운. 다만 들뜨거나 호들갑스럽지 않고, 애교·콧소리·말끝 늘이기 금지. 느릿한 낭독조 금지.',
 'hangyeol': '[목소리 설정] 46세 한국 남성 아나운서. 반듯하고 신뢰감 있되 생기 있는 진행자. 낮고 안정된 중저음에 탄력이 있다. 여유 있고 따뜻하지만 처지지 않는다. 까부는 톤·과장된 리액션·들뜬 말투 금지. 느릿한 낭독조 금지.',
}
DIRECT = ('[연출] 아침을 여는 방송. 처음부터 끝까지 기운이 살아 있게, 말에 탄력을 두고 또렷하게. 늘어지지 않는다. '
          '첫인사는 반갑고 밝게. 오늘의 한 조각은 이야기하듯 생기 있게, 재미있는 대목은 미소를 머금고. '
          '오늘 안내는 또렷하고 담백하게. 마무리와 사인오프는 단정하게 힘주어 끝낸다. '
          '줄이 바뀔 때마다 반 박자만 쉬기. 호들갑·과장·애교 금지.')
BAD = ['시니어', '어르신', '노인', '치매', '두뇌', '은퇴', '손주', '손자', '시어머니', '며느리', '효도', '내복']
LOG = []
def say(*a): s = ' '.join(map(str, a)); print(s); LOG.append(s)

def post(url, body, timeout=180):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)

# ── 1) 대본 ──
def prev_next_title():
    y = (D - datetime.timedelta(days=1)).isoformat()
    try: return json.load(open(os.path.join(OUT, y + '.json'))).get('next_title')
    except Exception: return None

def recent_titles():
    t = []
    for f in sorted(glob.glob(os.path.join(OUT, '*.json')))[-10:]:
        try: t.append(json.load(open(f)).get('title', ''))
        except Exception: pass
    return t

PROMPT = '''당신은 라이프스타일 앱 '오마주'(오늘도 마음은 주니어)의 아침 방송 작가입니다. 오늘 진행자는 {name}({desc})입니다.
보는 사람은 나이는 50~60대지만 생각과 생활은 40대입니다. 유튜브·넷플릭스를 보고, 러닝·골프를 하고, 혼자 여행을 가고, 새 일을 벌이고, 콘서트 티켓팅도 합니다.

오늘 날짜: {date} ({wd}요일).
{topic}
최근에 다룬 것 (겹치지 말 것): {recent}

[오늘의 한 조각 — 요일마다 다릅니다. 오늘은 {wd}요일이므로 "{theme}"]
월: 한 주를 여는 문장 하나. 누구나 아는 흔한 명언 금지, 자기계발·확언 말투 금지. 결이 있는 문장과 그 문장이 붙는 구체적인 장면.
화: 그해 오늘 — 10·20·30·40년 전 이맘때 한국의 한 장면. 검색으로 확인된 사실만. "그때 그랬지" 소리가 나오게.
수: 오늘 바로 쓸 만한 생활 요령 하나 — 날씨·옷·살림·장보기. 민간요법이나 건강 효능 주장 금지.
목: 그 시절 노래 한 곡에 얽힌 이야기. 가사를 그대로 옮기지 말고 그 노래가 흐르던 때의 풍경으로.
금: 이번 주말에 볼 만한 것 하나 — 극장·공연·전시 가운데. 확인된 것만.
토: 주말 아침에 어울리는 가벼운 이야기 하나.
일: 한 주를 닫는 차분한 이야기 하나.

[구성]
1. 첫인사 2조각 — 아침·낮·저녁 세 벌. 첫 문장은 반드시 "좋은 아침입니다, {name}입니다." / "점심은 맛있게 드셨어요? {name}입니다." / "오늘 하루도 수고 많으셨습니다, {name}입니다." 와 같은 결로 시간대에 맞게. 둘째 문장에 오늘 요일을 넣어 그 시간대에 맞는 기분 좋은 한마디 (상투적 문구 금지, 구체적인 장면).
2. 오늘의 한 조각 4~6조각 — 위 요일 테마대로. 한 조각 60자 이내, 듣다가 끊기지 않게 이어지게.
3. 오늘 오마주 안내 1~2조각 — 오늘 앱에 들어온 것 가운데 하나나 둘을 구체적인 이름으로 알려 준다. 광고 말투 금지, 담담하게.
   {today_in}
   둘 중 하나는 될 수 있으면 인사 카드로: "오늘 인사 카드에는 ○○ 같은 글이 담겼습니다. 마음 가는 분께 한 장 보내 보세요." 처럼.
4. 오늘의 한마디 1조각 — 오늘의 한 조각에서 길어 올린, 듣는 사람에게 말 거는 한 문장 (설교 금지).
5. 마무리 인사 — 아침·낮·저녁 세 벌, 한 문장씩 (예: 오늘도 좋은 하루 보내세요 / 남은 오후도 힘내세요 / 편안한 저녁 보내세요 를 오늘에 맞게).
6. 내일 예고 제목 — 내일 {other}이(가) 가져올 이야기를 미리 정해 10~16자 (궁금하게).

[금지] 아내·남편·시어머니·며느리·손주 같은 집안 이야기, 효도·내복 같은 옛 정서, 병·죽음, 정치, 실존 유명인 비방, 특정 브랜드 비방.
[금지 낱말] 시니어, 어르신, 노인, 치매, 두뇌, 은퇴.
[말씨] 반듯한 아나운서. "~입니다/~대요/~답니다". 들뜬 톤·까부는 톤 금지. 한 조각은 1~3문장, 한 조각 60자 이내.
[길이] 전체를 소리 내어 읽어 60~70초 (한글 280~330자).
[표정] 조각마다 tag 하나: read(대본 읽기·담담) smile(미소) surprise(놀람) moved(뭉클·안타까움) laugh(웃음) talk(말 걸기) curious(궁금) secret(뜸 들이기) delight(감탄·기쁨) thumb(엄지·응원). read가 기본이고, 표정은 결정적인 조각에만.
[say와 cap] say는 소리 내어 읽을 글 — 숫자·영문 없이 한글로(1203호→천이백삼 호, 3주→삼 주). cap은 화면 자막 — 숫자 써도 됨, 한 줄 16자 안팎, 줄바꿈은 \\n, 조각이 길면 자막 덩어리 여러 개(배열).

JSON으로만 답하세요:
{{"title":"오늘의 한 조각 제목(10~16자)","greet":{{"morning":[{{"tag":"smile","say":"","cap":[""]}}, ...2개],"noon":[...],"evening":[...]}},
 "body":[{{"tag":"read","say":"","cap":["",""]}}, ...],"message":{{"tag":"talk","say":"","cap":[""]}},
 "close":{{"morning":{{"say":"","cap":[""]}},"noon":{{...}},"evening":{{...}}}},"next_title":""}}
'''
WD_THEME = {0: '한 주를 여는 문장', 1: '그해 오늘', 2: '오늘 쓸 만한 생활 요령', 3: '그 시절 노래 이야기',
            4: '이번 주말에 볼 만한 것', 5: '주말 아침의 가벼운 이야기', 6: '한 주를 닫는 차분한 이야기'}


def gemini_json(prompt):
    for m in pick('pro', ('gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'))[:4]:
        try:
            d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                     {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.9}}, 240)
            t = d['candidates'][0]['content']['parts'][0]['text']
            return json.loads(re.search(r'\{.*\}', t, re.S).group(0)), m
        except Exception as e:
            say('대본 실패', m, str(e)[:120]); time.sleep(5)
    return None, None

def problems(s):
    p = []
    try:
        for sl in SLOTS:
            if len(s['greet'][sl]) < 1: p.append('인사 없음 ' + sl)
            if not s['close'][sl]['say']: p.append('마무리 없음 ' + sl)
        if not (5 <= len(s['body']) <= 9): p.append(f"오늘의 한 조각 {len(s['body'])}개")
        segs = [x for sl in SLOTS for x in s['greet'][sl]] + s['body'] + [s['message']]
        for x in segs:
            if x.get('tag') not in TAGS: x['tag'] = 'read'
            if re.search(r'[0-9A-Za-z]', x['say']): p.append('읽을 글에 숫자/영문: ' + x['say'][:20])
            if not x.get('cap'): x['cap'] = [x['say']]
            if isinstance(x['cap'], str): x['cap'] = [x['cap']]
        alltext = json.dumps(s, ensure_ascii=False)
        for w in BAD:
            if w in alltext: p.append('금지 낱말 ' + w)
        if not s.get('next_title'): p.append('내일 제목 없음')
        
        n = sum(len(re.sub(r'[^가-힣]', '', x['say'])) for x in s['greet']['morning'] + s['body'] + [s['message']])
        if not (240 <= n <= 520): p.append(f'길이 {n}음절')
    except Exception as e:
        p.append('형식 ' + str(e)[:60])
    return p


def today_corners():
    """오늘 앱에 들어온 것들을 대본에 알려 준다 (인사 카드 글귀, 오늘의 한 권, 시사 상식, 한 끼 …)."""
    try:
        d = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'daily', DATE + '.json'), encoding='utf-8'))
    except Exception:
        return '오늘 들어온 것을 모르면 코너 이름만 담담히 알려 주세요 (오늘의 한 권, 오늘의 운세, 인사 카드 …).'
    out = []
    g = (d.get('greetings') or [])
    if g: out.append('오늘 인사 카드 글귀: ' + ' / '.join(x.replace('\n', ' ') for x in g[:3]))
    b = d.get('book') or {}
    if b.get('title'): out.append(f"오늘의 한 권: {b['title']} ({b.get('author','')})")
    q = d.get('quiz') or {}
    if q.get('term'): out.append('오늘의 시사 상식: ' + q['term'])
    m = d.get('meal') or {}
    if m.get('title'): out.append('오늘의 한 끼: ' + m['title'])
    mi = d.get('mind') or {}
    if mi.get('line'): out.append('오늘의 마음 한 줄: ' + mi['line'])
    return '오늘 오마주에 들어온 것 —\n' + '\n'.join('  · ' + x for x in out) if out else '오늘 들어온 것은 코너 이름만 담담히.'


def make_script():
    seed = json.load(open(os.path.join(os.path.dirname(__file__), 'opening_seed.json'))).get(DATE)
    if seed: say('준비해 둔 대본 사용'); return seed
    topic = prev_next_title()
    topic = f'어제 예고한 제목은 "{topic}" 입니다. 그 제목에 맞게 쓰세요.' if topic else '오늘 이야기는 자유롭게 정하세요.'
    theme = WD_THEME[D.weekday()]
    today_in = today_corners()
    desc = '45세 여성 아나운서, 반듯하고 품위 있는' if HOST == 'miso' else '46세 남성 아나운서, 반듯하고 신뢰감 있는'
    for k in range(3):
        s, m = gemini_json(PROMPT.format(name=NAME[HOST], desc=desc, date=DATE, wd=WD, topic=topic, recent=', '.join(recent_titles()) or '없음', theme=theme, today_in=today_in, other=NAME[OTHER]))
        if not s: continue
        p = problems(s)
        say('대본', m, '문제:', p or '없음')
        if not p: return s
    raise SystemExit('대본을 만들지 못함')

# ── 2) 목소리 ──
def tts(text, who):
    prompt = '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE[who] + '\n' + DIRECT + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + text
    for m in pick('tts', ('gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'))[:3]:
        for attempt in range(3):
            try:
                d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                         {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE[who]}}}}}, 300)
                pcm = base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
            except Exception as e:
                say('녹음 실패', m, attempt, str(e)[:80]); time.sleep(30 if '429' in str(e) else 5); continue
            ok, heard, ratio = check(KEY, pcm, text)
            say('녹음', m, round(len(pcm) / 48000, 1), '초 일치', ratio, '통과' if ok else '불일치 ' + heard[:40])
            if ok: return pcm
            time.sleep(10)
    return None

def wav_write(path, pcm):
    with wave.open(path, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)

def f0(pcm):
    import numpy as np
    x = np.frombuffer(pcm, np.int16).astype(float); sr = 24000; fr = 1024; out = []
    for i in range(0, len(x) - fr, fr * 2):
        s = x[i:i + fr]
        if np.sqrt((s ** 2).mean()) < 800: continue
        s = s - s.mean(); c = np.correlate(s, s, 'full')[fr - 1:]; lo, hi = sr // 400, sr // 70; k = lo + int(np.argmax(c[lo:hi]))
        if c[k] > 0.4 * c[0]: out.append(sr / k)
    return float(np.median(out)) if out else None

def split(pcm, lens):
    """문장 길이(음절 비례)에 맞는 쉼 자리를 순서대로 골라 각 조각의 시작 초를 돌려준다"""
    import numpy as np
    x = np.frombuffer(pcm, np.int16).astype(float); sr = 24000; T = len(x) / sr; hop = 240
    e = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)]); sil = e < 0.03 * e.max()
    runs = []; i = 0
    while i < len(sil):
        if sil[i]:
            j = i
            while j < len(sil) and sil[j]: j += 1
            if (j - i) * hop / sr >= 0.15 and i > 0 and j < len(sil): runs.append(((i + j) / 2 * hop / sr, (j - i) * hop / sr))
            i = j
        else: i += 1
    N = len(lens); pts = [0.0] + [r[0] for r in runs] + [T]; bon = [0] + [r[1] for r in runs] + [0]; P = len(pts); per = T / max(1, sum(lens))
    INF = 1e9; dp = [[INF] * P for _ in range(N + 1)]; bk = [[-1] * P for _ in range(N + 1)]; dp[0][0] = 0
    for k in range(1, N + 1):
        ed = lens[k - 1] * per
        for j in range(1, P):
            if (k == N) != (j == P - 1): continue
            for i in range(j):
                if dp[k - 1][i] >= INF: continue
                c = dp[k - 1][i] + abs(pts[j] - pts[i] - ed) / max(ed, 1.5) - (bon[j] * 1.5 if k < N else 0)
                if c < dp[k][j]: dp[k][j] = c; bk[k][j] = i
    j = P - 1; sel = []
    for k in range(N, 0, -1): i = bk[k][j]; sel.append(i); j = i
    return [0.0] + [round(pts[i], 2) for i in sel[::-1][1:]], round(T, 2)

def build():
    path = os.path.join(OUT, DATE + '.json')
    if os.path.exists(path) and not FORCE: say('이미 있음', DATE); return
    s = make_script()
    nt = (s.get('next_title') or '').strip()
    teaser = {'say': f'내일은 {NAME[OTHER]} 씨가 {nt} 이야기를 가져옵니다.' if nt else f'내일은 {NAME[OTHER]} 씨가 찾아옵니다.',
              'cap': [f'내일은 {NAME[OTHER]} 씨가\n{nt}'] if nt else [f'내일은 {NAME[OTHER]} 씨가\n찾아옵니다.'], 'tag': 'thumb'}
    # 마지막 사인오프 — 늘 같은 한 줄로 끝맺는다 (운영자 2026-10-18)
    sign = {'say': f'오마주, {NAME[HOST]}였습니다.', 'cap': [f'오마주, {NAME[HOST]}였습니다.'], 'tag': 'smile'}
    res = {'date': DATE, 'host': HOST, 'title': s.get('title', ''), 'next_title': s['next_title'], 'slots': {}}
    for sl in SLOTS:
        g = [dict(x) for x in s['greet'][sl]]
        g[0]['tag'] = 'wave'
        if len(g) > 1: g[1]['tag'] = 'stand'
        close = dict(s['close'][sl]); close.setdefault('tag', 'smile'); close['tag'] = 'smile'
        if isinstance(close.get('cap'), str): close['cap'] = [close['cap']]
        close.setdefault('cap', [close['say']])
        segs = g + s['body'] + [s['message'], close, teaser, sign]
        text = '\n'.join(x['say'] for x in segs)
        time.sleep(20)
        pcm = tts(text, HOST)
        if pcm is None: raise SystemExit('녹음 실패 ' + sl)
        raw = f'/tmp/op_{sl}.wav'; wav_write(raw, pcm)
        lens = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in segs]
        starts, T = split(pcm, lens)
        rate = sum(lens) / T; tempo = max(1.0, min(1.18, 4.8 / rate))   # 늘어지지 않게 (운영자 2026-10-18)
        af = []
        pf = f0(pcm); tgt = PITCH[HOST]
        if tgt and pf and abs(pf / tgt - 1) > 0.03:
            r = tgt / pf; af.append(f'asetrate={int(24000 * r)},aresample=24000'); tempo_eff = tempo / r
        else: tempo_eff = tempo
        af.append(f'atempo={tempo_eff:.4f}')
        mp3 = f'{DATE}-{sl}.mp3'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', ','.join(af), '-ac', '1', '-b:a', '64k', os.path.join(OUT, mp3)], check=True)
        res['slots'][sl] = {'audio': mp3, 'end': round(T / tempo, 2),
                            'segs': [{'t': round(st / tempo, 2), 'tag': x['tag'], 'cap': x['cap']} for st, x in zip(starts, segs)]}
        say(sl, '길이', round(T / tempo, 1), '빠르기', round(rate * tempo, 2), '높이', pf and round(pf), '→', tgt)
    json.dump(res, open(path, 'w'), ensure_ascii=False, indent=1)
    # 최근 5일만 남김
    keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(5)} | {(D + datetime.timedelta(days=1)).isoformat()}
    for f in os.listdir(OUT):
        if f[:10] not in keep: os.remove(os.path.join(OUT, f))
    say('완료', DATE, HOST)

try: build()
finally: open(os.path.join(MEDIA, 'last-opening.log'), 'w').write('\n'.join(LOG))
