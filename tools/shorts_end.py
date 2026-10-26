"""쇼츠 끝 장면 (홍보국 요청, 대표 2026-10-26: "유튜브에서 넘어온 사람이 0명").
쇼츠 설명란·댓글 링크는 유튜브가 누르지 못하게 막아 두었다 → 영상 마지막 2.5초에 주소와 검색어를 크게 보여
보는 사람이 직접 치거나 검색해서 들어오게 한다. 오른쪽(유튜브 단추)·아래(제목 글씨) 자리는 비운다."""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont
W, H = 1080, 1920
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREEN, GOLD, CREAM = (12, 36, 27), (232, 210, 150, 255), (232, 220, 190, 255)
SEC = 2.6   # 끝 장면 길이(초)
FADE = 0.4  # 앞 장면에서 넘어오는 겹침(초)

def _fc(p):
    try: return subprocess.run(['fc-match', '-f', '%{file}', p], capture_output=True, text=True).stdout.strip()
    except Exception: return ''
SERIF_B = _fc('NanumMyeongjo:style=ExtraBold'); SERIF = _fc('NanumMyeongjo:style=Regular')
if 'Nanum' not in SERIF_B: SERIF_B = _fc('Noto Serif CJK KR:style=Bold')
if 'Nanum' not in SERIF: SERIF = _fc('Noto Serif CJK KR:style=Regular')
def _font(path, size):
    try: return ImageFont.truetype(path, size, index=1 if path.endswith('.ttc') else 0)
    except Exception: return ImageFont.truetype(path, size)
def _text(im, xy, t, f, fill=(255, 255, 255, 255), blur=10):
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((xy[0] + 2, xy[1] + 4), t, font=f, fill=(0, 0, 0, 170), anchor='mm')
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur))); ImageDraw.Draw(im).text(xy, t, font=f, fill=fill, anchor='mm')

_cache = {}
def card(lead='오늘 호 전체는'):
    """끝 장면 한 장 (RGB). lead: 맨 위 작은 줄 — 쇼츠마다 다르게(한 끼: '레시피 전체는')"""
    if lead in _cache: return _cache[lead]
    im = Image.new('RGBA', (W, H), GREEN + (255,))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse((60, 380, 960, 1380), fill=(40, 90, 64, 150))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(160)))
    cx = W // 2 - 40   # 오른쪽엔 유튜브 단추가 얹힌다
    try:
        lg = Image.open(os.path.join(ROOT, 'logo-light.png')).convert('RGBA'); lg = lg.resize((330, int(330 * lg.height / lg.width)), Image.LANCZOS)
        im.alpha_composite(lg, (cx - lg.width // 2, 420))
    except Exception: pass
    _text(im, (cx, 790), lead, _font(SERIF, 46), fill=CREAM)
    _text(im, (cx, 905), 'omaju.kr', _font(SERIF_B, 132), fill=GOLD, blur=14)
    d = ImageDraw.Draw(im); d.line([(cx - 70, 1010), (cx + 70, 1010)], fill=(201, 169, 97, 255), width=2)
    _text(im, (cx, 1090), '네이버·구글에서', _font(SERIF, 50), fill=CREAM)
    _text(im, (cx, 1185), '"오마주 매거진" 검색', _font(SERIF_B, 76))
    _text(im, (cx, 1300), '매일 아침 새로 나오는 무료 매거진', _font(SERIF, 36), fill=(200, 210, 200, 255))
    _cache[lead] = im.convert('RGB'); return _cache[lead]

def frames(last, fps, lead='오늘 호 전체는'):
    """마지막 장면(last, RGB)에서 끝 장면으로 넘어가는 프레임들을 차례로 낸다"""
    c = card(lead); n, nf = int(SEC * fps), int(FADE * fps)
    for k in range(n):
        yield Image.blend(last, c, min(1.0, (k + 1) / max(1, nf))) if k < nf else c

if __name__ == '__main__':
    import sys
    card(sys.argv[1] if len(sys.argv) > 1 else '오늘 호 전체는').save(sys.argv[2] if len(sys.argv) > 2 else '/tmp/end.png')
