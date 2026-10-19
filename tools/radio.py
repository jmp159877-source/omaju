# 장(章) 음성 안내 '읽어 드려요' — 장마다 오늘 올라온 것을 코너별로 읽어 주는 3~5분짜리.
# 오프닝과 같은 진행자·같은 틀을 쓴다(tools/opening.py 의 녹음·자르기 함수를 그대로 가져다 씀).
# 결과: MEDIA_DIR/radio/{날짜}-{장}.json, {날짜}-{장}.mp3  (media 가지, 최근 3일만)
# 쓰는 법: python3 tools/radio.py [YYYY-MM-DD] [--only=g1] [--force]
import os, sys, json, re, time, datetime, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('MEDIA_DIR', os.environ.get('MEDIA_DIR', 'media'))
import opening as OP   # 녹음(tts) · 높이(f0) · 쉼 자리 찾기(split) · 자르기(cut) · 묶기(merge)

KEY = os.environ['GEMINI_API_KEY']
MEDIA = os.environ.get('MEDIA_DIR', 'media')
OUT = os.path.join(MEDIA, 'radio')
os.makedirs(OUT, exist_ok=True)
KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORCE = '--force' in sys.argv
ONLY = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), None)
DATE = args[0] if args else datetime.datetime.now(KST).strftime('%Y-%m-%d')
D = datetime.date.fromisoformat(DATE)
WD = '월화수목금토일'[D.weekday()]
LOG = []


def say(*a):
    s = ' '.join(map(str, a)); print(s, flush=True); LOG.append(s)


# ── 장마다 누가 읽고 어떤 코너가 들어 있나 (화면 차례 그대로) ──
# 차례는 운영자가 정한 대로 (2026-10-20): 날씨 · 경제 · 인사말 카드를 먼저 가볍게 짚고,
# 코너로 들어갔다가, 오늘 PLAY 로 닫는다.
# 장 안내를 읽는 사람은 오프닝 진행자와 **다른 사람**이다 (운영자 2026-10-20).
# 오프닝은 미소·한결이 번갈아 맡고, 장마다 그 장을 맡은 진행자가 따로 있다.
HOSTS = {
    'eunchae': {
        'name': '송은채', 'voice': 'Callirrhoe', 'pitch': 210,
        'profile': ('[목소리 설정] 44세 한국 여성 방송 진행자. **밝고 또렷하고 기분 좋게 가볍다.** '
                    '아침에 좋은 것을 먼저 보고 와서 알려 주는 사람의 들뜨지 않은 생기가 있다. '
                    '친근하지만 또박또박하고, 말끝이 처지지 않는다. '
                    '**금지: 뉴스 앵커의 보도 말투, 심야 라디오의 낮고 차분한 톤, 느린 낭독조, 애교·콧소리.**'),
    },
}

CH = {
    'g1': {'host': 'eunchae', 'title': '오늘 즐기기',
           'corners': [('weather', '오늘의 날씨'), ('market', '오늘의 경제'), ('cards', '오늘의 인사말 카드'),
                       ('fortune', '오늘의 운세'), ('food', '오늘의 한 끼'), ('book', '오늘의 한 권'),
                       ('quiz', '오늘의 시사 상식'), ('culture', '오늘의 문화'), ('play', '오늘 PLAY')]},
}

# 배경 음악은 말 밑에 아주 낮게만 (오프닝보다 조용하게 — 4~5분을 듣는 것이라 피곤하면 안 된다)
LEAD, TAIL, TOP, BED = 1.2, 2.5, 0.22, 0.06

