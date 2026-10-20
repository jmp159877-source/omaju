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
        # 미소가 밝으니 은채는 차분한 쪽으로 — 둘 다 밝으면 너무 들떠 보이고 구분도 안 된다 (운영자 2026-10-20)
        'name': '송은채', 'voice': 'Callirrhoe', 'pitch': 196,
        'profile': ('[목소리 설정] 44세 한국 여성 방송 진행자. **낮고 차분하고 따뜻하다.** 미소보다 반 톤 낮은, 가라앉은 목소리다. 들뜨지 않고 서두르지 않으며, 옆에 앉아 조곤조곤 일러 주듯 이야기한다. 또렷하고 말끝이 처지지 않되 음을 높이 올리지 않는다. **금지: 들뜬 톤, 음을 치켜올리는 말끝, 애교·콧소리, 뉴스 앵커의 보도 말투, 느린 낭독조.**'),
    },
    'hangyeol': {
        # 그때 돌아보기는 남자 진행자 — 포근하고 다정다감하게 (운영자 2026-10-20)
        'name': '서한결', 'voice': 'Charon', 'pitch': None,
        'profile': ('[목소리 설정] 45세 한국 남성 방송 진행자. **포근하고 다정다감하다.** 옛날 이야기를 꺼내 놓듯 천천히, '
                    '그러나 처지지 않게 이야기한다. 듣는 사람에게 친구나 동생 같은 사람이다. '
                    '**금지: 뉴스 앵커의 보도 말투, 들뜬 톤, 까부는 톤, 느린 낭독조, 과장된 감탄.**'),
    },
}

# 장마다 어떤 코너가 들어 있나 — 화면 차례 그대로.
# 'need' 는 그날 daily JSON 에 반드시 있어야 하는 것. 없으면 만들지 않고 다음 시각에 다시 돈다
# (없는 것을 AI 가 지어내면 화면과 다른 말이 나간다 — 운영자 2026-10-20).
CH = {
    'g1': {'host': 'eunchae', 'title': '오늘 즐기기', 'need': ('fortune', 'meal', 'book', 'quiz', 'culture'),
           'corners': [('weather', '오늘의 날씨'), ('market', '오늘의 경제'), ('cards', '오늘의 인사말 카드'),
                       ('fortune', '오늘의 운세'), ('food', '오늘의 한 끼'), ('book', '오늘의 한 권'),
                       ('quiz', '오늘의 시사 상식'), ('culture', '오늘의 문화'), ('play', '오늘 PLAY')]},
    'g2': {'host': 'hangyeol', 'title': '그때 돌아보기', 'need': ('era', 'story'),
           'corners': [('history', '그해 오늘'), ('music', '그 시절 노래'),
                       ('story', '그날의 사연'), ('home', '그 동네 지금')]},
    'g5': {'host': 'eunchae', 'title': '앞으로 나아가기', 'need': ('follow', 'phrase'),
           'corners': [('follow', '오늘의 따라하기'), ('outing', '오늘의 나들이'),
                       ('show', '이번 주, 무엇을 볼까'), ('phrase', '여행')]},
    'g3': {'host': 'eunchae', 'title': '나를 돌보기', 'need': ('mind', 'body', 'follow'),
           'corners': [('hike', '오늘의 산'), ('move', '오늘의 몸 풀기'),
                       ('mind', '오늘의 마음 한 줄'), ('body', '오늘의 몸 한 가지')]},
}

# 배경 음악은 말 밑에 아주 낮게만 (오프닝보다 조용하게 — 4~5분을 듣는 것이라 피곤하면 안 된다)
LEAD, TAIL, TOP, BED = 1.2, 2.5, 0.22, 0.06
SWELL = 0.14   # 이음매에서 음악이 잠깐 올라오는 크기 (코너가 바뀐다는 신호)

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
- items: 아래 코너 차례 그대로, 하나도 빠뜨리지 말고 하나씩. **코너마다 {lo}~{hi}자**.
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


def _wk(path, key):
    """주마다 바뀌는 것(산·나들이·무엇을 볼까)은 data/ 에서 읽는다. 지역이 여럿이면 첫 지역만."""
    try:
        d = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    except Exception:
        return None
    rg = d.get('regions') or {}
    if isinstance(rg, dict) and rg:
        first = next(iter(rg.values()))
        return {'week': d.get('week'), 'items': first if isinstance(first, list) else (first or {}).get(key) or []}
    return {'week': d.get('week'), 'items': d.get(key) or []}


