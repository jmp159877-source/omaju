# 인사 카드 글귀를 일주일 치 미리 (대표 2026-10-25: 블로그 '오늘의 인사카드'를 일주일에 한 번 몰아서 예약 발행)
# 일요일 밤에 다음 월~일 치 4장씩을 만들어 data/greetings_week.json 에 쌓는다.
# 새벽 daily(gen_daily.gen_greetings)는 여기에 그날 것이 있으면 그대로 쓴다 → 사이트 카드와 블로그 카드가 같은 글귀.
# 관리자 '블로그' 탭은 아직 오지 않은 날도 이 파일로 카드를 그린다.
# 쓰는 법: python3 tools/greet_week.py [YYYY-MM-DD(그 주 월요일)]
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_daily as G

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data', 'greetings_week.json')

def monday():
    if len(sys.argv) > 1: return datetime.date.fromisoformat(sys.argv[1])
    t = datetime.datetime.now(KST).date()
    return t + datetime.timedelta(days=(7 - t.weekday()) % 7 or 7) if t.weekday() == 6 else t - datetime.timedelta(days=t.weekday())

def main():
    try: data = json.load(open(PATH, encoding='utf-8'))
    except Exception: data = {}
    today = datetime.datetime.now(KST).date()
    data = {k: v for k, v in data.items() if k >= (today - datetime.timedelta(days=14)).isoformat()}   # 두 주 넘은 것은 비운다
    m = monday(); made = 0
    for i in range(7):
        d = m + datetime.timedelta(days=i); k = d.isoformat()
        if len(data.get(k) or []) == 4: print('[있음]', k); continue
        for t in range(4):
            try:
                data[k] = G.gen_greetings(d, fresh=True); made += 1; print('[ok]', k, data[k]); break
            except Exception as e: print('[다시]', k, str(e)[:120])
    json.dump(dict(sorted(data.items())), open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('만든 날', made, '· 주', m.isoformat())

if __name__ == '__main__': main()
