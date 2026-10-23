// 판갈이 (대표 2026-10-24): 오늘 즐기기 칸을 유튜브 썸네일처럼 — 사진 + 눌러 보고 싶게 말을 거는 한 줄.
// 칸 이름(오늘의 한 끼…)은 작은 머리말로 내리고, 큰 글씨는 '말 거는 제목'.
// 한 끼·한 권·시사 상식·문화는 매일 만드는 쪽(tools/gen_daily.py gen_hooks)이 오늘 내용을 보고 써 준다(C.hooks).
// PLAY·운세는 날마다 바뀌는 글이 없으니 아래 목록을 날짜로 돌린다.
const PLAY = [
  { kick: '심리 테스트 · 놀이', hook: '1년째 프사 안 바꾼 그 사람,\n속마음은?', sub: '카톡 프사로 읽는 요즘 마음 · 놀이 네 가지' },
  { kick: '심리 테스트 · 놀이', hook: '카톡 답장 속도로 보는\n나의 연애 온도', sub: '1분이면 끝나는 심리 테스트 · 오늘의 순위' },
  { kick: '심리 테스트 · 놀이', hook: '휴대폰 배경화면이 말해 주는\n요즘 내 마음', sub: '가볍게 읽어 보는 심리 테스트 · 놀이 네 가지' },
  { kick: '심리 테스트 · 놀이', hook: '여행 짐 싸는 법만 봐도\n성격이 보인다고?', sub: '심리 테스트 · 사천성 · 스도쿠 · 말모이' },
];
const LUCK = [
  { kick: '오늘의 운세 · 꿈 해몽', hook: '띠마다 오늘 딱 하나 조심할 것,\n내 띠는?', sub: '간밤 꿈 풀이도 함께' },
  { kick: '오늘의 운세 · 꿈 해몽', hook: '오늘 내 띠에 들어온 귀인은\n누구일까', sub: '띠별 오늘 한마디 · 꿈 해몽' },
  { kick: '오늘의 운세 · 꿈 해몽', hook: '오늘 하루, 내 띠에는\n어떤 운이 들었을까?', sub: '띠별 오늘 한마디 · 꿈 해몽도 함께' },
];
const MAP = { food: 'food', book: 'book', quiz: 'quiz', culture: 'culture' };
export function build(C, n) {
  const H = { play: PLAY[n % PLAY.length], luck: LUCK[n % LUCK.length] };
  // 그때 돌아보기 (대표 2026-10-24 04:21 — 소제목 아이콘·글씨가 마음에 안 든다) — 같은 썸네일 꼴로. {Y} 자리에는 고른 해가 들어가고 해를 바꾸면 따라 바뀐다.
  H.history = { kick: '그해 오늘', hook: '{Y}년 오늘,\n무슨 일이 있었을까?', sub: '그때 그 시절의 소식과 나의 기억' };
  H.music = { kick: '그 시절 노래', hook: '그해 거리마다\n흘러나오던 노래', sub: '턴테이블에 바늘을 올리듯, 한 곡씩' };
  if (C && C.story && C.story.title) H.story = { kick: '그날의 사연', hook: C.story.title, sub: C.story.sub || '책장을 넘기듯 읽는 오늘의 이야기' };
  H.home = { kick: '그 동네 지금', hook: '살던 그 동네,\n지금은 어떻게 변했을까', sub: '주소를 말하면 길까지 보여 드립니다' };
  const h = (C && C.hooks) || {};
  for (const [k, sel] of Object.entries(MAP)) if (h[k] && h[k].hook) H[sel] = h[k];
  return H;
}
// 제목 줄 바꿈 (대표 2026-10-24: "뜻이 끊기는 자리에서 줄을 내려야 고급스럽다")
// 만드는 쪽이 \n 을 넣어 주면 그대로, 없으면 쉼표 뒤 → 가운데에 가까운 띄어쓰기에서 두 줄로 나눈다.
export function lines(t) {
  t = String(t || '').trim(); if (t.includes('\n')) return t.split('\n').map(x => x.trim()).filter(Boolean);
  if (t.length <= 12) return [t];
  const mid = t.length / 2; let best = -1, score = 1e9;
  for (let i = 1; i < t.length - 1; i++) { if (t[i] !== ' ') continue;
    const sc = Math.abs(i - mid) - (/[,，?·]/.test(t[i - 1]) ? 4 : 0); if (sc < score) { score = sc; best = i; } }
  return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
}
export function apply(H) {
  for (const [k, v] of Object.entries(H)) {
    const b = document.querySelector(`.tabsec [data-open="${k}"] .b-text > div`); if (!b || !v) continue;
    const h3 = b.querySelector('h3'), p = b.querySelector('p');
    let kk = b.querySelector('.b-kick'); if (!kk) { kk = document.createElement('span'); kk.className = 'b-kick'; b.prepend(kk); }
    kk.textContent = v.kick; if (h3) { const yr = (document.getElementById('cat-year') || {}).textContent || '';
      h3.replaceChildren(...lines(v.hook).map(t => { const e = document.createElement('span'); e.className = 'hl';
        if (t.includes('{Y}')) { const [a, z] = t.split('{Y}'); const y = document.createElement('b'); y.id = 'cat-year'; y.textContent = yr; e.append(a, y, z); } else e.textContent = t; return e; })); h3.classList.add('b-hook'); } if (p) p.textContent = v.sub;
    const ban = b.closest('.banner'); ban.classList.add('thumb');
    const lab = ban.previousElementSibling; if (lab && lab.classList.contains('label')) lab.classList.add('thumb-lab');   // 머리말이 칸 안으로 들어갔으니 위 이름표는 감춘다
  }
}
