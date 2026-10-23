# 오마주 유튜브 쇼츠 — 그날 오프닝과 인사 카드로 세로 영상(1080×1920)을 만든다 (대표 2026-10-23).
#  ① 오프닝: 아침 방송에서 인사 + 오늘의 실화 + 사인오프만 잘라 50초 안팎. 진행자 사진을 화면 가득, 자막은 크게.
#  ② 인사 카드: 사이트와 같은 카드 넉 장을 넘기는 15초. 아침 음악(우리가 만든 것)만 깐다.
# 진행자는 AI 로 만든 사람·목소리다 — 영상 안에도 작게 밝히고, 올릴 때 유튜브의 'AI 로 만든 콘텐츠' 표시를 켠다.
# 쓰는 법: python3 tools/shorts.py YYYY-MM-DD   (MEDIA_DIR=media, CARDS=/tmp/cards)
import os, sys, json, subprocess, datetime, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
KST = datetime.timezone(datetime.timedelta(hours=9))
DATE = next((a for a in sys.argv[1:] if not a.startswith('--')), None) or datetime.datetime.now(KST).strftime('%Y-%m-%d')
MEDIA = os.environ.get('MEDIA_DIR', 'media'); CARDS = os.environ.get('CARDS', '/tmp/cards')
OUT = os.path.join(MEDIA, 'shorts'); os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1080, 1920, 24
D = datetime.date.fromisoformat(DATE); DOW = '월화수목금토일'[D.weekday()]
DATE_TXT = f'{D.month}월 {D.day}일 {DOW}요일'
NAME = {'miso': '윤미소', 'eunchae': '송은채', 'hangyeol': '서한결'}

def fc(pattern):
    try: return subprocess.run(['fc-match', '-f', '%{file}', pattern], capture_output=True, text=True).stdout.strip()
    except Exception: return ''
# 사이트와 같은 나눔명조(깃허브 작업에서 fonts-nanum 으로 깐다). 없으면 노토 세리프로.
SERIF_B = fc('NanumMyeongjo:style=ExtraBold'); SERIF = fc('NanumMyeongjo:style=Regular')
if 'Nanum' not in SERIF_B: SERIF_B = fc('Noto Serif CJK KR:style=Bold')
if 'Nanum' not in SERIF: SERIF = fc('Noto Serif CJK KR:style=Regular')
def font(path, size):
    try: return ImageFont.truetype(path, size, index=1 if path.endswith('.ttc') else 0)
    except Exception: return ImageFont.truetype(path, size)

def shadow_text(im, xy, txt, f, fill=(255, 255, 255, 255), anchor='mm', blur=8, alpha=200):
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((xy[0] + 2, xy[1] + 4), txt, font=f, fill=(0, 0, 0, alpha), anchor=anchor)
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur))); ImageDraw.Draw(im).text(xy, txt, font=f, fill=fill, anchor=anchor)

def fit(txt, path, size, maxw):
    d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    while size > 30 and d.textlength(txt, font=font(path, size)) > maxw: size -= 2
    return font(path, size)

def grad(h, top, bottom, k=1.4):
    """세로 그러데이션 막 (위 → 아래, 짙은 초록). k 가 작을수록 빨리 짙어진다"""
    g = Image.new('RGBA', (W, h)); d = ImageDraw.Draw(g)
    for y in range(h):
        a = int(top + (bottom - top) * (y / h) ** k); d.line([(0, y), (W, y)], fill=(8, 30, 22, a))
    return g

def soft_bottom(h, peak=225, rise=0.5):
    """아래쪽 막 — 맨 위는 0 에서 부드럽게(경계선이 안 보이게) 올라가 rise 지점에서 peak 에 닿는다"""
    g = Image.new('RGBA', (W, h)); d = ImageDraw.Draw(g)
    for y in range(h):
        u = min(1.0, (y / h) / rise); a = int(peak * u * u * (3 - 2 * u)); d.line([(0, y), (W, y)], fill=(8, 30, 22, a))
    return g

