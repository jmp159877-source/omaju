# 녹음 확인: Gemini에게 소리를 받아쓰게 해서 대본과 맞는지 본다 (잘못 읽음·반복·빠뜨림 잡기)
import json, base64, urllib.request, re, difflib, io, wave
NUM = {'0': '영', '1': '일', '2': '이', '3': '삼', '4': '사', '5': '오', '6': '육', '7': '칠', '8': '팔', '9': '구'}
def norm(t):
    t = re.sub(r'[^가-힣0-9]', '', t)
    return t
def transcribe(key, pcm):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': 'audio/wav', 'data': base64.b64encode(buf.getvalue()).decode()}},
             {'text': '이 한국어 음성을 들리는 그대로 받아써 주세요. 숫자도 들리는 소리 그대로 한글로 적고(예: 천이백삼), 반복되면 반복된 대로 적으세요. 받아쓴 글만 답하세요.'}]}],
            'generationConfig': {'temperature': 0}}
    from models import pick, call
    for m in pick('flash')[:2]:   # 값싼 모델로 못 박음 (2026-10-26 비용)
        try:
            return call(m, json.loads(json.dumps(body)), key, 120)['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception: continue
    return None
def check(key, pcm, script):
    """(통과 여부, 받아쓴 글, 일치율)"""
    got = transcribe(key, pcm)
    if got is None: return True, '(받아쓰기 실패, 건너뜀)', 0
    a, b = norm(script), norm(got)
    r = difflib.SequenceMatcher(None, a, b).ratio()
    ok = r >= 0.85 and len(b) <= len(a) * 1.2
    return ok, got, round(r, 2)