def material_g2(d):
    """그때 돌아보기 — 그해 오늘 · 그 시절 노래 · 그날의 사연 · 그 동네 지금."""
    out = []
    era = d.get('era') or {}
    ago = '40' if '40' in era else (sorted(era, key=lambda x: -int(x))[0] if era else None)
    e = era.get(ago) or {}
    if e:
        yr = D.year - int(ago)
        facts = e.get('facts') or []
        out.append(f'· 그해 오늘 ({yr}년, {ago}년 전): 그때 분위기 — {e.get("mood","")}\n'
                   + '\n'.join(f'   - {x[0]}: {x[1]}' for x in facts[:3] if isinstance(x, (list, tuple)) and len(x) >= 2)
                   + f'\n   (화면에서는 10·20·30·40·50년 전을 골라 볼 수 있다는 것도 한 번 짚어 주세요. '
                     f'그날의 신문과 그해 그곳 사진도 함께 있습니다.)')
        songs = e.get('songs') or []
        if songs:
            out.append(f'· 그 시절 노래 ({yr}년에 사랑받은 노래. 제목과 가수만 서너 곡 불러 주고, '
                       '화면에서 눌러 들으실 수 있다고 안내. 노래를 설명하려 들지 말 것):\n'
                       + '\n'.join(f'   - {x[0]} / {x[1]}' for x in songs[:5] if isinstance(x, (list, tuple)) and len(x) >= 2))
    st = d.get('story') or {}
    if st.get('title'):
        first = (st.get('paras') or [''])[0]
        out.append(f'· 그날의 사연: 〈{st["title"]}〉 {st.get("sub","")}\n   첫 대목: {first[:160]}\n'
                   '   (오마주가 엮은 이야기입니다. 실제 독자가 보낸 사연인 것처럼 말하지 말 것. '
                   '어떤 이야기인지 맛만 보여 주고 읽어 보시라고 권하세요.)')
    out.append('· 그 동네 지금: 살던 동네나 고향 주소를 말로 넣으면 지금 그 길을 그대로 보여 준다. '
               '길 건너 가게가 아직 있는지, 골목이 어떻게 바뀌었는지 둘러볼 수 있다. '
               '(날마다 바뀌는 내용이 아니라 언제든 쓰는 칸이니, 한 번 해 보시라고 권하는 정도로 짧게)')
    return '\n'.join(out)


def material_g5(d):
    """앞으로 나아가기 — 따라하기 · 나들이 · 무엇을 볼까 · 여행."""
    out = []
    f = d.get('follow') or {}
    fo = [(k, f[k]) for k in ('sing', 'dance', 'golf', 'park') if isinstance(f.get(k), dict) and f[k].get('title')]
    if fo:
        out.append('· 오늘의 따라하기 (노래 교실 · 댄스 · 골프 · 파크골프. 날마다 영상이 하나씩 새로 걸린다. '
                   '유튜브 제목을 그대로 읽지 말고 무엇을 배우는 것인지로 풀어 주세요):\n'
                   + '\n'.join(f'   - {v.get("name", k)}: {v.get("title","")} / 한마디: {v.get("say","")}' for k, v in fo))
    ot = _wk('data/outing.json', 'items')
    if ot and ot['items']:
        it = ot['items'][:3]
        out.append('· 오늘의 나들이 (이번 주 가 볼 만한 곳. 지역을 골라 볼 수 있다):\n'
                   + '\n'.join(f'   - {x.get("title","")} ({x.get("where","")}, {x.get("when","")}) — {x.get("why","")}'
                                for x in it if isinstance(x, dict)))
    sh = _wk('data/shows.json', 'items')
    if sh and sh['items']:
        out.append('· 이번 주, 무엇을 볼까 (극장·무대·전시):\n'
                   + '\n'.join(f'   - {x.get("title","")} ({x.get("where","")}, {x.get("when","")}) — {x.get("why","")}'
                                for x in sh['items'][:3] if isinstance(x, dict)))
    ph = d.get('phrase') or {}
    if ph.get('topic'):
        bits = [f'{nm} "{ph[k]}"' for k, nm in (('en', '영어'), ('ja', '일본어'), ('zh', '중국어')) if ph.get(k)]
        out.append(f'· 여행 (해외 골프 · 해외 관광 · 자유여행 · 회화 네 칸). 오늘 회화 주제는 "{ph["topic"]}" — '
                   + ' , '.join(bits[:2]) + ' (한 마디만 또렷하게 들려주고, 나머지는 화면에서 들어 보시라고)')
    else:
        out.append('· 여행: 해외 골프 · 해외 관광 · 자유여행 · 회화 네 칸이 있다. 짧게 안내만.')
    return '\n'.join(out)


