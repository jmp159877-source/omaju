# 오마주 유튜브 쇼츠 ③ 오늘의 한 끼 — '받아 적는 레시피 카드' 20초 남짓 (대표 2026-10-24)
#  사진은 음식이 아니라 우리 부엌·식탁 사진(음식 모양을 지어내지 않는다). 재료 → 만드는 법 → 요령이 한 장씩, 끝에 '레시피 전체는 오마주 매거진에서'. 밖에 내보내는 이름은 언제나 '오마주 매거진'(대표 2026-10-24, 상표 출원).
#  목소리 없이 낮 음악만 → AI 표시 필요 없음. 게시는 11:30(점심 메뉴 고를 때) — yt_upload.py WHEN['meal'].
# 쓰는 법: python3 tools/shorts_meal.py YYYY-MM-DD   (MEDIA_DIR=media)  → media/shorts/<날짜>-meal.mp4, <날짜>.json 의 meal·meal_up
import os, sys, json, subprocess, datetime
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
KST = datetime.timezone(datetime.timedelta(hours=9))
DATE = next((a for a in sys.argv[1:] if not a.startswith('--')), None) or datetime.datetime.now(KST).strftime('%Y-%m-%d')
MEDIA = os.environ.get('MEDIA_DIR', 'media'); OUT = os.path.join(MEDIA, 'shorts'); os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1080, 1920, 24
D = datetime.date.fromisoformat(DATE); DOW = '월화수목금토일'[D.weekday()]

def fc(p):
    try: return subprocess.run(['fc-match', '-f', '%{file}', p], capture_output=True, text=True).stdout.strip()
    except Exception: return ''
# 사이트 안쪽과 같은 결의 고딕 — 깃허브 작업은 fonts-nanum(나눔고딕), 여기는 노토 산스
BOLD = fc('NanumGothic:style=ExtraBold'); REG = fc('NanumGothic:style=Regular')
if 'Nanum' not in BOLD: BOLD = fc('Noto Sans CJK KR:style=Bold')
if 'Nanum' not in REG: REG = fc('Noto Sans CJK KR:style=Regular')
def font(path, size):
    try: return ImageFont.truetype(path, size, index=1 if path.endswith('.ttc') else 0)
    except Exception: return ImageFont.truetype(path, size)
def fit(txt, path, size, maxw):
    d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    while size > 30 and d.textlength(txt, font=font(path, size)) > maxw: size -= 2
    return font(path, size)
def wrap(txt, f, maxw):
    """한국어 낱말 단위로 줄 바꿈"""
    d = ImageDraw.Draw(Image.new('RGB', (10, 10))); out, cur = [], ''
    for w in txt.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out
def shadow_text(im, xy, txt, f, fill=(255, 255, 255, 255), anchor='mm', blur=6, alpha=170):
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((xy[0] + 2, xy[1] + 4), txt, font=f, fill=(0, 0, 0, alpha), anchor=anchor)
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur))); ImageDraw.Draw(im).text(xy, txt, font=f, fill=fill, anchor=anchor)
def cover(im, w, h, zoom=1.0, fy=0.5):
    s = max(w / im.width, h / im.height) * zoom; cw, ch = w / s, h / s
    x0 = (im.width - cw) / 2; y0 = (im.height - ch) * fy
    return im.transform((w, h), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BICUBIC)

GREEN, GSOFT, INK, SUB = (31, 90, 62, 255), (238, 245, 240, 255), (26, 26, 26, 255), (95, 99, 96, 255)
YEL, YTXT, YLAB, GOLD = (255, 247, 219, 255), (58, 46, 0, 255), (138, 106, 0, 255), (232, 210, 150, 255)

def load_meal():
    for p in (os.path.join(ROOT, 'daily', DATE + '.json'),):
        try:
            d = json.load(open(p, encoding='utf-8'))
            if d.get('meal', {}).get('title'): return d['meal'], ((d.get('hooks') or {}).get('food') or {})
        except Exception: pass
    return None, {}

