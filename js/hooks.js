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
  // 앞으로 나아가기 · 나를 돌보기 (대표 2026-10-24 05:13 — 소제목 일관성). hook 이 없으면 칸 제목은 그대로(지역 따라 바뀌는 나들이),
  // sub 이 없으면 밑줄은 그날 내용 그대로(마음 한 줄·몸 한 가지·정원은 오늘 글이 들어간다).
  H.follow = { kick: '오늘의 따라하기', hook: '러닝부터 차박까지,\n오늘 하나 따라 해 볼까요' };
  H.outing = { kick: '오늘의 나들이' };
  H.show = { kick: '이번 주, 무엇을 볼까', hook: '이번 주엔 극장 갈까,\n전시 보러 갈까', sub: '영화 · 연극 · 콘서트 · 미술관, 예고편까지' };
  H.garden = { kick: '정원 가꾸기', hook: '이 철, 정원에서\n꼭 해야 할 한 가지' };
  H.phrase = { kick: '해외로 한 번', hook: '해외 골프부터 자유여행까지,\n떠나기 전에 한 번' };
  H.hike = { kick: '오늘의 산', hook: '이번 주말엔\n어느 산길을 걸어 볼까' };
  H.move = { kick: '오늘의 몸 풀기', hook: '아침 10분,\n몸을 깨우는 요가 한 편', sub: '요가 · 명상 영상 따라 하기' };
  H.mind = { kick: '오늘의 마음 한 줄', hook: '오늘 마음에\n오래 남을 한 문장' };
  const part = C && C.body && C.body.part;
  H.body = { kick: '오늘의 몸 한 가지', hook: part ? `${part},\n오늘 챙길 한 가지` : '오늘 내 몸에\n챙겨 줄 한 가지' };
  H.pick = { kick: '오늘의 추천 음악', hook: '오늘, 이 한 곡', sub: '그 시절 주옥같은 노래, 하루 한 곡' };   // 곡이 정해지면 app.js renderPick 이 바꾼다
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
    kk.textContent = v.kick; if (h3 && v.hook) { const yr = (document.getElementById('cat-year') || {}).textContent || '';
      h3.replaceChildren(...lines(v.hook).map(t => { const e = document.createElement('span'); e.className = 'hl';
        if (t.includes('{Y}')) { const [a, z] = t.split('{Y}'); const y = document.createElement('b'); y.id = 'cat-year'; y.textContent = yr; e.append(a, y, z); } else e.textContent = t; return e; })); h3.classList.add('b-hook'); } if (p && v.sub) p.textContent = v.sub;
    const ban = b.closest('.banner'); ban.classList.add('thumb');
    // 사진은 16:9 칸에 꽉 채운다 — 가로로 긴 사진(2:1·3:1)은 사진 아래 흰 틈이 생겼다 (대표 2026-10-24 05:23: 무엇을 볼까 제목이 사진보다 한참 밑)
    if (!ban.querySelector('.b-pic')) { const pic = document.createElement('span'); pic.className = 'b-pic'; pic.setAttribute('aria-hidden', 'true');
      pic.style.backgroundImage = ban.style.backgroundImage || getComputedStyle(ban).backgroundImage; pic.style.backgroundPosition = ban.style.backgroundPosition || 'center';
      ban.prepend(pic); }
    const lab = ban.previousElementSibling; if (lab && lab.classList.contains('label')) lab.classList.add('thumb-lab');   // 머리말이 칸 안으로 들어갔으니 위 이름표는 감춘다
  }
}
