# 유튜브 쇼츠 자동 올리기 (대표 2026-10-23: "이거 좀 자동으로 올리게 해라")
# shorts.py 가 만든 두 편을 오마주 매거진 채널에 '예약 게시'로 올린다.
#   인사 카드 → 그날 06:30 공개 · 한 끼 → 10:00 · 오프닝 → 그날 19:00 공개 (그 시각이 지났으면 바로 공개)
#   제목·설명·태그는 shorts/<날짜>.json 의 cards_up · opening_up 을 그대로 쓴다.
#   오프닝은 AI 진행자라 '변경되거나 합성된 콘텐츠'(containsSyntheticMedia) 를 켠다. 카드는 끈다.
#   재생목록: '오늘의 인사 카드…' / '오늘의 오프닝…' 으로 시작하는 목록을 찾아 넣는다.
# 열쇠(GitHub Secrets): YT_CLIENT_ID · YT_CLIENT_SECRET · YT_REFRESH_TOKEN — 없으면 아무것도 안 하고 끝난다.
# 한 번 올린 것은 json 의 yt 칸에 영상 번호를 적어 두어 다시 돌아도 두 번 올리지 않는다.
# 쓰는 법: python3 tools/yt_upload.py YYYY-MM-DD   (MEDIA_DIR=media)
import os, sys, json, datetime, urllib.request, urllib.parse

KST = datetime.timezone(datetime.timedelta(hours=9))
DATE = next((a for a in sys.argv[1:] if not a.startswith('--')), None) or datetime.datetime.now(KST).strftime('%Y-%m-%d')
MEDIA = os.environ.get('MEDIA_DIR', 'media'); OUT = os.path.join(MEDIA, 'shorts')
CID, CSEC, RTOK = (os.environ.get(k, '').strip() for k in ('YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'))
WHEN = {'cards': (6, 30), 'meal': (10, 0), 'opening': (19, 0), 'kid': (21, 0)}   # 자녀 편은 밤 9시 — 자녀 세대가 하루를 마치고 휴대폰을 볼 때 (홍보국 2026-10-25)   # 한 끼는 오전 10시 (대표 2026-10-24)
PLAYLIST = {'cards': '오늘의 인사 카드', 'meal': '오늘의 한 끼', 'opening': '오늘의 오프닝', 'kid': '부모님께 보내 드리는 아침 잡지'}

def say(*a): print('[유튜브]', *a, flush=True)