def material_g3(d):
    """나를 돌보기 — 오늘의 산 · 몸 풀기 · 마음 한 줄 · 몸 한 가지."""
    out = []
    hk = _wk('data/hike.json', 'items')
    if hk and hk['items']:
        it = [x for x in hk['items'][:2] if isinstance(x, dict)]
        out.append('· 오늘의 산 (이번 주 걷기 좋은 산길. 지역을 골라 볼 수 있다):\n'
                   + '\n'.join(f'   - {x.get("title","")} ({x.get("where","")}, {x.get("course","")} {x.get("hours","")})'
                                f' — {x.get("why","")} / 몸 챙기는 요령: {x.get("care","")}' for x in it))
    f = d.get('follow') or {}
    mv = [(k, f[k]) for k in ('gym', 'meditate') if isinstance(f.get(k), dict) and f[k].get('title')]
    if mv:
        out.append('· 오늘의 몸 풀기 (아침 체조 · 요가와 명상. 날마다 영상이 새로 걸린다):\n'
                   + '\n'.join(f'   - {v.get("name", k)}: {v.get("title","")} / 한마디: {v.get("say","")}' for k, v in mv))
    mn = d.get('mind') or {}
    if mn.get('line'):
        out.append(f'· 오늘의 마음 한 줄: "{mn["line"]}" {("— " + mn["by"]) if mn.get("by") else ""}\n'
                   f'   풀이: {mn.get("note","")}\n   해 볼 것: {mn.get("todo","")}\n'
                   '   (짧으니 한 줄은 그대로 읽어 주세요)')
    bd = d.get('body') or {}
    if bd.get('line'):
        out.append(f'· 오늘의 몸 한 가지 ({bd.get("part","")}): {bd["line"]}\n   풀이: {bd.get("note","")}\n'
                   f'   요령: {bd.get("tip","")}\n   오늘 해 볼 것: {bd.get("todo","")}\n'
                   '   (겁주지 말 것. 병 이름·진단·처방 이야기 금지.)')
    return '\n'.join(out)


MATERIAL = {'g1': material_g1, 'g2': material_g2, 'g5': material_g5, 'g3': material_g3}


BAD = ['시니어', '어르신', '노인', '치매', '두뇌', '은퇴', '손주', '손자', '시어머니', '며느리', '효도', '내복']


