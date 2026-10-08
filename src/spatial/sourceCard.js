import { sourceDefinition, sourceState } from './sourceRegistry.js';

export function sourceCard(provenance) {
  const details = document.createElement('details'); details.className = 'source-card';
  const summary = document.createElement('summary'); summary.textContent = '출처 정보'; details.append(summary);
  try {
    const source = sourceDefinition(provenance.sourceId);
    const labels = { live: '실시간 관측', cached: '조회 기록', stale: '오래된 조회', offline: '연결 없음', error: '연결 실패' };
    const usage = { allowed: '허용 조건 확인', 'attribution-required': '출처 표시 필요', restricted: '사용 범위 제한', unknown: '사용 조건 미확인' };
    for (const [key, value] of [['공급자', source.provider], ['조회 시각', new Date(provenance.retrievedAt).toLocaleString('ko-KR')],
      ['상태', labels[sourceState(provenance)]], ['데이터 사용', usage[source.license.usage]], ['표시 출처', source.attribution]]) {
      const row = document.createElement('p'); row.textContent = `${key}: ${value}`; details.append(row);
    }
    const link = document.createElement('a'); link.textContent = '데이터 사용 조건'; link.href = source.license.url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; details.append(link);
  } catch { const row = document.createElement('p'); row.textContent = '출처 미등록 · 데이터 사용 불가'; details.append(row); }
  return details;
}
