# 오마주 유튜브 쇼츠 ④ 시대 공유 연재 — '한 편을 30초로, 끝은 다음 화 예고' (대표 2026-10-27 15:11 "진행하자")
#  왜: 인사 카드·한 끼 쇼츠는 보고 나면 거기서 끝난다. 연재는 '다음 화'가 있어 다음 날 올 까닭이 생긴다(홍보국·편집국 진단).
#  글은 그 편의 data/<키>.json 안 "short" 칸에서만 가져온다 — 글에 없는 사실·숫자를 영상에 보태지 않는다(낚시 금지).
#  목소리 없이 아침 음악만 → AI 표시 필요 없음.
# 쓰는 법: python3 tools/shorts_series.py <편 id 예: then-01> [--stills]   (MEDIA_DIR=media) → media/shorts/<id>.mp4
import os, sys, json, subprocess
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); sys.path.insert(0, HERE)
_argv = sys.argv; sys.argv = sys.argv[:1]   # 한 끼 쇼츠 모듈은 첫 인자를 날짜로 읽는다
import shorts_meal as M          # 글꼴·그림자 글씨·사진 채우기는 한 끼 쇼츠와 같은 것을 쓴다
import shorts_end as END
sys.argv = _argv
W, H, FPS = M.W, M.H, M.FPS
EID = next(a for a in sys.argv[1:] if not a.startswith('--'))
KEY = EID.split('-')[0]
SER = {'then': '그때 그 물건, 지금은', 'work': '다시, 일', 'trip': '요즘 여행법', 'ev': '전기차 시대', 'ai': 'AI 시대에 살 준비가 되었는가'}
MEDIA = os.environ.get('MEDIA_DIR', 'media'); OUT = os.path.join(MEDIA, 'shorts'); os.makedirs(OUT, exist_ok=True)
GOLD, CREAM, YEL = (232, 210, 150, 255), (232, 220, 190, 255), (249, 233, 168, 255)
DEEP = (8, 30, 22)

def load():
    d = json.load(open(os.path.join(ROOT, 'data', KEY + '.json'), encoding='utf-8'))
    a = next(x for x in d['items'] if x['id'] == EID)
    assert a.get('short'), f'{EID} 에 short 칸이 없음'
    return a

def photo(src):
    return Image.open(os.path.join(ROOT, src)).convert('RGB')

