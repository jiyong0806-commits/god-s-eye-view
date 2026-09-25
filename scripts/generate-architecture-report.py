from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[1]
FONT_DIR = WORKSPACE / "tmp" / "report-fonts"
OUTPUT = WORKSPACE / "output" / "pdf" / "gods-eye-view-architecture-status-ko.pdf"

pdfmetrics.registerFont(TTFont("Pretendard", str(FONT_DIR / "Pretendard-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Pretendard-Bold", str(FONT_DIR / "Pretendard-Bold.ttf")))
pdfmetrics.registerFontFamily("Pretendard", normal="Pretendard", bold="Pretendard-Bold")

INK = colors.HexColor("#11232d")
MUTED = colors.HexColor("#52656f")
ACCENT = colors.HexColor("#087f85")
PALE = colors.HexColor("#eaf3f2")
RULE = colors.HexColor("#d1dfde")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleKo", fontName="Pretendard-Bold", fontSize=25, leading=32, textColor=INK, spaceAfter=16))
styles.add(ParagraphStyle(name="SectionKo", fontName="Pretendard-Bold", fontSize=14, leading=20, textColor=INK, spaceBefore=16, spaceAfter=9))
styles.add(ParagraphStyle(name="BodyKo", fontName="Pretendard", fontSize=9.5, leading=16, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="SmallKo", fontName="Pretendard", fontSize=7.6, leading=12, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="TableKo", fontName="Pretendard", fontSize=8.2, leading=12.4, textColor=INK))
styles.add(ParagraphStyle(name="TableHeadKo", fontName="Pretendard-Bold", fontSize=8.2, leading=12.4, textColor=INK))
styles.add(ParagraphStyle(name="LeadKo", fontName="Pretendard", fontSize=11, leading=19, textColor=MUTED, spaceAfter=18))


def p(text, style="BodyKo"):
    return Paragraph(text, styles[style])


def table(rows, widths, header=True):
    cells = [[p(escape(str(v)), "TableHeadKo" if header and i == 0 else "TableKo") for v in row] for i, row in enumerate(rows)]
    result = Table(cells, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    rules = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, -1), (-1, -1), .5, RULE),
    ]
    if header:
        rules += [("BACKGROUND", (0, 0), (-1, 0), PALE), ("LINEBELOW", (0, 0), (-1, 0), .8, ACCENT)]
    result.setStyle(TableStyle(rules))
    return result


def draw_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(RULE)
    canvas.line(22 * mm, h - 20 * mm, w - 22 * mm, h - 20 * mm)
    canvas.setFont("Pretendard-Bold", 8)
    canvas.setFillColor(ACCENT)
    canvas.drawString(22 * mm, h - 16 * mm, "PLASMA  /  GOD'S EYE VIEW")
    canvas.setFont("Pretendard", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(22 * mm, 15 * mm, "기술·운영 현황 | 2026-09-19 | 확인되지 않은 기능은 완료로 표시하지 않음")
    canvas.drawRightString(w - 22 * mm, 15 * mm, f"{doc.page}")
    canvas.restoreState()


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm,
                      topMargin=27 * mm, bottomMargin=23 * mm, title="GOD'S EYE VIEW 기술·운영 현황",
                      author="PLASMA")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, leftPadding=0, rightPadding=0,
              topPadding=0, bottomPadding=0)
doc.addPageTemplates(PageTemplate(id="standard", frames=[frame], onPage=draw_page))
W = doc.width
story = []

