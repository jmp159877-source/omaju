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

// ── 심리 테스트 모음 (대표 2026-10-23: "오늘 PLAY 안에 '심리 테스트'가 있고, 들어가면 프사 읽기와 다른 테스트 두세 개") ──
// 프사 읽기는 위의 따로 짠 읽기 도구. 나머지는 보기마다 유형 하나에 표를 주고 가장 많이 받은 유형이 결과(같으면 첫 질문에서 고른 것).
export const TESTS = {
  'pt-wall': {
    kick: '휴대폰 배경화면', title: '휴대폰 첫 화면이\n말해 주는 요즘 나', lead: '매일 수십 번 여는 첫 화면. 거기에 무엇을 두었는지가 요즘 마음을 꽤 정직하게 보여 줘요.',
    qs: [
      ['지금 내 휴대폰 첫 화면\n배경은 무엇인가요?', [['가족이나 반려동물 사진', 'warm'], ['직접 찍은 풍경 사진', 'away'], ['처음 그대로, 기본 배경', 'calm'], ['좋아하는 그림이나 글귀', 'taste']]],
      ['앱 아이콘은\n어떻게 놓여 있나요?', [['자주 쓰는 것만 손 닿는 곳에', 'warm'], ['쓰는 대로 이리저리', 'away'], ['폴더로 가지런히', 'calm'], ['첫 화면은 비워 두는 편', 'taste']]],
      ['배경을 마지막으로\n바꾼 건 언제인가요?', [['좋은 사진이 생기면 바로', 'warm'], ['여행 다녀오고 나서', 'away'], ['기억이 안 날 만큼 오래전', 'calm'], ['계절이 바뀔 때쯤', 'taste']]],
      ['휴대폰을 열면\n제일 먼저 여는 것은?', [['사진첩', 'warm'], ['날씨나 지도', 'away'], ['안 읽은 카톡 정리', 'calm'], ['음악이나 유튜브', 'taste']]],
    ],
    types: {
      warm: { name: '곁을 챙기는 사람', read: '마음의 한가운데에 사람이 있어요. 하루에도 몇 번씩 들여다보는 얼굴이 있다는 건, 그만큼 돌보고 아끼는 이가 있다는 뜻이죠.', tip: '배경 속 그 사람에게 짧은 안부 한 줄 보내 보기' },
      away: { name: '떠날 궁리 중인 사람', read: '몸은 여기 있어도 마음 한쪽은 늘 어딘가로 향해 있어요. 다녀온 곳을 곁에 두는 사람은, 다음 길도 이미 그리고 있는 경우가 많아요.', tip: '이번 달 달력에 아무 일정 없는 하루 비워 두기' },
      calm: { name: '흔들리지 않는 사람', read: '익숙하고 정돈된 것에서 힘을 얻는 사람이에요. 겉으로는 무심해 보여도, 자기 생활의 질서를 아주 잘 아는 쪽이죠.', tip: '배경 하나만 바꿔 보기 — 작은 변화가 하루 기분을 바꿔요' },
      taste: { name: '취향이 또렷한 사람', read: '남들이 다 쓰는 것보다 내 마음에 드는 것을 고르는 사람이에요. 첫 화면 하나에도 자기만의 기준이 있죠.', tip: '좋아하는 것 하나를 누군가에게 소개해 보기' },
    },
  },
  'pt-talk': {
    kick: '카톡 답장 속도', title: '답장 속도로 보는\n나의 관계 온도', lead: '바로 답하는 사람, 한참 뒤에 길게 답하는 사람. 답장에는 그 사람이 관계를 대하는 방식이 묻어나요.',
    qs: [
      ['단톡방에 안 읽은 글이\n99개 넘게 쌓여 있으면?', [['바로 들어가 처음부터 읽는다', 'quick'], ['내 이름 나온 곳만 찾아본다', 'kind'], ['다 읽고 나서 차분히 답한다', 'deep'], ['쭉 넘겨 마지막만 본다', 'cool']]],
      ['반가운 사람의 메시지,\n답장은 언제 하나요?', [['보자마자 바로', 'quick'], ['이모티콘으로 먼저 반기고', 'kind'], ['제대로 쓰고 싶어 조금 뒤에', 'deep'], ['생각났을 때 몰아서', 'cool']]],
      ['내 답장은\n보통 어떤 길이인가요?', [['짧고 빠르게', 'quick'], ['받은 만큼 비슷하게', 'kind'], ['길어지면 차라리 전화로', 'deep'], ['한두 마디면 충분', 'cool']]],
      ['읽고 답 못 한 메시지가\n쌓이면 어떤가요?', [['한 번에 싹 정리한다', 'quick'], ['마음이 쓰여 계속 생각난다', 'kind'], ['미안해서 오히려 길게 쓴다', 'deep'], ['급한 건 아니니 괜찮다', 'cool']]],
    ],
    types: {
      quick: { name: '바로 답하는 사람', read: '반응이 빠른 사람이에요. 단톡방이 조용히 굴러가는 건 대개 이런 분 덕분이죠. 상대를 기다리게 하지 않는 게 곧 배려라고 여기는 쪽이에요.', tip: '오늘 한 번은 한 템포 늦게, 생각 담은 한 줄로 답해 보기' },
      kind: { name: '온도를 맞추는 사람', read: '상대의 온도에 맞춰 답하는 사람이에요. 길게 오면 길게, 짧게 오면 짧게. 대화가 편하다는 말을 자주 듣는 쪽이죠.', tip: '맞장구 말고 내 이야기를 한 줄 먼저 꺼내 보기' },
      deep: { name: '꾹꾹 눌러 쓰는 사람', read: '대충 보내는 게 오히려 불편한 사람이에요. 답이 늦는 건 무심해서가 아니라 제대로 쓰고 싶어서죠. 받는 사람은 그 마음을 압니다.', tip: '짧은 답부터 보내 두고, 긴 이야기는 전화로 해 보기' },
      cool: { name: '내 속도로 가는 사람', read: '알림에 휘둘리지 않는 사람이에요. 관계가 얕아서가 아니라, 연락의 빈도보다 만났을 때의 온도를 믿는 쪽이죠.', tip: '아끼는 한두 사람에게만은 오늘 먼저 연락해 보기' },
    },
  },
  'pt-trip': {
    kick: '여행 짐 싸는 법', title: '가방 싸는 법으로\n보는 나', lead: '가방을 언제, 무엇으로, 얼마나 채우는지. 짐 싸는 법에는 그 사람이 삶을 꾸리는 방식이 그대로 담겨요.',
    qs: [
      ['여행 가방은\n언제 싸나요?', [['일주일 전부터 조금씩', 'plan'], ['떠나기 전날 밤에 한 번에', 'free'], ['같이 가는 사람 것까지 챙기며', 'care'], ['가방 하나라 금방 끝', 'light']]],
      ['가방에 꼭 넣는 것은?', [['일정표와 예약 확인서', 'plan'], ['읽을 책이나 아끼는 옷 한 벌', 'free'], ['상비약과 여벌 옷', 'care'], ['꼭 필요한 것만, 없으면 가서 산다', 'light']]],
      ['짐 무게는\n보통 어떤가요?', [['정해 둔 만큼 딱 맞게', 'plan'], ['갈 때 가볍고 올 때 무겁다', 'free'], ['늘 넉넉해서 무겁다', 'care'], ['기내용 하나로 끝', 'light']]],
      ['여행지에서의 하루는?', [['짜 둔 시간표대로', 'plan'], ['발길 닿는 대로', 'free'], ['같이 간 사람 컨디션에 맞춰', 'care'], ['한두 곳만 깊게', 'light']]],
    ],
    types: {
      plan: { name: '지도를 먼저 펴는 사람', read: '준비가 곧 즐거움인 사람이에요. 가기 전에 이미 한 번 다녀온 셈이죠. 일행은 이런 분 덕분에 길을 헤매지 않아요.', tip: '이번 여행엔 반나절만 계획 없이 비워 두기' },
      free: { name: '길에서 만나는 사람', read: '계획보다 우연을 믿는 사람이에요. 골목에서 만난 식당, 예정에 없던 풍경이 오래 남는 쪽이죠.', tip: '숙소 하나만은 미리 정해 두기 — 마음 놓고 헤매도록' },
      care: { name: '모두의 가방을 챙기는 사람', read: '내 짐보다 우리 짐을 먼저 생각하는 사람이에요. 누가 아프거나 추울 때 꺼낼 것이 늘 이분 가방에서 나오죠.', tip: '이번엔 내 가방에 오로지 나를 위한 것 하나 넣기' },
      light: { name: '가볍게 떠나는 사람', read: '많이 가져가지 않아야 많이 담아 온다고 믿는 사람이에요. 짐이 가벼우면 마음도 가벼워진다는 걸 아는 쪽이죠.', tip: '여행 끝에 엽서 한 장 사서 나에게 부치기' },
    },
  },
};
export const LIST = [['psa', '프사 읽기', '그 사람은 왜 프사를 산으로 바꿨을까'], ['pt-wall', '휴대폰 배경화면', '첫 화면이 말해 주는 요즘 나'], ['pt-talk', '카톡 답장 속도', '답장으로 보는 나의 관계 온도'], ['pt-trip', '여행 짐 싸는 법', '가방 싸는 법으로 보는 나']];