def req(method, url, body=None, headers=None, raw=None, timeout=120):
    h = dict(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None and raw is None: h.setdefault('Content-Type', 'application/json; charset=UTF-8')
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as res:
            t = res.read(); return res.status, dict(res.headers), (json.loads(t) if t[:1] in (b'{', b'[') else t)
    except urllib.error.HTTPError as e:
        raise SystemExit(f'{method} {url.split("?")[0]} → {e.code} {e.read()[:300]!r}')

def token():
    _, _, j = req('POST', 'https://oauth2.googleapis.com/token', raw=urllib.parse.urlencode(
        {'client_id': CID, 'client_secret': CSEC, 'refresh_token': RTOK, 'grant_type': 'refresh_token'}).encode(),
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    return j['access_token']

def playlist_id(auth, prefix):
    _, _, j = req('GET', 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50', headers=auth)
    for it in j.get('items', []):
        if it['snippet']['title'].startswith(prefix): return it['id']
    # 없으면 만든다 (자녀 편 목록 — 홍보국 2026-10-25). 권한이 없으면 그냥 넘어간다.
    try:
        _, _, n = req('POST', 'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', headers=auth,
                      body={'snippet': {'title': prefix, 'description': '매일 아침 새로 나오는 무료 매거진, 오마주 매거진을 부모님께 소개해 드리세요. 하루 한 코너씩.', 'defaultLanguage': 'ko'},
                            'status': {'privacyStatus': 'public'}})
        say('재생목록 새로 만듦', prefix); return n.get('id')
    except SystemExit as e:
        say('재생목록 만들기 실패', str(e)[:120]); return None

def upload(auth, kind, path, up):
    d = datetime.date.fromisoformat(DATE); hh, mm = WHEN[kind]
    at = datetime.datetime(d.year, d.month, d.day, hh, mm, tzinfo=KST)
    status = {'selfDeclaredMadeForKids': False, 'containsSyntheticMedia': kind in ('opening', 'kid'), 'embeddable': True}
    if at > datetime.datetime.now(KST) + datetime.timedelta(minutes=15):
        status.update(privacyStatus='private', publishAt=at.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
    else:
        status['privacyStatus'] = 'public'
    tags = [t.strip('# ') for t in up.get('tags', []) if t.strip('# ')]
    meta = {'snippet': {'title': up['title'][:100], 'description': up['desc'][:4900], 'tags': tags, 'categoryId': '22',
                        'defaultLanguage': 'ko', 'defaultAudioLanguage': 'ko'}, 'status': status}
    size = os.path.getsize(path)
    _, h, _ = req('POST', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', body=meta,
                  headers={**auth, 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': str(size)})
    loc = h.get('Location') or h.get('location')
    with open(path, 'rb') as f:
        _, _, v = req('PUT', loc, raw=f.read(), headers={**auth, 'Content-Type': 'video/mp4'}, timeout=600)
    vid = v['id']; say(kind, '올림', vid, status.get('publishAt', '바로 공개'))
    pl = playlist_id(auth, PLAYLIST[kind])
    if pl:
        req('POST', 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', headers=auth,
            body={'snippet': {'playlistId': pl, 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}})
        say(kind, '재생목록에 넣음')
    else: say(kind, '재생목록을 못 찾음 —', PLAYLIST[kind])
    return vid

# ── 자동 댓글 (대표 2026-10-25: "자동 게시되는 쇼츠 모두에게 자동 댓글도") ──
# 댓글 달기는 되지만 '고정'은 유튜브가 바깥 프로그램에 열어 두지 않았다 — 고정은 대표가 앱에서 한 번 누른다.
# 예약 게시(비공개) 중인 영상에는 댓글이 안 붙을 수 있어, 못 단 것은 다음 차례(04:50 · 19:10)에 다시 단다.
# 첫 댓글 날: 10/26 부터 (10/25 한 끼는 대표가 손으로 달았다).
COMMENT_FROM = '2026-10-26'
LINK = 'https://omaju.kr/?from=yt'
TAIL = f'{LINK}\n네이버·구글에서 "오마주 매거진"'
NAME = {'miso': '윤미소', 'eunchae': '송은채', 'hangyeol': '서한결', 'seungwoo': '차승우'}

def comment_text(kind, info):
    import re as _re
    d = datetime.date.fromisoformat(DATE); md = f'{d.month}월 {d.day}일 {"월화수목금토일"[d.weekday()]}요일'
    if kind == 'meal':
        try: m = json.load(open(os.path.join('daily', DATE + '.json'), encoding='utf-8')).get('meal') or {}
        except Exception: m = {}
        no = _re.search(r'No\.(\d+)', (info.get('meal_up') or {}).get('title', ''))
        head = f'🍚 오늘의 한 끼{" No." + no.group(1) if no else ""} · {m.get("title") or info.get("meal") or ""}'.strip()
        sub = (m.get('sub') or '').strip()
        tip = (m.get('tip') or '').strip()
        lines = [head] + ([sub] if sub else [])
        if tip: lines += ['', '요령 하나만 기억하세요.', tip]
        lines += ['', '오늘 한번 해 보실래요? 해 보신 분은 어땠는지 들려주세요 😊', '', f'매일 아침 새 한 끼가 올라와요 👉 {TAIL}']
        return '\n'.join(lines)
    if kind == 'cards':
        return '\n'.join([f'☀️ {md} 아침 인사 카드', '마음에 드는 한 장을 오늘 떠오르는 분께 보내 보세요.',
                          '짧은 인사 한 장이 생각보다 오래 남더라고요.', '', '어느 카드가 제일 마음에 드세요? 번호로 남겨 주세요 😊', '',
                          f'카드는 매일 아침 새로 나와요. 고르고 바로 카톡으로 보낼 수 있어요 👉 {TAIL}'])
    if kind == 'opening':
        host = ''
        try: host = NAME.get(json.load(open(os.path.join(MEDIA, 'opening', DATE + '.json'), encoding='utf-8')).get('host'), '')
        except Exception: pass
        hook = (info.get('opening_up') or {}).get('title', '').split('#')[0].strip()
        return '\n'.join([f'🎙 {md} 오마주 오프닝', hook, '',
                          f'AI 진행자 {host + ("이" if host and (ord(host[-1]) - 0xAC00) % 28 else "가") if host else "가"} 아침·오후·저녁마다 힘이 되는 이야기 한 편씩 들려드려요.',
                          '여러분은 늦게 시작해서 더 좋았던 일이 있으신가요? 댓글로 들려주세요.', '', f'오늘 방송 전체 듣기 👉 {TAIL}'])
    if kind == 'kid':   # 자녀 편 (홍보국 2026-10-25) — 첫날부터 단다
        return '\n'.join(['👉 엄마·아빠에게 바로 보내기: https://omaju.kr/?from=kid', '',
                          '매일 아침 새로 나오는 무료 매거진이에요. 가입 없이 링크만 누르면 바로 열려요.',
                          '운세·한 끼·그 시절 노래·인사 카드·여행·산길까지 — 부모님 휴대폰 홈 화면에 하나 놓아 드려 보세요.', '',
                          '목소리는 오마주 AI 진행자 차승우예요.', '네이버·구글에서 "오마주 매거진"'])
    return ''

def post_comment(auth, vid, text):
    _, _, j = req('POST', 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', headers=auth,
                  body={'snippet': {'videoId': vid, 'topLevelComment': {'snippet': {'textOriginal': text}}}})
    return j.get('id')

def selftest():
    """열쇠가 맞는지·어느 채널로 올라가는지 확인한다. 비공개로 하나 올렸다가 바로 지운다. 결과는 shorts/yt_test.json"""
    res = {'at': datetime.datetime.now(KST).isoformat(timespec='seconds')}
    try:
        auth = {'Authorization': 'Bearer ' + token()}
        _, _, ch = req('GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', headers=auth)
        res['channels'] = [c['snippet']['title'] for c in ch.get('items', [])]
        _, _, pl = req('GET', 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50', headers=auth)
        res['playlists'] = [p['snippet']['title'] for p in pl.get('items', [])]
        vids = sorted(f for f in os.listdir(OUT) if f.endswith('-cards.mp4'))
        if vids:
            path = os.path.join(OUT, vids[-1]); size = os.path.getsize(path)
            meta = {'snippet': {'title': '[시험] 자동 올리기 확인 — 곧 지워집니다', 'description': '', 'categoryId': '22'},
                    'status': {'privacyStatus': 'private', 'selfDeclaredMadeForKids': False}}
            _, h, _ = req('POST', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', body=meta,
                          headers={**auth, 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': str(size)})
            with open(path, 'rb') as f:
                _, _, v = req('PUT', h.get('Location') or h.get('location'), raw=f.read(), headers={**auth, 'Content-Type': 'video/mp4'}, timeout=600)
            res['uploaded'] = v['id']
            req('DELETE', f'https://www.googleapis.com/youtube/v3/videos?id={v["id"]}', headers=auth)
            res['deleted'] = True
        res['ok'] = True
    except SystemExit as e: res['error'] = str(e)[:400]
    except Exception as e: res['error'] = repr(e)[:400]
    json.dump(res, open(os.path.join(OUT, 'yt_test.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    say('시험', res)

if __name__ == '__main__':
    if '--test' in sys.argv: selftest(); sys.exit(0)
    if '--preview-comments' in sys.argv:   # 댓글 글만 찍어 보기 (올리지 않음)
        _i = json.load(open(os.path.join(OUT, DATE + '.json'), encoding='utf-8'))
        for _k in ('cards', 'meal', 'opening'): print(f'--- {_k}\n' + comment_text(_k, _i))
        sys.exit(0)
    if not (CID and CSEC and RTOK): say('열쇠가 없어 건너뜀 (YT_CLIENT_ID · YT_CLIENT_SECRET · YT_REFRESH_TOKEN)'); sys.exit(0)
    jp = os.path.join(OUT, DATE + '.json')
    if not os.path.exists(jp): say('오늘 쇼츠가 없음', DATE); sys.exit(0)
    info = json.load(open(jp, encoding='utf-8')); done = info.get('yt', {})
    auth = {'Authorization': 'Bearer ' + token()}
    # 다른 채널(조경노트)로 올라가는 사고를 막는다 — 열쇠가 오마주 매거진 채널 것이 아니면 아무것도 안 올린다 (2026-10-23 첫 열쇠가 조경노트 것이었다)
    _, _, ch = req('GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', headers=auth)
    names = [c['snippet']['title'] for c in ch.get('items', [])]
    if not any('오마주' in n for n in names): say('열쇠가 오마주 채널 것이 아님 — 멈춤', names); sys.exit(1)
    for kind in ('cards', 'meal', 'opening', 'kid'):
        up = info.get(kind + '_up'); path = os.path.join(OUT, f'{DATE}-{kind}.mp4')
        if done.get(kind): say(kind, '이미 올림', done[kind]); continue
        if not up or not os.path.exists(path): say(kind, '영상 없음'); continue
        done[kind] = upload(auth, kind, path, up)
        info['yt'] = done; json.dump(info, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 댓글: 올라간 영상마다 한 번씩. 실패해도 영상은 그대로 두고 다음 차례에 다시.
    if True:
        cm = info.get('yt_comment', {})
        for kind, vid in done.items():
            if cm.get(kind) or (DATE < COMMENT_FROM and kind != 'kid'): continue
            text = comment_text(kind, info)
            if not text: continue
            try: cm[kind] = post_comment(auth, vid, text); say(kind, '댓글 달음', cm[kind])
            except SystemExit as e: say(kind, '댓글 못 담 — 다음 차례에 다시:', str(e)[:200])
        info['yt_comment'] = cm; json.dump(info, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