PROMPT = '''오늘은 {date}년 {wd}요일. 당신은 '오마주'의 진행자 {name}입니다.
'{title}' 장을 **눈으로 읽지 않고 귀로만 듣는 사람**에게 들려주는 음성 안내 대본을 씁니다.

[누가 듣나]
나이는 50~60이지만 생각과 생활은 40대인 사람. 설거지하면서, 산책하면서, 지하철에서 이어폰을 끼고 듣습니다.
화면을 보지 않을 수도 있습니다. 그러니 "여기 보시면" "아래에 있습니다" 같은 말을 쓰지 않습니다.

[무엇을 하나 — 가장 중요]
**목차를 읽어 주는 것이 아니라 방송을 하는 것입니다.**
나쁜 예: "오늘의 한 끼가 준비되어 있습니다. 눌러서 확인해 보세요."
좋은 예: "오늘 한 끼는 배추 겉절이 덮밥이에요. 배추를 센 불에 짧게 볶는 게 요령이라는데, 수분이 덜 나와서 아삭한 결이 산다고 하네요."
짧은 글(명언 같은 것)은 **그냥 읽어 주세요.** 긴 글은 알맹이를 간추려 들려주세요.
듣고 나면 "화면을 안 봐도 반은 들은 셈"이 되어야 합니다. 궁금한 사람만 눌러 보게.

[말씨]
부드러운 구어체 — "~예요 / ~죠 / ~거든요 / ~더라고요". "~입니다"로만 끝나는 보도 말투 금지.
친구나 동생 같은 사람이 옆에서 들려주듯. 들뜬 톤·까부는 톤·애교는 아닙니다.
시니어·어르신·노인·치매·두뇌·은퇴·건강관리 같은 말을 쓰지 않습니다. 나이를 들먹이지 않습니다.
집안 사연(아내·남편·시어머니·손주)이나 효도 같은 옛 정서로 몰지 않습니다.
느낌표를 쓰지 않습니다(읽을 때 음이 과하게 올라갑니다).

[길이]
- open: 장을 여는 인사 두세 문장. 오늘이 며칠 무슨 요일인지 한 번 짚고, 이 장에 무엇이 있는지 한 줄로.
- items: 아래 코너 차례 그대로, 하나도 빠뜨리지 말고 하나씩. **코너마다 220~300자** (네 문장에서 여섯 문장).
- close: 닫는 인사 한두 문장. 다 듣고 나서 "아, 오늘 볼 만하네" 싶게. 사인오프는 쓰지 않습니다.
전체가 4분 30초에서 6분 사이가 되게.

[꼭 지킬 것 — 지어내지 않기]
아래 '오늘 들어온 것'에 적힌 것만 가지고 씁니다. 거기 없는 책·퀴즈·요리·명언을 **절대 지어내지 마세요.**
제목·이름·숫자는 적힌 그대로 씁니다. 내용이 모자라면 짧게 쓰되, 없는 것을 채워 넣지 않습니다.

[오늘 이 장에 들어온 것]
{material}

형식(JSON만, 다른 말 없이):
{{"open":"...","items":[{{"k":"코너열쇠","say":"..."}}, ...],"close":"..."}}
items 의 k 는 반드시 다음에서 차례대로: {keys}'''


from models import pick

# 오프닝과 **같은 사람**으로 들려야 한다 (운영자 2026-10-20: "오프닝 미소와 읽어 드려요 미소가 서로 다르다").
# 그래서 ① 목소리 설정은 오프닝 것을 그대로 쓰고 ② 연출만 이 코너에 맞게 바꾸고
# ③ 모델을 오프닝과 같은 것 하나로 고정한다(모델이 다르면 같은 목소리 이름이어도 사람이 바뀐다).
DIRECT = ('[연출] 아침 라디오의 코너 안내. 이 장을 맡은 진행자가 오늘 들어온 것을 하나씩 짚어 준다. '
          '**처음부터 끝까지 같은 밝기·같은 기운·같은 빠르기를 유지한다.** 길다고 뒤로 갈수록 가라앉히거나 느려지지 말 것. '
          '듣는 사람은 설거지를 하거나 길을 걷고 있다. 옆에서 조곤조곤 알려 주듯, 또렷하고 편안하게. '
          '코너가 바뀔 때는 숨을 한 번 두고 넘어간다. 좋은 것을 먼저 알게 된 사람이 권하듯 가볍게. '
          '**금지: 뉴스 앵커의 보도 말투, 낭독조, 심야 라디오처럼 낮게 깔기, 느린 설명조, 호들갑·애교.** '
          '느낌표처럼 끝을 치켜올리지 말고, 문장 끝을 부드럽게 내려놓는다.')


