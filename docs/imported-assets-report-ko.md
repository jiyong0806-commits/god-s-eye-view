# 가져온 자산 적용 기록

## 적용됨

- Pretendard 1.3.9: `public/fonts/PretendardVariable.woff2`
- 지도 배경음악: `public/media/map-bgm.mp3`, `public/media/map-bgm-2.mp3`
- 모션 배경 영상: `public/media/animo-spread-rows-720p.webm`
- Plasma/Grok 아바타 정의: `public/avatars/plasma-grok-bot.avatar.json`
- 접근/로그인 히어로: `/auth/` 정적 페이지로 추가
- ElevenLabs Plasma Agent: `agent_6801m2szphtjeh39cmqf2w6fexqj` 공개 위젯으로 추가

## 보류됨

- ElevenLabs API 키는 공개 프론트엔드에 넣지 않음.
- Supabase Auth 실제 연결은 프로젝트 URL/anon key/RLS 정책 확정 후 적용.
- Suno API/배경음악 자동 생성은 공개 키와 과금 정책 확정 후 서버 측에서만 처리.

## 보안 메모

첨부 문서에 포함된 비밀키는 배포 코드에 저장하지 않았다. 이미 공유된 키라면 서비스 제공자 콘솔에서 회전하는 것이 안전하다.
