"""오마주 소개 쇼츠 (대표 2026-11-09 — 인사 카드·한 끼 쇼츠 대신 '오마주를 알리는' 소개 연속물 하루 한 편).
대표 주문: 첫 1~2초에 멈추게(밝고 컬러풀, 크고 굵은 제목, 음악이 첫 장면부터), 시대 공유(AI·전기차·요즘 여행법)를 앞세우고
즐길 거리(운세·놀이·한 끼·한 권·여행…)는 색 있는 칸으로. 어두운 배경·검은 휴대폰 테두리·'구독료 0원'·'50대' 같은 말 금지.
실제 omaju.kr 화면(390×844 배율 2 전체 쪽 캡처)을 은색 휴대폰 틀에 넣어 내려 보여 준다. 목소리 없음 → AI 표시 필요 없음.
  python3 tools/brand_short.py <편 이름> <캡처 폴더> <나갈 mp4>"""
import os, sys, math, subprocess
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
import shorts_end as SE

W, H, FPS = 1080, 1920, 30
ROOT = SE.ROOT
IMG = os.path.join(ROOT, 'img')
F = SE._font
K = SE._fc('Noto Sans CJK KR:style=Black'); B = SE._fc('Noto Sans CJK KR:style=Bold')
INK = (20, 20, 20, 255); WHITE = (255, 255, 255, 255); YEL = (255, 228, 92, 255)
X = 0.3            # 장면 겹침(초)
MUSIC_AT = 10.6    # morning.mp3 앞 10초는 조용히 들어오는 부분 — 첫 프레임부터 음악이 들리게 건너뛴다


def ease(x):
    x = max(0.0, min(1.0, x)); return 0.5 - 0.5 * math.cos(math.pi * x)


def back(x):   # 살짝 튀어 오르며 멈춤
    x = max(0.0, min(1.0, x)); c = 1.4; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def cover(p, w, h, fx=.5, fy=.5):
    im = Image.open(p).convert('RGB'); s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = int((im.width - w) * fx); y = int((im.height - h) * fy); return im.crop((x, y, x + w, y + h))


def rounded(im, r):
    im = im.convert('RGBA'); m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=r, fill=255); im.putalpha(m); return im


def text(im, xy, t, f, fill, anchor='mm', sh=0):
    if sh:
        s = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(s).text((xy[0] + 2, xy[1] + 5), t, font=f, fill=(0, 0, 0, sh), anchor=anchor)
        im.alpha_composite(s.filter(ImageFilter.GaussianBlur(14)))
    ImageDraw.Draw(im).text(xy, t, font=f, fill=fill, anchor=anchor)


def chip(t, bg, fg=WHITE, size=34):
    f = F(B, size); w = int(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(t, font=f)) + size * 2
    c = Image.new('RGBA', (w, int(size * 2)), (0, 0, 0, 0)); d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, w - 1, c.height - 1), radius=c.height // 2, fill=bg); d.text((w // 2, c.height // 2), t, font=f, fill=fg, anchor='mm'); return c


def drop(im, layer, x, y, a=0.4, blur=30, dy=26):
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); blk = Image.new('RGBA', layer.size, (0, 0, 0, 255))
    blk.putalpha(layer.getchannel('A').point(lambda v: int(v * a))); sh.alpha_composite(blk, (int(x), int(y + dy)))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur))); im.alpha_composite(layer, (int(x), int(y)))


def with_alpha(layer, k):
    if k >= 1: return layer
    o = layer.copy(); o.putalpha(layer.getchannel('A').point(lambda v: int(v * max(0, k)))); return o


# ── 은색 휴대폰 틀 ──
SW = 640; SH = round(SW * 844 / 390); BZ = 14; SR = 56