def cover(im, w, h, zoom=1.0, fy=0.42):
    """화면 가득 채우게 자르기. fy = 세로로 어디를 기준으로 자를지(얼굴이 위쪽이라 0.42)
    잘라 낼 자리를 소수점까지 계산해 한 번에 옮긴다 — 정수로 반올림하면 천천히 당길 때
    한 픽셀씩 왔다 갔다 해서 화면이 떨렸다 (대표 2026-10-23)."""
    s = max(w / im.width, h / im.height) * zoom
    cw, ch = w / s, h / s                      # 원본에서 잘라 낼 크기(소수)
    x0 = (im.width - cw) / 2; y0 = (im.height - ch) * fy
    return im.transform((w, h), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BICUBIC)

def ffmpeg_video(frames, n, audio_args, out):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-'] + audio_args + \
          ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(n): p.stdin.write(frames(k).tobytes())
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit('ffmpeg 실패')

# ── 첫 1초에 붙잡는 한 줄 (대표 2026-10-23: "그냥 잔잔하게 나오면 뭐지 하고 넘긴다") ──
# 쇼츠는 첫 화면에서 '이게 뭔지'와 '왜 봐야 하는지'가 동시에 보여야 한다. 실화의 반전(마흔에 시작 → 지금은 세계적)을
# 두 줄로. 사실에 있는 것만 쓰고 이름은 아래 줄에서 감춘다(끝까지 보게). 따옴표 인용·과장 금지.
HOOK_LOG = []
def make_hook(story, title):
    env = os.environ.get('SHORTS_HOOK', '')
    if '|' in env: return tuple(env.split('|', 1))
    key = os.environ.get('GEMINI_API_KEY', '')
    if key and story:
        try:
            sys.path.insert(0, HERE); from models import pick
            import urllib.request
            prompt = ('아래는 오늘 아침 방송의 실화 자막이다. 유튜브 쇼츠 첫 화면 위에 크게 얹을 두 줄 문구를 만들어라.\n'
                      '- 1줄: 14자 이내, 반전의 앞부분(늦은 나이·평범한 처지)을 구체적으로. 예) 마흔에 처음 드레스를 그린 여자\n'
                      '- 2줄: 12자 이내, 궁금하게 만드는 뒷부분. 이름은 쓰지 말 것. 예) 지금은 세계가 아는 이름\n'
                      '- 자막에 있는 사실만. 숫자·나이는 자막 그대로. 따옴표·느낌표·이모지·물음표 남발 금지. 낚시성 과장 금지.\n'
                      '형식: {"l1":"...","l2":"..."}\n\n자막: ' + story)
            for m in pick('flash')[:3]:
                try:
                    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}',
                        data=json.dumps({'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseMimeType': 'application/json'}}).encode(),
                        headers={'Content-Type': 'application/json'})
                    with urllib.request.urlopen(req, timeout=180) as r: t = json.load(r)['candidates'][0]['content']['parts'][0]['text']
                    h = json.loads(t); h = h[0] if isinstance(h, list) else h
                    HOOK_LOG.append(f'{m}: {t[:120]}')
                    if h.get('l1') and h.get('l2') and len(h['l1']) <= 20 and len(h['l2']) <= 18: return h['l1'].strip(), h['l2'].strip()
                except Exception as e: HOOK_LOG.append(f'{m} 실패 ' + str(e)[:120])
        except Exception as e: print('[훅] 실패', str(e)[:80]); HOOK_LOG.append('실패 ' + str(e)[:160])
    return (title or '오늘 아침의 이야기'), '매일 아침 무료 매거진'

GOLD, CREAM, YEL, GREEN = (232, 210, 150, 255), (232, 220, 190, 255), (249, 233, 168, 255), (12, 36, 27)

