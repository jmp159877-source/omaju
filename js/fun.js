// 재미 카드 — 이름 넣는 '진짜 같은 가짜 서류' (대표 2026-11-12 18:48 — "없는 게 나와야 돼. 카드 받으러 들어왔다가 너무 재밌다 하고 또 오게")
// 상장 · 처방전 · 호외 신문 · 영수증 · 임명장 · 탑승권. 문구는 요일·철에 맞춰 날마다 바뀐다(DAY 로 돌림).
// 진짜 기관·신문 이름은 쓰지 않는다(오늘신문·마음상회·마음내과 — 지어낸 이름). 카드에 우리 상호는 넣지 않는다(오른쪽 아래 작게만).
const now = new Date(), DAY = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5), DOW = now.getDay();
const M = now.getMonth(), SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
const WD = '일월화수목금토'[DOW];
const Y = now.getFullYear(), MM = now.getMonth() + 1, DD = now.getDate();
const DATE_KO = `${Y}년 ${MM}월 ${DD}일`;
const NO = `${Y}-${String(MM).padStart(2, '0')}${String(DD).padStart(2, '0')}`;
const fits = x => (!x.w || x.w.includes(DOW)) && (!x.s || x.s === SEASON);
const pick = list => { const L = list.filter(fits); return L.length ? L[DAY % L.length] : list[0]; };

