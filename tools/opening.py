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
# 진행자 세 사람 × 옷 두 벌 = 엿새에 한 바퀴 (운영자 2026-10-20). 10/21(수)을 윤미소 1벌로 잡는다.
# 같은 사람이 나올 때마다 옷이 바뀌어 '녹화 한 번 떠 놓고 돌려 쓰는' 느낌이 나지 않게.
ROUND = [('miso', 1), ('eunchae', 1), ('hangyeol', 1), ('miso', 2), ('eunchae', 2), ('hangyeol', 2)]
ROTATE = ['miso', 'eunchae', 'hangyeol']
HOST, OUTFIT = ROUND[(D - datetime.date(2026, 10, 21)).days % 6]
OTHER = ROTATE[(ROTATE.index(HOST) + 1) % 3]
NAME = {'miso': '윤미소', 'hangyeol': '서한결', 'eunchae': '송은채'}
WD = '월화수목금토일'[D.weekday()]
SLOTS = ['morning', 'noon', 'evening']
# 사진이 실제로 있는 장면만 쓴다. 사연을 없앤 뒤 surprise·moved·secret 은 쓰지 않는다 (2026-10-19).
TAGS = ['read', 'smile', 'laugh', 'talk', 'curious', 'delight', 'thumb']
VOICE = {'miso': 'Callirrhoe', 'hangyeol': 'Charon', 'eunchae': 'Callirrhoe'}
PITCH = {'miso': 195, 'hangyeol': None, 'eunchae': 196}   # 미소는 밝게 195 · 은채는 차분하게 196 (높이는 비슷해도 읽는 결로 가른다, 2026-10-20)
PROFILE = {
 'miso': '[목소리 설정] 45세 한국 여성 방송 진행자. **맑고 경쾌하고, 무엇보다 반갑다.** 문을 열고 들어온 사람을 보고 \"어서 오세요!\" 하는 그 밝은 기운이 첫마디부터 묻어난다. 목소리에 미소가 걸려 있고, 톤이 살짝 올라가며 생기가 있다. 지적이지만 하나도 어렵지 않고 친구처럼 가깝다. **금지: 뉴스 앵커의 보도 말투, 심야 라디오의 낮고 차분한 톤, 명상 안내 같은 느린 말투, 애교·콧소리.**',
 'eunchae': '[목소리 설정] 44세 한국 여성 방송 진행자. **낮고 차분하고 따뜻하다.** 미소보다 반 톤 낮은, 가라앉은 목소리다. 들뜨지 않고 서두르지 않으며, 옆에 앉아 조곤조곤 일러 주듯 이야기한다. 또렷하고 말끝이 처지지 않되 음을 높이 올리지 않는다. **금지: 들뜬 톤, 음을 치켜올리는 말끝, 애교·콧소리, 뉴스 앵커의 보도 말투, 느린 낭독조.**',
 'hangyeol': '[목소리 설정] 46세 한국 남성 방송 진행자. **밝고 반갑고 경쾌하다.** 반가운 사람을 만난 듯 첫마디부터 환하다. 따뜻한 중저음이지만 처지지 않고 생기가 있으며, 듣는 사람을 챙기는 다정함이 있다. **금지: 뉴스 앵커의 보도 말투, 심야 라디오의 낮고 차분한 톤, 느린 낭독조, 까부는 톤.**',
}
DIRECT = ('[연출] 아침을 여는 생방송 오프닝. **첫마디 "안녕하세요"는 반갑게, 그러나 음을 끝까지 올리지 않는다.** '
          '오랜만에 만난 사람을 보고 환하게 웃으며 건네는 인사처럼 — 소리를 지르거나 끝을 치켜올리는 인사가 아니다. '
          '**"안","녕","하","세","요" 다섯 글자를 또렷하게 하나씩 짚어 발음한다.** 반가움은 음 높이가 아니라 입꼬리에서 나온다. '
          '전체를 밝고 경쾌하게, 말에 생기를 두고 가볍게 굴린다. 심야 라디오처럼 낮게 깔지 말 것. '
          '오늘의 한 조각은 재미있는 걸 먼저 알게 된 사람이 신나서 알려 주듯. 궁금한 대목에서는 살짝 뜸을 들였다가 풀어 준다. '
          '오늘 안내는 좋은 걸 권하듯 가볍고 밝게. 마무리는 환하게, 내일 또 만나자는 결로. '
          '**맨 끝 "사랑합니다"는 전체에서 가장 부드럽게 — 여기만 톤을 낮추고 한 박자 느리게.** '
          '또박또박 끊어 선언하듯 말하지 말고, 미소를 머금은 채 숨을 살짝 섞어 "사랑합니다" 를 하나로 이어 흘리듯, '
          '끝을 아주 살며시 내려놓는다. 힘주지 말고, 가까운 사람에게 작게 건네는 말처럼. '
          '바로 뒤 "오마주, 이름였습니다" 도 같은 결로 조용하고 따뜻하게 닫는다. '
          '뉴스 읽기·낭독조·느린 설명조 금지. 그렇다고 호들갑·애교는 아니다. '
          '**대본이 낮이든 저녁이든 목소리와 기운은 똑같이 유지한다.** 저녁 대본이라고 톤을 낮추거나 '
          '느리게 읽거나 가라앉히지 말 것 — 아침·낮·저녁 세 벌이 같은 사람의 같은 방송으로 들려야 한다.')
