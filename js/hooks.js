// 판갈이 시안 (대표 2026-10-24): 칸 하나하나가 유튜브 썸네일처럼 — 사진 + 눌러 보고 싶게 만드는 한 줄.
// 칸 이름(오늘의 한 끼…)은 작은 머리말로 내리고, 큰 글씨는 '말 거는 제목'.
// 시안에서는 오늘 내용을 보고 손으로 쓴 제목을 쓴다. 올릴 때는 매일 만드는 쪽(gen_daily)이 hooks 를 함께 써 준다.
export const SAMPLE = {
  play: { kick: '심리 테스트 · 놀이', hook: '1년째 프사 안 바꾼 그 사람, 속마음은?', sub: '카톡 프사로 읽는 요즘 마음 · 놀이 네 가지' },
  luck: { kick: '오늘의 운세', hook: '띠마다 오늘 딱 하나 조심할 것, 내 띠는?', sub: '꿈 해몽도 함께' },
  food: { kick: '오늘의 한 끼 · 연근 명란 파스타', hook: '연근 하나로 파스타가 이렇게 된다고?', sub: '아삭한 연근에 짭조름한 명란, 20분' },
  book: { kick: '오늘의 한 권 · 『외로운 도시』', hook: '혼자가 편한데, 왜 가끔 사무치게 외로울까', sub: '호퍼의 그림 앞에서 시작하는 이야기' },
  quiz: { kick: '오늘의 시사 상식 · 스킴플레이션', hook: '값은 그대로인데 뭔가 달라졌다면, 그걸 부르는 말', sub: '알아 두면 대화가 달라지는 단어 하나' },
  culture: { kick: '오늘의 문화', hook: '출근길 3분, 마음에 오래 걸릴 한 문장', sub: '시 · 그림 · 명언 · 피식 웃는 이야기' },
};
export function apply(H = SAMPLE) {
  for (const [k, v] of Object.entries(H)) {
    const b = document.querySelector(`.tabsec[data-g="g1"] [data-open="${k}"] .b-text > div`); if (!b) continue;
    const h3 = b.querySelector('h3'), p = b.querySelector('p');
    let kk = b.querySelector('.b-kick'); if (!kk) { kk = document.createElement('span'); kk.className = 'b-kick'; b.prepend(kk); }
    kk.textContent = v.kick; if (h3) { h3.textContent = v.hook; h3.classList.add('b-hook'); } if (p) p.textContent = v.sub;
    const ban = b.closest('.banner'); ban.classList.add('thumb');
    const lab = ban.previousElementSibling; if (lab && lab.classList.contains('label')) lab.classList.add('thumb-lab');   // 머리말이 칸 안으로 들어갔으니 위 이름표는 감춘다
  }
}
