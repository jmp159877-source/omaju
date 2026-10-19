# 오프닝 목소리 견본 (Gemini TTS) — 문장 조각마다 따로 만들어 out_voice/{who}_{n}.wav 로 저장 (자막·장면 맞추기 쉽게)
import os, json, base64, urllib.request, wave, time, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_check import check
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.1-flash-tts-preview']
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
PROFILE_ANCHOR = {
 'miso': '[목소리 설정] 45세 한국 여성 아나운서. 반듯하고 품위 있는 진행자, 교양 프로그램 진행 경력. 안정된 중음, 따뜻하지만 가볍지 않고, 발음이 또렷하며 말끝이 단정하게 내려앉는다. 들뜬 톤·애교·과장된 웃음 금지.',
 'hangyeol': '[목소리 설정] 46세 한국 남성 아나운서. 반듯하고 신뢰감 있는 진행자. 낮고 안정된 중저음, 여유 있고 차분하지만 따뜻하다. 까부는 톤·과장된 리액션·들뜬 말투 금지.',
}
AUDITION = {
 # 오늘(10/19) 아침 대본 그대로 — 목소리만 바꿔 견준다
 'miso': (['Laomedeia', 'Callirrhoe'],
          '안녕하세요! 좋은 아침입니다, 윤미소예요. 쌀쌀해진 월요일 아침, 따뜻한 차 한 잔 생각나시죠? '
          '주말에 동네 공원이나 숲길 한 번 걸어보셨어요? 바스락거리는 마른 잎 소리가 유난히 크게 들리더라고요. '
          '문득 낡은 책에서 밑줄 쳐둔 문장 하나가 떠올랐어요. 비워내야 할 때는 망설임 없이 손을 놓는 나무처럼. '
          '화려한 단풍을 내려놓고 겨울을 준비하는 멋진 태도죠. '
          '오늘 인사 카드에 창가로 드는 볕이 참 고운 계절, 이라는 글이 담겼어요. '
          '바쁜 걸음 늦추고 숨 고르라고 다정하게 한 장 보내 보세요. '
          '우리도 너무 힘주지 말고 조금은 홀가분하게 한 주 시작해 볼까요? 오늘도 기분 좋은 하루 보내세요! '
          '내일은 서한결 씨가 천구백구십사년 가을, 빨간 우체통을 들고 옵니다. 오마주, 윤미소였습니다.'),
}
# 읽는 결은 지금 오프닝에서 쓰는 것 그대로 (목소리만 견준다)
TONES = {
 'now': '[목소리 설정] 45세 한국 여성 방송 진행자. **맑고 경쾌하고, 무엇보다 반갑다.** 문을 열고 들어온 사람을 보고 "어서 오세요!" 하는 그 밝은 기운이 첫마디부터 묻어난다. 목소리에 미소가 걸려 있고, 톤이 살짝 올라가며 생기가 있다. 지적이지만 하나도 어렵지 않고 친구처럼 가깝다. **금지: 뉴스 앵커의 보도 말투, 심야 라디오의 낮고 차분한 톤, 명상 안내 같은 느린 말투, 애교·콧소리.**',
}
# 오디션 때 높이를 낮춘 벌도 같이 만든다 (0% · -8%) — 너무 어리게 들리는 걸 귀로 견줘 고르려고
AUD_DROP = []   # 늘여서 낮추는 방법은 쓰지 않는다 (2026-10-18)
PROFILE = {
 'miso': '[목소리 설정] 45세 한국 여성 진행자. 세련되고 생기 있는 사람. 맑고 탄력 있는 중음, 웃음이 잘 묻어남. 차분한 낭독조·나이 든 말투 금지.',
 'hangyeol': '[목소리 설정] 46세 한국 남성 진행자. 유쾌하고 센스 있는 사람. 따뜻한 중저음이지만 무겁지 않고 경쾌함. 느린 설명조·아저씨 말투 금지.',
}
STYLE = {
 'greet': '[연출] 프로그램을 여는 아나운서의 첫인사. 단정하고 밝게, 반가움이 묻어나게. 보통 빠르기.',
 'story': '[연출] 아나운서가 청취자 사연을 읽어 주듯 차분하고 따뜻하게. 웃긴 대목은 미소를 머금고, 뭉클한 대목은 살짝 천천히. 따옴표 속 쪽지·대사는 담백하게 실감 나게. 과장 금지.',
 'close': '[연출] 단정하고 따뜻한 마무리 인사. 힘을 주되 들뜨지 않게.',
}
VOICE = {'miso': 'Callirrhoe', 'hangyeol': 'Charon'}
SEG = {
 "miso": [
  ('greet', '좋은 아침입니다, 미소입니다.'),
  ('greet', '금요일이에요. 벌써 한 주의 반은 이긴 셈이죠. 오늘은 어깨 한 번 쫙 펴고 시작해 보세요.'),
  ('story', '오늘 사연은 쉰다섯 정희 씨의 이야기입니다. 몇 달째 밤 열한 시만 되면 윗집에서 쿵, 쿵. 석 달을 참다 참다 엘리베이터에 쪽지를 붙였대요. 최대한 우아하게요.'),
  ('story', '천이백삼 호님, 혹시… 밤마다 줄넘기하세요?'),
  ('story', '다음 날, 그 밑에 삐뚤삐뚤한 글씨로 답장이 달렸어요.'),
  ('story', '죄송합니다. 발목 수술하고 걷는 연습 중이에요. 내년 봄 마라톤이 목표인데, 낮에 절뚝거리는 게 창피해서 밤에만 걸었어요. … 정희 씨, 그날 밤 한숨도 못 잤대요. 그리고 쪽지를 하나 더 붙였죠.'),
  ('story', '내일 저녁 일곱 시, 놀이터 앞. 같이 걸어요. 제가 천천히 걸을게요.'),
  ('story', '그런데요, 사흘 만에 숨이 찬 건 정희 씨였대요. 저기… 조금만 천천히요.'),
  ('story', '그렇게 반년. 지난주 하프 마라톤에서 천이백삼 호 분이 먼저 들어왔대요. 그리고 결승선에서 정희 씨를 기다리며 그러더래요.'),
  ('story', '이번엔 제가 기다릴게요.'),
  ('close', '오늘 하루, 누군가에게 천천히 걸어 주는 사람이 돼 보세요. 아니면, 기다려 주는 사람이든요.'),
  ('close', '오늘도 좋은 하루 보내세요.'),
  ('close', '내일은 한결 씨가 새 사연을 가져옵니다.'),
 ],
 "hangyeol": [
  ('greet', '오늘 하루도 수고 많으셨습니다, 한결입니다.'),
  ('greet', '토요일 저녁이네요. 오늘은 나한테 좋은 거 하나 해 주기로 해요. 소파에서 제일 편한 자리부터 맡으시고요.'),
  ('story', '오늘 사연은 마흔아홉 지훈 씨의 이야기입니다. 중고거래 앱에 이십 년 묵은 통기타를 올렸대요. 대학 때 아르바이트비 모아서 산 기타. 이제 칠 일도 없다고, 오만 원에요.'),
  ('story', '바로 채팅이 왔는데요, 첫 마디가… 혹시 이 기타로 고백해 본 적 있으세요?'),
  ('story', '있죠, 딱 한 번. 성공했고요. 그렇게 답하고 약속 장소에 나갔더니…'),
  ('story', '열일곱 살 남학생이 서 있더래요. 다음 주 학교 축제에서, 좋아하는 친구 앞에서 노래를 한대요.'),
  ('story', '그 자리에서 한번 쳐 보라고 했더니… 코드를 딱 세 개 알더래요.'),
  ('story', '지훈 씨, 이십 년 만에 기타를 다시 받아 들었대요. 놀이터 벤치에서 한 시간 특훈. 오만 원은 안 받고, 조건을 하나 걸었대요. 결과 보고. 그리고 오늘 아침, 문자가 왔답니다.'),
  ('story', '아저씨, 이 기타 고백 성공률 백 퍼센트 맞네요.'),
  ('close', '여러분 집에도 잠자고 있는 거 하나쯤 있죠? 오늘 밤 한번 꺼내 보세요. 누군가의 백 퍼센트가 될지도 모르니까요.'),
  ('close', '편안한 저녁 되십시오. 푹 쉬시고요.'),
  ('close', '내일은 미소 씨가 새 사연을 가져옵니다.'),
 ],
}
os.makedirs('out_voice', exist_ok=True)
LOG = open('out_voice/log.txt', 'w')
def say(*a): print(*a); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()
def tts(model, voice, text):
    body = {'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
    return base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
if os.environ.get('WHOLE'):
    # 한 사람 대본 전체를 한 번에 녹음 (요청 수를 줄임). 문장 사이는 쉼표 대신 줄바꿈 + '(쉼)'
    for who, segs in SEG.items():
        if not segs: continue
        text = '\n'.join(t for _, t in segs)
        prompt = ('[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE_ANCHOR[who] + '\n'
                  '[연출] 첫인사는 단정하고 밝게. 사연은 아나운서가 청취자 사연을 읽어 주듯 차분하고 따뜻하게, 웃긴 대목은 미소를 머금고 뭉클한 대목은 살짝 천천히. '
                  '마무리는 단정하고 따뜻하게. 줄이 바뀔 때마다 반 박자 쉬기. 과장 금지.\n\n[읽을 대본 — 이 부분만 읽기]\n' + text)
        for m in ['gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts']:
            try: pcm = tts(m, VOICE[who], prompt)
            except Exception as e: say('실패', who, m, str(e)[:90]); time.sleep(5); continue
            ok, heard, ratio = check(KEY, pcm, text)
            say('전체', who, m, round(len(pcm) / 48000, 1), '일치', ratio, '통과' if ok else '불일치', heard[:60])
            with wave.open(f'out_voice/{who}_full_{m}.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
            if ok: break
    SEG = {}
if os.environ.get('AUDITION'):
    for who, (vs, line) in AUDITION.items():
        if ONLY and who not in ONLY: continue
        for v in vs:
          for tone, prof in TONES.items():
            time.sleep(7)
            direct = ('[연출] 아침을 여는 생방송 오프닝. **첫마디 "안녕하세요"에 반가움을 가득 싣는다** — 오랜만에 만난 사람을 보고 환하게 웃으며 건네는 인사처럼. '
                      '전체를 밝고 경쾌하게, 말에 생기를 두고 가볍게 굴린다. 심야 라디오처럼 낮게 깔지 말 것. '
                      '궁금한 대목에서는 살짝 뜸을 들였다가 풀어 준다. 마무리와 사인오프는 환하게, 내일 또 만나자는 결로. '
                      '뉴스 읽기·낭독조·느린 설명조 금지. 그렇다고 호들갑·애교는 아니다.')
            prompt = '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + prof + '\n' + direct + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + line
            for attempt in range(4):
                try: pcm = tts(MODELS[0], v, prompt)
                except Exception as e: say('실패', who, v, tone, str(e)[:100]); time.sleep(20); continue
                base = f'out_voice/{who}_{v}_{tone}.wav'
                with wave.open(base, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
                for suf, r in AUD_DROP:   # 낮춘 벌: 같은 소리를 느린 박자로 적어 두면 높이도 같이 내려간다 (ffmpeg 없이)
                    if not suf: continue
                    with wave.open(f'out_voice/{who}_{v}{suf}.wav', 'wb') as w:
                        w.setnchannels(1); w.setsampwidth(2); w.setframerate(int(24000 * r)); w.writeframes(pcm)
                say('완료', who, v, tone, round(len(pcm) / 48000, 1)); break
    SEG = {}
for who, segs in SEG.items():
    for n, (kind, line) in enumerate(segs):
        if ONLY and f'{who}_{n}' not in ONLY: continue
        time.sleep(int(os.environ.get('PAUSE', '7')))
        prompt = '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE_ANCHOR[who] + '\n' + STYLE[kind] + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + line
        done = False
        for m in MODELS:
            for attempt in range(4):
                try: pcm = tts(m, VOICE[who], prompt)
                except Exception as e:
                    det = e.read().decode()[:200] if hasattr(e, 'read') else ''
                    say('실패', who, n, m, attempt, str(e)[:120], det); time.sleep(60); continue
                sec = len(pcm) / 48000
                ok, heard, ratio = check(KEY, pcm, line)
                if not ok: say('받아쓰기 불일치', who, n, ratio, heard[:80]); time.sleep(20); continue
                with wave.open(f'out_voice/{who}_{n}.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
                say('완료', who, n, m, round(sec, 1), '일치', ratio); done = True; break
            if done: break
