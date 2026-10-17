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

def pick(kind, prefer=()):
    """kind: 'pro'(대본·글: pro 다음 flash) / 'flash'(받아쓰기 등) / 'tts'(목소리)"""
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