def problems(s, keys):
    p = []
    cap = min(480, max(360, int(1550 / max(1, len(keys)) * 1.30)))
    try:
        if not s.get('open') or not s.get('close'): p.append('여는 말/닫는 말 없음')
        got = [x['k'] for x in s['items']]
        if got != keys: p.append(f'코너 차례가 다름 {got}')
        for x in s['items']:
            n = len(re.sub(r'\s', '', x['say']))
            if n < 170: p.append(f'{x["k"]} 너무 짧음 {n}자')
            if n > cap: p.append(f'{x["k"]} 너무 긺 {n}자')
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
    need = [k for k in c.get('need', ()) if not d.get(k)]
    if need:
        raise SystemExit('오늘 내용이 아직 덜 들어왔음 — ' + ', '.join(need))   # 없는 것을 지어내지 않는다
    mat = MATERIAL[ch](d)
    if not mat.strip():
        raise SystemExit('오늘 내용이 아직 없음')
    for k in range(3):
        # 장마다 코너 수가 다르다(9개도 있고 4개도 있다). 전체 4분 30초~6분을 맞추려면
        # 코너가 적은 장은 코너마다 더 길게 이야기해야 한다 (운영자 규칙: 장당 4분 30초~6분).
        per = 1550 / max(1, len(keys))
        lo = min(340, max(170, int(per * 0.80) // 10 * 10))
        hi = min(460, max(lo + 60, int(per * 1.15) // 10 * 10))
        s, m = gemini_json(PROMPT.format(date=DATE, wd=WD, name=HOSTS[c['host']]['name'], title=c['title'],
                                         material=mat, keys=', '.join(keys), lo=lo, hi=hi))
        if not s: continue
        p = problems(s, keys)
        say('대본', m, '문제:', p or '없음')
        if not p: return s
    raise SystemExit('대본을 만들지 못함')


def music(mp3, dur, seams=()):
    """말 밑에 아주 낮게 음악을 깐다. 없으면 말소리만.

    seams: 토막이 이어 붙은 시각(초). 거기서 음악을 잠깐 올렸다 내린다 —
    라디오가 꼭지를 바꿀 때 하는 것. 톤이 조금 달라져도 '다음 꼭지'로 들리지 '다른 사람'으로 안 들린다.
    """
    src = os.path.join(ROOT, 'music', 'morning.mp3')
    if not os.path.exists(src): return 0.0, 0.0
    total = LEAD + dur + TAIL
    out = mp3 + '.mix.mp3'
    # 이음매마다 삼각형으로 솟았다 내려오는 덧음량(1.6초 폭). 뚝 끊기지 않아 '뚝' 소리가 안 난다.
    bump = ''.join(rf"+{SWELL}*max(0\,1-abs(t-{t:.2f})/0.8)" for t in seams)
    bed = f"({BED}{bump})" if bump else f"{BED}"
    vol = (f"volume='if(lt(t,{LEAD - 0.4:.2f}),{TOP},"
           f"if(lt(t,{LEAD + 0.6:.2f}),{TOP}-{TOP - BED:.4f}*(t-{LEAD - 0.4:.2f}),{bed}))':eval=frame")
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


def deslide(pcm):
    """한 토막 안에서 뒤로 갈수록 작아지는 것을 되돌린다 (TTS 가 길어지면 목소리를 흘린다).
    자연스러운 높낮이는 두고, **처음부터 끝까지의 기울기만** 편다. 최대 ±4dB."""
    import numpy as np
    x = np.frombuffer(pcm, dtype='<i2').astype('float32')
    if x.size < 48000: return pcm
    w = 12000                                   # 0.5초씩 재서
    n = x.size // w
    e = np.array([np.sqrt((x[i * w:(i + 1) * w] ** 2).mean()) + 1e-6 for i in range(n)])
    keep = e > (e.max() * 0.12)                 # 쉬는 구간은 빼고
    if keep.sum() < 6: return pcm
    t = np.arange(n)[keep]
    db = 20 * np.log10(e[keep])
    a, b = np.polyfit(t, db, 1)                 # 기울기 a dB/0.5초
    drop = a * (n - 1)                          # 처음→끝 변화량(dB)
    if abs(drop) < 1.0: return pcm              # 1dB 안쪽이면 그대로
    fix = -max(-4.0, min(4.0, drop))            # 되돌릴 양
    ramp = np.linspace(0, fix, x.size)
    y = x * (10 ** (ramp / 20))
    return np.clip(y, -32000, 32000).astype('<i2').tobytes()


def rms(pcm):
    import numpy as np
    x = np.frombuffer(pcm, dtype='<i2').astype('float32')
    x = x[np.abs(x) > 300]          # 쉬는 구간은 빼고 말하는 대목만
    return float(np.sqrt((x * x).mean())) if x.size else 0.0


def regain(pcm, g):
    """토막 음량만 올리고 내린다. 5% 안쪽이면 손대지 않는다."""
    import numpy as np
    if abs(g - 1) <= 0.05: return pcm
    g = max(0.7, min(1.45, g))
    x = np.frombuffer(pcm, dtype='<i2').astype('float32') * g
    return np.clip(x, -32000, 32000).astype('<i2').tobytes()


def repitch(pcm, f, tgt):
    """토막 하나의 높이만 옮긴다(길이는 그대로). 2% 안쪽이면 손대지 않는다."""
    if not f or not tgt or abs(f / tgt - 1) <= 0.02: return pcm
    r = tgt / f
    p = '/tmp/rd_chunk.wav'; OP.wav_write(p, pcm)
    out = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p,
                          '-af', f'asetrate={int(24000 * r)},aresample=24000,atempo={1 / r:.4f}',
                          '-f', 's16le', '-ac', '1', '-ar', '24000', '-'],
                         capture_output=True).stdout
    return out or pcm


def build(chs):
    """장 하나 또는 여럿을 만든다.

    **같은 진행자가 맡은 장은 한 번에 읽히고 토막내어 나눈다** (운영자 2026-10-20 'AI 한도 아끼기').
    녹음을 장마다 따로 하면 같은 목소리로 시켜도 높이가 제각각 나와 장마다 딴 사람이 된다.
    한 번에 읽히면 녹음 횟수도 줄고 덤으로 장들의 목소리가 완전히 같아진다.
    """
    if isinstance(chs, str): chs = [chs]
    chs = [c for c in chs if FORCE or not os.path.exists(os.path.join(OUT, f'{DATE}-{c}.json'))]
    if not chs: return
    host = CH[chs[0]]['host']
    segs, spans = [], {}
    for ch in chs:
        s = make_script(ch)
        a = len(segs)
        segs += ([{'k': 'open', 'say': s['open']}]
                 + [{'k': x['k'], 'say': x['say']} for x in s['items']]
                 + [{'k': 'close', 'say': s['close']}])
        spans[ch] = (a, len(segs))
    text = '\n'.join(x['say'] for x in segs)

    tgt0 = HOSTS[host]['pitch']
    say('함께 만드는 장', ', '.join(chs))
    say('대본', len(re.sub(r'[^가-힣]', '', text)), '자 ·', len(segs), '토막')

    # 대본이 길면 한 번에 못 읽는다 — 응답이 비거나(400/빈 candidate) 끝까지 안 읽고 끊긴다 (2026-10-20).
    # 그래서 코너를 묶어 토막으로 나눠 읽히고 이어 붙인다. **이음매마다 목소리가 조금씩 달라지므로
    # 토막은 될 수 있는 대로 크게 묶는다** (운영자 2026-10-20: "운세 넘어가면서 다른 사람 같다").
    # **길게 읽힐수록 뒤로 가면서 목소리가 사그라든다**(운영자 2026-10-20: "중간쯤부터 속삭이듯 한다").
    # 이음매를 줄이려고 크게 묶었더니 되레 한 토막 안에서 서서히 다른 사람이 됐다.
    # 그래서 반대로 **짧게 끊어 읽힌다** — 토막마다 기운이 살아 있는 앞부분만 쓰는 셈.
    MAX = int(os.environ.get('CHUNK_MAX') or 420)
    # 꽉꽉 채워 나누면 끝에 짧은 토막이 남는다(147·145·51초). 짧은 토막일수록 높이가 엉뚱하게 나와
    # 거기서 사람이 바뀐 것처럼 들린다(운영자 2026-10-20: 끝에 오늘 PLAY 에서 또 바뀐다).
    # 그래서 **몇 토막이 필요한지 먼저 세고 고르게 나눈다.**
    lens0 = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in segs]
    need = max(1, -(-sum(lens0) // MAX))
    want = sum(lens0) / need
    groups, cur, n = [], [], 0
    for x, ln in zip(segs, lens0):
        if cur and n >= want and len(groups) < need - 1:
            groups.append(cur); cur, n = [], 0
        cur.append(x); n += ln
    if cur: groups.append(cur)
    texts = ['\n'.join(x['say'] for x in g) for g in groups]

    def read(gs, depth=0):
        """토막을 읽힌다. 길어서 못 읽으면(빈 응답) 반으로 쪼개 다시 — 한 번만."""
        out = []
        for g in gs:
            got = tts('\n'.join(x['say'] for x in g), host)
            if got is None:
                if depth or len(g) < 2: raise SystemExit('녹음 실패 — 토막을 못 읽음')
                say('토막이 길어 반으로 쪼갬', len(g), '조각')
                h = len(g) // 2
                out += read([g[:h], g[h:]], depth + 1); continue
            out.append(got)
            time.sleep(6)
        return out

    pcms = [deslide(p) for p in read(groups)]
    f0s = [OP.f0(p) or 0 for p in pcms]
    say('토막', len(pcms), '개 ·', [round(len(p) / 48000) for p in pcms], '초 ·', [round(x) for x in f0s])

    # 기준에서 6% 넘게 벗어난 토막은 **그 토막만** 다시 읽힌다. 당기는 폭(내리기 5%)으로는 못 메우고,
    # 그대로 두면 거기서 다른 사람 목소리가 난다. 전체를 다시 녹음하지 않으므로 한도도 아낀다.
    if tgt0 and len(texts) == len(pcms):
        for i in range(len(pcms)):
            for _ in range(2):
                f = f0s[i]
                if not f or abs(f / tgt0 - 1) <= 0.06: break
                say(f'토막 {i + 1} 높이 {round(f)} — 기준({tgt0})에서 멀어 다시 읽힘')
                time.sleep(6)
                again = tts(texts[i], host)
                if again is None: break
                nf = OP.f0(again) or 0
                if nf and abs(nf / tgt0 - 1) < abs(f / tgt0 - 1): pcms[i], f0s[i] = again, nf
                else: break
    # 토막마다 높이가 제각각 나온다(202~245). 그대로 이으면 이음매에서 다른 사람처럼 들린다.
    # 가운뎃값에 맞추면 그날 높게 나온 토막 쪽으로 전체가 끌려가므로(226 이 됐다),
    # **그 진행자의 기준 높이**로 토막마다 당긴다. 당기는 폭은 늘 그대로 — 내리기 5%·올리기 10%까지.
    if tgt0:
        aim = []
        for i, f in enumerate(f0s):
            t = tgt0
            if f:
                cap = 0.05 if f > tgt0 else 0.10
                t = min(max(tgt0, f * (1 - cap)), f * (1 + cap))
            aim.append(round(t))
            pcms[i] = repitch(pcms[i], f, t)
        say('토막 높이', [round(x) for x in f0s], '→', aim, '(기준', tgt0, ')')
    # 높이를 맞춰도 **음량**이 다르면 여전히 다른 사람처럼 들린다. 말하는 대목의 크기를 가운뎃값에 맞춘다.
    vols = [rms(p) for p in pcms]
    ok2 = sorted(v for v in vols if v > 0)
    if len(ok2) > 1:
        mid = ok2[len(ok2) // 2]
        pcms = [regain(p, mid / v if v else 1) for p, v in zip(pcms, vols)]
        say('토막 음량', [round(v) for v in vols], '→', round(mid))

    gap = b'\x00' * 48000   # 토막 사이 1초 — 코너가 바뀌는 쉼. 여기서 음악이 잠깐 올라온다
    pcm = gap.join(pcms)
    # 이음매가 최종 소리에서 몇 초 자리인지 (음악을 거기서 올리려고)
    seam_raw, acc = [], 0
    for q in pcms[:-1]:
        acc += len(q) / 48000
        seam_raw.append(acc + 0.5); acc += 1.0

    lens = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in segs]
    starts, T = OP.split(pcm, lens)
    rate = sum(lens) / T; tempo = max(0.80, min(1.30, 5.4 / rate))   # 차분한 목소리라 조금 더 빠르게 (5.4음절/초, 운영자 2026-10-20)
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
    # 장마다 제 몫만 잘라 낸다. 높이·빠르기·음량은 위에서 **전체를 한 덩어리로** 맞췄으므로
    # 잘라 놓아도 세 장의 목소리가 똑같다.
    for ch in chs:
        a, b = spans[ch]
        s0 = starts[a]
        s1 = starts[b] if b < len(segs) else T
        cut = pcm[int(s0 * 48000):int(s1 * 48000)]
        raw = f'/tmp/rd_{ch}.wav'; OP.wav_write(raw, cut)
        mp3 = f'{DATE}-{ch}.mp3'; dst = os.path.join(OUT, mp3)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', ','.join(af),
                        '-ac', '1', '-b:a', '64k', dst], check=True)
        edge = [(starts[i] - s0) / tempo for i in range(a, b)] + [(s1 - s0) / tempo]
        dur = edge[-1]
        seams = [t / tempo - s0 / tempo + LEAD for t in seam_raw if s0 < t < s1]
        lead, tail = music(dst, dur, seams)
        marks = [{'t': round(edge[i - a] + lead, 2), 'k': segs[i]['k'], 'say': segs[i]['say']} for i in range(a, b)]
        res = {'date': DATE, 'ch': ch, 'host': host, 'name': HOSTS[host]['name'], 'title': CH[ch]['title'],
               'audio': mp3, 'end': round(lead + dur + tail, 2),
               'built': datetime.datetime.now(KST).strftime('%m%d%H%M'), 'marks': marks}
        json.dump(res, open(os.path.join(OUT, f'{DATE}-{ch}.json'), 'w'), ensure_ascii=False, indent=1)
        say('완료', ch, round(lead + dur + tail, 1), '초', '빠르기', round(rate * tempo, 2),
            '높이', pf and round(pf), '→', tgt and round(tgt))


def main():
    want = [ch for ch in (ONLY or list(CH)) if ch in CH]
    by_host = {}
    for ch in want:
        by_host.setdefault(CH[ch]['host'], []).append(ch)
    for host, chs in by_host.items():
        try: build(chs)
        except SystemExit as e: say('그만둠', ', '.join(chs), e)
    keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(3)}
    for f in os.listdir(OUT):
        if f[:10] not in keep:
            os.remove(os.path.join(OUT, f))


try:
    main()
finally:
    open(os.path.join(MEDIA, 'last-radio.log'), 'w').write('\n'.join(LOG))
