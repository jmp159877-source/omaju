# 장(章) 음성 안내 '읽어 드려요' — 장마다 오늘 올라온 것을 코너별로 읽어 주는 3~5분짜리.
# 오프닝과 같은 진행자·같은 틀을 쓴다(tools/opening.py 의 녹음·자르기 함수를 그대로 가져다 씀).
# 결과: MEDIA_DIR/radio/{날짜}-{장}.json, {날짜}-{장}.mp3  (media 가지, 최근 3일만)
# 쓰는 법: python3 tools/radio.py [YYYY-MM-DD] [--only=g1] [--force]
import os, sys, json, re, time, datetime, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('MEDIA_DIR', os.environ.get('MEDIA_DIR', 'media'))
import opening as OP   # 녹음(tts) · 높이(f0) · 쉼 자리 찾기(split) · 자르기(cut) · 묶기(merge)

KEY = os.environ['GEMINI_API_KEY']
MEDIA = os.environ.get('MEDIA_DIR', 'media')
OUT = os.path.join(MEDIA, 'radio')
os.makedirs(OUT, exist_ok=True)
KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORCE = '--force' in sys.argv
ONLY = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), None)
DATE = args[0] if args else datetime.datetime.now(KST).strftime('%Y-%m-%d')
D = datetime.date.fromisoformat(DATE)
WD = '월화수목금토일'[D.weekday()]
NAME = {'miso': '윤미소', 'hangyeol': '서한결'}
LOG = []


def say(*a):
    s = ' '.join(map(str, a)); print(s, flush=True); LOG.append(s)


# ── 장마다 누가 읽고 어떤 코너가 들어 있나 (화면 차례 그대로) ──
CH = {
    'g1': {'host': 'miso', 'title': '오늘 즐기기',
           'corners': [('play', '오늘 PLAY'), ('fortune', '오늘의 운세'), ('food', '오늘의 한 끼'),
                       ('book', '오늘의 한 권'), ('quiz', '오늘의 시사 상식'), ('culture', '오늘의 문화')]},
}

# 배경 음악은 말 밑에 아주 낮게만 (오프닝보다 조용하게 — 4~5분을 듣는 것이라 피곤하면 안 된다)
LEAD, TAIL, TOP, BED = 1.2, 2.5, 0.22, 0.06

PROMPT = '''오늘은 {date}년 {wd}요일. 당신은 '오마주'의 진행자 {name}입니다.
'{title}' 장을 **눈으로 읽지 않고 귀로만 듣는 사람**에게 들려주는 음성 안내 대본을 씁니다.

[누가 듣나]
나이는 50~60이지만 생각과 생활은 40대인 사람. 설거지하면서, 산책하면서, 지하철에서 이어폰을 끼고 듣습니다.
화면을 보지 않을 수도 있습니다. 그러니 "여기 보시면" "아래에 있습니다" 같은 말을 쓰지 않습니다.

[무엇을 하나 — 가장 중요]
**목차를 읽어 주는 것이 아니라 방송을 하는 것입니다.**
나쁜 예: "오늘의 한 끼가 준비되어 있습니다. 눌러서 확인해 보세요."
좋은 예: "오늘 한 끼는 배추 겉절이 덮밥이에요. 배추를 센 불에 짧게 볶는 게 요령이라는데, 수분이 덜 나와서 아삭한 결이 산다고 하네요."
짧은 글(명언 같은 것)은 **그냥 읽어 주세요.** 긴 글은 알맹이를 간추려 들려주세요.
듣고 나면 "화면을 안 봐도 반은 들은 셈"이 되어야 합니다. 궁금한 사람만 눌러 보게.

[말씨]
부드러운 구어체 — "~예요 / ~죠 / ~거든요 / ~더라고요". "~입니다"로만 끝나는 보도 말투 금지.
친구나 동생 같은 사람이 옆에서 들려주듯. 들뜬 톤·까부는 톤·애교는 아닙니다.
시니어·어르신·노인·치매·두뇌·은퇴·건강관리 같은 말을 쓰지 않습니다. 나이를 들먹이지 않습니다.
집안 사연(아내·남편·시어머니·손주)이나 효도 같은 옛 정서로 몰지 않습니다.
느낌표를 쓰지 않습니다(읽을 때 음이 과하게 올라갑니다).

[길이]
- open: 장을 여는 인사 두세 문장. 오늘이 며칠 무슨 요일인지 한 번 짚고, 이 장에 무엇이 있는지 한 줄로.
- items: 아래 코너 차례 그대로, 하나도 빠뜨리지 말고 하나씩. **코너마다 180~260자** (세 문장에서 다섯 문장).
- close: 닫는 인사 한두 문장. 다 듣고 나서 "아, 오늘 볼 만하네" 싶게. 사인오프는 쓰지 않습니다.
전체가 4분에서 5분 사이가 되게.

[오늘 이 장에 들어온 것]
{material}

형식(JSON만, 다른 말 없이):
{{"open":"...","items":[{{"k":"코너열쇠","say":"..."}}, ...],"close":"..."}}
items 의 k 는 반드시 다음에서 차례대로: {keys}'''


