"""클국장 답 묶음 도구 (2026-10-26) — 밤 예약 작업에서 쓴다.
  python3 tools/bank.py run <날짜>          : gen_daily 를 --bank 로 돌려 물음을 모은다(서버에 쓰지 않음, data/pets·solo 는 되돌림)
  python3 tools/bank.py show <날짜> [키]    : 답을 기다리는 물음을 보여 준다 (system·prompt 전문)
  python3 tools/bank.py put <날짜> <키> <답.json> : 답(JSON 그대로)을 묶음에 넣는다
흐름: run → show → 물음마다 답을 써서 put → 다시 run … 물음이 0 이 될 때까지(보통 3~4번).
답은 물음이 시키는 JSON 꼴 그대로. 검색하라는 물음(search=True)은 웹 검색으로 확인한 사실만 쓴다."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); PRE = os.path.join(ROOT, 'daily', 'pre')
cmd, date = sys.argv[1], sys.argv[2]
qf, bf = os.path.join(PRE, date + '.queue.json'), os.path.join(PRE, date + '.bank.json')
if cmd == 'run':
    keep = {f: open(os.path.join(ROOT, f), encoding='utf-8').read() for f in ('data/pets.json', 'data/solo.json')}
    try:
        r = subprocess.run([sys.executable, os.path.join(HERE, 'gen_daily.py'), date, '--bank'], capture_output=True, text=True, timeout=900)
        print('\n'.join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith(('[bank]', '[fail]', '[ok]'))))
    finally:
        for f, t in keep.items(): open(os.path.join(ROOT, f), 'w', encoding='utf-8').write(t)
elif cmd == 'show':
    q = json.load(open(qf, encoding='utf-8')) if os.path.exists(qf) else {}
    for k, v in q.items():
        if len(sys.argv) > 3 and k != sys.argv[3]: continue
        print(f"===== {k}  (JSON={v['json']}, 검색={v['search']})\n{v['prompt']}\n")
    print(f'물음 {len(q)}개' + ('' if len(sys.argv) > 3 else ' — system(편집 원칙)은 모두 같다:\n' + (next(iter(q.values()))['system'] if q else '')))
elif cmd == 'put':
    k, src = sys.argv[3], sys.argv[4]
    ans = json.load(open(src, encoding='utf-8'))
    b = json.load(open(bf, encoding='utf-8')) if os.path.exists(bf) else {}
    b[k] = ans; os.makedirs(PRE, exist_ok=True)
    json.dump(b, open(bf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'넣음 {k} (묶음 {len(b)}개)')
