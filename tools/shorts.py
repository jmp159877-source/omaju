# 오마주 유튜브 쇼츠 — 그날 오프닝과 인사 카드로 세로 영상(1080×1920)을 만든다 (대표 2026-10-23).
#  ① 오프닝: 아침 방송에서 인사 + 오늘의 실화 + 사인오프만 잘라 50초 안팎. 진행자 사진을 화면 가득, 자막은 크게.
#  ② 인사 카드: 사이트와 같은 카드 넉 장을 넘기는 15초. 아침 음악(우리가 만든 것)만 깐다.
# 진행자는 AI 로 만든 사람·목소리다 — 영상 안에도 작게 밝히고, 올릴 때 유튜브의 'AI 로 만든 콘텐츠' 표시를 켠다.
# 쓰는 법: python3 tools/shorts.py YYYY-MM-DD   (MEDIA_DIR=media, CARDS=/tmp/cards)
import os, sys, json, subprocess, datetime, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
KST = datetime.timezone(datetime.timedelta(hours=9))
DATE = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now(KST).strftime('%Y-%m-%d')
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

def grad(h, top, bottom):
    """세로 그러데이션 막 (위 투명 → 아래 짙은 초록)"""
    g = Image.new('RGBA', (W, h)); d = ImageDraw.Draw(g)
    for y in range(h):
        a = int(top + (bottom - top) * (y / h) ** 1.4); d.line([(0, y), (W, y)], fill=(8, 30, 22, a))
    return g

def cover(im, w, h, zoom=1.0, fy=0.42):
    """화면 가득 채우게 자르기. fy = 세로로 어디를 기준으로 자를지(얼굴이 위쪽이라 0.42)"""
    s = max(w / im.width, h / im.height) * zoom
    r = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x = (r.width - w) // 2; y = int((r.height - h) * fy)
    return r.crop((x, y, x + w, y + h))

def ffmpeg_video(frames, n, audio_args, out):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-'] + audio_args + \
          ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(n): p.stdin.write(frames(k).tobytes())
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit('ffmpeg 실패')

# ── ① 오프닝 ──
def opening():
    jp = os.path.join(MEDIA, 'opening', DATE + '.json')
    if not os.path.exists(jp): print('오프닝 없음'); return None
    j = json.load(open(jp, encoding='utf-8')); s = j['slots']['morning']; segs = s['segs']
    mp3 = os.path.join(MEDIA, 'opening', s['audio'].split('?')[0])
    host = NAME.get(j.get('host'), '')
    # 인사(0~1) + 실화(story 태그가 이어지는 구간) + 사인오프(마지막)만 쓴다.
    # 실화가 끝나는 곳 = '오늘의 오마주 인사 카드'·'오늘의 한 끼' 같은 안내가 처음 나오는 자리
    cut = next((i for i, g in enumerate(segs) if i >= 2 and re.search(r'오늘의 (오마주|한 끼|한 권)|인사 카드', ' '.join(g['cap']))), len(segs) - 1)
    A_end = segs[cut]['t'] - 0.15
    B_start = segs[-1]['t'] - 0.35; B_end = s['end']
    X = 0.4   # 이음새 겹침(초)
    LA = A_end; total = LA + (B_end - B_start) - X
    tl = [(g['t'], g) for g in segs[:cut]] + [(LA - X + (segs[-1]['t'] - B_start), segs[-1])]
    tl[0] = (0.0, tl[0][1])   # 첫 장면은 처음부터
    imgs = j['imgs']['mor']
    cache = {}
    def photo(tag):
        f = imgs.get(tag) or imgs.get('talk')
        if f not in cache: cache[f] = Image.open(os.path.join(ROOT, 'img', 'hosts', f)).convert('RGB')
        return cache[f]
    # 사진은 상반신이 화면을 채우게 당겨 자른다(전신이 다 나오면 얼굴이 작아 쇼츠에서 안 보인다).
    # 얼굴이 위에 있으니 머리 위에는 아무것도 얹지 않고, 글은 모두 아래쪽 짙은 막 위에.
    ZOOM, FY = 1.45, 0.10
    top = grad(260, 120, 0); bot = grad(1000, 0, 240)
    capf = lambda t: fit(t, SERIF_B, 60, 860)
    over = {}
    def overlay(i):
        if i in over: return over[i]
        o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(top, (0, 0)); o.alpha_composite(bot, (0, H - 1000))
        cx = W // 2 - 40   # 오른쪽엔 유튜브 단추가 얹힌다 — 글은 살짝 왼쪽으로
        shadow_text(o, (cx, 1060), f'오마주 매거진 · 오늘의 오프닝 · {DATE_TXT}', font(SERIF, 28), fill=(232, 210, 150, 255), blur=6)
        cap = tl[i][1]['cap']
        for k, line in enumerate(cap[:2]):
            shadow_text(o, (cx, 1150 + k * 86), line, capf(line), blur=10, alpha=230)
        d = ImageDraw.Draw(o); d.line([(cx - 60, 1330), (cx + 60, 1330)], fill=(201, 169, 97, 255), width=2)
        shadow_text(o, (cx, 1378), '매일 아침, 무료 매거진 · omaju.kr', font(SERIF, 30), fill=(232, 220, 190, 255), blur=6)
        shadow_text(o, (W - 36, 210), f'AI 진행자 {host}', font(SERIF, 24), fill=(255, 255, 255, 210), anchor='rm', blur=5)
        over[i] = o; return o
    starts = [t for t, _ in tl] + [total]
    def frame(k):
        t = k / FPS
        i = max(n for n in range(len(tl)) if starts[n] <= t)
        p = (t - starts[i]) / max(0.5, starts[i + 1] - starts[i])
        base = cover(photo(tl[i][1]['tag']), W, H, zoom=ZOOM * (1.0 + 0.04 * p), fy=FY).convert('RGBA')
        fade = 0.3
        if i > 0 and t - starts[i] < fade:   # 장면이 바뀔 때 짧게 겹친다
            prev = cover(photo(tl[i - 1][1]['tag']), W, H, zoom=ZOOM * 1.04, fy=FY).convert('RGBA')
            base = Image.blend(prev, base, (t - starts[i]) / fade)
        base.alpha_composite(overlay(i))
        return base.convert('RGB')
    out = os.path.join(OUT, DATE + '-opening.mp4')
    af = (f'[1:a]atrim=0:{A_end:.2f},asetpts=PTS-STARTPTS[a1];[1:a]atrim={B_start:.2f}:{B_end:.2f},asetpts=PTS-STARTPTS[a2];'
          f'[a1][a2]acrossfade=d={X}[a]')
    ffmpeg_video(frame, int(total * FPS), ['-i', mp3, '-filter_complex', af, '-map', '0:v', '-map', '[a]'], out)
    print('오프닝 쇼츠', round(total, 1), '초')
    return {'file': os.path.basename(out), 'sec': round(total, 1), 'title': j.get('title', ''), 'host': host,
            'story': ' '.join(' '.join(g['cap']) for g in segs[2:cut])}