from models import pick


def gemini_json(prompt):
    for m in pick('pro')[:3]:
        try:
            d = OP.post(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}',
                        {'contents': [{'parts': [{'text': prompt}]}],
                         'generationConfig': {'responseMimeType': 'application/json', 'temperature': 1.0}}, 300)
            t = d['candidates'][0]['content']['parts'][0]['text']
            return json.loads(t), m
        except Exception as e:
            say('대본 실패', m, str(e)[:100]); time.sleep(5)
    return None, None


def daily():
    try:
        return json.load(open(os.path.join(ROOT, 'daily', DATE + '.json'), encoding='utf-8'))
    except Exception:
        return {}


def material_g1(d):
    """g1 대본에 넣어 줄 오늘 내용. 하루 종일 바뀌는 것(순위·날씨·시세)은 넣지 않는다."""
    out = []
    out.append('· 오늘 PLAY: 말모이 · 사천성 · 1 to 50 · 스도쿠 네 가지. 날마다 순위가 새로 열린다. '
               '(순위 1등 이름은 하루 종일 바뀌므로 말하지 말 것 — "오늘 순위도 새로 열렸어요" 정도로)')
    f = d.get('fortune') or {}
    if f:
        picks = [(z, v) for z, v in list(f.items())[:12] if isinstance(v, dict) and v.get('total')][:4]
        out.append('· 오늘의 운세 (열두 띠 모두 있음. 이 가운데 두세 띠만 골라 맛보기로 들려주고, 나머지는 "나머지 띠도 다 있어요" 로):\n'
                   + '\n'.join(f'   - {z}띠: {v["total"]}' for z, v in picks))
    m = d.get('meal') or {}
    if m.get('title'):
        out.append(f'· 오늘의 한 끼: {m["title"]} — {m.get("sub","")}\n   소개: {m.get("lead","")}\n'
                   f'   재료: {", ".join(m.get("ingredients", [])[:8])}\n   요령: {m.get("tip","")}')
    b = d.get('book') or {}
    if b.get('title'):
        out.append(f'· 오늘의 한 권: 《{b["title"]}》 {b.get("author","")} ({b.get("kind","")})\n'
                   f'   어떤 책: {b.get("blurb","")}\n   이런 날 읽기 좋다: {b.get("why","")}')
    q = d.get('quiz') or {}
    if q.get('term'):
        out.append(f'· 오늘의 시사 상식: {q["term"]} — {q.get("meaning","")}\n   왜 나왔나: {q.get("why","")}\n'
                   f'   (확인 문제는 화면에서 풀게 두고, 문제와 정답은 말하지 말 것)')
    c = d.get('culture') or {}
    cu = []
    p = c.get('poem') or {}
    if p.get('title'):
        cu.append(f'시: 〈{p["title"]}〉 {p.get("author","")} — {p.get("note","") or p.get("bg","")} '
                  '(※ 시 본문을 통째로 읽지 말고, 제목과 지은이, 어떤 시인지만 들려줄 것)')
    qt = c.get('quote') or {}
    if qt.get('text'):
        cu.append(f'명언: "{qt["text"]}" — {qt.get("who","")} (짧으니 그대로 읽어 줄 것)')
    h = c.get('humor') or {}
    if h.get('text'):
        cu.append(f'유머({h.get("kind","")}): {h["text"]} / 뒤집는 말: {h.get("punch","")} (라디오니까 끝까지 들려줘도 좋다)')
    e = c.get('essay') or {}
    if e.get('title'):
        cu.append(f'에세이: 〈{e["title"]}〉 — {(e.get("paras") or [""])[0][:120]}')
    pa = c.get('painting') or {}
    if pa.get('title'):
        cu.append(f'그림: 〈{pa["title"]}〉 {pa.get("artist","")} — {(pa.get("about") or "")[:120]} (그림은 눈으로 봐야 하니 보러 오라고 권할 것)')
    if cu:
        out.append('· 오늘의 문화 (여러 갈래가 있다. 전부 늘어놓지 말고 두세 가지를 골라 들려줄 것):\n'
                   + '\n'.join('   - ' + x for x in cu))
    return '\n'.join(out)


