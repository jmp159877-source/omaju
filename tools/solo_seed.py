# 혼자라서 좋은 날 — 첫 글 채우기 / 손으로 한 칸 다시 쓰기 (파이어스토어는 건드리지 않는다)
# python tools/solo_seed.py [YYYY-MM-DD] [day,eat,...]
import sys, os, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_daily as G
G.gemini.models = G.list_models()
d = next((datetime.date.fromisoformat(a) for a in sys.argv[1:] if a[:2] == '20'), G.today())
keys = next((a.split(',') for a in sys.argv[1:] if a[:2] != '20'), list(G.SOLO))
out = G.gen_solo(d, keys)
for k, a in out.items(): print(k, '|', a['title'], '|', len(a['items']), '곳')
