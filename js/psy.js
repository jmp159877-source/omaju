// 프사 읽기 — 카톡 프로필 사진으로 보는 요즘 마음 (대표 2026-10-23)
// 한 번 하고 끝나는 테스트가 아니라 늘 그 자리에 있는 '읽기 도구'. 다른 사람 프사가 눈에 띌 때마다 다시 해 본다.
// · 사진은 받지 않는다 — 보기만 고른다(남의 사진을 받으면 개인정보가 된다).
// · 결과는 단정하지 않고, 흉이 아니라 '안부'로 끝난다. 끝에 그분께 보낼 오늘의 인사 카드로 잇는다.
// · 12가지 유형 = 사진 종류 6 × (최근에 바꿈 / 오래 그대로). 나머지 질문은 한 줄씩 결을 보탠다.
// · 발견한 유형은 이 휴대폰에만 '프사 도감'으로 남는다(우리 쪽에 저장하지 않는다).

const LS = 'omaju.psa.';
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
      <div class="psa-cover"><span class="psa-kick">오늘 PLAY · 읽어 보기</span><h2>그 사람은 왜<br>프사를 <em>산</em>으로 바꿨을까</h2><p>카톡 프로필 사진으로 읽는 요즘 마음. 떠오르는 사람이 있을 때마다 다시 해 보세요.</p></div>
      <div class="psa-who" role="group" aria-label="누구의 프사인가요">
        <button type="button" data-who="other" aria-pressed="${who === 'other'}"><b>그 사람 프사</b><span>지인 프사를 떠올리며</span></button>
        <button type="button" data-who="me" aria-pressed="${who === 'me'}"><b>내 프사</b><span>요즘 내 마음은</span></button>
      </div>
      <button type="button" class="psa-go" data-go>읽어 보기 <span aria-hidden="true">›</span></button>
      <button type="button" class="psa-dex-link" data-dex>프사 도감 <span class="psa-nowrap">${n} / ${ORDER.length} 발견</span> <span aria-hidden="true">›</span></button>
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
      <div class="psa-opts">${q.opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${ans[q.k] === v}">${esc(t)}</button>`).join('')}</div>
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
        <p class="psa-read">${esc(t.read)}</p>
        ${lines(ans).map(l => `<p class="psa-more">${esc(l)}</p>`).join('')}
      </div>
      ${who === 'other' ? `<div class="psa-ask"><span>이렇게 안부를 건네 보세요</span><p>“${esc(t.ask)}”</p><button type="button" class="psa-copy" data-copy>이 말 복사하기</button></div>` : ''}
      <button type="button" class="psa-go" data-card><span>${who === 'other' ? '이분께 보낼 <span class="psa-nowrap0">오늘의 인사 카드</span>' : '<span class="psa-nowrap0">오늘의 인사 카드</span> 보러 가기'}</span> <span aria-hidden="true">›</span></button>
      <div class="psa-row">
        <button type="button" data-again>다른 사람 <span class="psa-nowrap0">프사도</span></button>
        <button type="button" data-dex>프사 도감</button>
      </div>
      <p class="psa-note">재미로 보는 읽기예요. 사람 마음은 사진 한 장보다 훨씬 넓답니다.</p>
    </div>`;
    const c = el.querySelector('[data-copy]');
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(t.ask); H.toast && H.toast('복사했어요. 카톡 대화창에 붙여 넣으세요.'); } catch (e) { H.toast && H.toast('길게 눌러 복사해 주세요.'); } };
    el.querySelector('[data-card]').onclick = () => { if (H.toCards) H.toCards(); };
    el.querySelector('[data-again]').onclick = () => { ans = {}; step = 0; who = 'other'; ask(); };
    el.querySelector('[data-dex]').onclick = dex;
    el.scrollIntoView({ block: 'start' });
  }

  function dex() {
    const s = seen();
    el.innerHTML = `<div class="psa">
      <div class="psa-cover small"><span class="psa-kick">프사 도감</span><h2>${s.length} / ${ORDER.length}</h2><p>지금까지 읽어 본 유형이 모입니다. 이 휴대폰에만 남아요.</p></div>
      <div class="psa-dex">${ORDER.map(id => { const on = s.includes(id), sub = SUBJ.find(x => x[0] === id.split('-')[0])[2];
        return `<div class="psa-cell${on ? ' on' : ''}"><b>${on ? esc(TYPES[id].name) : '?'}</b><span>${esc(sub)}<br>${id.endsWith('new') ? '최근에 바뀜' : '오래 그대로'}</span></div>`; }).join('')}</div>
      <button type="button" class="psa-go" data-go>${s.length ? '다른 사람 프사 읽기' : '첫 프사 읽어 보기'} <span aria-hidden="true">›</span></button>
    </div>`;
    el.querySelector('[data-go]').onclick = () => { ans = {}; step = 0; ask(); };
    el.scrollIntoView({ block: 'start' });
  }

  start();
}