story += [Spacer(1, 14 * mm), p("GOD'S EYE VIEW", "TitleKo"),
          p("코드·백엔드·데이터 레이어 현황 보고서", "LeadKo"),
          p("이 문서는 현재 작업 트리와 공개 Sites 배포 구조를 기준으로 작성했다. 소스코드에 존재하는 기능, 공개 서버에 경로가 있는 기능, 실제 데이터를 받아 검증한 기능은 서로 다르다."),
          p("핵심 결론", "SectionKo"),
          table([
              ("영역", "현재 확인된 상태"),
              ("프런트엔드", "Cesium 기반 단일 페이지 앱. 레이어와 UI 모듈이 많아 초기 JS 번들이 크다."),
              ("로컬 백엔드", "vite.config.js의 개발 서버 미들웨어에 많은 /api 경로가 있다."),
              ("공개 백엔드", "worker/index.js에는 일부 경로만 구현. 로컬 .env는 자동 전달되지 않는다."),
              ("공개 데이터", "위성 TLE·한국어 검색·자전거 GBFS 일부 경로 확인. 항공기 피드는 제공자 429로 불안정."),
              ("인증", "연결된 Supabase 프로젝트가 없어 강제 로그인은 아직 적용하지 않았다."),
          ], [36 * mm, W - 36 * mm]),
          p("진단: 왜 Sites 전환 후 레이어가 사라졌나", "SectionKo"),
          p("로컬에서는 Vite가 /api/*를 처리했으나, 이전 Sites는 정적 파일만 배포했다. 브라우저 폴백과 서비스 워커는 실패를 빈 결과로 바꿔 정상처럼 보이게 했다. 현재는 그 가짜 응답을 제거하고 Worker에 선별된 경로를 복원했다. 나머지 경로는 404 또는 제공자 오류로 남는다."),
          p("숫자·상태 원칙", "SectionKo"),
          p("현재 지도에 표시되는 수치는 제공자의 관측 범위·갱신 시각·필터에 따라 달라진다. 빈 결과는 ‘0건’과 ‘연결 실패’를 구분해야 한다. 위성 궤도·재난 위치·안전 정보는 공식 안내를 대체하지 않는다."),
          PageBreak()]

story += [p("01  실행 구조와 파일 위치", "SectionKo"),
          table([
              ("구성", "소스 위치", "역할"),
              ("3D 지도", "src/main.js, src/map*.js", "Cesium Viewer와 카메라·지도 소스 초기화"),
              ("레이어 제어", "src/data/manager.js, src/ui.js", "레이어 등록·토글·상태 표시"),
              ("항공·위성", "src/data/flights.js, militaryFlights.js, satellites.js", "상태 파싱·마커·궤도 시각화"),
              ("해양·자전거", "src/data/aisLiveVessels.js, bikeshare.js", "선박·GBFS 공급자 호출과 렌더링"),
              ("CCTV·교통", "src/data/cctv.js, traffic.js", "카메라 카탈로그·도로 흐름"),
              ("로컬 API", "vite.config.js", "개발 서버의 프록시·키·WebSocket"),
              ("공개 API", "worker/index.js", "Sites Worker의 제한적 /api 라우트"),
              ("환경 설정", ".env (Git 무시), .env.example", "로컬 비밀값과 비밀 없는 템플릿"),
              ("행사 페이지", "event/, public/event/", "QR 소개·영상·부스 배치 데이터"),
          ], [29 * mm, 67 * mm, W - 96 * mm]),
          p("공개 Worker 라우트", "SectionKo"),
          p("/api/opensky · /api/celestrak/:group · /api/geocode · /api/gbfs/* · /api/rainviewer/metadata · /api/gdacs/alerts · /api/elevenlabs/tts. 이 목록 밖의 로컬 /api 기능은 공개 사이트에서 자동으로 작동하지 않는다."),
          p("02  주요 레이어의 현재 상태", "SectionKo"),
          table([
              ("기능", "공개 상태", "원인 / 필요한 조치"),
              ("항공기", "불안정", "지역 ADS-B 제공자 429. OpenSky 운영 사용 허가 확인 필요."),
              ("군사 항공", "미복구", "/api/adsblol/mil 공개 Worker 경로 없음. 권리·지연·범위 검토 필요."),
              ("위성", "부분 동작", "CelesTrak 일부 그룹 동작, 실패 그룹은 SatNOGS 대체. 전체 그룹 재검증 필요."),
              ("자전거", "경로 검증", "GBFS 허용 목록 프록시 공개 HTTP 200. 도시별 데이터 품질 확인 필요."),
              ("선박", "미복구", "AISStream 키·지속 WebSocket 백엔드 없음."),
              ("CCTV", "미복구", "로컬 카탈로그 /api/cctv/* 공개 Worker 경로 없음."),
              ("교통", "미복구", "TomTom 키는 로컬에 있으나 공개 Worker 비밀값·라우트 없음."),
              ("한국어 검색", "부분 동작", "Nominatim /api/geocode 응답 확인. 공용 서버 사용량 정책 준수 필요."),
          ], [29 * mm, 27 * mm, W - 56 * mm]),
          PageBreak()]