def tts(text, who):
    """오프닝과 같은 모델·같은 목소리 설정으로 녹음한다. 모델이 바뀌면 사람이 바뀐다."""
    ms = pick('tts', ('gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'))
    m = ms[0] if ms else 'gemini-3.1-flash-tts-preview'
    prompt = '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + HOSTS[who]['profile'] + '\n' + DIRECT + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + text
    for attempt in range(4):
        try:
            d = OP.post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                        {'contents': [{'parts': [{'text': prompt}]}],
                         'generationConfig': {'responseModalities': ['AUDIO'],
                                              'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': HOSTS[who]['voice']}}}}}, 420)
            import base64
            pcm = base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
        except Exception as e:
            say('녹음 실패', m, attempt, str(e)[:80]); time.sleep(30 if '429' in str(e) else 8); continue
        from voice_check import check
        ok, heard, ratio = check(KEY, pcm, text)
        say('녹음', m, round(len(pcm) / 48000, 1), '초 일치', ratio, '통과' if ok else '불일치 ' + heard[:40])
        if ok: return pcm
        time.sleep(8)
    return None



def gemini_json(prompt):
    for m in pick('pro')[:3]:
        try:
            d = OP.post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                        {'contents': [{'parts': [{'text': prompt}]}],
                         'generationConfig': {'responseMimeType': 'application/json', 'temperature': 1.0}}, 300)
            t = d['candidates'][0]['content']['parts'][0]['text']
            return json.loads(t), m
        except Exception as e:
            say('대본 실패', m, str(e)[:100]); time.sleep(5)
    return None, None


def daily():
    try:
        return json.load(open(os.path.join(ROOT, 'daily', DATE + '.json'), encoding='utf-8'))
    except Exception:
        return {}


def weather_line():
    """오늘 서울(강남) 날씨 — 하루치 예보. 못 받아 오면 날씨 칸은 빼고 간다."""
    try:
        u = ('https://api.open-meteo.com/v1/forecast?latitude=37.4979&longitude=127.0276'
             '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
             '&timezone=Asia%2FSeoul&forecast_days=1')
        import urllib.request
        with urllib.request.urlopen(u, timeout=30) as r:
            j = json.load(r)['daily']
        code = int(j['weather_code'][0])
        sky = ('맑음' if code == 0 else '대체로 맑음' if code in (1, 2) else '흐림' if code == 3
               else '안개' if code in (45, 48) else '비' if 51 <= code <= 67 or 80 <= code <= 82
               else '눈' if 71 <= code <= 77 or code in (85, 86) else '비바람' if code >= 95 else '흐림')
        hi, lo = round(j['temperature_2m_max'][0]), round(j['temperature_2m_min'][0])
        rain = int(j['precipitation_probability_max'][0] or 0)
        return (f'· 오늘 서울 강남 날씨: {sky}, 낮 최고 {hi}도 아침 최저 {lo}도, 비 올 가능성 {rain}퍼센트. '
                f'(하루 사이 {hi - lo}도 차이) — 숫자를 다 늘어놓지 말고, 아침저녁 기온 차나 걸칠 것 하나 챙기시라는 '
                '식으로 생활에 쓸 말로 바꿔 주세요. 서울 기준이라는 것은 한 번 짚어 주세요.')
    except Exception as e:
        say('날씨 못 받아옴', str(e)[:60]); return ''


