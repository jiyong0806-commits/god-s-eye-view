const subjects = new Map([
  ['atlantis', ['unverified', '아틀란티스는 전설 속 도시로, 실제 위치가 확인되지 않았습니다. 아래는 이름이 같은 지도 등록 장소입니다.']],
  ['아틀란티스', ['unverified', '아틀란티스는 전설 속 도시로, 실제 위치가 확인되지 않았습니다. 아래는 이름이 같은 지도 등록 장소입니다.']],
  ['backrooms', ['fictional', '백룸은 가상 세계입니다. 아래는 이름이 같은 지도 등록 장소이며, 가상 세계의 위치가 아닙니다.']],
  ['thebackrooms', ['fictional', '백룸은 가상 세계입니다. 아래는 이름이 같은 지도 등록 장소이며, 가상 세계의 위치가 아닙니다.']],
  ['백룸', ['fictional', '백룸은 가상 세계입니다. 아래는 이름이 같은 지도 등록 장소이며, 가상 세계의 위치가 아닙니다.']],
  ['백룸즈', ['fictional', '백룸은 가상 세계입니다. 아래는 이름이 같은 지도 등록 장소이며, 가상 세계의 위치가 아닙니다.']],
]);

export function searchPolicy(query) {
  const name = String(query || '').normalize('NFKC').trim().toLowerCase().replace(/[\s'’.-]/g, '');
  const subject = subjects.get(name);
  return subject ? { kind: subject[0], warning: subject[1], requireSelection: true, allowEntityFallback: false }
    : { kind: 'place-query', warning: '', requireSelection: false, allowEntityFallback: true };
}
