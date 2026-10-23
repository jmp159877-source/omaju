# 유튜브 쇼츠 자동 올리기 (대표 2026-10-23: "이거 좀 자동으로 올리게 해라")
# shorts.py 가 만든 두 편을 오마주 매거진 채널에 '예약 게시'로 올린다.
#   인사 카드 → 그날 06:30 공개 · 오프닝 → 그날 19:00 공개 (그 시각이 지났으면 바로 공개)
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
WHEN = {'cards': (6, 30), 'opening': (19, 0)}
PLAYLIST = {'cards': '오늘의 인사 카드', 'opening': '오늘의 오프닝'}

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
    return None

def upload(auth, kind, path, up):
    d = datetime.date.fromisoformat(DATE); hh, mm = WHEN[kind]
    at = datetime.datetime(d.year, d.month, d.day, hh, mm, tzinfo=KST)
    status = {'selfDeclaredMadeForKids': False, 'containsSyntheticMedia': kind == 'opening', 'embeddable': True}
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

if __name__ == '__main__':
    if not (CID and CSEC and RTOK): say('열쇠가 없어 건너뜀 (YT_CLIENT_ID · YT_CLIENT_SECRET · YT_REFRESH_TOKEN)'); sys.exit(0)
    jp = os.path.join(OUT, DATE + '.json')
    if not os.path.exists(jp): say('오늘 쇼츠가 없음', DATE); sys.exit(0)
    info = json.load(open(jp, encoding='utf-8')); done = info.get('yt', {})
    auth = {'Authorization': 'Bearer ' + token()}
    for kind in ('cards', 'opening'):
        up = info.get(kind + '_up'); path = os.path.join(OUT, f'{DATE}-{kind}.mp4')
        if done.get(kind): say(kind, '이미 올림', done[kind]); continue
        if not up or not os.path.exists(path): say(kind, '영상 없음'); continue
        done[kind] = upload(auth, kind, path, up)
        info['yt'] = done; json.dump(info, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