def material_g1(d):
    """g1 대본에 넣어 줄 오늘 내용. 하루 종일 바뀌는 것(순위·날씨·시세)은 넣지 않는다."""
    out = []
    w = weather_line()
    if w: out.append(w)
    out.append('· 오늘의 경제: 환율(달러·엔·유로), 코스피·코스닥, 금·은, 비트코인 시세가 날마다 올라온다. '
               '시세는 하루 종일 바뀌므로 **숫자는 하나도 말하지 말 것.** '
               '"관심 있는 것 참고하셔서 오늘 경제 활동에 도움이 되시면 좋겠다"는 정도로 가볍게 한두 문장.')
    g = [x.replace('\n', ' ').strip() for x in (d.get('greetings') or []) if x]
    if g:
        out.append('· 오늘의 인사말 카드 글귀 (이 가운데 하나를 골라 그대로 읽어 주고, 참 예쁜 말이라고 한마디 덧붙인 뒤, '
                   '마음에 드는 카드를 눌러 카톡으로 보내면 그 마음이 그대로 간다고 안내해 주세요):\n'
                   + '\n'.join('   - ' + x for x in g[:4]))
    f = d.get('fortune') or {}
    if f:
        have = [(z, v) for z, v in f.items() if isinstance(v, dict) and v.get('total')]
        off = D.toordinal() % max(1, len(have))
        picks = [have[(off + i) % len(have)] for i in range(min(3, len(have)))]   # 날마다 다른 띠가 걸리게
        out.append('· 오늘의 운세 (열두 띠 모두 있음. 이 가운데 두세 띠만 골라 맛보기로 들려주고, 나머지는 "나머지 띠도 다 있어요" 로):\n'
                   + '\n'.join(f'   - {z}띠: {v["total"]}' for z, v in picks))
    m = d.get('meal') or {}
    if m.get('title'):
        out.append(f'· 오늘의 한 끼: {m["title"]} — {m.get("sub","")}\n   소개: {m.get("lead","")}\n'
                   f'   재료: {", ".join(m.get("ingredients", [])[:8])}\n   요령: {m.get("tip","")}')
    b = d.get('book') or {}
    if b.get('title'):
        out.append(f'· 오늘의 한 권: 《{b["title"]}》 {b.get("author","")} ({b.get("kind","")})\n'
                   f'   어떤 책: {b.get("blurb","")}\n   이런 날 읽기 좋다: {b.get("why","")}')
    q = d.get('quiz') or {}
    if q.get('term'):
        out.append(f'· 오늘의 시사 상식: {q["term"]} — {q.get("meaning","")}\n   왜 나왔나: {q.get("why","")}\n'
                   f'   (확인 문제는 화면에서 풀게 두고, 문제와 정답은 말하지 말 것)')
    c = d.get('culture') or {}
    cu = []
    p = c.get('poem') or {}
    if p.get('title'):
        cu.append(f'시: 〈{p["title"]}〉 {p.get("author","")} — {p.get("note","") or p.get("bg","")} '
                  '(※ 시 본문을 통째로 읽지 말고, 제목과 지은이, 어떤 시인지만 들려줄 것)')
    qt = c.get('quote') or {}
    if qt.get('text'):
        cu.append(f'명언: "{qt["text"]}" — {qt.get("who","")} (짧으니 그대로 읽어 줄 것)')
    h = c.get('humor') or {}
    if h.get('text'):
        cu.append(f'유머({h.get("kind","")}): {h["text"]} / 뒤집는 말: {h.get("punch","")} (라디오니까 끝까지 들려줘도 좋다)')
    e = c.get('essay') or {}
    if e.get('title'):
        cu.append(f'에세이: 〈{e["title"]}〉 — {(e.get("paras") or [""])[0][:120]}')
    pa = c.get('painting') or {}
    if pa.get('title'):
        cu.append(f'그림: 〈{pa["title"]}〉 {pa.get("artist","")} — {(pa.get("about") or "")[:120]} (그림은 눈으로 봐야 하니 보러 오라고 권할 것)')
    if cu:
        out.append('· 오늘의 문화 (여러 갈래가 있다. 전부 늘어놓지 말고 두세 가지를 골라 들려줄 것):\n'
                   + '\n'.join('   - ' + x for x in cu))
    out.append('· 오늘 PLAY (맨 마지막 코너): 말모이 · 사천성 · 1 to 50 · 스도쿠 네 가지. 날마다 순위가 새로 열린다. '
               '(순위 1등 이름은 하루 종일 바뀌므로 말하지 말 것 — "오늘 순위도 새로 열렸어요" 정도로)')
    return '\n'.join(out)


