"""연재 만화 '마음은 주니어' 쇼츠 (대표 2026-11-12 — 만든 것은 쇼츠·블로그·카톡으로 같이 나간다).
tools/comic_img.js 가 뜬 컷 그림(p1~p4.png, ep.json)으로 20초 안팎 쇼츠를 만든다. 목소리 없음 → AI 표시 안 함.
첫 프레임부터 음악 + 굵은 제목 + 첫 컷(대표: 첫 1~2초가 전부). 끝은 '내일 N화' 예고 + '오마주 매거진' 검색.
  python3 tools/comic_short.py <컷 폴더> <나갈 mp4>"""
import os, sys, json, math, subprocess
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
import shorts_end as SE

W, H, FPS = 1080, 1920, 30
F = SE._font
K = SE._fc('Noto Sans CJK KR:style=Black'); B = SE._fc('Noto Sans CJK KR:style=Bold')
INK = (24, 22, 20, 255); WHITE = (255, 255, 255, 255); YEL = (249, 233, 168, 255)
MUSIC_AT = 10.6
PER = 3.4       # 컷마다 머무는 시간
X = 0.35


def ease(x):
    x = max(0.0, min(1.0, x)); return 0.5 - 0.5 * math.cos(math.pi * x)


def text(im, xy, t, f, fill, anchor='mm'):
    ImageDraw.Draw(im).text(xy, t, font=f, fill=fill, anchor=anchor)


def fitf(t, maxw, path, size, mn=40):
    d = ImageDraw.Draw(Image.new('RGB', (1, 1))); z = size
    while z > mn and d.textlength(t, font=F(path, z)) > maxw: z -= 4
    return F(path, z)


def build(cap):
    ep = json.load(open(os.path.join(cap, 'ep.json'), encoding='utf-8'))
    n = len([f for f in os.listdir(cap) if f.startswith('p') and f.endswith('.png')])
    pans = []
    for i in range(1, n + 1):
        im = Image.open(os.path.join(cap, f'p{i}.png')).convert('RGB').resize((1000, 760), Image.LANCZOS)
        pans.append(im)
    # 바탕: 연노랑 종이 + 위 머리(연재 만화 · N화 · 제목) — 첫 프레임부터 다 떠 있다
    bg = Image.new('RGBA', (W, H), (251, 240, 204, 255))
    d = ImageDraw.Draw(bg)
    text(bg, (W // 2, 170), '연재 만화 · 마음은 주니어', F(B, 46), (107, 90, 46, 255))
    t1 = f"{ep['no']}화"; text(bg, (W // 2, 285), t1, F(K, 96), INK)
    tf = fitf(ep['title'], W - 120, K, 84); text(bg, (W // 2, 410), ep['title'], tf, INK)
    d.rectangle((W // 2 - 50, 478, W // 2 + 50, 486), fill=(232, 98, 47, 255))
    return ep, pans, bg


def frame_panels(bg, pans, i, t):
    """i 번째 컷이 t 초째 — 살짝 다가가며(1.0→1.04) 들어올 때 아래에서 떠오른다"""
    im = bg.copy()
    p = pans[i]; z = 1.0 + 0.04 * ease(t / PER)
    w, h = int(1000 * z), int(760 * z)
    pz = p.resize((w, h), Image.BILINEAR)
    rise = int((1 - ease(t / 0.35)) * 60)
    x, y = (W - w) // 2, 560 + (760 - h) // 2 + rise
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rectangle((x + 8, y + 22, x + w - 8, y + h + 22), fill=(60, 40, 0, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24))); im.paste(pz, (x, y))
    # 컷 번호 점 넷
    for k in range(len(pans)):
        ImageDraw.Draw(im).ellipse((W // 2 - 60 + k * 40 - 9, 1420 - 9, W // 2 - 60 + k * 40 + 9, 1420 + 9), fill=INK if k == i else (205, 190, 150, 255))
    return im.convert('RGB')


def end_card(ep):
    im = Image.new('RGBA', (W, H), (24, 22, 20, 255))
    cx = W // 2 - 40   # 오른쪽 유튜브 단추 자리를 비운다
    text(im, (cx, 520), '내일 아침', F(B, 54), YEL)
    text(im, (cx, 640), f"{ep['no'] + 1}화 공개", F(K, 110), WHITE)
    if ep.get('next'):
        nx = ep['next']; words = nx.split(' '); lines, cur = [], ''
        for wd in words:
            t = (cur + ' ' + wd).strip()
            if ImageDraw.Draw(im).textlength(t, font=F(B, 52)) > W - 220: lines.append(cur); cur = wd
            else: cur = t
        lines.append(cur)
        for k, l in enumerate(lines[:3]): text(im, (cx, 800 + k * 76), l, F(B, 52), (230, 226, 216, 255))
    text(im, (cx, 1130), 'omaju.kr', F(K, 120), YEL)
    pill = '네이버·구글에서 "오마주 매거진" 검색'; f = F(B, 40); tw = ImageDraw.Draw(im).textlength(pill, font=f)
    ImageDraw.Draw(im).rounded_rectangle((cx - tw / 2 - 36, 1230, cx + tw / 2 + 36, 1316), radius=43, fill=WHITE)
    text(im, (cx, 1273), pill, f, INK)
    return im.convert('RGB')


def render(cap, out, music=os.path.join(SE.ROOT, 'music', 'morning.mp3')):
    ep, pans, bg = build(cap)
    end = end_card(ep); END = 3.4
    total = len(pans) * PER + END
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-i', music, '-filter_complex', f'[1:a]atrim=start={MUSIC_AT}:duration={total:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.12,afade=t=out:st={total - 1.6:.2f}:d=1.6,volume=0.9[a]',
                          '-map', '0:v', '-map', '[a]', '-t', f'{total:.2f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                          '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for f in range(int(round(total * FPS))):
        t = f / FPS
        if t < len(pans) * PER:
            i = int(t // PER); fr = frame_panels(bg, pans, i, t - i * PER)
        else:
            k = (t - len(pans) * PER) / X
            fr = end if k >= 1 else Image.blend(frame_panels(bg, pans, len(pans) - 1, PER), end, ease(k))
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait()
    return ep, total


if __name__ == '__main__':
    cap, out = sys.argv[1], sys.argv[2]
    ep, total = render(cap, out)
    print('길이', round(total, 1), '초 →', out)