def tag(dr, x, y, txt, f, bg=GSOFT, fg=GREEN, pad=(22, 12)):
    w = dr.textlength(txt, font=f); h = f.size
    dr.rounded_rectangle((x, y, x + w + pad[0] * 2, y + h + pad[1] * 2), 12, fill=bg)
    dr.text((x + pad[0], y + pad[1] + h * 0.5), txt, font=f, fill=fg, anchor='lm'); return y + h + pad[1] * 2

def panel_ing(meal):
    """재료 판 — 흰 둥근 판, 초록 표, 동그란 재료 칩"""
    pw = 920; im = Image.new('RGBA', (pw, 1200), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    fT, fC = font(BOLD, 40), font(BOLD, 46)
    y = tag(dr, 50, 50, '재료', fT) + 34; x = 50
    for it in meal['ingredients']:
        # 한 칩이 판보다 길면(양념 묶음 등) 그 칩만 글씨를 줄여 판 안에 넣는다 (10/25 '조림 양념(…)'이 오른쪽으로 잘렸다)
        fc_ = fC if dr.textlength(it, font=fC) + 64 <= pw - 100 else fit(it, BOLD, 46, pw - 100 - 64)
        w = dr.textlength(it, font=fc_) + 64
        if x + w > pw - 50: x = 50; y += 110
        dr.rounded_rectangle((x, y, x + w, y + 92), 46, fill=(244, 244, 239, 255)); dr.text((x + 32, y + 46), it, font=fc_, fill=INK, anchor='lm'); x += w + 16
    sub = meal.get('sub', '')
    if sub: y += 140; dr.text((50, y), sub, font=font(REG, 38), fill=SUB, anchor='lm'); y += 30
    return im, y + 60

def panel_steps(meal, upto):
    pw = 920; im = Image.new('RGBA', (pw, 1400), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    fT, fB = font(BOLD, 40), font(REG, 44)
    y = tag(dr, 50, 50, '만드는 법', fT) + 40
    for i, s in enumerate(meal['steps'][:3]):
        a = 255 if i < upto else 0
        if a == 0: break
        dr.ellipse((50, y, 120, y + 70), fill=GREEN); dr.text((85, y + 36), str(i + 1), font=font(BOLD, 40), fill=(255, 255, 255, 255), anchor='mm')
        lines = wrap(s, fB, pw - 200)
        for j, ln in enumerate(lines): dr.text((150, y + 35 + j * 66), ln, font=fB, fill=INK, anchor='lm')
        y += max(1, len(lines)) * 66 + 50
    return im, y + 20

def panel_tip(meal):
    pw = 920; im = Image.new('RGBA', (pw, 1000), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    fB = font(REG, 46); lines = wrap(meal.get('tip', ''), fB, pw - 180)
    h = 150 + len(lines) * 70
    dr.rounded_rectangle((50, 50, pw - 50, 50 + h), 30, fill=YEL)
    dr.text((100, 120), '요령', font=font(BOLD, 40), fill=YLAB, anchor='lm')
    for j, ln in enumerate(lines): dr.text((100, 200 + j * 70), ln, font=fB, fill=YTXT, anchor='lm')
    return im, 50 + h + 60

def build():
    meal, hook = load_meal()
    if not meal: print('오늘 한 끼 없음', DATE); return None
    # 배경은 세로 사진 서너 장(img/shorts-meal-*.jpg)을 날마다 돌린다 — 없으면 사이트 한 끼 칸 사진
    import glob
    bgs = sorted(glob.glob(os.path.join(ROOT, 'img', 'shorts-meal-*.jpg'))) or [os.path.join(ROOT, 'img', 'food.jpg')]
    bg_src = Image.open(bgs[int(os.environ.get('SHORTS_BG', D.toordinal())) % len(bgs)]).convert('RGB')
    no = (D - datetime.date(2026, 10, 22)).days + 1          # 연재 번호 — 창간일(10/22)이 1호
    facts = ' · '.join(x for x in meal.get('sub', '').split(' · ') if '인분' not in x)
    l1 = (hook.get('hook') or meal.get('lead', '')[:18]).replace('\n', ' ').strip(); l2 = meal['title']
    scenes = [(2.4, 'cover'), (5.0, 'ing'), (2.8, 's1'), (2.8, 's2'), (3.2, 's3'), (4.6, 'tip')]
    total = sum(s for s, _ in scenes)
    # 미리 그려 두는 판 (장면마다 한 번)
    P = {'ing': panel_ing(meal), 's1': panel_steps(meal, 1), 's2': panel_steps(meal, 2), 's3': panel_steps(meal, 3), 'tip': panel_tip(meal)}
    band = Image.new('RGBA', (W, 600)); bd = ImageDraw.Draw(band)
    for yy in range(600): bd.line([(0, yy), (W, yy)], fill=(8, 30, 22, int(240 * (1 - (yy / 600) ** 2.4))))
    def series(o, cx, cy, size):
        """'오늘의 한 끼' + 노란 No.n 딱지를 한 줄 가운데에"""
        f = font(BOLD, size); fn = font(BOLD, int(size * 0.62)); d = ImageDraw.Draw(o)
        a = d.textlength('오늘의 한 끼', font=f); nt = f'No.{no}'; b = d.textlength(nt, font=fn) + size * 0.5
        x0 = cx - (a + 24 + b) / 2
        shadow_text(o, (x0, cy), '오늘의 한 끼', f, anchor='lm')
        bx = x0 + a + 24; bh = fn.size * 1.45
        d.rounded_rectangle((bx, cy - bh / 2, bx + b, cy + bh / 2), bh / 2, fill=(249, 233, 168, 255))
        d.text((bx + b / 2, cy + 2), nt, font=fn, fill=(58, 46, 0, 255), anchor='mm')
    def top(o):
        o.alpha_composite(band)
        ImageDraw.Draw(o).text((W // 2, 170), f'{D.month}월 {D.day}일 {DOW}요일 · 매일 연재', font=font(REG, 34), fill=GOLD, anchor='mm')
        series(o, W // 2, 262, 84)
        shadow_text(o, (W // 2, 370), l2, fit(l2, BOLD, 76, 980), fill=(249, 233, 168, 255))
        shadow_text(o, (W // 2, 450), l1, fit(l1, REG, 40, 960), fill=(232, 220, 190, 255))
    def frame(k):
        t = k / FPS; z = 1.0 + 0.06 * (t / total)
        o = cover(bg_src, W, H, zoom=z, fy=0.5).convert('RGBA')
        o.alpha_composite(Image.new('RGBA', (W, H), (8, 30, 22, 40)))
        acc = 0
        for i, (dur, name) in enumerate(scenes):
            if t < acc + dur or i == len(scenes) - 1: break
            acc += dur
        p = min(1.0, (t - acc) / 0.45)            # 판이 나타나는 정도
        if name == 'cover':
            # 첫 화면이 곧 썸네일 — 쇼츠는 따로 만든 표지를 못 올리고 영상 속 장면이 표지가 된다
            o.alpha_composite(Image.new('RGBA', (W, H), (8, 30, 22, 120)))
            d = ImageDraw.Draw(o); cy = H * 0.40
            f0 = font(REG, 40); t0 = '매일 아침 새 레시피 · 오마주 매거진'; w0 = d.textlength(t0, font=f0)
            d.rounded_rectangle((W / 2 - w0 / 2 - 30, cy - 250, W / 2 + w0 / 2 + 30, cy - 180), 35, outline=GOLD, width=3)
            d.text((W / 2, cy - 214), t0, font=f0, fill=GOLD, anchor='mm')
            series(o, W // 2, cy - 60, 130)
            shadow_text(o, (W // 2, cy + 110), l2, fit(l2, BOLD, 120, 1000), fill=(249, 233, 168, 255), blur=10, alpha=200)
            if facts: shadow_text(o, (W // 2, cy + 240), facts, font(BOLD, 54))
            shadow_text(o, (W // 2, cy + 330), l1, fit(l1, REG, 44, 960), fill=(232, 220, 190, 255))
            return o.convert('RGB')
        top(o)
        if False:
            pass
        else:
            im, ph = P[name]; pw = im.width
            if name.startswith('s') and name != 's1': p = 1.0       # 단계는 판은 그대로, 줄만 하나씩 늘어난다
            y0 = 640 + (1 - p) * 40
            card = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
            x0 = (W - pw) / 2
            sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 16, x0 + pw, y0 + ph + 16), 36, fill=(0, 0, 0, int(110 * p)))
            o.alpha_composite(sh.filter(ImageFilter.GaussianBlur(20)))
            cd.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), 36, fill=(255, 255, 255, int(250 * p)))
            o.alpha_composite(card)
            layer = im.transform((W, H), Image.AFFINE, (1, 0, -x0, 0, 1, -y0), Image.BICUBIC, fillcolor=(0, 0, 0, 0))
            if p < 1: layer.putalpha(layer.getchannel('A').point(lambda a: int(a * p)))
            o.alpha_composite(layer)
            if name == 'tip':
                lb = Image.new('RGBA', (W, 520)); ld = ImageDraw.Draw(lb)
                for yy in range(520): ld.line([(0, yy), (W, yy)], fill=(8, 30, 22, int(215 * min(1, yy / 300) ** 1.6)))
                o.alpha_composite(lb, (0, H - 520))
                shadow_text(o, (W // 2, H - 330), '레시피 전체는 오마주 매거진에서', font(BOLD, 52))
                shadow_text(o, (W // 2, H - 255), '네이버·구글에서 "오마주 매거진" 검색', font(REG, 36), fill=(232, 220, 190, 255))
        return o.convert('RGB')
    out = os.path.join(OUT, DATE + '-meal.mp4')
    if os.path.exists(out) and '--force' not in sys.argv and '--stills' not in sys.argv:
        print('한 끼 쇼츠 이미 있음 — 설명만 다시 붙임')     # shorts.py 가 다시 돌면 json 을 새로 쓰므로 meal_up 은 매번 붙인다
        return {'file': os.path.basename(out), 'sec': round(total, 1), 'title': meal['title'], 'hook': l1, 'no': no, 'facts': facts}, meal
    if '--stills' in sys.argv:
        acc = 0
        for dur, name in scenes:
            frame(int((acc + dur * 0.8) * FPS)).save(os.path.join(OUT, f'{DATE}-meal-{name}.png')); acc += dur
        sys.exit(0)
    out = os.path.join(OUT, DATE + '-meal.mp4')
    music = os.path.join(ROOT, 'music', 'noon.mp3')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', music,
           '-filter_complex', f'[1:a]atrim=0:{total:.2f},afade=t=in:d=0.8,afade=t=out:st={total - 1.6:.2f}:d=1.6[a]', '-map', '0:v', '-map', '[a]',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(int(total * FPS)): pr.stdin.write(frame(k).tobytes())
    pr.stdin.close(); pr.wait()
    if pr.returncode: raise SystemExit('ffmpeg 실패')
    print('한 끼 쇼츠', round(total, 1), '초')
    return {'file': os.path.basename(out), 'sec': round(total, 1), 'title': meal['title'], 'hook': l1, 'no': no, 'facts': facts}, meal

if __name__ == '__main__':
    r = build()
    if not r: sys.exit(0)
    info_m, meal = r
    jp = os.path.join(OUT, DATE + '.json')
    try: info = json.load(open(jp, encoding='utf-8'))
    except Exception: info = {'date': DATE}
    info['meal'] = info_m
    info['meal_up'] = {
        'title': (f'오늘의 한 끼 No.{info_m["no"]} · {meal["title"]}' + (f' | {info_m["facts"].split(" · ")[0]} 집밥 레시피' if info_m.get('facts') else ' | 집밥 레시피') + ' #shorts')[:95],
        'desc': f'{meal.get("lead", "")}\n\n재료: {", ".join(meal["ingredients"])}\n\n' + '\n'.join(f'{i + 1}. {s}' for i, s in enumerate(meal['steps'])) +
                f'\n\n요령: {meal.get("tip", "")}\n\n매일 아침 새로 나오는 무료 매거진, 오마주 매거진 👉 https://omaju.kr/?from=yt\n네이버에서 "오마주 매거진"\n\n#오늘의한끼 #레시피 #집밥 #오늘뭐먹지 #오마주매거진',
        'tags': ['오늘의한끼', '레시피', '집밥', '오늘뭐먹지', '간단요리', '점심메뉴', meal['title'].replace(' ', ''), '오마주매거진', '오마주'],
        'ai': '사람·목소리가 없으니 AI 표시는 하지 않음'}
    json.dump(info, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