export const FUN = [
  { id: 'award', n: '상장', items: [
    { t: '이번 주도 버텨 낸 상', b: ['위 사람은 월요일부터 오늘까지', '한 번도 무너지지 않고', '제자리를 지켜 냈기에', '그 끈기를 높이 기려 이 상을 드립니다.'], w: [4, 5] },
    { t: '월요일 기상 성공상', b: ['위 사람은 알람을 세 번 끄고도', '기어이 이불을 박차고 일어나', '월요일을 열어 냈기에', '그 용기를 기려 이 상을 드립니다.'], w: [1] },
    { t: '한 주의 반 고비 완주상', b: ['위 사람은 길고 긴 수요일을', '불평 한마디 없이 넘기고', '주말을 향해 반을 달려왔기에', '응원을 담아 이 상을 드립니다.'], w: [2, 3] },
    { t: '참 잘 살아온 상', b: ['위 사람은 바쁜 세월 속에서도', '웃음을 잃지 않고', '주변을 따뜻하게 데워 왔기에', '고마운 마음을 모아 이 상을 드립니다.'] },
    { t: '우리 사이 최우수상', b: ['위 사람은 오래도록 한결같이', '내 편이 되어 주었고', '힘들 때 먼저 손 내밀어 주었기에', '진심을 담아 이 상을 드립니다.'] },
    { t: '주말 행복 예약상', b: ['위 사람은 이번 주말을', '맛있는 것과 좋은 사람으로', '알차게 채울 자격이 충분하기에', '미리 축하하며 이 상을 드립니다.'], w: [5, 6] },
    { t: '쉬어 갈 줄 아는 상', b: ['위 사람은 일요일 하루를', '아무것도 하지 않고 푹 쉬는', '어려운 일을 훌륭히 해냈기에', '그 지혜를 기려 이 상을 드립니다.'], w: [0] },
  ] },
  { id: 'rx', n: '처방전', items: [
    { dx: '월요병 (급성)', rx: [['따뜻한 커피', '1잔', '출근 직후'], ['점심 메뉴 미리 정하기', '1회', '오전 11시'], ['퇴근길 좋아하는 노래', '3곡', '퇴근 즉시']], how: '오늘 하루 수시로, 웃으며 복용', note: '잔소리와 함께 드시지 마세요', w: [1] },
    { dx: '한 주 반 고비 피로', rx: [['달달한 간식', '1개', '오후 3시'], ['기지개', '5회', '한 시간마다'], ['"벌써 수요일" 주문', '1회', '아침에']], how: '목요일 아침까지 꾸준히', note: '야근과 함께 드시면 효과가 없습니다', w: [2, 3] },
    { dx: '불금 대기 증후군', rx: [['저녁 약속', '1건', '오늘 저녁'], ['좋아하는 음식', '넉넉히', '저녁 식사'], ['늦잠 예약', '1회', '내일 아침']], how: '퇴근 시간에 맞춰 한 번에', note: '월요일 걱정은 미리 드시지 마세요', w: [4, 5] },
    { dx: '일요일 밤 시무룩', rx: [['좋아하는 드라마', '1편', '저녁 식사 후'], ['따뜻한 차', '1잔', '잠들기 전'], ['"이번 주도 잘될 거야"', '3번', '거울 보며']], how: '오늘 밤 한 번에', note: '내일 일정 확인은 아침에 하세요', w: [0, 6] },
    { dx: '가을 타는 마음', rx: [['단풍길 산책', '30분', '햇볕 좋은 낮'], ['보고 싶은 사람에게 전화', '1통', '오늘 안에'], ['붕어빵', '2개', '퇴근길']], how: '이번 가을 내내', note: '혼자 끙끙 앓지 마세요', s: 'autumn' },
    { dx: '보고 싶음 (만성)', rx: [['안부 전화', '1통', '오늘 저녁'], ['함께 찍은 사진 보기', '3장', '틈날 때'], ['만날 날 약속', '1건', '이번 주 안']], how: '참지 말고 바로', note: '"다음에 보자"는 효과가 없습니다' },
    { dx: '만성 수고 과다', rx: [['아무것도 안 하기', '10분', '하루 두 번'], ['좋아하는 노래', '한 곡', '마음 내킬 때'], ['칭찬 듣기', '무제한', '지금부터']], how: '스스로를 칭찬하며', note: '"괜찮아"라고 넘기지 마세요' },
  ] },
  { id: 'news', n: '호외 신문', items: [
    { tag: '속보', h: ['{n},', '오늘도 해냈다'], sub: '알람 끄고 다시 눕지 않아… 이웃들 "믿기지 않는다"', lede: '오늘 아침 {n}이(가) 단 한 번의 망설임도 없이 하루를 시작한 것으로 확인됐다. 주변에서는 "역시 다르다"는 반응이 이어졌다.' },
    { tag: '단독', h: ['{n}, 알고 보니', '동네 최고 인기인'], sub: '만나는 사람마다 기분 좋아져… 비결은 "웃음"', lede: '본지 취재 결과 {n}을(를) 만난 사람 대부분이 하루 종일 기분이 좋았던 것으로 드러났다. 전문가들은 그 비결로 한결같은 웃음을 꼽았다.' },
    { tag: '속보', h: ['월요일,', '{n} 앞에 무릎 꿇어'], sub: '무거운 아침도 거뜬히… "이번 주도 문제없다"', lede: '한 주 가운데 가장 힘들다는 월요일이 오늘 {n} 앞에서 맥을 추지 못한 것으로 알려졌다. 남은 요일들도 긴장하는 분위기다.', w: [1] },
    { tag: '화제', h: ['{n},', '주말 계획 이미 완벽'], sub: '맛집·산책·늦잠까지… "이번 주말은 내 것"', lede: '{n}의 이번 주말 계획이 빈틈없이 짜인 것으로 확인됐다. 지인들 사이에서는 "나도 끼워 달라"는 요청이 잇따르고 있다.', w: [4, 5, 6] },
    { tag: '기획', h: ['나이는 숫자일 뿐…', '{n}의 마음은 주니어'], sub: '새로 배우고 새로 떠나는 하루… 젊음의 비결 공개', lede: '해마다 나이는 한 살씩 늘지만 {n}의 마음은 오히려 젊어지고 있다는 분석이 나왔다. 호기심과 웃음이 그 비결로 꼽힌다.' },
    { tag: '특보', h: ['{n}의 한마디에', '하루가 환해져'], sub: '"고마워" 한마디에 주변 행복 지수 급등', lede: '오늘 {n}이(가) 건넨 따뜻한 한마디가 주변 사람들의 하루를 통째로 바꿔 놓은 것으로 전해졌다. 효과는 저녁까지 이어질 전망이다.' },
  ] },
  { id: 'bill', n: '영수증', items: [
    { t: '오늘 하루 영수증', rows: [['아침 기지개', '1', '0'], ['따뜻한 말 한마디', '3', '0'], ['함박웃음', '5', '0'], ['걱정', '1', '-100%']], sum: '행복 한가득' },
    { t: '고마움 영수증', rows: [['그동안 챙겨 준 마음', '1', '값을 매길 수 없음'], ['내 편 들어 준 날', '365', '0'], ['잔소리 (사랑)', '999', '0'], ['섭섭함', '1', '-100%']], sum: '고마움 무한대' },
    { t: '주말 영수증', rows: [['늦잠', '1', '0'], ['좋아하는 음식', '2', '0'], ['산책 한 바퀴', '1', '0'], ['월요일 걱정', '1', '반품']], sum: '푹 쉼 100%', w: [5, 6, 0] },
    { t: '응원 영수증', rows: [['힘내라는 마음', '1', '0'], ['믿는다는 눈빛', '1', '0'], ['다 잘될 거라는 말', '3', '0'], ['불안', '1', '-100%']], sum: '든든함 가득' },
    { t: '월요일 영수증', rows: [['출근 용기', '1', '0'], ['커피', '2', '0'], ['동료의 웃음', '3', '0'], ['월요병', '1', '전액 환불']], sum: '해낼 수 있음', w: [1] },
  ] },
  { id: 'appoint', n: '임명장', items: [
    { role: '우리 집 최고 요리사', b: ['맛있는 냄새로 집 안을 채우고', '한 그릇에 하루의 피로를 녹여 주었기에', '이 임명장을 드립니다.'] },
    { role: '오늘의 분위기 메이커', b: ['어디서든 웃음꽃을 피우고', '처진 어깨를 펴 주었기에', '이 임명장을 드립니다.'] },
    { role: '인생 2막 탐험대장', b: ['새로 배우고 새로 떠나는 일을', '누구보다 즐겁게 해내기에', '이 임명장을 드립니다.'] },
    { role: '우리 모임 웃음 담당', b: ['모일 때마다 이야기보따리를 풀어', '모두를 배꼽 잡게 했기에', '이 임명장을 드립니다.'] },
    { role: '주말 산책 대장', b: ['좋은 길과 좋은 바람을 먼저 알아보고', '함께 걷는 즐거움을 알려 주었기에', '이 임명장을 드립니다.'], w: [5, 6, 0] },
    { role: '마음 든든 보증인', b: ['힘들 때마다 기대어 쉴 수 있게', '늘 그 자리에 있어 주었기에', '이 임명장을 드립니다.'] },
  ] },
  { id: 'pass', n: '탑승권', items: [
    { from: ['월요일', 'MON'], to: ['주말', 'WKD'], seat: '창가 꿀잠석', gate: '퇴근길 3번', time: '금요일 18:00', note: '중간 경유지: 화·수·목 — 짐은 가볍게', w: [1, 2, 3, 4] },
    { from: ['걱정', 'WRY'], to: ['설렘', 'JOY'], seat: '맨 앞 웃음석', gate: '마음 1번', time: '지금 바로', note: '걱정은 기내 반입 금지 품목입니다' },
    { from: ['오늘', 'NOW'], to: ['꿈꾸던 그곳', 'DRM'], seat: '인생 2막 일등석', gate: '용기 7번', time: '마음먹은 날', note: '편도 항공권 — 돌아올 생각 마세요' },
    { from: ['여기', 'HRE'], to: ['너에게', 'YOU'], seat: '보고 싶음 1A', gate: '그리움 2번', time: '이번 주 안', note: '만나면 맛있는 것부터 먹기' },
    { from: ['평일', 'WKY'], to: ['늦잠', 'ZZZ'], seat: '이불 속 특등석', gate: '알람 끔 0번', time: '토요일 아침', note: '알람은 꺼 두셔도 좋습니다', w: [5, 6] },
  ] },
];
export const today = id => pick(FUN.find(f => f.id === id).items);

