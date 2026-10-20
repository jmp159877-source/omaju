"""구글 TTS 가 왜 막혔는지 확인 — 한도(quota)인지 크레딧(billing)인지. 짧게 한 번만 부른다."""
import os, json, urllib.request, urllib.error, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import pick
KEY = os.environ['GEMINI_API_KEY']
m = (pick('tts', ('gemini-3.1-flash-tts-preview',)) or ['gemini-3.1-flash-tts-preview'])[0]
body = {'contents': [{'parts': [{'text': '안녕하세요.'}]}],
        'generationConfig': {'responseModalities': ['AUDIO'],
                             'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': 'Callirrhoe'}}}}}
req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                             data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.load(r)
    n = len(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    print(f'[되다] {m} — 소리 {n} 바이트. 한도 풀렸음.')
except urllib.error.HTTPError as e:
    t = e.read().decode('utf-8', 'replace')
    print(f'[막힘] {m} HTTP {e.code}')
    print(t[:3000])
except Exception as e:
    print('[실패]', type(e).__name__, str(e)[:300])