def frame_layer():
    P = Image.new('RGBA', (SW + 2 * BZ, SH + 2 * BZ), (0, 0, 0, 0))
    g = Image.new('RGBA', P.size); gd = ImageDraw.Draw(g)
    for i in range(P.height):   # 티타늄 은색 — 위아래 밝고 가운데 살짝 어둡게
        t = i / P.height; v = int(236 - 46 * (1 - abs(0.5 - t) * 2) ** 2); gd.line([(0, i), (P.width, i)], fill=(v, v, v + 5, 255))
    fm = Image.new('L', P.size, 0); ImageDraw.Draw(fm).rounded_rectangle((0, 0, P.width - 1, P.height - 1), radius=SR + BZ, fill=255)
    P.paste(g, (0, 0), fm)
    d = ImageDraw.Draw(P)
    d.rounded_rectangle((1, 1, P.width - 2, P.height - 2), radius=SR + BZ, outline=(255, 255, 255, 210), width=2)
    d.rounded_rectangle((BZ - 4, BZ - 4, BZ + SW + 3, BZ + SH + 3), radius=SR + 4, fill=(16, 16, 18, 255))
    return P


FRAME = None
SMASK = None


def phone(src, y):
    global FRAME, SMASK
    if FRAME is None:
        FRAME = frame_layer(); SMASK = Image.new('L', (SW, SH), 0); ImageDraw.Draw(SMASK).rounded_rectangle((0, 0, SW - 1, SH - 1), radius=SR, fill=255)
    vh = src.width * 844 / 390
    scr = src.resize((SW, SH), Image.LANCZOS, box=(0, y, src.width, y + vh))
    P = FRAME.copy(); P.paste(scr, (BZ, BZ), SMASK)
    ImageDraw.Draw(P).rounded_rectangle((P.width // 2 - 56, BZ + 16, P.width // 2 + 56, BZ + 46), radius=15, fill=(8, 8, 8, 255))
    return P


# ── 장면들 ──
class Cover:
    """첫 장면 — 잡지 표지. 첫 프레임부터 로고·제목이 다 떠 있다(넘기기 전 1초가 승부)."""
    def __init__(self, dur, photo='anbu/a05.jpg', lines=(('매일 아침', YEL), ('새로운', WHITE), ('무료 매거진', WHITE)), sub='오늘도 마음은 주니어'):
        self.dur = dur
        self.p = cover(os.path.join(IMG, photo), int(W * 1.08), int(H * 1.08), fx=.55)
        L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
        for y in range(H):   # 위는 로고가, 아래는 제목이 읽히게 살짝만 어둡게
            v = int((560 - y) / 560 * 100) if y < 560 else (0 if y < 900 else min(170, int((y - 900) / 700 * 190)))
            d.line([(0, y), (W, y)], fill=(4, 22, 40, max(0, v)))
        lg = Image.open(os.path.join(ROOT, 'logo-light.png')).convert('RGBA'); lg = lg.resize((580, int(580 * lg.height / lg.width)), Image.LANCZOS)
        L.alpha_composite(lg, ((W - lg.width) // 2, 80))
        text(L, (W // 2, 80 + lg.height + 44), sub, F(B, 44), WHITE, sh=160)
        for i, (t, c) in enumerate(lines): text(L, (72, 1040 + i * 172), t, F(K, 150), c, 'lm', sh=180)
        self.L = L

    def frame(self, t):
        z = 1.0 + 0.05 * ease(t / self.dur)
        w, h = self.p.width / z, self.p.height / z; cx, cy = self.p.width / 2, self.p.height / 2
        im = self.p.resize((W, H), Image.BILINEAR, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)).convert('RGBA')
        im.alpha_composite(self.L); return im.convert('RGB')


class Series:
    """시대 공유 세 연재 — 사진 띠 셋이 차례로 솟아오른다"""
    ROWS = (('ai-tile.jpg', 'AI 시대에 살 준비가 되었는가', (37, 99, 235, 255)),
            ('ev-tile.jpg', '전기차 시대', (16, 150, 96, 255)),
            ('trip-tile.jpg', '요즘 여행법', (240, 96, 48, 255)))

    def __init__(self, dur):
        self.dur = dur; self.bg = Image.new('RGBA', (W, H), (250, 248, 243, 255))
        text(self.bg, (W // 2, 250), '요즘 세상 이야기,', F(K, 100), INK)
        f = F(K, 100); tw = ImageDraw.Draw(self.bg).textlength('매일 한 편씩', font=f)
        ImageDraw.Draw(self.bg).rectangle((W / 2 - tw / 2 - 10, 400, W / 2 + tw / 2 + 10, 440), fill=(255, 228, 92, 255))
        text(self.bg, (W // 2, 380), '매일 한 편씩', f, INK)
        self.cards = []
        for p, t, c in self.ROWS:
            ph = cover(os.path.join(IMG, p), 900, 360).convert('RGBA')
            g = Image.new('RGBA', ph.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
            for y in range(ph.height): gd.line([(0, y), (ph.width, y)], fill=(0, 0, 0, int(max(0, (y - 150) / 210) * 150)))
            ph.alpha_composite(g); text(ph, (34, ph.height - 52), t, F(K, 46), WHITE, 'lm', sh=150)
            self.cards.append(rounded(ph, 30))

    def frame(self, t):
        im = self.bg.copy()
        for i, c in enumerate(self.cards):
            k = (t - 0.25 - i * 0.28) / 0.55
            if k <= 0: continue
            y = 560 + i * 400 + (1 - back(k)) * 220
            drop(im, with_alpha(c, ease(k * 1.6)), 90, y, a=0.28)
        return im.convert('RGB')


class Phone:
    def __init__(self, shot, dur, bg, acc, label, l1, l2, y1, hold=1.0, y0=0):
        self.src = Image.open(shot).convert('RGB'); self.dur = dur; self.hold = hold; self.y0 = y0
        self.vh = self.src.width * 844 / 390; self.y1 = min(y1, self.src.height - self.vh)
        im = Image.new('RGBA', (W, H), bg + (255,))
        c = chip(label, INK, size=36); im.alpha_composite(c, ((W - c.width) // 2, 150))
        text(im, (W // 2, 330), l1, F(K, 96), INK); text(im, (W // 2, 452), l2, F(K, 96), INK)
        self.bg = im; self.py = 560

    def frame(self, t):
        im = self.bg.copy()
        k = ease((t - self.hold) / max(0.1, self.dur - self.hold - 0.5))
        P = phone(self.src, self.y0 + (self.y1 - self.y0) * k)
        rise = (1 - ease(t / 0.45)) * 80   # 들어올 때 살짝 올라옴
        drop(im, P, (W - P.width) // 2, self.py + rise, a=0.35, blur=46, dy=40)
        return im.convert('RGB')


class Grid:
    """즐길 거리 — 색 이름표가 붙은 사진 칸이 하나씩 톡톡 떠오른다"""
    TILES = (('fortune.jpg', '오늘의 운세', (124, 58, 237, 255)), ('play.jpg', '놀이 · 퀴즈', (234, 88, 12, 255)),
             ('food.jpg', '오늘의 한 끼', (220, 38, 38, 255)), ('book.jpg', '오늘의 한 권', (37, 99, 235, 255)),
             ('trv-tour.jpg', '해외여행', (13, 148, 136, 255)), ('hike.jpg', '오늘의 산', (22, 163, 74, 255)),
             ('culture.jpg', '전시 · 공연', (219, 39, 119, 255)), ('music.jpg', '추천 음악', (202, 138, 4, 255)))

    def __init__(self, dur):
        self.dur = dur; self.bg = Image.new('RGBA', (W, H), (22, 22, 24, 255))
        text(self.bg, (W // 2, 210), '즐길 거리도', F(K, 100), WHITE); text(self.bg, (W // 2, 335), '매일 새로', F(K, 100), WHITE)
        self.tiles = []
        tw, th = 450, 300
        for p, t, c in self.TILES:
            ph = cover(os.path.join(IMG, p), tw, th).convert('RGBA')
            g = Image.new('RGBA', ph.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
            for y in range(th): gd.line([(0, y), (tw, y)], fill=(0, 0, 0, int(max(0, (y - 140) / 160) * 170)))
            ph.alpha_composite(g); text(ph, (24, th - 40), t, F(K, 38), WHITE, 'lm', sh=150)
            self.tiles.append(rounded(ph, 24))

    def frame(self, t):
        im = self.bg.copy()
        for i, c in enumerate(self.tiles):
            k = (t - 0.2 - i * 0.16) / 0.45
            if k <= 0: continue
            s = 0.6 + 0.4 * back(k); r = c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))), Image.BILINEAR)
            cx = 60 + (i % 2) * 510 + 225; cy = 470 + (i // 2) * 330 + 150
            drop(im, with_alpha(r, ease(k * 2)), cx - r.width / 2, cy - r.height / 2, a=0.25, blur=20, dy=14)
        return im.convert('RGB')


class End:
    """끝 장면 — 밝은 표지 결 그대로, 주소와 검색어를 크게 (오른쪽 유튜브 단추 자리는 비움)"""
    def __init__(self, dur):
        self.dur = dur; im = cover(os.path.join(IMG, 'anbu', 'a05.jpg'), W, H, fx=.3).convert('RGBA')
        im.alpha_composite(Image.new('RGBA', (W, H), (6, 30, 52, 120)))
        cx = W // 2 - 40
        lg = Image.open(os.path.join(ROOT, 'logo-light.png')).convert('RGBA'); lg = lg.resize((420, int(420 * lg.height / lg.width)), Image.LANCZOS)
        im.alpha_composite(lg, (cx - lg.width // 2, 300))
        text(im, (cx, 300 + lg.height + 50), '오늘도 마음은 주니어', F(B, 50), WHITE, sh=160)
        text(im, (cx, 920), 'omaju.kr', F(K, 150), YEL, sh=180)
        p = chip('네이버·구글에서 "오마주 매거진" 검색', (255, 255, 255, 255), INK, size=42)
        im.alpha_composite(p, (cx - p.width // 2, 1060))
        text(im, (cx, 1270), '매일 아침 새로운 무료 매거진', F(B, 46), WHITE, sh=160)
        self.im = im.convert('RGB')

    def frame(self, t): return self.im


def ep1(cap):
    j = lambda n: os.path.join(cap, n)
    return [
        Cover(3.2),
        Series(3.6),
        Phone(j('ai.png'), 5.5, (219, 234, 254), (37, 99, 235, 255), 'AI 시대에 살 준비가 되었는가', 'AI, 겁낼 것 없이', '오늘부터 써 보기', 1300),
        Phone(j('ev.png'), 5.5, (214, 243, 226), (16, 150, 96, 255), '전기차 시대', '전기차 시대,', '무엇이 달라질까', 1300),
        Phone(j('trip.png'), 5.5, (255, 228, 214), (240, 96, 48, 255), '요즘 여행법', '해외여행,', '이렇게 달라졌어요', 1300),
        Grid(4.8),
        Phone(j('home.png'), 5.0, (243, 240, 233), INK, '가입 없이 바로', '휴대폰에 앱처럼 놓고,', '친구에게 카톡으로', 4400, y0=4150),
        End(3.6),
    ]


EPS = {'ep1': ep1}


def render(scenes, out, music=os.path.join(ROOT, 'music', 'morning.mp3')):
    starts, t = [], 0.0
    for s in scenes: starts.append(t); t += s.dur - X
    total = t + X
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-i', music, '-filter_complex', f'[1:a]atrim=start={MUSIC_AT}:duration={total:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.12,afade=t=out:st={total - 1.6:.2f}:d=1.6,volume=0.9[a]',
                          '-map', '0:v', '-map', '[a]', '-t', f'{total:.2f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                          '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for n in range(int(round(total * FPS))):
        tt = n / FPS; cur = [i for i, st in enumerate(starts) if st <= tt < st + scenes[i].dur] or [len(scenes) - 1]
        i = cur[-1]; fr = scenes[i].frame(min(tt - starts[i], scenes[i].dur))
        if len(cur) > 1:
            j = cur[0]; fr = Image.blend(scenes[j].frame(tt - starts[j]), fr, ease((tt - starts[i]) / X))
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait(); return total


if __name__ == '__main__':
    ep, cap, out = sys.argv[1], sys.argv[2], sys.argv[3]
    print('길이', round(render(EPS[ep](cap), out), 1), '초 →', out)