BAD = ['시니어', '어르신', '노인', '치매', '두뇌', '은퇴', '손주', '손자', '시어머니', '며느리', '효도', '내복']


def problems(s, keys):
    p = []
    try:
        if not s.get('open') or not s.get('close'): p.append('여는 말/닫는 말 없음')
        got = [x['k'] for x in s['items']]
        if got != keys: p.append(f'코너 차례가 다름 {got}')
        for x in s['items']:
            n = len(re.sub(r'\s', '', x['say']))
            if n < 170: p.append(f'{x["k"]} 너무 짧음 {n}자')
            if n > 460: p.append(f'{x["k"]} 너무 긺 {n}자')
        whole = s['open'] + ' '.join(x['say'] for x in s['items']) + s['close']
        for w in BAD:
            if w in whole: p.append('쓰지 않기로 한 말: ' + w)
        if '!' in whole: p.append('느낌표')
        if re.search(r'(아래|여기|화면 아래|밑에) (있|보)', whole): p.append('눈으로 보는 사람에게 하는 말')
        tot = len(re.sub(r'[^가-힣]', '', whole))
        if not (1250 <= tot <= 1950): p.append(f'전체 길이 {tot}자 (4분 30초~6분이 되게)')
    except Exception as e:
        p.append('형식 ' + str(e)[:60])
    return p


def make_script(ch):
    c = CH[ch]; d = daily()
    keys = [k for k, _ in c['corners']]
    need = [k for k in ('fortune', 'meal', 'book', 'quiz', 'culture') if not d.get(k)]
    if need:
        raise SystemExit('오늘 내용이 아직 덜 들어왔음 — ' + ', '.join(need))   # 없는 것을 지어내지 않는다
    mat = material_g1(d) if ch == 'g1' else ''
    if not mat.strip():
        raise SystemExit('오늘 내용이 아직 없음')
    for k in range(3):
        s, m = gemini_json(PROMPT.format(date=DATE, wd=WD, name=HOSTS[c['host']]['name'], title=c['title'],
                                         material=mat, keys=', '.join(keys)))
        if not s: continue
        p = problems(s, keys)
        say('대본', m, '문제:', p or '없음')
        if not p: return s
    raise SystemExit('대본을 만들지 못함')


def music(mp3, dur):
    """말 밑에 아주 낮게 음악을 깐다. 없으면 말소리만."""
    src = os.path.join(ROOT, 'music', 'morning.mp3')
    if not os.path.exists(src): return 0.0, 0.0
    total = LEAD + dur + TAIL
    out = mp3 + '.mix.mp3'
    vol = (f"volume='if(lt(t,{LEAD - 0.4:.2f}),{TOP},"
           f"if(lt(t,{LEAD + 0.6:.2f}),{TOP}-{TOP - BED:.4f}*(t-{LEAD - 0.4:.2f}),{BED}))':eval=frame")
    fc = (f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(LEAD * 1000)}:all=1[v];"
          f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:{total:.2f},asetpts=N/SR/TB,{vol},"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st={total - TAIL:.2f}:d={TAIL}[m];"
          f"[v][m]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]")
    try:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-stream_loop', '-1', '-i', src,
                        '-filter_complex', fc, '-map', '[a]', '-ac', '2', '-ar', '44100', '-b:a', '96k', out], check=True)
    except Exception as e:
        say('음악 실패 — 말소리만', str(e)[:80]); return 0.0, 0.0
    os.replace(out, mp3)
    return LEAD, TAIL


