# 오마주 사랑방 — 그날 주제로 첫 글을 채워 둔다 (대표 2026-10-25: "손님 없는 식당엔 안 들어간다. 처음엔 채워 두고, 진짜 글이 많아지면 한꺼번에 지운다")
# Firestore talk/{id}: {date, nick, text, ts, show_at(ms), seed:true, host:bool, reports:0, hidden:false, uid:'seed'}
#   · 한꺼번에 뜨지 않게 show_at 을 흩어 놓는다 — 00~06시 매시 하나, 06:00 진행자, 06~24시 매시 세 개 — 화면은 show_at 이 지난 것만 보여 준다.
#   · seed:true 로 표시해 두어 관리자 화면에서 진짜 독자 글과 가르고, 나중에 한 번에 지운다(--purge).
#   · 채움 글은 그날 주제에 대한 사람 사는 이야기만. 오마주 칭찬·광고 같은 글은 쓰지 않는다.
# 쓰는 법: python3 tools/talk_seed.py [YYYY-MM-DD] [--n 10] [--purge 날짜|all] [--dry]
import re, os, sys, json, random, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_daily as G

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
DATE = args[0] if args else datetime.datetime.now(KST).strftime('%Y-%m-%d')
N = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 60   # 새벽 6개 + 06~23시 매시 3개 (대표 2026-10-25)

# 50~60대가 실제로 쓸 법한 별명들 — 날마다 이 가운데서 고른다(단골처럼 다시 보이는 이름도 생긴다)
NICKS = ['들꽃향기', '은행나무길', '바람의언덕', '커피한잔', '해피맘', '소나무', '청솔', '하늘바다', '산사랑', '달빛소나타',
         '미소천사', '행복한하루', '느티나무', '골프사랑', '여행가방', '봄날', '라일락', '꽃중년', '맑은샘', '푸른솔', '옥수수',
         '강변산책', '은빛물결', '유자차', '감나무집', '동네형', '오늘도걷는다', '해바라기', '노을', '진달래', '등대지기',
         '책읽는여자', '낚시왕', '연필', '보리밥', '구름정원', '단풍길', '포도나무', '모과향', '빨간우체통', '아침이슬']
# 별명에 지역 이름을 넣지 않는다 (대표 2026-10-25: "실제로 사람들이 자기 지역 넣고 이름 줄줄이 길게 안 한다. 별명은 한두 낱말")
PLACES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '수원', '청주', '전주', '창원', '제주', '강릉', '포항', '춘천',
          '일산', '분당', '천안', '김해', '여수', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '충청', '전라', '경상',
          '마산', '목포', '순천', '군산', '원주', '구미', '안동', '경주', '평택', '용인', '성남', '안양', '부천', '의정부', '해운대',
          '강남', '동래', '거제', '통영', '속초', '무등산', '한라산', '지리산', '설악', '대관령', '남해', '서귀포', '여의도', '광안리']

def clean_nick(n):
    n = (n or '').strip()
    for w in sorted(PLACES, key=len, reverse=True): n = n.replace(w, '')
    n = re.sub(r'\d{2,4}$', '', n).strip(' _-.·')
    return n if 2 <= len(n) <= 8 else None

HOSTS = {'miso': '윤미소', 'eunchae': '송은채', 'seungwoo': '차승우'}

def topic(d):
    t = json.load(open(os.path.join(ROOT, 'data', 'talk_topics.json'), encoding='utf-8'))
    i = (datetime.date.fromisoformat(d) - datetime.date.fromisoformat(t['start'])).days % len(t['topics'])
    return t['topics'][i]

def today_host(d):
    try:
        import importlib.util
        R = [('miso', 1), ('eunchae', 1), ('seungwoo', 1), ('miso', 2)]
        return R[(datetime.date.fromisoformat(d) - datetime.date(2026, 10, 21)).days % len(R)][0]
    except Exception: return 'miso'

# 사람마다 성격·말투가 다르게 (대표 2026-10-25: "여자·남자, 30·40·50·60대 특유의 억양, 하는 일에 따라 말하는 스타일을 잘 배분")
AGES = [('30대', 1), ('40대', 3), ('50대', 4), ('60대', 3)]
JOBS = {'여': ['초등학교 교사', '간호사', '미용실 원장', '전업주부', '보험설계사', '카페 사장', '공무원', '학원 강사', '은행원 출신', '꽃집 주인', '요양보호사', '회사 경리 팀장', '프리랜서 번역가', '반찬가게 사장'],
        '남': ['택시 기사', '중소기업 부장', '자영업(식당)', '공무원', '건설 현장 소장', '대학 교수', '은퇴한 은행원', '트럭 운전', '정비소 사장', '영업직', '농사짓는 귀농인', 'IT 회사 개발자', '고등학교 교사', '부동산 중개사']}
REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '수원', '청주', '전주', '창원', '제주', '강릉', '포항', '춘천', '경기 일산', '경기 분당', '천안', '김해', '여수']
TEMPER = ['수다스럽고 유쾌함', '말수 적고 담백함', '감성적이고 뭉클함', '농담·자기 비하 개그', '꼼꼼하고 설명조', '무뚝뚝하지만 정 많음', '긍정왕', '살짝 투덜대지만 웃김']

def personas(d, n):
    rnd = random.Random(d + 'p'); out = []
    for i in range(n):
        g = '여' if rnd.random() < 0.55 else '남'
        age = rnd.choices([a for a, _ in AGES], [w for _, w in AGES])[0]
        out.append({'gender': g, 'age': age, 'job': rnd.choice(JOBS[g]), 'region': rnd.choice(REGIONS), 'temper': rnd.choice(TEMPER)})
    return out

def batch(tp, ps, used, real=()):
    lines = '\n'.join(f"{i + 1}. {p['region']} {p['age']} {'여성' if p['gender'] == '여' else '남성'}, {p['job']}, 성격: {p['temper']}" for i, p in enumerate(ps))
    j = G.gemini(f"""웹 매거진 '오마주'의 독자 게시판 '사랑방'. 오늘의 주제: "{tp['q']}" ({tp['sub']})
아래 사람들이 휴대폰으로 한 줄씩 남긴다. 사람마다 별명을 짓고 그 사람 말투로 글을 써라.\n별명 규칙: 실제 사람들이 쓰는 짧은 인터넷 별명 — 한두 낱말, 2~6글자(예: 들꽃, 커피한잔, 소나무, 해피맘, 봄날, 동네형). **지역 이름·나이·태어난 해 숫자·직업을 별명에 넣지 말 것.**
{lines}
말투 규칙:
- 나이대 말버릇을 살린다: 30대는 가볍고 ㅋㅋ·~요 많이, 40대는 담백하고 현실적, 50대는 정 많고 '~네요·~더라구요', 60대는 점잖거나 구수한 옛말·'허허'.
- 성별·직업·지역(사투리 살짝)·성격이 글에서 느껴지게. 직업을 그대로 밝히지 말고 이야기 속 장면으로 드러나게.
- 한 사람당 20~80자. 길이·문장 수·이모지 유무를 서로 다르게(이모지는 열에 둘셋). 맞춤법을 일부러 살짝 틀리거나 띄어쓰기를 붙여 쓰는 사람도 한둘.
- 구체적인 장면(물건·장소·연도 느낌). 뻔한 교훈·설교 금지. 웃긴 것·뭉클한 것·담백한 것을 섞는다.
- 이 게시판·사이트·잡지를 언급하거나 칭찬하지 말 것. 광고 말투·실존 유명인·정치·종교·질병 금지. 시니어·어르신·노인·은퇴 같은 말 금지.
- 이미 쓴 별명은 피한다: {', '.join(used) or '없음'}
- 아래는 실제 독자들이 남긴 글이다. 이 사람들처럼 **짧고 꾸밈없이, 휴대폰으로 툭 적은 듯한 솔직한 말투**로 써라(문장을 베끼지는 말 것):
{chr(10).join('  · ' + r for r in real) or '  · 장군이 꿈이었는데 지금은 음식점을 하고 있네요. 그래도 만족합니다. 하하'}
형식(JSON만): {{"posts": [{{"nick": "별명", "text": "글"}}]}} — 위 순서대로 {len(ps)}개""")
    return [p for p in j.get('posts', []) if p.get('nick') and p.get('text')]

def real_posts(db, n=8):
    # 진짜 독자 글(seed 아님)을 말투 견본으로 — 대표 2026-10-25: "내가 쓴 것처럼, 다음 글 쓸 때도 반영"
    if not db: return []
    try:
        xs = [s.to_dict() for s in db.collection('talk').where('seed', '==', False).limit(60).stream()]
        xs = [x for x in xs if not x.get('hidden') and (x.get('reports') or 0) < 3 and 8 <= len(x.get('text', '')) <= 120]
        xs.sort(key=lambda x: x.get('show_at') or 0, reverse=True)
        return [x['text'].replace('\n', ' ') for x in xs[:n]]
    except Exception as e:
        print('[견본 못 읽음]', str(e)[:120]); return []

