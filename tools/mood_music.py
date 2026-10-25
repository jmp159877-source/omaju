"""'오늘의 음악과 함께' 견본 (대표 2026-10-25): 상황별 연주곡을 구글 Lyria 로 직접 만든다 — 저작권·광고 걱정 없이.
결과: out_mood/<이름>_<n>.mp3 + report.txt → mood-try 가지 (사이트에는 아직 안 넣는다)
쓰는 법: ONLY=walk TAKES=3 python3 tools/mood_music.py"""
import os, sys, json, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('GEMINI_API_KEY', '')
import importlib.util
spec = importlib.util.spec_from_file_location('mm_src', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music_make.py'))
src = open(spec.origin, encoding='utf-8').read().split("# 상황마다 TAKES 번 만들어 KEEP 곡을 남긴다 → out_mood/<상황>/<n>.mp3 (-16 LUFS, 앞뒤 살짝 페이드, 96k) + list.json
TAKES = int(os.environ.get('TAKES', '10')); KEEP = int(os.environ.get('KEEP', '8'))
ONLY = [x for x in os.environ.get('ONLY', ','.join(PROMPT)).split(',') if x in PROMPT]
lst = {}
try: lst = json.load(open('out_mood/list.json'))
except Exception: pass
for k in ONLY:
    text = PROMPT[k]; say(f'\n=== {k} — {KO[k]} ==='); os.makedirs(f'out_mood/{k}', exist_ok=True); got = []
    for t in range(1, TAKES + 1):
        if len(got) >= KEEP: break
        raw = f'out_mood/_raw.mp3'
        try: open(raw, 'wb').write(make(text))
        except Exception as e: say(t, '만들기 실패', str(e)[:150]); time.sleep(20); continue
        clip(raw, 'out_mood/_c.mp3'); v = judge('out_mood/_c.mp3', KO[k])
        ok = (not v.get('vocal')) and int(v.get('grade') or 0) >= 4
        say(f"{t}번째 | {v.get('instrument')} | {v.get('mood')} | {v.get('grade')}점 | 목소리 {v.get('vocal')} | {'씀' if ok else '버림'}")
        if not ok: continue
        n = len(got) + 1; dst = f'out_mood/{k}/{n}.mp3'
        dur = float(subprocess.run(['ffprobe', '-loglevel', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw], capture_output=True, text=True).stdout.strip() or 0)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-af', f'loudnorm=I=-16:TP=-1.5:LRA=8,afade=t=in:d=1.2,afade=t=out:st={max(0, dur - 2.5):.2f}:d=2.5',
                        '-ac', '2', '-ar', '44100', '-b:a', '96k', dst], check=True)
        got.append({'f': f'{k}/{n}.mp3', 'sec': round(dur), 'mood': v.get('mood', ''), 'inst': v.get('instrument', '')})
        time.sleep(4)
    lst[k] = got; json.dump(lst, open('out_mood/list.json', 'w'), ensure_ascii=False, indent=1)
    say(k, '남긴 곡', len(got))
say('끝')