export function scoreOf(test, picks) {
  const n = {}; picks.forEach(t => { n[t] = (n[t] || 0) + 1; });
  const max = Math.max(...Object.values(n));
  return picks.find(t => n[t] === max);   // 같으면 앞 질문에서 고른 것
}

// 심리 테스트 고르는 화면
export function mountList(el, h = {}) {
  const done = ls.get('done', {});
  let found = 0; try { found = (JSON.parse(localStorage.getItem(LS + 'seen') || '[]')).length; } catch (e) {}
  el.innerHTML = `<div class="psa">
    <div class="psa-photo" style="background-image:url('img/psy.jpg')"></div>
    <div class="psa-head"><span class="psa-kick">오늘 PLAY · 심리 테스트</span><h2>가볍게 읽어 보는<br>요즘 마음</h2><p>정답은 없어요. 고르다 보면 나도, 그 사람도 조금 더 보입니다.</p></div>
    <div class="pt-list">${LIST.map(([k, t, s], i) => `<button type="button" data-go="${k}"><span class="pt-n">${String(i + 1).padStart(2, '0')}</span><span class="pt-t"><b>${esc(t)}</b><span>${esc(s)}</span>${k === 'psa' ? `<em>프사 도감 ${found} / ${ORDER.length}</em>` : done[k] ? `<em>지난번 결과 · ${esc(TESTS[k].types[done[k]].name)}</em>` : ''}</span><span class="pt-ar" aria-hidden="true">›</span></button>`).join('')}</div>
    <p class="psa-note">재미로 보는 테스트예요. 고른 답은 어디에도 저장하지 않아요.</p>
  </div>`;
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => (h.nav || (k => { location.hash = k; }))(b.dataset.go));
}