BAD = ['시니어', '어르신', '노인', '치매', '두뇌', '은퇴', '손주', '손자', '시어머니', '며느리', '효도', '내복']


def problems(s, keys):
    p = []
    try:
        if not s.get('open') or not s.get('close'): p.append('여는 말/닫는 말 없음')
        got = [x['k'] for x in s['items']]
        if got != keys: p.append(f'코너 차례가 다름 {got}')
        for x in s['items']:
            n = len(re.sub(r'\s', '', x['say']))
            if n < 120: p.append(f'{x["k"]} 너무 짧음 {n}자')
            if n > 400: p.append(f'{x["k"]} 너무 긺 {n}자')
        whole = s['open'] + ' '.join(x['say'] for x in s['items']) + s['close']
        for w in BAD:
            if w in whole: p.append('쓰지 않기로 한 말: ' + w)
        if '!' in whole: p.append('느낌표')
        if re.search(r'(아래|여기|화면 아래|밑에) (있|보)', whole): p.append('눈으로 보는 사람에게 하는 말')
        tot = len(re.sub(r'[^가-힣]', '', whole))
        if not (900 <= tot <= 1700): p.append(f'전체 길이 {tot}자 (4~5분이 되게)')
    except Exception as e:
        p.append('형식 ' + str(e)[:60])
    return p


def make_script(ch):
    c = CH[ch]; d = daily()
    keys = [k for k, _ in c['corners']]
    mat = material_g1(d) if ch == 'g1' else ''
    if not mat.strip():
        raise SystemExit('오늘 내용이 아직 없음')
    for k in range(3):
        s, m = gemini_json(PROMPT.format(date=DATE, wd=WD, name=NAME[c['host']], title=c['title'],
                                         material=mat, keys=', '.join(keys)))
        if not s: continue
        p = problems(s, keys)
        say('대본', m, '문제:', p or '없음')
        if not p: return s
    raise SystemExit('대본을 만들지 못함')


def music(mp3, dur):
    """말 밑에 아주 낮게 음악을 깐다. 없으면 말소리만."""
    src = os.path.join(ROOT, 'music', 'morning.mp3')
    if not os.path.exists(src): return 0.0, 0.0
    total = LEAD + dur + TAIL
    out = mp3 + '.mix.mp3'
    vol = (f"volume='if(lt(t,{LEAD - 0.4:.2f}),{TOP},"
           f"if(lt(t,{LEAD + 0.6:.2f}),{TOP}-{TOP - BED:.4f}*(t-{LEAD - 0.4:.2f}),{BED}))':eval=frame")
    fc = (f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(LEAD * 1000)}:all=1[v];"
          f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:{total:.2f},asetpts=N/SR/TB,{vol},"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st={total - TAIL:.2f}:d={TAIL}[m];"
          f"[v][m]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]")
    try:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-stream_loop', '-1', '-i', src,
                        '-filter_complex', fc, '-map', '[a]', '-ac', '2', '-ar', '44100', '-b:a', '96k', out], check=True)
    except Exception as e:
        say('음악 실패 — 말소리만', str(e)[:80]); return 0.0, 0.0
    os.replace(out, mp3)
    return LEAD, TAIL


