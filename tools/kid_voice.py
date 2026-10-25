# 쇼츠 '자녀 편' 목소리 (홍보국 2026-10-25) — 차승우(Sadachbia)가 자녀에게 말 건네는 20초 남짓.
# 대본은 KID_SCRIPT 환경변수(없으면 기본). 결과: out_kid/kid.wav · kid.json  → kid-voice 가지(배포 안 됨)
# 모델은 오프닝과 같은 gemini-3.1-flash-tts-preview 하나로 고정(같은 사람 목소리).
import os, sys, json, time, wave, base64, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_check import check

KEY = os.environ['GEMINI_API_KEY']
M = 'gemini-3.1-flash-tts-preview'
SCRIPT = os.environ.get('KID_SCRIPT', '').strip() or (
    '부모님 휴대폰에 하나 깔아 드리면 좋은 게 있어요. '
    '매일 아침 새로 나오는 무료 잡지, 오마주 매거진이에요. '
    '오늘의 운세, 한 끼 요리, 그 시절 노래, 그리고 날마다 바뀌는 아침 인사 카드까지. '
    '가입도 필요 없어요. '
    '댓글 링크 누르면, 엄마 아빠한테 카톡으로 바로 보낼 수 있어요.')
PROFILE = ('[목소리 설정] 35세 한국 남성 진행자. **밝고 경쾌하고 반갑다.** 맑고 가벼운 중음, 목소리에 웃음이 걸려 있다. '
           '친한 형·오빠가 또래에게 "이거 괜찮더라" 하고 알려 주듯 편하고 다정하게. 광고 성우처럼 과장하지 않는다.\n'
           '[연출] 짧은 영상의 내레이션. 처음부터 끝까지 같은 힘과 크기로 또렷하게, 속삭이지 말 것. '
           '빠르기는 보통보다 조금 빠르게, 문장 사이는 짧게 쉰다. 목록("오늘의 운세, 한 끼 요리, …")은 가볍게 굴리듯. '
           '마지막 문장은 좋은 걸 권하듯 환하게 닫는다. 뉴스 읽기·낭독조·호들갑·애교 금지.')

def post(url, body, timeout=300):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)

os.makedirs('out_kid', exist_ok=True)
best = None
for attempt in range(5):
    try:
        d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{M}:generateContent?key={KEY}',
                 {'contents': [{'parts': [{'text': '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + SCRIPT}]}],
                  'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': 'Sadachbia'}}}}})
        pcm = base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except Exception as e:
        print('녹음 실패', attempt, str(e)[:100]); time.sleep(60 * (attempt + 1) if '429' in str(e) else 8); continue
    ok, heard, ratio = check(KEY, pcm, SCRIPT)
    print('녹음', round(len(pcm) / 48000, 1), '초 일치', ratio, '통과' if ok else '불일치 ' + heard[:60])
    if ok: best = pcm; break
    time.sleep(10)
if not best: raise SystemExit('목소리를 만들지 못함')
with wave.open('out_kid/kid.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(best)
# 문장마다 언제 시작·끝나는지(자막·화면 맞추기용) — 받아쓰기 모델에게 묻는다
cues = []
try:
    sents = [x.strip() for x in __import__('re').split(r'(?<=[.?!])\s+', SCRIPT) if x.strip()]
    from models import pick
    fm = pick('flash')[0]
    q = ('이 녹음은 아래 문장들을 차례로 읽은 것이다. 문장마다 말이 시작한 시각과 끝난 시각을 초 단위(소수 둘째 자리)로 JSON 배열로만 답하라. '
         '형식: [{"i":0,"start":0.31,"end":2.90}, ...]\n' + '\n'.join(f'{i}: {t}' for i, t in enumerate(sents)))
    import io
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(best)
    d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{fm}:generateContent?key={KEY}',
             {'contents': [{'parts': [{'inlineData': {'mimeType': 'audio/wav', 'data': base64.b64encode(buf.getvalue()).decode()}}, {'text': q}]}],
              'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}}, 120)
    cues = json.loads(d['candidates'][0]['content']['parts'][0]['text'])
    for c in cues: c['text'] = sents[c['i']]
    print('시각', cues)
except Exception as e:
    print('시각 받기 실패', str(e)[:100])
json.dump({'cues': cues, 'model': M, 'voice': 'Sadachbia', 'script': SCRIPT, 'sec': round(len(best) / 48000, 2)}, open('out_kid/kid.json', 'w'), ensure_ascii=False)
print('끝')