def top_band(o, small, l1, l2, y0=230):
    """맨 위 짙은 초록 띠에 작은 금빛 한 줄 + 큰 두 줄(둘째 줄은 연노랑)"""
    cx = W // 2
    ImageDraw.Draw(o).text((cx, y0), small, font=font(SERIF, 32), fill=GOLD, anchor='mm')
    shadow_text(o, (cx, y0 + 92), l1, fit(l1, SERIF_B, 80, 980), blur=6, alpha=160)
    shadow_text(o, (cx, y0 + 192), l2, fit(l2, SERIF_B, 80, 980), fill=YEL, blur=6, alpha=160)

# ── ① 오프닝 ──
def opening():
    jp = os.path.join(MEDIA, 'opening', DATE + '.json')
    if not os.path.exists(jp): print('오프닝 없음'); return None
    j = json.load(open(jp, encoding='utf-8')); s = j['slots']['morning']; segs = s['segs']
    mp3 = os.path.join(MEDIA, 'opening', s['audio'].split('?')[0])
    host = NAME.get(j.get('host'), '')
    # 첫 인사는 뺀다 — 쇼츠에서 "안녕하세요"로 시작하면 넘긴다. 실화로 바로 들어가고 사인오프로 끝낸다.
    # 실화가 끝나는 곳 = '오늘의 오마주 인사 카드'·'오늘의 한 끼' 같은 안내가 처음 나오는 자리
    cut = next((i for i, g in enumerate(segs) if i >= 2 and re.search(r'오늘의 (오마주|한 끼|한 권)|인사 카드', ' '.join(g['cap']))), len(segs) - 1)
    first = 2 if len(segs) > 3 else 0
    A0 = max(0.0, segs[first]['t'] - 0.25); A_end = segs[cut]['t'] - 0.15
    B_start = segs[-1]['t'] - 0.35; B_end = s['end']
    X = 0.4   # 이음새 겹침(초)
    LA = A_end - A0; total = LA + (B_end - B_start) - X
    tl = [(g['t'] - A0, g) for g in segs[first:cut]] + [(LA - X + (segs[-1]['t'] - B_start), segs[-1])]
    tl[0] = (0.0, tl[0][1])
    story = ' '.join(' '.join(g['cap']) for g in segs[first:cut])
    l1, l2 = make_hook(story, j.get('title', ''))
    print('훅:', l1, '/', l2)
    imgs = j['imgs']['mor']
    cache = {}
    def photo(tag):
        f = imgs.get(tag) or imgs.get('talk')
        if f not in cache: cache[f] = Image.open(os.path.join(ROOT, 'img', 'hosts', f)).convert('RGB')
        return cache[f]
    # 위 520px 은 짙은 초록 띠(붙잡는 문구), 그 아래에 진행자 상반신. 띠와 사진 경계는 부드럽게 번지게.
    PY, PH, ZOOM, FY = 470, H - 470, 1.3, 0.06
    fadeband = Image.new('RGBA', (W, 320)); d0 = ImageDraw.Draw(fadeband)
    for y in range(320): u = 1 - y / 320; d0.line([(0, y), (W, y)], fill=GREEN + (int(255 * u * u * (3 - 2 * u)),))
    bot = soft_bottom(900, 230, 0.45)
    capf = lambda t: fit(t, SERIF_B, 60, 860)
    over = {}
    def overlay(i):
        if i in over: return over[i]
        o = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        o.alpha_composite(fadeband, (0, PY)); o.alpha_composite(bot, (0, H - 900))
        top_band(o, '매일 아침 새로 나오는 무료 매거진', l1, l2)
        cx = W // 2 - 40   # 오른쪽엔 유튜브 단추가 얹힌다 — 글은 살짝 왼쪽으로
        cap = tl[i][1]['cap']
        for k, line in enumerate(cap[:2]):
            shadow_text(o, (cx, 1200 + k * 86), line, capf(line), blur=10, alpha=230)
        d = ImageDraw.Draw(o); d.line([(cx - 60, 1380), (cx + 60, 1380)], fill=(201, 169, 97, 255), width=2)
        shadow_text(o, (cx, 1425), f'오마주 매거진 · AI 진행자 {host} · omaju.kr', font(SERIF, 28), fill=CREAM, blur=6)
        over[i] = o; return o
    starts = [t for t, _ in tl] + [total]
    canvas = Image.new('RGBA', (W, H), GREEN + (255,))
    def frame(k):
        t = k / FPS
        i = max(n for n in range(len(tl)) if starts[n] <= t)
        p = (t - starts[i]) / max(0.5, starts[i + 1] - starts[i])
        ph = cover(photo(tl[i][1]['tag']), W, PH, zoom=ZOOM * (1.0 + 0.04 * p), fy=FY).convert('RGBA')
        fade = 0.3
        if i > 0 and t - starts[i] < fade:   # 장면이 바뀔 때 짧게 겹친다
            prev = cover(photo(tl[i - 1][1]['tag']), W, PH, zoom=ZOOM * 1.04, fy=FY).convert('RGBA')
            ph = Image.blend(prev, ph, (t - starts[i]) / fade)
        im = canvas.copy(); im.alpha_composite(ph, (0, PY)); im.alpha_composite(overlay(i))
        return im.convert('RGB')
    out = os.path.join(OUT, DATE + '-opening.mp4')
    af = (f'[1:a]atrim={A0:.2f}:{A_end:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.25[a1];[1:a]atrim={B_start:.2f}:{B_end:.2f},asetpts=PTS-STARTPTS[a2];'
          f'[a1][a2]acrossfade=d={X}[a]')
    ffmpeg_video(frame, int(total * FPS), ['-i', mp3, '-filter_complex', af, '-map', '0:v', '-map', '[a]'], out)
    print('오프닝 쇼츠', round(total, 1), '초')
    return {'file': os.path.basename(out), 'sec': round(total, 1), 'title': j.get('title', ''), 'host': host,
            'hook': [l1, l2], 'story': story}