def make(d, db=None):
    tp = topic(d)
    real = real_posts(db)
    print('말투 견본', len(real), '개')
    G.gemini.models = G.list_models()
    ps = personas(d, N); posts, used = [], []
    for k in range(0, N, 10):
        for t in range(3):
            try:
                got = batch(tp, ps[k:k + 10], used, real)
                for p in got:
                    p['nick'] = clean_nick(p['nick'])
                    if not p['nick'] or p['nick'] in used: continue
                    used.append(p['nick']); posts.append(p)
                break
            except Exception as e: print('[다시]', str(e)[:120])
    h = today_host(d)
    jh = G.gemini(f"""라디오 진행자 '{HOSTS[h]}'(오마주 진행자)가 독자 게시판에 오늘 주제로 먼저 한 줄 남긴다. 주제: "{tp['q']}".
30~60자, 밝고 다정한 존댓말, 독자도 써 보라고 살짝 권하는 끝맺음 한 번. 형식(JSON만): {{"text": "글"}}""")
    if jh.get('text'): posts.insert(0, {'nick': HOSTS[h], 'text': jh['text'], 'host': True})
    return tp, posts

def stagger(d, n):
    # 대표 2026-10-25: 밤 12시~아침 6시는 한 시간에 하나, 06:00 진행자 첫 글, 그다음 06~23시 매시 세 개(분은 흩어서)
    # 첫 글은 00:20 에 채우므로 0시대 글은 25분 뒤로
    rnd = random.Random(d + 'time'); base = datetime.datetime.fromisoformat(d + 'T00:00:00+09:00')
    night = [h * 60 + rnd.randint(25 if h == 0 else 5, 55) for h in range(6)]
    day = []
    for h in range(6, 24):
        day += [h * 60 + m for m in sorted(rnd.sample(range(2, 58), 3))]
    # posts[0] 은 진행자 글 → 06:00. 나머지는 새벽 → 낮 순서로
    slots = [6 * 60] + night + day
    slots = slots[:n]
    while len(slots) < n: slots.append(slots[-1] + rnd.randint(3, 12))
    return [int((base + datetime.timedelta(minutes=m)).timestamp() * 1000) for m in slots]

def main():
    if '--fixnicks' in sys.argv:   # 이미 올라간 채움 글의 별명에서 지역 이름을 걷어 낸다 (대표 2026-10-25)
        d = sys.argv[sys.argv.index('--fixnicks') + 1]; db = G.firestore(); rnd = random.Random(d + 'fix')
        docs = list(db.collection('talk').where('date', '==', d).where('seed', '==', True).stream())
        used = {(x.to_dict().get('nick') or '') for x in docs}; n = 0
        for x in docs:
            v = x.to_dict()
            if v.get('host'): continue
            new = clean_nick(v.get('nick'))
            if new == v.get('nick'): continue
            if not new or new in used: new = rnd.choice([k for k in NICKS if k not in used] or NICKS)
            used.add(new); x.reference.update({'nick': new}); n += 1
            print(v.get('nick'), '→', new)
        print('별명 고침', n); return
    if '--purge' in sys.argv:
        what = sys.argv[sys.argv.index('--purge') + 1]
        db = G.firestore(); q = db.collection('talk').where('seed', '==', True)
        if what != 'all': q = q.where('date', '==', what)
        n = 0
        for s in q.stream(): s.reference.delete(); n += 1
        print('채움 글 지움', n); return
    db = None if '--dry' in sys.argv else G.firestore()
    if db:
        have = list(db.collection('talk').where('date', '==', DATE).where('seed', '==', True).limit(1).stream())
        if have: print('이미 채워 둠', DATE); return
    tp, posts = make(DATE, db)
    times = stagger(DATE, len(posts))
    print('주제', tp['q'], '·', len(posts), '개')
    for p, t in zip(posts, times):
        doc = {'date': DATE, 'nick': p['nick'], 'text': p['text'][:120], 'show_at': t, 'ts': datetime.datetime.fromtimestamp(t / 1000, KST),
               'seed': True, 'host': bool(p.get('host')), 'reports': 0, 'hidden': False, 'uid': 'seed'}
        print(datetime.datetime.fromtimestamp(t / 1000, KST).strftime('%H:%M'), p['nick'], '|', p['text'])
        if db: db.collection('talk').add(doc)

if __name__ == '__main__': main()
