# 인문학 대전 전시 페이지

- 공개 경로: `/event/`; 인쇄용 QR: `public/event/qr.svg`.
- `public/event/booths.json`은 공식 행사 배치도 확인 후 수정한다. 각 항목은 `id`, `number`, `name`, `topic`, `location`, `description`, `x`, `y`를 사용한다. `x`와 `y`는 전시장 도식 안의 0~100% 좌표다.
- 현재 `booths`는 빈 배열이다. 실제 부스 번호와 위치가 제공되지 않았으므로 방문자에게 가상 위치를 표시하지 않는다.
- 행사 영상: `public/event/access-loop.webm`(제공된 로그인 히어로 배경), `public/event/feature-motion.webm`(제공된 모션 파일). 168MB 원본 MP4는 모바일 로딩과 배포 용량 때문에 포함하지 않았다. 별도 압축본을 받은 뒤 교체한다.
- 사이트 본체의 로그인 페이지와 인증 기능을 이 소개 페이지에 복사하지 않는다. 제공된 로그인 히어로의 영상 분위기만 사용하며 가짜 로그인 성공 동작은 배제한다.
