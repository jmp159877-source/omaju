# 인사 카드 그림을 검색용으로 남긴다 (대표 2026-10-25: "이미지 검색에 1도 안 걸린다").
# tools/shorts_cards.mjs 가 그린 card1~4.png 를 greet/img/<날짜>-N.jpg (가로 900, 가벼운 JPEG) 로 옮긴다.
# 쓰는 법: python3 tools/greet_imgs.py YYYY-MM-DD 그림폴더
import os, sys, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d, src = sys.argv[1], sys.argv[2]
out = os.path.join(ROOT, 'greet', 'img'); os.makedirs(out, exist_ok=True)
n = 0
for f in sorted(glob.glob(os.path.join(src, 'card*.png'))):
    i = int(os.path.basename(f)[4:-4])
    im = Image.open(f).convert('RGB')
    if im.width > 900: im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    im.save(os.path.join(out, f'{d}-{i}.jpg'), quality=84, optimize=True, progressive=True); n += 1
print('인사 카드 그림', d, n, '장')