# ── ② 인사 카드 ──
def cards():
    fs = sorted(f for f in os.listdir(CARDS) if f.startswith('card') and f.endswith('.png')) if os.path.isdir(CARDS) else []
    if not fs: print('카드 그림 없음'); return None
    cs = [Image.open(os.path.join(CARDS, f)).convert('RGB') for f in fs]
    per, fade = 3.6, 0.5; total = per * len(cs) + 0.6
    cw, ch = 900, 1125; cy = 330
    bgs, fronts = [], []
    for c in cs:
        b = cover(c, W, H).filter(ImageFilter.GaussianBlur(40)).convert('RGBA')
        b.alpha_composite(Image.new('RGBA', (W, H), (8, 30, 22, 150)))
        shadow_text(b, (W // 2, 170), '오늘의 인사 카드', font(SERIF_B, 54))
        shadow_text(b, (W // 2, 238), DATE_TXT, font(SERIF, 32), fill=(232, 220, 190, 255))
        shadow_text(b, (W // 2 - 40, cy + ch + 80), '마음 가는 분께 한 장 보내 보세요', font(SERIF_B, 40))
        shadow_text(b, (W // 2 - 40, cy + ch + 140), '매일 아침, 무료 매거진 · omaju.kr', font(SERIF, 30), fill=(232, 220, 190, 255))
        bgs.append(b); fronts.append(c.resize((cw, ch), Image.LANCZOS))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle(((W - cw) // 2, cy + 18, (W + cw) // 2, cy + ch + 18), 18, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    def one(i, p):
        im = bgs[i].copy(); im.alpha_composite(sh)
        z = 1.0 + 0.03 * p; w2, h2 = int(cw * z), int(ch * z); c = fronts[i].resize((w2, h2), Image.BILINEAR)
        im.paste(c, ((W - w2) // 2, cy + (ch - h2) // 2)); return im
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

op = opening(); cd = cards()
# 올릴 때 쓸 제목·설명·태그 — 대표가 복사해 붙인다
info = {'date': DATE, 'opening': op, 'cards': cd}
if op:
    info['opening_up'] = {
        'title': f'{op["title"]} | 오늘의 오프닝 {D.month}/{D.day} #오마주매거진',
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
