"""아침에 찍은 진행자 사진을 저녁 장면으로 바꾼다 (운영자 2026-10-20).
밤 사진을 따로 받기 전까지 쓰는 임시 방편 — 창밖만 밤으로 누르고, 커튼을 가라앉히고, 실내는 등불처럼 따뜻하게.
열 장 모두 같은 자리에서 찍은 사진이라 창 자리를 한 번만 정해 두면 된다.
쓰는 법: python3 tools/night_photo.py img/hosts/eunchae-mor-*.jpg
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(11)
blur = lambda m, k: np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(k)), np.float32) / 255.0


def night(src, dst):
    a = np.asarray(Image.open(src).convert('RGB'), np.float32) / 255.0
    h, w, _ = a.shape
    L = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = xx / w, yy / h

    # 1) 창유리 → 밤하늘 (창틀처럼 어두운 곳은 그대로 둔다)
    win = np.clip((0.43 - X) / 0.10, 0, 1) * np.clip((0.72 - Y) / 0.07, 0, 1) * np.clip((L - 0.34) / 0.26, 0, 1)
    win = blur(win, 4)[..., None]
    t = np.clip((L - 0.45) / 0.55, 0, 1)
    sky = np.stack([0.085 + 0.05 * t, 0.095 + 0.06 * t, 0.130 + 0.09 * t], -1).astype(np.float32)
    # 멀리 도시 불빛 — 가로 띠처럼 모아 둔다
    dots = np.zeros((h, w), np.float32)
    for _ in range(70):
        cy = int(rng.normal(0.52, 0.045) * h); cx = int(rng.uniform(0.01, 0.37) * w)
        if 0 <= cy < h - 3: dots[cy:cy + 2, cx:cx + 2] = rng.uniform(0.45, 1.0)
    band = np.exp(-((Y - 0.52) / 0.07) ** 2) * np.clip((0.38 - X) / 0.1, 0, 1) * 0.055
    glow = blur(dots, 10) * 0.6 + blur(dots, 2)
    sky = sky + glow[..., None] * np.array([0.85, 0.70, 0.42], np.float32) + band[..., None] * np.array([1.0, 0.8, 0.5], np.float32)
    out = a * (1 - win) + np.clip(sky, 0, 1) * win

    # 2) 얇은 커튼 — 밖이 어두우니 같이 가라앉는다
    cur = np.clip((X - 0.36) / 0.08, 0, 1) * np.clip((0.66 - X) / 0.08, 0, 1) * np.clip((0.62 - Y) / 0.10, 0, 1)
    cur = blur(cur, 25)[..., None]
    out = out * (1 - cur) + out * cur * np.array([0.62, 0.56, 0.50], np.float32)

    # 3) 창 밑 벽도 조금
    wall = blur(np.clip((0.40 - X) / 0.10, 0, 1) * np.clip((Y - 0.70) / 0.08, 0, 1), 25)[..., None]
    out = out * (1 - wall * 0.30)

    # 4) 실내는 저녁 등불 결로
    out = out * 0.92 * np.array([1.06, 1.00, 0.90], np.float32)
    out = np.clip((out - 0.5) * 1.05 + 0.5 + 0.010, 0, 1)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    out = out * (1 - 0.14 * np.clip((r - 0.75) / 0.75, 0, 1))[..., None]
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(dst, quality=90, optimize=True)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        q = p.replace('-mor-', '-eve-')
        night(p, q); print(os.path.basename(q))
