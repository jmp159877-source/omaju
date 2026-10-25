// 프사 읽기 — 카톡 프로필 사진으로 보는 요즘 마음 (대표 2026-10-23)
// 한 번 하고 끝나는 테스트가 아니라 늘 그 자리에 있는 '읽기 도구'. 다른 사람 프사가 눈에 띌 때마다 다시 해 본다.
// · 사진은 받지 않는다 — 보기만 고른다(남의 사진을 받으면 개인정보가 된다).
// · 결과는 단정하지 않고, 흉이 아니라 '안부'로 끝난다. 끝에 그분께 보낼 오늘의 인사 카드로 잇는다.
// · 12가지 유형 = 사진 종류 6 × (최근에 바꿈 / 오래 그대로). 나머지 질문은 한 줄씩 결을 보탠다.
// · 발견한 유형은 이 휴대폰에만 '프사 도감'으로 남는다(우리 쪽에 저장하지 않는다).

const LS = 'omaju.psa.';
// 사진: 오늘 PLAY 카드 img/psa.jpg · 목록 img/psy.jpg · 프사 읽기 img/psa-frames.jpg · 테스트마다 img/<id>.jpg (같은 사진을 두 곳에 쓰지 않는다)
const ls = { get(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 사진 종류 — 유형의 반쪽
const SUBJ = [
  ['land', '산·바다·꽃 같은 풍경', '풍경'],
  ['self', '요즘 찍은 자기 사진', '자기 사진'],
  ['old', '젊은 시절 옛날 사진', '옛날 사진'],
  ['kin', '가족이나 반려동물', '가족·반려동물'],
  ['thing', '꽃·음식·글귀 같은 것', '꽃·음식·글귀'],
  ['none', '사진 없이 기본 그림', '기본 그림'],
];

// 질문 — who: 'other'(그 사람) | 'me'(내 프사)
const Q = who => {
  const o = who === 'other';
  return [
    { k: 'subj', q: o ? '그분 프사에는\n지금 무엇이 걸려 있나요?' : '내 프사에는\n지금 무엇이 걸려 있나요?', opts: SUBJ.map(([v, t]) => [v, t]) },
    { k: 'when', q: o ? '그 사진으로 바뀐 건\n언제쯤인가요?' : '그 사진으로 바꾼 건\n언제쯤인가요?', opts: [['week', '이번 주에'], ['month', '한 달 안쪽'], ['season', '계절마다 바꾸는 편'], ['still', '1년 넘게 그대로']] },
    { k: 'diff', q: '바뀌기 전 사진과\n견주어 보면 어떤가요?', skip: a => a.when === 'still', opts: [['big', '분위기가 확 달라졌다'], ['same', '비슷한 결이다'], ['dk', '잘 모르겠다']] },
    { k: 'msg', q: '상태 메시지에는\n무엇이 적혀 있나요?', opts: [['empty', '비어 있다'], ['quote', '글귀나 다짐 한 줄'], ['date', '날짜·숫자·디데이'], ['daily', '일상 한 줄이나 이모티콘']] },
  ];
};

// 12가지 유형 — 문장은 그 사람에게도 나에게도 맞게 주어 없이 쓴다
export const TYPES = {
  'land-new': { name: '바깥바람형', read: '요즘 마음이 바깥을 향하는 중이에요. 다녀온 곳이든 가고 싶은 곳이든, 사람보다 풍경이 먼저 떠오를 만큼 숨 돌릴 틈이 필요했을지도 몰라요.', ask: '프사 보니 좋은 데 다녀오셨나 봐요. 거기 어디예요?' },
  'land-old': { name: '한결같은 산책자형', read: '오래 걸어 둔 풍경은 마음을 내려놓는 자리예요. 크게 흔들리지 않고 제 속도로 사는 사람일 가능성이 높아요.', ask: '프사 그 풍경, 볼 때마다 좋더라고요. 어디예요?' },
  'self-new': { name: '새 출발 선언형', read: '최근에 무언가 달라졌다는 신호예요. 새 일, 새 머리, 새 마음. 지금의 나를 한번 보여 주고 싶은 날이었을 거예요.', ask: '프사 바뀐 거 봤어요. 요즘 얼굴 좋아 보여요.' },
  'self-old': { name: '마음에 드는 그날형', read: '스스로 마음에 드는 하루를 붙잡아 둔 사람이에요. 자기 모습을 편하게 받아들이는, 보기보다 단단한 사람이죠.', ask: '그 사진 언제 찍은 거예요? 볼 때마다 분위기 좋아요.' },
  'old-new': { name: '추억 소환형', read: '요즘 지나간 시절이 자주 떠오르는 중일지도 몰라요. 그리움이라기보다, 그때의 기운을 다시 꺼내 쓰고 싶은 마음에 가까워요.', ask: '프사 보고 깜짝 놀랐어요. 그때 사진 맞죠? 그 시절 얘기 한번 해요.' },
  'old-old': { name: '그 시절 지킴이형', read: '가장 빛나던 장면을 늘 곁에 두는 사람이에요. 지금을 덜 아껴서가 아니라, 그때의 나와 계속 이어져 있고 싶은 거예요.', ask: '그 사진 속 모습, 지금도 그대로예요. 요즘은 어떻게 지내요?' },
  'kin-new': { name: '자랑하고 싶은 날형', read: '좋은 일이 있었거나, 요즘 그 존재 덕분에 웃는 날이 많다는 뜻이에요. 축하와 맞장구가 반가울 때예요.', ask: '프사 보고 웃었어요. 요즘 좋은 일 있죠?' },
  'kin-old': { name: '든든한 울타리형', read: '내 이야기보다 지키는 이들의 이야기가 먼저인 사람이에요. 다정하지만 제 몫은 늘 뒤로 미뤄 두기 쉬운 사람이죠.', ask: '요즘 당신은 어떻게 지내요? 당신 얘기도 듣고 싶어요.' },
  'thing-new': { name: '요즘 꽂힌 것 있음형', read: '꽃 한 송이, 음식 한 접시, 글귀 하나. 요즘 마음을 붙잡은 무언가가 있다는 뜻이에요. 그 이야기를 꺼내 주면 반가워할 거예요.', ask: '프사 그거 뭐예요? 요즘 그거에 빠지셨어요?' },
  'thing-old': { name: '취향 또렷형', read: '얼굴 대신 좋아하는 것을 내건 사람이에요. 말수는 적어도 자기 취향과 기준이 또렷한 사람이죠.', ask: '프사 볼 때마다 취향 참 좋다 싶어요.' },
  'none-new': { name: '잠시 쉼표형', read: '있던 사진을 내렸다면 잠깐 숨 고르는 중일 수 있어요. 바쁘거나, 생각할 게 많거나. 캐묻기보다 가벼운 안부가 어울려요.', ask: '별일 없죠? 그냥 생각나서요.' },
  'none-old': { name: '조용한 관찰자형', read: '보여 주기보다 지켜보는 쪽이 편한 사람이에요. 무심해 보여도 먼저 연락하면 가장 반갑게 답하는 경우가 많아요.', ask: '오랜만이에요. 갑자기 목소리 듣고 싶어서요.' },
};
export const ORDER = ['land', 'self', 'old', 'kin', 'thing', 'none'].flatMap(s => [s + '-new', s + '-old']);

const MORE = {
  big: '바뀌기 전과 분위기가 확 달라졌다면, 마음에도 작은 전환점이 있었을 가능성이 커요.',
  same: '예전 사진과 결이 비슷하다면, 달라졌다기보다 같은 마음을 새로 고쳐 단 거예요.',
  season: '계절마다 바꾸는 사람이라면 달라지는 것 자체를 즐기는 쪽이에요. 이번 사진도 새 계절의 인사일 수 있어요.',
  empty: '상태 메시지가 비어 있다면, 말보다 사진으로 말하는 사람이에요.',
  quote: '글귀나 다짐을 적어 두었다면, 남에게보다 스스로에게 하는 말일 때가 많아요.',
  date: '날짜나 숫자가 적혀 있다면, 기다리는 일이나 꼭 기억하고 싶은 날이 있다는 뜻이에요.',
  daily: '일상 한 줄을 적는 사람이라면, 지금 이 순간을 누군가와 나누고 싶은 마음이 커요.',
};

export function typeOf(a) { return a.subj + '-' + (a.when === 'still' ? 'old' : 'new'); }
export function lines(a) { return [a.when === 'season' ? MORE.season : MORE[a.diff], MORE[a.msg]].filter(Boolean); }

let H = {};
export function mount(el, h = {}) {
  H = h;
  let who = 'other', ans = {}, step = 0;
  const qs = () => Q(who).filter(q => !(q.skip && q.skip(ans)));
  const seen = () => ls.get('seen', []);

  function start() {
    const n = seen().length;
    el.innerHTML = `<div class="psa">
      <div class="psa-photo" style="background-image:url('img/psa-frames.jpg')"></div>
      <div class="psa-head"><span class="psa-kick">심리 테스트 · 프사 읽기</span><h2>그 사람은 왜<br>프사를 <em>산</em>으로 바꿨을까</h2><p>카톡 프로필 사진으로 읽는 요즘 마음. 떠오르는 사람이 있을 때마다 <span class="psa-nowrap0">다시 해 보세요.</span></p></div>
      <div class="psa-who" role="group" aria-label="누구의 프사인가요">
        <button type="button" data-who="other" aria-pressed="${who === 'other'}"><b>그 사람 프사</b><span>지인을 떠올리며</span></button>
        <button type="button" data-who="me" aria-pressed="${who === 'me'}"><b>내 프사</b><span>요즘 내 마음은</span></button>
      </div>
      <button type="button" class="psa-go" data-go><span>읽어 보기</span><span aria-hidden="true">›</span></button>
      <button type="button" class="psa-dex-link" data-dex><span>프사 도감</span><span class="psa-nowrap">${n} / ${ORDER.length} 발견 ›</span></button>
      <p class="psa-note">사진은 올리지 않아요. 보기만 고르면 됩니다. 재미로 보는 읽기예요.</p>
    </div>`;
    el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { who = b.dataset.who; start(); });
    el.querySelector('[data-go]').onclick = () => { ans = {}; step = 0; ask(); };
    el.querySelector('[data-dex]').onclick = dex;
  }

  function ask() {
    const list = qs(), q = list[step];
    el.innerHTML = `<div class="psa">
      <div class="psa-prog" aria-hidden="true"><i style="width:${Math.round((step + 1) / list.length * 100)}%"></i></div>
      <p class="psa-step">${who === 'other' ? '그 사람 프사' : '내 프사'} · ${step + 1} / ${list.length}</p>
      <h2 class="psa-q">${esc(q.q).replace(/\n/g, '<br>')}</h2>
      <div class="psa-opts">${q.opts.map(([v, t], i) => `<button type="button" data-v="${v}" data-n="${String(i + 1).padStart(2, '0')}" aria-pressed="${ans[q.k] === v}">${esc(t)}</button>`).join('')}</div>
      ${step ? '<button type="button" class="psa-prev" data-prev>‹ 앞 질문</button>' : ''}
    </div>`;
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      ans[q.k] = b.dataset.v; const L = qs();
      if (step + 1 < L.length) { step++; ask(); } else result();
    });
    const p = el.querySelector('[data-prev]'); if (p) p.onclick = () => { step--; ask(); };
    el.scrollIntoView({ block: 'start' });
  }

  function result() {
    const id = typeOf(ans), t = TYPES[id], s = seen(), fresh = !s.includes(id);
    if (fresh) ls.set('seen', s.concat(id));
    const n = seen().length;
    el.innerHTML = `<div class="psa">
      <div class="psa-res">
        <span class="psa-kick">${who === 'other' ? '그 사람의 요즘 마음' : '요즘 내 마음'}</span>
        <h2>${esc(t.name)}</h2>
        ${fresh ? `<p class="psa-new">새로 발견한 유형 · 도감 ${n} / ${ORDER.length}</p>` : ''}
        <hr class="psa-rule">
        <p class="psa-read">${esc(t.read)}</p>
        ${lines(ans).map(l => `<p class="psa-more">${esc(l)}</p>`).join('')}
      </div>
      ${who === 'other' ? `<div class="psa-ask"><span>이렇게 안부를 건네 보세요</span><p>“${esc(t.ask)}”</p><button type="button" class="psa-copy" data-copyask>이 말 복사하기</button></div>` : ''}
      <div class="psa-cards"><span class="psa-kick">${who === 'other' ? '이분께 보낼 오늘의 인사 카드' : '오늘의 인사 카드'}</span><p>카드를 누르면 크게 보고 바로 <span class="psa-nowrap0">보낼 수 있어요.</span> 옆으로 넘기면 더 있어요.</p><div class="cards" data-cg>${H.cards ? H.cards() : ''}</div></div>
      <div class="psa-row">
        <button type="button" data-again>다른 사람 <span class="psa-nowrap0">프사도</span></button>
        <button type="button" data-dex>프사 도감</button>
      </div>
      <p class="psa-note">재미로 보는 읽기예요. 사람 마음은 사진 한 장보다 훨씬 넓답니다.</p>
    </div>`;
    const c = el.querySelector('[data-copyask]');
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(t.ask); H.toast && H.toast('복사했어요. 카톡 대화창에 붙여 넣으세요.'); } catch (e) { H.toast && H.toast('길게 눌러 복사해 주세요.'); } };
    // 카드를 누르면 이 자리에서 바로 크게 띄운다 — 밖으로 튕겨 나가지 않게 (대표 2026-10-23)
    el.querySelector('[data-cg]').onclick = e => { const b = e.target.closest('[data-copy]'); if (b && H.openCard) H.openCard(+b.dataset.copy); };
    el.querySelector('[data-again]').onclick = () => { ans = {}; step = 0; who = 'other'; ask(); };
    el.querySelector('[data-dex]').onclick = dex;
    el.scrollIntoView({ block: 'start' });
  }

  function dex() {
    const s = seen();
    el.innerHTML = `<div class="psa">
      <div class="psa-dex-head"><span class="psa-kick">프사 도감</span><h2>${s.length} / ${ORDER.length}</h2><p>지금까지 읽어 본 유형이 모입니다.<br>이 휴대폰에만 남아요.</p></div>
      <div class="psa-dex">${ORDER.map(id => { const on = s.includes(id), sub = SUBJ.find(x => x[0] === id.split('-')[0])[2];
        return `<div class="psa-cell${on ? ' on' : ''}"><b>${on ? esc(TYPES[id].name) : '?'}</b><span>${esc(sub)}<br>${id.endsWith('new') ? '최근에 바뀜' : '오래 그대로'}</span></div>`; }).join('')}</div>
      <button type="button" class="psa-go" data-go><span>${s.length ? '다른 사람 프사 읽기' : '첫 프사 읽어 보기'}</span><span aria-hidden="true">›</span></button>
    </div>`;
    el.querySelector('[data-go]').onclick = () => { ans = {}; step = 0; ask(); };
    el.scrollIntoView({ block: 'start' });
  }

  start();
}

