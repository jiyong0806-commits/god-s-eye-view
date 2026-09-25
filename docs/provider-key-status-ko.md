# 외부 서비스 키 현황 (2026-09-20)

키 값은 기록하지 않는다. `C:\Users\shin2\.codex\.sandbox\.env`는 로컬 파일이며 Sites 공개 배포 환경 변수와 자동 동기화되지 않는다. 공개 Sites 환경 변수는 현재 0개다.

| 기능 | 필요한 설정 | 현재 상태 | 조치 |
| --- | --- | --- | --- |
| ElevenLabs 음성 | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `GEV_TTS_ENABLED=1` | 키 읽기 API 응답 200. 음성 ID와 서버 사용 한도 미설정 | 키에 TTS 권한과 사용 한도를 설정하고 음성 ID를 선택한 뒤 서버 비밀 변수로 배포. 공개 TTS 경로의 계정별 제한을 먼저 구현해야 함. |
| OpenSky 항공기 | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | 로컬 파일에 `OPEN_CLIENT_SECRET`라는 다른 이름으로 존재 | 변수명을 고치되, 공개 Worker는 별도 이용 허가가 확인되기 전 `GEV_OPENSKY_LICENSED=1`을 설정하지 않음. 지역 ADS-B 대체 피드는 키 없이 동작하나 429 제한이 있음. |
| AISStream 선박 | `AISSTREAM_API_KEY` | 로컬 파일에 존재 | 공개 Worker에 AIS 장기 연결 백엔드가 없으므로 변수만 추가해도 복구되지 않음. 별도 스트리밍 서비스 필요. |
| NASA FIRMS 화재 | `FIRMS_MAP_KEY` | 로컬 키로 공식 상태 API 200 및 지역 CSV 확인. Sites 서버 비밀 변수 등록 | 공개 Worker에 NOAA-20 경로, 30분 캐시와 2만 건 상한을 추가함. 배포 후 공개 응답 확인 필요. |
| TomTom 교통 | `TOMTOM_API_KEY` | 로컬 파일에 존재 | 공개 Worker의 교통 프록시와 일일 요청 예산 구현 필요. |
| 위성 | 키 없음 (기본 CelesTrak/SatNOGS) | 공개 Worker 경로 있음 | 공급자 응답, 캐시, 화면 데이터를 검증. |
| Google 포토리얼리스틱 3D/거리 사진 | `GOOGLE_MAPS_API_KEY` | 로컬 파일에 없음 | 선택 사항. 결제 계정과 API 제한 필요. 승인 전 활성화하지 않음. |
| Cesium ion 지형/에셋 | `CESIUM_ION_TOKEN` | 로컬 파일에 없음 | 선택 사항. 사용하는 ion 에셋의 조건과 사용량 확인. |
| Launch Library 2 추가 한도 | `LL2_API_TOKEN` | 로컬 파일에 없음 | 선택 사항. 키 없는 응답이 제한될 때만 신청. |
| OSM 로그인 | `OSM_CLIENT_ID`, `OSM_CLIENT_SECRET`, 리디렉션 URI | 로컬 파일에 존재 | OSM OAuth용이다. 지도/Overpass 열람 키가 아니며 서비스 로그인 백엔드를 대체하지 않는다. |

키를 새로 받기 전에 서비스 자체의 공개 배포 경로, 약관, 한도와 서버 비밀 보관을 확인한다. 로컬에서 성공한 요청은 공개 Worker에서 자동으로 성공하지 않는다. 비용이 발생할 수 있는 키는 공개 프런트엔드 번들에 넣지 않는다.