def build(ch):
    path = os.path.join(OUT, f'{DATE}-{ch}.json')
    if os.path.exists(path) and not FORCE: say('이미 있음', ch); return
    c = CH[ch]; host = c['host']
    s = make_script(ch)
    segs = [{'k': 'open', 'say': s['open']}] + [{'k': x['k'], 'say': x['say']} for x in s['items']] + [{'k': 'close', 'say': s['close']}]
    text = '\n'.join(x['say'] for x in segs)

    tgt0 = HOSTS[host]['pitch']; best = None
    for take in range(5):
        if take: time.sleep(15)
        got = tts(text, host)
        if got is None: continue
        gf = OP.f0(got)
        off = abs(gf / tgt0 - 1) if (tgt0 and gf) else 0
        say(f'{take + 1}번째 녹음 높이', gf and round(gf), '기준', tgt0, '벗어남', round(off * 100, 1), '%')
        if best is None or off < best[1]: best = (got, off)
        if off <= 0.04: break
    if best is None: raise SystemExit('녹음 실패')
    pcm = best[0]

    lens = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in segs]
    starts, T = OP.split(pcm, lens)
    rate = sum(lens) / T; tempo = max(0.80, min(1.18, 4.8 / rate))   # 듣는 것이라 빠르면 늦춘다 (4.8음절/초)
    pf = OP.f0(pcm); tgt = tgt0
    # 끌어내리는 것은 5%까지, 올리는 것은 10%까지 (그 이상 당기면 목청이 바뀌어 다른 사람이 된다).
    # 많이 벗어났다고 그냥 두면 날마다 딴 사람이 되므로, 할 수 있는 만큼은 끌어당긴다.
    if pf and tgt:
        cap = 0.05 if pf > tgt else 0.10
        lo, hi = pf * (1 - cap), pf * (1 + cap)
        tgt = min(max(tgt, lo), hi)
    af = []
    if tgt and pf and abs(pf / tgt - 1) > 0.02:
        r = tgt / pf; af.append(f'asetrate={int(24000 * r)},aresample=24000'); tempo_eff = tempo / r
    else: tempo_eff = tempo
    af.append(f'atempo={tempo_eff:.4f}')
    raw = f'/tmp/rd_{ch}.wav'; OP.wav_write(raw, pcm)
    mp3 = f'{DATE}-{ch}.mp3'; dst = os.path.join(OUT, mp3)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', ','.join(af),
                    '-ac', '1', '-b:a', '64k', dst], check=True)
    edge = [st / tempo for st in starts] + [T / tempo]
    dur = edge[-1]
    lead, tail = music(dst, dur)
    marks = [{'t': round(edge[i] + lead, 2), 'k': segs[i]['k'], 'say': segs[i]['say']} for i in range(len(segs))]
    res = {'date': DATE, 'ch': ch, 'host': host, 'name': HOSTS[host]['name'], 'title': c['title'],
           'audio': mp3, 'end': round(lead + dur + tail, 2),
           'built': datetime.datetime.now(KST).strftime('%m%d%H%M'), 'marks': marks}
    json.dump(res, open(path, 'w'), ensure_ascii=False, indent=1)
    say('완료', ch, round(lead + dur + tail, 1), '초', '빠르기', round(rate * tempo, 2),
        '높이', pf and round(pf), '→', tgt and round(tgt))


def main():
    for ch in (ONLY or list(CH)):
        if ch not in CH: continue
        try: build(ch)
        except SystemExit as e: say('그만둠', ch, e)
    keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(3)}
    for f in os.listdir(OUT):
        if f[:10] not in keep:
            os.remove(os.path.join(OUT, f))


try:
    main()
finally:
    open(os.path.join(MEDIA, 'last-radio.log'), 'w').write('\n'.join(LOG))