# 빠진 장면은 **같은 옷 안에서** 비슷한 것으로 메운다 (운영자 2026-10-20: 사진을 더 받지 않기로).
# 옷이 중간에 바뀌면 안 되므로 다른 벌로는 절대 넘어가지 않는다. 저녁 사진이 없는 벌은 낮 사진을 쓴다.
ALT = {
    'wave': ['stand', 'delight', 'smile'], 'stand': ['wave', 'smile', 'delight'],
    'read': ['talk', 'smile'], 'talk': ['read', 'delight', 'smile'],
    'delight': ['smile', 'laugh'], 'smile': ['delight', 'stand'],
    'laugh': ['delight', 'smile'], 'curious': ['smile', 'read'],
    'thumb': ['delight', 'smile'], 'surprise': ['talk', 'delight'], 'moved': ['smile', 'curious'],
}


def shot(period, tag):
    """그날 쓸 사진 파일 이름. 같은 벌 안에서만 고른다."""
    sfx = '' if OUTFIT == 1 else '2'
    # 한 방송 안에서 낮 사진과 밤 사진이 섞이면 조명이 튄다 —
    # 그래서 **그 시간대 안에서 비슷한 장면으로 먼저 메우고**, 그래도 없을 때만 다른 시간대로 넘어간다.
    for p in ([period, 'mor', 'eve'] if period == 'eve' else [period, 'eve']):
        for t in [tag] + ALT.get(tag, []):
            f = f'{HOST}-{p}{sfx}-{t}.jpg'
            if os.path.exists(os.path.join(ROOT, 'img', 'hosts', f)): return f
    return f'{HOST}-mor{sfx}-smile.jpg'


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