story += [p("03  API와 비밀값 배치", "SectionKo"),
          p("활성 로컬 파일은 work/gods-eye-view-official/.env 하나다. .codex/.sandbox/.env는 별도 파일이며 점검 당시 ELEVENLABS_API_KEY만 있었다. 오래된 sibling 프로젝트 .env와 .env.example은 런타임에서 읽히지 않는다. 확인한 ElevenLabs 키는 공식 검사에서 HTTP 401이었다. TomTom과 NASA FIRMS 로컬 키는 공식 API에서 응답했지만 Sites 런타임에는 설정되지 않았다."),
          table([
              ("공급자", "현재 배치", "공식 계정/API 페이지"),
              ("OpenSky", "로컬 ID/Secret 빈 값", "opensky-network.org"),
              ("AISStream", "로컬 키 빈 값", "aisstream.io"),
              ("TomTom", "로컬 키 검증, 공개 미설정", "developer.tomtom.com"),
              ("NASA FIRMS", "로컬 키 검증, 공개 미설정", "firms.modaps.eosdis.nasa.gov/api/map_key/"),
              ("Google Maps", "로컬 키 빈 값", "console.cloud.google.com/google/maps-apis/overview"),
              ("Cesium ion", "로컬 토큰 빈 값", "ion.cesium.com"),
              ("ElevenLabs", "sandbox 키 401", "elevenlabs.io/app/settings/api-keys"),
              ("Supabase", "연결 프로젝트 없음", "supabase.com/dashboard"),
          ], [31 * mm, 48 * mm, W - 79 * mm]),
          p("보안 원칙", "SectionKo"),
          p("키를 프런트엔드 VITE_* 변수나 Git에 넣지 않는다. 공개 서버에는 공급자별 비밀값을 별도 설정하고 최소 권한·쿼터·리퍼러/호스트 제한을 적용한다. 채팅에 노출된 과거 키는 회전해야 한다. 깨진 키를 하나의 .env에 복사해도 연결 문제는 해결되지 않는다."),
          p("04  성능·지연 병목", "SectionKo"),
          table([
              ("병목", "근거", "우선 대응"),
              ("초기 JS", "빌드의 main 약 1.39 MB, terrain-grid 약 2.77 MB", "지도 외 패널·데이터셋 지연 로드, 번들 분석"),
              ("외부 API", "404·429·인증 미설정", "상태별 백오프, 재시도 상한, 캐시, 경로 복원"),
              ("GPU·발열", "다수 Cesium 레이어와 지속 렌더 가능성", "실기기 프로파일링 후 requestRenderMode·표시 개수 제한"),
              ("대용량 영상", "행사용 원본 MP4 약 168 MB", "짧은 압축본 별도 제작, preload=none"),
          ], [27 * mm, 65 * mm, W - 92 * mm]),
          p("C++/Wasm 교체 판단", "SectionKo"),
          p("현재 확인된 병목은 번들·네트워크·GPU 경로에 가깝다. C++ 전면 재작성은 해결 근거가 없다. CPU 프로파일에서 특정 지리 연산이 병목으로 확인될 때만 그 연산을 Wasm 후보로 분리한다."),
          PageBreak()]

