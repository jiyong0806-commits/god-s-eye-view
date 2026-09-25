# Google 3D 상업화/한도 설정 체크리스트

이 앱에서 영상처럼 보이는 세밀한 3D 건물은 Google Maps Photorealistic 3D Tiles가 붙었을 때 나온다. Esri/NASA/OSM 대체 지도는 무료로 볼 수 있지만, 영상 같은 포토리얼 건물 품질은 아니다.

## 지금 왜 3D 건물이 안 뜨나

현재 저장된 `GOOGLE_MAPS_API_KEY`는 Google Map Tiles API에서 `API_KEY_INVALID`로 거절된다. 키가 비어 있는 문제가 아니라 Google Cloud 쪽 키 유효성, API 활성화, 결제 계정, 제한 설정 중 하나가 맞지 않는 상태다.

## Google Cloud에서 해야 할 설정

1. Google Cloud Console에서 새 API 키를 만든다.
2. `APIs & Services > Enabled APIs`에서 `Map Tiles API`를 활성화한다.
3. 결제 계정을 연결한다. Photorealistic 3D Tiles는 무료 전용 API가 아니라 종량제 SKU다.
4. API 제한을 건다: `Map Tiles API`만 허용한다. 앱에서 Google Places/검색을 같은 키로 쓸 경우 필요한 Google API만 추가한다.
5. 애플리케이션 제한을 건다: 웹 앱용 키는 `HTTP referrers`를 사용한다.
6. 개발용 리퍼러 예시:
   - `http://localhost:5000/*`
   - `http://127.0.0.1:5000/*`
7. 배포용 리퍼러 예시:
   - `https://도메인.app/*`
   - `https://www.도메인.app/*`
8. 한도 제한:
   - Google Cloud Console의 `Quotas`에서 Map Tiles API 일일 한도를 낮게 설정한다.
   - 개발 중에는 100~300 root tileset queries/day 정도로 시작한다.
   - 운영 전에는 예상 사용량에 맞춰 올리되 예산 알림을 반드시 둔다.
9. Billing Budget:
   - 예산 알림을 0원, 5달러, 10달러 같은 낮은 구간에 건다.
   - 갑자기 비용이 튀면 키를 즉시 비활성화하거나 제한을 더 좁힌다.

## 무료가 맞나

완전 무료가 아니다. Google 가격표 기준 Photorealistic 3D Tiles는 월 무료 사용량이 일부 있고, 그 이후에는 1,000 이벤트당 과금된다. Google 문서에는 Map Tiles API 사용 시 결제 활성화와 API 키 또는 OAuth 토큰이 필요하다고 되어 있다.

## 상업화 가능한가

가능한 방향으로 갈 수 있지만 조건이 있다.

- Google Maps attribution/credit을 숨기지 않는다.
- Google 3D Tiles, Street View, 지도 이미지를 저장, 스크래핑, 복제, 오프라인 번들링하지 않는다.
- Google 3D Tiles에서 건물/도로/POI를 추출해서 별도 데이터로 팔거나 재배포하지 않는다.
- 자체 데이터 레이어는 Google 데이터와 출처가 다르다는 점을 UI나 attribution에서 분리한다.
- 영상 홍보물은 Google Map Tiles 정책의 영상 조건을 따른다. 특히 Street View 이미지를 포함하지 않고, 정책상 요구되는 attribution을 유지한다.

## 건물 품질 선택지

- 최고 품질: Google Photorealistic 3D Tiles. 유효한 키, 결제, 제한 설정 필요.
- 무료 대체: Esri World Imagery + OpenBuildings/Re:Earth 계열 3D 건물. 가볍고 무료에 가깝지만 영상처럼 텍스처가 입혀진 포토리얼 건물은 아니다.
- 오프라인: Google 3D Tiles는 오프라인 저장/캐싱 용도로 쓰면 안 된다. 오프라인 제품은 직접 확보한 라이선스의 3D Tiles/건물 데이터를 별도로 패키징해야 한다.

## 이 앱의 안전 기본값

- Google 3D 실패 시 앱은 죽지 않고 Esri/NASA 무료 지도 소스로 후퇴한다.
- Google 3D 타일셋에는 `showCreditsOnScreen: true`를 사용해 attribution 표시를 유지한다.
- 무료/공개 데이터 레이어는 지도 베이스맵과 분리된 레이어로 켜고 끈다.