def band_top(o, a):
    """맨 위 짙은 띠 — 작은 금빛 한 줄 + 연재 이름 + 몇 화 (대표: 첫 1초에 붙잡기)"""
    b = Image.new('RGBA', (W, 520)); bd = ImageDraw.Draw(b)
    for yy in range(520): bd.line([(0, yy), (W, yy)], fill=DEEP + (int(235 * (1 - (yy / 520) ** 2.2)),))
    o.alpha_composite(b)
    d = ImageDraw.Draw(o)
    d.text((W // 2, 160), '매일 아침 새로 나오는 무료 매거진 · 오마주 매거진', font=M.font(M.REG, 34), fill=GOLD, anchor='mm')
    M.shadow_text(o, (W // 2, 250), f'{SER[KEY]} · {a["no"]}화', M.fit(f'{SER[KEY]} · {a["no"]}화', M.BOLD, 64, 980), fill=YEL)

def scene_img(sc, a):
    """장면 한 장(배경 사진 제외 위층) — RGBA"""
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    cy = int(H * 0.56)
    if sc.get('bars'):         # 막대 — 글의 도표와 같은 숫자
        items = sc['bars']; mx = max(v for _, v, _ in items)
        pw, ph = 900, 620; x0, y0 = (W - pw) // 2, cy - 330
        sh = Image.new('RGBA', (W, H)); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 14, x0 + pw, y0 + ph + 14), 36, fill=(0, 0, 0, 110))
        o.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), 36, fill=(255, 255, 255, 248))
        d.text((W // 2, y0 + 70), sc['big'], font=M.fit(sc['big'], M.BOLD, 58, pw - 80), fill=M.INK, anchor='mm')
        n = len(items); bw = 150; gap = (pw - n * bw) / (n + 1); base = y0 + ph - 90; top = y0 + 190
        for i, (lab, v, on) in enumerate(items):
            bx = x0 + gap + i * (bw + gap); bh = max(10, (base - top) * v / mx)
            d.rounded_rectangle((bx, base - bh, bx + bw, base), 14, fill=(31, 90, 62, 255) if on else (201, 216, 206, 255))
            d.text((bx + bw / 2, base - bh - 34), sc['vals'][i], font=M.font(M.BOLD, 40), fill=(31, 90, 62, 255) if on else M.SUB, anchor='mm')
            d.text((bx + bw / 2, base + 44), lab, font=M.font(M.BOLD, 36), fill=M.SUB, anchor='mm')
        if sc.get('src'): M.shadow_text(o, (W // 2, y0 + ph + 70), sc['src'], M.fit(sc['src'], M.REG, 30, 980), fill=CREAM, blur=4)
        return o
    if sc.get('list'):         # 짧은 목록 판
        f = M.font(M.BOLD, 62); rows = sc['list']; ph = 200 + len(rows) * 110; pw = 880; x0, y0 = (W - pw) // 2, cy - ph // 2
        sh = Image.new('RGBA', (W, H)); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 14, x0 + pw, y0 + ph + 14), 36, fill=(0, 0, 0, 110))
        o.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), 36, fill=(255, 255, 255, 248))
        d.text((W // 2, y0 + 80), sc['big'], font=M.fit(sc['big'], M.BOLD, 56, pw - 80), fill=(31, 90, 62, 255), anchor='mm')
        for i, r in enumerate(rows):
            num, _, mean = r.partition('=')
            yy = y0 + 190 + i * 110
            d.text((x0 + 90, yy), num.strip(), font=f, fill=M.INK, anchor='lm')
            d.text((x0 + pw - 90, yy), mean.strip(), font=M.font(M.BOLD, 54), fill=(31, 90, 62, 255), anchor='rm')
        return o
    # 글만 있는 장면 — 아래쪽을 어둡게 깔고 큰 글씨
    lb = Image.new('RGBA', (W, 900)); ld = ImageDraw.Draw(lb)
    for yy in range(900): ld.line([(0, yy), (W, yy)], fill=DEEP + (int(225 * min(1, yy / 500) ** 1.5),))
    o.alpha_composite(lb, (0, H - 900))
    lines = sc['big'].split('\n'); fb = M.font(M.BOLD, 84)
    y = H - 560 - (len(lines) - 1) * 52
    for ln in lines:
        M.shadow_text(o, (W // 2, y), ln, M.fit(ln, M.BOLD, 84, 980), fill=YEL if sc.get('yel') else (255, 255, 255, 255), blur=8, alpha=200); y += 108
    if sc.get('sub'):
        for ln in sc['sub'].split('\n'):
            M.shadow_text(o, (W // 2, y + 10), ln, M.fit(ln, M.REG, 46, 980), fill=CREAM); y += 66
    return o

_blur = {}
def bgframe(bg, z):
    """가로 사진은 세로 화면에 억지로 채우면 너무 확대돼 상표 글씨만 보인다 → 흐린 사진을 깔고 가운데에 사진을 통째로"""
    if bg is None: return Image.new('RGBA', (W, H), DEEP + (255,))
    if bg.width <= bg.height: return M.cover(bg, W, H, zoom=z, fy=0.45).convert('RGBA')
    if id(bg) not in _blur:
        b = M.cover(bg, W, H, zoom=1.0).filter(ImageFilter.GaussianBlur(40)).convert('RGBA'); b.alpha_composite(Image.new('RGBA', (W, H), DEEP + (120,)))
        _blur[id(bg)] = b
    o = _blur[id(bg)].copy()
    fw = int(W * 0.94 * z); fh = int(fw * bg.height / bg.width)
    fg = bg.resize((fw, fh), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (fw, fh), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, fw, fh), 28, fill=255); fg.putalpha(m)
    x, y = (W - fw) // 2, int(H * 0.40 - fh / 2)
    sh = Image.new('RGBA', (W, H)); ImageDraw.Draw(sh).rounded_rectangle((x, y + 18, x + fw, y + fh + 18), 28, fill=(0, 0, 0, 120))
    o.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22))); o.alpha_composite(fg, (x, y))
    return o

def build():
    a = load(); s = a['short']
    scenes = s['scenes']
    durs = [sc.get('sec', 3.2) for sc in scenes]
    total = sum(durs)
    layers = [scene_img(sc, a) if sc.get('big') else None for sc in scenes]
    bgs = [photo(sc['photo']) if sc.get('photo') else None for sc in scenes]
    def frame(k):
        t = k / FPS; acc = 0
        for i, dur in enumerate(durs):
            if t < acc + dur or i == len(durs) - 1: break
            acc += dur
        sc, lt = scenes[i], t - acc
        bg = bgs[i] or next((b for b in bgs[i::-1] if b), None)
        z = 1.0 + 0.07 * (lt / durs[i])
        o = bgframe(bg, z)
        o.alpha_composite(Image.new('RGBA', (W, H), DEEP + (70 if i else 120,)))
        if i == 0:             # 첫 장면이 곧 썸네일 — 큰 두 줄
            band_top(o, a)
            cy = int(H * 0.64)
            M.shadow_text(o, (W // 2, cy), s['l1'], M.fit(s['l1'], M.BOLD, 104, 1000), blur=10, alpha=210)
            M.shadow_text(o, (W // 2, cy + 140), s['l2'], M.fit(s['l2'], M.BOLD, 104, 1000), fill=YEL, blur=10, alpha=210)
            return o.convert('RGB')
        band_top(o, a)
        p = min(1.0, lt / 0.45); L = layers[i]
        if p < 1: L = L.copy(); L.putalpha(L.getchannel('A').point(lambda v: int(v * p)))
        o.alpha_composite(L)
        return o.convert('RGB')
    out = os.path.join(OUT, EID + '.mp4')
    if '--stills' in sys.argv:
        acc = 0
        for i, dur in enumerate(durs):
            frame(int((acc + dur * 0.85) * FPS)).save(os.path.join(OUT, f'{EID}-{i}.png')); acc += dur
        return
    base, f0, last = total, frame, {}
    tv = base + END.SEC
    def frame2(k):
        t = k / FPS
        if t < base: return f0(k)
        if 'l' not in last: last['l'] = f0(int(base * FPS) - 1)
        e = t - base; c = END.card('연재 전체는')
        return Image.blend(last['l'], c, e / END.FADE) if e < END.FADE else c
    music = os.path.join(ROOT, 'music', 'morning.mp3')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', music,
           '-filter_complex', f'[1:a]atrim=0:{tv:.2f},afade=t=in:d=0.8,afade=t=out:st={tv - 1.6:.2f}:d=1.6[a]', '-map', '0:v', '-map', '[a]',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(int(tv * FPS)): pr.stdin.write(frame2(k).tobytes())
    pr.stdin.close(); pr.wait()
    if pr.returncode: raise SystemExit('ffmpeg 실패')
    print(EID, '쇼츠', round(tv, 1), '초 →', out)

if __name__ == '__main__':
    build()