risks = [
    ("CesiumJS", "낮음", "현재 엔진 유지"), ("deck.gl", "높음", "대량 포인트 단독 벤치마크"),
    ("Three.js", "높음", "Cesium 미지원 자산만"), ("Turf", "중간", "경계·재난 기하 연산 한정"),
    ("Supabase", "중간", "Auth 프로젝트·RLS 후 연동"), ("MapTiler SDK", "높음", "별도 내비 화면만 검토"),
    ("liquidglass", "높음", "GPU 셰이더 대신 현재 CSS"), ("ComfyUI waveform", "높음", "브라우저 구성요소로 부적합"),
    ("Coqui TTS", "높음", "별도 추론 서버·모델 권리"), ("rail-radar", "중간", "공식 지역 철도 피드 검증"),
    ("Cesium+Three 예제", "높음", "중복 렌더 루프 회피"), ("three-loader-3dtiles", "높음", "Cesium과 중복"),
    ("esri-leaflet", "높음", "Leaflet 전용 어댑터"), ("amber-alerts", "높음", "개인정보·공식 경보 검증"),
    ("OSRM backend", "중간", "별도 경로 서버 필요"), ("Leaflet.Rainviewer", "높음", "데이터 이용 조건 먼저"),
    ("maplibre-arcgis", "높음", "별도 내비 뷰·서비스 약관"), ("Tabler Icons", "낮음", "필요한 SVG만 선택"),
    ("disaster-pulse", "중간", "UI 참고, 데이터는 별도"), ("disaster-media-api", "높음", "권리·오정보 위험"),
    ("AG-UI", "중간", "인증된 에이전트 서버 이후"),
]
story += [p("05  제공된 GitHub 저장소 통합 판단", "SectionKo"),
          p("21개 고유 저장소를 검토했다. MapTiler SDK는 요청에서 두 번 등장한다. 저장소 코드 라이선스와 지도 타일·실시간 피드 사용권은 별개다. 아래 위험도는 이 Cesium 앱에 통합할 때의 충돌·비용·권리·성능 위험이다."),
          table([("저장소", "위험", "권장 적용 범위")] + risks, [50 * mm, 21 * mm, W - 71 * mm]),
          PageBreak(),
          p("06  다음 작업 순서", "SectionKo"),
          table([
              ("순위", "작업", "완료 기준"),
              ("1", "공개 API 404 목록 정리·핵심 레이어 복구", "기능별 실데이터 응답과 실패 상태를 사이트에서 검증"),
              ("2", "항공·선박 공급자 계약·키·쿼터", "상업적 사용 권리 및 서버 측 제한 확인"),
              ("3", "CCTV·교통·철도 지역별 공급자", "각 지역에서 실제 좌표와 갱신 시각 표시"),
              ("4", "인증 프로젝트 연결", "회원가입·로그인·세션·보호 API 동작"),
              ("5", "성능 프로파일과 분할 로딩", "첫 화면·메모리·발열·전환 시간 측정"),
              ("6", "재난 2차 피해", "공식 위험 모델·불확실성·면책 표기 검증"),
          ], [15 * mm, 70 * mm, W - 85 * mm]),
          p("검증 범위", "SectionKo"),
          p("Worker 단위 테스트 7개 통과. 공개 행사 페이지, QR, 영상, GBFS 프록시의 HTTP 200 확인. 전체 레이어와 모든 기기의 장시간 성능·정확성 검증은 아직 완료되지 않았다. 이 보고서는 코드 감사와 일부 공개 응답 검증이며 운영 인증서가 아니다."),
          p("상세 소스", "SectionKo"),
          p("docs/provider-and-repository-audit.md · docs/CURRENT-STATE.md · worker/index.js · vite.config.js · src/data/manager.js"),
          p("공개 사이트: https://godseyeview.jiyong0806.chatgpt.site/", "SmallKo")]

doc.build(story)
print(OUTPUT)