// 받는 분 이름을 서류에 맞게 — '미숙아' → '미숙', '엄마 아빠,' → '엄마 아빠', 친구는 '○○ 님'
const DEF = { friend: '소중한 친구', parent: '엄마 아빠', child: '사랑하는 너', group: '여러분' };
export function who(name, tab) {
  let n = String(name || '').replace(/[,，.\s]+$/, '').trim();
  if (!n) return DEF[tab] || DEF.friend;
  if (tab === 'friend' && !/(님|씨|선생|샘|야|아|이)$/.test(n)) n += ' 님';
  return n.replace(/(야|아)$/, m => (n.length > 2 ? '' : m));
}
// 받침 따라 조사 — {n}이(가) → '미숙이' / '영희가'
const jong = s => { const c = s.charCodeAt(s.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
const josa = (t, n) => t.replace(/\{n\}(이\(가\)|을\(를\)|의)?/g, (_, j) => n + (!j ? '' : j === '의' ? '의' : j === '이(가)' ? (jong(n) ? '이' : '가') : (jong(n) ? '을' : '를')));

// ── 그리기 (1080×1350) ──
const W = 1080, H = 1350;
const SER = '"Nanum Myeongjo", serif', SANS = '"Noto Sans KR", sans-serif';
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function T(x, s, X, Y, font, color, align = 'center', ls = 0) {
  x.font = font; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic';
  if ('letterSpacing' in x) x.letterSpacing = ls + 'px'; x.fillText(s, X, Y); if ('letterSpacing' in x) x.letterSpacing = '0px';
}
function fit(x, s, maxW, wgt, fam, size, min = 30) { let z = size; x.font = `${wgt} ${z}px ${fam}`; while (z > min && x.measureText(s).width > maxW) { z -= 2; x.font = `${wgt} ${z}px ${fam}`; } return z; }
function seal(x, cx, cy, lines, size = 170, round = false, rot = -0.14) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = 0.86;
  x.strokeStyle = '#C2362B'; x.fillStyle = '#C2362B'; x.lineWidth = 9;
  if (round) { x.beginPath(); x.arc(0, 0, size / 2, 0, Math.PI * 2); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, size / 2 - 14, 0, Math.PI * 2); x.stroke(); }
  else { rr(x, -size / 2, -size / 2, size, size, 14); x.stroke(); x.lineWidth = 3; rr(x, -size / 2 + 13, -size / 2 + 13, size - 26, size - 26, 8); x.stroke(); }
  const fs = lines.length > 1 ? size * 0.27 : size * 0.36;
  lines.forEach((l, i) => T(x, l, 0, (i - (lines.length - 1) / 2) * fs * 1.15 + fs * 0.36, `800 ${fs}px ${SER}`, '#C2362B'));
  x.restore();
}
function paper(x, c1, c2) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, W, H); }
function mark(x, dark = true) { T(x, '오마주 매거진', W - 40, H - 30, `500 22px ${SANS}`, dark ? 'rgba(60,55,45,.5)' : 'rgba(255,255,255,.7)', 'right', 2); }