// ── 심리 테스트 모음 (대표 2026-10-24 판갈이: 질문 넷 · 유형 여섯 · 결과는 읽을거리 · 매주 월요일 한 편) ──
import { TESTS as T_ALL, ORDER_T } from './psy_tests.js';
export const TESTS = T_ALL;
const todayK = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const opened = () => ORDER_T.filter(id => TESTS[id].open <= todayK());
const nextOne = () => ORDER_T.find(id => TESTS[id].open > todayK());
export const LIST = () => [['psa', '프사 읽기', '그 사람은 왜 프사를 산으로 바꿨을까']].concat(opened().map(id => [id, TESTS[id].kick, TESTS[id].title.replace(/\n/g, ' ')]));
const kdate = d => { const x = new Date(d + 'T00:00:00+09:00'); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${'일월화수목금토'[x.getDay()]})`; };

// 보기마다 주 유형 2점 · 곁 유형 1점. 같으면 앞 질문에서 고른 주 유형.
export function scoreOf(test, picks) {
  const n = {}, order = [];
  picks.forEach((o, qi) => { const opt = test.qs[qi][1][o]; if (!opt) return; n[opt[1]] = (n[opt[1]] || 0) + 2; if (opt[2]) n[opt[2]] = (n[opt[2]] || 0) + 1; order.push(opt[1]); });
  const max = Math.max(...Object.values(n));
  return order.find(t => n[t] === max) || Object.keys(n).find(t => n[t] === max);
}

// 심리 테스트 고르는 화면 — 아래에 '나의 마음 지도'(해 본 테스트 결과가 한 장에)와 다음 주 예고
export function mountList(el, h = {}) {
  const done = ls.get('done', {});
  let found = 0; try { found = (JSON.parse(localStorage.getItem(LS + 'seen') || '[]')).length; } catch (e) {}
  const L = LIST(), nx = nextOne(), mine = opened().filter(id => done[id] && TESTS[id].types[done[id]]);
  el.innerHTML = `<div class="psa">
    <div class="psa-photo" style="background-image:url('img/psy.jpg')"></div>
    <div class="psa-head"><span class="psa-kick">오늘 PLAY · 심리 테스트</span><h2>질문은 넷,<br>읽을거리는 넉넉하게</h2><p>1분이면 끝나요. 결과에는 나의 모습, 빛나는 순간, 잘 맞는 짝까지 담았어요. 매주 월요일 새 테스트가 열립니다.</p></div>
    <div class="pt-list">${L.map(([k, t, s], i) => `<button type="button" data-go="${k}"><span class="pt-n">${String(i + 1).padStart(2, '0')}</span><span class="pt-t"><b>${esc(t)}</b><span>${esc(s)}</span>${k === 'psa' ? `<em>프사 도감 ${found} / ${ORDER.length}</em>` : done[k] && TESTS[k].types[done[k]] ? `<em>나의 결과 · ${esc(TESTS[k].types[done[k]].name)}</em>` : (TESTS[k].open > '2026-10-23' && (Date.parse(todayK()) - Date.parse(TESTS[k].open)) / 864e5 < 7 ? '<em class="pt-new">새로 열림</em>' : '')}</span><span class="pt-ar" aria-hidden="true">›</span></button>`).join('')}
    ${nx ? `<div class="pt-next"><span>다음 주 새 테스트</span><b>${esc(TESTS[nx].kick)}</b><small>${kdate(TESTS[nx].open)} 열려요</small></div>` : ''}</div>
    <div class="pt-map"><span class="psa-kick">나의 마음 지도</span><h3>${mine.length} / ${opened().length}</h3>
      ${mine.length ? `<ul>${mine.map(id => `<li><span>${esc(TESTS[id].kick)}</span><b>${esc(TESTS[id].types[done[id]].name)}</b></li>`).join('')}</ul>` : '<p>테스트를 하나씩 해 보면 여기에 나의 결과가 모여요.</p>'}
      <p class="pt-map-note">이 휴대폰에만 남아요.</p></div>
    <p class="psa-note">재미로 보는 테스트예요. 고른 답은 어디에도 보내지 않아요.</p>
  </div>`;
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => (h.nav || (k => { location.hash = k; }))(b.dataset.go));
}

// 결과 카드 그림 — "나는 ○○, 당신은?" 카톡으로 보내는 카드 (1080×1350)
async function resultCard(T, r) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  try { await document.fonts.load('700 60px "Noto Sans KR"'); } catch (e) {}
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1F5A3E'); g.addColorStop(1, '#123826'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F9E9A8'; x.font = '700 40px "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.fillText('오마주 매거진 · 심리 테스트', W / 2, 150);
  x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = '500 44px "Noto Sans KR", sans-serif'; x.fillText(T.kick, W / 2, 250);
  x.fillStyle = '#fff'; x.font = '500 50px "Noto Sans KR", sans-serif'; x.fillText('나는', W / 2, 420);
  let fs = 104; x.font = `800 ${fs}px "Noto Sans KR", sans-serif`; while (x.measureText(r.name).width > W - 120 && fs > 60) { fs -= 4; x.font = `800 ${fs}px "Noto Sans KR", sans-serif`; }
  x.fillStyle = '#F9E9A8'; x.fillText(r.name, W / 2, 560);
  x.fillStyle = '#fff'; x.font = '500 46px "Noto Sans KR", sans-serif'; x.fillText('“' + r.nick + '”', W / 2, 660);
  x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(W / 2 - 60, 740, 120, 4);
  x.fillStyle = '#fff'; x.font = '800 70px "Noto Sans KR", sans-serif'; x.fillText('당신은?', W / 2, 900);
  x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '500 40px "Noto Sans KR", sans-serif'; x.fillText('질문 4개, 1분이면 알 수 있어요', W / 2, 990);
  x.fillStyle = '#F9E9A8'; x.beginPath(); x.roundRect ? x.roundRect(W / 2 - 300, 1080, 600, 110, 55) : x.rect(W / 2 - 300, 1080, 600, 110); x.fill();
  x.fillStyle = '#3A2E00'; x.font = '800 44px "Noto Sans KR", sans-serif'; x.fillText('omaju.kr 에서 해 보기', W / 2, 1150);
  return await new Promise(res => c.toBlob(res, 'image/png'));
}

// 보기 고르는 테스트 하나
export function mountTest(el, id, h = {}) {
  const T = TESTS[id]; let step = 0, picks = [];
  function start() {
    el.innerHTML = `<div class="psa">
      ${T.photo ? `<div class="psa-photo" style="background-image:url('img/${id}.jpg')"></div>` : `<div class="psa-photo psa-type"><span>${esc(T.kick)}</span></div>`}
      <div class="psa-head"><span class="psa-kick">심리 테스트 · ${esc(T.kick)}</span><h2>${esc(T.title).replace(/\n/g, '<br>')}</h2><p>${esc(T.lead)}</p></div>
      <button type="button" class="psa-go" data-go><span>시작하기 · 질문 ${T.qs.length}개, 1분</span><span aria-hidden="true">›</span></button>
      <p class="psa-note">유형 ${Object.keys(T.types).length}가지 · 재미로 보는 테스트예요.</p></div>`;
    el.querySelector('[data-go]').onclick = () => { step = 0; picks = []; ask(); };
  }
  function ask() {
    const [q, opts] = T.qs[step];
    el.innerHTML = `<div class="psa">
      <div class="psa-prog" aria-hidden="true"><i style="width:${Math.round((step + 1) / T.qs.length * 100)}%"></i></div>
      <p class="psa-step">${esc(T.kick)} · ${step + 1} / ${T.qs.length}</p>
      <h2 class="psa-q">${esc(q).replace(/\n/g, '<br>')}</h2>
      <div class="psa-opts">${opts.map(([t, v], i) => `<button type="button" data-v="${v}" data-o="${i}" data-n="${String(i + 1).padStart(2, '0')}">${esc(t)}</button>`).join('')}</div>
      ${step ? '<button type="button" class="psa-prev" data-prev>‹ 앞 질문</button>' : ''}</div>`;
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { picks[step] = +b.dataset.o; if (step + 1 < T.qs.length) { step++; ask(); } else result(); });
    const p = el.querySelector('[data-prev]'); if (p) p.onclick = () => { step--; ask(); };
    el.scrollIntoView({ block: 'start' });
  }
  function result() {
    const k = scoreOf(T, picks.slice(0, T.qs.length)), r = T.types[k], m = T.types[r.match], c = T.types[r.clash];
    const done = ls.get('done', {}); done[id] = k; ls.set('done', done);
    el.innerHTML = `<div class="psa"><div class="psa-res">
        <span class="psa-kick">${esc(T.kick)} · 나의 결과</span><h2>${esc(r.name)}</h2><p class="pt-nick">“${esc(r.nick)}”</p><hr class="psa-rule">
        <p class="is-sub">이런 사람이에요</p><p class="psa-read">${esc(r.read)}</p></div>
      <div class="pt-two"><div class="pt-box pt-shine"><b>이럴 때 빛나요</b><p>${esc(r.shine)}</p></div><div class="pt-box pt-care"><b>이럴 땐 조심</b><p>${esc(r.care)}</p></div></div>
      <div class="pt-pair"><div><span>잘 맞는 짝</span><b>${esc(m.name)}</b><small>${esc(m.nick)}</small></div><div><span>부딪히는 짝</span><b>${esc(c.name)}</b><small>${esc(c.nick)}</small></div></div>
      <div class="psa-ask"><span>오늘 해 볼 것 하나</span><p>${esc(r.tip)}</p></div>
      <button type="button" class="psa-go pt-share" data-share><span>결과 카드로 보내기</span><span aria-hidden="true">›</span></button>
      <p class="pt-share-note">"나는 ${esc(r.name)}, 당신은?" 카드가 카톡으로 가요. 받은 분도 바로 해 볼 수 있어요.</p>
      <details class="pt-all"><summary>다른 유형도 보기 · ${Object.keys(T.types).length}가지</summary>${Object.entries(T.types).map(([kk, t]) => `<div class="pt-all-row${kk === k ? ' on' : ''}"><b>${esc(t.name)}</b><span>${esc(t.nick)}</span></div>`).join('')}</details>
      <div class="psa-row"><button type="button" data-again>다시 해 보기</button><button type="button" data-list>다른 테스트</button></div>
      <p class="psa-note">재미로 보는 테스트예요. 사람 마음은 질문 몇 개보다 훨씬 넓답니다.</p></div>`;
    el.querySelector('[data-again]').onclick = () => { step = 0; picks = []; ask(); };
    el.querySelector('[data-list]').onclick = () => (h.nav || (x => { location.hash = x; }))('psy');
    el.querySelector('[data-share]').onclick = async e => {
      const b = e.currentTarget; b.disabled = true; const sp = b.querySelector('span'); const old = sp.textContent; sp.textContent = '카드 만드는 중…';
      try { const blob = await resultCard(T, r); const file = new File([blob], `omaju-${id}.png`, { type: 'image/png' });
        if (h.share) await h.share(file, 'https://omaju.kr/?from=psy#' + id, `나는 ${r.name}, 당신은? — 오마주 매거진 ${T.kick} 테스트`); }
      catch (err) { h.toast && h.toast('보내기가 잘 안 됐어요. 다시 한번 눌러 주세요.'); }
      b.disabled = false; sp.textContent = old;
    };
    el.scrollIntoView({ block: 'start' });
  }
  start();
}