# ── ② 인사 카드 ──
def cards():
    fs = sorted(f for f in os.listdir(CARDS) if f.startswith('card') and f.endswith('.png')) if os.path.isdir(CARDS) else []
    if not fs: print('카드 그림 없음'); return None
    cs = [Image.open(os.path.join(CARDS, f)).convert('RGB') for f in fs]
    per, fade = 3.6, 0.5; total = per * len(cs) + 0.6
    cw, ch = 820, 1025; cy = 560
    bgs, fronts, srcs = [], [], []
    for c in cs:
        b = cover(c, W, H).filter(ImageFilter.GaussianBlur(70)).convert('RGBA')
        b.alpha_composite(Image.new('RGBA', (W, H), (8, 30, 22, 175)))
        top_band(b, f'{DATE_TXT} · 오늘의 인사 카드', '카톡으로 보내기 좋은', f'오늘 아침 인사 {len(cs)}장')
        shadow_text(b, (W // 2 - 40, cy + ch + 70), '화면을 캡처해서 보내 보세요', font(SERIF_B, 40))
        shadow_text(b, (W // 2 - 40, cy + ch + 128), '매일 아침 새 카드 · 오마주 매거진', font(SERIF, 30), fill=CREAM)
        bgs.append(b); fronts.append(None); srcs.append(c.convert('RGBA'))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle(((W - cw) // 2, cy + 18, (W + cw) // 2, cy + ch + 18), 18, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    def one(i, p):
        im = bgs[i].copy(); im.alpha_composite(sh)
        # 카드가 좌우로 떨리던 것: 크기·자리를 정수로 반올림해서 1픽셀씩 흔들렸다 → 소수점 그대로 그린다
        z = 1.0 + 0.03 * p; sc = cw * z / srcs[i].width
        ox = W / 2 - cw * z / 2; oy = cy + ch / 2 - ch * z / 2
        layer = srcs[i].transform((W, H), Image.AFFINE, (1 / sc, 0, -ox / sc, 0, 1 / sc, -oy / sc), Image.BICUBIC, fillcolor=(0, 0, 0, 0))
        im.alpha_composite(layer); return im
    def frame(k):
        t = k / FPS; i = min(len(cs) - 1, int(t // per)); p = (t - i * per) / per
        im = one(i, p)
        if i > 0 and t - i * per < fade: im = Image.blend(one(i - 1, 1.0), im, (t - i * per) / fade)
        return im.convert('RGB')
    out = os.path.join(OUT, DATE + '-cards.mp4')
    music = os.path.join(ROOT, 'music', 'morning.mp3')
    ffmpeg_video(frame, int(total * FPS), ['-i', music, '-filter_complex', f'[1:a]atrim=0:{total:.2f},afade=t=in:d=0.8,afade=t=out:st={total - 1.6:.2f}:d=1.6[a]', '-map', '0:v', '-map', '[a]'], out)
    print('카드 쇼츠', round(total, 1), '초')
    return {'file': os.path.basename(out), 'sec': round(total, 1), 'n': len(cs)}

# 이미 오늘치를 만들었고 그 뒤 오프닝이 다시 녹음되지 않았으면 그냥 둔다 (보강 시각에 또 돌 때)
_prev = os.path.join(OUT, DATE + '.json'); _jp = os.path.join(MEDIA, 'opening', DATE + '.json')
_built = json.load(open(_jp, encoding='utf-8')).get('built') if os.path.exists(_jp) else None
if '--force' not in sys.argv and os.path.exists(_prev) and all(os.path.exists(os.path.join(OUT, f'{DATE}-{k}.mp4')) for k in ('opening', 'cards')):
    if json.load(open(_prev, encoding='utf-8')).get('built') == _built: print('이미 있음', DATE); sys.exit(0)
op = opening(); cd = cards()
# 올릴 때 쓸 제목·설명·태그 — 대표가 복사해 붙인다
info = {'date': DATE, 'built': _built, 'opening': op, 'cards': cd, 'hook_log': HOOK_LOG}
if op:
    info['opening_up'] = {
        'title': f'{op["hook"][0]}, {op["hook"][1]} #오마주매거진 #shorts',
        'desc': f'매일 아침 새로 나오는 무료 매거진, 오마주 매거진의 오늘의 오프닝입니다.\n진행 {op["host"]} (AI 진행자)\n\n오늘 호 펼쳐 보기 👉 https://omaju.kr\n네이버에서 "오마주 매거진"\n\n#오마주매거진 #오늘의오프닝 #아침인사 #늦게시작해도괜찮아',
        'ai': '업로드 화면에서 "변경되거나 합성된 콘텐츠"(AI) 표시를 켤 것 — AI 진행자·AI 목소리'}
if cd:
    info['cards_up'] = {
        'title': f'{D.month}월 {D.day}일 {DOW}요일 아침 인사 카드 · 좋은 아침 인사말 #오마주매거진',
        'desc': f'오늘 아침, 마음 가는 분께 보내기 좋은 인사 카드 {cd["n"]}장.\n화면을 캡처해서 보내셔도 좋아요.\n\n매일 아침 새 카드 👉 https://omaju.kr\n네이버에서 "오마주 매거진"\n\n#아침인사 #좋은아침 #인사카드 #아침인사이미지 #오마주매거진',
        'ai': '사람이 나오지 않으니 AI 표시는 하지 않아도 됨'}
json.dump(info, open(os.path.join(OUT, DATE + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# 최근 5일만 남긴다
keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(5)}
for f in os.listdir(OUT):
    if f[:10] not in keep: os.remove(os.path.join(OUT, f))