function frame(x, title, sealTxt, e, n, body) {
  paper(x, '#FCF8EE', '#F3EBD8');
  x.strokeStyle = '#B48E3E'; x.lineWidth = 7; x.strokeRect(44, 44, W - 88, H - 88);
  x.lineWidth = 2; x.strokeRect(66, 66, W - 132, H - 132);
  x.fillStyle = '#B48E3E'; [[66, 66], [W - 66, 66], [66, H - 66], [W - 66, H - 66]].forEach(([a, b]) => { x.save(); x.translate(a, b); x.rotate(Math.PI / 4); x.fillRect(-11, -11, 22, 22); x.restore(); });
  T(x, `제 ${NO} 호`, 130, 175, `700 30px ${SER}`, '#5A5040', 'left');
  T(x, title, W / 2 + 20, 345, `800 124px ${SER}`, '#1C1A16', 'center', 40);
  body(x);
  T(x, DATE_KO, W / 2, 1105, `700 38px ${SER}`, '#2A2620');
  T(x, '마음을 담아 드림', W / 2 - 60, 1195, `800 44px ${SER}`, '#1C1A16', 'center', 6);
  seal(x, 820, 1170, sealTxt);
  mark(x);
}

const DRAW = {
  award(x, e, n) {
    frame(x, '상장', ['참 잘', '했어요'], e, n, x => {
      const z = fit(x, e.t, W - 260, 800, SER, 58); T(x, e.t, W / 2, 470, `800 ${z}px ${SER}`, '#8A6416');
      T(x, '성명', 300, 590, `700 40px ${SER}`, '#5A5040', 'left', 10);
      const zn = fit(x, n, 480, 800, SER, 56, 36); T(x, n, 430, 592, `800 ${zn}px ${SER}`, '#1C1A16', 'left');
      x.strokeStyle = 'rgba(90,80,64,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(420, 612); x.lineTo(800, 612); x.stroke();
      e.b.forEach((l, i) => { const zz = fit(x, l, W - 240, 700, SER, 44, 32); T(x, l, W / 2, 720 + i * 78, `700 ${zz}px ${SER}`, '#2A2620'); });
    });
  },
  appoint(x, e, n) {
    frame(x, '임명장', ['임명'], e, n, x => {
      T(x, '성명', 300, 470, `700 40px ${SER}`, '#5A5040', 'left', 10);
      const zn = fit(x, n, 480, 800, SER, 56, 36); T(x, n, 430, 472, `800 ${zn}px ${SER}`, '#1C1A16', 'left');
      x.strokeStyle = 'rgba(90,80,64,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(420, 492); x.lineTo(800, 492); x.stroke();
      T(x, '위 사람을', W / 2, 610, `700 44px ${SER}`, '#2A2620');
      const z = fit(x, e.role, W - 220, 800, SER, 74, 44); T(x, e.role, W / 2, 712, `800 ${z}px ${SER}`, '#8A6416');
      const ro = jong(e.role) && (e.role.charCodeAt(e.role.length - 1) - 0xAC00) % 28 !== 8 ? '으로' : '로'; T(x, ro + ' 모십니다', W / 2, 790, `700 40px ${SER}`, '#5A5040');
      e.b.forEach((l, i) => { const zz = fit(x, l, W - 240, 700, SER, 42, 30); T(x, l, W / 2, 890 + i * 70, `700 ${zz}px ${SER}`, '#2A2620'); });
    });
  },
  rx(x, e, n) {
    paper(x, '#FFFFFF', '#F4F6F4');
    T(x, '처 방 전', W / 2, 190, `700 96px ${SANS}`, '#18322A', 'center', 12);
    T(x, `교부번호 ${NO}-0001  ·  ${DATE_KO} (${WD})`, W / 2, 255, `400 28px ${SANS}`, '#56615C');
    const L = 90, R = W - 90, C = 300; let y = 300;
    x.strokeStyle = '#18322A'; x.lineWidth = 4; x.strokeRect(L, y, R - L, 860);
    const row = (h, label, fn) => { x.fillStyle = '#EEF3F0'; x.fillRect(L + 2, y + 2, C - L - 2, h - 2); T(x, label, (L + C) / 2, y + h / 2 + 12, `700 32px ${SANS}`, '#18322A', 'center', 4); x.strokeStyle = '#18322A'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(C, y); x.lineTo(C, y + h); x.stroke(); fn(y, h); y += h; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke(); };
    row(110, '환자 성명', (y, h) => { const z = fit(x, n, R - C - 60, 700, SANS, 46, 30); T(x, n, C + 36, y + h / 2 + 16, `700 ${z}px ${SANS}`, '#111', 'left'); });
    row(110, '병    명', (y, h) => { const z = fit(x, e.dx, R - C - 60, 700, SANS, 44, 28); T(x, e.dx, C + 36, y + h / 2 + 15, `700 ${z}px ${SANS}`, '#B0302A', 'left'); });
    row(370, '처방 내용', (y, h) => {
      T(x, '약 이름', C + 36, y + 56, `500 26px ${SANS}`, '#6A746F', 'left'); T(x, '1회 양', R - 250, y + 56, `500 26px ${SANS}`, '#6A746F', 'center'); T(x, '때', R - 95, y + 56, `500 26px ${SANS}`, '#6A746F', 'center');
      e.rx.forEach(([a, b, c], i) => { const yy = y + 140 + i * 92; const z = fit(x, a, R - C - 360, 700, SANS, 36, 24);
        T(x, a, C + 36, yy, `700 ${z}px ${SANS}`, '#111', 'left'); T(x, b, R - 250, yy, `500 32px ${SANS}`, '#111'); const zc = fit(x, c, 150, 500, SANS, 28, 20); T(x, c, R - 95, yy, `500 ${zc}px ${SANS}`, '#111'); });
    });
    row(130, '용    법', (y, h) => { const z = fit(x, e.how, R - C - 60, 500, SANS, 36, 24); T(x, e.how, C + 36, y + h / 2 + 13, `500 ${z}px ${SANS}`, '#111', 'left'); });
    row(140, '주의 사항', (y, h) => { const z = fit(x, e.note, R - C - 60, 500, SANS, 34, 22); T(x, e.note, C + 36, y + h / 2 + 12, `500 ${z}px ${SANS}`, '#111', 'left'); });
    T(x, '처방한 곳  마음내과', 140, 1245, `700 38px ${SANS}`, '#18322A', 'left', 4);
    seal(x, 860, 1225, ['마음', '내과'], 150, true, 0.12);
    mark(x);
  },
  news(x, e, n) {
    paper(x, '#F5F1E6', '#ECE5D3');
    x.fillStyle = '#1A1814'; x.fillRect(60, 70, W - 120, 6); x.fillRect(60, 250, W - 120, 3); x.fillRect(60, 258, W - 120, 1);
    T(x, '오늘신문', W / 2, 212, `800 132px ${SER}`, '#1A1814', 'center', 18);
    T(x, `${DATE_KO} ${WD}요일`, 70, 300, `700 28px ${SER}`, '#3A352C', 'left'); T(x, '제1호 · 무료', W - 70, 300, `700 28px ${SER}`, '#3A352C', 'right');
    rr(x, 70, 120, 150, 110, 8); x.fillStyle = '#B5281F'; x.fill(); T(x, '號外', 145, 196, `800 54px ${SER}`, '#fff');
    x.fillStyle = '#1A1814'; x.fillRect(60, 322, W - 120, 2);
    T(x, `[${e.tag}]`, 70, 410, `800 54px ${SER}`, '#B5281F', 'left');
    const hl = e.h.map(l => josa(l, n)); let y = 520;
    hl.forEach(l => { const z = fit(x, l, W - 140, 800, SER, 104, 56); T(x, l, 70, y, `800 ${z}px ${SER}`, '#111', 'left'); y += z * 1.12; });
    y += 14; const zs = fit(x, e.sub, W - 140, 700, SER, 40, 26); T(x, e.sub, 70, y, `700 ${zs}px ${SER}`, '#3A352C', 'left');
    y += 34; x.fillStyle = '#1A1814'; x.fillRect(60, y, W - 120, 2);
    // 본문 두 단 — 왼쪽은 진짜 글, 오른쪽은 신문 결(회색 줄)
    const lede = josa(e.lede, n), colW = 440; x.font = `400 32px ${SER}`;
    const words = lede.split(' '); let line = '', ly = y + 62; const lines = [];
    words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > colW) { lines.push(line); line = wd; } else line = t; }); if (line) lines.push(line);
    lines.filter((l, i) => ly + i * 50 < 1190).forEach((l, i) => T(x, l, 70, ly + i * 50, `400 32px ${SER}`, '#2A2620', 'left'));
    x.fillStyle = '#1A1814'; x.fillRect(W / 2 + 10, y + 30, 1, 1180 - y - 30);
    x.fillStyle = 'rgba(40,36,28,.16)'; for (let i = 0; i < 9 && y + 64 + i * 50 < 1190; i++) x.fillRect(W / 2 + 40, y + 46 + i * 50, (i % 4 === 3 ? 300 : 440) - (i * 13 % 50), 18);
    x.fillStyle = '#1A1814'; x.fillRect(60, 1210, W - 120, 3);
    T(x, '이 신문은 오늘 하루 무료로 배달됩니다', W / 2, 1265, `700 30px ${SER}`, '#3A352C');
    mark(x);
  },
  bill(x, e, n) {
    paper(x, '#E7E3DB', '#DCD6CB');
    const L = 210, R = W - 210, top = 90, bot = 1250;
    x.save(); x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 30; x.shadowOffsetY = 10;
    x.beginPath(); x.moveTo(L, top); x.lineTo(R, top); x.lineTo(R, bot);
    for (let X = R; X > L; X -= 30) { x.lineTo(X - 15, bot + 16); x.lineTo(X - 30, bot); }
    x.closePath(); x.fillStyle = '#FFFFFF'; x.fill(); x.restore();
    const cx = W / 2, mono = SANS, dash = yy => { x.strokeStyle = '#999'; x.setLineDash([8, 7]); x.lineWidth = 2; x.beginPath(); x.moveTo(L + 30, yy); x.lineTo(R - 30, yy); x.stroke(); x.setLineDash([]); };
    T(x, '마음상회', cx, 200, `700 62px ${mono}`, '#111', 'center', 10);
    T(x, '영업시간 24시간 · 연중무휴', cx, 248, `400 26px ${mono}`, '#555');
    dash(285);
    const zt = fit(x, e.t, R - L - 80, 700, mono, 40, 26); T(x, e.t, cx, 345, `700 ${zt}px ${mono}`, '#111');
    T(x, `${Y}-${String(MM).padStart(2, '0')}-${String(DD).padStart(2, '0')} (${WD}) 08:00`, L + 40, 400, `400 28px ${mono}`, '#333', 'left');
    const zn = fit(x, '고객  ' + n, R - L - 80, 400, mono, 30, 22); T(x, '고객  ' + n, L + 40, 445, `400 ${zn}px ${mono}`, '#333', 'left');
    dash(480);
    T(x, '품목', L + 40, 530, `700 28px ${mono}`, '#111', 'left'); T(x, '수량', R - 220, 530, `700 28px ${mono}`, '#111'); T(x, '금액', R - 40, 530, `700 28px ${mono}`, '#111', 'right');
    e.rows.forEach(([a, q, p], i) => { const yy = 600 + i * 72; const z = fit(x, a, R - L - 330, 400, mono, 32, 22);
      T(x, a, L + 40, yy, `400 ${z}px ${mono}`, '#111', 'left'); T(x, q, R - 220, yy, `400 30px ${mono}`, '#111');
      const pv = /^[0-9]+$/.test(p) ? '₩' + p : p; const zp = fit(x, pv, 190, 700, mono, 30, 18); T(x, pv, R - 40, yy, `700 ${zp}px ${mono}`, p.startsWith('-') || /환불|반품/.test(p) ? '#B0302A' : '#111', 'right'); });
    dash(600 + e.rows.length * 72 - 20);
    const sy = 600 + e.rows.length * 72 + 50;
    T(x, '합계', L + 40, sy, `700 40px ${mono}`, '#111', 'left'); const zs = fit(x, e.sum, R - L - 240, 800, mono, 44, 26); T(x, e.sum, R - 40, sy, `800 ${zs}px ${mono}`, '#111', 'right');
    T(x, '결제  마음카드 (일시불)', L + 40, sy + 60, `400 28px ${mono}`, '#333', 'left');
    // 바코드
    let bx = L + 70; const by = sy + 110; x.fillStyle = '#111';
    for (let i = 0; bx < R - 70; i++) { const w = [3, 6, 2, 4, 8, 2, 5][(i * 7 + DAY) % 7]; x.fillRect(bx, by, w, 110); bx += w + [4, 3, 6, 2][(i + DAY) % 4]; }
    T(x, '또 오세요 :)', cx, by + 170, `700 34px ${mono}`, '#111');
    mark(x);
  },
  pass(x, e, n) {
    paper(x, '#E9EEF1', '#DCE3E8');
    const L = 90, R = W - 90, top = 150, cut = 920, bot = 1220;
    x.save(); x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 34; x.shadowOffsetY = 12; rr(x, L, top, R - L, bot - top, 36); x.fillStyle = '#fff'; x.fill(); x.restore();
    x.save(); rr(x, L, top, R - L, bot - top, 36); x.clip(); x.fillStyle = '#1D2B36'; x.fillRect(L, top, R - L, 130); x.restore();
    T(x, 'BOARDING PASS', L + 50, top + 82, `700 40px ${SANS}`, '#fff', 'left', 6); T(x, '탑승권', R - 50, top + 82, `700 40px ${SANS}`, '#E9D9A6', 'right', 6);
    const col = (X, a, b, al) => { T(x, a, X, top + 300, `800 120px ${SANS}`, '#1D2B36', al, 4); const z = fit(x, b, 380, 700, SANS, 40, 26); T(x, b, X, top + 370, `700 ${z}px ${SANS}`, '#56626B', al); };
    col(L + 60, e.from[1], e.from[0], 'left'); col(R - 60, e.to[1], e.to[0], 'right');
    // 비행기 — 가운데 점선과 작은 비행기
    x.strokeStyle = '#9AA6AE'; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 110, top + 262); x.lineTo(W / 2 + 110, top + 262); x.stroke(); x.setLineDash([]);
    x.save(); x.translate(W / 2, top + 262); x.fillStyle = '#1D2B36'; x.beginPath(); x.moveTo(34, 0); x.lineTo(-26, -8); x.lineTo(-30, 0); x.lineTo(-26, 8); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(6, 0); x.lineTo(-12, -32); x.lineTo(-20, -32); x.lineTo(-8, 0); x.lineTo(-20, 32); x.lineTo(-12, 32); x.closePath(); x.fill(); x.restore();
    const f = (X, Y, a, b, al = 'left') => { T(x, a, X, Y, `500 28px ${SANS}`, '#7A858D', al, 2); const z = fit(x, b, 400, 700, SANS, 44, 26); T(x, b, X, Y + 56, `700 ${z}px ${SANS}`, '#1D2B36', al); };
    f(L + 60, top + 470, '승객 PASSENGER', n); f(R - 60, top + 470, '편명 FLIGHT', `MJ ${String(MM).padStart(2, '0')}${String(DD).padStart(2, '0')}`, 'right');
    f(L + 60, top + 600, '좌석 SEAT', e.seat); f(R - 60, top + 600, '탑승구 GATE', e.gate, 'right');
    // 자르는 줄
    x.fillStyle = '#E9EEF1'; x.beginPath(); x.arc(L, cut, 28, 0, Math.PI * 2); x.arc(R, cut, 28, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#B9C2C8'; x.setLineDash([12, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(L + 40, cut); x.lineTo(R - 40, cut); x.stroke(); x.setLineDash([]);
    f(L + 60, cut + 70, '출발 BOARDING', e.time);
    const zn = fit(x, e.note, R - L - 120, 500, SANS, 30, 20); T(x, e.note, L + 60, cut + 215, `500 ${zn}px ${SANS}`, '#56626B', 'left');
    let bx = R - 330; x.fillStyle = '#1D2B36'; for (let i = 0; bx < R - 60; i++) { const w = [3, 6, 2, 4, 7][(i * 3 + DAY) % 5]; x.fillRect(bx, cut + 60, w, 100); bx += w + [3, 5, 2][(i + DAY) % 3]; }
    T(x, '좋은 여행 되세요', W / 2, 1300, `700 34px ${SANS}`, '#1D2B36');
    mark(x);
  },
};

export async function drawFun(id, name, tab, scale = 1) {
  const cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const x = cv.getContext('2d'); x.scale(scale, scale);
  const n = who(name, tab), e = today(id);
  const cap = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
  if (document.fonts) await Promise.all([cap(document.fonts.load(`800 60px "Nanum Myeongjo"`, '상장임명오늘신문' + n), 2500), cap(document.fonts.load(`700 40px "Noto Sans KR"`, '처방전마음상회' + n), 2500), cap(document.fonts.load(`400 30px "Noto Sans KR"`, '가'), 2500)]);
  DRAW[id](x, e, n);
  return cv;
}
