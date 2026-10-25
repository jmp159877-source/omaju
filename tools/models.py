"""Gemini 모델 고르기 — 구글이 옛 모델을 내리면(404) 코드에 박아 둔 이름이 다 죽는다.
지금 쓸 수 있는 모델 목록을 받아, 원래 쓰던 이름이 살아 있으면 그 순서를 지키고 뒤에 최신 모델을 붙인다."""
import os, re, json, urllib.request

_cache = None
def _names():
    global _cache
    if _cache is None:
        try:
            key = os.environ.get('GEMINI_API_KEY', '')
            with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?key={key}&pageSize=200', timeout=30) as r:
                ms = json.load(r).get('models', [])
            _cache = [m['name'].split('/')[-1] for m in ms if 'generateContent' in m.get('supportedGenerationMethods', [])]
        except Exception as e:
            print('[models] 목록 조회 실패:', str(e)[:80]); _cache = []
    return _cache

def _ver(n):
    m = re.search(r'gemini-(\d+)(?:\.(\d+))?', n)
    return (int(m.group(1)), int(m.group(2) or 0), 0 if 'preview' in n or 'exp' in n else 1) if m else (0, 0, 0)

# ── 비용 (대표 2026-10-26: 월 한도 10만 원을 열흘 만에 다 씀) ──
# 예전에는 '가장 새 모델'로 저절로 올라탔다 → 새로 나올 때마다 더 비싼 모델(3.8 Flash·3.1 Pro)로 넘어갔다.
# 이제 단순한 일(받아쓰기·점검·채점·자르기)은 아래 값싼 모델로 못 박는다. 목록에 없으면 이 이름 그대로 부르고 실패하면 멈춘다(비싼 쪽으로 넘어가지 않는다).
CHEAP = ('gemini-3-flash-preview', 'gemini-3.1-flash-lite')
# 글쓰기(오늘 호·주간 코너·사랑방·이슈)는 이 둘만. 더 새 모델이 나와도 저절로 바꾸지 않는다 — 바꿀 때는 값을 보고 손으로.
WRITE = ('gemini-3.8-flash', 'gemini-3-flash-preview')

def lean(body, model):
    """생각(thinking) 양을 '낮음'으로 — 기본값은 길게 생각해 그 글자까지 모두 출력 요금으로 나간다.
    목소리·그림·음악 모델에는 붙이지 않는다. 구글이 받지 않으면(400) 부르는 쪽이 LEAN[0]=False 로 끄고 다시 부른다."""
    if not LEAN[0] or not re.search(r'gemini-[3-9]', model) or any(k in model for k in ('tts', 'image', 'lyria', 'live')):
        return body
    gc = body.setdefault('generationConfig', {})
    gc.setdefault('thinkingConfig', {'thinkingLevel': 'low'})
    return body
LEAN = [True]

def pick(kind, prefer=()):
    """kind: 'pro'(대본·글: pro 다음 flash) / 'flash'(받아쓰기 등) / 'tts'(목소리)"""
    if kind == 'flash':   # 못 박은 값싼 모델만 (2026-10-26)
        return list(CHEAP)
    names = _names()
    skip = ('lite', 'image', 'live', 'audio', 'embedding', 'robotics', 'computer')
    if kind == 'tts':
        found = sorted([n for n in names if 'tts' in n], key=_ver, reverse=True)
        found = [n for n in found if 'pro' in n] + [n for n in found if 'pro' not in n]  # 같은 목소리 이름, pro 가 더 고르게 읽음
    else:
        txt = [n for n in names if 'tts' not in n and not any(s in n for s in skip) and ('pro' in n or 'flash' in n)]
        pro = sorted([n for n in txt if 'pro' in n], key=_ver, reverse=True)[:2]
        fl = sorted([n for n in txt if 'flash' in n], key=_ver, reverse=True)[:2]
        found = (pro + fl) if kind == 'pro' else (fl + pro)
    if not names:
        return list(prefer)  # 목록 조회가 안 되면 원래 이름으로
    alive = [m for m in prefer if m in names]
    out = alive + [m for m in found if m not in alive]
    return out or list(prefer)


def call(model, body, key, timeout=120):
    """생각 양 '낮음'을 붙여 부르고, 구글이 그 설정을 받지 않으면(400) 빼고 한 번 더 (2026-10-26 비용)."""
    import urllib.error
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    lean(body, model)
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 400 and 'thinkingConfig' in (body.get('generationConfig') or {}):
            LEAN[0] = False; body['generationConfig'].pop('thinkingConfig', None)
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
        raise
