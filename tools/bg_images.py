# '오늘의 경제' · '오늘의 이슈' 칸 바탕 사진 만들기 (Gemini 이미지 생성)
# 운영자 2026-10-20: "전체적으로 너무 매거진 느낌이어가지고" — 크림색만 이어지는 가운데
# 찬 색이 한 군데씩 들어가야 숨 쉴 데가 생긴다(소개 배너에서 잡은 결을 코너 안으로).
# 결과는 bg-try 가지의 out/ 에 쌓고, 눈으로 골라 img/ 로 옮긴다.
import os, json, base64, urllib.request, time

KEY = os.environ['GEMINI_API_KEY']
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
os.makedirs('out', exist_ok=True)
LOG = open('out/log.txt', 'a')
def say(*a): print(*a); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()

# 글씨가 위에 얹히므로 '비어 있고 차분한' 사진이어야 한다. 아주 선명한 고화질로 주문한다(보정으로는 못 만든다).
COMMON = ('Ultra sharp, very high resolution, crisp fine detail, professional editorial photograph. '
          'Cool, fresh, airy colour palette — blues, teals, soft grey-greens. Calm and uncluttered: '
          'large simple areas of sky, water or mist so that white text can sit on top and stay readable. '
          'Low contrast, no harsh highlights, no dark heavy shadows. Wide 16:9 landscape composition. '
          'No people in the foreground, no faces, no text, no letters, no signage, no logos, no watermark, '
          'no charts, no graphs, no newspapers, no money, no coins. Not a stock photo cliche.')

JOBS = [
    # 오늘의 경제 — 아침의 도시, 멀고 조용하게
    ('econ1', 'A city skyline seen from far away at blue hour just before sunrise, thin mist between the towers, '
              'cool blue and pale teal, the upper two thirds empty sky with a soft gradient.'),
    ('econ2', 'A wide calm river running through a city at early morning, one long bridge in soft silhouette, '
              'pale blue water and sky, light haze, plenty of empty water in the lower half.'),
    ('econ3', 'The glass facade of a modern building filling the frame at a shallow angle, reflecting a pale morning sky '
              'and thin clouds, cool blue-grey, soft and abstract, gentle geometry.'),
    ('econ4', 'The surface of a deep teal sea seen from above in soft morning light, slow gentle ripples, '
              'no horizon, almost abstract, even tone across the frame.'),
    # 오늘의 이슈 — 하루가 열리는 기척
    ('iss1', 'Low morning mist lying over wide rolling hills, cool blue-green, layered ridges fading into haze, '
             'soft even light, the upper half an empty pale sky.'),
    ('iss2', 'A quiet harbour at dawn, a few small boats far off in soft silhouette, flat still water, '
             'cool blue and pale grey, wide empty water and sky.'),
    ('iss3', 'A pale morning sky filled with soft layered clouds, cool blue and white, a faint warm line near the horizon, '
             'almost nothing else in the frame.'),
    ('iss4', 'A wide empty lake at first light with a thin band of forest on the far shore, mirror-still water, '
             'cool blue-green, mist rising softly.'),
]


def models():
    with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?key={KEY}&pageSize=300', timeout=30) as r:
        ms = [m['name'].split('/')[-1] for m in json.load(r)['models']]
    img = [m for m in ms if 'image' in m and 'imagen' not in m]
    say('이미지 모델:', img)
    return [m for m in img if 'pro' in m] + [m for m in img if 'pro' not in m]


def gen(model, prompt):
    body = {'contents': [{'parts': [{'text': prompt + ' ' + COMMON}]}],
            'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': '16:9'}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r:
        d = json.load(r)
    for p in d['candidates'][0]['content']['parts']:
        if 'inlineData' in p:
            return base64.b64decode(p['inlineData']['data'])
    raise RuntimeError('그림 없음: ' + json.dumps(d)[:300])


MS = models()
for name, prompt in JOBS:
    if ONLY and name not in ONLY:
        continue
    for m in MS:
        try:
            data = gen(m, prompt)
            open(f'out/{name}.png', 'wb').write(data)
            say('완료', name, m, len(data))
            break
        except Exception as e:
            det = e.read().decode()[:300] if hasattr(e, 'read') else ''
            say('실패', name, m, str(e)[:150], det)
            time.sleep(5)
    time.sleep(3)
