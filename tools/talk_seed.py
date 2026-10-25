# 오마주 사랑방 — 그날 주제로 첫 글을 채워 둔다 (대표 2026-10-25: "손님 없는 식당엔 안 들어간다. 처음엔 채워 두고, 진짜 글이 많아지면 한꺼번에 지운다")
# Firestore talk/{id}: {date, nick, text, ts, show_at(ms), seed:true, host:bool, reports:0, hidden:false, uid:'seed'}
#   · 한꺼번에 뜨지 않게 show_at 을 하루(06:20~22:40)에 흩어 놓는다 — 화면은 show_at 이 지난 것만 보여 준다.
#   · seed:true 로 표시해 두어 관리자 화면에서 진짜 독자 글과 가르고, 나중에 한 번에 지운다(--purge).
#   · 채움 글은 그날 주제에 대한 사람 사는 이야기만. 오마주 칭찬·광고 같은 글은 쓰지 않는다.
# 쓰는 법: python3 tools/talk_seed.py [YYYY-MM-DD] [--n 10] [--purge 날짜|all] [--dry]
import os, sys, json, random, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_daily as G

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
DATE = args[0] if args else datetime.datetime.now(KST).strftime('%Y-%m-%d')
N = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 10

# 50~60대가 실제로 쓸 법한 별명들 — 날마다 이 가운데서 고른다(단골처럼 다시 보이는 이름도 생긴다)
NICKS = ['들꽃향기', '부산갈매기63', '은행나무길', '바람의언덕', '커피한잔', '해피맘', '소나무', '청솔', '하늘바다', '산사랑',
         '대구사과', '달빛소나타', '미소천사', '행복한하루', '느티나무', '제주바람', '골프사랑', '여행가방', '봄날은간다', '광주무등산',
         '라일락', '꽃중년', '인생은60부터', '맑은샘', '푸른솔', '옥수수', '강변산책', '은빛물결', '유자차', '감나무집',
         '동네형', '서울촌놈', '오늘도걷는다', '해바라기', '노을지기', '진달래', '수원갈비', '등대지기', '책읽는여자', '낚시왕',
         '연필깎이', '보리밥', '청주아재', '구름정원', '단풍길', '포도나무', '모과향', '빨간우체통', '설악산', '아침이슬']
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

def make(d):
    tp = topic(d); rnd = random.Random(d)
    nicks = rnd.sample(NICKS, N)
    G.gemini.models = G.list_models()
    j = G.gemini(f"""웹 매거진 '오마주'의 독자 게시판 '사랑방'에 오늘 주제로 글이 올라온다. 독자는 50~60대 한국 사람들(생각과 생활은 40대처럼 젊다).
오늘의 주제: "{tp['q']}" ({tp['sub']})
아래 별명 {N}명이 쓴 글을 하나씩 만들어라. 별명: {', '.join(nicks)}
규칙:
- 한 사람당 25~70자, 한두 문장. 실제 사람이 휴대폰으로 툭 쓴 말투(존댓말 위주, 가끔 반말·'ㅎㅎ'·'하하' 정도). 이모지는 열 개 중 두셋만.
- 사람마다 사연·말투·길이를 다르게. 직업·지역·나이대·성별이 고르게 섞이게. 웃긴 것, 뭉클한 것, 담백한 것을 섞는다.
- 구체적인 장면(물건 이름, 장소, 연도 느낌)을 넣는다. 뻔한 교훈·설교 금지.
- 이 게시판·사이트·잡지를 칭찬하거나 언급하지 말 것. 광고·홍보 말투 금지. 실존 유명인 이름 금지. 정치·종교·질병 이야기 금지.
- 시니어·어르신·노인·은퇴 같은 말 쓰지 않는다.
형식(JSON만): {{"posts": [{{"nick": "별명", "text": "글"}}]}}""")
    posts = [p for p in j.get('posts', []) if p.get('nick') and p.get('text')][:N]
    h = today_host(d)
    jh = G.gemini(f"""라디오 진행자 '{HOSTS[h]}'(오마주 진행자)가 독자 게시판에 오늘 주제로 먼저 한 줄 남긴다. 주제: "{tp['q']}".
30~60자, 밝고 다정한 존댓말, 독자도 써 보라고 살짝 권하는 끝맺음 한 번. 형식(JSON만): {{"text": "글"}}""")
    if jh.get('text'): posts.insert(0, {'nick': HOSTS[h], 'text': jh['text'], 'host': True})
    return tp, posts

def stagger(d, n):
    rnd = random.Random(d + 'time'); base = datetime.datetime.fromisoformat(d + 'T06:20:00+09:00')
    # 아침에 조금 몰리고 낮·저녁에 고르게 — 06:20~22:40 사이
    mins = sorted(rnd.sample(range(0, 980), n)); mins[0] = 0   # 첫 글(진행자)은 06:20 에
    return [int((base + datetime.timedelta(minutes=m)).timestamp() * 1000) for m in mins]

def main():
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
    tp, posts = make(DATE)
    times = stagger(DATE, len(posts))
    print('주제', tp['q'], '·', len(posts), '개')
    for p, t in zip(posts, times):
        doc = {'date': DATE, 'nick': p['nick'], 'text': p['text'][:120], 'show_at': t, 'ts': datetime.datetime.fromtimestamp(t / 1000, KST),
               'seed': True, 'host': bool(p.get('host')), 'reports': 0, 'hidden': False, 'uid': 'seed'}
        print(datetime.datetime.fromtimestamp(t / 1000, KST).strftime('%H:%M'), p['nick'], '|', p['text'])
        if db: db.collection('talk').add(doc)

if __name__ == '__main__': main()
