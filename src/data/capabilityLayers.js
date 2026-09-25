export function createCapabilityLayer({
  id,
  name,
  icon,
  source = '무료/공개 데이터 연결 대기',
  detail = '상업적으로 안전한 공개 데이터 소스를 연결할 수 있는 기능 슬롯입니다.',
  count = 0,
}) {
  let enabled = false;
  let lastUpdate = null;

  return {
    id,
    name,
    icon,
    source,
    updateInterval: 0,
    statsRefreshInterval: 1000,

    init: async () => {},
    update: async () => {},

    enable: async () => {
      enabled = true;
      return true;
    },

    disable: async () => {
      enabled = false;
      return true;
    },

    destroy: async () => {
      enabled = false;
      lastUpdate = null;
    },

    getStats: () => ({
      count: 0,
      lastUpdate,
      status: enabled ? 'unsupported' : 'idle',
      source,
      coverage: detail,
      available: false,
      error: enabled ? '데이터 공급자 연결이 구현되지 않았습니다.' : null,
      fallback: false,
    }),
  };
}

export default [
  createCapabilityLayer({
    id: 'weather-radar',
    name: '날씨 레이더',
    icon: '◎',
    source: 'RainViewer 무료 레이더 타일',
    detail: '전세계 강수 레이더 애니메이션 레이어',
  }),
  createCapabilityLayer({
    id: 'safety-zones',
    name: '지역 안전도',
    icon: '◇',
    source: 'USGS · FIRMS · OpenAQ 공개 데이터',
    detail: '지역 안전도 색상 레이어: 빨강=나쁨, 노랑=주의, 초록=양호',
  }),
  createCapabilityLayer({
    id: 'shelters-hospitals',
    name: '대피소·병원',
    icon: '✚',
    source: 'OpenStreetMap Overpass',
    detail: '대피소·병원·응급시설 위치 레이어',
  }),
  createCapabilityLayer({
    id: 'speed-cameras',
    name: '속도 카메라',
    icon: '▣',
    source: 'OpenStreetMap Overpass',
    detail: '속도 제한 카메라·교통 단속 카메라 위치',
  }),
  createCapabilityLayer({
    id: 'airports-transit',
    name: '공항·철도·지하철',
    icon: '▤',
    source: 'OpenStreetMap · GTFS 공개 피드',
    detail: '공항·철도·지하철 노선·역 표시',
  }),
  createCapabilityLayer({
    id: 'emergency-vehicles',
    name: '긴급 차량',
    icon: '✦',
    source: '공개 피드가 있는 지역만 가능',
    detail: '경찰차·소방차·구급차는 공개 허용 피드가 있을 때만 표시',
  }),
  createCapabilityLayer({
    id: 'emissions',
    name: '배출량·대기오염',
    icon: '◍',
    source: 'Climate TRACE · OpenAQ 등 공개 데이터',
    detail: 'CO2·가스·대기오염 배출량 레이어',
  }),
  createCapabilityLayer({
    id: 'historic-ruins',
    name: '폐허·역사 장소',
    icon: '◇',
    source: 'OpenStreetMap · Wikidata 공개 데이터',
    detail: '폐허·역사 속 사라진 장소·문화유산 위치',
  }),
  createCapabilityLayer({
    id: 'volcano-ash-flood',
    name: '화산재·홍수 피해',
    icon: '▲',
    source: 'GDACS · Smithsonian GVP · 공개 재난 피드',
    detail: '화산재·홍수·2차 피해 예상 구역',
  }),
  createCapabilityLayer({
    id: 'lightning',
    name: '낙뢰',
    icon: '⌁',
    source: 'Blitzortung 등 공개 낙뢰 피드',
    detail: '실시간 낙뢰 지점에 파란 스파크 효과를 표시',
  }),
  createCapabilityLayer({
    id: 'aurora-solarwind',
    name: '오로라·태양풍',
    icon: '◌',
    source: 'NOAA Space Weather 공개 데이터',
    detail: '오로라 예측 범위와 태양풍 상태',
  }),
  createCapabilityLayer({
    id: 'iss-live',
    name: 'ISS 위치·라이브',
    icon: '◉',
    source: 'CelesTrak · NASA 공개 피드',
    detail: '국제우주정거장 위치와 공개 라이브 뷰 연결',
  }),
  createCapabilityLayer({
    id: 'ocean-currents',
    name: '해류·조석',
    icon: '≈',
    source: 'NOAA · Copernicus 공개 해양 데이터',
    detail: '해협·바다의 흐름 방향과 조석 상태',
  }),
  createCapabilityLayer({
    id: 'borders-labels',
    name: '국경·지역명',
    icon: '□',
    source: 'Natural Earth Public Domain',
    detail: '국가 경계선, 산·바다·해협·지역명 표시',
  }),
  createCapabilityLayer({
    id: 'war-map',
    name: '분쟁 지도',
    icon: '⊕',
    source: 'ACLED · 공개 전선 GeoJSON 필요',
    detail: '상업 사용 조건을 확인한 공개 분쟁 데이터만 연결',
  }),
  createCapabilityLayer({
    id: 'street-photos',
    name: '거리 사진',
    icon: '⌖',
    source: 'Google Street View 또는 허용된 공개 파노라마',
    detail: '현재 좌표 주변 거리 사진 모드',
  }),
  createCapabilityLayer({
    id: 'language-global',
    name: '언어·현지화',
    icon: 'Aa',
    source: '브라우저 Intl · 로컬 번역 테이블',
    detail: '다국어 UI 전환과 검색창 한국어 보강',
  }),
];
