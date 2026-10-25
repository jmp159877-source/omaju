"""'오늘의 음악과 함께' 견본 (대표 2026-10-25): 상황별 연주곡을 구글 Lyria 로 직접 만든다 — 저작권·광고 걱정 없이.
결과: out_mood/<이름>_<n>.mp3 + report.txt → mood-try 가지 (사이트에는 아직 안 넣는다)
쓰는 법: ONLY=walk TAKES=3 python3 tools/mood_music.py"""
import os, sys, json, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('GEMINI_API_KEY', '')
import importlib.util
spec = importlib.util.spec_from_file_location('mm_src', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music_make.py'))
src = open(spec.origin, encoding='utf-8').read().split("TAKES = int(")[0].replace("OUT = 'out_music'", "OUT = 'out_mood'")
g = {'__file__': spec.origin}; exec(src, g)
make, clip, say, post, pick = g['make'], g['clip'], g['say'], g['post'], g['pick']

COMMON = ('Instrumental only, absolutely no vocals, no voices, no humming. Clean modern studio production, warm and polished, '
          'tasteful like a high-end lifestyle magazine; no cheap General-MIDI timbres, no lo-fi crackle, no tape hiss. '
          'Steady and continuous, good for listening for a long time on earphones; no sudden drops, no dramatic ending. About two minutes long.')
PROMPT = {
    'walk':  ('Music for a pleasant morning walk in a park. Light acoustic guitar picking, soft piano, gentle shaker and brushed drums, '
              'warm upright bass, major key, around 100 BPM, a relaxed walking groove. Feel-good and fresh, a sunny autumn path. ' + COMMON),
    'drive': ('Music for a calm highway drive. Smooth electric piano, warm bass, soft steady drums, a little clean electric guitar, '
              'around 96 BPM, mellow city-pop-inspired feel, open and breezy. ' + COMMON),
    'rest':  ('Music for resting on a quiet afternoon. Soft felt piano, warm string pad, slow, around 66 BPM, gentle and soothing, '
              'peaceful but not sad. ' + COMMON),
    'work':  ('Music for focusing at work. Minimal soft piano and warm pads with a light steady beat, around 84 BPM, unobtrusive and clear. ' + COMMON),
    'exercise': ('Music for a light workout or brisk hiking uphill. Upbeat acoustic-pop groove, claps, bright guitar, punchy but not harsh drums, '
                 'around 118 BPM, energetic and cheerful. ' + COMMON),
}
KO = {'walk': '산책 — 기분 좋은', 'drive': '운전 — 감미로운', 'rest': '휴식 — 잔잔한', 'work': '업무 — 집중', 'exercise': '운동·등산 — 신나는'}

def judge(path, ko):
    import base64
    b = base64.b64encode(open(path, 'rb').read()).decode()
    ask = ('이 음악을 듣고 한국어 JSON 으로만 답하세요.\n{"vocal": 사람 목소리·허밍이 조금이라도 들리면 true, "mood": "분위기 한 줄", '
           '"instrument": "주된 악기", "why": "판단 이유 한 줄", "grade": 1~5}\n'
           f'노리는 결: {ko}. 이어폰으로 오래 들어도 좋은 고급스러운 연주곡이어야 함. '
           '낮은 점수: 노랫말·사람 소리, 싸구려 미디 음색, 촌스럽거나 유치함, 잡음, 결이 다름.')
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': 'audio/mpeg', 'data': b}}, {'text': ask}]}],
            'generationConfig': {'responseMimeType': 'application/json'}}
    for m in pick('flash')[:3]:
        try:
            d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={os.environ["GEMINI_API_KEY"]}', body, 300)
            return json.loads(d['candidates'][0]['content']['parts'][0]['text'])
        except Exception as e: say('들어보기 실패', m, str(e)[:60])
    return {}

TAKES = int(os.environ.get('TAKES', '3')); ONLY = set(filter(None, os.environ.get('ONLY', 'walk').split(',')))
for k, text in PROMPT.items():
    if k not in ONLY: continue
    say(f'\n=== {k} — {KO[k]} ===')
    for t in range(1, TAKES + 1):
        f = f'out_mood/{k}_{t}.mp3'
        try: open(f, 'wb').write(make(text))
        except Exception as e: say(t, '만들기 실패', str(e)[:150]); time.sleep(10); continue
        clip(f, 'out_mood/_c.mp3'); v = judge('out_mood/_c.mp3', KO[k])
        sec = subprocess.run(['ffprobe', '-loglevel', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip()
        say(f"{t}번째 | {sec}초 | {v.get('instrument')} | {v.get('mood')} | {v.get('grade')}점 | 목소리 {v.get('vocal')} | {v.get('why')}")
        time.sleep(5)
say('끝')