// 보기 고르는 테스트 하나
export function mountTest(el, id, h = {}) {
  const T = TESTS[id]; let step = 0, picks = [];
  function start() {
    el.innerHTML = `<div class="psa">
      <div class="psa-photo" style="background-image:url('img/${id}.jpg')"></div>
      <div class="psa-head"><span class="psa-kick">심리 테스트 · ${esc(T.kick)}</span><h2>${esc(T.title).replace(/\n/g, '<br>')}</h2><p>${esc(T.lead)}</p></div>
      <button type="button" class="psa-go" data-go><span>시작하기 · 질문 ${T.qs.length}개</span><span aria-hidden="true">›</span></button>
      <p class="psa-note">재미로 보는 테스트예요.</p></div>`;
    el.querySelector('[data-go]').onclick = () => { step = 0; picks = []; ask(); };
  }
  function ask() {
    const [q, opts] = T.qs[step];
    el.innerHTML = `<div class="psa">
      <div class="psa-prog" aria-hidden="true"><i style="width:${Math.round((step + 1) / T.qs.length * 100)}%"></i></div>
      <p class="psa-step">${esc(T.kick)} · ${step + 1} / ${T.qs.length}</p>
      <h2 class="psa-q">${esc(q).replace(/\n/g, '<br>')}</h2>
      <div class="psa-opts">${opts.map(([t, v], i) => `<button type="button" data-v="${v}" data-n="${String(i + 1).padStart(2, '0')}">${esc(t)}</button>`).join('')}</div>
      ${step ? '<button type="button" class="psa-prev" data-prev>‹ 앞 질문</button>' : ''}</div>`;
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { picks[step] = b.dataset.v; if (step + 1 < T.qs.length) { step++; ask(); } else result(); });
    const p = el.querySelector('[data-prev]'); if (p) p.onclick = () => { step--; ask(); };
    el.scrollIntoView({ block: 'start' });
  }
  function result() {
    const k = scoreOf(T, picks.slice(0, T.qs.length)), r = T.types[k];
    const done = ls.get('done', {}); done[id] = k; ls.set('done', done);
    el.innerHTML = `<div class="psa"><div class="psa-res">
        <span class="psa-kick">${esc(T.kick)} · 나의 결과</span><h2>${esc(r.name)}</h2><hr class="psa-rule">
        <p class="psa-read">${esc(r.read)}</p></div>
      <div class="psa-ask"><span>오늘 해 볼 것 하나</span><p>${esc(r.tip)}</p></div>
      <div class="psa-row"><button type="button" data-again>다시 해 보기</button><button type="button" data-list>다른 테스트</button></div>
      <p class="psa-note">재미로 보는 테스트예요. 사람 마음은 질문 몇 개보다 훨씬 넓답니다.</p></div>`;
    el.querySelector('[data-again]').onclick = () => { step = 0; picks = []; ask(); };
    el.querySelector('[data-list]').onclick = () => (h.nav || (x => { location.hash = x; }))('psy');
    el.scrollIntoView({ block: 'start' });
  }
  start();
}
