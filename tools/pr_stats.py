#!/usr/bin/env python3
"""홍보국 주간 숫자 (2026-10-26) — 읽기만 한다.
방문(stats/날짜)·가입(users)·사랑방 진짜 글 수·유튜브 채널/영상 조회를 tools/last-pr-stats.json 으로 남긴다."""
import os, sys, json, datetime, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
KST = datetime.timezone(datetime.timedelta(hours=9))
out = {'at': datetime.datetime.now(KST).isoformat(timespec='minutes')}
try:
    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    info = json.loads(os.environ['FIREBASE_SERVICE_ACCOUNT'])
    db = fs.Client(project=info['project_id'], credentials=service_account.Credentials.from_service_account_info(info))
    out['stats'] = {d.id: d.to_dict() for d in db.collection('stats').stream() if d.id >= '2026-10-16'}
    users = [d.to_dict() or {} for d in db.collection('users').stream()]
    def day(u):
        for k in ('createdAt', 'created', 'joinedAt'):
            v = u.get(k)
            if v is None: continue
            try: return (v.astimezone(KST) if hasattr(v, 'astimezone') else datetime.datetime.fromisoformat(str(v))).strftime('%Y-%m-%d')
            except Exception: return str(v)[:10]
        return '?'
    by = {}
    for u in users: by[day(u)] = by.get(day(u), 0) + 1
    out['users'] = {'total': len(users), 'by_day': dict(sorted(by.items())),
                    'via': {k: sum(1 for u in users if (u.get('provider') or u.get('via') or 'id') == k) for k in {(u.get('provider') or u.get('via') or 'id') for u in users}}}
    real = [d.to_dict() for d in db.collection('talk').stream()]
    out['talk'] = {'real': sum(1 for t in real if not t.get('seed') and not t.get('host')), 'all': len(real)}
except Exception as e:
    out['fs_error'] = str(e)[:300]
try:
    import yt_upload as Y
    at = Y.token()
    H = {'Authorization': 'Bearer ' + at}
    def get(u):
        return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60))
    ch = get('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true')['items'][0]
    out['yt_channel'] = {'title': ch['snippet']['title'], **ch['statistics']}
    up = ch['contentDetails']['relatedPlaylists']['uploads']; ids = []; tok = ''
    for _ in range(4):
        j = get('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' + up + (f'&pageToken={tok}' if tok else ''))
        ids += [x['contentDetails']['videoId'] for x in j.get('items', [])]; tok = j.get('nextPageToken')
        if not tok: break
    vids = []
    for i in range(0, len(ids), 50):
        j = get('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=' + ','.join(ids[i:i + 50]))
        for v in j.get('items', []):
            vids.append({'id': v['id'], 'title': v['snippet']['title'][:80], 'at': v['snippet']['publishedAt'][:16], 'status': v['status']['privacyStatus'], **v.get('statistics', {})})
    out['yt_videos'] = sorted(vids, key=lambda x: x['at'], reverse=True)
except Exception as e:
    out['yt_error'] = str(e)[:300]
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'last-pr-stats.json'), 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps({k: (v if k != 'yt_videos' else len(v)) for k, v in out.items() if k != 'stats'}, ensure_ascii=False, default=str)[:2000])
