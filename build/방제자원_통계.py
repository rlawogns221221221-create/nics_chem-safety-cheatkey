# -*- coding: utf-8 -*-
"""정리본(docs/방제자원_정리/표/)에서 발표용 수치를 뽑는다.

       python3 build/방제자원_통계.py

   보고서에 적는 숫자는 **여기서 세어 나온 값만** 씁니다. 손으로 적어 넣지
   않습니다 — 자료가 바뀌면 숫자도 같이 바뀌어야 하기 때문입니다."""
import collections, csv, json, os, re

여기 = os.path.dirname(os.path.abspath(__file__))
뿌리 = os.path.dirname(여기)
표곳 = os.path.join(뿌리, 'docs', '방제자원_정리', '표')
낼곳 = os.path.join(뿌리, 'docs', '방제자원_정리')


def 읽기(파일):
    with open(os.path.join(표곳, 파일), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def 수치(v):
    """'458', '69박스', '10개', '-' → 숫자만. 못 읽으면 None."""
    if not v:
        return None
    m = re.search(r'[\d,]+(?:\.\d+)?', v.replace(' ', ''))
    if not m:
        return None
    try:
        return float(m.group(0).replace(',', ''))
    except ValueError:
        return None


결과 = {}

# ── ① 지자체 보유 방재장비 ────────────────────────────────────────
r1 = 읽기('01_지자체_보유방재장비.csv')
시도 = collections.Counter(x['시도'] for x in r1)
지자체 = set((x['시도'], x['시군구']) for x in r1)
장비칸 = ['빈탱크로리', '굴착기', '암롤차', '스키드로더', '진공흡입차량', '지게차',
          '방독면', '보호복', '장갑', '장화', '소석회', '마른모래', '중탄산나트륨',
          '흡착포', '유처리제']
합 = {}
for k in 장비칸:
    합[k] = sum(수치(x[k]) or 0 for x in r1)
결과['지자체_보유방재장비'] = {
    '행수': len(r1), '지자체수': len(지자체), '시도수': len(시도),
    '주소있음': sum(1 for x in r1 if x['주소']),
    '대표전화있음': sum(1 for x in r1 if x['대표전화']),
    '장비합계': 합,
}

# ── ② 지자체 관할 폐기물·중장비 업체 ─────────────────────────────
r3 = 읽기('03_지자체_관할_폐기물중장비업체.csv')
업체 = set(x['업체명'] for x in r3 if x['업체명'])
결과['관할업체'] = {
    '행수': len(r3), '업체수': len(업체),
    '업종별': dict(collections.Counter(x['업종'] for x in r3).most_common()),
    '센터별': dict(collections.Counter(x['관할청센터'] for x in r3).most_common()),
    '주소있음': sum(1 for x in r3 if x['주소']),
    '대표전화있음': sum(1 for x in r3 if x['대표전화']),
    '장비적힘': sum(1 for x in r3 if x['보유장비']),
}

# ── ③ 청센터 방제장비함 ──────────────────────────────────────────
r4 = 읽기('04_청센터_방제장비함.csv')
설치 = set((x['설치장소'], x['주소']) for x in r4)
결과['방제장비함'] = {
    '행수': len(r4), '설치장소수': len(설치),
    '관리주체별': dict(collections.Counter(x['관리주체'] for x in r4).most_common()),
    '주소있음': sum(1 for x in r4 if x['주소']),
    '연락망있음': sum(1 for x in r4 if x['연락망']),
    '품목종류': len(set(x['방재장비'] for x in r4)),
}

# ── ④ 사업장 방제물품 (화학안전공동체) ───────────────────────────
r5 = 읽기('05_사업장_방제물품_화학안전공동체.csv')
사업장 = set(x['업체명'] for x in r5 if x['업체명'])
인원행 = [x for x in r5 if '인원' in x['장비·인력'] or '인력' in x['장비·인력']]
결과['화학안전공동체'] = {
    '행수': len(r5), '사업장수': len(사업장),
    '품목종류': len(set(x['장비·인력'] for x in r5)),
    '주소있음': sum(1 for x in r5 if x['소재지']),
    '대표전화있음': sum(1 for x in r5 if x['대표전화']),
    '방재인원행': len(인원행),
    '시도별': dict(collections.Counter(
        (x['소재지'].split()[0] if x['소재지'] else '(없음)') for x in r5).most_common(6)),
}

# ── ⑤ 독성가스 취급사업장 (위험시설) ─────────────────────────────
r6 = 읽기('06_독성가스_취급사업장.csv')
결과['독성가스'] = {
    '행수': len(r6),
    '사업장수': len(set((x['업체명'], x['주소']) for x in r6)),
    '물질종류': len(set(x['취급가스물질'] for x in r6 if x['취급가스물질'])),
    '시설분류': dict(collections.Counter(x['시설분류'] for x in r6).most_common(8)),
    '많이쓰는물질': dict(collections.Counter(
        x['취급가스물질'] for x in r6 if x['취급가스물질']).most_common(10)),
    '대표전화있음': sum(1 for x in r6 if x['대표전화']),
}

# ── ⑥ 그 밖 ─────────────────────────────────────────────────────
결과['해경'] = {'비축기지': len(set(x['비축기지'] for x in 읽기('07_해경_광역방제지원센터_비축물자.csv'))),
              '방제정': len(읽기('08_해경_화학방제정.csv'))}
결과['수질센터'] = {'장비종류': len(읽기('09_수질오염방제센터_보유장비.csv')), '권역': 4}
결과['ERaCV'] = {'업체': len(읽기('10_ERaCV_비상캡슐_보유업체.csv'))}
결과['중합방지제'] = {'업체': len(읽기('11_중합방지제_판매업체.csv'))}

r12 = 읽기('12_지정폐기물_처리업체_유역청별_건수.csv')
합계 = sum(int(x['합계']) for x in r12 if x['합계'].isdigit())
결과['지정폐기물'] = {'유역청수': len(r12), '확인된합계': 합계,
                  '미확인': [x['유역청'] for x in r12 if not x['합계'].isdigit()]}

# 대구청만 행 단위로 있습니다 — 나머지 6곳도 이 모양으로 받으면 바로 넣습니다
try:
    r13 = 읽기('13_지정폐기물_대구청.csv')
    결과['지정폐기물_대구청'] = {
        '행수': len(r13),
        '구분별': dict(collections.Counter(x['구분'] for x in r13).most_common()),
        '대표전화있음': sum(1 for x in r13 if x['대표전화']),
        '소재지표기': dict(collections.Counter(
            (x['소재지'].split()[0] if x['소재지'] else '(없음)') for x in r13).most_common()),
    }
except FileNotFoundError:
    결과['지정폐기물_대구청'] = None

# ── ⑨ 전국 폐기물처리업체 취합본 (구형식 xls 에서 옮김) ────────────
try:
    r14 = 읽기('14_폐기물처리업체_전국취합.csv')
    결과['폐기물_전국취합'] = {
        '행수': len(r14),
        '업체수': len(set((x['업체명'], x['소재지']) for x in r14)),
        '업종별': dict(collections.Counter(x['업종'] for x in r14).most_common()),
        '시도별': dict(collections.Counter(x['시도'] for x in r14).most_common()),
        '대표전화있음': sum(1 for x in r14 if x['대표전화']),
        '시군구있음': sum(1 for x in r14 if x['시군구']),
    }
except FileNotFoundError:
    결과['폐기물_전국취합'] = None

for 파일, 키 in [('15_전남광주_방제약품_판매업체.csv', '전남광주_방제약품'),
                ('16_전국_독성가스_회수업체.csv', '독성가스_회수업체')]:
    try:
        결과[키] = {'행수': len(읽기(파일))}
    except FileNotFoundError:
        결과[키] = None

# ── 행 단위로 확보한 '지점' 수 ──────────────────────────────────
#    ⚠ 03 의 폐기물업체 330곳과 14 의 1,505곳은 **일부 겹칠 수 있습니다**
#      (03 은 지자체가 파악한 관할 업체, 14 는 인허가 기준 전국 취합).
중장비 = len(set(x['업체명'] for x in r3 if '중장비' in x['업종']))
결과['행단위_지점'] = {
    '지자체 보유 장비': 결과['지자체_보유방재장비']['행수'],
    '관할 중장비 업체': 중장비,
    # 한 업체가 업종 여러 개로 여러 줄에 나오므로 **지점은 중복을 뺀 수**로 셉니다
    '폐기물처리업체(전국취합)': (결과['폐기물_전국취합'] or {}).get('업체수', 0),
    '방제장비함': 결과['방제장비함']['설치장소수'],
    '사업장 자체 방제물품': 결과['화학안전공동체']['사업장수'],
    '해경 비축기지': 결과['해경']['비축기지'],
    '해경 방제정': 결과['해경']['방제정'],
    '수질오염방제센터': 결과['수질센터']['권역'],
    'ERaCV': 결과['ERaCV']['업체'],
    '중합방지제': 결과['중합방지제']['업체'],
    '전남·광주 방제약품·크레인': (결과['전남광주_방제약품'] or {}).get('행수', 0),
    '독성가스 회수업체': (결과['독성가스_회수업체'] or {}).get('행수', 0),
}
결과['행단위_지점']['합계'] = sum(결과['행단위_지점'].values())

# ── ⑦ 개인정보 제거 ─────────────────────────────────────────────
r99 = 읽기('99_개인정보_제거현황.csv')
결과['개인정보제거'] = {x['원자료'] + ' · ' + x['지운 항목']: int(x['건수']) for x in r99}
결과['개인정보제거_합계'] = sum(int(x['건수']) for x in r99)

# ── ⑧ 지금 서비스에 들어 있는 것과 견주기 ───────────────────────
s = open(os.path.join(뿌리, 'data', 'resources.js'), encoding='utf-8').read()


def 뽑기(이름):
    i = s.index('var ' + 이름 + ' = ') + len('var ' + 이름 + ' = ')
    m = re.search(r';\s*(?:\n|\r\n)+(?:var |/\*|$)', s[i:])
    return json.loads(s[i:i + (m.start() if m else len(s) - i)])


현재 = 뽑기('RESOURCES')
결과['현재서비스'] = {
    '건수': len(현재),
    '종류별': dict(collections.Counter(x['t'] for x in 현재)),
    '기준일': 뽑기('RESOURCE_META')['기준일'],
}

with open(os.path.join(낼곳, '통계.json'), 'w', encoding='utf-8') as f:
    json.dump(결과, f, ensure_ascii=False, indent=2)

print(json.dumps(결과, ensure_ascii=False, indent=2))
