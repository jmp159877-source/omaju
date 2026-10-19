"""오프닝 배경 음악 만들기 (구글 Lyria).

아침·낮·저녁 세 벌을 직접 만든다. 만든 음악이라 저작권이 걸릴 일이 없고,
'고급 라이프스타일 잡지'의 결로 아침·낮·저녁을 맞출 수 있다.

만든 것은 제미나이에게 들려 주고 거른다 — 노랫말이 섞였거나, 선율이 도드라지거나,
갑자기 커지거나, 싸구려 음색이면 버리고 다시 만든다.

결과: music/<슬롯>.mp3  (고른 것)  /  out_music/ (들어 본 것 전부 + 보고서)
"""
import os, sys, json, time, base64, urllib.request, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import pick

KEY = os.environ['GEMINI_API_KEY']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = 'out_music'
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'music'), exist_ok=True)
LOG = open(f'{OUT}/report.txt', 'w', encoding='utf-8')


def say(*a):
    print(*a, flush=True); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()


COMMON = ('Instrumental only, absolutely no vocals, no voices, no humming. '
          'Simple and repetitive with no strong lead melody — this sits quietly underneath a '
          'radio presenter speaking, so it must never pull attention. '
          'Even dynamics throughout: no build-ups, no swells, no drops, no sudden hits, no ending. '
          'Clean modern studio production, warm and uncluttered, no tape hiss, no lo-fi crackle, '
          'no cheap General-MIDI timbres. Tasteful and understated, the feel of a high-end '
          'lifestyle magazine. About two minutes long.')

PROMPT = {
    'morning': ('A warm, bright morning radio bed. Soft nylon-string acoustic guitar and gentle Rhodes '
                'electric piano, light brushed percussion, major key, around 92 BPM. Relaxed and '
                'welcoming, like early sunlight coming through a kitchen window. ' + COMMON),
    'noon':    ('A light bossa-nova cafe bed for a midday radio show. Soft nylon guitar comping, brushed '
                'snare, muted upright bass, a few warm vibraphone touches, around 104 BPM. Easygoing and '
                'gently rhythmic, elegant, never busy. ' + COMMON),
    'evening': ('A calm evening radio bed. Soft felt piano with a warm string pad underneath, very slow, '
                'around 70 BPM. Comforting and settled rather than sad or dramatic. Sparse and spacious. '
                + COMMON),
}
KO = {'morning': '아침 (밝고 산뜻하게)', 'noon': '낮 (가볍게 흐르게)', 'evening': '저녁 (잔잔하게)'}


def post(url, body, timeout=600, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def make(text, model='lyria-3.5'):
    d = post('https://generativelanguage.googleapis.com/v1beta/interactions',
             {'model': model, 'input': text}, 900, {'x-goog-api-key': KEY})
    for st in d.get('steps', []):
        if st.get('type') != 'model_output': continue
        for c in st.get('content', []):
            if c.get('type') == 'audio' and c.get('data'):
                return base64.b64decode(c['data'])
    raise RuntimeError('소리가 안 들어 있음: ' + json.dumps(d)[:300])


def clip(src, dst, sec=28):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '8', '-t', str(sec),
                    '-i', src, '-ac', '1', '-ar', '24000', '-b:a', '96k', dst], check=True)


def judge(path, ko):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    ask = ('이 음악을 듣고 한국어 JSON 으로만 답하세요. 설명 문장 금지.\n'
           '{"vocal": 사람 목소리·노랫말·허밍이 조금이라도 들리면 true, "mood": "분위기 한 줄", '
           '"instrument": "주된 악기", "bed": 라디오 진행자 말소리 밑에 조용히 깔기 좋으면 true, '
           '"why": "판단 이유 한 줄", "grade": 1~5}\n'
           f'이 음악이 노리는 결: {ko}. 아침은 밝고 산뜻, 낮은 가볍게 흐르는, 저녁은 잔잔함.\n'
           '낮은 점수를 줄 것: 노랫말·사람 소리가 섞임, 선율이 도드라져 말을 가림, 갑자기 커지거나 작아짐, '
           '드럼이 셈, 잡음·히스, 싸구려 미디 음색, 촌스럽거나 유치함, 노리는 결과 다름.')
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': 'audio/mpeg', 'data': b}}, {'text': ask}]}],
            'generationConfig': {'responseMimeType': 'application/json'}}
    last = None
    for m in pick('flash')[:3]:
        try:
            d = post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}', body, 300)
            return json.loads(d['candidates'][0]['content']['parts'][0]['text'])
        except Exception as e:
            last = e; say('    들어보기 모델', m, '안 됨', str(e)[:60]); time.sleep(3)
    raise last


TAKES = int(os.environ.get('TAKES', '3'))
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
picked = {}
for slot, text in PROMPT.items():
    if ONLY and slot not in ONLY: continue
    say(f'\n=== {slot} — {KO[slot]} ===')
    best = None
    for take in range(1, TAKES + 1):
        f = f'{OUT}/{slot}_{take}.mp3'
        try:
            open(f, 'wb').write(make(text))
        except Exception as e:
            say(f'  {take}번째 만들기 실패', str(e)[:160]); time.sleep(10); continue
        cut = f'{OUT}/_c.mp3'
        try:
            clip(f, cut); v = judge(cut, KO[slot])
        except Exception as e:
            say(f'  {take}번째 들어보기 실패', str(e)[:120]); continue
        g = 0 if v.get('vocal') or not v.get('bed') else int(v.get('grade', 0))
        sec = float(subprocess.run(['ffprobe', '-loglevel', 'error', '-show_entries', 'format=duration',
                                    '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip() or 0)
        say(f"  {take}번째 | {round(sec)}초 | {v.get('instrument')} | {v.get('mood')} | "
            f"{g}점{' (노랫말)' if v.get('vocal') else ''} | {v.get('why', '')[:60]}")
        if best is None or g > best[0]: best = (g, f, v, sec)
        if g >= 5: break
        time.sleep(5)
    if not best or best[0] < 3:
        say('  → 쓸 만한 것이 없음'); continue
    g, f, v, sec = best
    dst = os.path.join(ROOT, 'music', f'{slot}.mp3')
    # 앞 12초는 버린다(만든 음악은 앞이 거의 들리지 않게 시작한다) + 세 벌 음량을 똑같이 맞춘다
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '12', '-i', f,
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=6,afade=t=in:st=0:d=0.8',
                    '-ac', '2', '-ar', '44100', '-b:a', '128k', dst], check=True)
    picked[slot] = {'grade': g, 'sec': round(sec), **v}
    say(f'  → 골랐습니다 ({g}점, {round(sec)}초)')

json.dump(picked, open(f'{OUT}/picked.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
say('\n끝', list(picked))