def build(ch):
    path = os.path.join(OUT, f'{DATE}-{ch}.json')
    if os.path.exists(path) and not FORCE: say('이미 있음', ch); return
    c = CH[ch]; host = c['host']
    s = make_script(ch)
    segs = [{'k': 'open', 'say': s['open']}] + [{'k': x['k'], 'say': x['say']} for x in s['items']] + [{'k': 'close', 'say': s['close']}]
    text = '\n'.join(x['say'] for x in segs)

    tgt0 = OP.PITCH[host]; best = None
    for take in range(3):
        if take: time.sleep(20)
        got = OP.tts(text, host)
        if got is None: continue
        gf = OP.f0(got)
        off = abs(gf / tgt0 - 1) if (tgt0 and gf) else 0
        say(f'{take + 1}번째 녹음 높이', gf and round(gf), '기준', tgt0, '벗어남', round(off * 100, 1), '%')
        if best is None or off < best[1]: best = (got, off)
        if off <= 0.04: break
    if best is None: raise SystemExit('녹음 실패')
    pcm = best[0]

    lens = [len(re.sub(r'[^가-힣]', '', x['say'])) for x in segs]
    starts, T = OP.split(pcm, lens)
    rate = sum(lens) / T; tempo = max(1.0, min(1.18, 4.8 / rate))
    pf = OP.f0(pcm); tgt = tgt0
    cap = 0.05 if (pf and tgt and pf > tgt) else 0.10     # 끌어내리는 것은 5%까지, 올리는 것은 10%까지
    if tgt and pf and abs(pf / tgt - 1) > cap: tgt = None
    af = []
    if tgt and pf and abs(pf / tgt - 1) > 0.02:
        r = tgt / pf; af.append(f'asetrate={int(24000 * r)},aresample=24000'); tempo_eff = tempo / r
    else: tempo_eff = tempo
    af.append(f'atempo={tempo_eff:.4f}')
    raw = f'/tmp/rd_{ch}.wav'; OP.wav_write(raw, pcm)
    mp3 = f'{DATE}-{ch}.mp3'; dst = os.path.join(OUT, mp3)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', ','.join(af),
                    '-ac', '1', '-b:a', '64k', dst], check=True)
    edge = [st / tempo for st in starts] + [T / tempo]
    dur = edge[-1]
    lead, tail = music(dst, dur)
    marks = [{'t': round(edge[i] + lead, 2), 'k': segs[i]['k'], 'say': segs[i]['say']} for i in range(len(segs))]
    res = {'date': DATE, 'ch': ch, 'host': host, 'name': NAME[host], 'title': c['title'],
           'audio': mp3, 'end': round(lead + dur + tail, 2),
           'built': datetime.datetime.now(KST).strftime('%m%d%H%M'), 'marks': marks}
    json.dump(res, open(path, 'w'), ensure_ascii=False, indent=1)
    say('완료', ch, round(lead + dur + tail, 1), '초', '빠르기', round(rate * tempo, 2),
        '높이', pf and round(pf), '→', tgt and round(tgt))


def main():
    for ch in (ONLY or list(CH)):
        if ch not in CH: continue
        try: build(ch)
        except SystemExit as e: say('그만둠', ch, e)
    keep = {(D - datetime.timedelta(days=k)).isoformat() for k in range(3)}
    for f in os.listdir(OUT):
        if f[:10] not in keep:
            os.remove(os.path.join(OUT, f))


try:
    main()
finally:
    open(os.path.join(MEDIA, 'last-radio.log'), 'w').write('\n'.join(LOG))