PROMPT = '''당신은 라이프스타일 앱 '오마주'(오늘도 마음은 주니어)의 아침 라디오 작가입니다. 오늘 진행자는 {name}({desc})입니다.
이건 뉴스가 아니라 **아침 라디오**입니다. 혼자 듣고 있는 한 사람에게 말을 거는 대본을 씁니다.
보는 사람은 나이는 50~60대지만 생각과 생활은 40대입니다. 유튜브·넷플릭스를 보고, 러닝·골프를 하고, 혼자 여행을 가고, 새 일을 벌이고, 콘서트 티켓팅도 합니다.

오늘 날짜: {date} ({wd}요일).
{topic}
최근에 다룬 것 (겹치지 말 것): {recent}

[오늘의 한 조각 — 시간대마다 **다른 이야기** 셋을 씁니다 (운영자 2026-10-20)]
듣고 나면 기운이 나는 **실화 한 조각**입니다. 늦게 시작한 사람, 오래 버틴 사람, 한참 뒤에 빛을 본 사람.
보는 분들이 50~60대이니 **마흔·쉰·예순에 무언가를 시작하거나 바꾼 사람**이 가장 잘 맞습니다.
한국 사람과 외국 사람을 섞되, 한 주에 한국 사람이 적어도 두 번은 나오게 합니다.

 - 아침 = **시작하는 힘**. 늦게 시작해서 해낸 사람. 듣고 나서 "오늘 뭐라도 해 볼까" 싶게.
 - 낮  = **버티는 힘**. 지루한 반복을 오래 견딘 사람. 한창 지친 시간이니 몰아붙이지 말고 등을 토닥이듯.
 - 저녁 = **돌아보는 힘**. 아무 일 없어 보이던 시간이 나중에 값이 된 사람. 오늘 하루를 인정해 주는 결로.

[이야기 쓰는 법 — 가장 중요]
 - **검색으로 확인되는 실존 인물의 사실만** 씁니다. 나이·연도·무슨 일을 했는지가 맞아야 합니다.
 - **그 사람이 한 말을 따옴표로 옮기지 마세요.** 확인되지 않은 인용을 실제 발언처럼 내보내는 것이 가장 위험합니다.
   감동은 인용이 아니라 **구체적인 장면**에서 나옵니다(뒷마당 창고, 공모전 봉투, 예순에 다시 앉은 강의실).
 - 마무리 한 줄은 **진행자 자신의 말**로. 교훈을 설명하지 말고 슬쩍 건네듯.
 - **설교·확언·자기계발 말투 금지**("할 수 있습니다", "포기하지 마세요", "여러분도 ~하세요").
   밀어붙이지 않습니다. 이야기를 들려주고 듣는 분이 알아서 가져가게 둡니다.
 - 누구나 아는 흔한 위인(에디슨·링컨·헬렌 켈러)은 피합니다. 최근에 쓴 인물({recent})도 피합니다.
 - 한 시간대 3~4조각, 한 조각 60자 이내.

[구성]
1. 첫인사 2조각 — 아침·낮·저녁 세 벌.
   **첫 문장은 어느 시간대든 반드시 "안녕하세요"로 시작합니다.** 눌러서 들을 때 인사부터 나와야 반갑습니다.
   - 아침: "안녕하세요, 좋은 아침입니다. 오늘의 오마주 진행자, {name}입니다."
   - 낮:   "안녕하세요, 점심은 맛있게 드셨어요? 오늘의 오마주 진행자, {name}입니다."
   - 저녁: "안녕하세요, 오늘 하루도 수고 많으셨어요. 오늘의 오마주 진행자, {name}입니다."
   (처음 오신 분이 "여기가 어디고 이 사람이 누구인지"를 첫마디에 알 수 있게 **진행자 소개를 반드시 넣습니다** — 운영자 2026-10-20.)
   (인사 뒤에 느낌표를 쓰지 않습니다 — 느낌표를 붙이면 읽을 때 음이 과하게 올라가 발음이 뭉갭니다.)
   둘째 문장에 오늘 요일을 넣어 그 시간대에 맞는 기분 좋은 한마디 (상투적 문구 금지, 구체적인 장면).
2. 오늘의 한 조각 — **아침·낮·저녁 세 벌을 각각 따로** 씁니다(위 '이야기 쓰는 법'대로). 서로 다른 인물, 다른 이야기.
3. 오늘 오마주 안내 1~2조각 — 오늘 앱에 들어온 것 가운데 하나나 둘을 구체적인 이름으로 알려 준다. 광고 말투 금지, 담담하게.
   {today_in}
   둘 중 하나는 될 수 있으면 인사 카드로: "오늘 인사 카드에는 ○○ 같은 글이 담겼습니다. 마음 가는 분께 한 장 보내 보세요." 처럼.
4. 오늘의 한마디 1조각 — 오늘의 한 조각에서 길어 올린, 듣는 사람에게 말 거는 한 문장 (설교 금지).
5. 마무리 인사 — 아침·낮·저녁 세 벌, 한 문장씩 (예: 오늘도 좋은 하루 보내세요 / 남은 오후도 힘내세요 / 편안한 저녁 보내세요 를 오늘에 맞게).
6. 내일 예고 제목 — 내일 {other}이(가) 가져올 것을 미리 정해 10~16자 (궁금하게).
   내일은 {wd_next}요일이므로 그 요일 테마에 맞는 제목으로. "○○의 ○○ 사연" 꼴 금지. 진행자 이름을 제목에 넣지 말 것.
   보기: "1986년 가을, 그 거리" / "일교차 큰 날의 겉옷 한 벌" / "이번 주말, 무대 세 곳"

[가장 중요한 금지] **지어낸 사람의 사연을 쓰지 말 것.** "○○ 씨의 이야기입니다", "○○ 씨는 …했대요" 같은 꼴을 절대 쓰지 않는다.
오마주는 지어낸 이야기를 실제 사연인 척 내보내지 않는다. 오늘의 한 조각은 사람 사연이 아니라 위 요일 테마(문장·그해 오늘·생활 요령·노래·주말 볼거리)여야 한다.
[금지] 아내·남편·시어머니·며느리·손주 같은 집안 이야기, 효도·내복 같은 옛 정서, 병·죽음, 정치, 실존 유명인 비방, 특정 브랜드 비방.
[금지 낱말] 시니어, 어르신, 노인, 치매, 두뇌, 은퇴.
[말씨 — 가장 중요] 라디오 진행자가 친한 사람에게 말 걸듯 **부드러운 구어체**로 씁니다.
 - "~예요 / ~죠 / ~거든요 / ~더라고요 / ~네요 / ~볼까요" 를 섞어 씁니다.
 - **"~입니다"로만 끝나는 보도 말투 금지.** 설명문·공지문 말투 금지. 딱딱한 한자어 금지.
 - 듣는 사람을 부르는 말("여러분", "오늘 하루") 을 가끔 넣어 혼자 읽는 느낌이 아니게 합니다.
 - 다만 첫 문장("안녕하세요, … 오늘의 오마주 진행자, {name}입니다")과 사인오프("사랑합니다. 오마주, {name}…")는 그대로 둡니다. 사인오프는 쓰지 말고 비워 두세요 — 뒤에 저희가 붙입니다.
 - 애교·과장·호들갑 금지. 지적이되 어렵지 않게.
 한 조각은 1~3문장, 한 조각 60자 이내.
[길이] 전체를 소리 내어 읽어 60~70초 (한글 280~330자).
[표정] 조각마다 tag 하나: read(대본 읽기·담담) smile(미소) surprise(놀람) moved(뭉클·안타까움) laugh(웃음) talk(말 걸기) curious(궁금) secret(뜸 들이기) delight(감탄·기쁨) thumb(엄지·응원). read가 기본이고, 표정은 결정적인 조각에만.
[say와 cap] say는 소리 내어 읽을 글 — 숫자·영문 없이 한글로(1203호→천이백삼 호, 3주→삼 주). cap은 화면 자막 — 숫자 써도 됨, 한 줄 16자 안팎, 줄바꿈은 \\n, 조각이 길면 자막 덩어리 여러 개(배열).

JSON으로만 답하세요:
{{"title":"오늘의 한 조각 제목(10~16자)","greet":{{"morning":[{{"tag":"smile","say":"","cap":[""]}}, ...2개],"noon":[...],"evening":[...]}},
 "story":{{"morning":[{{"tag":"read","say":"","cap":["",""]}}, ...3~4개],"noon":[...],"evening":[...]}},
 "body":[{{"tag":"read","say":"","cap":["",""]}}, ...1~2개],"message":{{"tag":"talk","say":"","cap":[""]}},
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
            # 첫인사에 진행자 이름이 빠지면 누가 진행하는지 모른다 (2026-10-20 점검에서 확인)
            g = ' '.join(x['say'] for x in s['greet'][sl])
            if NAME[HOST] not in g: p.append('첫인사에 이름 없음 ' + sl)
        for sl in SLOTS:
            if not (2 <= len(s.get('story', {}).get(sl, [])) <= 5): p.append(f'한 조각 개수 {sl}')
        if not (1 <= len(s['body']) <= 3): p.append(f"오마주 안내 {len(s['body'])}개")
        segs = ([x for sl in SLOTS for x in s['greet'][sl]] + [x for sl in SLOTS for x in s['story'][sl]]
                + s['body'] + [s['message']])
        for x in segs:
            if x.get('tag') not in TAGS: x['tag'] = 'read'
            if re.search(r'[0-9A-Za-z]', x['say']): p.append('읽을 글에 숫자/영문: ' + x['say'][:20])
            if not x.get('cap'): x['cap'] = [x['say']]
            if isinstance(x['cap'], str): x['cap'] = [x['cap']]
        alltext = json.dumps(s, ensure_ascii=False)
        for w in BAD:
            if w in alltext: p.append('금지 낱말 ' + w)
        if not s.get('next_title'): p.append('내일 제목 없음')
        
        n = sum(len(re.sub(r'[^가-힣]', '', x['say'])) for x in
                s['greet']['morning'] + s['story']['morning'] + s['body'] + [s['message']])
        if not (190 <= n <= 400): p.append(f'길이 {n}음절')
        # 지어낸 사람 사연이 끼어들면 버린다 (2026-10-19)
        body_say = ' '.join(x['say'] for sl in SLOTS for x in s['story'][sl]) + ' ' + ' '.join(x['say'] for x in s['body'])
        if re.search(r'[가-힣]{2,3} ?씨(의|는|가|도|에게)?\s', body_say) or '사연' in body_say: p.append('지어낸 사연이 들어감')
        if '사연' in (s.get('next_title') or ''): p.append('내일 예고가 사연 꼴')   # 60~70초로 줄인 뒤 기준도 내림 (2026-10-19)
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
    if topic and '사연' in topic: topic = ''   # 옛 형식(지어낸 사연)은 물려받지 않는다 (2026-10-19)
    topic = f'어제 예고한 제목은 "{topic}" 입니다. 그 제목에 맞게 쓰세요.' if topic else '오늘 이야기는 요일 테마대로 자유롭게 정하세요.'
    theme = WD_THEME[D.weekday()]
    today_in = today_corners()
    desc = '45세 여성 라디오 진행자, 지적이면서 다정하고 친근한' if HOST == 'miso' else '46세 남성 라디오 진행자, 포근하고 다정다감한'
    for k in range(3):
        s, m = gemini_json(PROMPT.format(name=NAME[HOST], yeyo=yeyo(NAME[HOST]), desc=desc, date=DATE, wd=WD, topic=topic, recent=', '.join(recent_titles()) or '없음', theme=theme, today_in=today_in, other=NAME[OTHER], wd_next='월화수목금토일'[(D + datetime.timedelta(days=1)).weekday()]))
        if not s: continue
        p = problems(s)
        say('대본', m, '문제:', p or '없음')
        if not p: return s
    raise SystemExit('대본을 만들지 못함')

# ── 2) 목소리 ──
def tts(text, who):
    text = text.replace('안녕하세요!', '안녕하세요,')   # 느낌표가 붙으면 음이 과하게 올라가 발음이 뭉갠다
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

def deslide(pcm):
    """한 번에 길게 읽히면 뒤로 갈수록 목소리가 사그라든다(2026-10-20 읽어 드려요에서 확인).
    자연스러운 높낮이는 두고 **처음부터 끝까지의 기울기만** 편다. 최대 ±4dB."""
    import numpy as np
    x = np.frombuffer(pcm, dtype='<i2').astype('float32')
    if x.size < 48000: return pcm
    w = 12000; n = x.size // w
    e = np.array([np.sqrt((x[i * w:(i + 1) * w] ** 2).mean()) + 1e-6 for i in range(n)])
    keep = e > (e.max() * 0.12)
    if keep.sum() < 6: return pcm
    a, b = np.polyfit(np.arange(n)[keep], 20 * np.log10(e[keep]), 1)
    drop = a * (n - 1)
    if abs(drop) < 1.0: return pcm
    ramp = np.linspace(0, -max(-4.0, min(4.0, drop)), x.size)
    return np.clip(x * (10 ** (ramp / 20)), -32000, 32000).astype('<i2').tobytes()


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

# ── 배경 음악 ──
# 음악이 먼저 혼자 흐르다(LEAD) 말이 시작되면 밑으로 내려가 깔리고, 끝에서 서서히 사라진다.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEAD, TAIL = 2.4, 3.2      # 앞에 혼자 흐르는 시간 / 끝에 남아 사라지는 시간
TOP, BED = 0.55, 0.10      # 혼자일 때 크기 / 말 밑에 깔릴 때 크기 (music/*.mp3 는 -16 LUFS 로 고르게 맞춰 둔다)


def music(voice_mp3, sl, dur):
    """말소리 밑에 배경 음악을 깐다. 음악 파일이 없으면 손대지 않는다. → (앞 여유, 뒤 여유)"""
    src = os.path.join(ROOT, 'music', f'{sl}.mp3')
    if not os.path.exists(src):
        return 0.0, 0.0
    total = LEAD + dur + TAIL
    out = voice_mp3 + '.mix.mp3'
    # 말이 시작되기 직전부터 1초에 걸쳐 TOP → BED 로 내려간다
    vol = (f"volume='if(lt(t,{LEAD - 0.5:.2f}),{TOP},"
           f"if(lt(t,{LEAD + 0.5:.2f}),{TOP}-{TOP - BED:.4f}*(t-{LEAD - 0.5:.2f}),{BED}))':eval=frame")
    fc = (f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo,"
          f"adelay={int(LEAD * 1000)}:all=1[v];"
          f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,"
          f"atrim=0:{total:.2f},asetpts=N/SR/TB,{vol},"
          f"afade=t=in:st=0:d=1.4,afade=t=out:st={total - TAIL:.2f}:d={TAIL}[m];"
          f"[v][m]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]")
    try:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', voice_mp3,
                        '-stream_loop', '-1', '-i', src, '-filter_complex', fc,
                        '-map', '[a]', '-ac', '2', '-ar', '44100', '-b:a', '96k', out], check=True)
    except Exception as e:
        say('음악 입히기 실패 — 말소리만 둔다', sl, str(e)[:80]); return 0.0, 0.0
    os.replace(out, voice_mp3)
    return LEAD, TAIL


def nodup(segs, pick=None):
    """같은 장면이 연달아 걸리지 않게 (2026-10-19: 어제 아침 마지막 16초가 한 장면으로 멈춰 있었다).
    첫 두 조각(서서 인사)과 마지막 사인오프는 정해진 장면이니 건드리지 않는다.
    태그가 달라도 빈 장면을 메우느라 **같은 사진 파일**이 될 수 있으므로 파일로 비교한다
    (2026-10-20: 한결 2벌 저녁에 talk 가 read 사진으로 메워져 같은 사진이 세 번 이어졌다)."""
    f = (lambda t: pick.get(t, t)) if pick else (lambda t: t)
    for i in range(2, len(segs) - 1):
        if f(segs[i]['tag']) != f(segs[i - 1]['tag']): continue
        nxt = f(segs[i + 1]['tag']) if i + 1 < len(segs) else None
        for t in TAGS:
            if f(t) != f(segs[i - 1]['tag']) and f(t) != nxt:
                segs[i] = dict(segs[i], tag=t); break
    return segs


def yeyo(n):
    """첫인사 '○○예요 / ○○이에요' — 이름 끝 받침에 따라 (2026-10-20: '서한결예요'로 나갔다)"""
    c = ord(n[-1]); bat = (c - 0xAC00) % 28 if 0xAC00 <= c <= 0xD7A3 else 0
    return '이에요' if bat else '예요'


def signoff(who):
    """사인오프 — 이름 끝 받침에 따라 '였습니다 / 이었습니다' (서한결였습니다 가 되지 않게)"""
    n = NAME[who]; c = ord(n[-1])
    bat = (c - 0xAC00) % 28 if 0xAC00 <= c <= 0xD7A3 else 0
    return f"오마주, {n}{'이었' if bat else '였'}습니다."


def cut(src, spans, dst):
    """한 벌로 녹음한 소리에서 필요한 토막만 떼어 이어 붙인다 (이음매는 20ms 씩 여며서)"""
    fl = []; names = []
    for n, (a, b) in enumerate(spans):
        d = b - a
        fl.append(f'[0:a]atrim={a:.3f}:{b:.3f},asetpts=N/SR/TB,'
                  f'afade=t=in:st=0:d=0.02,afade=t=out:st={max(0.0, d - 0.02):.3f}:d=0.02[p{n}]')
        names.append(f'[p{n}]')
    fl.append(''.join(names) + f'concat=n={len(spans)}:v=0:a=1[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-filter_complex', ';'.join(fl),
                    '-map', '[a]', '-ac', '1', '-b:a', '64k', dst], check=True)


def merge(idxs):
    """이어진 번호끼리 묶는다: [0,1,2,7,9] → [(0,2),(7,7),(9,9)]"""
    out = []
    for i in sorted(idxs):
        if out and i == out[-1][1] + 1: out[-1][1] = i
        else: out.append([i, i])
    return [tuple(x) for x in out]


def build():
    path = os.path.join(OUT, DATE + '.json')
    if os.path.exists(path) and not FORCE: say('이미 있음', DATE); return
    s = make_script()
    # 내일 예고는 말로 하지 않는다 (운영자 2026-10-19: "이 내용은 그냥 없어도 될 것 같은데").
    # 화면의 '내일 예고' 칸은 그대로 두고 next_title 만 쓴다.
    # 마지막 사인오프 — 늘 같은 한 줄로 끝맺는다 (운영자 2026-10-18)
    sign = {'say': f'사랑합니다. {signoff(HOST)}', 'cap': ['사랑합니다.', signoff(HOST)], 'tag': 'wave'}
    imgs = {p: {t: shot(p, t) for t in set(TAGS) | {'wave', 'stand'}} for p in ('mor', 'eve')}
    res = {'date': DATE, 'host': HOST, 'outfit': OUTFIT, 'imgs': imgs,
           'title': s.get('title', ''), 'next_title': s['next_title'],
           'built': datetime.datetime.now(KST).strftime('%m%d%H%M'), 'slots': {}}
    # ── 세 벌을 '한 번에' 녹음하고 잘라 쓴다 (운영자 2026-10-19) ──
    # 따로 녹음하면 같은 목소리로 시킨 것도 벌마다 다르게 나온다(171~222Hz). 높이를 맞춰 봐도
    # 어느 한 벌은 꼭 어긋났다. 가운데 본문은 세 벌이 똑같으니, 인사 셋 · 본문 · 마무리 셋 · 사인오프를
    # 한 번에 읽히고 토막내어 조립한다. 한 번에 읽었으니 세 벌이 다를 수가 없다.
    allsegs = []; where = {}
    for sl in SLOTS:
        g = [dict(x) for x in s['greet'][sl]]
        g[0]['tag'] = 'wave'
        if len(g) > 1: g[1]['tag'] = 'stand'
        where['g' + sl] = list(range(len(allsegs), len(allsegs) + len(g))); allsegs += g
    for sl in SLOTS:                      # 시간대마다 다른 이야기 (아침 시작·낮 버팀·저녁 돌아봄)
        st = [dict(x) for x in s['story'][sl]]
        where['s' + sl] = list(range(len(allsegs), len(allsegs) + len(st))); allsegs += st
    body = [dict(x) for x in s['body']] + [dict(s['message'])]   # 오마주 안내·한마디는 셋이 같이 쓴다
    where['body'] = list(range(len(allsegs), len(allsegs) + len(body))); allsegs += body
    for sl in SLOTS:
        c = dict(s['close'][sl]); c['tag'] = 'smile'
        if isinstance(c.get('cap'), str): c['cap'] = [c['cap']]
        c.setdefault('cap', [c['say']])
        where['c' + sl] = [len(allsegs)]; allsegs.append(c)
    where['sign'] = [len(allsegs)]; allsegs.append(sign)

    nm = NAME[HOST]
    if yeyo(nm) == '이에요':
        for x in allsegs:
            x['say'] = x['say'].replace(nm + '예요', nm + '이에요')
            if isinstance(x.get('cap'), list): x['cap'] = [c.replace(nm + '예요', nm + '이에요') for c in x['cap']]
    text = '\n'.join(x['say'] for x in allsegs)
    tgt0 = PITCH[HOST]; best = None
    # 끌어당길 수 있는 범위(내리기 5%·올리기 10%) 안이면 더 녹음하지 않는다 — 다시 읽히는 것이 AI 한도를 가장 많이 먹는다 (2026-10-20)
    for take in range(3):
        if take: time.sleep(20)
        got = tts(text, HOST)
        if got is None: continue
        gf = f0(got)
        off = abs(gf / tgt0 - 1) if (tgt0 and gf) else 0
        say(f'{take + 1}번째 녹음 높이', gf and round(gf), '기준', tgt0, '벗어남', round(off * 100, 1), '%')
        if best is None or off < best[1]: best = (got, off)
        if not (tgt0 and gf) or tgt0 * 0.905 <= gf <= tgt0 * 1.052: break
    pcm = deslide(best[0]) if best else None   # 길어진 대본에서 뒤로 갈수록 흐려지는 것 펴기
    if pcm is None: raise SystemExit('녹음 실패')

    lens = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in allsegs]
    starts, T = split(pcm, lens)
    rate = sum(lens) / T; tempo = max(1.0, min(1.18, 4.8 / rate))
    pf = f0(pcm); tgt = tgt0
    # 끌어내리면 목청이 묵직해진다(5% 까지만), 끌어올리면 되레 맑아진다(10% 까지)
    cap = 0.05 if (pf and tgt and pf > tgt) else 0.10
    if tgt and pf and abs(pf / tgt - 1) > cap: tgt = None
    af = []
    if tgt and pf and abs(pf / tgt - 1) > 0.02:
        r = tgt / pf; af.append(f'asetrate={int(24000 * r)},aresample=24000'); tempo_eff = tempo / r
    else: tempo_eff = tempo
    af.append(f'atempo={tempo_eff:.4f}')
    raw = '/tmp/op_all.wav'; wav_write(raw, pcm)
    whole = '/tmp/op_all.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', ','.join(af),
                    '-ac', '1', '-b:a', '64k', whole], check=True)
    say('한 벌 녹음', round(T / tempo, 1), '초', '빠르기', round(rate * tempo, 2),
        '높이', pf and round(pf), '→', tgt and round(tgt))

    # 조각마다 (시작, 끝) — 고친 소리 기준
    edge = [st / tempo for st in starts] + [T / tempo]

    for sl in SLOTS:
        pick = where['g' + sl] + where['s' + sl] + where['body'] + where['c' + sl] + where['sign']
        spans = [(edge[a], edge[b + 1]) for a, b in merge(pick)]
        mp3 = f'{DATE}-{sl}.mp3'; dst = os.path.join(OUT, mp3)
        cut(whole, spans, dst)
        # 이어 붙인 뒤의 시작 시각을 다시 센다
        t = 0.0; segs = []
        for i in pick:
            segs.append({'t': round(t, 2), 'tag': allsegs[i]['tag'], 'cap': allsegs[i]['cap']})
            t += edge[i + 1] - edge[i]
        dur = t
        lead, tail = music(dst, sl, dur)
        for x in segs: x['t'] = round(x['t'] + lead, 2)
        res['slots'][sl] = {'audio': mp3, 'end': round(lead + dur + tail, 2), 'segs': nodup(segs, imgs['eve' if sl == 'evening' else 'mor'])}
        say(sl, '길이', round(lead + dur + tail, 1), '초', '조각', len(segs), '음악', bool(lead))

    json.dump(res, open(path, 'w'), ensure_ascii=False, indent=1)
    # 최근 5일만 남김
    keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(5)} | {(D + datetime.timedelta(days=1)).isoformat()}
    for f in os.listdir(OUT):
        if f[:10] not in keep: os.remove(os.path.join(OUT, f))
    say('완료', DATE, HOST)

# 다른 도구(tools/radio.py)가 녹음·자르기 함수를 그대로 가져다 쓰므로, 직접 실행할 때만 만든다
if __name__ == '__main__':
    try: build()
    finally: open(os.path.join(MEDIA, 'last-opening.log'), 'w').write('\n'.join(LOG))
