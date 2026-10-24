// 오늘의 오프닝 (미소·한결) — media 가지의 opening/{날짜}.json 과 목소리를 읽어, 목소리에 맞춰 장면·자막을 넘긴다.
// 소리는 '소리 켜고 듣기'를 눌러야만 나고, 칸이 화면에서 벗어나거나 다른 코너·앱으로 가면 저절로 멈춘다.
const RAW = 'https://raw.githubusercontent.com/jmp159877-source/omaju/media/opening/';
const CDN = 'https://cdn.jsdelivr.net/gh/jmp159877-source/omaju@media/opening/';
const NAME = { miso: '윤미소', hangyeol: '서한결', eunchae: '송은채' };
const SLOT_KO = { morning: '아침', noon: '오후', evening: '저녁' };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

async function loadDay(k) {
  try { const r = await fetch(RAW + k + '.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  try { const r = await fetch(CDN + k + '.json'); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}

export async function init({ modal, closeModal, toast, DB }) {
  const sec = $('opening'); if (!sec) return;
  // 하루는 새벽 5시에 바뀐다: 자정~5시는 아직 '어제 저녁'이므로 어제 날짜의 저녁 인사를 튼다.
  const now = new Date(); const h = now.getHours(); const base = new Date(now); if (h < 5) base.setDate(base.getDate() - 1);
  let data = null;
  for (let back = 0; back < 3 && !data; back++) { const d = new Date(base); d.setDate(d.getDate() - back); data = await loadDay(key(d)); }
  if (!data || !data.slots) return;
  // 저녁은 여섯 시부터 (운영자 2026-10-19: 다섯 시는 아직 낮이다)
  const slot = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'noon' : 'evening';   // 대표 2026-10-24: 11시 20분에 '오후'가 나왔다 — 정오부터 오후
  const S = data.slots[slot] || data.slots.morning; if (!S || !S.segs || !S.segs.length) return;
  // 어떤 사진을 쓸지는 만드는 쪽(tools/opening.py)이 정해서 imgs 에 담아 준다 —
  // 옷이 두 벌이고 빠진 장면도 있어서, 같은 옷 안에서 메운 결과를 그대로 받아 쓴다.
  const period = slot === 'evening' ? 'eve' : 'mor';
  const host = NAME[data.host] ? data.host : 'miso';
  const pick = (data.imgs || {})[period] || {};
  const img = tag => 'img/hosts/' + (pick[tag] || `${host}-${data.eve === false && period === 'eve' ? 'mor' : period}-${tag}.jpg`);
  const dd = new Date(data.date + 'T00:00:00');

  // 장면(조각마다)·자막(조각 안에서 글자 수 비례) 시간표
  const shots = S.segs.map(s => ({ t: s.t, tag: s.tag }));
  const caps = [];
  S.segs.forEach((s, i) => { const a = s.t, b = i + 1 < S.segs.length ? S.segs[i + 1].t : S.end; const lines = (s.cap && s.cap.length ? s.cap : ['']);
    const L = lines.map(x => x.replace(/\s/g, '').length || 1), tot = L.reduce((p, q) => p + q, 0); let t = a;
    lines.forEach((x, j) => { caps.push({ t, html: esc(x).replace(/\n/g, '<br>') }); t += (b - a) * L[j] / tot; }); });
  const tags = [...new Set(shots.map(s => s.tag))];

  $('opn-date').textContent = `${dd.getMonth() + 1}월 ${dd.getDate()}일 ${WD[dd.getDay()]}요일`;
  $('opn-who').textContent = SLOT_KO[slot];   // 이름은 왼쪽 위 이름표가 맡는다 (대표 2026-10-24)
  $('opn-name').innerHTML = `<b>${NAME[host]}</b><i></i><small>오마주 진행</small>`;
  $('opn-next').textContent = data.next_title || '';
  $('opn-nextbox').hidden = !data.next_title;
  // 처음부터 상반신으로 새로 받은 사진은 확대하지 않는다 (대표 2026-10-24 — 은채2 인사 사진부터). 새로 받으면 여기에 이름을 더한다.
  const UPPER = ['eunchae-mor2-wave'];
  $('opn-stage').innerHTML = tags.map(t => `<i class="opn-shot" data-tag="${t}"${UPPER.some(u => img(t).includes(u)) ? ' data-up="1"' : ''} style="background-image:url('${img(t)}')"></i>`).join('');
  const au = $('opn-audio');
  let shotI = -1, capI = -1, started = false;
  const show = t => {
    let k = 0; shots.forEach((s, i) => { if (t >= s.t) k = i; });
    if (k !== shotI) { shotI = k; const tag = shots[k].tag; $('opn-stage').querySelectorAll('.opn-shot').forEach(e => e.classList.toggle('on', e.dataset.tag === tag)); $('opn-name').classList.toggle('on', k === 0); }
    let c = 0; caps.forEach((x, i) => { if (t >= x.t) c = i; });
    if (c !== capI) { capI = c; $('opn-cap').innerHTML = caps[c].html; }
    $('opn-bar').style.width = Math.min(100, t / S.end * 100) + '%';
  };
  show(0);
  sec.hidden = false;
  // 잎 장식 크기를 CONTENTS 제목과 똑같이
  const syncLeaf = () => { const ref = document.querySelector('.toc-c:not(.opn-toc) .tc-leaf'); if (!ref) return; const w = ref.getBoundingClientRect().width; if (w) sec.querySelectorAll('.opn-toc .tc-leaf').forEach(e => { e.style.width = w + 'px'; e.style.flex = '0 0 auto'; }); };
  syncLeaf(); addEventListener('resize', syncLeaf); if (document.fonts) document.fonts.ready.then(syncLeaf);

  const setCtrl = playing => { $('opn-ctrl').textContent = playing ? '잠시 멈춤' : '이어 듣기'; };
  const playBtn = $('opn-play'), playLabel = playBtn.querySelector('span');
  // 목소리 파일은 대본(JSON)을 준 곳(raw)에서 먼저 받는다. jsDelivr는 그날 새 파일이 몇 시간 늦게 잡혀 첫 재생이 실패하던 원인.
  // 눌러야만 소리가 나되, 파일은 미리 받아 두어 한 번에 재생되게 한다(preload 만으로는 소리가 나지 않음).
  // 소리에도 ?v= 를 붙인다 — 대본(JSON)만 새로 받고 소리는 옛것이 남으면 다른 사람 목소리가 난다 (2026-10-19)
  const vq = data.built ? '?v=' + data.built : '';
  const bases = [RAW, CDN]; let srcI = 0; const setSrc = () => { au.src = bases[srcI] + S.audio + vq; };
  au.preload = 'auto'; setSrc();
  const onPlaying = () => { started = true; playLabel.textContent = '▶ 소리 켜고 듣기'; playBtn.hidden = true; $('opn-ctrl').hidden = false; setCtrl(true); };
  const fail = () => { playLabel.textContent = '▶ 소리 켜고 듣기'; playBtn.disabled = false; toast && toast('소리를 켜지 못했습니다. 다시 눌러 주세요.'); };
  const play = () => {
    if (au.ended) au.currentTime = 0;
    playLabel.textContent = '준비하는 중…'; playBtn.disabled = true;
    au.play().then(onPlaying).catch(() => {
      // 첫 곳에서 못 받으면 같은 누름 안에서 다른 곳으로 바꿔 다시 시도
      if (srcI + 1 < bases.length) { srcI++; setSrc(); au.load(); au.play().then(onPlaying).catch(fail); } else fail();
    }).finally(() => { playBtn.disabled = false; });
  };
  const pause = () => { if (!au.paused) au.pause(); if (started && !au.ended) setCtrl(false); };
  $('opn-play').onclick = play;
  $('opn-ctrl').onclick = () => au.paused ? play() : pause();
  au.ontimeupdate = () => show(au.currentTime);
  au.onended = () => { $('opn-ctrl').hidden = true; $('opn-play').hidden = false; $('opn-play').querySelector('span').textContent = '↻ 다시 듣기'; show(0); };
  // 저절로 멈춤: 다른 앱·탭, 칸이 화면에서 벗어남, 다른 코너로 이동
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('hashchange', pause);
  try { new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio < 0.3) pause(); }), { threshold: [0, 0.3] }).observe($('opn-frame')); } catch (e) {}
  window.omajuOpening = { audio: au, pause, play };

  // 사연 보내기
  $('opn-send').onclick = () => {
    if (!DB.currentUser()) { toast && toast('로그인하면 사연을 보낼 수 있습니다.'); const b = $('login-btn'); b && b.click(); return; }
    modal(`<h2>내 사연 보내기</h2><p class="opn-m-desc">미소와 한결이 아침마다 한 편씩 골라 읽어 드립니다. 웃긴 일, 고마운 사람, 오래 묵혀 둔 이야기 모두 좋습니다. 이름은 바꿔서 읽어 드립니다.</p>
      <textarea id="opn-story" maxlength="1000" rows="7" placeholder="10자 이상, 1000자 안으로 적어 주세요"></textarea>
      <div class="modal-actions"><button type="button" class="btn" id="opn-story-go">보내기</button></div>`, () => {
      $('opn-story-go').onclick = async () => {
        try { await DB.sendStory($('opn-story').value); closeModal(); toast && toast('사연이 잘 도착했습니다. 고맙습니다.'); }
        catch (e) { toast && toast(e.message || '보내지 못했습니다.'); }
      };
    });
  };
}
